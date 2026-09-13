/**
 * 可复用零件
 * ---------------------------------------------------------------
 * 盘子、碗、筷子、碟子、香草、西兰花、蘑菇…… 18 道菜里反复出现的东西
 * 都先在这里做一遍，模型文件只负责「摆盘」。
 */

import * as THREE from 'three';
import { M, makeStd } from '../materials.js';
import {
  mesh,
  group,
  lathe,
  bowlProfile,
  plateProfile,
  domeGeometry,
  blobGeometry,
  tubeFromPoints,
  roundedBoxGeometry,
  slabGeometry,
  scatter,
  discPoint,
  mulberry32,
} from '../geometry.js';

/** 浅盘（默认半径 0.5） */
export function plateMesh({
  radius = 0.5,
  height = 0.085,
  thickness = 0.016,
  material = M.ceramic(),
  segments = 56,
  y = 0,
} = {}) {
  const geo = lathe(
    plateProfile({ rTop: radius, rBottom: radius * 0.6, height, thickness }),
    segments,
  );
  return mesh(geo, material, { y });
}

/** 碗（默认口半径 0.46、高 0.32，有壁厚） */
export function bowlMesh({
  rTop = 0.46,
  rBottom = 0.26,
  height = 0.32,
  thickness = 0.026,
  flare = 1.9,
  material = M.ceramic(),
  segments = 56,
  y = 0,
  x = 0,
  z = 0,
} = {}) {
  const geo = lathe(
    bowlProfile({ rTop, rBottom, height, thickness, flare, samples: 14 }),
    segments,
  );
  return mesh(geo, material, { x, y, z });
}

/** 碗里的一片汤面（贴在内壁略下方） */
export function brothSurface({ radius = 0.42, y = 0.26, thickness = 0.04, material = M.brothWhite() } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.96, thickness, 48);
  return mesh(geo, material, { y });
}

/** 一双筷子（默认躺在 XZ 平面上，斜放） */
export function chopsticks({
  length = 0.6,
  thickness = 0.0095,
  material = M.wood(),
  gap = 0.026,
  tilt = 0.22,
} = {}) {
  const parts = [];
  for (const s of [-1, 1]) {
    const stick = mesh(
      new THREE.CylinderGeometry(thickness * 0.7, thickness, length, 10),
      material,
      { rx: Math.PI / 2, z: s * gap, ry: tilt, y: thickness },
    );
    parts.push(stick);
  }
  return group(...parts);
}

/** 小醋碟 / 酱油碟 */
export function sauceDish({
  radius = 0.12,
  material = M.ceramic(),
  fill = M.sauce(),
  fillLevel = 0.018,
} = {}) {
  const dish = bowlMesh({ rTop: radius, rBottom: radius * 0.6, height: radius * 0.42, thickness: 0.01, flare: 2.4, material, segments: 40 });
  const liquid = mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.7, 0.008, 36), fill, { y: fillLevel });
  return group(dish, liquid);
}

/** 一枝香草（迷迭香 / 罗勒） */
export function herbSprig({
  length = 0.24,
  seed = 3,
  material = M.herb(),
  stem = M.mushroom(),
} = {}) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    pts.push([t * length, Math.sin(t * 2.4) * 0.012, (rnd() - 0.5) * 0.01]);
  }
  const g = group(mesh(tubeFromPoints(pts, 0.0045, 24, 6), stem));
  for (let i = 0; i < 10; i += 1) {
    const t = 0.18 + (i / 10) * 0.8;
    const side = i % 2 ? 1 : -1;
    const leaf = mesh(new THREE.ConeGeometry(0.008, 0.05, 5), material, {
      x: t * length,
      y: 0.012,
      z: side * (0.012 + rnd() * 0.01),
      rz: side * (1.1 + rnd() * 0.35),
      rx: (rnd() - 0.5) * 0.6,
    });
    g.add(leaf);
  }
  return g;
}

/** 一片罗勒叶 */
export function basilLeaf({ size = 0.05, material = M.herb(), seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    pts.push([t * size * 2 - size, Math.sin(t * Math.PI) * size * 0.72 * (0.8 + rnd() * 0.4), 0]);
  }
  const geo = slabGeometry(pts, 0.004, 0.0015);
  return mesh(geo, material, { rx: -Math.PI / 2, rz: (rnd() - 0.5) * 0.8 });
}

