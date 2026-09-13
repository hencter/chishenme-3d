/**
 * 自定义菜品（拍照加菜）
 * ---------------------------------------------------------------
 * 元数据存在 localStorage，照片存在 IndexedDB。
 * 两边都做了「环境不支持就优雅降级」的处理：隐私模式 / 无 IndexedDB 时
 * 依然能加菜，只是照片不会保存下来。
 *
 * 这个模块刻意不依赖 three —— 照片以 Blob / ImageBitmap / objectURL 的形式
 * 对外提供，贴图由 3D 层自己创建。
 */

const META_KEY = 'chishenme.custom.v1';
const DB_NAME = 'chishenme';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

/** 照片最长边压到这个尺寸，再转 JPEG —— 兼顾清晰度与体积 */
export const PHOTO_MAX_EDGE = 1024;
export const PHOTO_QUALITY = 0.82;

/** 分类默认图标，加菜时用来给个合理的初值 */
export const CATEGORY_EMOJI = {
  chinese: '🥘',
  japanese: '🍱',
  western: '🍽️',
  fastfood: '🍔',
  dessert: '🍮',
  veggie: '🥗',
};

/** 可选图标（加菜表单里点一下就换） */
export const EMOJI_CHOICES = [
  '🍜', '🍲', '🥘', '🍛', '🍚', '🥟', '🍢', '🍖', '🍗', '🥩',
  '🍔', '🍟', '🍕', '🍝', '🌮', '🌯', '🍣', '🍱', '🍤', '🍙',
  '🥗', '🥦', '🍄', '🌽', '🥑', '🍅', '🥚', '🧀', '🍞', '🥐',
  '🍰', '🧁', '🍮', '🍨', '🍦', '🧋', '☕', '🍵', '🍹', '🍺',
];

const isBrowser = typeof window !== 'undefined';

/* ------------------------------------------------------------------ */
/* 颜色工具（纯函数，方便测试）                                          */
/* ------------------------------------------------------------------ */

export function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

/**
 * 从 RGBA 像素里提取一个「好看的主题色」。
 *
 * 思路：丢掉接近纯黑/纯白的像素，按饱和度平方加权求平均（越鲜艳越算数），
 * 最后把结果拉到一个固定的高饱和中等亮度区间 —— 这样无论用户拍的是
 * 昏暗的火锅还是过曝的白盘子，出来的主题色都稳定好看。
 *
 * @param {Uint8ClampedArray|Uint8Array|number[]} rgba
 * @param {number} [fallback]
 * @returns {number} 0xRRGGBB
 */
export function accentFromPixels(rgba, fallback = 0xffb347) {
  const n = Math.floor(rgba.length / 4);
  if (!n) return fallback;
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i < n; i += 1) {
    const R = rgba[i * 4] / 255;
    const G = rgba[i * 4 + 1] / 255;
    const B = rgba[i * 4 + 2] / 255;
    const mx = Math.max(R, G, B);
    const mn = Math.min(R, G, B);
    const l = (mx + mn) / 2;
    if (mx < 0.06 || l > 0.94) continue; // 太黑或太白，没有色彩信息
    const d = mx - mn;
    const s = d === 0 ? 0 : l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const weight = 0.12 + s * s * 1.9;
    r += R * weight;
    g += G * weight;
    b += B * weight;
    w += weight;
  }
  if (w < 1e-6) return fallback;

  let [h, s, l] = rgbToHsl(r / w, g / w, b / w);
  s = Math.max(0.5, Math.min(0.82, s * 0.85 + 0.32));
  l = Math.max(0.5, Math.min(0.62, l * 0.5 + 0.3));
  const [rr, gg, bb] = hslToRgb(h, s, l);
  return (
    (Math.round(rr * 255) << 16) | (Math.round(gg * 255) << 8) | Math.round(bb * 255)
  );
}

/** 从一张已解码的图片里取主题色 */
export function accentFromImageSource(source) {
  if (!isBrowser) return 0xffb347;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0xffb347;
  ctx.drawImage(source, 0, 0, 48, 48);
  try {
    const img = ctx.getImageData(0, 0, 48, 48);
    return accentFromPixels(img.data);
  } catch {
    // 跨域图片会污染画布
    return 0xffb347;
  }
}

/* ------------------------------------------------------------------ */
/* 元数据持久化（localStorage）                                          */
/* ------------------------------------------------------------------ */

function safeReadMeta() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d) => d && typeof d.id === 'string') : [];
  } catch {
    return [];
  }
}

