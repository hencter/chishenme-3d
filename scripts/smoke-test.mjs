/**
 * 冒烟测试 —— npm test
 * ---------------------------------------------------------------
 * 不依赖浏览器，直接 import 模型与数学代码做结构校验：
 *   1. 18 个模型都能构建、没有 NaN 顶点、尺寸与落位符合约定
 *   2. 数据表与模型工厂一一对应
 *   3. 模型文件里引用的材质 key 全都真实存在（能抓到 `M.cucumber` 这种手滑）
 *   4. 转盘落点数学：一定向前转、一定停在目标盘子、速度曲线连续
 *   5. 决策权重与忌口逻辑符合预期
 */

import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DISHES } from '../src/data/dishes.js';
import { Store } from '../src/state.js';
import { accentFromPixels, rgbToHsl } from '../src/data/custom.js';
import { BUILDERS, buildDishModel, hasModel, STEAMY } from '../src/three/models/index.js';
import { createPodRing, LABEL_TEX_ASPECT, LABEL_W, LABEL_H } from '../src/three/pods.js';
import { M } from '../src/three/materials.js';
import {
  spinTarget,
  createSpinCurve,
  podWorldAngle,
  normalizeAngle,
  FRONT_ANGLE,
  TAU,
} from '../src/three/wheel-math.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

let passed = 0;
const failures = [];

function ok(condition, label, detail = '') {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function section(title) {
  console.log(`\n\u001b[36m▸ ${title}\u001b[0m`);
}

/* ================================================================== */
/* 1. 模型                                                             */
/* ================================================================== */

section('模型构建');

const expectedWidth = 1.05;
const expectedHeight = 1.06;

for (const dish of DISHES) {
  let root;
  try {
    root = buildDishModel(dish.id);
  } catch (err) {
    ok(false, `构建 ${dish.id}`, err.message);
    continue;
  }

  ok(root && root.isObject3D, `${dish.id} 返回了 Object3D`);

  let meshCount = 0;
  let badVertex = null;
  let badMatrix = null;

  root.traverse((o) => {
    if (o.isMesh) meshCount += 1;
    if (!o.matrixWorld.elements.every(Number.isFinite)) badMatrix = o.name || o.type;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 1) {
      if (!Number.isFinite(arr[i])) {
        badVertex = o.name || o.type;
        break;
      }
    }
  });

  ok(meshCount >= 3, `${dish.id} 有足够多的部件`, `mesh=${meshCount}`);
  ok(!badVertex, `${dish.id} 顶点中没有 NaN/Infinity`, String(badVertex));
  ok(!badMatrix, `${dish.id} 矩阵中没有 NaN`, String(badMatrix));

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  ok(Number.isFinite(size.x) && Number.isFinite(size.y) && Number.isFinite(size.z),
    `${dish.id} 包围盒有限`);
  ok(Math.max(size.x, size.z) <= expectedWidth + 1e-3,
    `${dish.id} 水平尺寸受控`, `${Math.max(size.x, size.z).toFixed(3)} > ${expectedWidth}`);
  ok(size.y <= expectedHeight + 1e-3, `${dish.id} 高度受控`, size.y.toFixed(3));
  ok(size.y > 0.12, `${dish.id} 不是个纸片`, size.y.toFixed(3));
  ok(approx(box.min.y, 0, 2e-3), `${dish.id} 底面贴在 y=0`, box.min.y.toFixed(5));
  ok(Math.abs(center.x) < 2e-3 && Math.abs(center.z) < 2e-3,
    `${dish.id} XZ 居中`, `(${center.x.toFixed(4)}, ${center.z.toFixed(4)})`);
}

/* ================================================================== */
/* 2. 数据表 ↔ 模型工厂                                                */
/* ================================================================== */

section('数据表与模型工厂的一致性');

for (const dish of DISHES) {
  ok(hasModel(dish.id), `数据表里的 ${dish.id} 有对应模型`);
}
const dishIds = new Set(DISHES.map((d) => d.id));
for (const id of Object.keys(BUILDERS)) {
  ok(dishIds.has(id), `模型工厂里的 ${id} 在数据表里存在`);
}

