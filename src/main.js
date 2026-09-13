/**
 * 吃什么好呢 · 3D 美食星盘
 * ---------------------------------------------------------------
 * 入口：把状态、场景、星盘、转盘导演、特效与 DOM 界面接在一起。
 */

import * as THREE from 'three';

import { DISHES } from './data/dishes.js';
import {
  addCustomDish,
  decodeImage,
  getCustomDishes,
  getPhotoBlob,
  removeCustomDish,
} from './data/custom.js';
import { Store } from './state.js';
import { createStage } from './three/scene.js';
import { createPodRing } from './three/pods.js';
import { createSpinDirector } from './three/spin.js';
import { createPhotoTexture } from './three/models/custom.js';
import {
  createAmbientMotes,
  createCore,
  createBeam,
  createBurst,
  createShockRing,
} from './three/effects.js';
import { createAudio } from './ui/audio.js';
import { createHud } from './ui/hud.js';
import { normalizeAngle, easeInOutCubic, clamp } from './three/wheel-math.js';

const canvas = document.getElementById('scene');
const store = new Store();
const audio = createAudio();
audio.setEnabled(store.sound);

/* ------------------------------------------------------------------ */
/* 舞台                                                                */
/* ------------------------------------------------------------------ */

let stage;
try {
  stage = createStage(canvas, { quality: store.quality });
} catch (err) {
  console.error(err);
  const text = document.getElementById('loadingText');
  const bar = document.getElementById('loadingBar');
  if (text) {
    text.innerHTML =
      '你的浏览器 / 显卡没能创建 WebGL 上下文。<br />请更新浏览器、开启硬件加速，或换一台设备再试。';
  }
  if (bar) bar.style.width = '100%';
  throw err;
}

const { scene, camera } = stage;

/* ------------------------------------------------------------------ */
/* 特效                                                                */
/* ------------------------------------------------------------------ */

const motes = createAmbientMotes();
const core = createCore();
const beam = createBeam();
const burst = createBurst();
const shockRing = createShockRing();

scene.add(motes.points, core.group, beam.group, burst.points, shockRing.ring);

const effects = { beam, burst, shockRing, core, motes };

/* ------------------------------------------------------------------ */
/* 星盘                                                                */
/* ------------------------------------------------------------------ */

const ring = createPodRing({ dishes: DISHES, narrow: stage.narrow });
scene.add(ring.group);

/** 盘子顺序：换一批时会被打乱，切分类时保留已有相对次序 */
let order = [];

function computeVisible() {
  const allowed = new Set(store.visibleDishes.map((d) => d.id));
  const kept = order.filter((id) => allowed.has(id));
  const added = store.dishes
    .filter((d) => allowed.has(d.id) && !kept.includes(d.id))
    .map((d) => d.id);
  order = [...kept, ...added];
  return order.map((id) => store.dishById(id)).filter(Boolean);
}

let visibleDishes = [];

function applyLayout() {
  visibleDishes = computeVisible();
  ring.layout(visibleDishes);
  hud.render();
}

