/**
 * 西餐 · 3D 模型
 *   steak   黑椒肋眼牛排
 *   pizza   玛格丽特披萨
 *   pasta   奶油培根意面
 */

import * as THREE from 'three';
import { M, makeStd } from '../materials.js';
import {
  mesh,
  group,
  scatter,
  blobGeometry,
  roundedBoxGeometry,
  tubeFromPoints,
  discPoint,
} from '../geometry.js';
import {
  plateMesh,
  bowlMesh,
  brothSurface,
  cherryTomato,
  basilLeaf,
  herbSprig,
  sprinkleBits,
} from './parts.js';

const charMark = () => makeStd('charMark', { color: 0x24110a, roughness: 0.8 });

/* ------------------------------------------------------------------ */
/* 牛排                                                                */
/* ------------------------------------------------------------------ */

export function steak() {
  const plate = plateMesh({ radius: 0.5, height: 0.075 });
  const floorY = 0.016;

  // 三分熟：上下两层焦壳夹一层粉色断面，断面略宽所以从侧面能看见
  const steakGroup = group(
    mesh(roundedBoxGeometry(0.325, 0.022, 0.245, 0.055), M.steakSeared(), { y: floorY + 0.011 }),
    mesh(roundedBoxGeometry(0.34, 0.032, 0.258, 0.058), M.steakRaw(), { y: floorY + 0.038 }),
    mesh(roundedBoxGeometry(0.325, 0.026, 0.245, 0.055), M.steakSeared(), {
      y: floorY + 0.067,
      ry: 0.02,
    }),
  );
  steakGroup.position.set(-0.03, 0, -0.02);
  steakGroup.rotation.y = -0.28;

  // 烤痕：挂在牛排本地坐标系里，跟着一起转
  const marks = scatter(
    4,
    (r, i) =>
      mesh(roundedBoxGeometry(0.29, 0.008, 0.02, 0.004), charMark(), {
        y: floorY + 0.078,
        z: (i - 1.5) * 0.052,
      }),
    7,
  );
  steakGroup.add(marks);

  // 黑椒汁
  const sauce = mesh(blobGeometry(0.11, 2, 0.16, 4), M.sauce(), {
    x: 0.24,
    y: floorY + 0.012,
    z: 0.16,
    sy: 0.16,
    sx: 1.25,
  });

  // 迷迭香
  const rosemary = herbSprig({ length: 0.22, seed: 4 });
  rosemary.position.set(-0.02, floorY + 0.084, 0.12);
  rosemary.rotation.set(0, 0.7, 0.1);

  // 配菜：樱桃番茄 + 四季豆
  const tomatoes = group();
  [
    [0.26, -0.18],
    [-0.28, -0.2],
  ].forEach(([x, z], i) => {
    const t = cherryTomato({ radius: 0.042, halved: i === 1 });
    t.position.set(x, floorY + 0.042, z);
    tomatoes.add(t);
  });

  const beans = scatter(
    3,
    (r, i) =>
      mesh(new THREE.CapsuleGeometry(0.009, 0.16, 3, 8), M.scallion(), {
        x: -0.26 + i * 0.035,
        y: floorY + 0.01,
        z: 0.18 + (i % 2) * 0.03,
        rz: Math.PI / 2,
        ry: 0.5 + i * 0.18,
      }),
    11,
  );

  const pepper = sprinkleBits({
    count: 18,
    radius: 0.22,
    y: floorY + 0.084,
    size: 0.0055,
    material: M.charcoal(),
    seed: 63,
    flat: true,
  });
  pepper.position.set(-0.03, 0, -0.02);

  return group(plate, steakGroup, sauce, rosemary, tomatoes, beans, pepper);
}

/* ------------------------------------------------------------------ */
/* 披萨                                                                */
/* ------------------------------------------------------------------ */