const categoryCount = new Map();
for (const d of DISHES) categoryCount.set(d.category, (categoryCount.get(d.category) || 0) + 1);
console.log(
  `  菜品 ${DISHES.length} 道，分类分布：` +
    [...categoryCount.entries()].map(([k, v]) => `${k}:${v}`).join(' '),
);
ok(DISHES.length >= 12, '菜品数量足够铺满星盘', String(DISHES.length));
ok([...STEAMY].every((id) => dishIds.has(id)), 'STEAMY 里的 id 都有效');

/* ================================================================== */
/* 3. 材质引用                                                         */
/* ================================================================== */

section('材质 key 引用');

const materialKeys = new Set(Object.keys(M));
const modelDir = join(srcDir, 'three', 'models');

for (const file of readdirSync(modelDir).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(join(modelDir, file), 'utf8');
  const used = new Set([...source.matchAll(/\bM\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  for (const key of used) {
    if (key === 'then' || key === 'catch') continue;
    ok(materialKeys.has(key), `${file} 引用的 M.${key} 存在`);
  }
}
console.log(`  材质库共 ${materialKeys.size} 项`);

/* ================================================================== */
/* 4. 名牌（悬浮菜品卡片）宽高比                                        */
/* ================================================================== */

section('名牌宽高比');

// 名牌贴图是 660×220。缩放一旦跑成正方形，菜名就会被压扁 —— 这是本项目
// 真实踩过的坑（update() 里误用 setScalar），所以这里把它钉死。
ok(approx(LABEL_W / LABEL_H, LABEL_TEX_ASPECT, 1e-9),
  '名牌基准尺寸符合贴图宽高比',
  `${(LABEL_W / LABEL_H).toFixed(4)} vs ${LABEL_TEX_ASPECT}`);

{
  const sample = DISHES.slice(0, 5);
  const testRing = createPodRing({ dishes: sample });
  testRing.layout(sample);

  const aspectOf = (pod) => pod.label.scale.x / pod.label.scale.y;

  for (const pod of testRing.pods) {
    ok(approx(aspectOf(pod), LABEL_TEX_ASPECT, 1e-6),
      `${pod.dish.id} 名牌初始宽高比正确`, aspectOf(pod).toFixed(4));
    ok(pod.label.scale.x > 0.01 && pod.label.scale.y > 0.01,
      `${pod.dish.id} 名牌尺寸不是 0`);
  }

  // 覆盖所有会改名牌缩放的路径：选中抬起、悬停、其他盘子变暗
  testRing.setSelected(1);
  testRing.setHover(testRing.podAt(2));
  for (let i = 0; i < 40; i += 1) testRing.update(1 / 60);

  for (const pod of testRing.pods) {
    ok(approx(aspectOf(pod), LABEL_TEX_ASPECT, 1e-6),
      `${pod.dish.id} 动画 40 帧后名牌宽高比仍正确`, aspectOf(pod).toFixed(4));
  }

  // 被选中的那张卡应该确实被放大了
  const lifted = testRing.podAt(1);
  ok(lifted.label.scale.x > LABEL_W * 1.05,
    '中选的盘子名牌被放大', `${lifted.label.scale.x.toFixed(3)} > ${LABEL_W}`);
  // 其它牌子应该变暗
  const dimmed = testRing.podAt(0);
  ok(dimmed.labelNormal.opacity < 0.6,
    '未中选的盘子名牌变暗', dimmed.labelNormal.opacity.toFixed(3));
}

/* ================================================================== */
/* 6. 自定义菜品（拍照加菜）                                             */
/* ================================================================== */

section('自定义菜品');

{
  const fake = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  globalThis.localStorage = fake;

  // ---- 主题色提取 ----
  // 纯红：应该得到一个偏红的主题色
  const redPixels = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i += 1) {
    redPixels[i * 4] = 210;
    redPixels[i * 4 + 1] = 40;
    redPixels[i * 4 + 2] = 30;
  }
  const redAccent = accentFromPixels(redPixels);
  const [rh, rs, rl] = rgbToHsl(
    ((redAccent >> 16) & 255) / 255,
    ((redAccent >> 8) & 255) / 255,
    (redAccent & 255) / 255,
  );
  ok(rh < 0.06 || rh > 0.94, '偏红的照片提取出偏红主题色', `h=${rh.toFixed(3)}`);
  ok(rs >= 0.45, '主题色饱和度足够', rs.toFixed(3));
  ok(rl >= 0.45 && rl <= 0.68, '主题色亮度落在好看区间', rl.toFixed(3));

  // 绿色
  const greenPixels = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i += 1) {
    greenPixels[i * 4] = 60;
    greenPixels[i * 4 + 1] = 180;
    greenPixels[i * 4 + 2] = 70;
  }
  const greenHue = rgbToHsl(
    ((accentFromPixels(greenPixels) >> 16) & 255) / 255,
    ((accentFromPixels(greenPixels) >> 8) & 255) / 255,
    (accentFromPixels(greenPixels) & 255) / 255,
  )[0];
  ok(greenHue > 0.2 && greenHue < 0.45, '偏绿的照片提取出偏绿主题色', `h=${greenHue.toFixed(3)}`);

  // 全黑 / 全白照片要退回默认色而不是变成黑或白
  const black = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i += 1) black[i * 4 + 3] = 255;
  ok(accentFromPixels(black) === 0xffb347, '全黑照片退回默认主题色');

  const white = new Uint8Array(64 * 4);
  for (let i = 0; i < 64 * 4; i += 1) white[i] = 250;
  ok(accentFromPixels(white) === 0xffb347, '全白照片退回默认主题色');
  ok(accentFromPixels(new Uint8Array(0)) === 0xffb347, '空像素退回默认主题色');

  // ---- 自定义菜品的 3D 模型 ----
  const customDish = {
    id: 'c-test-1',
    name: '妈妈牌红烧肉',
    emoji: '🍖',
    category: 'chinese',
    desc: '肥而不腻',
    tip: '',
    kcal: 620,
    price: 0,
    spicy: 0,
    tags: ['自家做'],
    accent: 0xb04a2a,
    custom: true,
    createdAt: Date.now(),
    hasPhoto: false,
  };

  let plaque = null;
  try {
    plaque = buildDishModel(customDish);
  } catch (err) {
    ok(false, '自定义菜品模型能构建', err.message);
  }
  if (plaque) {
    const box = new THREE.Box3().setFromObject(plaque);
    const size = box.getSize(new THREE.Vector3());
    ok(size.y > 0.3, '照片立牌有正常高度', size.y.toFixed(3));
    ok(Math.max(size.x, size.z) <= 1.05 + 1e-3, '照片立牌水平尺寸受控');
    ok(Math.abs(box.min.y) < 2e-3, '照片立牌底面贴 y=0', box.min.y.toFixed(5));
    ok(!!plaque.userData.photoMaterial, '立牌暴露了照片材质供异步换图');
    ok(plaque.userData.photoMaterial.map?.isTexture, '立牌默认带一张占位贴图');
    ok(plaque.userData.photoMaterial.userData.ownsMap === false,
      '占位贴图标记为非私有（不能释放全局缓存的贴图）');
  }

  // ---- 字符串 id 的老用法不能坏 ----
  ok(buildDishModel('ramen').userData.dishId === 'ramen', '传字符串 id 仍然可用');

  // ---- Store 支持动态菜品表 ----
  const s3 = new Store({ customDishes: [customDish] });
  ok(s3.dishes.length === DISHES.length + 1, '自定义菜并入菜品表');
  ok(s3.dishes[0].id === 'c-test-1', '自定义菜排在菜单最前面');
  ok(s3.dishById('c-test-1')?.name === '妈妈牌红烧肉', 'dishById 能查到自定义菜');

  s3.setCategory('mine');
  ok(s3.visibleDishes.length === 1 && s3.visibleDishes[0].custom, '「我的」分类只显示自定义菜');
  s3.setCategory('chinese');
  ok(s3.visibleDishes.some((d) => d.id === 'c-test-1'), '自定义菜也出现在它所属的分类里');
  s3.setCategory('all');
  ok(s3.visibleDishes.length === DISHES.length + 1, '「全部」包含自定义菜');

  // 自定义菜参与抽签
  const rng3 = seeded(31);
  let hit = false;
  for (let i = 0; i < 3000; i += 1) {
    if (s3.pick(rng3).id === 'c-test-1') hit = true;
  }
  ok(hit, '自定义菜会被抽中');

  // 删掉之后忌口清单要跟着清理
  s3.ban('c-test-1');
  ok(s3.isBanned('c-test-1'), '可以拉黑自定义菜');
  s3.setCustomDishes([]);
  ok(!s3.isBanned('c-test-1'), '菜被删掉后忌口清单自动清理');
  ok(s3.dishById('c-test-1') === null, '删掉后查不到了');
  ok(s3.visibleDishes.length === DISHES.length, '菜品表回到内置的 18 道');
}

