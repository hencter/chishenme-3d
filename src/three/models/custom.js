/**
 * 自定义菜品（拍照加菜）的 3D 表现
 * ---------------------------------------------------------------
 * 用户拍的菜没有手工建模，所以给它一张「立牌」：
 * 盘子上立着一块照片卡，有照片就显示照片，没有就显示占位卡。
 * 底边一条主题色的发光条，会吃到 Bloom。
 */

import * as THREE from 'three';
import { M, makeStd, accentGlow } from '../materials.js';
import {
  mesh,
  group,
  roundedBoxGeometry,
} from '../geometry.js';
import { plateMesh } from './parts.js';
import { dishCardPlaceholderTexture } from '../textures.js';

/** 照片卡的比例（宽:高），和占位贴图一致 */
export const CARD_ASPECT = 4 / 3;
export const CARD_WIDTH = 0.62;
export const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT;

const cardBacking = () =>
  makeStd('cardBacking', { color: 0xf3ead9, roughness: 0.62, metalness: 0.02 });
const cardHolder = () =>
  makeStd('cardHolder', { color: 0x2b211a, roughness: 0.42, metalness: 0.35 });

/**
 * 把 ImageBitmap / HTMLImageElement / canvas 变成贴图。
 * 统一走 canvas 是为了让 flipY 行为跟其它 CanvasTexture 一致
 * （ImageBitmap 直接当贴图时 flipY 在 WebGL 下不可靠）。
 */
export function createPhotoTexture(source, maxEdge = 1024) {
  const sw = source.width || maxEdge;
  const sh = source.height || maxEdge;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1109';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 构建一块照片立牌。
 * @param {{dish: object, texture?: THREE.Texture|null}} opts
 */
export function buildPhotoPlaque({ dish, texture = null }) {
  const accent = dish.accent >>> 0;

  const plate = plateMesh({ radius: 0.5, height: 0.08 });
  const floorY = 0.016;

  // 底座卡槽
  const holder = mesh(roundedBoxGeometry(0.44, 0.055, 0.15, 0.018), cardHolder(), {
    y: floorY + 0.027,
    recv: true,
  });
  const slot = mesh(roundedBoxGeometry(0.3, 0.012, 0.05, 0.004), cardHolder(), {
    y: floorY + 0.058,
    cast: false,
  });

  // 卡自己：略微后仰，靠卡槽托着
  const card = new THREE.Group();
  card.position.set(0, floorY + 0.05, 0);
  card.rotation.x = -0.1;

  const backing = mesh(
    roundedBoxGeometry(CARD_WIDTH + 0.035, CARD_HEIGHT + 0.035, 0.012, 0.012),
    cardBacking(),
    { y: CARD_HEIGHT / 2 },
  );

  // 照片面（正面朝 +Z）
  const hasRealPhoto = !!texture;
  const photoMaterial = new THREE.MeshStandardMaterial({
    map: texture || dishCardPlaceholderTexture(dish),
    roughness: 0.42,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });
  // 占位贴图来自全局缓存（不能释放），真照片是本模型私有的（可以释放）
  photoMaterial.userData.ownsMap = hasRealPhoto;
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT),
    photoMaterial,
  );
  photo.position.set(0, CARD_HEIGHT / 2, 0.0085);
  photo.userData.noShadow = true;

  // 背面也贴一层，免得转到后面看到一张纸
  const back = mesh(
    new THREE.PlaneGeometry(CARD_WIDTH + 0.035, CARD_HEIGHT + 0.035),
    cardBacking(),
    { y: CARD_HEIGHT / 2, z: -0.0075, ry: Math.PI, cast: false },
  );
  back.userData.noShadow = true;

  // 底边主题色发光条
  const accentBar = mesh(
    new THREE.BoxGeometry(CARD_WIDTH + 0.035, 0.012, 0.016),
    accentGlow(accent, 1.7),
    { y: 0.006, z: 0.008, cast: false },
  );
  accentBar.userData.noShadow = true;

  card.add(back, backing, photo, accentBar);

  // 后面一根细撑脚，让「立着」这件事说得通
  const propLeg = mesh(
    roundedBoxGeometry(0.03, CARD_HEIGHT * 0.62, 0.01, 0.006),
    cardHolder(),
    { y: floorY + 0.06, z: -0.075, rx: 0.34 },
  );

  const root = group(plate, holder, slot, propLeg, card);
  // 让 pods.js 能在照片加载完之后把贴图换上去
  root.userData.photoMaterial = photoMaterial;
  root.userData.dishId = dish.id;
  return root;
}

/** 照片异步加载完成后调用：把占位贴图换成真照片 */
export function applyPhotoTexture(root, texture) {
  const mat = root?.userData?.photoMaterial;
  if (!mat || !texture) return false;
  // 占位贴图是全局缓存的，不释放；照片贴图从此由这条模型负责释放
  mat.map = texture;
  mat.userData.ownsMap = true;
  mat.needsUpdate = true;
  return true;
}

/** 立牌正面朝向 +Z —— pods.js 依赖这一点 */
export const PLAQUE_FACES = new THREE.Vector3(0, 0, 1);
