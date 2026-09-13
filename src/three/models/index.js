/**
 * 菜品模型注册表
 * ---------------------------------------------------------------
 * 把数据层里的 dish.id 映射到程序化 3D 模型工厂。
 * 工厂只需要返回一个 THREE.Group，位置与尺度由这里统一归一化。
 */

import { normalizeModel, setShadow } from '../geometry.js';
import { DISH_BY_ID } from '../../data/dishes.js';
import { hotpot, dumplings, bbq } from './chinese.js';
import { ramen, sushi, curry } from './japanese.js';
import { steak, pizza, pasta } from './western.js';
import { burger, friedchicken, fries } from './fastfood.js';
import { milktea, icecream, cake } from './dessert.js';
import { salad, roastedveg, tofusoup } from './veggie.js';
import { buildPhotoPlaque } from './custom.js';

/** @type {Record<string, () => import('three').Group>} */
export const BUILDERS = {
  hotpot,
  dumplings,
  bbq,
  ramen,
  sushi,
  curry,
  steak,
  pizza,
  pasta,
  burger,
  friedchicken,
  fries,
  milktea,
  icecream,
  cake,
  salad,
  roastedveg,
  tofusoup,
};

/** 会冒热气的菜 —— 给蒸汽粒子用 */
export const STEAMY = new Set(['hotpot', 'ramen', 'curry', 'dumplings', 'tofusoup', 'bbq', 'pasta']);

/** 带明火的菜 —— 给暖色点光用 */
export const FIERY = new Set(['hotpot', 'bbq']);

export function hasModel(id) {
  return typeof BUILDERS[id] === 'function';
}

/**
 * 构建并归一化一道菜的模型。
 *
 * 传字符串 = 内置菜品；传菜品对象 = 支持 `custom: true` 的拍照加菜，
 * 这时会构建「照片立牌」，`photo` 是已经准备好的贴图（可以为空，用占位卡）。
 *
 * @param {string|object} dishOrId
 * @param {{maxWidth?:number, maxHeight?:number, photo?:import('three').Texture|null}} [opts]
 */
export function buildDishModel(dishOrId, { maxWidth = 0.98, maxHeight = 1.02, photo = null } = {}) {
  const dish =
    typeof dishOrId === 'string'
      ? DISH_BY_ID[dishOrId] || { id: dishOrId, name: dishOrId, custom: false }
      : dishOrId;

  if (!dish || !dish.id) throw new Error('[models] buildDishModel 需要一个菜品或 id');

  let root;
  if (dish.custom) {
    root = buildPhotoPlaque({ dish, texture: photo ?? dish.photoTexture ?? null });
  } else {
    const build = BUILDERS[dish.id];
    if (!build) throw new Error(`[models] 没有 id 为 "${dish.id}" 的模型工厂`);
    root = build();
  }

  normalizeModel(root, { maxWidth, maxHeight });
  setShadow(root, true, false);
  root.userData.dishId = dish.id;
  return root;
}
