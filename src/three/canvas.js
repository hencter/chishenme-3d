/**
 * 画布工具
 * ---------------------------------------------------------------
 * 应用里所有贴图（标签、桌面、辉光、条纹……）都是运行时用 Canvas2D 画出来的，
 * 不依赖任何外部图片。
 *
 * 关键点：这个模块在 **没有 DOM 的 Node 环境** 下也要能跑，
 * 这样 `npm test` 才能直接 import 模型代码做冒烟测试。
 */

const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

/** 一个足够以假乱真的 2D 上下文替身（只在 Node 冒烟测试里生效） */
function createStubContext(canvas) {
  const gradient = { addColorStop() {} };
  const target = {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowColor: '#000',
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: (t) => ({ width: String(t).length * 6 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      // 任何未知方法都变成空操作
      if (typeof prop === 'string') return () => undefined;
      return undefined;
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}

/**
 * 创建一块画布。
 * @param {number} w
 * @param {number} h
 */
export function createCanvas(w, h) {
  if (HAS_DOM) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  const canvas = { width: w, height: h, style: {}, nodeType: 1 };
  canvas.getContext = () => createStubContext(canvas);
  return canvas;
}

/** 取 2D 上下文（带缓存） */
export function ctx2d(canvas) {
  if (!canvas.__ctx) {
    canvas.__ctx = canvas.getContext('2d');
  }
  return canvas.__ctx;
}

/** 圆角矩形路径（不依赖 ctx.roundRect，兼容性更好） */
export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 把 0xRRGGBB 转成 css 颜色 */
export function css(hex, alpha = 1) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** 确定性随机数（同一个 seed 永远得到同一张贴图） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
