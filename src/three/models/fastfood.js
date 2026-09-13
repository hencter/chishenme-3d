/**
 * 快餐 · 3D 模型
 *   burger        双层芝士汉堡
 *   friedchicken  脆皮炸鸡桶
 *   fries         黄金薯条
 */

import * as THREE from 'three';
import { M, makeStd } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  roundedBoxGeometry,
  roughen,
  lathe,
  domeGeometry,
  ruffledRingGeometry,
  discPoint,
  mulberry32,
} from '../geometry.js';
import { plateMesh } from './parts.js';

const friesBox = () =>
  makeStd('friesBox', { color: 0xcf2b22, roughness: 0.52, metalness: 0.04 });
const paperLiner = () =>
  makeStd('paperLiner', { color: 0xfff7ee, roughness: 0.62, side: THREE.DoubleSide });

/* ------------------------------------------------------------------ */
/* 汉堡                                                                */
/* ------------------------------------------------------------------ */

/** 底胚：平底、边缘微圆的面包 */
function bunBase(radius = 0.3, height = 0.1) {
  return lathe(
    [
      [0, 0],
      [radius * 0.93, 0],
      [radius, height * 0.28],
      [radius, height * 0.72],
      [radius * 0.9, height],
      [0, height],
    ],
    40,
  );
}

export function burger() {
  const plate = plateMesh({ radius: 0.52, height: 0.08 });
  const baseY = 0.018;

  // 肉饼：略微揉皱，边缘不至于像塑料片
  const pattyGeo = () => roughen(new THREE.CylinderGeometry(0.315, 0.31, 0.056, 40, 1), 0.035, 9);
  const patty1 = mesh(pattyGeo(), M.patty(), { y: baseY + 0.128 });
  const patty2 = mesh(pattyGeo(), M.patty(), { y: baseY + 0.196, ry: 0.5 });

  // 芝士片：正方薄片转 45°，四角自然露在肉饼外面
  const cheeseGeo = () => roundedBoxGeometry(0.62, 0.013, 0.62, 0.02);
  const cheese1 = mesh(cheeseGeo(), M.cheese(), { y: baseY + 0.161, ry: 0.62 });
  const cheese2 = mesh(cheeseGeo(), M.cheese(), { y: baseY + 0.229, ry: 0.14 });

  const bottomBun = mesh(bunBase(), M.breadSoft(), { y: baseY });

  // 生菜：褶皱圆环，边缘带波浪
  const lettuce = mesh(
    ruffledRingGeometry({ rInner: 0.26, rOuter: 0.4, waves: 11, amp: 0.075, segments: 96 }),
    M.lettuce(),
    { y: baseY + 0.244, rx: -Math.PI / 2, rz: 0.4 },
  );

  // 番茄片 + 洋葱圈
  const tomato = group(
    mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.015, 24), M.tomato(), {
      x: 0.06,
      y: baseY + 0.258,
    }),
    mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.015, 24), M.tomato(), {
      x: -0.08,
      y: baseY + 0.258,
      ry: 1.2,
    }),
  );
  const onion = group(
    mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 28), M.cream(), {
      x: -0.06,
      y: baseY + 0.274,
      rx: Math.PI / 2,
    }),
    mesh(new THREE.TorusGeometry(0.085, 0.011, 8, 28), M.cream(), {
      x: 0.12,
      y: baseY + 0.274,
      rx: Math.PI / 2,
      ry: 0.8,
    }),
  );

  // 顶胚 + 芝麻
  const topBunY = baseY + 0.282;
  const topBun = mesh(domeGeometry(0.312, 0.2, 16, 1.38), M.breadCrust(), { y: topBunY });

  const sesame = scatter(
    16,
    (r) => {
      const a = 0.2 + r() * 1.15;
      const rr = 0.312 * Math.pow(Math.cos(a), 1.38) * 0.94;
      const yy = 0.2 * Math.pow(Math.sin(a), 1 / 1.38);
      const ang = r() * Math.PI * 2;
      return mesh(new THREE.SphereGeometry(0.013, 8, 6), M.sesame(), {
        x: Math.cos(ang) * rr,
        y: topBunY + yy,
        z: Math.sin(ang) * rr,
        sx: 1.45,
        sy: 0.55,
        ry: ang,
        rz: (r() - 0.5) * 0.5,
      });
    },
    37,
  );

  return group(plate, bottomBun, patty1, cheese1, patty2, cheese2, lettuce, tomato, onion, topBun, sesame);
}

/* ------------------------------------------------------------------ */
/* 炸鸡桶                                                              */
/* ------------------------------------------------------------------ */