/** 星盘变大变小之后，重新把它放进画面 */
function reframe() {
  ring.setProfile(stage.narrow);
  stage.ensureFraming(ring.worldRadius() + 1.1);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

const hud = createHud({
  store,
  actions: {
    click: () => audio.click(),
    spin: () => doSpin(),
    reshuffle: () => doReshuffle(),
    resetView: () => resetView(),
    select: (index, dish) => selectDish(index, dish, { showCard: true }),
    accept: (dish) => acceptDish(dish),
    ban: (dish) => banDish(dish),
    unban: (id) => {
      store.unban(id);
      hud.toast('已把它请回菜单');
    },
    addDish: (input, blob, previewUrl) => addDishAction(input, blob, previewUrl),
    removeDish: (dish) => removeDishAction(dish),
    focusView: () => {
      const pod = currentPod();
      if (pod) director.focusOnPod(pod, 0.6);
    },
  },
});

/* ------------------------------------------------------------------ */
/* 转盘导演                                                            */
/* ------------------------------------------------------------------ */

let selectedIndex = -1;

const director = createSpinDirector({
  stage,
  ring,
  effects,
  callbacks: {
    onTick: (speed) => audio.tick(speed),
    onStateChange: (state) => {
      hud.setSpinBusy(state !== 'idle');
      if (state === 'spinning') {
        hud.setDockNote('别催，正在认真纠结…');
        hud.setActiveDish(null);
      }
    },
    onLand: (dish) => {
      audio.land();
      audio.fanfare();
      hud.buzz(30);
      store.record(dish);
      hud.setActiveDish(dish.id);
    },
    onSettled: (dish) => {
      hud.setDockNote(`「${dish.name}」已就位 · 空格 = 就它了`);
      hud.showResult(dish);
    },
  },
});

function currentPod() {
  return selectedIndex >= 0 ? ring.podAt(selectedIndex) : null;
}

/** 加载完成之前不接受任何操作 */
let ready = false;

/* ------------------------------------------------------------------ */
/* 动作                                                                */
/* ------------------------------------------------------------------ */

function doSpin() {
  if (!ready || director.busy) return;
  audio.unlock();
  const pool = visibleDishes;
  if (!pool.length) {
    hud.toast('这个分类下一道菜都没有，先在右边解除几个忌口');
    return;
  }
  const dish = store.pick();
  if (!dish) return;
  const index = pool.findIndex((d) => d.id === dish.id);
  if (index < 0) return;

  cancelRingTween();
  selectedIndex = index;
  hud.hideResult();
  audio.whoosh();
  // 低帧率设备（比如软渲染 / 老机器）把旋转时长压一压，别让人干等
  const timeScale = lastFps > 45 ? 1 : lastFps > 25 ? 0.72 : 0.45;
  director.start(index, pool.length, dish, { timeScale });
}

function selectDish(index, dish, { showCard = false } = {}) {
  if (director.busy) return;
  cancelRingTween();
  selectedIndex = index;
  ring.setSelected(index);
  ring.setHover(null);
  hud.setActiveDish(dish.id);
  hud.setDockNote(`「${dish.name}」已就位 · 空格 = 就它了`);
  const pod = ring.podAt(index);
  if (pod) {
    const world = new THREE.Vector3();
    pod.root.getWorldPosition(world);
    beam.placeAt(world.x, world.z);
    beam.show(dish.accent);
    director.focusOnPod(pod, 0.8);
  }
  if (showCard) hud.showResult(dish);
}

function acceptDish(dish) {
  const last = store.history[0];
  if (last && last.id === dish.id && !last.eaten) {
    store.acceptLatest();
  } else {
    store.record(dish);
    store.acceptLatest();
  }
  audio.fanfare();
  hud.buzz(24);
  hud.toast(`「${dish.name}」记上了，去吃吧 🍽`);
  hud.setDockNote('已记入今日战绩');
}

function banDish(dish) {
  store.ban(dish.id);
  hud.toast(`「${dish.name}」以后不会再出现了`);
  if (selectedIndex >= 0) {
    selectedIndex = -1;
    ring.setSelected(-1);
    beam.hide();
    director.flyHome(0.6);
  }
}

/* ---------------- 拍照加菜 / 删菜 ---------------- */

/** 把一张 Blob 照片变成能贴到立牌上的贴图 */
async function photoTextureFromBlob(blob) {
  const bitmap = await decodeImage(blob);
  const tex = createPhotoTexture(bitmap);
  if (bitmap.close) bitmap.close();
  return tex;
}

/**
 * 启动时把用户自己加的菜从存储里读回来，并把照片解码成贴图。
 * 任何一张照片读失败都只影响它自己，不会拖垮整个加载流程。
 */
async function loadCustomDishes() {
  const list = getCustomDishes();
  let withPhoto = 0;
  for (const dish of list) {
    if (!dish.hasPhoto) continue;
    try {
      const blob = await getPhotoBlob(dish.id);
      if (!blob) {
        dish.hasPhoto = false;
        continue;
      }
      dish.photoTexture = await photoTextureFromBlob(blob);
      withPhoto += 1;
    } catch (err) {
      console.warn('[custom] 照片读取失败', dish.id, err);
      dish.hasPhoto = false;
    }
  }
  store.setCustomDishes(list);
  order = [];
  return { total: list.length, withPhoto };
}

async function addDishAction(input, blob, previewUrl) {
  const dish = await addCustomDish(input, blob, previewUrl);
  if (blob) {
    try {
      dish.photoTexture = await photoTextureFromBlob(blob);
    } catch (err) {
      console.warn('[custom] 照片贴图生成失败', err);
      dish.hasPhoto = false;
    }
  }
  // addCustomDish 返回的就是仓库内部那个对象，贴图已经挂在它身上了
  store.setCustomDishes(getCustomDishes());
  hud.toast(`「${dish.name}」已经摆上桌了 🍽`);
  hud.buzz(24);
  audio.fanfare();
  if (store.category !== 'all' && store.category !== dish.category && store.category !== 'mine') {
    store.setCategory('all');
  }
  // 加完直接把它选中，让用户看到自己拍的菜（setCustomDishes 已经触发过重排布）
  const idx = visibleDishes.findIndex((d) => d.id === dish.id);
  if (idx >= 0) selectDish(idx, dish, { showCard: false });
}

async function removeDishAction(dish) {
  await removeCustomDish(dish.id);
  store.unban(dish.id);
  ring.forget(dish.id);
  // 在「我的」里删掉最后一道自己加的菜之后，星盘会空掉 —— 自动退回「全部」
  const remaining = getCustomDishes();
  if (store.category === 'mine' && remaining.length === 0) {
    store.setCategory('all');
  }
  store.setCustomDishes(remaining);
  hud.toast(`「${dish.name}」已从菜单里删掉`);
}

function resetView() {
  cancelRingTween();
  selectedIndex = -1;
  ring.setSelected(-1);
  ring.setHover(null);
  hud.setActiveDish(null);
  beam.hide();
  stage.resetUserZoom();
  ring.setProfile(stage.narrow);
  director.flyHome();
  stage.ensureFraming(ring.worldRadius() + 1.1, { force: true });
  hud.setDockNote('拖动旋转视角 · 滚轮缩放 · 点击美食直接选中');
}

/* ---------------- 换一批 ---------------- */

let ringTween = null;

function cancelRingTween() {
  ringTween = null;
}

function doReshuffle() {
  if (director.busy) return;
  audio.unlock();
  audio.whoosh();

  // 打乱顺序
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  applyLayout();

  selectedIndex = -1;
  ring.setSelected(-1);
  beam.hide();
  hud.setActiveDish(null);
  hud.setDockNote('重新摆盘完成');

  // 转一小圈让「换一批」有手感
  const from = ring.group.rotation.y;
  ringTween = {
    t: 0,
    dur: 1.05,
    from,
    to: from + Math.PI * 1.35 + Math.random() * Math.PI * 0.7,
  };
}

/* ------------------------------------------------------------------ */
/* 指针交互                                                            */
/* ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false;
let pointerMoved = true;
let downAt = null;
let hoveredPod = null;

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointerMoved = true;
}

canvas.addEventListener('pointerenter', (e) => {
  pointerInside = true;
  updatePointer(e);
});
canvas.addEventListener('pointerleave', () => {
  pointerInside = false;
  pointerMoved = false;
  if (hoveredPod) {
    hoveredPod = null;
    ring.setHover(null);
    canvas.style.cursor = 'grab';
  }
});
canvas.addEventListener('pointermove', (e) => {
  updatePointer(e);
  if (!downAt) return;
});
canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  audio.unlock();
});
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 7) return; // 拖动视角，不算点击
  if (director.busy) return;

  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(ring.hitTargets(), false);
  const pod = hits.length ? ring.findPod(hits[0].object) : null;

  if (pod) {
    selectDish(pod.slot, pod.dish, { showCard: true });
  } else {
    resetView();
  }
});

function updateHover() {
  if (!pointerMoved || !pointerInside) return;
  pointerMoved = false;
  if (director.busy) {
    if (hoveredPod) {
      hoveredPod = null;
      ring.setHover(null);
      canvas.style.cursor = 'grab';
    }
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(ring.hitTargets(), false);
  const pod = hits.length ? ring.findPod(hits[0].object) : null;
  if (pod !== hoveredPod) {
    hoveredPod = pod;
    ring.setHover(pod);
    canvas.style.cursor = pod ? 'pointer' : 'grab';
  }
}

/* ------------------------------------------------------------------ */
/* 状态订阅                                                            */
/* ------------------------------------------------------------------ */

store.subscribe((_, detail) => {
  hud.render();
  if (detail.type === 'quality') stage.setQuality(store.quality);
  if (detail.type === 'category' || detail.type === 'ban' || detail.type === 'dishes') {
    director.cancel();
    selectedIndex = -1;
    ring.setSelected(-1);
    beam.hide();
    applyLayout();
    reframe();
  }
});

window.addEventListener('resize', () => {
  stage.resize();
  reframe();
});
window.addEventListener('orientationchange', () => {
  // iOS 上旋转后尺寸要等一拍才更新
  setTimeout(() => {
    stage.resize();
    reframe();
  }, 260);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) lastTime = performance.now();
});