export function pizza() {
  // 圆形木托板
  const serving = mesh(new THREE.CylinderGeometry(0.5, 0.48, 0.045, 56), M.wood(), {
    y: 0.0225,
    recv: true,
  });
  const topY = 0.045;

  // 饼底 + 番茄酱 + 芝士
  const base = mesh(new THREE.CylinderGeometry(0.42, 0.41, 0.03, 56), M.tortilla(), {
    y: topY + 0.015,
  });
  const crust = mesh(new THREE.TorusGeometry(0.4, 0.046, 14, 56), M.breadCrust(), {
    y: topY + 0.032,
    rx: Math.PI / 2,
  });
  const sauceLayer = mesh(new THREE.CylinderGeometry(0.372, 0.37, 0.012, 56), M.sauce(), {
    y: topY + 0.036,
  });
  const cheese = mesh(
    new THREE.SphereGeometry(0.365, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    M.pizzaCheese(),
    { y: topY + 0.042, sy: 0.1 },
  );

  // 料：马苏里拉、番茄片、罗勒
  const mozzarella = scatter(
    6,
    (r) => {
      const p = discPoint(r, 0.3);
      return mesh(blobGeometry(0.05 + r() * 0.018, 2, 0.2, 5), M.cream(), {
        x: p.x,
        y: topY + 0.055,
        z: p.z,
        sy: 0.42,
      });
    },
    5,
  );

  const tomatoSlices = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.24, 0.06);
      return mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20), M.tomato(), {
        x: p.x,
        y: topY + 0.062,
        z: p.z,
        ry: r() * 3,
      });
    },
    13,
  );

  const basil = scatter(
    7,
    (r) => {
      const p = discPoint(r, 0.28);
      const leaf = basilLeaf({ size: 0.05, seed: 40 + ((r() * 90) | 0) });
      leaf.position.set(p.x, topY + 0.07, p.z);
      leaf.rotation.set((r() - 0.5) * 0.35, r() * 3, (r() - 0.5) * 0.35);
      return leaf;
    },
    23,
  );

  return group(serving, base, crust, sauceLayer, cheese, mozzarella, tomatoSlices, basil);
}

/* ------------------------------------------------------------------ */
/* 奶油培根意面                                                         */
/* ------------------------------------------------------------------ */

export function pasta() {
  const bowl = bowlMesh({
    rTop: 0.46,
    rBottom: 0.26,
    height: 0.3,
    thickness: 0.026,
    material: M.ceramic(),
  });

  // 碗底一层奶油酱（贴着碗底，把碗内壁的空白填掉）
  const creamBase = brothSurface({ radius: 0.38, y: 0.09, thickness: 0.13, material: M.cream() });

  // 面：十几股盘成一座小山
  const nest = group();
  for (let i = 0; i < 12; i += 1) {
    const pts = [];
    const rBase = 0.09 + (i % 4) * 0.045;
    const yBase = 0.2 + (i % 3) * 0.032;
    for (let j = 0; j <= 16; j += 1) {
      const t = j / 16;
      const a = t * Math.PI * 1.75 + i * 1.13;
      const rr = rBase * (1 + 0.42 * Math.sin(t * 6 + i));
      pts.push([
        Math.cos(a) * rr + Math.sin(i * 1.7) * 0.028,
        yBase + Math.sin(t * Math.PI) * 0.046,
        Math.sin(a) * rr + Math.cos(i * 2.1) * 0.028,
      ]);
    }
    nest.add(mesh(tubeFromPoints(pts, 0.0115, 64, 7), M.noodle()));
  }

  // 培根
  const bacon = scatter(
    5,
    (r) => {
      const p = discPoint(r, 0.24, 0.06);
      return mesh(roundedBoxGeometry(0.12, 0.016, 0.052, 0.008), M.bacon(), {
        x: p.x,
        y: 0.3 + r() * 0.016,
        z: p.z,
        ry: r() * 3,
        rz: (r() - 0.5) * 0.5,
      });
    },
    17,
  );

  // 帕玛森屑 + 现磨黑胡椒
  const cheeseDust = sprinkleBits({
    count: 34,
    radius: 0.27,
    y: 0.302,
    size: 0.0065,
    material: M.cream(),
    seed: 83,
    flat: true,
  });
  const pepper = sprinkleBits({
    count: 22,
    radius: 0.25,
    y: 0.312,
    size: 0.0055,
    material: M.charcoal(),
    seed: 89,
    flat: true,
  });

  // 两片罗勒
  const basil = scatter(
    2,
    (r) => {
      const p = discPoint(r, 0.16, 0.04);
      const leaf = basilLeaf({ size: 0.058, seed: 60 + ((r() * 50) | 0) });
      leaf.position.set(p.x, 0.315, p.z);
      leaf.rotation.set(0, r() * 3, 0);
      return leaf;
    },
    27,
  );

  return group(bowl, creamBase, nest, bacon, cheeseDust, pepper, basil);
}
