/**
 * 日料 · 3D 模型
 *   ramen    豚骨拉面
 *   sushi    握寿司拼盘
 *   curry    咖喱猪排饭
 */

import * as THREE from 'three';
import { M } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  roundedBoxGeometry,
  tubeFromPoints,
  domeGeometry,
  mulberry32,
  discPoint,
} from '../geometry.js';
import {
  plateMesh,
  bowlMesh,
  board,
  brothSurface,
  chopsticks,
  softEgg,
  sprinkleBits,
  broccoliFloret,
} from './parts.js';

/* ------------------------------------------------------------------ */
/* 拉面                                                                */
/* ------------------------------------------------------------------ */

export function ramen() {
  const bowl = bowlMesh({
    rTop: 0.46,
    rBottom: 0.26,
    height: 0.32,
    thickness: 0.026,
    material: M.ceramic(),
  });

  // 碗沿一圈红边（拉面碗的经典花纹）
  const rimBand = mesh(new THREE.TorusGeometry(0.452, 0.011, 8, 56), M.ceramicRed(), {
    y: 0.316,
    rx: Math.PI / 2,
  });

  const broth = brothSurface({ radius: 0.432, y: 0.248, thickness: 0.05 });

  // 面条：七股波浪状的面，堆成一团
  const noodles = group();
  for (let s = 0; s < 7; s += 1) {
    const pts = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      pts.push([
        -0.24 + t * 0.48,
        0.276 + Math.sin(t * Math.PI) * 0.032 + Math.sin(t * 7 + s * 1.7) * 0.008,
        -0.15 + s * 0.05 + Math.sin(t * Math.PI * 2 + s) * 0.026,
      ]);
    }
    noodles.add(mesh(tubeFromPoints(pts, 0.011, 44, 8), M.noodle()));
  }

  // 叉烧三片
  const chashu = group(
    ...[
      [0.19, 0.295, -0.13, -0.3, 0.5],
      [0.25, 0.292, 0.03, -0.22, 1.1],
      [0.14, 0.29, 0.16, -0.34, 2.0],
    ].map(([x, y, z, rx, ry]) =>
      mesh(new THREE.CylinderGeometry(0.1, 0.098, 0.016, 26), M.charsiu(), { x, y, z, rx, ry }),
    ),
  );

  // 溏心蛋
  const egg = softEgg({ radius: 0.072 });
  egg.position.set(-0.17, 0.278, 0.12);
  egg.rotation.z = 0.12;

  // 海苔两片，插在碗边
  const nori = group(
    mesh(roundedBoxGeometry(0.1, 0.13, 0.006, 0.004), M.nori(), {
      x: -0.22,
      y: 0.35,
      z: -0.16,
      rx: -0.22,
      rz: 0.18,
    }),
    mesh(roundedBoxGeometry(0.1, 0.13, 0.006, 0.004), M.nori(), {
      x: -0.3,
      y: 0.34,
      z: -0.06,
      rx: -0.3,
      rz: 0.35,
    }),
  );

  // 木耳 / 笋片
  const fungi = scatter(
    4,
    (r) => {
      const p = discPoint(r, 0.28);
      return mesh(new THREE.SphereGeometry(0.028, 10, 8), M.nori(), {
        x: p.x,
        y: 0.288,
        z: p.z,
        sx: 1.4,
        sy: 0.28,
        ry: r() * 3,
      });
    },
    27,
  );

  // 葱花
  const scallion = sprinkleBits({
    count: 22,
    radius: 0.33,
    y: 0.292,
    size: 0.0085,
    material: M.scallion(),
    seed: 55,
    flat: true,
  });

  // 一双筷子搁在碗沿上
  const sticks = chopsticks({ length: 0.98, gap: 0.028 });
  sticks.position.set(0, 0.336, 0);
  sticks.rotation.set(0, 0.55, 0);

  return group(bowl, rimBand, broth, noodles, chashu, egg, nori, fungi, scallion, sticks);
}

/* ------------------------------------------------------------------ */
/* 寿司                                                                */
/* ------------------------------------------------------------------ */

/** 一贯握寿司 */
function nigiri({ material = M.salmon(), banded = false } = {}) {
  const rice = mesh(new THREE.SphereGeometry(0.062, 18, 12), M.rice(), {
    sx: 0.86,
    sy: 0.62,
    sz: 1.42,
  });
  const neta = mesh(roundedBoxGeometry(0.096, 0.014, 0.17, 0.012), material, {
    y: 0.046,
    rx: 0.04,
  });
  const g = group(rice, neta);
  if (banded) {
    g.add(mesh(roundedBoxGeometry(0.104, 0.082, 0.024, 0.004), M.nori(), { y: 0.006 }));
  }
  return g;
}

/** 一枚卷寿司 */
function maki({ material = M.tuna() } = {}) {
  const noriOuter = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.072, 28), M.nori());
  const rice = mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.076, 28), M.rice(), { y: 0.001 });
  const filling = mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.082, 18), material, { y: 0.002 });
  return group(noriOuter, rice, filling);
}

