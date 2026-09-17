/**
 * HUD
 * ---------------------------------------------------------------
 * 所有 DOM 界面：分类、决策风格、菜单列表、战绩、结果卡片、帮助、提示。
 * 它只做「显示 + 派发意图」，真正的业务逻辑通过 actions 回调交给 main.js。
 */

import {
  CATEGORIES,
  CATEGORY_NAME,
  PICKABLE_CATEGORIES,
  hexCss,
  spicyLabel,
} from '../data/dishes.js';
import { CATEGORY_EMOJI, EMOJI_CHOICES, preparePhoto, getPhotoUrl } from '../data/custom.js';
import { DECISION_STYLES, QUALITY_LEVELS } from '../state.js';

const $ = (id) => document.getElementById(id);

const clockText = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function createHud({ store, actions }) {
  const el = {
    topbar: $('topbar'),
    catChips: $('catChips'),
    stylePick: $('stylePick'),
    dishList: $('dishList'),
    menuCount: $('menuCount'),
    favourites: $('favourites'),
    historyList: $('historyList'),
    statPicks: $('statPicks'),
    statEaten: $('statEaten'),
    statBan: $('statBan'),
    panelMenu: $('panelMenu'),
    panelHistory: $('panelHistory'),
    btnMenuToggle: $('btnMenuToggle'),
    btnHistoryToggle: $('btnHistoryToggle'),
    btnSound: $('btnSound'),
    btnQuality: $('btnQuality'),
    btnHelp: $('btnHelp'),
    btnFullscreen: $('btnFullscreen'),
    btnSpin: $('btnSpin'),
    btnReshuffle: $('btnReshuffle'),
    btnReset: $('btnReset'),
    btnHistoryClear: $('btnHistoryClear'),
    dockNote: $('dockNote'),
    resultModal: $('resultModal'),
    resultEmoji: $('resultEmoji'),
    resultCat: $('resultCat'),
    resultSpicy: $('resultSpicy'),
    resultName: $('resultName'),
    resultDesc: $('resultDesc'),
    resultStats: $('resultStats'),
    resultTags: $('resultTags'),
    resultTip: $('resultTip'),
    btnAccept: $('btnAccept'),
    btnAgain: $('btnAgain'),
    btnBan: $('btnBan'),
    btnResultClose: $('btnResultClose'),
    helpModal: $('helpModal'),
    btnHelpClose: $('btnHelpClose'),
    qualityPick: $('qualityPick'),
    loading: $('loading'),
    loadingBar: $('loadingBar'),
    loadingText: $('loadingText'),
    toast: $('toast'),
    fps: $('fps'),
    // 加菜
    btnAdd: $('btnAdd'),
    btnAddFromPanel: $('btnAddFromPanel'),
    addModal: $('addModal'),
    btnAddClose: $('btnAddClose'),
    btnAddCancel: $('btnAddCancel'),
    btnAddSave: $('btnAddSave'),
    btnAddTitle: $('addTitle'),
    addTip: $('addTip'),
    photoInput: $('photoInput'),
    photoDrop: $('photoDrop'),
    photoPreview: $('photoPreview'),
    photoHint: $('photoHint'),
    photoMeta: $('photoMeta'),
    btnPhotoClear: $('btnPhotoClear'),
    fldName: $('fldName'),
    fldKcal: $('fldKcal'),
    fldPrice: $('fldPrice'),
    fldDesc: $('fldDesc'),
    fldCategory: $('fldCategory'),
    fldSpicy: $('fldSpicy'),
    fldEmoji: $('fldEmoji'),
    // 菜品管理 / 导入导出 / 分享
    btnManageFromPanel: $('btnManageFromPanel'),
    manageModal: $('manageModal'),
    btnManageClose: $('btnManageClose'),
    btnManageDone: $('btnManageDone'),
    btnManageAdd: $('btnManageAdd'),
    btnManageImport: $('btnManageImport'),
    btnManageExport: $('btnManageExport'),
    btnManageShare: $('btnManageShare'),
    btnManageClear: $('btnManageClear'),
    manageList: $('manageList'),
    manageCount: $('manageCount'),
    manageTip: $('manageTip'),
    importInput: $('importInput'),
    sharePanel: $('sharePanel'),
    shareWithPhotos: $('shareWithPhotos'),
    shareUrl: $('shareUrl'),
    shareSize: $('shareSize'),
    btnShareCopy: $('btnShareCopy'),
    // 收到分享链接
    shareModal: $('shareModal'),
    shareSummary: $('shareSummary'),
    btnShareAccept: $('btnShareAccept'),
    btnShareDecline: $('btnShareDecline'),
  };

  let activeDishId = null;
  let resultDish = null;
  let toastTimer = 0;
  let loadingDone = false;
  let shareToken = 0;
  let clearTimer = 0;

  const on = (node, type, fn) => {
    if (node) node.addEventListener(type, fn);
  };

  /* ------------------------------------------------------------------ */
  /* 小工具                                                              */
  /* ------------------------------------------------------------------ */

  function toast(msg, ms = 2200) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function buzz(ms = 18) {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* 忽略 */
    }
  }

  function closeMobilePanels() {
    el.panelMenu?.classList.remove('open');
    el.panelHistory?.classList.remove('open');
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：分类 / 风格                                                    */
  /* ------------------------------------------------------------------ */

  function renderChips() {
    if (!el.catChips) return;
    el.catChips.replaceChildren(
      ...CATEGORIES.map((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip' + (store.category === cat.id ? ' active' : '');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = hexCss(cat.accent);
        const label = document.createElement('span');
        label.textContent = cat.name;
        btn.append(dot, label);
        btn.addEventListener('click', () => {
          actions.click?.();
          store.setCategory(cat.id);
        });
        return btn;
      }),
    );
  }

  function renderStyles() {
    if (!el.stylePick) return;
    el.stylePick.replaceChildren(
      ...DECISION_STYLES.map((s) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = s.name;
        btn.title = s.desc;
        btn.className = store.style === s.id ? 'active' : '';
        btn.addEventListener('click', () => {
          actions.click?.();
          store.setStyle(s.id);
          toast(`决策风格：${s.name} —— ${s.desc}`);
        });
        return btn;
      }),
    );
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：菜单列表                                                       */
  /* ------------------------------------------------------------------ */

  function renderDishList() {
    if (!el.dishList) return;
    const dishes = store.visibleDishes;
    const probs = store.probabilities();
    const pickedCount = new Map();
    for (const h of store.history) pickedCount.set(h.id, (pickedCount.get(h.id) || 0) + 1);

    if (el.menuCount) {
      el.menuCount.textContent =
        store.category === 'all' ? `${dishes.length} 道` : `${dishes.length} 道 · ${CATEGORY_NAME[store.category]}`;
    }

    if (!dishes.length) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = '这个分类下的菜都被你拉黑了，去右边把忌口去掉几道吧。';
      el.dishList.replaceChildren(note);
      return;
    }

    el.dishList.replaceChildren(
      ...dishes.map((dish, i) => {
        const row = document.createElement('div');
        row.className = 'dish-row' + (dish.id === activeDishId ? ' active' : '');
        row.dataset.id = dish.id;
        row.setAttribute('role', 'listitem');

        const emoji = document.createElement('span');
        emoji.className = 'emoji';
        emoji.textContent = dish.emoji;

        const meta = document.createElement('div');
        meta.className = 'meta';
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = dish.name;
        const sub = document.createElement('div');
        sub.className = 'sub';
        const p = probs.get(dish.id) ?? 0;
        sub.textContent = `${dish.kcal} kcal · ¥${dish.price} · ${(p * 100).toFixed(1)}%`;
        meta.append(nm, sub);

        row.append(emoji, meta);

        const picked = pickedCount.get(dish.id) || 0;
        if (picked > 0) {
          const badge = document.createElement('span');
          badge.className = 'pick-badge';
          badge.textContent = `×${picked}`;
          row.append(badge);
        }

        if (dish.custom) {
          const mine = document.createElement('span');
          mine.className = 'mine-badge';
          mine.textContent = '我的';
          row.append(mine);

          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'edit-btn';
          edit.title = '改一改这道菜';
          edit.textContent = '✏️';
          edit.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobilePanels();
            openAdd(dish);
          });
          row.append(edit);

          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'del-btn';
          del.title = '从菜单里删掉这道菜';
          del.textContent = '🗑';
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            actions.removeDish?.(dish);
          });
          row.append(del);
        }

        const ban = document.createElement('button');
        ban.type = 'button';
        ban.className = 'ban-btn';
        ban.title = '以后别推荐这道';
        ban.textContent = '⊘';
        ban.addEventListener('click', (e) => {
          e.stopPropagation();
          actions.ban?.(dish);
        });
        row.append(ban);

        row.addEventListener('click', () => {
          actions.click?.();
          actions.select?.(i, dish);
          closeMobilePanels();
        });
        return row;
      }),
    );
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：战绩 / 忌口                                                    */
  /* ------------------------------------------------------------------ */

  function renderHistory() {
    const stats = store.stats();
    if (el.statPicks) el.statPicks.textContent = String(stats.total);
    if (el.statEaten) el.statEaten.textContent = String(stats.eaten);
    if (el.statBan) el.statBan.textContent = String(stats.banCount);

    if (el.historyList) {
      if (!store.history.length) {
        const note = document.createElement('p');
        note.className = 'empty-note';
        note.textContent = '还没有点过名。按下「转一转」，把选择权交出去。';
        el.historyList.replaceChildren(note);
      } else {
        el.historyList.replaceChildren(
          ...store.history.slice(0, 24).map((h) => {
            const row = document.createElement('div');
            row.className = 'hist-row' + (h.eaten ? ' eaten' : '');
            const emoji = document.createElement('span');
            const item = store.dishById(h.id);
            emoji.textContent = item ? item.emoji : '🍽';
            const name = document.createElement('span');
            name.textContent = item ? item.name : h.id;
            const t = document.createElement('span');
            t.className = 't';
            t.textContent = h.eaten ? `已吃 ${clockText(h.at)}` : clockText(h.at);
            row.append(emoji, name, t);
            return row;
          }),
        );
      }
    }

    if (el.favourites) {
      const parts = [];
      if (stats.top.length) {
        const title = document.createElement('div');
        title.className = 'fav-title';
        title.textContent = '最常点名';
        parts.push(title);
        const max = Math.max(...stats.top.map((t) => t.count), 1);
        for (const t of stats.top) {
          const row = document.createElement('div');
          row.className = 'fav-row';
          const emoji = document.createElement('span');
          emoji.textContent = t.dish.emoji;
          const nm = document.createElement('span');
          nm.textContent = t.dish.name;
          const bar = document.createElement('span');
          bar.className = 'bar';
          const fill = document.createElement('i');
          fill.style.width = `${Math.round((t.count / max) * 100)}%`;
          bar.append(fill);
          row.append(emoji, nm, bar);
          parts.push(row);
        }
      }

      if (store.banned.size) {
        const title = document.createElement('div');
        title.className = 'fav-title';
        title.textContent = '忌口清单（点一下解除）';
        parts.push(title);
        const wrap = document.createElement('div');
        wrap.className = 'ban-chips';
        for (const id of store.banned) {
          const item = store.dishById(id);
          if (!item) continue;
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'ban-chip';
          chip.textContent = `${item.emoji} ${item.name} ✕`;
          chip.addEventListener('click', () => {
            actions.click?.();
            actions.unban?.(id);
          });
          wrap.append(chip);
        }
        parts.push(wrap);
      }

      el.favourites.replaceChildren(...parts);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 菜品管理 / 导入导出 / 分享                                            */
  /* ------------------------------------------------------------------ */

  function renderManage() {
    if (!el.manageList) return;
    const list = store.customDishes;
    const has = list.length > 0;

    if (el.manageCount) el.manageCount.textContent = has ? `${list.length} 道` : '还没有';
    for (const btn of [el.btnManageExport, el.btnManageShare, el.btnManageClear]) {
      if (btn) btn.disabled = !has;
    }
    if (el.sharePanel && !has) el.sharePanel.hidden = true;

    if (!has) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent =
        '还没有自己定义的菜。拍一张，或者「手动加一道」；也可以用「导入文件」把之前的备份恢复回来。';
      el.manageList.replaceChildren(note);
      return;
    }

    el.manageList.replaceChildren(
      ...list.map((dish) => {
        const row = document.createElement('div');
        row.className = 'manage-row';
        row.dataset.id = dish.id;

        const emoji = document.createElement('span');
        emoji.className = 'emoji';
        emoji.textContent = dish.emoji;

        const meta = document.createElement('div');
        meta.className = 'manage-meta';
        const nm = document.createElement('div');
        nm.className = 'manage-name';
        nm.textContent = dish.name;
        const sub = document.createElement('div');
        sub.className = 'manage-sub';
        const bits = [
          CATEGORY_NAME[dish.category] || dish.category,
          `${dish.kcal} kcal`,
          `¥${dish.price}`,
        ];
        if (dish.hasPhoto) bits.push('有照片');
        sub.textContent = bits.join(' · ');
        meta.append(nm, sub);

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'edit-btn';
        edit.title = '改一改这道菜';
        edit.textContent = '✏️';
        edit.addEventListener('click', () => {
          actions.click?.();
          closeManage();
          openAdd(dish);
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'del-btn';
        del.title = '从菜单里删掉这道菜';
        del.textContent = '🗑';
        del.addEventListener('click', () => {
          actions.click?.();
          actions.removeDish?.(dish);
        });

        row.append(emoji, meta, edit, del);
        return row;
      }),
    );
  }

  function resetClearButton() {
    if (!el.btnManageClear) return;
    clearTimeout(clearTimer);
    el.btnManageClear.textContent = '清空我的菜品';
    el.btnManageClear.classList.remove('confirm');
  }

  function openManage() {
    if (!el.manageModal) return;
    if (el.sharePanel) el.sharePanel.hidden = true;
    if (el.shareUrl) el.shareUrl.value = '';
    if (el.shareSize) el.shareSize.textContent = '';
    if (el.manageTip) {
      el.manageTip.textContent = '';
      el.manageTip.classList.remove('error');
    }
    resetClearButton();
    renderManage();
    el.manageModal.hidden = false;
  }

  function closeManage() {
    if (!el.manageModal) return;
    el.manageModal.hidden = true;
    if (el.sharePanel) el.sharePanel.hidden = true;
    if (el.shareUrl) el.shareUrl.value = '';
  }

  function openSharePrompt(info = {}) {
    if (!el.shareModal) return;
    if (el.shareSummary) {
      const photos = info.photos ? `，其中 ${info.photos} 道带照片` : '';
      el.shareSummary.textContent = `这条链接里有 ${info.count || 0} 道菜${photos}。加进菜单后会保存在这台设备上，同名的菜会被链接里的版本覆盖。`;
    }
    el.shareModal.hidden = false;
  }

  function closeSharePrompt() {
    if (el.shareModal) el.shareModal.hidden = true;
  }

  async function copyShareUrl() {
    const text = el.shareUrl?.value || '';
    if (!text) return false;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        el.shareUrl.select();
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    toast(ok ? '分享链接已复制，发给朋友吧' : '复制失败，长按链接手动复制');
    return ok;
  }

  /** 生成分享链接（照片缩略图是异步压的，用 token 防止旧结果盖掉新结果） */
  async function renderShareUrl() {
    const withPhotos = el.shareWithPhotos ? el.shareWithPhotos.checked : true;
    const token = (shareToken += 1);
    if (el.shareUrl) el.shareUrl.value = '';
    if (el.shareSize) el.shareSize.textContent = withPhotos ? '正在压照片…' : '正在生成…';

    let url = null;
    try {
      url = await actions.shareUrl?.({ withPhotos });
    } catch (err) {
      console.error('[share] 生成失败', err);
    }
    if (token !== shareToken || !el.shareUrl) return;

    if (!url) {
      if (el.shareSize) el.shareSize.textContent = '';
      toast('还没有自己加的菜可以分享');
      return;
    }

    el.shareUrl.value = url;
    const kb = Math.max(1, Math.round(url.length / 1024));
    if (el.shareSize) {
      el.shareSize.textContent =
        kb > 100 ? `约 ${kb} KB · 有点长，个别聊天软件可能截断` : `约 ${kb} KB`;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('分享链接已复制，发给朋友吧');
    } catch {
      el.shareUrl.focus();
      el.shareUrl.select();
      toast('链接已生成，点「复制链接」拿走');
    }
  }

  async function handleImportFile(file) {
    if (!file) return;
    if (el.manageTip) {
      el.manageTip.textContent = '正在读取…';
      el.manageTip.classList.remove('error');
    }
    try {
      const text = await file.text();
      await actions.importDishes?.(text);
      if (el.manageTip) el.manageTip.textContent = `已从「${file.name}」导入`;
    } catch (err) {
      console.error('[import] 失败', err);
      if (el.manageTip) {
        el.manageTip.textContent = `导入失败：${err?.message || err}`;
        el.manageTip.classList.add('error');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 结果卡片                                                             */
  /* ------------------------------------------------------------------ */

  function showResult(dish, { probability = null } = {}) {
    if (!el.resultModal || !dish) return;
    resultDish = dish;
    el.resultEmoji.textContent = dish.emoji;
    el.resultCat.textContent = CATEGORY_NAME[dish.category] || '';
    el.resultSpicy.textContent = dish.spicy > 0 ? `🌶 ${spicyLabel(dish.spicy)}` : '🌿 清淡';
    el.resultName.textContent = dish.name;
    el.resultDesc.textContent = dish.desc;

    const prob = probability === null ? store.probabilities().get(dish.id) ?? 0 : probability;
    el.resultStats.replaceChildren(
      ...[
        [String(dish.kcal), '千卡'],
        [`¥${dish.price}`, '人均'],
        [`${(prob * 100).toFixed(1)}%`, '被抽中'],
      ].map(([big, small]) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const b = document.createElement('b');
        b.textContent = big;
        const s = document.createElement('span');
        s.textContent = small;
        cell.append(b, s);
        return cell;
      }),
    );

    el.resultTags.replaceChildren(
      ...dish.tags.map((t) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = `#${t}`;
        return tag;
      }),
    );

    const styleName = DECISION_STYLES.find((s) => s.id === store.style)?.name || '均衡';
    el.resultTip.textContent = `${dish.tip}（当前风格：${styleName}）`;

    el.resultModal.hidden = false;
    requestAnimationFrame(() => el.btnAccept?.focus({ preventScroll: true }));
  }

  function hideResult() {
    if (el.resultModal) el.resultModal.hidden = true;
    resultDish = null;
  }

  function openHelp() {
    if (el.helpModal) el.helpModal.hidden = false;
  }
  function closeHelp() {
    if (el.helpModal) el.helpModal.hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* 拍照加菜                                                             */
  /* ------------------------------------------------------------------ */

  /** 表单草稿：照片、主题色、以及各选择项 */
  const draft = {
    blob: null,
    previewUrl: null,
    accent: 0xffb347,
    emoji: null,
    category: 'chinese',
    spicy: 0,
    width: 0,
    height: 0,
    editingId: null,
    removePhoto: false,
  };

  function addTip(msg = '', isError = false) {
    if (!el.addTip) return;
    el.addTip.textContent = msg;
    el.addTip.classList.toggle('error', !!isError);
  }

  function releaseDraft() {
    if (draft.previewUrl) {
      URL.revokeObjectURL(draft.previewUrl);
      draft.previewUrl = null;
    }
    draft.blob = null;
    draft.width = 0;
    draft.height = 0;
  }

  function renderAddPickers() {
    if (el.fldCategory) {
      el.fldCategory.replaceChildren(
        ...PICKABLE_CATEGORIES.map((cat) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = cat.name;
          btn.className = draft.category === cat.id ? 'active' : '';
          btn.addEventListener('click', () => {
            draft.category = cat.id;
            // 没手动挑过图标时，跟着分类给个合理默认
            if (!draft.emojiPicked) draft.emoji = CATEGORY_EMOJI[cat.id] || '🍽️';
            renderAddPickers();
          });
          return btn;
        }),
      );
    }

    if (el.fldSpicy) {
      el.fldSpicy.replaceChildren(
        ...[0, 1, 2, 3].map((lv) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = spicyLabel(lv);
          btn.className = draft.spicy === lv ? 'active' : '';
          btn.addEventListener('click', () => {
            draft.spicy = lv;
            renderAddPickers();
          });
          return btn;
        }),
      );
    }

    if (el.fldEmoji) {
      el.fldEmoji.replaceChildren(
        ...EMOJI_CHOICES.map((emo) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = emo;
          btn.className = draft.emoji === emo ? 'active' : '';
          btn.addEventListener('click', () => {
            draft.emoji = emo;
            draft.emojiPicked = true;
            renderAddPickers();
          });
          return btn;
        }),
      );
    }
  }

  function setPhotoPreview({ url, meta }) {
    if (!el.photoPreview || !el.photoHint) return;
    if (url) {
      el.photoPreview.src = url;
      el.photoPreview.hidden = false;
      el.photoHint.hidden = true;
      if (el.photoMeta) el.photoMeta.textContent = meta || '';
      if (el.btnPhotoClear) el.btnPhotoClear.hidden = false;
    } else {
      el.photoPreview.removeAttribute('src');
      el.photoPreview.hidden = true;
      el.photoHint.hidden = false;
      if (el.photoMeta) el.photoMeta.textContent = '';
      if (el.btnPhotoClear) el.btnPhotoClear.hidden = true;
    }
  }

  function renderAddMode() {
    const editing = !!draft.editingId;
    if (el.btnAddTitle) el.btnAddTitle.textContent = editing ? '改一改这道菜' : '拍张照，加道菜';
    if (el.btnAddSave) el.btnAddSave.textContent = editing ? '保存修改' : '加进菜单';
    const sub = document.querySelector('#addModal .sheet-sub');
    if (sub) {
      sub.textContent = editing
        ? '改完点保存，星盘上的它立刻更新；照片重选一张就会替换掉原来的。'
        : '照片只存在这台设备上，不会上传到任何服务器。加完就能一起转。';
    }
  }

  /**
   * 打开加菜表单。
   * @param {object|null} dish 传了就是编辑模式（改一道已有的自定义菜）
   */
  async function openAdd(dish = null) {
    if (!el.addModal) return;
    releaseDraft();
    draft.editingId = dish?.id || null;
    draft.removePhoto = false;
    draft.category = dish?.category || 'chinese';
    draft.emoji = dish?.emoji || CATEGORY_EMOJI[draft.category] || '🍽️';
    draft.emojiPicked = !!dish;
    draft.spicy = Number.isFinite(dish?.spicy) ? dish.spicy : 0;
    draft.accent = typeof dish?.accent === 'number' ? dish.accent : 0xffb347;

    if (el.fldName) el.fldName.value = dish?.name || '';
    if (el.fldKcal) el.fldKcal.value = dish ? String(dish.kcal) : '';
    if (el.fldPrice) el.fldPrice.value = dish ? String(dish.price) : '';
    if (el.fldDesc) el.fldDesc.value = dish?.desc || '';
    if (el.photoInput) el.photoInput.value = '';

    setPhotoPreview({ url: null });
    renderAddPickers();
    renderAddMode();

    el.addModal.hidden = false;

    if (dish?.hasPhoto) {
      addTip('正在读取原来的照片…');
      const url = await getPhotoUrl(dish.id);
      // 等待期间用户可能已经关掉表单或换了另一道菜
      if (url && !el.addModal.hidden && draft.editingId === dish.id) {
        setPhotoPreview({ url, meta: '原照片 · 重新选一张会替换掉它' });
        addTip('可以改信息，也可以重选一张照片替换');
      } else if (!el.addModal.hidden && draft.editingId === dish.id) {
        addTip('原来的照片读不出来了，保存时会给你一张占位卡');
      }
    } else {
      addTip(supportsCamera() ? '可以直接调起相机拍一张' : '从相册或文件里选一张图');
    }

    requestAnimationFrame(() => el.fldName?.focus({ preventScroll: true }));
  }

  function closeAdd() {
    if (!el.addModal) return;
    el.addModal.hidden = true;
    draft.editingId = null;
    draft.removePhoto = false;
    releaseDraft();
  }

  function supportsCamera() {
    return typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  async function handlePhotoPick(file) {
    if (!file) return;
    addTip('正在处理照片…');
    try {
      const res = await preparePhoto(file);
      releaseDraft();
      draft.removePhoto = false;
      draft.blob = res.blob;
      draft.previewUrl = res.previewUrl;
      draft.accent = res.accent;
      draft.width = res.width;
      draft.height = res.height;
      setPhotoPreview({
        url: res.previewUrl,
        meta: `${res.width}×${res.height} · ${Math.max(1, Math.round(res.blob.size / 1024))} KB · 主题色 ${hexCss(res.accent)}`,
      });
      addTip('照片处理好了，起个菜名就能加进菜单');
      // 手机上拍完照，把表单滚进视野并聚焦菜名，省得用户自己找
      requestAnimationFrame(() => {
        el.fldName?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.fldName?.focus({ preventScroll: true });
      });
    } catch (err) {
      console.error('[add] 照片处理失败', err);
      addTip('这张图读不出来，换一张试试', true);
    }
  }

  async function saveDraft() {
    const name = (el.fldName?.value || '').trim();
    if (!name) {
      addTip('菜名总得填一个吧', true);
      el.fldName?.focus({ preventScroll: true });
      return;
    }
    if (el.btnAddSave) el.btnAddSave.disabled = true;
    addTip(draft.editingId ? '正在更新这道菜…' : '正在把它摆上桌…');
    const payload = {
      name,
      emoji: draft.emoji,
      category: draft.category,
      spicy: draft.spicy,
      kcal: el.fldKcal?.value,
      price: el.fldPrice?.value,
      desc: el.fldDesc?.value,
      accent: draft.accent,
    };
    try {
      if (draft.editingId) {
        await actions.updateDish?.(draft.editingId, payload, draft.blob, draft.previewUrl, {
          removePhoto: draft.removePhoto,
        });
      } else {
        await actions.addDish?.(payload, draft.blob, draft.previewUrl);
      }
      // 所有权已经交给仓库，不要再 revoke
      draft.previewUrl = null;
      draft.blob = null;
      closeAdd();
    } catch (err) {
      console.error('[add] 保存失败', err);
      addTip(`保存失败：${err?.message || err}`, true);
    } finally {
      if (el.btnAddSave) el.btnAddSave.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 加载 / 状态                                                          */
  /* ------------------------------------------------------------------ */

  function setLoading(p, text) {
    if (el.loadingBar) el.loadingBar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    if (text && el.loadingText) el.loadingText.textContent = text;
  }

  function finishLoading() {
    if (loadingDone) return;
    loadingDone = true;
    setLoading(1, '开饭');
    setTimeout(() => el.loading?.classList.add('done'), 320);
  }

  function failLoading(message) {
    loadingDone = true;
    if (el.loadingBar) el.loadingBar.style.width = '100%';
    if (el.loadingText) el.loadingText.textContent = message;
  }

  function setSpinBusy(busy) {
    if (!el.btnSpin) return;
    el.btnSpin.classList.toggle('spinning', busy);
    el.btnSpin.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function setDockNote(text) {
    if (el.dockNote) el.dockNote.textContent = text;
  }

  function setActiveDish(id) {
    if (activeDishId === id) return;
    activeDishId = id;
    for (const row of el.dishList?.children || []) {
      if (!row.dataset) continue;
      row.classList.toggle('active', row.dataset.id === id);
    }
  }

  function setFps(v) {
    if (el.fps) el.fps.textContent = `${v} FPS`;
  }

  /* ------------------------------------------------------------------ */
  /* 全量渲染                                                             */
  /* ------------------------------------------------------------------ */

  function render() {
    renderChips();
    renderStyles();
    renderDishList();
    renderHistory();
    renderManage();
    if (el.btnSound) {
      el.btnSound.textContent = store.sound ? '🔊' : '🔇';
      el.btnSound.classList.toggle('on', store.sound);
    }
    renderQuality();
  }

  function renderQuality() {
    const label = QUALITY_LEVELS.find((q) => q.id === store.quality)?.name || '高画质';
    if (el.btnQuality) {
      el.btnQuality.classList.toggle('on', store.quality !== 'high');
      el.btnQuality.title = `画质：${label}`;
    }
    if (el.qualityPick) {
      el.qualityPick.replaceChildren(
        ...QUALITY_LEVELS.map((q) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = q.name;
          btn.className = store.quality === q.id ? 'active' : '';
          btn.addEventListener('click', () => {
            actions.click?.();
            store.setQuality(q.id);
            toast(`画质已切换为「${q.name}」`);
          });
          return btn;
        }),
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                             */
  /* ------------------------------------------------------------------ */

  function bind() {
    on(el.btnSpin, 'click', () => {
      actions.click?.();
      actions.spin?.();
    });

    on(el.btnReshuffle, 'click', () => {
      actions.click?.();
      actions.reshuffle?.();
    });

    on(el.btnReset, 'click', () => {
      actions.click?.();
      actions.resetView?.();
      closeMobilePanels();
    });

    on(el.btnHistoryClear, 'click', () => {
      actions.click?.();
      store.clearHistory();
      toast('战绩已清空');
    });

    on(el.btnSound, 'click', () => {
      store.setSound(!store.sound);
      actions.click?.();
      toast(store.sound ? '音效已开启' : '音效已关闭');
    });

    on(el.btnQuality, 'click', () => {
      const order = QUALITY_LEVELS.map((q) => q.id);
      const next = order[(order.indexOf(store.quality) + 1) % order.length];
      actions.click?.();
      store.setQuality(next);
      toast(`画质：${QUALITY_LEVELS.find((q) => q.id === next)?.name}`);
    });

    on(el.btnHelp, 'click', () => {
      actions.click?.();
      openHelp();
    });
    on(el.btnHelpClose, 'click', () => {
      actions.click?.();
      closeHelp();
      store.setSeenHelp(true);
    });

    on(el.btnFullscreen, 'click', () => {
      actions.click?.();
      const doc = document;
      if (!doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
      else doc.exitFullscreen?.().catch(() => {});
    });

    on(el.btnMenuToggle, 'click', () => {
      const open = el.panelMenu?.classList.toggle('open');
      el.panelHistory?.classList.toggle('open', false);
      if (open) actions.click?.();
    });
    on(el.btnHistoryToggle, 'click', () => {
      const open = el.panelHistory?.classList.toggle('open');
      el.panelMenu?.classList.toggle('open', false);
      if (open) actions.click?.();
    });

    on(el.btnAccept, 'click', () => {
      if (resultDish) actions.accept?.(resultDish);
      hideResult();
    });
    on(el.btnAgain, 'click', () => {
      actions.click?.();
      hideResult();
      actions.spin?.();
    });
    on(el.btnBan, 'click', () => {
      if (resultDish) actions.ban?.(resultDish);
      hideResult();
    });
    on(el.btnResultClose, 'click', () => {
      hideResult();
      actions.focusView?.();
    });

    /* ---------------- 加菜 ---------------- */

    on(el.btnAdd, 'click', () => {
      actions.click?.();
      openAdd();
    });
    on(el.btnAddFromPanel, 'click', () => {
      actions.click?.();
      closeMobilePanels();
      openAdd();
    });
    on(el.btnAddClose, 'click', () => {
      actions.click?.();
      closeAdd();
    });
    on(el.btnAddCancel, 'click', () => {
      actions.click?.();
      closeAdd();
    });
    on(el.btnAddSave, 'click', () => saveDraft());

    on(el.photoInput, 'change', async (e) => {
      const file = e.target.files?.[0];
      // 清空 value，否则连续选同一张图不会再触发 change
      e.target.value = '';
      await handlePhotoPick(file);
    });

    on(el.btnPhotoClear, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      releaseDraft();
      draft.removePhoto = !!draft.editingId;
      setPhotoPreview({ url: null });
      addTip('去掉了照片，会给你一张带图标的占位卡');
    });

    on(el.fldName, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveDraft();
      }
    });

    /* ---------------- 菜品管理 / 导入导出 / 分享 ---------------- */

    on(el.btnManageFromPanel, 'click', () => {
      actions.click?.();
      closeMobilePanels();
      openManage();
    });
    on(el.btnManageClose, 'click', () => {
      actions.click?.();
      closeManage();
    });
    on(el.btnManageDone, 'click', () => {
      actions.click?.();
      closeManage();
    });
    on(el.btnManageAdd, 'click', () => {
      actions.click?.();
      closeManage();
      openAdd(null);
    });
    on(el.btnManageImport, 'click', () => {
      actions.click?.();
      el.importInput?.click();
    });
    on(el.importInput, 'change', async (e) => {
      const file = e.target.files?.[0];
      // 清空 value，否则连续选同一个文件不会再触发 change
      e.target.value = '';
      await handleImportFile(file);
    });
    on(el.btnManageExport, 'click', async () => {
      actions.click?.();
      if (el.manageTip) {
        el.manageTip.textContent = '正在打包…';
        el.manageTip.classList.remove('error');
      }
      try {
        await actions.exportDishes?.();
        if (el.manageTip) el.manageTip.textContent = '导出文件已开始下载';
      } catch (err) {
        console.error('[export] 失败', err);
        if (el.manageTip) {
          el.manageTip.textContent = `导出失败：${err?.message || err}`;
          el.manageTip.classList.add('error');
        }
      }
    });
    on(el.btnManageShare, 'click', () => {
      actions.click?.();
      if (el.sharePanel) el.sharePanel.hidden = false;
      renderShareUrl();
    });
    on(el.shareWithPhotos, 'change', () => renderShareUrl());
    on(el.btnShareCopy, 'click', () => copyShareUrl());
    on(el.btnManageClear, 'click', () => {
      actions.click?.();
      if (!el.btnManageClear) return;
      if (!el.btnManageClear.classList.contains('confirm')) {
        el.btnManageClear.classList.add('confirm');
        el.btnManageClear.textContent = '再点一次确认清空';
        clearTimeout(clearTimer);
        clearTimer = setTimeout(resetClearButton, 3200);
        return;
      }
      resetClearButton();
      actions.clearDishes?.();
    });

    /* ---------------- 收到分享链接 ---------------- */

    on(el.btnShareAccept, 'click', () => {
      actions.click?.();
      closeSharePrompt();
      actions.acceptShare?.();
    });
    on(el.btnShareDecline, 'click', () => {
      actions.click?.();
      closeSharePrompt();
      actions.declineShare?.();
    });

    for (const backdrop of document.querySelectorAll('.modal-backdrop')) {
      backdrop.addEventListener('click', () => {
        const which = backdrop.dataset.close;
        if (which === 'help') {
          closeHelp();
          store.setSeenHelp(true);
        } else if (which === 'result') {
          hideResult();
          actions.focusView?.();
        } else if (which === 'add') {
          closeAdd();
        } else if (which === 'manage') {
          closeManage();
        } else if (which === 'share') {
          closeSharePrompt();
          actions.declineShare?.();
        }
      });
    }

    // 点空白处收回手机端抽屉
    on($('scene'), 'pointerdown', () => {
      closeMobilePanels();
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!el.resultModal?.hidden) {
          const dish = resultDish;
          hideResult();
          if (dish) actions.accept?.(dish);
          return;
        }
        if (!el.helpModal?.hidden) {
          closeHelp();
          return;
        }
        if (!el.shareModal?.hidden || !el.manageModal?.hidden) return;
        actions.spin?.();
        return;
      }

      if (e.key === 'Escape') {
        if (!el.addModal?.hidden) closeAdd();
        else if (!el.shareModal?.hidden) {
          closeSharePrompt();
          actions.declineShare?.();
        } else if (!el.helpModal?.hidden) closeHelp();
        else if (!el.manageModal?.hidden) closeManage();
        else if (!el.resultModal?.hidden) hideResult();
        else closeMobilePanels();
        return;
      }

      // 加菜 / 管理 / 分享弹窗打开时不要抢快捷键
      if (!el.addModal?.hidden || !el.manageModal?.hidden || !el.shareModal?.hidden) return;

      const k = e.key.toLowerCase();
      if (k === 'r') actions.resetView?.();
      else if (k === 's') actions.reshuffle?.();
      else if (k === 'h' || e.key === '?') openHelp();
      else if (k === 'f') {
        if (el.fps) el.fps.hidden = !el.fps.hidden;
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const dish = store.visibleDishes[idx];
        if (dish) actions.select?.(idx, dish);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 初始化                                                              */
  /* ------------------------------------------------------------------ */

  bind();
  render();

  return {
    render,
    toast,
    buzz,
    setLoading,
    finishLoading,
    failLoading,
    setSpinBusy,
    setDockNote,
    setActiveDish,
    setFps,
    showResult,
    hideResult,
    openHelp,
    closeHelp,
    openAdd,
    closeAdd,
    addTip,
    openManage,
    closeManage,
    openSharePrompt,
    closeSharePrompt,
    get addOpen() {
      return el.addModal ? !el.addModal.hidden : false;
    },
    get manageOpen() {
      return el.manageModal ? !el.manageModal.hidden : false;
    },
    get shareOpen() {
      return el.shareModal ? !el.shareModal.hidden : false;
    },
    /** 仅供测试：直接塞一张已经压好的图进表单 */
    __setDraftPhoto(blob, previewUrl, accent) {
      releaseDraft();
      draft.blob = blob;
      draft.previewUrl = previewUrl;
      draft.accent = accent;
      setPhotoPreview({ url: previewUrl, meta: `测试图 · 主题色 ${hexCss(accent)}` });
    },
    /** 仅供测试：读取当前表单值 */
    __draft() {
      return {
        ...draft,
        name: el.fldName?.value || '',
        kcal: el.fldKcal?.value || '',
      };
    },
    closeMobilePanels,
    get resultDish() {
      return resultDish;
    },
  };
}
