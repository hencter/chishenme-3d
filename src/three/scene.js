/**
 * 舞台
 * ---------------------------------------------------------------
 * 渲染器 / 相机 / 控制器 / 光照 / 环境贴图 / 桌面 / 后期辉光。
 * 后期链路：RenderPass → UnrealBloomPass → OutputPass
 * （用 OutputPass 负责色调映射与色彩空间转换，这是 r15x 之后的标准写法）
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { tableTexture, applyAnisotropy } from './textures.js';
import { makeStd } from './materials.js';

export const SCENE_BG = 0x0a0604;

/* ------------------------------------------------------------------ */
/* 自建「影棚」环境贴图                                                 */
/* ------------------------------------------------------------------ */

/**
 * 用一组自发光面板搭一个盒子，再用 PMREM 烘成环境贴图。
 * 比加载 HDR 文件轻得多，而且暖色调可以自己定。
 */
function buildStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(13, 13, 13),
    new THREE.MeshBasicMaterial({ color: 0x0a0605, side: THREE.BackSide }),
  );
  room.add(shell);

  /** 加一块 HDR 强度面板（Color 分量可以大于 1） */
  const panel = (w, h, r, g, b, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    room.add(m);
    return m;
  };

  // 顶部大柔光板（主光，暖）
  panel(7.5, 7.5, 5.6, 4.5, 3.4, [0, 6.4, 0], [Math.PI / 2, 0, 0]);
  // 左侧暖光
  panel(4.5, 3.2, 2.8, 2.0, 1.35, [-6.4, 1.7, 1], [0, Math.PI / 2, 0]);
  // 右侧冷光（补色，让阴影不至于死黑）
  panel(4.5, 3.2, 1.1, 1.45, 2.1, [6.4, 1.2, 1], [0, -Math.PI / 2, 0]);
  // 背后一条橙色边光
  panel(6, 2.6, 2.4, 1.3, 0.6, [0, 1.5, -6.4], null);
  // 地面：深色，避免下方过亮
  panel(10, 10, 0.05, 0.04, 0.03, [0, -6.4, 0], [-Math.PI / 2, 0, 0]);

  const target = pmrem.fromScene(room, 0.04);

  room.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  pmrem.dispose();

  return target.texture;
}

/* ------------------------------------------------------------------ */
/* 桌面                                                                */
/* ------------------------------------------------------------------ */

function buildTable(renderer) {
  const tex = tableTexture();
  applyAnisotropy(tex, renderer.capabilities.getMaxAnisotropy());

  const topMat = makeStd('tableTop', {
    map: tex,
    color: 0xffffff,
    // 高粗糙度 + 低金属度 + 很弱的环境反射：
    // 否则掠射角上的菲涅耳反射会把桌面近处冲成一片白，抢了菜的戏
    roughness: 0.82,
    metalness: 0.06,
    envMapIntensity: 0.22,
  });
  const sideMat = makeStd('tableSide', {
    color: 0x14100c,
    roughness: 0.72,
    metalness: 0.25,
  });
  const bottomMat = makeStd('tableBottom', { color: 0x080505, roughness: 1 });

  const geo = new THREE.CylinderGeometry(5.5, 5.75, 0.45, 96, 1);
  const table = new THREE.Mesh(geo, [sideMat, topMat, bottomMat]);
  table.position.y = -0.225; // 台面正好落在 y = 0
  table.receiveShadow = true;
  table.name = 'table';
  return table;
}

/* ------------------------------------------------------------------ */
/* 舞台                                                                */
/* ------------------------------------------------------------------ */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{quality?: 'high'|'balanced'|'low', onError?: (e:any)=>void}} [opts]
 */
