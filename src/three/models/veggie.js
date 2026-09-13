/**
 * 素食 · 3D 模型
 *   salad       牛油果藜麦沙拉
 *   roastedveg  烤时蔬拼盘
 *   tofusoup    菌菇豆腐煲
 */

import * as THREE from 'three';
import { M, makeStd } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  roundedBoxGeometry,
  ruffledRingGeometry,
  discPoint,
  mulberry32,
} from '../geometry.js';
import {
  plateMesh,
  bowlMesh,
  board,
  brothSurface,
  cherryTomato,
  broccoliFloret,
  mushroomPiece,
  herbSprig,
  sprinkleBits,
  clayPot,
} from './parts.js';

const charLine = () => makeStd('charLine', { color: 0x2b1608, roughness: 0.85 });

/* ------------------------------------------------------------------ */
/* 沙拉                                                                */
/* ------------------------------------------------------------------ */

export function salad() {
  const bowl = bowlMesh({
    rTop: 0.46,
    rBottom: 0.24,
    height: 0.3,
    thickness: 0.022,
    flare: 1.7,
    material: M.ceramic(),
  });

  // 生菜床：几层带波浪边的叶片
  const bed = group();
  const layers = [
    { r: 0.4, y: 0.2, mat: M.lettuce(), waves: 13, amp: 0.1, rz: 0 },
    { r: 0.36, y: 0.245, mat: M.cabbage(), waves: 10, amp: 0.12, rz: 0.8 },
    { r: 0.3, y: 0.29, mat: M.lettuce(), waves: 8, amp: 0.14, rz: 1.6 },
    { r: 0.21, y: 0.33, mat: M.cabbage(), waves: 7, amp: 0.16, rz: 2.4 },
  ];
  layers.forEach((l) => {
    bed.add(
      mesh(
        ruffledRingGeometry({
          rInner: l.r * 0.32,
          rOuter: l.r,
          waves: l.waves,
          amp: l.amp,
          segments: 84,
        }),
        l.mat,
        { y: l.y, rx: -Math.PI / 2, rz: l.rz },
      ),
    );
  });

  // 牛油果片：弯月形
  const avocado = scatter(
    5,
    (r, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      const d = 0.13 + r() * 0.08;
      return mesh(new THREE.TorusGeometry(0.072, 0.025, 10, 24, Math.PI * 0.82), M.avocado(), {
        x: Math.cos(a) * d,
        y: 0.36 + r() * 0.02,
        z: Math.sin(a) * d,
        rx: -Math.PI / 2,
        rz: a + 1.2,
        sy: 0.55,
      });
    },
    3,
  );

  // 小番茄
  const tomatoes = scatter(
    4,
    (r, i) => {
      const p = discPoint(r, 0.26, 0.08);
      const t = cherryTomato({ radius: 0.045, halved: i % 2 === 1 });
      t.position.set(p.x, 0.4, p.z);
      t.rotation.z = (r() - 0.5) * 0.6;
      return t;
    },
    17,
  );

  // 烤南瓜块
  const pumpkin = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.24, 0.06);
      return mesh(roundedBoxGeometry(0.055, 0.05, 0.055, 0.012), M.pumpkin(), {
        x: p.x,
        y: 0.38 + r() * 0.02,
        z: p.z,
        ry: r() * 3,
        rz: (r() - 0.5) * 0.4,
      });
    },
    23,
  );

  // 玉米粒 + 藜麦
  const corn = scatter(
    7,
    (r) => {
      const p = discPoint(r, 0.24);
      return mesh(new THREE.SphereGeometry(0.014, 8, 6), M.corn(), {
        x: p.x,
        y: 0.395,
        z: p.z,
        sy: 0.78,
      });
    },
    29,
  );
  const quinoa = scatter(
    34,
    (r) => {
      const p = discPoint(r, 0.28);
      return mesh(new THREE.SphereGeometry(0.0065, 5, 4), M.quinoas(), {
        x: p.x,
        y: 0.35 + r() * 0.07,
        z: p.z,
        sy: 0.7,
      });
    },
    31,
  );

  // 油醋汁的光
  const dressing = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.26);
      return mesh(new THREE.SphereGeometry(0.03, 10, 8), M.oil(), {
        x: p.x,
        y: 0.41,
        z: p.z,
        sy: 0.12,
      });
    },
    37,
  );

  return group(bowl, bed, avocado, tomatoes, pumpkin, corn, quinoa, dressing);
}

