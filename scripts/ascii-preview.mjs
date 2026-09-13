/**
 * 截图文本预览 —— npm run preview:ascii
 * ---------------------------------------------------------------
 * 当前会话的模型读不了图片，于是把 PNG 降采样成字符网格：
 *   亮度图  —— 用字符密度表示明暗，可以直接看出构图轮廓
 *   色相图  —— W 暖色 / C 冷色 / G 偏绿 / D 暗部 / . 极暗
 *
 * 用法：node scripts/ascii-preview.mjs shots/01-boot.png [更多图片...]
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('找不到浏览器，设置 CHROME_PATH 再试。');
  process.exit(2);
}

const files = process.argv.slice(2).map((p) => (p.startsWith('shots') ? join(root, p) : p));
if (!files.length) {
  console.error('用法：node scripts/ascii-preview.mjs shots/01-boot.png');
  process.exit(2);
}

const COLS = Number(process.env.COLS) || 96;
const ROWS = Number(process.env.ROWS) || 34;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 400, height: 300 },
});

try {
  const page = await browser.newPage();
  await page.goto('about:blank');

  for (const file of files) {
    if (!existsSync(file)) {
      console.log(`\n跳过（不存在）：${file}`);
      continue;
    }
    const b64 = readFileSync(file).toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    const grid = await page.evaluate(
      async (url, cols, rows) => {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error('decode failed'));
          img.src = url;
        });
        const c = document.createElement('canvas');
        c.width = cols;
        c.height = rows;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, cols, rows);
        const d = ctx.getImageData(0, 0, cols, rows).data;
        const lum = [];
        const hue = [];
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let maxL = 0;
        let minL = 255;
        let sum = 0;
        for (let i = 0; i < cols * rows; i += 1) {
          const r = d[i * 4];
          const g = d[i * 4 + 1];
          const b = d[i * 4 + 2];
          sr += r;
          sg += g;
          sb += b;
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lum.push(l);
          sum += l;
          if (l > maxL) maxL = l;
          if (l < minL) minL = l;
          // 粗略色相分类
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          let cls = 'd';
          if (mx < 26) cls = '.';
          else if (sat < 0.12) cls = mx > 150 ? 'W' : 'd'; // 低饱和亮部当暖白
          else if (r >= g && r >= b) cls = g > b ? 'Y' : 'W'; // 黄/橙红
          else if (g >= r && g >= b) cls = 'G';
          else cls = 'C';
          hue.push(cls);
        }
        const n = cols * rows;
        return {
          lum,
          hue,
          cols,
          rows,
          meanRGB: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
          meanLum: +(sum / n).toFixed(1),
          minLum: +minL.toFixed(1),
          maxLum: +maxL.toFixed(1),
          imgW: img.naturalWidth,
          imgH: img.naturalHeight,
        };
      },
      dataUrl,
      COLS,
      ROWS,
    );

    const ramp = ' .:-=+*#%@';
    console.log('\n' + '═'.repeat(COLS));
    console.log(`${basename(file)}   ${grid.imgW}×${grid.imgH}   平均 RGB ${grid.meanRGB.join(',')}   亮度 ${grid.minLum}~${grid.maxLum} (均值 ${grid.meanLum})`);
    console.log('─'.repeat(COLS));
    for (let y = 0; y < grid.rows; y += 1) {
      let line = '';
      for (let x = 0; x < grid.cols; x += 1) {
        const l = grid.lum[y * grid.cols + x];
        const idx = Math.min(ramp.length - 1, Math.max(0, Math.round((l / 255) * (ramp.length - 1) * 1.6)));
        line += ramp[idx];
      }
      console.log(line);
    }
    console.log('─'.repeat(COLS) + '  色相: W=暖橙/红 Y=暖黄 G=绿 C=冷蓝 d=中性暗 .=极暗');
    for (let y = 0; y < grid.rows; y += 1) {
      let line = '';
      for (let x = 0; x < grid.cols; x += 1) line += grid.hue[y * grid.cols + x];
      console.log(line);
    }
  }
} finally {
  await browser.close();
}