/** 一块炸鸡 */
function chickenPiece(size = 0.12, seed = 1) {
  const rnd = mulberry32(seed);
  const g = group(
    mesh(blobGeometry(size, 2, 0.24, 4.2), M.chicken(), {
      sx: 1 + rnd() * 0.2,
      sy: 0.82,
      sz: 0.95 + rnd() * 0.2,
    }),
  );
  // 一小块露出的白肉，破一下「全是一坨金黄」的单调
  g.add(
    mesh(blobGeometry(size * 0.42, 1, 0.2, 5), M.chickenPale(), {
      x: size * 0.5,
      y: size * 0.16,
      z: size * 0.2,
    }),
  );
  return g;
}

export function friedchicken() {
  const plate = plateMesh({ radius: 0.5, height: 0.08 });
  const baseY = 0.018;

  // 桶身：上下开口的锥台，条纹贴图
  const bucket = mesh(
    new THREE.CylinderGeometry(0.34, 0.26, 0.4, 44, 1, true),
    M.striped(),
    { y: baseY + 0.21 },
  );
  const bucketFloor = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 40), M.cream(), {
    y: baseY + 0.02,
  });
  const bucketRim = mesh(new THREE.TorusGeometry(0.34, 0.013, 8, 48), M.ceramicRed(), {
    y: baseY + 0.41,
    rx: Math.PI / 2,
  });

  // 桶里的纸衬
  const liner = mesh(
    new THREE.CylinderGeometry(0.335, 0.29, 0.07, 44, 1, true),
    paperLiner(),
    { y: baseY + 0.445 },
  );

  // 满出来的炸鸡
  const pieces = scatter(
    7,
    (r, i) => {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const d = (0.1 + r() * 0.13) * (i % 3 === 0 ? 1.35 : 1);
      const p = chickenPiece(0.105 + r() * 0.03, 200 + i);
      p.position.set(Math.cos(a) * d, baseY + 0.44 + r() * 0.06, Math.sin(a) * d);
      p.rotation.set(r() * 3, r() * 3, r() * 3);
      return p;
    },
    5,
  );

  // 一块滚到盘边的
  const stray = chickenPiece(0.1, 260);
  stray.position.set(0.3, baseY + 0.075, 0.14);
  stray.rotation.set(0.4, 1.1, 0.3);

  return group(plate, bucket, bucketFloor, bucketRim, liner, pieces, stray);
}

/* ------------------------------------------------------------------ */
/* 薯条                                                                */
/* ------------------------------------------------------------------ */

export function fries() {
  const plate = plateMesh({ radius: 0.5, height: 0.08 });
  const baseY = 0.018;

  // 红纸盒：4 段圆柱 = 锥台方盒
  const carton = mesh(
    new THREE.CylinderGeometry(0.225, 0.14, 0.34, 4, 1, false, Math.PI / 4),
    friesBox(),
    { y: baseY + 0.17 },
  );
  const band = mesh(
    new THREE.CylinderGeometry(0.213, 0.19, 0.055, 4, 1, true, Math.PI / 4),
    M.cream(),
    { y: baseY + 0.29 },
  );

  // 竖着的薯条（半径收在纸盒内壁以内，避免穿模）
  const standing = scatter(
    14,
    (r) => {
      const p = discPoint(r, 0.11);
      const tall = 0.2 + r() * 0.13;
      return mesh(
        roughen(roundedBoxGeometry(0.042, tall, 0.042, 0.012), 0.012, 12),
        r() > 0.62 ? M.friesDark() : M.fries(),
        {
          x: p.x,
          y: baseY + 0.24 + tall / 2,
          z: p.z,
          ry: r() * 3,
          rz: (r() - 0.5) * 0.34,
          rx: (r() - 0.5) * 0.3,
        },
      );
    },
    43,
  );

  // 躺在盘子里的几根
  const lying = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.28, 0.22);
      return mesh(roughen(roundedBoxGeometry(0.042, 0.042, 0.2, 0.012), 0.012, 12), M.fries(), {
        x: p.x,
        y: baseY + 0.022,
        z: p.z,
        ry: r() * 3.14,
      });
    },
    51,
  );

  // 番茄酱
  const ketchup = mesh(blobGeometry(0.09, 2, 0.2, 4), M.sauce(), {
    x: -0.26,
    y: baseY + 0.012,
    z: -0.15,
    sy: 0.16,
    sx: 1.2,
  });

  // 盐粒
  const salt = scatter(
    14,
    (r) => {
      const p = discPoint(r, 0.12);
      return mesh(new THREE.SphereGeometry(0.005, 5, 4), M.cream(), {
        x: p.x,
        y: baseY + 0.5 + r() * 0.06,
        z: p.z,
      });
    },
    59,
  );

  return group(plate, carton, band, standing, lying, ketchup, salt);
}
