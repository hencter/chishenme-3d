/**
 * 材质库
 * ---------------------------------------------------------------
 * 所有模型共用一套「厨房材料」，既保证整体色调统一，
 * 也把材质对象数量压到最低（利于合批与显存）。
 */

import * as THREE from 'three';
import {
  mottleTexture,
  slateTexture,
  bambooTexture,
  stripeTexture,
} from './textures.js';

const cache = new Map();

function define(name, factory) {
  return () => {
    let m = cache.get(name);
    if (!m) {
      m = factory();
      m.name = name;
      cache.set(name, m);
    }
    return m;
  };
}

/** 通用工业标准材质（带缓存） */
export function makeStd(key, params) {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(params);
    m.name = key;
    cache.set(key, m);
  }
  return m;
}

/** 通用物理材质（清漆、透射等高级效果） */
export function makePhys(key, params) {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial(params);
    m.name = key;
    cache.set(key, m);
  }
  return m;
}

/* 三个共享的斑驳贴图，给「有颗粒感」的表面用 */
const mottle = () => mottleTexture(7, 0.58, 0.42);
const mottleFine = () => mottleTexture(19, 0.5, 0.3);

/**
 * 厨房材料表。全部是函数（懒创建 + 缓存），用法：`M.bread()`。
 */