/* ------------------------------------------------------------------ */
/* 加载                                                                */
/* ------------------------------------------------------------------ */

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function preload() {
  hud.setLoading(0.02, '正在热锅…');

  // 场景先渲染一帧，让加载页背后不至于全黑
  stage.render();
  await nextFrame();

  hud.setLoading(0.05, '看看你加了哪些菜…');
  const custom = await loadCustomDishes();
  if (custom.total) {
    hud.setLoading(0.1, `读回 ${custom.total} 道你自己加的菜…`);
    await nextFrame();
  }

  const all = store.dishes;
  const total = all.length;
  for (let i = 0; i < total; i += 1) {
    const dish = all[i];
    ring.preload([dish]);
    hud.setLoading(0.12 + (i / total) * 0.85, `正在摆盘：${dish.emoji} ${dish.name}…`);
    if (i % 2 === 1) await nextFrame();
  }

  applyLayout();
  reframe();
  hud.setLoading(1, '上菜！');
  await nextFrame();
  await nextFrame();

  hud.finishLoading();
  hud.setDockNote('拖动旋转视角 · 滚轮缩放 · 点击美食直接选中');
  ready = true;

  if (custom.total) {
    hud.toast(`菜单里有 ${custom.total} 道你自己加的菜`, 3000);
  } else if (!store.seenHelp) {
    setTimeout(() => hud.openHelp(), 900);
  }
}

