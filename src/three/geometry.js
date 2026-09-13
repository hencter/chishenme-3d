/**
 * 几何工具
 * ---------------------------------------------------------------
 * 所有菜品模型都由这些原语拼出来。核心约定：
 *
 *   1. 模型工厂返回一个 THREE.Group；
 *   2. 内部可以随便用任何尺度、任何原点；
 *   3. `normalizeModel()` 负责把它缩放到统一尺寸、底面贴 y=0、XZ 居中。
 *
 * 这样 18 个模型之间就不会互相打架。
 */

import * as THREE from 'three';
import { mulberry32 } from './canvas.js';

export { mulberry32 };

/* ------------------------------------------------------------------ */
/* 基础构造                                                             */
/* ------------------------------------------------------------------ */

/**
 * 创建一个零件（Mesh），用一个对象把变换一次性写清楚，减少模型代码的噪音。
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} mat
 * @param {{x?:number,y?:number,z?:number,rx?:number,ry?:number,rz?:number,sx?:number,sy?:number,sz?:number,cast?:boolean,recv?:boolean,name?:string}} [t]
 */
export function mesh(geo, mat, t = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(t.x || 0, t.y || 0, t.z || 0);
  m.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
  m.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  m.castShadow = t.cast !== false;
  m.receiveShadow = t.recv === true;
  if (t.name) m.name = t.name;
  return m;
}

/** 把若干零件收进一个 Group */
export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

/**
 * 确定性散布：把 fn 调用 count 次，返回一个 Group。
 * @param {number} count
 * @param {(rnd:()=>number, i:number)=>THREE.Object3D|null} fn
 */
export function scatter(count, fn, seed = 1) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i += 1) {
    const child = fn(rnd, i);
    if (child) g.add(child);
  }
  return g;
}

/** 在圆盘内均匀取点（sqrt 保证面积均匀，而不是向圆心聚集） */
export function discPoint(rnd, radius, inner = 0) {
  const a = rnd() * Math.PI * 2;
  const r = Math.sqrt(inner * inner + rnd() * (radius * radius - inner * inner));
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, r, a };
}

/* ------------------------------------------------------------------ */
/* 位移 / 噪声                                                          */
/* ------------------------------------------------------------------ */

/** 便宜的空间噪声：同位置同结果，所以不会在非索引几何上撕开缝 */
export function noise3(x, y, z) {
  return (
    Math.sin(x * 3.11 + y * 1.73 + 0.7) *
    Math.cos(y * 2.37 - z * 1.91 + 1.3) *
    Math.sin(z * 2.71 + x * 1.33 - 0.4)
  );
}

/**
 * 把球体揉成一个不规则的团 —— 炸鸡、冰淇淋球、肉丸都靠它。
 * 用空间噪声而不是随机数，保证重复顶点位移一致（几何不会裂开）。
 */
export function blobGeometry(radius = 0.5, detail = 3, amount = 0.16, freq = 3.2) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * freq, v.y * freq, v.z * freq);
    const n2 = noise3(v.x * freq * 2.4 + 5, v.y * freq * 2.4, v.z * freq * 2.4) * 0.45;
    const s = 1 + amount * (n + n2);
    pos.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * 把一个已存在的几何体按噪声位移（用于把标准几何稍微揉皱）。
 * 注意：位移量是「相对比例 × 噪声」，不要除以顶点自身长度 ——
 * 否则靠近原点的顶点（比如圆柱端面圆心）会被放大成巨大的尖刺。
 */
export function roughen(geo, amount = 0.02, freq = 6) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * freq, v.y * freq, v.z * freq);
    const s = 1 + amount * n;
    pos.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* 复合几何                                                             */
/* ------------------------------------------------------------------ */

/** 圆角矩形 Shape（用于挤压出圆角盒子） */
export function roundedRectShape(w, h, r) {
  const rr = Math.max(0.0001, Math.min(r, Math.min(w, h) / 2 - 0.0001));
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  s.closePath();
  return s;
}