export const M = {
  /* ---------------- 餐具 ---------------- */
  ceramic: define('ceramic', () =>
    makePhys('ceramic', {
      color: 0xf7f2e8,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    }),
  ),
  ceramicCream: define('ceramicCream', () =>
    makePhys('ceramicCream', {
      color: 0xf3e7d2,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1,
      side: THREE.DoubleSide,
    }),
  ),
  ceramicRed: define('ceramicRed', () =>
    makePhys('ceramicRed', {
      color: 0xb8231c,
      roughness: 0.26,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }),
  ),
  ceramicDark: define('ceramicDark', () =>
    makePhys('ceramicDark', {
      color: 0x23262b,
      roughness: 0.24,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    }),
  ),
  slate: define('slate', () =>
    makeStd('slate', {
      color: 0x35383d,
      roughness: 0.72,
      metalness: 0.08,
      map: slateTexture(),
      roughnessMap: mottle(),
    }),
  ),
  bamboo: define('bamboo', () =>
    makeStd('bamboo', {
      color: 0xd3ab6d,
      roughness: 0.68,
      metalness: 0,
      map: bambooTexture(),
      side: THREE.DoubleSide,
    }),
  ),
  wood: define('wood', () =>
    makeStd('wood', {
      color: 0xb08650,
      roughness: 0.58,
      metalness: 0.02,
    }),
  ),
  metal: define('metal', () =>
    makeStd('metal', {
      color: 0xd6dbe2,
      roughness: 0.22,
      metalness: 1,
      envMapIntensity: 1.3,
    }),
  ),
  gold: define('gold', () =>
    makeStd('gold', {
      color: 0xffcf81,
      roughness: 0.2,
      metalness: 1,
      emissive: 0x3a2200,
      emissiveIntensity: 0.5,
    }),
  ),
  glass: define('glass', () =>
    makePhys('glass', {
      color: 0xfdf6ea,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.4,
    }),
  ),
  striped: define('striped', () =>
    makeStd('striped', {
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.04,
      map: stripeTexture(0xd8342a, 0xf6efe0, 12),
      side: THREE.DoubleSide,
    }),
  ),
  charcoal: define('charcoal', () =>
    makeStd('charcoal', {
      color: 0x2b2723,
      roughness: 0.92,
      metalness: 0.1,
      roughnessMap: mottle(),
    }),
  ),

  /* ---------------- 面点 / 面包 ---------------- */
  breadCrust: define('breadCrust', () =>
    makeStd('breadCrust', {
      color: 0xcf9445,
      roughness: 0.74,
      roughnessMap: mottle(),
      bumpMap: mottle(),
      bumpScale: 0.006,
    }),
  ),
  breadSoft: define('breadSoft', () =>
    makeStd('breadSoft', {
      color: 0xf0d9a6,
      roughness: 0.86,
    }),
  ),
  dough: define('dough', () =>
    makeStd('dough', {
      color: 0xf6ecd8,
      roughness: 0.7,
      metalness: 0,
      bumpMap: mottleFine(),
      bumpScale: 0.004,
    }),
  ),
  sesame: define('sesame', () =>
    makeStd('sesame', { color: 0xf8e8c4, roughness: 0.5 }),
  ),
  tortilla: define('tortilla', () =>
    makeStd('tortilla', { color: 0xe8c98a, roughness: 0.82 }),
  ),

  /* ---------------- 肉 ---------------- */
  patty: define('patty', () =>
    makeStd('patty', {
      color: 0x6a3a20,
      roughness: 0.78,
      roughnessMap: mottle(),
      bumpMap: mottle(),
      bumpScale: 0.008,
    }),
  ),
  steakRaw: define('steakRaw', () => makeStd('steakRaw', { color: 0xa8412c, roughness: 0.52 })),
  steakSeared: define('steakSeared', () =>
    makeStd('steakSeared', {
      color: 0x5a2a18,
      roughness: 0.66,
      roughnessMap: mottle(),
      bumpMap: mottle(),
      bumpScale: 0.006,
    }),
  ),
  bacon: define('bacon', () =>
    makeStd('bacon', { color: 0xc9704a, roughness: 0.5, roughnessMap: mottleFine() }),
  ),
  charsiu: define('charsiu', () =>
    makeStd('charsiu', { color: 0xc45432, roughness: 0.46, emissive: 0x1c0600 }),
  ),
  chicken: define('chicken', () =>
    makeStd('chicken', {
      color: 0xd08b34,
      roughness: 0.82,
      flatShading: true,
      roughnessMap: mottle(),
      bumpMap: mottle(),
      bumpScale: 0.012,
    }),
  ),
  chickenPale: define('chickenPale', () =>
    makeStd('chickenPale', { color: 0xe9c489, roughness: 0.78 }),
  ),

  /* ---------------- 蔬菜 / 配菜 ---------------- */
  lettuce: define('lettuce', () =>
    makeStd('lettuce', {
      color: 0x7cbe3f,
      roughness: 0.66,
      side: THREE.DoubleSide,
    }),
  ),
  cabbage: define('cabbage', () =>
    makeStd('cabbage', { color: 0xb6d98a, roughness: 0.7, side: THREE.DoubleSide }),
  ),
  scallion: define('scallion', () => makeStd('scallion', { color: 0x6dbf46, roughness: 0.6 })),
  tomato: define('tomato', () =>
    makePhys('tomato', {
      color: 0xdc3a24,
      roughness: 0.36,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
    }),
  ),
  corn: define('corn', () => makeStd('corn', { color: 0xffd24a, roughness: 0.55 })),
  pepperRed: define('pepperRed', () => makeStd('pepperRed', { color: 0xe03b2a, roughness: 0.42 })),
  pepperYellow: define('pepperYellow', () =>
    makeStd('pepperYellow', { color: 0xf5b731, roughness: 0.42 }),
  ),
  broccoli: define('broccoli', () =>
    makeStd('broccoli', { color: 0x4e9c3f, roughness: 0.86, flatShading: true }),
  ),
  mushroom: define('mushroom', () => makeStd('mushroom', { color: 0xc3a27c, roughness: 0.72 })),
  avocado: define('avocado', () => makeStd('avocado', { color: 0x8ecf5a, roughness: 0.62 })),
  lemon: define('lemon', () => makeStd('lemon', { color: 0xf3e250, roughness: 0.45 })),
  herb: define('herb', () => makeStd('herb', { color: 0x4f8c3a, roughness: 0.7, side: THREE.DoubleSide })),

  /* ---------------- 主食 ---------------- */
  rice: define('rice', () =>
    makeStd('rice', { color: 0xf8f4ec, roughness: 0.62, bumpMap: mottleFine(), bumpScale: 0.003 }),
  ),
  noodle: define('noodle', () => makeStd('noodle', { color: 0xf0dfa4, roughness: 0.48 })),
  curry: define('curry', () =>
    makeStd('curry', { color: 0xb06f2a, roughness: 0.42, emissive: 0x160800 }),
  ),
  nori: define('nori', () =>
    makeStd('nori', { color: 0x1f2a24, roughness: 0.6, side: THREE.DoubleSide }),
  ),
  salmon: define('salmon', () =>
    makeStd('salmon', { color: 0xf98b5c, roughness: 0.34 }),
  ),
  tuna: define('tuna', () => makeStd('tuna', { color: 0xc83f4a, roughness: 0.36 })),

  /* ---------------- 汤底 / 酱汁 ---------------- */
  brothRed: define('brothRed', () =>
    makeStd('brothRed', {
      color: 0xbe3d1a,
      roughness: 0.22,
      metalness: 0,
      emissive: 0x2a0800,
      emissiveIntensity: 0.6,
    }),
  ),
  brothWhite: define('brothWhite', () =>
    makeStd('brothWhite', { color: 0xe6d6b4, roughness: 0.24, emissive: 0x1a1206 }),
  ),
  oil: define('oil', () =>
    makeStd('oil', { color: 0xd99a2e, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.9 }),
  ),
  cheese: define('cheese', () =>
    makeStd('cheese', {
      color: 0xffc034,
      roughness: 0.4,
      emissive: 0x2a1400,
      emissiveIntensity: 0.5,
    }),
  ),
  pizzaCheese: define('pizzaCheese', () =>
    makeStd('pizzaCheese', {
      color: 0xf6d98d,
      roughness: 0.5,
      roughnessMap: mottle(),
      emissive: 0x1e1000,
    }),
  ),
  sauce: define('sauce', () => makeStd('sauce', { color: 0x9c2a12, roughness: 0.3 })),
  eggWhite: define('eggWhite', () =>
    makePhys('eggWhite', { color: 0xfdf9f0, roughness: 0.3, clearcoat: 0.6 }),
  ),
  eggYolk: define('eggYolk', () =>
    makeStd('eggYolk', { color: 0xffb02e, roughness: 0.34, emissive: 0x2a1200 }),
  ),

  /* ---------------- 甜品 ---------------- */
  cream: define('cream', () => makeStd('cream', { color: 0xfff7ee, roughness: 0.52 })),
  sponge: define('sponge', () =>
    makeStd('sponge', {
      color: 0xf2d59a,
      roughness: 0.8,
      roughnessMap: mottle(),
      bumpMap: mottleFine(),
      bumpScale: 0.004,
    }),
  ),
  strawberry: define('strawberry', () =>
    makePhys('strawberry', {
      color: 0xe8415f,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    }),
  ),
  icingPink: define('icingPink', () => makeStd('icingPink', { color: 0xffb0c8, roughness: 0.44 })),
  milkTea: define('milkTea', () =>
    makeStd('milkTea', { color: 0xd9a877, roughness: 0.42, transparent: true, opacity: 0.96 }),
  ),
  pearl: define('pearl', () => makeStd('pearl', { color: 0x2a1c14, roughness: 0.28 })),
  icePink: define('icePink', () =>
    makeStd('icePink', { color: 0xffb6cc, roughness: 0.5, flatShading: true, emissive: 0x260c14 }),
  ),
  iceMint: define('iceMint', () =>
    makeStd('iceMint', { color: 0xa9e7d2, roughness: 0.5, flatShading: true, emissive: 0x08201a }),
  ),
  iceCream: define('iceCream', () =>
    makeStd('iceCream', { color: 0xfff3df, roughness: 0.52, emissive: 0x1a1108 }),
  ),
  cone: define('cone', () =>
    makeStd('cone', {
      color: 0xd7a86a,
      roughness: 0.78,
      side: THREE.DoubleSide,
      bumpMap: mottleFine(),
      bumpScale: 0.004,
    }),
  ),
  fries: define('fries', () => makeStd('fries', { color: 0xffcf5c, roughness: 0.6 })),
  friesDark: define('friesDark', () => makeStd('friesDark', { color: 0xe0a63a, roughness: 0.66 })),
  chili: define('chili', () => makeStd('chili', { color: 0xd4241c, roughness: 0.4 })),
  sichuan: define('sichuan', () => makeStd('sichuan', { color: 0x5a2a16, roughness: 0.7 })),
  garlic: define('garlic', () => makeStd('garlic', { color: 0xf2e6cf, roughness: 0.6 })),
  tofu: define('tofu', () =>
    makePhys('tofu', { color: 0xf6efdd, roughness: 0.42, clearcoat: 0.35 }),
  ),
  quinoas: define('quinoas', () => makeStd('quinoas', { color: 0xd9c08a, roughness: 0.66 })),
  pumpkin: define('pumpkin', () => makeStd('pumpkin', { color: 0xef9a2e, roughness: 0.5 })),
  iceShard: define('iceShard', () =>
    makePhys('iceShard', {
      color: 0xdff3f5,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      clearcoat: 1,
    }),
  ),
};

/** 发光条 / 灯带用的自发光材质（不吃光照，专门用来吃 Bloom） */
export function accentGlow(color, intensity = 1.6) {
  return makeStd(`glow:${color}:${intensity}`, {
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
  });
}

/** 纯色不受光材质（用于地面光斑、光柱） */
export function flatColor(color, opacity = 1) {
  return makeStd(`flat:${color}:${opacity}`, {
    color,
    transparent: opacity < 1,
    opacity,
  });
}

/** 清空缓存 —— 仅用于热更新 / 测试 */
export function disposeMaterials() {
  for (const m of cache.values()) m.dispose?.();
  cache.clear();
}
