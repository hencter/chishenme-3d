/**
 * 甜品 · 3D 模型
 *   milktea   珍珠奶茶
 *   icecream  草莓冰淇淋圣代
 *   cake      草莓奶油蛋糕（一角）
 */

import * as THREE from 'three';
import { M, makeStd } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  slabGeometry,
  domeGeometry,
  lathe,
  bowlProfile,
  discPoint,
  tubeFromPoints,
  mulberry32,
} from '../geometry.js';
import { plateMesh, cherryTomato } from './parts.js';

const strawMat = () =>
  makeStd('straw', { color: 0xff85ac, roughness: 0.28, metalness: 0.05 });
const drizzleMat = () =>
  makeStd('drizzle', { color: 0xd8234f, roughness: 0.24, emissive: 0x28000a });

/* ------------------------------------------------------------------ */
/* 珍珠奶茶                                                             */
/* ------------------------------------------------------------------ */

export function milktea() {
  const plate = plateMesh({ radius: 0.3, height: 0.06 });
  const baseY = 0.014;

  // 杯身：上宽下窄，半透明
  const cup = mesh(
    new THREE.CylinderGeometry(0.24, 0.175, 0.44, 44, 1, true),
    M.glass(),
    { y: baseY + 0.22 },
  );
  const cupFloor = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.02, 40), M.glass(), {
    y: baseY + 0.01,
  });

  // 奶茶本体
  const tea = mesh(new THREE.CylinderGeometry(0.232, 0.17, 0.3, 40), M.milkTea(), {
    y: baseY + 0.155,
  });

  // 封口盖
  const lid = mesh(domeGeometry(0.246, 0.05, 8, 1.6), M.glass(), { y: baseY + 0.44 });
  const lidRim = mesh(new THREE.TorusGeometry(0.244, 0.012, 8, 44), M.glass(), {
    y: baseY + 0.44,
    rx: Math.PI / 2,
  });

  // 珍珠：沉在杯底
  const pearls = scatter(
    14,
    (r) => {
      const p = discPoint(r, 0.12);
      return mesh(new THREE.SphereGeometry(0.022 + r() * 0.006, 12, 10), M.pearl(), {
        x: p.x,
        y: baseY + 0.032 + r() * 0.05,
        z: p.z,
      });
    },
    67,
  );

  // 吸管
  const straw = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.52, 18), strawMat(), {
    x: 0.05,
    y: baseY + 0.6,
    z: 0.03,
    rz: -0.15,
    rx: 0.06,
  });

  return group(plate, cupFloor, cup, tea, lid, lidRim, pearls, straw);
}

/* ------------------------------------------------------------------ */
/* 冰淇淋圣代                                                           */
/* ------------------------------------------------------------------ */

/** 高脚杯：底座 + 杯梗 + 杯身 */
function sundaeGlass() {
  const foot = mesh(
    lathe(
      [
        [0, 0],
        [0.14, 0.002],
        [0.152, 0.014],
        [0.075, 0.024],
        [0.042, 0.032],
        [0.036, 0.05],
        [0, 0.05],
      ],
      44,
    ),
    M.glass(),
  );
  const stem = mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.12, 24), M.glass(), { y: 0.108 });
  const bowl = mesh(
    lathe(
      bowlProfile({ rTop: 0.235, rBottom: 0.085, height: 0.24, thickness: 0.012, flare: 1.35, samples: 14 }),
      48,
    ),
    M.glass(),
    { y: 0.15 },
  );
  return group(foot, stem, bowl);
}

