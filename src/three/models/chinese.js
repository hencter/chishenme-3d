/**
 * 中餐 · 3D 模型
 *   hotpot     麻辣牛油火锅（鸳鸯锅）
 *   dumplings  猪肉白菜饺子
 *   bbq        炭火烧烤串
 */

import * as THREE from 'three';
import { M, accentGlow } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  roundedBoxGeometry,
  tubeFromPoints,
  lathe,
  bowlProfile,
  mulberry32,
  discPoint,
} from '../geometry.js';
import { plateMesh, sauceDish, sprinkleBits, mushroomPiece, copper } from './parts.js';

/* ------------------------------------------------------------------ */
/* 火锅                                                                */
/* ------------------------------------------------------------------ */

/** 在锅的某一半（sign>0 → x>0 的那半边）里取一个漂浮点 */
function halfPoint(rnd, radius, sign, y) {
  const r = Math.sqrt(rnd()) * radius;
  const a = (rnd() - 0.5) * Math.PI;
  return { x: sign * Math.cos(a) * r, y, z: Math.sin(a) * r };
}

export function hotpot() {
  const R = 0.5;
  const potMat = copper();

  const body = mesh(
    lathe(
      bowlProfile({ rTop: R, rBottom: R * 0.66, height: 0.3, thickness: 0.026, flare: 2.15, samples: 16 }),
      64,
    ),
    potMat,
    { recv: true },
  );

  const rim = mesh(new THREE.TorusGeometry(R, 0.016, 10, 64), potMat, { y: 0.3, rx: Math.PI / 2 });

  const handles = [-1, 1].map((s) =>
    mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 24), potMat, {
      x: s * (R + 0.028),
      y: 0.215,
      ry: Math.PI / 2,
    }),
  );

  // 鸳鸯挡板：沿 Z 轴把锅一分为二，高度刚好高出汤面
  const divider = mesh(roundedBoxGeometry(0.02, 0.18, 0.84, 0.006), potMat, { y: 0.22 });

  // 两侧汤底。three 的圆柱角从 +Z 起算，θ∈[0,π] 得到 x≥0 的半边
  const redSide = mesh(
    new THREE.CylinderGeometry(0.442, 0.418, 0.05, 32, 1, false, 0, Math.PI),
    M.brothRed(),
    { y: 0.243 },
  );
  const whiteSide = mesh(
    new THREE.CylinderGeometry(0.442, 0.418, 0.05, 32, 1, false, Math.PI, Math.PI),
    M.brothWhite(),
    { y: 0.243 },
  );

  const floatY = 0.278;

  // 红汤：干辣椒、花椒、葱段
  const chilies = scatter(
    9,
    (r) => {
      const p = halfPoint(r, 0.35, 1, floatY + r() * 0.012);
      return mesh(new THREE.CapsuleGeometry(0.012, 0.05, 3, 8), M.chili(), {
        x: p.x,
        y: p.y,
        z: p.z,
        rz: Math.PI / 2 + (r() - 0.5) * 0.9,
        ry: r() * Math.PI,
      });
    },
    41,
  );
  const peppercorns = scatter(
    18,
    (r) => {
      const p = halfPoint(r, 0.4, 1, floatY);
      return mesh(new THREE.SphereGeometry(0.0085, 6, 5), M.sichuan(), {
        x: p.x,
        y: p.y,
        z: p.z,
        sy: 0.7,
      });
    },
    77,
  );
  const onions = scatter(
    7,
    (r) => {
      const p = halfPoint(r, 0.36, 1, floatY + 0.004);
      return mesh(new THREE.CapsuleGeometry(0.009, 0.038, 3, 8), M.scallion(), {
        x: p.x,
        y: p.y,
        z: p.z,
        rz: Math.PI / 2,
        ry: r() * Math.PI,
      });
    },
    91,
  );

  // 白汤：豆腐、蘑菇、丸子、青菜
  const tofus = scatter(
    5,
    (r) => {
      const p = halfPoint(r, 0.33, -1, floatY + 0.028);
      return mesh(roundedBoxGeometry(0.062, 0.062, 0.062, 0.012), M.tofu(), {
        x: p.x,
        y: p.y,
        z: p.z,
        ry: r() * 1.2,
        rz: (r() - 0.5) * 0.25,
      });
    },
    13,
  );
  const shrooms = scatter(
    4,
    (r) => {
      const p = halfPoint(r, 0.32, -1, floatY + 0.006);
      const m = mushroomPiece({ radius: 0.042 });
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = r() * 3;
      return m;
    },
    23,
  );
  const balls = scatter(
    4,
    (r) => {
      const p = halfPoint(r, 0.31, -1, floatY + 0.014);
      return mesh(blobGeometry(0.036, 2, 0.12, 5), M.patty(), { x: p.x, y: p.y, z: p.z });
    },
    33,
  );
  const greens = scatter(
    3,
    (r) => {
      const p = halfPoint(r, 0.29, -1, floatY + 0.012);
      return mesh(new THREE.SphereGeometry(0.05, 10, 8), M.cabbage(), {
        x: p.x,
        y: p.y,
        z: p.z,
        sy: 0.35,
        ry: r() * 3,
      });
    },
    53,
  );

  return group(
    body,
    rim,
    ...handles,
    redSide,
    whiteSide,
    divider,
    chilies,
    peppercorns,
    onions,
    tofus,
    shrooms,
    balls,
    greens,
  );
}

/* ------------------------------------------------------------------ */
/* 饺子                                                                */
/* ------------------------------------------------------------------ */

