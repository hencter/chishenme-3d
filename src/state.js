/**
 * 应用状态
 * ---------------------------------------------------------------
 * 分类筛选 / 决策风格 / 忌口清单 / 点名历史 / 偏好，全部集中在这里，
 * 并自动持久化到 localStorage。任何改动都会通知订阅者。
 */

import { DISHES, DISH_BY_ID, CATEGORIES } from './data/dishes.js';

/** 决策风格：决定「权重」怎么算 —— 这是本应用唯一称得上智能的部分 */
export const DECISION_STYLES = [
  { id: 'balanced', name: '均衡', desc: '众生平等，纯看手气' },
  { id: 'variety', name: '不重样', desc: '最近出现过的自动降权' },
  { id: 'adventure', name: '尝鲜', desc: '优先你没吃过的新菜' },
  { id: 'budget', name: '省钱', desc: '越便宜概率越高' },
  { id: 'light', name: '轻食', desc: '热量越低概率越高' },
];

export const QUALITY_LEVELS = [
  { id: 'high', name: '高画质' },
  { id: 'balanced', name: '均衡' },
  { id: 'low', name: '省电' },
];

const STORAGE_KEY = 'chishenme.store.v1';
const HISTORY_MAX = 60;
const RECENT_WINDOW = 8;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function safeLoad() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export class Store {
  /**
   * @param {{customDishes?: object[]}} [opts] 用户自己拍照加进来的菜
   */
  constructor({ customDishes = [] } = {}) {
    /** @type {string} 当前分类 */
    this.category = 'all';
    /** @type {string} 当前决策风格 */
    this.style = 'balanced';
    /** @type {Set<string>} 忌口清单 */
    this.banned = new Set();
    /** @type {{id:string, at:number, eaten:boolean}[]} 最近的点名记录，最新的在前 */
    this.history = [];
    /** @type {'high'|'balanced'|'low'} */
    this.quality = 'high';
    this.sound = true;
    this.seenHelp = false;

    /** 自定义菜排在最前面，打开菜单先看到自己拍的 */
    this.dishes = [...customDishes, ...DISHES];

    this.listeners = new Set();
    this.#hydrate(safeLoad());
  }

  /* ------------------------------------------------------------------ */
  /* 菜品表                                                              */
  /* ------------------------------------------------------------------ */

  /** @returns {object|null} */
  dishById(id) {
    return this.dishes.find((d) => d.id === id) || DISH_BY_ID[id] || null;
  }

  get customDishes() {
    return this.dishes.filter((d) => d.custom);
  }

  get builtinDishes() {
    return this.dishes.filter((d) => !d.custom);
  }

  /**
   * 替换自定义菜（拍照加菜 / 删除之后调用）。
   * @param {object[]} customDishes
   */
  setCustomDishes(customDishes) {
    this.dishes = [...customDishes, ...DISHES];
    // 已经不存在的美食要清出忌口清单，否则统计数字会骗人
    let dirty = false;
    for (const id of [...this.banned]) {
      if (!this.dishById(id)) {
        this.banned.delete(id);
        dirty = true;
      }
    }
    if (dirty) this.#persist();
    this.emit({ type: 'dishes' });
  }

  /** 数据表里合法的分类 id */
  hasCategory(id) {
    return CATEGORIES.some((c) => c.id === id);
  }

  /* ------------------------------------------------------------------ */
  /* 持久化                                                              */
  /* ------------------------------------------------------------------ */

  #hydrate(data) {
    if (!data) return;
    if (typeof data.category === 'string') this.category = data.category;
    if (DECISION_STYLES.some((s) => s.id === data.style)) this.style = data.style;
    if (QUALITY_LEVELS.some((q) => q.id === data.quality)) this.quality = data.quality;
    if (Array.isArray(data.banned)) {
      // 过滤掉已经不存在的菜，避免旧数据把状态弄脏
      this.banned = new Set(data.banned.filter((id) => this.dishById(id)));
    }
    if (Array.isArray(data.history)) {
      this.history = data.history
        .filter((h) => h && this.dishById(h.id))
        .slice(0, HISTORY_MAX)
        .map((h) => ({ id: h.id, at: Number(h.at) || Date.now(), eaten: !!h.eaten }));
    }
    if (typeof data.sound === 'boolean') this.sound = data.sound;
    if (typeof data.seenHelp === 'boolean') this.seenHelp = data.seenHelp;
  }

  #persist() {
    try {
      globalThis.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          category: this.category,
          style: this.style,
          quality: this.quality,
          banned: [...this.banned],
          history: this.history,
          sound: this.sound,
          seenHelp: this.seenHelp,
        }),
      );
    } catch {
      /* 隐私模式 / 配额满 —— 忽略即可，不影响功能 */
    }
  }

  /* ------------------------------------------------------------------ */
  /* 订阅                                                                */
  /* ------------------------------------------------------------------ */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(detail = {}) {
    for (const fn of this.listeners) {
      try {
        fn(this, detail);
      } catch (err) {
        console.error('[store] listener failed', err);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 查询                                                                */
  /* ------------------------------------------------------------------ */

  /**
   * 当前分类下、未忌口的菜品。
   * 「我的」这个分类只看用户自己拍照加进来的菜。
   */
  get visibleDishes() {
    const cat = this.category;
    return this.dishes.filter((d) => {
      if (this.banned.has(d.id)) return false;
      if (cat === 'all') return true;
      if (cat === 'mine') return !!d.custom;
      return d.category === cat;
    });
  }

  get visibleCount() {
    return this.visibleDishes.length;
  }

  isBanned(id) {
    return this.banned.has(id);
  }

  /** 某道菜在当前风格/历史下的相对权重 */
  weightFor(dish, poolSize = this.visibleCount) {
    let w = 1;
    const recent = this.history.slice(0, RECENT_WINDOW);
    const recentCount = recent.reduce((n, h) => (h.id === dish.id ? n + 1 : n), 0);
    const seenCount = this.history.reduce((n, h) => (h.id === dish.id ? n + 1 : n), 0);
    const eatenCount = this.history.reduce(
      (n, h) => (h.id === dish.id && h.eaten ? n + 1 : n),
      0,
    );

    switch (this.style) {
      case 'variety':
        // 最近 8 次里每出现一次，权重乘 0.34
        w *= Math.pow(0.34, recentCount);
        break;
      case 'adventure':
        if (seenCount === 0) w *= 3.2;
        else if (eatenCount === 0) w *= 1.4;
        else w *= Math.pow(0.6, Math.min(eatenCount, 4));
        break;
      case 'budget':
        w *= clamp(120 / dish.price, 0.32, 3.4);
        break;
      case 'light':
        w *= clamp(720 / dish.kcal, 0.3, 3.4);
        break;
      default:
        w *= 1;
    }

    // 所有风格都躲开「上一次刚点过」的那道菜
    if (poolSize > 1 && this.history.length && this.history[0].id === dish.id) {
      w *= 0.08;
    }

    return Math.max(w, 1e-6);
  }

  /** 归一化概率表：Map<dishId, 0..1> */
  probabilities() {
    const pool = this.visibleDishes;
    const out = new Map();
    if (!pool.length) return out;
    const weights = pool.map((d) => this.weightFor(d, pool.length));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    pool.forEach((d, i) => out.set(d.id, weights[i] / total));
    return out;
  }

  /**
   * 按权重抽一道菜。
   * @param {() => number} rng 便于测试时注入确定性随机源
   */
  pick(rng = Math.random) {
    const pool = this.visibleDishes;
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    const weights = pool.map((d) => this.weightFor(d, pool.length));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /* ------------------------------------------------------------------ */
  /* 变更                                                                */
  /* ------------------------------------------------------------------ */

  setCategory(id) {
    if (this.category === id) return;
    this.category = id;
    this.#persist();
    this.emit({ type: 'category' });
  }

  setStyle(id) {
    if (this.style === id) return;
    this.style = id;
    this.#persist();
    this.emit({ type: 'style' });
  }

  setQuality(id) {
    if (this.quality === id) return;
    this.quality = id;
    this.#persist();
    this.emit({ type: 'quality' });
  }

  setSound(on) {
    this.sound = !!on;
    this.#persist();
    this.emit({ type: 'sound' });
  }

  setSeenHelp(v = true) {
    this.seenHelp = !!v;
    this.#persist();
  }

  /** @returns {{id:string, at:number, eaten:boolean}} */
  record(dish) {
    const entry = { id: dish.id, at: Date.now(), eaten: false };
    this.history.unshift(entry);
    if (this.history.length > HISTORY_MAX) this.history.length = HISTORY_MAX;
    this.#persist();
    this.emit({ type: 'record', dish, entry });
    return entry;
  }

  /** 把「最近一次点名」标记为真的去吃了 */
  acceptLatest() {
    const entry = this.history[0];
    if (!entry || entry.eaten) return false;
    entry.eaten = true;
    this.#persist();
    this.emit({ type: 'accept', dish: this.dishById(entry.id), entry });
    return true;
  }

  ban(id) {
    if (!this.dishById(id) || this.banned.has(id)) return false;
    this.banned.add(id);
    this.#persist();
    this.emit({ type: 'ban', id });
    return true;
  }

  unban(id) {
    if (!this.banned.delete(id)) return false;
    this.#persist();
    this.emit({ type: 'ban', id });
    return true;
  }

  clearHistory() {
    if (!this.history.length) return;
    this.history = [];
    this.#persist();
    this.emit({ type: 'clear' });
  }

  /* ------------------------------------------------------------------ */
  /* 统计                                                                */
  /* ------------------------------------------------------------------ */

  stats() {
    const total = this.history.length;
    const eaten = this.history.reduce((n, h) => (h.eaten ? n + 1 : n), 0);
    const counter = new Map();
    for (const h of this.history) {
      const cur = counter.get(h.id) || { count: 0, eaten: 0, at: h.at };
      cur.count += 1;
      if (h.eaten) cur.eaten += 1;
      cur.at = Math.max(cur.at, h.at);
      counter.set(h.id, cur);
    }
    const top = [...counter.entries()]
      .map(([id, v]) => ({ dish: this.dishById(id), ...v }))
      .sort((a, b) => b.eaten - a.eaten || b.count - a.count || b.at - a.at)
      .slice(0, 3);
    return { total, eaten, banCount: this.banned.size, top, last: this.history[0] || null };
  }
}