/* ------------------------------------------------------------------ */
/* 烤时蔬拼盘                                                           */
/* ------------------------------------------------------------------ */

/** 半颗柠檬 */
function lemonHalf() {
  const peel = mesh(new THREE.SphereGeometry(0.07, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.lemon(), {
    sy: 0.72,
  });
  const flesh = mesh(new THREE.CircleGeometry(0.066, 20), M.corn(), {
    y: 0.004,
    rx: -Math.PI / 2,
    cast: false,
  });
  return group(peel, flesh);
}

/** 一段玉米 */
function cornCob() {
  const cob = mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.26, 18, 6), M.corn(), {
    rz: Math.PI / 2,
  });
  const g = group(cob);
  const rnd = mulberry32(64);
  for (let i = 0; i < 46; i += 1) {
    const t = rnd() * Math.PI * 2;
    const u = (rnd() - 0.5) * 0.24;
    g.add(
      mesh(new THREE.SphereGeometry(0.016, 7, 6), rnd() > 0.5 ? M.corn() : M.pumpkin(), {
        x: u,
        y: Math.sin(t) * 0.05,
        z: Math.cos(t) * 0.05,
        sy: 0.85,
      }),
    );
  }
  return g;
}

export function roastedveg() {
  const slate = board({ w: 0.9, d: 0.72, h: 0.05, material: M.slate(), radius: 0.06 });
  const topY = 0.05;

  // 西兰花两朵
  const broccoli = group();
  [
    [-0.28, -0.16, 0.085],
    [-0.1, -0.24, 0.07],
  ].forEach(([x, z, s]) => {
    const b = broccoliFloret({ size: s, seed: 300 + Math.round(s * 1000) });
    b.position.set(x, topY, z);
    b.rotation.y = x * 4;
    broccoli.add(b);
  });

  // 彩椒条
  const peppers = scatter(
    5,
    (r, i) => {
      const a = -1.2 + i * 0.5;
      const d = 0.16 + (i % 2) * 0.06;
      return mesh(roundedBoxGeometry(0.055, 0.018, 0.22, 0.008), r() > 0.5 ? M.pepperRed() : M.pepperYellow(), {
        x: Math.abs(Math.cos(a)) * d + 0.02,
        y: topY + 0.012,
        z: Math.sin(a) * d,
        ry: -a * 0.7,
        rz: (i % 2 ? 1 : -1) * 0.05,
      });
    },
    7,
  );

  // 口蘑
  const mushrooms = scatter(
    3,
    (r, i) => {
      const m = mushroomPiece({ radius: 0.06 });
      m.position.set(-0.3 + i * 0.05, topY + 0.042, 0.2 + (i % 2) * 0.06);
      m.rotation.set(0.4, r() * 3, 0.2);
      return m;
    },
    11,
  );

  // 玉米段
  const corn = cornCob();
  corn.position.set(0.24, topY + 0.06, -0.2);
  corn.rotation.y = -0.4;

  // 芦笋
  const asparagus = scatter(
    3,
    (r, i) => {
      const g = group(
        mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.24, 10), M.broccoli(), {
          rz: Math.PI / 2,
        }),
        mesh(new THREE.ConeGeometry(0.018, 0.05, 8), M.broccoli(), { x: 0.14, rz: -Math.PI / 2 }),
      );
      g.position.set(0.06, topY + 0.016, 0.06 + i * 0.06);
      g.rotation.y = 0.3 + i * 0.14;
      return g;
    },
    13,
  );

  // 半颗柠檬 + 香草
  const lemon = lemonHalf();
  lemon.position.set(-0.34, topY + 0.05, 0.06);
  lemon.rotation.set(-0.5, 0.8, 0.3);

  const herb = herbSprig({ length: 0.2, seed: 6 });
  herb.position.set(0.16, topY + 0.014, 0.24);
  herb.rotation.set(0, -0.4, 0);

  // 焦痕
  const marks = scatter(
    3,
    (r, i) =>
      mesh(roundedBoxGeometry(0.19, 0.006, 0.014, 0.003), charLine(), {
        x: -0.28 + i * 0.02,
        y: topY + 0.128,
        z: -0.16 + i * 0.05,
        ry: 0.5 + i * 0.3,
      }),
    19,
  );

  // 海盐与黑胡椒
  const salt = sprinkleBits({
    count: 20,
    radius: 0.34,
    y: topY + 0.02,
    size: 0.0055,
    material: M.cream(),
    seed: 41,
    flat: true,
  });
  const pepper = sprinkleBits({
    count: 16,
    radius: 0.32,
    y: topY + 0.026,
    size: 0.0055,
    material: M.charcoal(),
    seed: 43,
    flat: true,
  });

  return group(slate, broccoli, peppers, mushrooms, corn, asparagus, lemon, herb, marks, salt, pepper);
}