export function createStage(canvas, { quality = 'high' } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch (err) {
    const e = new Error('WEBGL_UNAVAILABLE');
    e.cause = err;
    throw e;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG);
  scene.fog = new THREE.FogExp2(SCENE_BG, 0.032);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 3.5, 8.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.55, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 2.4;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = 1.3;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;
  controls.update();

  // 用户自己缩放过之后，resize 就不再强行帮他取景
  let userZoomed = false;
  canvas.addEventListener('wheel', () => {
    userZoomed = true;
  }, { passive: true });
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) userZoomed = true;
    },
    { passive: true },
  );

  /* ---------------- 环境与光照 ---------------- */

  const envTexture = buildStudioEnvironment(renderer);
  scene.environment = envTexture;
  scene.environmentIntensity = 1.35;

  const hemi = new THREE.HemisphereLight(0xffd7a8, 0x180d05, 0.55);

  const key = new THREE.DirectionalLight(0xfff0dc, 3.4);
  key.position.set(5.5, 8.6, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 26;
  key.shadow.camera.left = -6.5;
  key.shadow.camera.right = 6.5;
  key.shadow.camera.top = 6.5;
  key.shadow.camera.bottom = -6.5;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;

  const fill = new THREE.DirectionalLight(0xa8c8ff, 0.9);
  fill.position.set(-6, 4.5, -5);

  const rim = new THREE.DirectionalLight(0xff9a4a, 1.05);
  rim.position.set(0, 3.2, -8.5);

  // 中心暖芯，让餐桌看起来是「热」的
  const core = new THREE.PointLight(0xff7a2e, 7.5, 16, 2);
  core.position.set(0, 1.15, 0);

  const table = buildTable(renderer);
  scene.add(table);

  const lights = new THREE.Group();
  lights.add(hemi, key, fill, rim, core);
  scene.add(lights);

  /* ---------------- 后期 ---------------- */

  let composer = null;
  let bloom = null;
  const wantsComposer = () => quality !== 'low';

  function buildComposer() {
    if (!wantsComposer()) return;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.72, 0.8);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  buildComposer();

  /* ---------------- 尺寸与取景 ---------------- */

  let width = 1;
  let height = 1;

  function applyPixelRatio() {
    const cap = quality === 'high' ? 2 : quality === 'balanced' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, cap));
  }

  /**
   * 竖屏手机上水平视野只有 20° 出头，整个星盘根本塞不进去。
   * 所以窄屏时改用「加大 fov + 拉近」的过山车视角：
   * 一次看到正前方两三道菜，其余的靠转盘转过来 —— 这在小屏上反而更好点。
   */
  function viewportProfile() {
    const aspect = width / Math.max(1, height);
    const narrow = aspect < 1.15;
    return { aspect, narrow };
  }

  /** 让半径 worldRadius 的星盘在画面里舒服地放下，需要的相机距离 */
  function preferredDistance(worldRadius) {
    const { narrow } = viewportProfile();
    if (narrow) return clamp(worldRadius * 2.1 + 2.3, 5.6, 7.8);
    return clamp(worldRadius * 2.75, 8.0, 12.8);
  }

  function applyProfile() {
    const { narrow } = viewportProfile();
    const wantFov = narrow ? 56 : 42;
    if (camera.fov !== wantFov) {
      camera.fov = wantFov;
      camera.updateProjectionMatrix();
    }
    // 窄屏时抬高一点俯角，让盘子看起来更像俯视的转盘
    controls.minPolarAngle = narrow ? 0.3 : 0.16;
    controls.target.y = narrow ? 0.75 : 0.55;
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /**
   * 按星盘大小重新取景。只在「内容会被切掉」或者 resize 时调用，
   * 用户自己缩放过就不再打扰他。
   * @param {number} worldRadius 星盘的世界半径（含盘子本身的尺寸）
   * @param {{force?:boolean}} [opts]
   */
  function ensureFraming(worldRadius, { force = false } = {}) {
    applyProfile();
    if (userZoomed && !force) return;
    const want = preferredDistance(worldRadius);
    const offset = camera.position.clone().sub(controls.target);
    const dist = offset.length();
    if (!force && dist >= want - 0.01 && dist <= want + 0.01) return;
    offset.setLength(want);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  function resetUserZoom() {
    userZoomed = false;
  }

  function resize() {
    const w = canvas.clientWidth || globalThis.innerWidth || 1;
    const h = canvas.clientHeight || globalThis.innerHeight || 1;
    width = w;
    height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyPixelRatio();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    if (bloom) bloom.resolution.set(w, h);
  }

  resize();
  applyProfile();

  /* ---------------- 画质切换 ---------------- */

  function setQuality(next) {
    if (next === quality) return;
    const hadShadows = renderer.shadowMap.enabled;
    quality = next;
    applyPixelRatio();

    const wantShadows = next !== 'low';
    if (wantShadows !== hadShadows) {
      renderer.shadowMap.enabled = wantShadows;
      // 开关阴影需要重编译所有材质
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m) m.needsUpdate = true;
      });
    }
    if (next !== 'low' && !composer) buildComposer();
    key.shadow.mapSize.set(next === 'high' ? 2048 : 1024, next === 'high' ? 2048 : 1024);
    if (key.shadow.map) {
      key.shadow.map.dispose();
      key.shadow.map = null;
    }
    resize();
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function dispose() {
    controls.dispose();
    composer?.dispose?.();
    envTexture.dispose();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    });
    renderer.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    lights,
    key,
    table,
    bloom,
    get quality() {
      return quality;
    },
    get usesComposer() {
      return !!composer;
    },
    resize,
    setQuality,
    ensureFraming,
    resetUserZoom,
    get narrow() {
      return viewportProfile().narrow;
    },
    render,
    dispose,
  };
}