export function sushi() {
  const slate = board({ w: 0.86, d: 0.6, h: 0.05, material: M.slate(), radius: 0.055 });

  // 后排三贯握寿司
  const row = [
    { x: -0.26, mat: M.salmon(), banded: false },
    { x: 0, mat: M.tuna(), banded: true },
    { x: 0.26, mat: M.salmon(), banded: false },
  ];
  const nigiris = group(
    ...row.map((r, i) => {
      const n = nigiri({ material: r.mat, banded: r.banded });
      n.position.set(r.x, 0.096, -0.15);
      n.rotation.y = (i - 1) * 0.12;
      return n;
    }),
  );

  // 前排三枚卷
  const makis = group(
    ...[
      { x: -0.2, mat: M.tuna() },
      { x: 0.02, mat: M.salmon() },
      { x: 0.24, mat: M.avocado() },
    ].map((r, i) => {
      const m = maki({ material: r.mat });
      m.position.set(r.x, 0.086, 0.16);
      m.rotation.y = i * 0.4;
      return m;
    }),
  );

  // 芥末
  const wasabi = mesh(blobGeometry(0.032, 2, 0.24, 6), M.broccoli(), { x: -0.33, y: 0.075, z: 0.17 });
  const wasabiTop = mesh(blobGeometry(0.02, 2, 0.3, 7), M.avocado(), {
    x: -0.33,
    y: 0.095,
    z: 0.17,
  });

  // 姜片
  const ginger = scatter(
    4,
    (r) => {
      const p = discPoint(r, 0.05);
      return mesh(new THREE.SphereGeometry(0.028, 10, 8), M.icingPink(), {
        x: 0.34 + p.x,
        y: 0.072,
        z: 0.16 + p.z,
        sy: 0.22,
        ry: r() * 3,
      });
    },
    9,
  );

  // 紫苏叶
  const shiso = scatter(
    2,
    (r) => {
      const p = discPoint(r, 0.06);
      return mesh(new THREE.SphereGeometry(0.05, 12, 8), M.herb(), {
        x: -0.12 + p.x,
        y: 0.07,
        z: 0.24 + p.z,
        sy: 0.14,
        ry: r() * 3,
      });
    },
    15,
  );

  return group(slate, nigiris, makis, wasabi, wasabiTop, ginger, shiso);
}

/* ------------------------------------------------------------------ */
/* 咖喱猪排饭                                                           */
/* ------------------------------------------------------------------ */

export function curry() {
  const plate = plateMesh({ radius: 0.52, height: 0.085 });
  const floorY = 0.016;

  // 左半边白饭
  const rice = mesh(domeGeometry(0.2, 0.14, 12, 1.5), M.rice(), {
    x: -0.2,
    y: floorY,
  });
  const blackSesame = sprinkleBits({
    count: 12,
    radius: 0.1,
    y: 0.136,
    size: 0.006,
    material: M.pearl(),
    seed: 31,
    flat: true,
  });
  blackSesame.position.x = -0.2;

  // 右半边咖喱：半圆盘 + 一团油光 + 几处起伏
  const curryBase = mesh(
    new THREE.CylinderGeometry(0.272, 0.272, 0.058, 40, 1, false, 0, Math.PI),
    M.curry(),
    { y: floorY + 0.028 },
  );
  const curryFilm = mesh(
    new THREE.CylinderGeometry(0.268, 0.268, 0.006, 40, 1, false, 0, Math.PI),
    M.oil(),
    { y: floorY + 0.058 },
  );
  const curryBlobs = scatter(
    7,
    (r) => {
      const p = discPoint(r, 0.2, 0.02);
      return mesh(blobGeometry(0.044 + r() * 0.02, 2, 0.22, 4), M.curry(), {
        x: Math.abs(p.x) + 0.02,
        y: floorY + 0.05,
        z: p.z,
        sy: 0.4,
      });
    },
    43,
  );

  // 炸猪排：五条切好的排，扇形铺在咖喱上
  const cutlet = group(
    ...[0, 1, 2, 3, 4].map((i) => {
      const a = -0.75 + i * 0.36;
      const d = 0.12 + (i % 2) * 0.02;
      return mesh(roundedBoxGeometry(0.052, 0.03, 0.21, 0.013), M.chicken(), {
        x: Math.abs(Math.cos(a)) * d + 0.03,
        y: floorY + 0.095,
        z: Math.sin(a) * d,
        ry: -a * 0.55,
        rx: 0.06,
        rz: (i % 2 ? 1 : -1) * 0.04,
      });
    }),
  );

  // 配菜：西兰花摆在咖喱前排
  const broccoli = group();
  [
    [0.2, 0.16, 0.055],
    [0.1, -0.17, 0.048],
  ].forEach(([x, z, s]) => {
    const b = broccoliFloret({ size: s, seed: 120 + Math.round(s * 1000) });
    b.position.set(x, floorY + 0.058, z);
    b.rotation.y = x * 3;
    broccoli.add(b);
  });

  const corn = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.07);
      return mesh(new THREE.SphereGeometry(0.013, 8, 6), M.corn(), {
        x: 0.06 + p.x * 0.6,
        y: floorY + 0.008,
        z: 0.23 + p.z * 0.6,
        sy: 0.8,
      });
    },
    21,
  );

  // 福神渍：摆在盘面左前方的空地
  const pickles = scatter(
    4,
    (r) => {
      const p = discPoint(r, 0.05);
      return mesh(roundedBoxGeometry(0.032, 0.008, 0.026, 0.003), M.chili(), {
        x: -0.12 + p.x,
        y: floorY + 0.004,
        z: 0.22 + p.z,
        ry: r() * 3,
      });
    },
    29,
  );

  return group(
    plate,
    rice,
    blackSesame,
    curryBase,
    curryFilm,
    curryBlobs,
    cutlet,
    broccoli,
    corn,
    pickles,
  );
}
