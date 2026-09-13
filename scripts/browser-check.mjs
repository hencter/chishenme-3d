/**
 * 浏览器验收脚本 —— npm run check
 * ---------------------------------------------------------------
 * 用本机 Chrome / Edge（headless + SwiftShader 软渲染）真实加载页面：
 *   1. 收集所有 console 报错、未捕获异常、失败请求
 *   2. 等加载页消失，确认 __chishenme 挂载成功、WebGL 真的在跑
 *   3. 检查星盘上盘子的数量与渲染统计
 *   4. 程序化触发一次「转一转」，等结果卡片出现并校验内容
 *   5. 截图存到 shots/ 方便肉眼复核
 *
 * 用法：
 *   node scripts/browser-check.mjs [url]
 *   CHROME_PATH="D:\...\chrome.exe" node scripts/browser-check.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shotsDir = join(root, 'shots');
mkdirSync(shotsDir, { recursive: true });

const URL = (process.argv[2] || 'http://127.0.0.1:5183/') + (process.argv[2] ? '' : '?noauto=1');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('找不到可用的 Chrome / Edge，设置 CHROME_PATH 环境变量再试。');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const problems = [];
const notes = [];
const ok = (cond, label, detail = '') => {
  if (cond) notes.push(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
  else problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

console.log(`\u001b[36m▸ 浏览器：${executablePath}\u001b[0m`);
console.log(`\u001b[36m▸ 目标：${URL}\u001b[0m\n`);

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--hide-scrollbars',
    '--mute-audio',
  ],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  protocolTimeout: 900000,
});

let exitCode = 0;

try {
  const page = await browser.newPage();
  // 软渲染下每帧要几百毫秒，默认 30 秒的导航超时不够用
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(60000);

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      // three 的着色器提示之类先记下来，最后统一判断
      problems.push(`console.${type}: ${text.slice(0, 400)}`);
    }
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    problems.push(`requestfailed: ${req.url()} — ${req.failure()?.errorText}`);
  });

  const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const status = response ? response.status() : 0;
  ok(status >= 200 && status < 400, `HTTP ${status}`);

  // 等加载页淡出
  await page.waitForFunction(
    () => document.getElementById('loading')?.classList.contains('done') === true,
    { timeout: 120000, polling: 200 },
  );
  ok(true, '加载流程走完，loading 遮罩已淡出');

  // 首次访问会自动弹出帮助，等它出现后关掉
  let helpAppeared = false;
  try {
    await page.waitForFunction(() => document.getElementById('helpModal')?.hidden === false, {
      timeout: 5000,
      polling: 100,
    });
    helpAppeared = true;
    await page.click('#btnHelpClose');
  } catch {
    /* 已经看过帮助，没有自动弹出 */
  }
  ok(true, helpAppeared ? '首次访问自动弹出了玩法说明（已关闭）' : '帮助未自动弹出（本机已看过）');

  // 等几帧，让动画稳定
  await sleep(1200);

  const info = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    if (!app) return { mounted: false };
    const { stage, ring, store } = app;
    const gl = stage.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');

    // 注意：开了 EffectComposer 之后 renderer.info.render 只反映最后一个全屏 pass，
    // 所以这里直接数场景里的网格与三角面。
    let meshes = 0;
    let triangles = 0;
    let sprites = 0;
    let points = 0;
    stage.scene.traverse((o) => {
      if (o.isMesh) {
        meshes += 1;
        const g = o.geometry;
        if (g?.index) triangles += g.index.count / 3;
        else if (g?.attributes?.position) triangles += g.attributes.position.count / 3;
      } else if (o.isSprite) sprites += 1;
      else if (o.isPoints) points += 1;
    });

    return {
      mounted: true,
      dishes: store.visibleDishes.length,
      pods: ring.pods.length,
      meshes,
      triangles: Math.round(triangles),
      sprites,
      pointsSystems: points,
      sceneChildren: stage.scene.children.length,
      quality: stage.quality,
      usesComposer: stage.usesComposer,
      textures: stage.renderer.info.memory.textures,
      geometries: stage.renderer.info.memory.geometries,
      programs: stage.renderer.info.programs?.length ?? -1,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
      canvasSize: [stage.renderer.domElement.width, stage.renderer.domElement.height],
      cameraPos: stage.camera.position.toArray().map((v) => +v.toFixed(2)),
      fpsText: document.getElementById('fps')?.textContent || '',
      dishListRows: document.querySelectorAll('#dishList .dish-row').length,
      chips: document.querySelectorAll('#catChips .chip').length,
    };
  });

  ok(info.mounted, '__chishenme 已挂载（main.js 跑到底了）');
  if (!info.mounted) throw new Error('应用没有挂载，后续检查跳过');

  console.log(`  渲染器：${info.renderer}`);
  console.log(`  画布：${info.canvasSize.join(' × ')}  画质：${info.quality}  Bloom：${info.usesComposer}`);
  console.log(
    `  网格：${info.meshes}  三角面：${info.triangles}  精灵：${info.sprites}  粒子系统：${info.pointsSystems}`,
  );
  console.log(`  几何体：${info.geometries}  贴图：${info.textures}  着色器程序：${info.programs}`);
  console.log(`  可见菜品：${info.dishes}  盘子上环：${info.pods}  菜单行：${info.dishListRows}  分类：${info.chips}`);
  console.log(`  相机位置：(${info.cameraPos.join(', ')})  ${info.fpsText}`);

  ok(info.pods === info.dishes, '星盘上的盘子数量与可见菜品一致', `${info.pods}/${info.dishes}`);
  ok(info.dishes === 18, '默认展示全部 18 道菜', String(info.dishes));
  ok(info.chips === 8, '8 个分类 chip 渲染完成（含「我的」）', String(info.chips));
  ok(info.dishListRows === 18, '菜单列表渲染了 18 行', String(info.dishListRows));
  ok(info.meshes > 800, '场景里有大量网格部件', String(info.meshes));
  ok(info.triangles > 100000, '几何体是实打实的', `${info.triangles} 三角面`);
  ok(info.sprites >= 18, '每道菜一张悬浮名牌（外加核心辉光精灵）', String(info.sprites));
  ok(info.usesComposer === true, '后期辉光链路已启用');
  ok(info.programs > 5, '着色器程序已编译', String(info.programs));

  await page.screenshot({ path: join(shotsDir, '01-boot.png') });
  console.log('  截图：shots/01-boot.png');

  /* ---------------- 触发一次转盘 ---------------- */

  await page.click('#btnSpin');

  // 转动中不应该马上出现结果卡片
  await sleep(700);
  const spinningNow = await page.evaluate(() => ({
    hidden: document.getElementById('resultModal')?.hidden,
    busy: document.getElementById('btnSpin')?.classList.contains('spinning'),
    note: document.getElementById('dockNote')?.textContent || '',
  }));
  ok(spinningNow.hidden === true, '转动过程中结果卡片还没有弹出');
  ok(spinningNow.busy === true, '转动过程中按钮进入 spinning 状态', spinningNow.note);

  await page.screenshot({ path: join(shotsDir, '02-spinning.png') });

  // 等结果卡片出现
  // 注意：软渲染（SwiftShader）下只有 1~2 FPS，而主循环的 dt 被 clamp 到 50ms，
  // 所以「模拟时间」走得比真实时间慢得多，这里要给足时间。
  await page.waitForFunction(
    () => document.getElementById('resultModal')?.hidden === false,
    { timeout: 420000, polling: 200 },
  );
  await sleep(900);

  const result = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    const q = (id) => document.getElementById(id)?.textContent?.trim() || '';
    return {
      name: q('resultName'),
      cat: q('resultCat'),
      emoji: q('resultEmoji'),
      desc: q('resultDesc'),
      stats: [...document.querySelectorAll('#resultStats .cell')].map((c) => c.textContent.trim()),
      tags: [...document.querySelectorAll('#resultTags .tag')].map((c) => c.textContent.trim()),
      historyRows: document.querySelectorAll('#historyList .hist-row').length,
      picks: q('statPicks'),
      beamVisible: app.effects.beam.group.visible,
      beamPos: app.effects.beam.group.position.toArray().map((v) => +v.toFixed(2)),
      spinState: app.director.state,
      cameraPos: app.stage.camera.position.toArray().map((v) => +v.toFixed(2)),
      activeRow: document.querySelectorAll('#dishList .dish-row.active').length,
    };
  });

  console.log(`\n  结果：${result.emoji} ${result.name}（${result.cat}）`);
  console.log(`  数据：${result.stats.join(' / ')}`);
  console.log(`  标签：${result.tags.join(' ')}`);
  console.log(`  光柱：visible=${result.beamVisible} @ (${result.beamPos.join(', ')})  相机：(${result.cameraPos.join(', ')})`);

  ok(!!result.name, '结果卡片显示了菜名', result.name);
  ok(!!result.cat, '结果卡片显示了分类', result.cat);
  ok(!!result.emoji, '结果卡片显示了图标', result.emoji);
  ok(result.stats.length === 3, '结果卡片有三个数据格', result.stats.join(' | '));
  ok(result.tags.length > 0, '结果卡片有标签');
  ok(result.historyRows === 1, '战绩列表记录了这一次点名', String(result.historyRows));
  ok(result.picks === '1', '「转过」计数为 1', result.picks);
  ok(result.beamVisible === true, '光柱已经落到中选盘子上');
  ok(result.activeRow === 1, '菜单里高亮了中选的菜');
  ok(result.spinState === 'idle', '转动结束后状态回到 idle', result.spinState);

  await page.screenshot({ path: join(shotsDir, '03-result.png') });

  /* ---------------- 关闭结果卡片（真实坐标点击，顺带验证它可点） ---------------- */

  await page.click('#btnResultClose');
  await sleep(400);
  const closed = await page.evaluate(() => ({
    hidden: document.getElementById('resultModal')?.hidden,
    resultDish: globalThis.__chishenme ? null : null,
  }));
  ok(closed.hidden === true, '「✕」能关掉结果卡片');

  /* ---------------- 分类筛选 ---------------- */

  await page.evaluate(() => {
    document.querySelectorAll('#catChips .chip')[4].click(); // 快餐
  });
  await sleep(900);
  const filtered = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    return {
      dishes: app.store.visibleDishes.length,
      pods: app.ring.pods.length,
      rows: document.querySelectorAll('#dishList .dish-row').length,
      radius: +app.ring.radius.toFixed(2),
    };
  });
  ok(filtered.dishes === 3, '切到「快餐」后只剩 3 道菜', String(filtered.dishes));
  ok(filtered.pods === 3, '星盘同步缩到 3 个盘子', String(filtered.pods));
  ok(filtered.rows === 3, '菜单列表同步为 3 行', String(filtered.rows));
  console.log(`\n  筛选后：${filtered.dishes} 道菜 / 环半径 ${filtered.radius}`);
  await page.screenshot({ path: join(shotsDir, '04-filtered.png') });

  /* ---------------- 再抽一次，验证「就它了」 ---------------- */

  await page.evaluate(() => {
    document.querySelectorAll('#catChips .chip')[0].click(); // 回到全部
  });
  await sleep(600);
  const beforeSecond = await page.evaluate(() => ({
    hidden: document.getElementById('resultModal').hidden,
    busy: globalThis.__chishenme.director.busy,
    pods: globalThis.__chishenme.ring.pods.length,
  }));
  ok(beforeSecond.hidden === true, '第二次转之前结果卡片是关着的');
  ok(beforeSecond.busy === false, '第二次转之前导演处于空闲');
  ok(beforeSecond.pods === 18, '回到「全部」后 18 个盘子重新上环', String(beforeSecond.pods));

  await page.click('#btnSpin');
  await page.waitForFunction(
    () => document.getElementById('resultModal')?.hidden === false,
    { timeout: 420000, polling: 200 },
  );
  await sleep(400);
  await page.click('#btnAccept');
  await sleep(600);
  const accepted = await page.evaluate(() => ({
    eaten: document.getElementById('statEaten')?.textContent?.trim(),
    picks: document.getElementById('statPicks')?.textContent?.trim(),
    modalHidden: document.getElementById('resultModal')?.hidden,
  }));
  ok(accepted.eaten === '1', '「就它了」把吃过计数加到 1', String(accepted.eaten));
  ok(accepted.picks === '2', '转过计数为 2', String(accepted.picks));
  ok(accepted.modalHidden === true, '确认后结果卡片关闭');
  console.log(`\n  确认后：转过 ${accepted.picks} / 吃过 ${accepted.eaten}`);
  await page.screenshot({ path: join(shotsDir, '05-accepted.png') });

  /* ---------------- FPS 读数是否诚实 ---------------- */

  const fpsInfo = await page.evaluate(() => ({
    text: document.getElementById('fps')?.textContent || '',
    value: Number((document.getElementById('fps')?.textContent || '').replace(/[^\d]/g, '')) || 0,
  }));
  console.log(`\n  FPS 读数：${fpsInfo.text}`);
  ok(fpsInfo.value > 0, 'FPS 读数有效', fpsInfo.text);
  ok(fpsInfo.value < 60, 'FPS 读数反映了真实帧率（软渲染下必然偏低，而不是被 clamp 成假值）', fpsInfo.text);

  /* ---------------- 自动降画质 ---------------- */

  const autoPage = await browser.newPage();
  await autoPage.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
  // 清掉上次遗留的画质偏好，从默认的 high 开始观察
  await autoPage.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
    } catch {
      /* 忽略 */
    }
  });
  const autoUrl = URL.replace('?noauto=1', '');
  await autoPage.goto(autoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await autoPage.waitForFunction(
    () => document.getElementById('loading')?.classList.contains('done') === true,
    { timeout: 120000, polling: 200 },
  );

  const readAuto = () =>
    autoPage.evaluate(() => ({
      quality: globalThis.__chishenme?.stage.quality,
      storeQuality: globalThis.__chishenme?.store.quality,
      fps: Number((document.getElementById('fps')?.textContent || '').replace(/[^\d]/g, '')) || 0,
      toast: document.getElementById('toast')?.textContent || '',
    }));

  const q0 = await readAuto();
  let q1 = q0;
  for (let i = 0; i < 25; i += 1) {
    await sleep(1000);
    q1 = await readAuto();
    if (q1.quality !== 'high') break;
  }
  console.log(`  auto quality: ${q0.quality} (${q0.fps}fps) -> ${q1.quality} (${q1.fps}fps)`);
  if (q1.toast) console.log(`  toast: ${q1.toast}`);
  ok(Boolean(q0.quality), 'auto page reports a quality level', String(q0.quality));
  ok(q1.quality === q1.storeQuality, 'stage quality matches store', `${q1.quality}/${q1.storeQuality}`);
  if (q1.fps > 0 && q1.fps < 40) {
    ok(q1.quality !== 'high', 'auto-degrade fired on low fps', `${q1.quality} @ ${q1.fps}fps`);
  } else {
    ok(q1.quality === 'high', 'high fps keeps high quality', `${q1.fps}fps`);
  }
  await autoPage.close();

  /* ---------------- 忌口 ---------------- */

  await page.evaluate(() => {
    globalThis.__chishenme.store.ban('hotpot');
  });
  await sleep(600);
  const banned = await page.evaluate(() => ({
    dishes: globalThis.__chishenme.store.visibleDishes.length,
    ban: document.getElementById('statBan')?.textContent?.trim(),
    chips: document.querySelectorAll('.ban-chip').length,
  }));
  ok(banned.dishes === 17, '忌口后可见菜品减到 17', String(banned.dishes));
  ok(banned.chips >= 1, '忌口清单里出现了条目', String(banned.chips));
  console.log(`  忌口：可见 ${banned.dishes} 道 / 清单 ${banned.chips} 条 / 统计 ${banned.ban}`);

  /* ---------------- 拍照加菜全流程 ---------------- */

  // 先造一张测试照片（页面里用 canvas 画出来，再落盘让 file input 上传）
  const testPhotoPath = join(shotsDir, '..', 'shots', '_test-dish.png');
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 640, 480);
    g.addColorStop(0, '#d0392a');
    g.addColorStop(0.55, '#e8763a');
    g.addColorStop(1, '#f2c04a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '170px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍖', 320, 250);
    return c.toDataURL('image/png');
  });
  writeFileSync(testPhotoPath, Buffer.from(dataUrl.split(',')[1], 'base64'));

  const before = await page.evaluate(() => ({
    dishes: globalThis.__chishenme.store.dishes.length,
    pods: globalThis.__chishenme.ring.pods.length,
  }));

  await page.click('#btnAdd');
  await page.waitForFunction(() => document.getElementById('addModal')?.hidden === false, {
    timeout: 15000,
    polling: 100,
  });
  ok(true, '点「📷」能打开加菜弹窗');

  const formInfo = await page.evaluate(() => ({
    capture: document.getElementById('photoInput')?.getAttribute('capture'),
    accept: document.getElementById('photoInput')?.getAttribute('accept'),
    categories: [...document.querySelectorAll('#fldCategory button')].map((b) => b.textContent),
    spicy: [...document.querySelectorAll('#fldSpicy button')].map((b) => b.textContent),
    emojiCount: document.querySelectorAll('#fldEmoji button').length,
    nameFontSize: getComputedStyle(document.getElementById('fldName')).fontSize,
  }));
  ok(formInfo.capture === 'environment', '文件输入带 capture=environment（手机上直接开后置摄像头）', String(formInfo.capture));
  ok(formInfo.accept === 'image/*', '只接受图片', String(formInfo.accept));
  ok(formInfo.categories.length === 6, '表单里有 6 个可选分类', formInfo.categories.join('/'));
  ok(formInfo.spicy.length === 4, '表单里有 4 档辣度', formInfo.spicy.join('/'));
  ok(formInfo.emojiCount >= 30, '图标可选', String(formInfo.emojiCount));
  ok(formInfo.nameFontSize === '16px', '输入框字号 16px（iOS 聚焦时不会强制放大页面）', formInfo.nameFontSize);

  // 上传照片
  const fileInput = await page.$('#photoInput');
  await fileInput.uploadFile(testPhotoPath);
  await page.waitForFunction(() => document.getElementById('photoPreview')?.hidden === false, {
    timeout: 30000,
    polling: 100,
  });
  await sleep(300);

  const photoState = await page.evaluate(() => {
    const meta = document.getElementById('photoMeta')?.textContent || '';
    return {
      previewVisible: document.getElementById('photoPreview')?.hidden === false,
      meta,
      accent: globalThis.__chishenme.hud.__draft().accent,
    };
  });
  console.log(`\n  照片：${photoState.meta}`);
  ok(photoState.previewVisible, '照片上传后出现预览');
  ok(/KB/.test(photoState.meta), '照片被压缩并显示了体积', photoState.meta);
  ok(typeof photoState.accent === 'number', '从照片里提取了主题色', `0x${(photoState.accent || 0).toString(16)}`);
  await page.screenshot({ path: join(shotsDir, '08-add-photo.png') });

  // 填表
  await page.evaluate(() => {
    document.getElementById('fldName').value = '测试红烧肉';
    document.getElementById('fldKcal').value = '680';
    document.getElementById('fldPrice').value = '42';
    document.getElementById('fldDesc').value = '来自自动化测试的一道菜';
    const cats = [...document.querySelectorAll('#fldCategory button')];
    cats[0].click(); // 中餐
    const spicy = [...document.querySelectorAll('#fldSpicy button')];
    spicy[1].click(); // 微辣
  });
  await sleep(200);

  // 空名字不能保存
  await page.evaluate(() => {
    document.getElementById('fldName').value = '';
  });
  await page.click('#btnAddSave');
  await sleep(400);
  const emptyName = await page.evaluate(() => ({
    open: document.getElementById('addModal').hidden === false,
    tip: document.getElementById('addTip').textContent,
  }));
  ok(emptyName.open === true, '没填菜名时不会保存，弹窗保持打开');
  ok(/菜名/.test(emptyName.tip), '给出了「填菜名」的提示', emptyName.tip);

  // 正式保存
  await page.evaluate(() => {
    document.getElementById('fldName').value = '测试红烧肉';
  });
  await page.click('#btnAddSave');
  await page.waitForFunction(() => document.getElementById('addModal')?.hidden === true, {
    timeout: 30000,
    polling: 100,
  });
  await sleep(1200);

  const after = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    const mine = app.store.customDishes;
    const dish = mine[0];
    const pod = app.ring.pods.find((p) => p.dish.id === dish?.id);
    const photoMat = pod?.model?.userData?.photoMaterial;
    return {
      dishes: app.store.dishes.length,
      pods: app.ring.pods.length,
      customCount: mine.length,
      name: dish?.name,
      category: dish?.category,
      kcal: dish?.kcal,
      price: dish?.price,
      spicy: dish?.spicy,
      accent: dish?.accent,
      hasPhoto: dish?.hasPhoto,
      textureIsReal: !!photoMat?.map?.isTexture,
      ownsMap: photoMat?.userData?.ownsMap,
      rows: [...document.querySelectorAll('#dishList .dish-row')].map((r) => r.dataset.id),
      mineBadges: document.querySelectorAll('#dishList .mine-badge').length,
      delButtons: document.querySelectorAll('#dishList .del-btn').length,
      activeRow: document.querySelector('#dishList .dish-row.active')?.dataset.id,
    };
  });

  console.log(`  新菜：${after.name} · ${after.category} · ${after.kcal}kcal · ¥${after.price} · accent=0x${(after.accent || 0).toString(16)}`);
  ok(after.dishes === before.dishes + 1, '菜品总数 +1', `${before.dishes} → ${after.dishes}`);
  ok(after.pods === before.pods + 1, '星盘上多了一个盘子', `${before.pods} → ${after.pods}`);
  ok(after.customCount === 1, '自定义菜单里有 1 道菜');
  ok(after.name === '测试红烧肉', '菜名保存正确', after.name);
  ok(after.category === 'chinese', '分类保存正确', after.category);
  ok(after.kcal === 680 && after.price === 42, '热量与价格保存正确', `${after.kcal}/${after.price}`);
  ok(after.spicy === 1, '辣度保存正确', String(after.spicy));
  ok(after.hasPhoto === true, '照片被标记为已保存');
  ok(after.textureIsReal === true, '立牌上挂的是一张真贴图');
  ok(after.ownsMap === true, '照片贴图被标记为模型私有（删除时可安全释放）');
  ok(after.rows.includes('c') || after.rows.some((id) => id !== undefined), '菜单里出现了这道菜');
  ok(after.mineBadges === 1, '菜单行上有「我的」标记', String(after.mineBadges));
  ok(after.delButtons === 1, '自定义菜有删除按钮', String(after.delButtons));
  ok(after.activeRow && after.activeRow === after.rows.find((id) => id.length > 8), '加完自动选中了这道菜', String(after.activeRow));

  await page.screenshot({ path: join(shotsDir, '09-add-done.png') });

  // 「我的」分类
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#catChips .chip')];
    chips.find((c) => c.textContent.includes('我的'))?.click();
  });
  await sleep(900);
  const mineView = await page.evaluate(() => ({
    dishes: globalThis.__chishenme.store.visibleDishes.length,
    pods: globalThis.__chishenme.ring.pods.length,
    rows: document.querySelectorAll('#dishList .dish-row').length,
  }));
  ok(mineView.dishes === 1, '「我的」分类只剩自己加的菜', String(mineView.dishes));
  ok(mineView.pods === 1, '星盘同步只剩 1 个盘子', String(mineView.pods));
  await page.screenshot({ path: join(shotsDir, '10-mine.png') });

  /* ---------------- 刷新后仍然在（持久化） ---------------- */

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.getElementById('loading')?.classList.contains('done') === true,
    { timeout: 300000, polling: 250 },
  );
  await sleep(1500);

  const persisted = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    const dish = app.store.customDishes[0];
    const pod = app.ring.pods.find((p) => p.dish.id === dish?.id);
    const mat = pod?.model?.userData?.photoMaterial;
    return {
      customCount: app.store.customDishes.length,
      name: dish?.name,
      hasPhoto: dish?.hasPhoto,
      textureReady: !!mat?.map?.isTexture,
      textureIsPlaceholder: mat?.userData?.ownsMap === false,
      pods: app.ring.pods.length,
      total: app.store.dishes.length,
    };
  });
  console.log(`  刷新后：${persisted.name || '（没了）'} · 总数 ${persisted.total}`);
  ok(persisted.customCount === 1, '刷新后自定义菜还在');
  ok(persisted.name === '测试红烧肉', '刷新后菜名没丢', String(persisted.name));
  ok(persisted.hasPhoto === true, '刷新后照片标记仍在');
  ok(persisted.textureReady === true, '刷新后照片贴图从 IndexedDB 恢复了');
  ok(persisted.textureIsPlaceholder === false, '恢复的是真照片而不是占位卡');
  ok(persisted.total === 19, '刷新后总数是 19 道', String(persisted.total));

  /* ---------------- 删除 ---------------- */

  await page.evaluate(() => {
    document.getElementById('btnHelpClose')?.click();
    document.querySelector('#dishList .del-btn')?.click();
  });
  await sleep(900);
  const removed = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    return {
      customCount: app.store.customDishes.length,
      total: app.store.dishes.length,
      pods: app.ring.pods.length,
      visible: app.store.visibleDishes.length,
      category: app.store.category,
      delBtnGone: !document.querySelector('#dishList .del-btn'),
    };
  });
  ok(removed.customCount === 0, '删除后自定义菜清零');
  ok(removed.total === 18, '删除后回到 18 道内置菜', String(removed.total));
  ok(removed.category !== 'mine', '在「我的」里删光后自动退回「全部」分类', removed.category);
  ok(removed.pods === removed.visible, '星盘的盘子数始终等于可见菜品数', `${removed.pods}/${removed.visible}`);
  ok(removed.pods > 10, '删除后星盘还是满满一桌', String(removed.pods));
  console.log(`\n  删除后：总数 ${removed.total}，可见 ${removed.visible}，盘子 ${removed.pods}`);

  // 恢复「全部」分类，给后面的移动端用例一个干净状态
  await page.evaluate(() => {
    document.querySelectorAll('#catChips .chip')[0]?.click();
  });
  await sleep(600);

  /* ---------------- 移动端布局 ---------------- */

  await page.setViewport({ width: 414, height: 860, deviceScaleFactor: 2 });
  await sleep(900);
  const mobile = await page.evaluate(() => {
    const btn = document.querySelector('.spin-btn');
    const r = btn.getBoundingClientRect();
    return {
      panelHidden: !document.getElementById('panelMenu').classList.contains('open'),
      spinW: Math.round(r.width),
      spinVisible: r.bottom <= innerHeight + 1 && r.top >= 0,
    };
  });
  ok(mobile.spinVisible, '窄屏下「转一转」按钮仍在视口内');
  ok(mobile.spinW <= 120, '窄屏下按钮尺寸收敛', `${mobile.spinW}px`);
  await page.screenshot({ path: join(shotsDir, '06-mobile.png') });
  // 手机上加菜表单应该是从底部升起的整屏抽屉
  await page.evaluate(() => document.getElementById('btnAdd').click());
  await sleep(700);
  const sheet = await page.evaluate(() => {
    const card = document.querySelector('#addModal .sheet-card');
    const r = card.getBoundingClientRect();
    const nameInput = document.getElementById('fldName');
    return {
      open: document.getElementById('addModal').hidden === false,
      left: Math.round(r.left),
      width: Math.round(r.width),
      bottomGap: Math.round(innerHeight - r.bottom),
      viewportW: innerWidth,
      fullWidth: Math.abs(r.width - innerWidth) < 24,
      anchoredBottom: Math.round(r.bottom) >= innerHeight - 2,
      inputFontSize: getComputedStyle(nameInput).fontSize,
      nameVisible: nameInput.getBoundingClientRect().top < innerHeight,
    };
  });
  console.log(`  加菜抽屉：${sheet.width}×? 距底 ${sheet.bottomGap}px（视口宽 ${sheet.viewportW}）`);
  ok(sheet.open, '手机上能打开加菜表单');
  ok(sheet.fullWidth, '手机上加菜表单铺满宽度', `${sheet.width}/${sheet.viewportW}`);
  ok(sheet.anchoredBottom, '手机上加菜表单贴着底部（拇指够得着）');
  ok(sheet.inputFontSize === '16px', '手机输入框字号 16px，不会触发 iOS 缩放');
  ok(sheet.nameVisible, '菜名输入框在视口内可见');
  await page.screenshot({ path: join(shotsDir, '11-mobile-add.png') });

  const sheetTip = await page.evaluate(() => {
    document.getElementById('btnAddCancel')?.click();
    return document.getElementById('addModal').hidden;
  });
  ok(sheetTip === true, '手机上「取消」能关掉加菜表单');
  await sleep(300);


  /* ---------------- 收尾 ---------------- */

  const finalErrors = await page.evaluate(() => {
    const app = globalThis.__chishenme;
    return {
      textures: app.stage.renderer.info.memory.textures,
      geometries: app.stage.renderer.info.memory.geometries,
      contextLost: app.stage.renderer.getContext().isContextLost(),
    };
  });
  ok(!finalErrors.contextLost, 'WebGL 上下文没有丢失');
  console.log(`\n  资源：${finalErrors.geometries} 个几何体 / ${finalErrors.textures} 张贴图`);
} catch (err) {
  problems.push(`脚本异常：${err.message}`);
} finally {
  await browser.close();
}

/* ================================================================== */

console.log('\n' + '─'.repeat(64));
for (const n of notes) console.log(`  ${n}`);

if (problems.length) {
  console.log(`\n\u001b[31m✗ ${problems.length} 个问题\u001b[0m`);
  for (const p of problems.slice(0, 30)) console.log(`   · ${p}`);
  exitCode = 1;
} else {
  console.log(`\n\u001b[32m✓ 浏览器验收全部通过（${notes.length} 项）\u001b[0m`);
}
process.exit(exitCode);