export function icecream() {
  const plate = plateMesh({ radius: 0.36, height: 0.065 });
  const baseY = 0.015;

  const glass = sundaeGlass();
  glass.position.y = baseY;

  // 三球冰淇淋
  const scoops = [
    { mat: M.icePink(), r: 0.115, y: 0.42, sx: 1, seed: 3 },
    { mat: M.iceCream(), r: 0.1, y: 0.51, sx: 1.08, seed: 8 },
    { mat: M.iceMint(), r: 0.078, y: 0.585, sx: 1, seed: 14 },
  ].map((s) => {
    const rnd = mulberry32(s.seed);
    return mesh(blobGeometry(s.r, 2, 0.13, 4.5), s.mat, {
      x: (rnd() - 0.5) * 0.03,
      y: baseY + s.y,
      z: (rnd() - 0.5) * 0.03,
      sx: s.sx,
      sy: 0.94,
      ry: rnd() * 3,
    });
  });

  // 草莓酱：顶上淋一勺 + 顺着球往下淌
  const drizzle = group(
    mesh(blobGeometry(0.1, 2, 0.2, 4), drizzleMat(), { y: baseY + 0.56, sy: 0.34, sx: 1.15 }),
    mesh(blobGeometry(0.06, 2, 0.22, 5), drizzleMat(), { x: 0.08, y: baseY + 0.5, sy: 0.3, sz: 1.4 }),
    mesh(blobGeometry(0.05, 2, 0.22, 6), drizzleMat(), { x: -0.1, y: baseY + 0.44, sy: 0.3, sz: 1.6 }),
    mesh(blobGeometry(0.038, 2, 0.2, 7), drizzleMat(), {
      x: 0.15,
      y: baseY + 0.37,
      sy: 0.28,
      sz: 2.2,
    }),
  );

  // 红樱桃
  const cherry = mesh(new THREE.SphereGeometry(0.036, 18, 14), M.strawberry(), {
    y: baseY + 0.645,
  });
  const stem = mesh(
    tubeFromPoints(
      [
        [0, baseY + 0.665, 0],
        [0.008, baseY + 0.71, 0.004],
        [0.028, baseY + 0.735, 0.012],
      ],
      0.005,
      16,
      6,
    ),
    M.herb(),
  );

  // 威化饼干插在杯边
  const wafer = mesh(
    slabGeometry(
      [
        [-0.075, -0.012],
        [0.075, -0.012],
        [0.075, 0.012],
        [-0.075, 0.012],
      ],
      0.006,
      0.002,
    ),
    M.tortilla(),
    { x: 0.2, y: baseY + 0.5, z: 0.06, rz: -0.5, ry: -0.35 },
  );

  // 彩针
  const sprinkles = scatter(
    18,
    (r) => {
      const a = r() * Math.PI * 2;
      const d = 0.05 + r() * 0.12;
      return mesh(new THREE.BoxGeometry(0.018, 0.006, 0.006), r() > 0.5 ? M.chili() : M.corn(), {
        x: Math.cos(a) * d,
        y: baseY + 0.5 + r() * 0.13,
        z: Math.sin(a) * d,
        ry: a,
        rz: r() * 3,
      });
    },
    73,
  );

  return group(plate, glass, ...scoops, drizzle, cherry, stem, wafer, sprinkles);
}

/* ------------------------------------------------------------------ */
/* 草莓奶油蛋糕                                                         */
/* ------------------------------------------------------------------ */

/** 扇形（蛋糕切角）的 2D 轮廓 */
function sectorShape(radius, span, segments = 28) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let i = 0; i <= segments; i += 1) {
    const a = -span / 2 + (i / segments) * span;
    s.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  s.lineTo(0, 0);
  return s;
}

/** 一层蛋糕：扇形挤压成型后放平 */
function layer(radius, span, height, y, material, bevel = 0.004) {
  const geo = new THREE.ExtrudeGeometry(sectorShape(radius, span), {
    depth: Math.max(0.004, height - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  return mesh(geo, material, { y, rx: -Math.PI / 2 });
}

export function cake() {
  const plate = plateMesh({ radius: 0.42, height: 0.075 });
  const baseY = 0.016;
  const R = 0.34;
  const span = 1.05;

  // 五层：海绵 / 奶油 / 海绵 / 奶油 / 海绵
  const stack = group(
    layer(R, span, 0.12, baseY, M.sponge()),
    layer(R, span, 0.036, baseY + 0.12, M.cream()),
    layer(R, span, 0.12, baseY + 0.156, M.sponge()),
    layer(R, span, 0.036, baseY + 0.276, M.cream()),
    layer(R, span, 0.1, baseY + 0.312, M.sponge()),
  );

  // 顶面抹奶油
  const topFrost = layer(R + 0.006, span, 0.026, baseY + 0.412, M.icingPink(), 0.006);

  // 圆弧面抹奶油（切面保留，露出层次）
  const arcWall = mesh(
    new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.44, 30, 1, true, Math.PI / 2 - span / 2, span),
    M.icingPink(),
    { y: baseY + 0.22 },
  );

  // 顶上的草莓与奶油花
  const berries = group();
  [
    [0.15, -0.06, 1],
    [0.24, 0.06, 0.86],
  ].forEach(([x, z, s]) => {
    const b = cherryTomato({ radius: 0.05 * s, material: M.strawberry() });
    b.position.set(x, baseY + 0.44 + 0.05 * s, z);
    berries.add(b);
    const calyx = mesh(new THREE.ConeGeometry(0.022 * s, 0.03, 5), M.herb(), {
      x,
      y: baseY + 0.44 + 0.09 * s,
      z,
      rx: Math.PI,
    });
    berries.add(calyx);
  });

  const dollop = mesh(blobGeometry(0.055, 2, 0.18, 5), M.cream(), {
    x: 0.06,
    y: baseY + 0.45,
    z: 0.1,
    sy: 0.8,
  });

  // 盘边一点糖粉
  const sugar = scatter(
    22,
    (r) => {
      const p = discPoint(r, 0.26, 0.12);
      return mesh(new THREE.SphereGeometry(0.0045, 5, 4), M.cream(), {
        x: p.x,
        y: baseY + 0.004,
        z: p.z,
        sy: 0.5,
      });
    },
    79,
  );

  return group(plate, stack, topFrost, arcWall, berries, dollop, sugar);
}
