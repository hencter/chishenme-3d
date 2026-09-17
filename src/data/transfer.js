/**
 * 菜品导入导出 / 分享链接
 * ---------------------------------------------------------------
 * 自定义菜品可以：
 *   1. 导出成一份 JSON（照片内嵌为 dataURL），随时再导入回来；
 *   2. 压进一条 base64 的分享链接（`#share=...`），别人打开就能加进自己的菜单。
 *
 * 这个模块刻意保持「纯」：base64url、payload 校验、dataURL ↔ Blob 都不碰 DOM，
 * 所以能在 Node 里直接测。
 */

import { normalizeDishInput } from './custom.js';

export const APP_ID = 'chishenme';
export const PAYLOAD_VERSION = 1;
export const SHARE_PARAM = 'share';

/** 一条链接 / 一个文件里最多接受多少道菜 */
export const MAX_DISHES = 200;
/** 单张照片 dataURL 的长度上限（约 2MB 二进制），防止有人塞个炸弹进来 */
export const MAX_PHOTO_CHARS = 3_000_000;

/* ------------------------------------------------------------------ */
/* base64url                                                           */
/* ------------------------------------------------------------------ */

function bytesToBinary(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return bin;
}

function binaryToBytes(bin) {
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** 文本 → base64url（URL 安全、去掉 padding，中文/emoji 都不会坏） */
export function toBase64Url(text) {
  const bytes = new TextEncoder().encode(String(text));
  return btoa(bytesToBinary(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → 文本；解不开返回 null */
export function fromBase64Url(encoded) {
  if (typeof encoded !== 'string') return null;
  const s = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!s || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  try {
    return new TextDecoder().decode(binaryToBytes(atob(s + pad)));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* dataURL ↔ Blob                                                      */
/* ------------------------------------------------------------------ */

/** Blob → dataURL（不依赖 FileReader，Node 里也能用） */
export async function blobToDataUrl(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || 'application/octet-stream';
  return `data:${mime};base64,${btoa(bytesToBinary(buf))}`;
}

/** dataURL → Blob；不是合法的 dataURL 返回 null */
export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  try {
    if (m[2]) {
      const bin = atob(m[3].replace(/\s+/g, ''));
      return new Blob([binaryToBytes(bin)], { type: mime });
    }
    return new Blob([new TextEncoder().encode(decodeURIComponent(m[3]))], { type: mime });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* payload                                                             */
/* ------------------------------------------------------------------ */

/** 只保留可搬运的字段，运行时对象（photoTexture 之类）不写进文件 */
export function dishToTransferable(dish, photo = null) {
  const out = {
    id: dish.id,
    name: dish.name,
    emoji: dish.emoji,
    category: dish.category,
    desc: dish.desc,
    tip: dish.tip,
    kcal: dish.kcal,
    price: dish.price,
    spicy: dish.spicy,
    tags: Array.isArray(dish.tags) ? dish.tags.slice(0, 5) : [],
    accent: dish.accent,
    createdAt: dish.createdAt,
  };
  if (typeof photo === 'string' && photo.startsWith('data:image/')) out.photo = photo;
  return out;
}

/**
 * 打包菜品。
 * @param {object[]} dishes
 * @param {{photos?: Map<string,string>, exportedAt?: number}} [opts]
 */
export function buildPayload(dishes, { photos = new Map(), exportedAt = Date.now() } = {}) {
  const list = Array.isArray(dishes) ? dishes : [];
  return {
    app: APP_ID,
    v: PAYLOAD_VERSION,
    exportedAt,
    dishes: list.slice(0, MAX_DISHES).map((dish) => dishToTransferable(dish, photos.get(dish.id))),
  };
}

/** payload → 文本；pretty=true 用于导出文件（好读），分享链接用紧凑版 */
export function payloadToText(payload, { pretty = false } = {}) {
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
}

function normalizeImportedDish(item) {
  if (!String(item.name || '').trim()) return null;
  const n = normalizeDishInput(item);
  const dish = {
    id: n.id,
    name: n.name,
    emoji: n.emoji,
    category: n.category,
    desc: n.desc,
    tip: n.tip,
    kcal: n.kcal,
    price: n.price,
    spicy: n.spicy,
    tags: n.tags,
    accent: n.accent,
    createdAt: n.createdAt,
  };
  const photo = item.photo;
  if (typeof photo === 'string' && photo.startsWith('data:image/') && photo.length <= MAX_PHOTO_CHARS) {
    dish.photo = photo;
  }
  return dish;
}

/**
 * 解析导入文本（文件或分享链接里的 JSON）。
 * 同时接受本应用的 payload 和「裸数组」，坏数据会被跳过并计数。
 * @returns {{dishes: object[], skipped: number, exportedAt: number}}
 */
export function parsePayload(text) {
  let raw;
  try {
    raw = JSON.parse(String(text));
  } catch {
    throw new Error('不是有效的 JSON 文件');
  }

  let list = null;
  let exportedAt = 0;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    if (raw.app && raw.app !== APP_ID) {
      throw new Error(`这份数据不是「吃什么好呢」导出的（app=${raw.app}）`);
    }
    if (Number(raw.v) > PAYLOAD_VERSION) {
      throw new Error('这份数据来自更新的版本，先更新应用再导入');
    }
    if (Array.isArray(raw.dishes)) {
      list = raw.dishes;
      exportedAt = Number(raw.exportedAt) || 0;
    }
  }
  if (!list) throw new Error('格式不对：找不到菜品列表');

  const dishes = [];
  let skipped = 0;
  for (const item of list.slice(0, MAX_DISHES)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped += 1;
      continue;
    }
    const dish = normalizeImportedDish(item);
    if (dish) dishes.push(dish);
    else skipped += 1;
  }
  if (!dishes.length) throw new Error('里面没有可用的菜品');
  return { dishes, skipped, exportedAt };
}

/* ------------------------------------------------------------------ */
/* 分享链接                                                             */
/* ------------------------------------------------------------------ */

/** payload → `https://...#share=<base64url>` */
export function encodeShareUrl(payload, href = '') {
  const base = String(href || '').split('#')[0];
  return `${base}#${SHARE_PARAM}=${toBase64Url(payloadToText(payload))}`;
}

/**
 * 从 location.hash 里读分享数据；没有 / 损坏都返回 null。
 * @returns {{dishes: object[], skipped: number, exportedAt: number}|null}
 */
export function readShareFromHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  let value = null;
  try {
    const params = new URLSearchParams(raw);
    value = params.get(SHARE_PARAM) || params.get('dishes');
  } catch {
    value = null;
  }
  if (!value && raw.startsWith(`${SHARE_PARAM}=`)) {
    value = raw.slice(SHARE_PARAM.length + 1).split('&')[0];
  }
  if (!value) return null;
  const text = fromBase64Url(value.replace(/ /g, '+'));
  if (!text) return null;
  try {
    return parsePayload(text);
  } catch {
    return null;
  }
}