function safeWriteMeta(list) {
  if (!isBrowser) return false;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 照片持久化（IndexedDB）                                               */
/* ------------------------------------------------------------------ */

let dbPromise = null;

function openDb() {
  if (!isBrowser || !window.indexedDB) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve) => {
    let t;
    try {
      t = db.transaction(PHOTO_STORE, mode);
    } catch {
      resolve(null);
      return;
    }
    const store = t.objectStore(PHOTO_STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req ? req.result : null);
    t.onerror = () => resolve(null);
    t.onabort = () => resolve(null);
  });
}

async function idbPut(id, blob) {
  const db = await openDb();
  if (!db) return false;
  const ok = await tx(db, 'readwrite', (s) => s.put(blob, id));
  return ok !== null;
}

async function idbGet(id) {
  const db = await openDb();
  if (!db) return null;
  const val = await tx(db, 'readonly', (s) => s.get(id));
  return val instanceof Blob ? val : null;
}

async function idbDelete(id) {
  const db = await openDb();
  if (!db) return;
  await tx(db, 'readwrite', (s) => s.delete(id));
}

/* ------------------------------------------------------------------ */
/* 图片处理                                                             */
/* ------------------------------------------------------------------ */

/**
 * 把用户选的照片压成体积可控的 JPEG。
 * @param {Blob|File} file
 * @returns {Promise<{blob: Blob, width: number, height: number, accent: number, previewUrl: string}>}
 */
export async function preparePhoto(file) {
  const bitmap = await decodeImage(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);

  const accent = (() => {
    try {
      return accentFromPixels(ctx.getImageData(0, 0, w, h).data);
    } catch {
      return 0xffb347;
    }
  })();

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', PHOTO_QUALITY),
  );

  const previewUrl = URL.createObjectURL(blob || file);
  if (bitmap.close) bitmap.close();

  return { blob: blob || file, width: w, height: h, accent, previewUrl };
}

/** 解码成 ImageBitmap（不支持时退回 HTMLImageElement） */
export async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* 退回 <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('图片解码失败'));
      img.src = url;
    });
    return img;
  } finally {
    // img 已经拿到数据，可以释放 url（ImageBitmap 路径不会走到这里）
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/* ------------------------------------------------------------------ */
/* 仓库                                                                 */
/* ------------------------------------------------------------------ */

let dishes = safeReadMeta();
/** @type {Map<string, string>} id → objectURL（给 DOM 预览用） */
const urlCache = new Map();

export function getCustomDishes() {
  return dishes.slice();
}

export function isCustomDish(dish) {
  return !!(dish && dish.custom);
}

export function makeId() {
  return `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * 新增一道菜。
 * @param {object} input 表单数据
 * @param {Blob|null} photoBlob 已经压好的照片
 * @param {string|null} previewUrl 已经在表单里生成好的预览 URL
 */
export async function addCustomDish(input, photoBlob = null, previewUrl = null) {
  const id = input.id || makeId();
  const dish = {
    id,
    name: String(input.name || '').trim().slice(0, 24) || '没名字的菜',
    emoji: input.emoji || CATEGORY_EMOJI[input.category] || '🍽️',
    category: input.category || 'chinese',
    desc: String(input.desc || '').trim().slice(0, 120),
    tip: String(input.tip || '').trim().slice(0, 120),
    kcal: clampInt(input.kcal, 0, 5000, 500),
    price: clampInt(input.price, 0, 9999, 30),
    spicy: clampInt(input.spicy, 0, 3, 0),
    tags: normalizeTags(input.tags),
    accent: typeof input.accent === 'number' ? input.accent : 0xffb347,
    custom: true,
    createdAt: Date.now(),
    hasPhoto: !!photoBlob,
  };

  if (photoBlob) {
    const saved = await idbPut(id, photoBlob);
    dish.hasPhoto = saved;
  }
  if (previewUrl) urlCache.set(id, previewUrl);

  dishes = [dish, ...dishes];
  safeWriteMeta(dishes);
  return dish;
}

export async function removeCustomDish(id) {
  const before = dishes.length;
  dishes = dishes.filter((d) => d.id !== id);
  if (dishes.length === before) return false;
  safeWriteMeta(dishes);
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  await idbDelete(id);
  return true;
}

/** 取照片的 objectURL（给 <img> 预览用），没照片返回 null */
export async function getPhotoUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await idbGet(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

/** 取照片 Blob（给 3D 贴图用） */
export async function getPhotoBlob(id) {
  return idbGet(id);
}

/** 环境是否支持持久化照片 */
export async function photoStorageAvailable() {
  const db = await openDb();
  return !!db;
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function normalizeTags(tags) {
  const arr = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(/[,，、\s]+/)
        .filter(Boolean);
  return arr.map((t) => String(t).trim().slice(0, 8)).filter(Boolean).slice(0, 5);
}

/** 仅供测试：重置内存状态 */
export function __resetForTest(list = []) {
  dishes = list.slice();
  urlCache.clear();
}
