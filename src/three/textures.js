/**
 * 程序化贴图
 * ---------------------------------------------------------------
 * 全部用 Canvas2D 现画，结果按 key 缓存，避免重复生成。
 */

import * as THREE from 'three';
import { createCanvas, ctx2d, roundRectPath, css, mulberry32 } from './canvas.js';

const CJK = '"PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const cache = new Map();

function cached(key, build) {
  let v = cache.get(key);
  if (v === undefined) {
    v = build();
    cache.set(key, v);
  }
  return v;
}

function toTexture(canvas, { srgb = true, flipY = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.flipY = flipY;
  tex.needsUpdate = true;
  return tex;
}

/** 渲染器就绪后统一提升各向异性，让斜视角下的桌面与标签更清晰 */
export function applyAnisotropy(tex, maxAniso) {
  if (tex && maxAniso) {
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* 辉光 / 粒子贴图                                                      */
/* ------------------------------------------------------------------ */

/** 中心亮、边缘透明的柔和光斑（用于光晕 Sprite 和粒子） */
export function glowTexture(hardness = 0.16) {
  return cached(`glow:${hardness}`, () => {
    const S = 256;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(hardness, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return toTexture(c);
  });
}

/** 一圈柔和的环，用于地面光斑 */
export function haloTexture() {
  return cached('halo', () => {
    const S = 512;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.68, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return toTexture(c);
  });
}

/* ------------------------------------------------------------------ */
/* 桌面                                                                 */
/* ------------------------------------------------------------------ */

/** 星盘桌面：深色石面 + 同心刻线 + 放射纹 + 细碎颗粒 */
export function tableTexture() {
  return cached('table', () => {
    const S = 1024;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    const cx = S / 2;
    const cy = S / 2;
    const R = S / 2;

    ctx.fillStyle = '#120b06';
    ctx.fillRect(0, 0, S, S);

    // 中心暖光（整体压得很暗，让盘子上的菜成为画面里最亮的东西）
    const warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    warm.addColorStop(0, 'rgba(44,25,13,0.96)');
    warm.addColorStop(0.45, 'rgba(23,13,7,0.9)');
    warm.addColorStop(0.82, 'rgba(12,7,4,0.94)');
    warm.addColorStop(1, 'rgba(7,4,2,0.99)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, S, S);

    // 石纹颗粒
    const rnd = mulberry32(20240913);
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i += 1) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * R;
      const s = 1 + rnd() * 3.4;
      ctx.fillStyle = rnd() > 0.52 ? '#ffd9a8' : '#000000';
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, s);
    }
    ctx.globalAlpha = 1;

    // 放射刻线
    ctx.strokeStyle = 'rgba(255,186,116,0.055)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3);
      ctx.lineTo(cx + Math.cos(a) * R * 0.985, cy + Math.sin(a) * R * 0.985);
      ctx.stroke();
    }

    // 同心圆
    for (let i = 1; i <= 9; i += 1) {
      const r = R * (0.3 + (i / 9) * 0.68);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = i === 9 ? 'rgba(255,196,128,0.2)' : 'rgba(255,186,116,0.075)';
      ctx.lineWidth = i === 9 ? 4 : 2;
      ctx.stroke();
    }

    // 外圈虚线
    ctx.setLineDash([10, 16]);
    ctx.strokeStyle = 'rgba(255,205,140,0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.945, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    return toTexture(c);
  });
}

/* ------------------------------------------------------------------ */
/* 菜品标签                                                             */
/* ------------------------------------------------------------------ */

/**
 * 生成一张菜品标签贴图。
 * @param {object} dish
 * @param {{ highlight?: boolean, probability?: number, width?: number }} opts
 */
export function labelTexture(dish, opts = {}) {
  const { highlight = false, probability = null } = opts;
  const key = `label:${dish.id}:${highlight ? 'h' : 'n'}:${
    probability === null ? '-' : probability.toFixed(3)
  }`;
  return cached(key, () => {
    const W = 660;
    const H = 220;
    const c = createCanvas(W, H);
    const ctx = ctx2d(c);
    const accent = dish.accent;

    // 卡片底
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (highlight) {
      bg.addColorStop(0, 'rgba(64,40,24,0.95)');
      bg.addColorStop(1, 'rgba(30,18,11,0.96)');
    } else {
      bg.addColorStop(0, 'rgba(26,17,11,0.8)');
      bg.addColorStop(1, 'rgba(16,10,7,0.82)');
    }
    roundRectPath(ctx, 8, 8, W - 16, H - 16, 44);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.lineWidth = highlight ? 5 : 3;
    ctx.strokeStyle = css(accent, highlight ? 0.95 : 0.42);
    if (highlight) {
      ctx.shadowColor = css(accent, 0.9);
      ctx.shadowBlur = 26;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 左侧色条
    roundRectPath(ctx, 22, 40, 10, H - 80, 5);
    ctx.fillStyle = css(accent, highlight ? 1 : 0.7);
    ctx.fill();

    // emoji
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `84px ${EMOJI}`;
    ctx.fillText(dish.emoji, 54, H / 2 + 6);

    // 菜名
    ctx.font = `700 46px ${CJK}`;
    ctx.fillStyle = highlight ? '#fff9f0' : 'rgba(255,246,236,0.94)';
    ctx.fillText(dish.name, 168, H / 2 - 26);

    // 副信息
    const meta = probability === null
      ? `${dish.kcal} kcal · ¥${dish.price}`
      : `${dish.kcal} kcal · ¥${dish.price} · ${(probability * 100).toFixed(1)}%`;
    ctx.font = `400 26px ${CJK}`;
    ctx.fillStyle = highlight ? 'rgba(255,214,150,0.95)' : 'rgba(255,236,214,0.5)';
    ctx.fillText(meta, 170, H / 2 + 34);

    if (highlight) {
      ctx.font = `700 24px ${CJK}`;
      ctx.fillStyle = css(accent, 1);
      ctx.textAlign = 'right';
      ctx.fillText('就是它', W - 42, H / 2 - 26);
      ctx.textAlign = 'left';
    }

    return toTexture(c);
  });
}

/**
 * 自定义菜品没有照片时的占位卡：大图标 + 菜名 + 主题色边。
 * 尺寸比例和照片一样是 4:3，这样有照片/没照片的立牌外观统一。
 */
export function dishCardPlaceholderTexture(dish) {
  return cached(`card:${dish.id}:${dish.accent}`, () => {
    const W = 640;
    const H = 480;
    const c = createCanvas(W, H);
    const ctx = ctx2d(c);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, css(dish.accent, 0.34));
    bg.addColorStop(0.55, 'rgba(40,26,17,0.95)');
    bg.addColorStop(1, 'rgba(22,14,9,0.98)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 斜向高光，别让占位卡显得太平
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = css(dish.accent, 0.85);
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `210px ${EMOJI}`;
    ctx.fillText(dish.emoji || '🍽️', W / 2, H * 0.42);

    ctx.font = `700 52px ${CJK}`;
    ctx.fillStyle = 'rgba(255,247,236,0.96)';
    const name = dish.name.length > 7 ? `${dish.name.slice(0, 7)}…` : dish.name;
    ctx.fillText(name, W / 2, H * 0.78);

    ctx.font = `400 26px ${CJK}`;
    ctx.fillStyle = css(dish.accent, 0.95);
    ctx.fillText('我加的菜', W / 2, H * 0.91);

    return toTexture(c);
  });
}

/* ------------------------------------------------------------------ */
/* 杂项贴图                                                             */
/* ------------------------------------------------------------------ */

/** 条纹（炸鸡桶 / 奶茶杯） */
export function stripeTexture(colorA = 0xd8342a, colorB = 0xf6efe0, stripes = 12) {
  return cached(`stripe:${colorA}:${colorB}:${stripes}`, () => {
    const W = 512;
    const H = 256;
    const c = createCanvas(W, H);
    const ctx = ctx2d(c);
    ctx.fillStyle = css(colorB);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(colorA);
    const sw = W / stripes;
    for (let i = 0; i < stripes; i += 2) {
      ctx.fillRect(i * sw, 0, sw, H);
    }
    // 顶部一道细金线
    ctx.fillStyle = 'rgba(255,205,120,0.9)';
    ctx.fillRect(0, 0, W, 8);
    return toTexture(c);
  });
}

/** 斑驳噪声贴图，用作粗糙度 / 凹凸，让表面不至于太塑料 */
export function mottleTexture(seed = 7, base = 0.55, spread = 0.4) {
  return cached(`mottle:${seed}:${base}:${spread}`, () => {
    const S = 256;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    const rnd = mulberry32(seed);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const data = img?.data;
    if (data && data.length === S * S * 4) {
      for (let i = 0; i < S * S; i += 1) {
        const v = Math.max(0, Math.min(1, base + (rnd() - 0.5) * spread)) * 255;
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  });
}

/** 竹编蒸笼顶面 */
export function bambooTexture() {
  return cached('bamboo', () => {
    const S = 512;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    ctx.fillStyle = '#c9a165';
    ctx.fillRect(0, 0, S, S);
    const rnd = mulberry32(88);
    ctx.lineWidth = 5;
    for (let y = 0; y < S; y += 22) {
      ctx.strokeStyle = `rgba(120,84,40,${0.22 + rnd() * 0.16})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,226,176,${0.1 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(0, y + 6);
      ctx.lineTo(S, y + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,76,36,0.28)';
    ctx.lineWidth = 3;
    for (let x = 0; x < S; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
    }
    return toTexture(c);
  });
}

/** 纹理贴图（木纹 / 大理石）—— 用于盘子与砧板 */
export function slateTexture() {
  return cached('slate', () => {
    const S = 512;
    const c = createCanvas(S, S);
    const ctx = ctx2d(c);
    ctx.fillStyle = '#26282c';
    ctx.fillRect(0, 0, S, S);
    const rnd = mulberry32(4242);
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 900; i += 1) {
      const x = rnd() * S;
      const y = rnd() * S;
      const w = 20 + rnd() * 90;
      ctx.strokeStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
      ctx.lineWidth = 1 + rnd() * 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w * 0.5, y + (rnd() - 0.5) * 26, x + w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return toTexture(c);
  });
}
