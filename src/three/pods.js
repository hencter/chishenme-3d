/**
 * 美食星盘
 * ---------------------------------------------------------------
 * 一圈盘子，每个盘子上是一道程序化 3D 菜品，头顶悬浮着名牌。
 * 盘子的模型按 dish.id 缓存，切分类时不会重建几何。
 */

import * as THREE from 'three';
import { buildDishModel, STEAMY } from './models/index.js';
import { labelTexture, glowTexture } from './textures.js';
import { makeStd } from './materials.js';
import { mesh } from './geometry.js';
import { createSteam } from './effects.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * 名牌的基准尺寸。贴图是 660×220，所以这两个数字的比值必须等于 3，
 * 否则菜名会被拉伸变形。
 */
export const LABEL_TEX_ASPECT = 660 / 220;
export const LABEL_W = 0.92;
export const LABEL_H = LABEL_W / LABEL_TEX_ASPECT;

/** 看不见但能被射线命中的代理球 */
const hitProxyMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  transparent: true,
});

/** 创建单个盘子（模型、名牌、光圈、蒸汽） */
function createPod(dish) {
  const root = new THREE.Group();
  root.name = `pod:${dish.id}`;

  const accent = new THREE.Color(dish.accent);

  // 底盘
  const baseMat = makeStd(`podBase:${dish.id}`, {
    color: accent.clone().multiplyScalar(0.14),
    roughness: 0.34,
    metalness: 0.55,
    emissive: accent.clone().multiplyScalar(0.06),
  });
  const base = mesh(new THREE.CylinderGeometry(0.64, 0.67, 0.036, 52), baseMat, {
    y: 0.018,
    recv: true,
  });

  // 发光的边缘（吃 Bloom）
  const ringMat = new THREE.MeshBasicMaterial({
    color: accent.clone(),
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const ring = mesh(new THREE.TorusGeometry(0.655, 0.009, 6, 84), ringMat, {
    y: 0.038,
    rx: Math.PI / 2,
    cast: false,
  });

  // 底盘上的柔和光斑
  const haloMat = new THREE.MeshBasicMaterial({
    map: glowTexture(0.3),
    color: accent.clone(),
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const halo = mesh(new THREE.PlaneGeometry(1.7, 1.7), haloMat, {
    y: 0.04,
    rx: -Math.PI / 2,
    cast: false,
  });

  // 菜品本体
  const model = buildDishModel(dish, {
    maxWidth: 1.04,
    maxHeight: 1.0,
    photo: dish.photoTexture || null,
  });
  model.position.y = 0.036;
  const modelHeight = model.userData.size?.y ?? 0.5;

  // 名牌：普通 / 高亮两张贴图，切换材质即可
  const labelOpts = {
    map: labelTexture(dish),
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  };
  const labelNormal = new THREE.SpriteMaterial({ ...labelOpts });
  const labelHighlight = new THREE.SpriteMaterial({
    ...labelOpts,
    map: labelTexture(dish, { highlight: true }),
  });
  const label = new THREE.Sprite(labelNormal);
  const labelY = 0.06 + modelHeight + 0.3;
  label.position.set(0, labelY, 0);
  // 名牌贴图是 660×220，缩放必须保持 3:1。
  // 千万别在 update 里用 setScalar —— 那会把名牌压成正方形，字全变形。
  label.scale.set(LABEL_W, LABEL_H, 1);
  label.renderOrder = 6;

  // 射线代理
  const proxy = mesh(new THREE.SphereGeometry(0.58, 12, 10), hitProxyMaterial, {
    y: 0.42,
    cast: false,
  });
  proxy.renderOrder = -1;

  // 热菜的蒸汽
  let steam = null;
  if (STEAMY.has(dish.id)) {
    steam = createSteam({ count: 26, spread: 0.26, rise: 0.7 });
    steam.points.position.y = 0.06 + modelHeight * 0.72;
  }

  root.add(base, ring, halo, model, label, proxy);
  if (steam) root.add(steam.points);

  return {
    dish,
    root,
    base,
    ring,
    halo,
    model,
    label,
    labelNormal,
    labelHighlight,
    ringMat,
    haloMat,
    proxy,
    steam,
    modelHeight,
    /** 环上的本地角度 */
    angle: 0,
    /** 归一化位置（0..1） */
    slot: 0,
    visible: true,
    lift: 0,
    liftTarget: 0,
    hover: 0,
    hoverTarget: 0,
    dim: 0,
    dimTarget: 0,
    spin: 0,
    baseY: 0,
  };
}

/**
 * 创建星盘。
 * @param {{dishes: object[], narrow?: boolean}} opts
 */
export function createPodRing({ dishes, narrow = false }) {
  const group = new THREE.Group();
  group.name = 'pod-ring';

  /** @type {Map<string, ReturnType<typeof createPod>>} */
  const cache = new Map();
  let radius = 3;
  let podScale = 1;
  let labelScale = 1;
  let narrowMode = narrow;
  let lastDishes = [];
  let t = 0;

  function getPod(dish) {
    let pod = cache.get(dish.id);
    if (!pod) {
      pod = createPod(dish);
      cache.set(dish.id, pod);
      group.add(pod.root);
    }
    return pod;
  }

  /** 窄屏时把环收紧，让同时能看到的盘子多一点；同时把名牌放大一些便于阅读 */
  function setProfile(isNarrow) {
    narrowMode = !!isNarrow;
    labelScale = narrowMode ? 1.28 : 1;
    if (lastDishes.length) layout(lastDishes);
  }

  /**
   * 重新排布：按当前可见菜品把盘子摆到环上。
   * @param {import('../data/dishes.js').Dish[]} next
   */
  function layout(next) {
    lastDishes = next;
    const count = Math.max(1, next.length);
    const maxRadius = narrowMode ? 2.8 : 3.95;
    radius = clamp(0.85 + count * 0.168, 1.45, maxRadius);
    podScale = count > 13 ? 0.8 : count > 9 ? 0.88 : count > 6 ? 0.95 : 1.02;
    if (narrowMode) podScale *= 0.94;

    const live = new Set(next.map((d) => d.id));
    for (const [id, pod] of cache) {
      const on = live.has(id);
      pod.root.visible = on;
      pod.visible = on;
      if (!on) {
        pod.lift = pod.liftTarget = 0;
        pod.hover = pod.hoverTarget = 0;
      }
    }

    next.forEach((dish, i) => {
      const pod = getPod(dish);
      pod.angle = (i / count) * Math.PI * 2;
      pod.slot = i;
      pod.root.position.set(Math.cos(pod.angle) * radius, 0, Math.sin(pod.angle) * radius);
      // 本地 +Z 指向环外，所以盘子永远「面朝外」
      pod.root.rotation.y = Math.PI / 2 - pod.angle;
      pod.root.scale.setScalar(podScale);
    });
  }

  /**
   * 彻底移除一道菜（用户删掉自己加的菜时调用）。
   * 只释放几何体 —— 材质是全局缓存共享的，不能在这里 dispose。
   */
  function forget(id) {
    const pod = cache.get(id);
    if (!pod) return false;
    group.remove(pod.root);
    pod.root.traverse((o) => {
      if (o.isMesh || o.isPoints) o.geometry?.dispose?.();
    });
    if (pod.model?.userData?.photoMaterial) {
      const mat = pod.model.userData.photoMaterial;
      // 只有真照片贴图是这条模型私有的，占位贴图来自全局缓存
      if (mat.userData?.ownsMap) mat.map?.dispose?.();
      mat.dispose?.();
    }
    cache.delete(id);
    lastDishes = lastDishes.filter((d) => d.id !== id);
    return true;
  }

  /**
   * 预建模型（加载页逐帧调用，避免一次性卡住主线程）。
   * @param {object[]} list
   */
  function preload(list) {
    for (const dish of list) getPod(dish);
  }

  /** 给出环上所有可见盘子的射线代理 */
  function hitTargets() {
    const out = [];
    for (const pod of cache.values()) if (pod.visible) out.push(pod.proxy);
    return out;
  }

  function podAt(index) {
    for (const pod of cache.values()) if (pod.visible && pod.slot === index) return pod;
    return null;
  }

  function findPod(object) {
    for (const pod of cache.values()) if (pod.proxy === object) return pod;
    return null;
  }

  function setSelected(index) {
    for (const pod of cache.values()) {
      const on = pod.visible && pod.slot === index;
      pod.liftTarget = on ? 1 : 0;
      pod.dimTarget = index === null || index < 0 ? 0 : pod.slot === index ? 0 : 1;
      pod.label.material = on ? pod.labelHighlight : pod.labelNormal;
    }
  }

  function setHover(pod) {
    for (const p of cache.values()) p.hoverTarget = p === pod ? 1 : 0;
  }

  function update(dt) {
    t += dt;
    const damp = Math.min(1, dt * 7);
    for (const pod of cache.values()) {
      if (!pod.visible) continue;
      pod.lift += (pod.liftTarget - pod.lift) * damp;
      pod.hover += (pod.hoverTarget - pod.hover) * Math.min(1, dt * 10);
      pod.dim += (pod.dimTarget - pod.dim) * Math.min(1, dt * 5);

      const bobY = Math.sin(t * 0.8 + pod.slot * 1.7) * 0.012;
      pod.root.position.y = pod.lift * 0.5 + bobY;
      const s = podScale * (1 + pod.lift * 0.18 + pod.hover * 0.05);
      pod.root.scale.setScalar(s);

      // 被选中时盘子自己慢慢转，展示菜品
      if (pod.lift > 0.01) {
        pod.spin += dt * 0.42 * pod.lift;
        pod.model.rotation.y = pod.spin;
      } else if (pod.spin !== 0) {
        pod.spin *= 1 - Math.min(1, dt * 3);
        pod.model.rotation.y = pod.spin;
        if (Math.abs(pod.spin) < 1e-3) pod.spin = 0;
      }

      pod.ringMat.opacity = 0.3 + pod.lift * 0.7 + pod.hover * 0.35 - pod.dim * 0.18;
      pod.haloMat.opacity = 0.26 + pod.lift * 0.4 + pod.hover * 0.2 - pod.dim * 0.16;
      const labelBase = 1 - pod.dim * 0.62;
      pod.labelNormal.opacity = labelBase;
      pod.labelHighlight.opacity = labelBase;
      // 按基准尺寸等比放大，保持 3:1 的宽高比（不能 setScalar）
      const labelK = labelScale * (1 + pod.lift * 0.12 + pod.hover * 0.04);
      pod.label.scale.set(LABEL_W * labelK, LABEL_H * labelK, 1);

      if (pod.steam) {
        pod.steam.update(dt);
        pod.steam.points.visible = 1 - pod.dim * 0.8 > 0.35;
      }
    }
  }

  return {
    group,
    layout,
    preload,
    forget,
    setProfile,
    hitTargets,
    podAt,
    findPod,
    setSelected,
    setHover,
    update,
    get radius() {
      return radius;
    },
    get pods() {
      return [...cache.values()].filter((p) => p.visible);
    },
    /** 世界坐标下的环上半径（含缩放） */
    worldRadius() {
      return radius * podScale;
    },
  };
}