/** 撒芝麻 / 黑胡椒 / 葱花这类碎屑 */
export function sprinkleBits({
  count = 16,
  radius = 0.3,
  inner = 0,
  y = 0,
  size = 0.01,
  material = M.sesame(),
  seed = 11,
  flat = false,
} = {}) {
  return scatter(
    count,
    (rnd) => {
      const p = discPoint(rnd, radius, inner);
      const s = size * (0.7 + rnd() * 0.7);
      const geo = flat
        ? new THREE.SphereGeometry(s, 6, 4)
        : new THREE.SphereGeometry(s, 6, 5);
      return mesh(geo, material, {
        x: p.x,
        y: y + (rnd() - 0.5) * size,
        z: p.z,
        sy: flat ? 0.42 : 1,
        ry: rnd() * 3,
      });
    },
    seed,
  );
}

/** 樱桃番茄（可切开，露出浅色断面） */
export function cherryTomato({ radius = 0.045, halved = false, material = M.tomato(), flesh = M.icingPink() } = {}) {
  const body = mesh(new THREE.SphereGeometry(radius, 18, 14), material);
  if (!halved) return group(body);
  const face = mesh(new THREE.CircleGeometry(radius * 0.98, 18), flesh, { y: -radius * 0.02, rx: Math.PI / 2, cast: false });
  return group(body, face);
}

/** 西兰花小朵 */
export function broccoliFloret({ size = 0.075, seed = 5, material = M.broccoli(), stemMat = M.cabbage() } = {}) {
  const rnd = mulberry32(seed);
  const head = mesh(blobGeometry(size, 2, 0.22, 4.4), material, { y: size * 0.95, rx: rnd() * 3 });
  const stalk = mesh(new THREE.CylinderGeometry(size * 0.26, size * 0.4, size * 1.1, 10), stemMat, {
    y: size * 0.42,
  });
  return group(head, stalk);
}

/** 口蘑（伞 + 柄） */
export function mushroomPiece({ radius = 0.055, material = M.mushroom(), gill = M.sesame() } = {}) {
  const cap = mesh(domeGeometry(radius, radius * 0.72, 10), material);
  const stem = mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.36, radius * 0.7, 10), gill, {
    y: -radius * 0.3,
  });
  return group(cap, stem);
}

/** 溏心蛋（半个，断面朝上） */
export function softEgg({ radius = 0.075, material = M.eggWhite(), yolkMat = M.eggYolk() } = {}) {
  const white = mesh(
    new THREE.SphereGeometry(radius, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    material,
    { sy: 0.92 },
  );
  const yolk = mesh(new THREE.CircleGeometry(radius * 0.6, 20), yolkMat, {
    y: 0.004,
    rx: -Math.PI / 2,
    cast: false,
  });
  return group(white, yolk);
}

/** 一片薄片（叉烧 / 柠檬 / 姜片 / 火腿）用扁圆柱表示 */
export function slice({ radius = 0.1, thickness = 0.014, material = M.charsiu(), squash = 1 } = {}) {
  return mesh(new THREE.CylinderGeometry(radius, radius * 0.98, thickness, 24), material, {
    sz: squash,
    ry: 0.3,
  });
}

/** 一块圆角方块（豆腐、土豆、芝士块） */
export function cube({ size = 0.07, material = M.tofu(), round = 0.012 } = {}) {
  return mesh(roundedBoxGeometry(size, size, size, round), material);
}

/** 木砧板 / 石板 */
export function board({
  w = 0.8,
  d = 0.56,
  h = 0.045,
  material = M.wood(),
  radius = 0.05,
} = {}) {
  return mesh(roundedBoxGeometry(w, h, d, radius), material, { y: h / 2 });
}

/** 陶土 / 砂锅材质（局部使用） */
export const clayPot = () =>
  makeStd('clayPot', { color: 0x7a4630, roughness: 0.72, metalness: 0.05 });
export const copper = () =>
  makeStd('copper', { color: 0xc07d3c, roughness: 0.3, metalness: 1, envMapIntensity: 1.3 });
export const darkLacquer = () =>
  makeStd('darkLacquer', { color: 0x2a1a14, roughness: 0.25, metalness: 0.1 });