/** 圆角盒子：形状在 XY 平面，沿 +Z 挤压，最后居中 */
export function roundedBoxGeometry(w, h, d, r = 0.05, curveSegments = 4) {
  const bevel = Math.min(r * 0.8, d * 0.3, w * 0.2, h * 0.2);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: Math.max(0.0001, d - bevel * 2),
    bevelEnabled: bevel > 0.0005,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/** 由 [x,y] 点列生成旋转体 */
export function lathe(points, segments = 48) {
  const pts = points.map((p) => (p.isVector2 ? p : new THREE.Vector2(p[0], p[1])));
  return new THREE.LatheGeometry(pts, segments);
}

/** 半圆顶（汉堡顶胚、包子、冰淇淋球座） */
export function domeGeometry(radius = 0.5, height = 0.4, samples = 14, squash = 1.35) {
  const pts = [[0, 0], [radius, 0]];
  for (let i = 1; i <= samples; i += 1) {
    const a = (i / samples) * (Math.PI / 2);
    pts.push([radius * Math.cos(a) ** squash, height * Math.sin(a) ** (1 / squash)]);
  }
  return lathe(pts, 40);
}

/**
 * 碗（有壁厚的中空壳体）。
 * 剖面顺序：轴心底 → 外壁向上 → 碗沿 → 内壁向下 → 轴心内底，形成闭合壳。
 */
export function bowlProfile({
  rTop = 0.5,
  rBottom = 0.24,
  height = 0.34,
  thickness = 0.035,
  flare = 1.9,
  samples = 12,
} = {}) {
  const outer = [];
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples;
    const r = rBottom + (rTop - rBottom) * Math.sin(u * (Math.PI / 2)) ** (1 / flare);
    outer.push([r, height * u ** 1.12]);
  }
  const pts = [[0, 0]];
  for (const p of outer) pts.push(p);
  // 碗沿：从外沿进到内沿
  const inner = outer
    .map(([r, y], i) => {
      const u = i / samples;
      return [Math.max(0.0006, r - thickness), y + thickness * (1 - u)];
    })
    .reverse();
  for (const p of inner) pts.push(p);
  pts.push([0, thickness]);
  return pts;
}

/** 浅盘：碗的扁平版本 */
export function plateProfile(opts = {}) {
  return bowlProfile({
    rTop: 0.5,
    rBottom: 0.3,
    height: 0.085,
    thickness: 0.016,
    flare: 2.6,
    samples: 8,
    ...opts,
  });
}

/**
 * 褶皱圆环 —— 生菜叶、裙边、荷叶边都用它。
 * 外圈带正弦波，中间镂空。
 */
export function ruffledRingGeometry({
  rInner = 0.3,
  rOuter = 0.62,
  waves = 9,
  amp = 0.08,
  segments = 72,
  tilt = 0,
} = {}) {
  const outer = [];
  const inner = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const wob = Math.sin(a * waves);
    const ro = rOuter * (1 + amp * wob);
    const ri = rInner * (1 + amp * 0.55 * wob);
    const t = tilt * wob;
    outer.push(new THREE.Vector2(Math.cos(a) * ro, Math.sin(a) * ro));
    inner.push(new THREE.Vector2(Math.cos(a) * ri, Math.sin(a) * ri + t));
  }
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner));
  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.computeVertexNormals();
  return geo;
}

/** 沿点列拉一根管子 —— 面条、吸管、茎都用它 */
export function tubeFromPoints(points, radius = 0.02, tubular = 64, radial = 8, closed = false) {
  const vecs = points.map((p) =>
    p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]),
  );
  const curve = new THREE.CatmullRomCurve3(vecs, closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/** 挤出一块不规则的扁片（芝士片、火腿、肉排） */
export function slabGeometry(points2d, depth = 0.03, bevel = 0.006) {
  const shape = new THREE.Shape(
    points2d.map((p) => new THREE.Vector2(p[0], p[1])),
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0.0005,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.center();
  return geo;
}

/* ------------------------------------------------------------------ */
/* 归一化 / 收尾                                                        */
/* ------------------------------------------------------------------ */

/**
 * 把模型缩放 / 平移到统一规格：XZ 居中、底面贴 y=0、最大水平尺寸不超过 maxWidth。
 * @param {THREE.Object3D} root
 * @param {{maxWidth?:number, maxHeight?:number}} [opts]
 */
export function normalizeModel(root, { maxWidth = 0.98, maxHeight = 1.1 } = {}) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const widest = Math.max(size.x, size.z);
  if (!Number.isFinite(widest) || widest <= 1e-6) return root;

  const s = Math.min(maxWidth / widest, maxHeight / Math.max(size.y, 1e-6));
  if (Number.isFinite(s) && s > 0 && Math.abs(s - 1) > 1e-4) {
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
  }

  const box2 = new THREE.Box3().setFromObject(root);
  root.position.x -= (box2.min.x + box2.max.x) / 2;
  root.position.z -= (box2.min.z + box2.max.z) / 2;
  root.position.y -= box2.min.y;
  root.updateMatrixWorld(true);

  const finalSize = box2.getSize(new THREE.Vector3());
  root.userData.size = { x: finalSize.x, y: finalSize.y, z: finalSize.z };
  return root;
}

/** 统一阴影开关。`userData.noShadow` 的零件会被跳过（贴片、发光条这类） */
export function setShadow(root, cast = true, receive = false) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData && o.userData.noShadow) return;
    o.castShadow = cast;
    o.receiveShadow = receive;
  });
  return root;
}