/* ================================================================== */
/* 7. 转盘数学                                                         */
/* ================================================================== */

section('转盘落点数学');

for (let count = 1; count <= 24; count += 1) {
  for (let index = 0; index < count; index += 1) {
    for (const currentY of [0, 0.7, 3.9, -2.2, 17.4]) {
      const target = spinTarget({ currentY, index, count, turns: 4 });
      const world = podWorldAngle(target, index, count);
      const diff = Math.abs(normalizeAngle(world - FRONT_ANGLE));
      const wrapped = Math.min(diff, TAU - diff);
      if (wrapped > 1e-9) {
        ok(false, `落点 count=${count} index=${index}`, `偏差 ${wrapped}`);
      }
      if (!(target > currentY + 4 * TAU - 1e-9)) {
        ok(false, `向前旋转 count=${count} index=${index}`, `${currentY} → ${target}`);
      }
    }
  }
}
ok(true, '所有 (count, index) 组合都精确停在目标盘子');

section('转速曲线');

for (const distance of [0.001, 1, TAU * 4, TAU * 12, 300]) {
  const curve = createSpinCurve({ distance });
  ok(approx(curve.at(0), 0, 1e-9), `D=${distance} 起点为 0`);
  ok(approx(curve.at(curve.duration), distance, 1e-6), `D=${distance} 终点精确`);
  ok(approx(curve.at(curve.duration * 2), distance, 1e-6), `D=${distance} 越界后保持不动`);
  ok(curve.at(curve.windup) < 0, `D=${distance} 有回拉起手`);

  // (a) 先验证 speedAt 确实是 at() 的解析导数（在每个分段的内部取点，用中心差分对照）
  const phases = [
    ['回拉', curve.windup * 0.5],
    ['加速', curve.windup + curve.accel * 0.5],
    ['匀速', curve.windup + curve.accel + curve.cruise * 0.5],
    ['减速', curve.windup + curve.accel + curve.cruise + curve.decel * 0.4],
  ];
  for (const [name, t] of phases) {
    const h = 1e-6;
    const numeric = (curve.at(t + h) - curve.at(t - h)) / (2 * h);
    const analytic = curve.speedAt(t);
    const tol = Math.max(1e-4, Math.abs(analytic) * 2e-3);
    ok(Math.abs(numeric - analytic) <= tol,
      `D=${distance} ${name}段 speedAt 是 at 的导数`,
      `${numeric.toFixed(6)} vs ${analytic.toFixed(6)}`);
  }

  // (b) 接缝处：左右两侧的解析导数必须收敛到同一个值。
  //     用「差值随 h 线性收敛到 0」来验证连续性，比固定容差严格得多。
  const seams = [
    ['回拉→加速', curve.windup],
    ['加速→匀速', curve.windup + curve.accel],
    ['匀速→减速', curve.windup + curve.accel + curve.cruise],
  ];
  for (const [name, seam] of seams) {
    const h1 = 1e-4;
    const h2 = h1 / 20;
    const gap1 = Math.abs(curve.speedAt(seam - h1) - curve.speedAt(seam + h1));
    const gap2 = Math.abs(curve.speedAt(seam - h2) - curve.speedAt(seam + h2));
    ok(gap2 < gap1 * 0.2 + 1e-12,
      `D=${distance} ${name}接缝速度连续`,
      `h=${h1} 差 ${gap1.toExponential(2)} → h/20 差 ${gap2.toExponential(2)}`);
  }

  // 回拉段角速度必须为负
  ok(curve.speedAt(curve.windup * 0.5) < 0, `D=${distance} 回拉段角速度为负`);

  // 回拉之后角速度非负（不应倒退）
  let minSpeed = Infinity;
  for (let i = 0; i <= 200; i += 1) {
    const t = curve.windup + (i / 200) * (curve.duration - curve.windup);
    minSpeed = Math.min(minSpeed, curve.speedAt(t));
  }
  ok(minSpeed >= -1e-9, `D=${distance} 回拉之后不倒转`, minSpeed.toFixed(6));
}