/* ------------------------------------------------------------------ */
/* 主循环                                                              */
/* ------------------------------------------------------------------ */

let lastTime = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;
let slowWindows = 0;
let autoDowngraded = 0;
let spinBoost = 0;
let lastFps = 60;

// ?noauto=1 可以关掉「帧率低就自动降画质」，方便截图与自动化验收
const autoQualityEnabled = !new URLSearchParams(globalThis.location?.search || '').has('noauto');

function tick(now) {
  // 注意：dt 要 clamp（避免切标签页回来时跳帧），但 FPS 必须用未 clamp 的真实帧间隔，
  // 否则在慢机器上会永远显示成 20 FPS，自动降画质就永远不会触发。
  const raw = (now - lastTime) / 1000;
  const dt = clamp(raw, 0, 0.05);
  lastTime = now;
  lastFps = raw > 0 ? 1 / raw : lastFps;

  // 换一批的小旋转
  if (ringTween) {
    ringTween.t += dt;
    const u = clamp(ringTween.t / ringTween.dur, 0, 1);
    ring.group.rotation.y =
      ringTween.from + (ringTween.to - ringTween.from) * easeInOutCubic(u);
    if (u >= 1) {
      ring.group.rotation.y = normalizeAngle(ring.group.rotation.y);
      ringTween = null;
    }
  }

  director.update(dt, {
    onSpinSpeed: (v) => {
      spinBoost = v;
    },
  });

  ring.update(dt);
  core.update(dt, { boost: spinBoost });
  motes.update(dt);
  beam.update(dt);
  burst.update(dt);
  shockRing.update(dt);

  updateHover();

  if (stage.controls.enabled) stage.controls.update();
  stage.render();

  /* ---- FPS 统计与自动降画质 ---- */
  fpsAccum += raw;
  fpsFrames += 1;
  if (fpsAccum >= 0.6) {
    // 极慢的机器上 0.6 秒窗口里可能只有一两帧，四舍五入会变成 0，至少报 1
    const fps = Math.max(1, Math.round(fpsFrames / fpsAccum));
    hud.setFps(fps);
    fpsAccum = 0;
    fpsFrames = 0;

    if (autoQualityEnabled && fps < 40) {
      slowWindows += 1;
      if (slowWindows >= 3 && autoDowngraded < 2) {
        autoDowngraded += 1;
        slowWindows = 0;
        const next = stage.quality === 'high' ? 'balanced' : 'low';
        store.setQuality(next);
        hud.toast('检测到帧率偏低，已自动降低画质（可在右上角 ✨ 手动改回）', 3200);
      }
    } else {
      slowWindows = Math.max(0, slowWindows - 1);
    }
  }
}

stage.renderer.setAnimationLoop(tick);

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

preload().catch((err) => {
  console.error('[preload]', err);
  hud.failLoading('出错了，看看控制台');
});

// 便于调试
globalThis.__chishenme = { store, stage, ring, director, hud, effects };