/** 一只饺子：鼓身 + 背脊 + 褶子 */
function dumpling(seed = 1, scale = 1) {
  const rnd = mulberry32(seed);

  const body = mesh(new THREE.SphereGeometry(0.07, 20, 14), M.dough(), {
    sx: 0.95,
    sy: 0.6,
    sz: 1.5,
  });

  const pts = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    pts.push([(rnd() - 0.5) * 0.004, 0.046 + Math.sin(t * Math.PI) * 0.014, t * 0.18 - 0.09]);
  }
  const ridge = mesh(tubeFromPoints(pts, 0.011, 26, 8), M.dough());

  const pleats = scatter(
    7,
    (r) => {
      const t = (r() - 0.5) * 0.16;
      return mesh(new THREE.SphereGeometry(0.016, 8, 6), M.dough(), {
        x: (r() - 0.5) * 0.012,
        y: 0.05 + Math.cos(t * 16) * 0.007,
        z: t,
        sy: 0.78,
        sz: 0.72,
        rz: (r() - 0.5) * 0.5,
      });
    },
    seed * 7 + 1,
  );

  const g = group(body, ridge, pleats);
  g.scale.setScalar(scale);
  return g;
}

export function dumplings() {
  const plate = plateMesh({ radius: 0.44, height: 0.075 });

  const ring = scatter(
    6,
    (r, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const d = 0.245 + (r() - 0.5) * 0.02;
      const one = dumpling(101 + i, 0.94 + r() * 0.16);
      one.position.set(Math.cos(a) * d, 0.058, Math.sin(a) * d);
      one.rotation.y = -a + Math.PI / 2 + (r() - 0.5) * 0.5;
      return one;
    },
    5,
  );

  // 中间摆一小碟醋
  const vinegar = sauceDish({ radius: 0.095 });
  vinegar.position.y = 0.016;

  const scallion = sprinkleBits({
    count: 14,
    radius: 0.26,
    y: 0.09,
    size: 0.007,
    material: M.scallion(),
    seed: 61,
    flat: true,
  });

  return group(plate, ring, vinegar, scallion);
}

/* ------------------------------------------------------------------ */
/* 烧烤                                                                */
/* ------------------------------------------------------------------ */

/** 一根串：竹签 + 若干烤块 */
function skewer(seed = 1, items = 5) {
  const rnd = mulberry32(seed);
  const g = group(
    mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.7, 8), M.wood(), { rx: Math.PI / 2 }),
  );

  const palette = [
    M.charsiu(),
    M.patty(),
    M.pepperRed(),
    M.corn(),
    M.mushroom(),
    M.chickenPale(),
  ];

  const span = 0.38;
  for (let i = 0; i < items; i += 1) {
    const t = items === 1 ? 0.5 : i / (items - 1);
    const z = (t - 0.5) * span + (rnd() - 0.5) * 0.012;
    g.add(
      mesh(blobGeometry(0.036 + rnd() * 0.009, 2, 0.2, 5.5), palette[(rnd() * palette.length) | 0], {
        y: rnd() * 0.01,
        z,
        sy: 1.12,
        rz: (rnd() - 0.5) * 0.7,
        ry: (rnd() - 0.5) * 0.7,
      }),
    );
  }
  return g;
}

export function bbq() {
  // 四条腿
  const legs = scatter(
    4,
    (r, i) => {
      const sx = i % 2 ? 1 : -1;
      const sz = i < 2 ? 1 : -1;
      return mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 8), M.metal(), {
        x: sx * 0.3,
        z: sz * 0.17,
        y: 0.05,
      });
    },
    1,
  );

  // 炭槽（坐在腿上）
  const box = mesh(roundedBoxGeometry(0.78, 0.1, 0.46, 0.02), M.charcoal(), {
    y: 0.15,
    recv: true,
  });

  // 炭火：露在炭槽顶端，自发光会吃到 Bloom
  const embers = scatter(
    13,
    (r) => {
      const p = discPoint(r, 0.33);
      return mesh(new THREE.SphereGeometry(0.022 + r() * 0.017, 8, 6), accentGlow(0xff5a14, 2.4), {
        x: p.x,
        z: p.z * 0.58,
        y: 0.202,
        sy: 0.5,
        cast: false,
      });
    },
    19,
  );

  // 烤网
  const bars = scatter(
    7,
    (r, i) =>
      mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.74, 8), M.metal(), {
        z: (i / 6 - 0.5) * 0.44,
        y: 0.236,
        rz: Math.PI / 2,
      }),
    3,
  );

  // 四根串
  const sticks = [-0.24, -0.08, 0.08, 0.24].map((x, i) => {
    const s = skewer(301 + i, 4 + (i % 2));
    s.position.set(x, 0.268, 0);
    s.rotation.z = (i % 2 ? 1 : -1) * 0.035;
    return s;
  });

  // 孜然辣椒面
  const spices = scatter(
    26,
    (r) => {
      const p = discPoint(r, 0.33);
      return mesh(new THREE.SphereGeometry(0.0055, 5, 4), M.sichuan(), {
        x: p.x,
        y: 0.3 + r() * 0.03,
        z: p.z * 0.5,
        sy: 0.6,
      });
    },
    71,
  );

  // 旁边一小碟蘸料
  const dip = sauceDish({ radius: 0.09 });
  dip.position.set(0.5, 0, 0.28);

  return group(legs, box, embers, bars, spices, ...sticks, dip);
}