/* ================================================================== */
/* 5. 决策逻辑                                                         */
/* ================================================================== */

section('决策权重与忌口');

const fakeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
globalThis.localStorage = fakeStorage();

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const store = new Store();
ok(store.visibleCount === DISHES.length, '全部菜品默认可见', String(store.visibleCount));

const probs = store.probabilities();
ok(probs.size === DISHES.length, '概率表覆盖全部菜品');
const sum = [...probs.values()].reduce((a, b) => a + b, 0);
ok(approx(sum, 1, 1e-9), '概率归一化', String(sum));

// 加权抽样应该能覆盖到每一道菜
const hits = new Set();
const rng = seeded(20240913);
for (let i = 0; i < 4000; i += 1) hits.add(store.pick(rng).id);
ok(hits.size === DISHES.length, '抽样能覆盖全部菜品', `${hits.size}/${DISHES.length}`);

// 不重样：刚点过的菜权重应该被压下去
const ramen = DISHES.find((d) => d.id === 'ramen');
const before = store.weightFor(ramen);
store.record(ramen);
const after = store.weightFor(ramen);
ok(after < before, '刚点过的菜权重下降', `${before.toFixed(3)} → ${after.toFixed(3)}`);

store.setStyle('variety');
const varietyWeight = store.weightFor(ramen);
store.setStyle('balanced');
const balancedWeight = store.weightFor(ramen);
ok(varietyWeight < balancedWeight, '「不重样」风格进一步压低重复菜');

