/**
 * 转盘数学
 * ---------------------------------------------------------------
 * 这里全是纯函数，不引入 three，方便 `npm test` 直接验证落点是否准确。
 */

export const TAU = Math.PI * 2;

/** 归一化到 [0, 2π) */
export function normalizeAngle(a) {
  return ((a % TAU) + TAU) % TAU;
}

/** 第 index 个盘子（共 count 个）在环旋转 ringY 之后的世界角度 */
export function podWorldAngle(ringY, index, count) {
  return normalizeAngle((index * TAU) / count + ringY);
}

/** 选中结果停留的世界角度：正对默认机位（相机在 +Z 方向） */
export const FRONT_ANGLE = Math.PI / 2;

/**
 * 计算旋转目标：保证向前转，并且最终让第 index 个盘子停在 FRONT_ANGLE。
 * @param {{currentY:number, index:number, count:number, turns?:number}} p
 * @returns {number} 旋转结束时的 ringY
 */
export function spinTarget({ currentY, index, count, turns = 4 }) {
  const n = Math.max(1, count);
  const step = TAU / n;
  const goal = FRONT_ANGLE - index * step;
  const delta = normalizeAngle(goal - currentY);
  return currentY + Math.max(1, turns) * TAU + delta;
}

/**
 * 生成一条「回拉 → 加速 → 匀速 → 五次缓出」的角度曲线。
 *
 * 关键点：减速段的起始角速度与匀速段严格相等（五次缓出的初始导数是 5Δ/T），
 * 所以整个过程没有速度跳变，停下来的时候也刚好落在 D 上。
 *
 * @param {{distance:number, total?:number, windup?:number, accel?:number, decel?:number}} p
 */
export function createSpinCurve({
  distance,
  total = 3.5,
  windup = 0.3,
  accel = 0.55,
  decel = 1.7,
}) {
  const D = Math.max(0.001, distance);
  const A = Math.min(0.5, D * 0.03);
  const cruise = Math.max(0.24, total - windup - accel - decel);
  const omega = (D + A) / (0.5 * accel + cruise + decel / 5);

  const distAccel = 0.5 * omega * accel;
  const distCruise = omega * cruise;
  const distDecel = (omega * decel) / 5;

  const a1 = -A;
  const a2 = a1 + distAccel;
  const a3 = a2 + distCruise;
  const duration = windup + accel + cruise + decel;

  function at(t) {
    if (t <= 0) return 0;
    if (t >= duration) return D;
    if (t < windup) {
      return -A * Math.sin((t / windup) * (Math.PI / 2));
    }
    const t1 = t - windup;
    if (t1 < accel) {
      const k = t1 / accel;
      return a1 + 0.5 * omega * accel * k * k;
    }
    const t2 = t1 - accel;
    if (t2 < cruise) {
      return a2 + omega * t2;
    }
    const t3 = t2 - cruise;
    const v = Math.min(1, t3 / decel);
    return a3 + distDecel * (1 - Math.pow(1 - v, 5));
  }

  return {
    distance: D,
    duration,
    omega,
    windup,
    accel,
    cruise,
    decel,
    at,
    /**
     * 给定 t 的瞬时角速度（解析导数，带符号）。
     * 回拉段是负的 —— 那 0.3 秒里转盘在往后退。
     */
    speedAt(t) {
      if (t <= 0 || t >= duration) return 0;
      if (t < windup) {
        return -((A * Math.PI) / (2 * windup)) * Math.cos((t / windup) * (Math.PI / 2));
      }
      const t1 = t - windup;
      if (t1 < accel) return omega * (t1 / accel);
      const t2 = t1 - accel;
      if (t2 < cruise) return omega;
      const t3 = t2 - cruise;
      const v = Math.min(1, t3 / decel);
      return omega * Math.pow(1 - v, 4);
    },
  };
}

/** 缓动（相机飞行用） */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