/* ------------------------------------------------------------------ */
/* 菌菇豆腐煲                                                           */
/* ------------------------------------------------------------------ */

export function tofusoup() {
  const pot = bowlMesh({
    rTop: 0.44,
    rBottom: 0.28,
    height: 0.3,
    thickness: 0.03,
    flare: 2,
    material: clayPot(),
  });

  // 煲沿 + 两只小耳
  const rimBand = mesh(new THREE.TorusGeometry(0.438, 0.022, 10, 52), clayPot(), {
    y: 0.3,
    rx: Math.PI / 2,
  });
  const ears = [-1, 1].map((s) =>
    mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 22), clayPot(), {
      x: s * (0.44 + 0.028),
      y: 0.23,
      ry: Math.PI / 2,
    }),
  );

  const broth = brothSurface({ radius: 0.41, y: 0.245, thickness: 0.05, material: M.brothWhite() });
  const floatY = 0.278;

  // 嫩豆腐
  const tofus = scatter(
    6,
    (r) => {
      const p = discPoint(r, 0.3);
      return mesh(roundedBoxGeometry(0.075, 0.075, 0.075, 0.014), M.tofu(), {
        x: p.x,
        y: floatY + 0.032,
        z: p.z,
        ry: r() * 1.4,
        rz: (r() - 0.5) * 0.2,
      });
    },
    5,
  );

  // 菌菇
  const shrooms = scatter(
    4,
    (r) => {
      const p = discPoint(r, 0.28);
      const m = mushroomPiece({ radius: 0.055 });
      m.position.set(p.x, floatY + 0.01, p.z);
      m.rotation.y = r() * 3;
      return m;
    },
    9,
  );

  // 金针菇一小丛
  const enoki = group();
  const rndE = mulberry32(21);
  for (let i = 0; i < 16; i += 1) {
    const a = rndE() * Math.PI * 2;
    const d = rndE() * 0.05;
    enoki.add(
      mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.1 + rndE() * 0.04, 6), M.cream(), {
        x: Math.cos(a) * d,
        y: 0.06,
        z: Math.sin(a) * d,
        rz: (rndE() - 0.5) * 0.24,
        rx: (rndE() - 0.5) * 0.24,
      }),
    );
  }
  enoki.position.set(0.16, floatY, -0.14);
  enoki.rotation.y = 0.6;

  // 青菜
  const greens = scatter(
    3,
    (r) => {
      const p = discPoint(r, 0.26);
      return mesh(new THREE.SphereGeometry(0.06, 12, 8), M.cabbage(), {
        x: p.x,
        y: floatY + 0.012,
        z: p.z,
        sy: 0.3,
        ry: r() * 3,
      });
    },
    15,
  );

  // 枸杞与葱花
  const goji = scatter(
    10,
    (r) => {
      const p = discPoint(r, 0.28);
      return mesh(new THREE.SphereGeometry(0.009, 8, 6), M.chili(), {
        x: p.x,
        y: floatY + 0.004,
        z: p.z,
        sy: 0.75,
      });
    },
    27,
  );
  const scallion = sprinkleBits({
    count: 20,
    radius: 0.3,
    y: floatY + 0.008,
    size: 0.008,
    material: M.scallion(),
    seed: 33,
    flat: true,
  });

  return group(pot, rimBand, ...ears, broth, tofus, shrooms, enoki, greens, goji, scallion);
}