// 省钱风格：便宜的菜权重更高
store.clearHistory();
store.setStyle('budget');
const fries = DISHES.find((d) => d.id === 'fries'); // ¥18
const steak = DISHES.find((d) => d.id === 'steak'); // ¥168
ok(store.weightFor(fries) > store.weightFor(steak), '「省钱」风格偏向便宜的菜');

// 轻食风格：低卡优先
store.setStyle('light');
const roasted = DISHES.find((d) => d.id === 'roastedveg'); // 280 kcal
const hotpotDish = DISHES.find((d) => d.id === 'hotpot'); // 1120 kcal
ok(store.weightFor(roasted) > store.weightFor(hotpotDish), '「轻食」风格偏向低卡的菜');
store.setStyle('balanced');

// 忌口
store.ban('hotpot');
ok(store.isBanned('hotpot'), '忌口生效');
ok(!store.visibleDishes.some((d) => d.id === 'hotpot'), '忌口菜品从可见列表移除');
const rng2 = seeded(7);
for (let i = 0; i < 600; i += 1) {
  if (store.pick(rng2).id === 'hotpot') {
    ok(false, '忌口菜品不会被抽中');
    break;
  }
}
ok(store.unban('hotpot'), '解除忌口');

// 分类筛选
store.setCategory('dessert');
ok(store.visibleDishes.every((d) => d.category === 'dessert'), '分类筛选生效');
ok(store.visibleDishes.length === categoryCount.get('dessert'), '分类数量与数据表一致');
store.setCategory('all');

// 吃过标记
store.clearHistory();
const pickDish = DISHES[0];
store.record(pickDish);
ok(store.stats().total === 1, '记录一次点名');
ok(store.stats().eaten === 0, '还没标记为吃过');
ok(store.acceptLatest(), '标记「就它了」');
ok(store.stats().eaten === 1, '吃过计数增加');
ok(!store.acceptLatest(), '同一条记录不会重复标记');

// 全部拉黑后不应该崩溃
const s2 = new Store();
for (const d of DISHES) s2.ban(d.id);
ok(s2.visibleCount === 0, '全部拉黑后可见数为 0');
ok(s2.pick() === null, '没有可选项时返回 null');

/* ================================================================== */

section('结果');

const total = passed + failures.length;
if (failures.length) {
  console.log(`\u001b[31m✗ ${failures.length}/${total} 项失败\u001b[0m`);
  for (const f of failures.slice(0, 40)) console.log(`   · ${f}`);
  if (failures.length > 40) console.log(`   … 还有 ${failures.length - 40} 条`);
  process.exit(1);
} else {
  console.log(`\u001b[32m✓ 全部 ${total} 项检查通过\u001b[0m`);
}
