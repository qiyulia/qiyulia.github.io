/* 桌面与联系人 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function greeting(hour) {
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 23) return '晚上好';
    return '夜深了';
  }

  function pickDailyCard() {
    const enabled = App.state.cards.filter(function (c) {
      return c.enabled && c.text && c.category === '聊天';
    });
    if (!enabled.length) return null;
    const now = new Date();
    const key = '' + now.getFullYear() + (now.getMonth() + 1) + now.getDate();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return enabled[hash % enabled.length];
  }

  App.renderDesktop = function () {
    const st = App.state;
    const now = new Date();
    el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    el('#d-date').textContent = App.fmtDate(now);
    el('#d-greeting').textContent = greeting(now.getHours());
    el('#d-days').textContent = App.daysSince(st.profile.since);
    el('#d-since').textContent = st.profile.since ? '自 ' + st.profile.since.replace(/-/g, '.') : '';

    const daily = pickDailyCard();
    el('#d-today-card').textContent = daily ? daily.text : '字卡库空空的，去添几张吧。';

    renderWidgets(now);
    if (App.renderRadioHome) App.renderRadioHome();
    if (App.applyFestivalTheme) App.applyFestivalTheme();
    App.renderContacts();
    App.updateBadges();
  };

  /* ---------- 小组件 ---------- */
  function nextAnniversary(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = new Date(today.getFullYear(), parts[1] - 1, parts[2]);
    if (next < today) next = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2]);
    return {
      days: Math.round((next - today) / 86400000),
      label: (next.getMonth() + 1) + '月' + next.getDate() + '日',
    };
  }

  function renderCalendar(now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    el('#w-month').textContent = year + '年' + (month + 1) + '月';
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<span class="is-outside"></span>';
    for (let day = 1; day <= total; day++) {
      const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const cls = [];
      if (day === now.getDate()) cls.push('is-today');
      if (App.calendarDayClass) {
        const extra = App.calendarDayClass(key);
        if (extra) cls.push(extra);
      }
      html += '<span' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + day + '</span>';
    }
    el('#w-calendar').innerHTML = html;
  }

  function renderWidgets(now) {
    const st = App.state;
    if (el('#w-calendar')) renderCalendar(now);

    if (el('#w-days')) el('#w-days').textContent = App.daysSince(st.profile.since);
    if (el('#w-anniv')) {
      const anniversary = (App.nearestAnniversary && App.nearestAnniversary()) || nextAnniversary(st.profile.since);
      el('#w-anniv').textContent = anniversary
        ? (anniversary.days === 0 ? '就是今天，' + anniversary.label + '快乐。' : '距 ' + anniversary.label + ' 还有 ' + anniversary.days + ' 天')
        : '在设置里写下你们的纪念日。';
    }
    if (el('#w-since')) el('#w-since').textContent = st.profile.since ? '始于 ' + st.profile.since.replace(/-/g, '.') : '';

    App.applyIconStyle();
    if (App.renderMusic) App.renderMusic();
    if (App.renderMemoryWidget) App.renderMemoryWidget();
  }

  /* ---------- 图标美化 ---------- */
  const ICON_COLORS = { blue: '#6b9ed2', lilac: '#a18bc4', sage: '#79a98d', apricot: '#d99b72' };

  App.applyIconStyle = function () {
    const style = App.state.iconStyle;
    const app = el('#app');
    const radius = { rounded: '12px', circle: '50%', square: '5px' }[style.shape];
    app.style.setProperty('--icon-radius', radius);
    app.style.setProperty('--icon-bg', ICON_COLORS[style.color]);
    app.style.setProperty('--icon-fg', '#ffffff');
    const followTheme = !(App.state.settings && App.state.settings.iconsFollowTheme === false);
    app.classList.toggle('icons-follow-theme', followTheme);
    document.querySelectorAll('[data-icon-shape]').forEach(function (btn) {
      const active = btn.dataset.iconShape === style.shape;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-icon-color]').forEach(function (btn) {
      const active = btn.dataset.iconColor === style.color;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };

  App.renderContacts = function () {
    const list = el('#contact-list');
    const empty = el('#contact-empty');
    const contacts = App.state.contacts;

    if (!contacts.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = contacts.map(function (c) {
      const last = App.lastMessage(c.id);
      const unread = App.unread[c.id] || 0;
      const snippet = last
        ? (last.role === 'me' ? '我：' : '') + App.messagePreview(last)
        : (c.note || '还没有聊天记录');
      const isCurrent = c.id === App.state.currentContactId;
      return '<div class="contact-row' + (isCurrent ? ' is-current' : '') + '">' +
        '<button type="button" class="contact-hit" data-open-chat="' + c.id + '">' +
          '<span class="avatar">' + App.avatarHtml(c.avatar) + '</span>' +
          '<span class="contact-info">' +
            '<span class="contact-line"><strong>' + App.esc(c.name) + '</strong>' +
            (isCurrent ? '<span class="current-tag">当前角色</span>' : '') +
            '<span class="contact-time">' + (last ? App.fmtTime(last.ts) : '') + '</span></span>' +
            '<span class="contact-snippet">' + App.esc(snippet) + '</span>' +
          '</span>' +
          (unread ? '<span class="dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
        '</button>' +
        '<button type="button" class="mini-btn contact-edit" data-edit-contact="' + c.id + '" aria-label="编辑联系人">✎</button>' +
        '</div>';
    }).join('');
  };

  /* ---------- 联系人弹窗 ---------- */
  let editingContact = null;
  let dialogAvatar = '';
  const dialog = el('#contact-dialog');
  const form = el('#contact-form');

  function renderDialogAvatar() {
    el('#contact-avatar-preview').innerHTML = App.avatarHtml(dialogAvatar);
  }

  function openContactDialog(contact) {
    editingContact = contact || null;
    el('#contact-dialog-title').textContent = contact ? '编辑角色' : '新建角色';
    el('#contact-name').value = contact ? contact.name : '';
    dialogAvatar = contact ? (contact.avatar || '') : '';
    renderDialogAvatar();
    el('#contact-note').value = contact ? (contact.note || '') : '';
    el('#contact-birthday').value = contact ? (contact.birthday || '') : '';
    const cs = App.contactSettings(contact);
    el('#ct-reply-min').value = cs.replyMin;
    el('#ct-reply-max').value = cs.replyMax;
    el('#ct-typing-min').value = Math.round(Number(cs.replyDelayMinSec) || 0);
    el('#ct-typing-max').value = Math.round(Number(cs.replyDelayMaxSec) || 0);
    el('#ct-pat-back').value = cs.taPatProb;
    el('#ct-sticker').value = cs.taStickerProb;
    el('#ct-like').value = cs.taLikeProb;
    el('#ct-comment').value = cs.taCommentProb;
    el('#ct-moment-cards').value = cs.taMomentCards;
    el('#contact-delete').hidden = !contact;
    dialog.showModal();
    setTimeout(function () { el('#contact-name').focus(); }, 60);
  }
  App.openContactDialog = openContactDialog;

  function saveContact(e) {
    e.preventDefault();
    const name = el('#contact-name').value.trim();
    if (!name) {
      el('#contact-name').focus();
      return;
    }
    const avatar = dialogAvatar || App.DEFAULT_AVATAR;
    const note = el('#contact-note').value.trim();
    const birthday = el('#contact-birthday').value;
    let min = Math.max(0, Math.min(5, Number(el('#ct-reply-min').value) || 0));
    let max = Math.max(0, Math.min(5, Number(el('#ct-reply-max').value) || 0));
    if (max < min) max = min;
    let fast = Math.max(0, Math.min(300, Math.round(Number(el('#ct-typing-min').value) || 0)));
    let slow = Math.max(0, Math.min(300, Math.round(Number(el('#ct-typing-max').value) || 0)));
    if (slow < fast) slow = fast;
    const percent = function (id, fallback) {
      const raw = String(el(id).value || '').trim();
      if (raw === '') return fallback;
      const value = Number(raw);
      if (isNaN(value)) return fallback;
      return Math.max(0, Math.min(100, Math.round(value)));
    };
    const prevSettings = editingContact && editingContact.settings ? editingContact.settings : {};
    const settings = Object.assign({}, prevSettings, {
      replyMin: min,
      replyMax: max,
      replyDelayMinSec: fast,
      replyDelayMaxSec: slow,
      taPatProb: percent('#ct-pat-back', prevSettings.taPatProb != null ? prevSettings.taPatProb : 10),
      taStickerProb: percent('#ct-sticker', prevSettings.taStickerProb != null ? prevSettings.taStickerProb : 30),
      taLikeProb: percent('#ct-like', prevSettings.taLikeProb != null ? prevSettings.taLikeProb : 60),
      taCommentProb: percent('#ct-comment', prevSettings.taCommentProb != null ? prevSettings.taCommentProb : 40),
      taMomentCards: Math.max(1, Math.min(3, Number(el('#ct-moment-cards').value) || 1)),
    });

    if (editingContact) {
      editingContact.name = name;
      editingContact.avatar = avatar;
      editingContact.note = note;
      editingContact.birthday = birthday;
      editingContact.settings = settings;
    } else {
      const contact = { id: App.uid('c'), name: name, avatar: avatar, note: note, birthday: birthday, settings: settings };
      App.state.contacts.push(contact);
      App.state.chats[contact.id] = [];
      App.state.currentContactId = contact.id;
    }

    App.save();
    dialog.close();
    App.renderAll();
    App.toast(editingContact ? '已更新联系人' : '已添加联系人');
    editingContact = null;
  }

  function deleteContact() {
    if (!editingContact) return;
    const contact = editingContact;
    const id = contact.id;
    App.confirmDialog('删除「' + contact.name + '」和这段对话？此操作不可撤销。', { title: '删除联系人', okText: '删除' }).then(function (ok) {
      if (!ok) return;
      App.state.contacts = App.state.contacts.filter(function (c) { return c.id !== id; });
      delete App.state.chats[id];
      delete App.unread[id];
      if (App.chatContactId === id) App.chatContactId = null;
      if (App.state.currentContactId === id) {
        App.state.currentContactId = App.state.contacts.length ? App.state.contacts[0].id : null;
      }
      App.save();
      dialog.close();
      editingContact = null;
      App.renderAll();
      App.toast('已删除联系人');
    });
  }

  let deskPage = 0;
  let notesTimer = null;

  function updatePagerDots() {
    document.querySelectorAll('[data-desk-page]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.deskPage) === deskPage);
    });
  }

  function deskPages() {
    const pager = el('#desk-pager');
    return ['.home-page', '.fav-page', '.widget-page'].map(function (sel) {
      return pager.querySelector(sel);
    }).filter(Boolean);
  }

  function paintPager(offset) {
    const pages = deskPages();
    const width = el('#desk-pager').clientWidth || 1;
    const dx = offset || 0;
    pages.forEach(function (page, i) {
      page.style.transform = 'translateX(' + ((i - deskPage) * width + dx) + 'px)';
      page.style.pointerEvents = i === deskPage ? 'auto' : 'none';
    });
  }

  function jumpToDeskPage(index) {
    const pages = deskPages();
    deskPage = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
    updatePagerDots();
    paintPager(0);
    pages.forEach(function (page, i) {
      page.inert = i !== deskPage;
      page.setAttribute('aria-hidden', String(i !== deskPage));
    });
  }

  function initPager() {
    const pager = el('#desk-pager');
    let gesture = null;
    let suppressClick = false;
    App.showDeskPage = jumpToDeskPage;
    jumpToDeskPage(0);
    /* 首帧定位完成后再打开过渡，刷新时不会看到页面滑走 */
    requestAnimationFrame(function () { pager.classList.add('is-ready'); });

    function updateGesture(x, y) {
      if (!gesture) return false;
      if (appDrag) return false;
      const dx = x - gesture.x;
      const dy = y - gesture.y;
      gesture.dx = dx;

      if (!gesture.decided && Math.max(Math.abs(dx), Math.abs(dy)) > 4) {
        gesture.decided = true;
        gesture.horizontal = Math.abs(dx) > Math.abs(dy);
        if (gesture.horizontal) pager.classList.add('is-dragging');
      }
      if (!gesture.horizontal) return false;

      const atStart = deskPage === 0 && dx > 0;
      const atEnd = deskPage === deskPages().length - 1 && dx < 0;
      paintPager(atStart || atEnd ? dx * 0.22 : dx);
      return true;
    }

    pager.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('textarea, input, select')) return;
      gesture = {
        id: e.pointerId,
        touchId: null,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        horizontal: false,
        decided: false,
      };
    });

    pager.addEventListener('pointermove', function (e) {
      if (!gesture || gesture.id !== e.pointerId) return;
      const wasHorizontal = gesture.horizontal;
      if (!updateGesture(e.clientX, e.clientY)) return;
      if (!wasHorizontal) pager.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    /* 手机浏览器会在斜向拖动时抢占 Pointer 手势并取消它。
       触摸单独用可取消的 touchmove 锁定横向跟手，纵向仍交给原生滚动。 */
    pager.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      if (e.target.closest('textarea, input, select')) return;
      const touch = e.touches[0];
      gesture = {
        id: 'touch-' + touch.identifier,
        touchId: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        dx: 0,
        horizontal: false,
        decided: false,
      };
    }, { passive: true });

    pager.addEventListener('touchmove', function (e) {
      if (!gesture || gesture.touchId === null) return;
      const touch = Array.from(e.touches).find(function (item) {
        return item.identifier === gesture.touchId;
      });
      if (!touch) return;
      if (updateGesture(touch.clientX, touch.clientY)) e.preventDefault();
    }, { passive: false });

    function finishGesture(e, cancelled) {
      if (!gesture || gesture.id !== e.pointerId) return;
      if (appDrag) { gesture = null; return; }
      const current = gesture;
      gesture = null;
      if (!current.horizontal) return;

      pager.classList.remove('is-dragging');
      let next = deskPage;
      if (!cancelled && Math.abs(current.dx) >= 40) {
        if (current.dx < 0) next = deskPage + 1;
        else if (current.dx > 0) next = deskPage - 1;
      }
      jumpToDeskPage(next);
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 300);
    }

    function finishTouch(e, cancelled) {
      if (!gesture || gesture.touchId === null) return;
      const ended = Array.from(e.changedTouches).some(function (touch) {
        return touch.identifier === gesture.touchId;
      });
      if (ended) finishGesture({ pointerId: gesture.id }, cancelled);
    }

    pager.addEventListener('pointerup', function (e) { finishGesture(e, false); });
    pager.addEventListener('pointercancel', function (e) { finishGesture(e, true); });
    pager.addEventListener('touchend', function (e) { finishTouch(e, false); });
    pager.addEventListener('touchcancel', function (e) { finishTouch(e, true); });
    pager.addEventListener('click', function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    window.addEventListener('resize', function () {
      if (!gesture || !gesture.horizontal) paintPager(0);
    });
  }

  /* ---------------- 主界面应用图标：长按拖动，跨页自动对齐 ---------------- */
  let appDrag = null;
  let appEdgeTimer = null;
  let appEdgeDir = 0;

  function appGrids() {
    return ['.home-page', '.fav-page'].map(function (sel) {
      const page = document.querySelector('#desk-pager ' + sel);
      return page ? page.querySelector('.app-grid') : null;
    }).filter(Boolean);
  }

  /* 只有带应用网格的页面才能拖动摆放，小组件页不参与 */
  function appPageIndexes() {
    return deskPages().map(function (page, index) {
      return page.querySelector('.app-grid') ? index : -1;
    }).filter(function (index) { return index >= 0; });
  }

  function appKeyOf(entry) {
    if (entry.dataset.appKey) return entry.dataset.appKey;
    if (entry.hasAttribute('data-open-current-chat')) return 'chat';
    return entry.dataset.go || String(entry.textContent || '').trim();
  }

  const DESK_APPS_KEY = 'shiyi.deskApps.v1';

  function readDeskAppsLayout() {
    if (Array.isArray(App.state.deskApps)) return App.state.deskApps;
    try {
      const raw = JSON.parse(localStorage.getItem(DESK_APPS_KEY) || 'null');
      return Array.isArray(raw) ? raw : null;
    } catch (err) {
      return null;
    }
  }

  function applyDeskAppsLayout() {
    const saved = readDeskAppsLayout();
    if (!Array.isArray(saved)) return;
    const grids = appGrids();
    const entries = Array.from(document.querySelectorAll('#desk-pager .app-entry'));
    const map = {};
    entries.forEach(function (entry) { map[appKeyOf(entry)] = entry; });
    grids.forEach(function (grid, gi) {
      const keys = Array.isArray(saved[gi]) ? saved[gi] : [];
      keys.forEach(function (key) {
        /* 逐个 appendChild，既跨页也恢复同页内的顺序 */
        if (map[key]) grid.appendChild(map[key]);
      });
    });
  }

  function saveDeskAppsLayout() {
    const layout = appGrids().map(function (grid) {
      return Array.from(grid.querySelectorAll('.app-entry')).map(appKeyOf);
    });
    App.state.deskApps = layout;
    try {
      localStorage.setItem(DESK_APPS_KEY, JSON.stringify(layout));
    } catch (err) { /* 忽略存储失败 */ }
    App.save();
    if (App.flushSave) App.flushSave();
  }

  function appInsertIndex(grid, x, y, entry) {
    const items = Array.from(grid.querySelectorAll('.app-entry')).filter(function (node) {
      return node !== entry;
    });
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      if (y < rect.top) return i;
      if (y <= rect.bottom && x < cx) return i;
    }
    return items.length;
  }

  /* ---------- 拖动时的布局动画 ----------
     直接 insertBefore 会让图标瞬间换位，这里先量旧位置，
     插入后用 transform 从旧位置滑到新位置，邻座图标就有了让位动画。 */
  function measureEntries(grids, exclude) {
    const rects = new Map();
    grids.forEach(function (grid) {
      Array.from(grid.querySelectorAll('.app-entry')).forEach(function (node) {
        if (node === exclude) return;
        rects.set(node, node.getBoundingClientRect());
      });
    });
    return rects;
  }

  function playEntryReflow(rects, exclude) {
    rects.forEach(function (prev, node) {
      if (node === exclude || !node.isConnected) return;
      const next = node.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      node.style.transition = 'none';
      node.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      void node.offsetWidth;
      node.style.transition = '';
      node.style.transform = '';
    });
  }

  function cancelAppEdgeSwitch() {
    if (appEdgeTimer) clearTimeout(appEdgeTimer);
    appEdgeTimer = null;
    appEdgeDir = 0;
  }

  function requestAppEdgeSwitch(dir) {
    if (!appDrag || dir === appEdgeDir) return;
    cancelAppEdgeSwitch();
    const indexes = appPageIndexes();
    const pos = indexes.indexOf(deskPage);
    if (pos === -1) return;
    const target = indexes[pos + dir];
    if (target == null) return;
    appEdgeDir = dir;
    appEdgeTimer = setTimeout(function () {
      appEdgeTimer = null;
      appEdgeDir = 0;
      if (!appDrag) return;
      jumpToDeskPage(target);
      /* 翻页动画结束后再按落点摆一次，避免停在半路时插不进去 */
      setTimeout(function () {
        if (appDrag) moveAppDragAt(appDrag.lastX, appDrag.lastY);
      }, 240);
    }, 300);
  }

  function moveAppDragAt(x, y) {
    if (!appDrag) return;
    appDrag.lastX = x;
    appDrag.lastY = y;
    const ghost = appDrag.ghost;
    ghost.style.transform = 'translate3d(' + (x - appDrag.dx) + 'px,' + (y - appDrag.dy) + 'px,0) scale(1.06)';

    const grids = appGrids();
    let grid = null;
    grids.forEach(function (item) {
      const rect = item.getBoundingClientRect();
      if (x >= rect.left - 16 && x <= rect.right + 16 && y >= rect.top - 48 && y <= rect.bottom + 48) {
        grid = item;
      }
    });

    if (grid) {
      const index = appInsertIndex(grid, x, y, appDrag.entry);
      const items = Array.from(grid.querySelectorAll('.app-entry')).filter(function (node) {
        return node !== appDrag.entry;
      });
      const next = items[index] || null;
      /* 只有真的换位时才插入，避免每一帧都触发重排 */
      if (appDrag.entry.parentNode !== grid || appDrag.entry.nextElementSibling !== next) {
        const before = measureEntries(grids, appDrag.entry);
        grid.insertBefore(appDrag.entry, next);
        playEntryReflow(before, appDrag.entry);
      }
    }

    /* 拖到屏幕边缘：先轻轻带出相邻页，再平滑翻过去 */
    const pager = el('#desk-pager');
    if (!pager) return;
    const rect = pager.getBoundingClientRect();
    const inY = y >= rect.top && y <= rect.bottom;
    const indexes = appPageIndexes();
    const pos = indexes.indexOf(deskPage);
    const canPrev = pos > 0;
    const canNext = pos >= 0 && pos < indexes.length - 1;
    if (inY && canPrev && x < rect.left + 56) {
      requestAppEdgeSwitch(-1);
      paintPager(-22);
    } else if (inY && canNext && x > rect.right - 56) {
      requestAppEdgeSwitch(1);
      paintPager(22);
    } else {
      cancelAppEdgeSwitch();
      paintPager(0);
    }
  }

  /* 触摸/指针事件可能一帧触发多次，用 rAF 合并成一次 DOM 更新 */
  function queueAppDrag(x, y) {
    if (!appDrag) return;
    appDrag.lastX = x;
    appDrag.lastY = y;
    if (appDrag.raf) return;
    appDrag.raf = requestAnimationFrame(function () {
      if (!appDrag) return;
      appDrag.raf = 0;
      moveAppDragAt(appDrag.lastX, appDrag.lastY);
    });
  }

  function beginAppDrag(entry, x, y) {
    const rect = entry.getBoundingClientRect();
    if (!rect.width) return;
    const ghost = entry.cloneNode(true);
    ghost.classList.add('app-drag-ghost');
    ghost.removeAttribute('data-open-current-chat');
    ghost.style.width = rect.width + 'px';
    /* 放进应用内，拖动时才能继承当前主题的图标颜色和圆角 */
    (document.getElementById('app') || document.body).appendChild(ghost);
    entry.classList.add('is-drag-source');
    appDrag = {
      entry: entry,
      ghost: ghost,
      dx: x - rect.left,
      dy: y - rect.top,
      lastX: x,
      lastY: y,
      raf: 0,
      touchMove: null,
    };
    const pager = el('#desk-pager');
    if (pager) pager.classList.add('is-app-dragging');
    moveAppDragAt(x, y);
    appDrag.touchMove = function (ev) { ev.preventDefault(); };
    document.addEventListener('touchmove', appDrag.touchMove, { passive: false });
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* 忽略 */ } }
    blockAppClick();
  }

  function blockAppClick() {
    const blocker = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      document.removeEventListener('click', blocker, true);
    };
    document.addEventListener('click', blocker, true);
    setTimeout(function () {
      document.removeEventListener('click', blocker, true);
    }, 700);
  }

  function endAppDrag() {
    if (!appDrag) return;
    const entry = appDrag.entry;
    const ghost = appDrag.ghost;
    const dropX = appDrag.lastX;
    const dropY = appDrag.lastY;
    if (appDrag.raf) cancelAnimationFrame(appDrag.raf);
    if (appDrag.touchMove) document.removeEventListener('touchmove', appDrag.touchMove);
    cancelAppEdgeSwitch();
    const pager = el('#desk-pager');
    if (pager) pager.classList.remove('is-app-dragging');
    /* 松手时按当前翻到的那一页再放一次，避免翻页动画中途松手落到旧页 */
    const pages = deskPages();
    const page = pages[Math.min(deskPage, pages.length - 1)];
    const grid = page ? page.querySelector('.app-grid') : null;
    if (grid) {
      const index = appInsertIndex(grid, dropX, dropY, entry);
      const items = Array.from(grid.querySelectorAll('.app-entry')).filter(function (node) {
        return node !== entry;
      });
      const next = items[index] || null;
      if (entry.parentNode !== grid || entry.nextElementSibling !== next) {
        const grids = appGrids();
        const before = measureEntries(grids, entry);
        grid.insertBefore(entry, next);
        playEntryReflow(before, entry);
      }
    }
    /* 先把最终布局存好，动画只是视觉收尾 */
    saveDeskAppsLayout();
    blockAppClick();

    const rect = entry.getBoundingClientRect();
    appDrag = null;
    ghost.style.transition = 'transform .22s cubic-bezier(.22,.8,.28,1)';
    ghost.style.transform = 'translate3d(' + rect.left + 'px,' + rect.top + 'px,0) scale(1)';
    let done = false;
    const finish = function () {
      if (done) return;
      done = true;
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      /* 极快地在同一图标上再次长按时，不要干扰新的拖动 */
      if (!appDrag || appDrag.entry !== entry) {
        entry.classList.remove('is-drag-source');
        entry.classList.add('is-drop-in');
        setTimeout(function () { entry.classList.remove('is-drop-in'); }, 240);
      }
    };
    ghost.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 280);
  }

  function initAppDrag() {
    applyDeskAppsLayout();
    const entries = Array.from(document.querySelectorAll('#desk-pager .app-entry'));

    function arm(entry, x, y, delay) {
      let timer = setTimeout(function () {
        timer = null;
        beginAppDrag(entry, x, y);
      }, delay);
      return {
        pending: function () { return !!timer; },
        cancel: function () {
          if (!timer) return;
          clearTimeout(timer);
          timer = null;
        },
      };
    }

    function touchById(list, id) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    }

    /* 触摸单独处理：部分浏览器（如夸克）长按后会取消 Pointer 手势，
       导致拖到一半的图标弹回原位，这里改用 touch 事件保证拖动完整 */
    function bindTouch(entry) {
      entry.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1 || appDrag) return;
        const start = e.touches[0];
        const touchId = start.identifier;
        const press = arm(entry, start.clientX, start.clientY, 300);

        function onMove(ev) {
          const touch = touchById(ev.touches, touchId);
          if (!touch) return;
          if (appDrag && appDrag.entry === entry) {
            ev.preventDefault();
            queueAppDrag(touch.clientX, touch.clientY);
            return;
          }
          /* 还没长按就开始滑动，交给翻页手势 */
          if (press.pending() && (Math.abs(touch.clientX - start.clientX) > 8 || Math.abs(touch.clientY - start.clientY) > 8)) {
            cleanup(false);
          }
        }

        function onEnd(ev) {
          const ended = !ev.touches.length || !!touchById(ev.changedTouches || [], touchId);
          if (!ended) return;
          cleanup(!!appDrag && appDrag.entry === entry);
        }

        function cleanup(drop) {
          press.cancel();
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
          document.removeEventListener('touchcancel', onEnd);
          if (drop) endAppDrag();
        }

        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
      }, { passive: true });
    }

    entries.forEach(function (entry) {
      bindTouch(entry);

      entry.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (appDrag) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const pointerId = e.pointerId;
        const press = arm(entry, startX, startY, e.pointerType === 'mouse' ? 200 : 300);

        function onMove(ev) {
          if (ev.pointerId !== pointerId) return;
          if (appDrag && appDrag.entry === entry) {
            ev.preventDefault();
            queueAppDrag(ev.clientX, ev.clientY);
            return;
          }
          /* 还没长按就开始滑动，交给翻页手势 */
          if (press.pending() && (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8)) {
            cleanup();
          }
        }

        function onUp(ev) {
          if (ev.pointerId !== pointerId) return;
          cleanup();
          if (appDrag && appDrag.entry === entry) endAppDrag();
        }

        function cleanup() {
          press.cancel();
          document.removeEventListener('pointermove', onMove, true);
          document.removeEventListener('pointerup', onUp, true);
          document.removeEventListener('pointercancel', onUp, true);
        }

        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onUp, true);
      });

      /* 长按图标时不要弹出夸克/系统的长按菜单，否则手势会被系统抢走 */
      entry.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      entry.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  }

  /* ---------------- 收藏应用：聊天 / 朋友圈 / 信 / 商品 ---------------- */
  let favCat = 'chat';
  let favSelectMode = false;
  let favPicked = {};

  function favKey(item) {
    if (item.kind === 'chat') return 'chat:' + item.cid + ':' + item.mid;
    if (item.kind === 'moments') return 'moments:' + item.mid;
    if (item.kind === 'mail') return 'mail:' + item.mid;
    return 'market:' + item.pid;
  }

  function favItems() {
    const items = [];
    const contacts = App.state.contacts || [];
    const nameOf = function (cid) {
      const c = contacts.find(function (x) { return x.id === cid; });
      return c ? c.name : 'TA';
    };
    if (favCat === 'chat') {
      Object.keys(App.state.chats || {}).forEach(function (cid) {
        (App.state.chats[cid] || []).forEach(function (m) {
          if (!m.favMine && !m.favTa) return;
          const who = [];
          if (m.favMine) who.push('我');
          if (m.favTa) who.push(nameOf(cid));
          items.push({
            kind: 'chat',
            cid: cid,
            mid: m.id,
            ts: m.ts || 0,
            title: m.text || m.title || m.question || (m.src ? '[语音]' : (m.sticker ? '[表情包]' : '[卡片消息]')),
            who: who.join('、') + '收藏了',
            from: '和 ' + nameOf(cid) + ' 的聊天',
          });
        });
      });
    } else if (favCat === 'moments') {
      (App.state.moments || []).forEach(function (m) {
        if (!m.fav && !m.favTa) return;
        const who = [];
        if (m.fav) who.push('我');
        if (m.favTa) who.push(m.favTaName || 'TA');
        items.push({
          kind: 'moments',
          mid: m.id,
          ts: m.ts || 0,
          title: m.text || '[图片动态]',
          who: who.join('、') + '收藏了',
          from: '朋友圈',
        });
      });
    } else if (favCat === 'mail') {
      (App.state.mail || []).forEach(function (m) {
        if (!m.fav) return;
        items.push({
          kind: 'mail',
          mid: m.id,
          ts: m.ts || 0,
          title: m.title || '一封信',
          who: '我收藏了',
          from: String(m.body || '').slice(0, 40),
        });
      });
    } else if (favCat === 'market') {
      const products = (App.state.market && App.state.market.products) || [];
      products.forEach(function (p) {
        if (!p.fav || (!p.fav.me && !p.fav.ta)) return;
        const who = [];
        if (p.fav.me) who.push('我');
        if (p.fav.ta) who.push('TA');
        items.push({
          kind: 'market',
          pid: p.id,
          ts: 0,
          title: (p.icon ? p.icon + ' ' : '') + p.name,
          who: who.join('、') + '收藏了',
          from: '集市 · ' + p.price + ' 同心币',
        });
      });
    }
    return items.sort(function (a, b) { return b.ts - a.ts; });
  }

  /* 取消一条收藏（只去掉收藏标记，不删原来的消息和信件） */
  function dropFav(item) {
    if (item.kind === 'chat') {
      (App.state.chats[item.cid] || []).forEach(function (m) {
        if (m.id !== item.mid) return;
        m.favMine = false;
        m.favTa = false;
      });
    } else if (item.kind === 'moments') {
      const m = (App.state.moments || []).find(function (x) { return x.id === item.mid; });
      if (m) { m.fav = false; m.favTa = false; }
    } else if (item.kind === 'mail') {
      const m = (App.state.mail || []).find(function (x) { return x.id === item.mid; });
      if (m) m.fav = false;
    } else if (item.kind === 'market') {
      const p = ((App.state.market && App.state.market.products) || []).find(function (x) { return x.id === item.pid; });
      if (p) p.fav = { me: false, ta: false };
    }
  }

  function removeFavorites(list) {
    if (!list.length) return;
    list.forEach(dropFav);
    App.save();
    favPicked = {};
    favSelectMode = false;
    App.renderFavorites();
    if (App.toast) App.toast(list.length > 1 ? '已删除 ' + list.length + ' 条收藏' : '已删除这条收藏');
  }

  App.renderFavorites = function () {
    const list = el('#fav-list');
    if (!list) return;
    document.querySelectorAll('[data-fav-cat]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.favCat === favCat);
    });
    const items = favItems();
    if (!items.length) favSelectMode = false;
    if (!items.length) favPicked = {};

    const toggle = el('#fav-select-toggle');
    const bulk = el('#fav-delete-selected');
    const pickedCount = Object.keys(favPicked).length;
    if (toggle) {
      toggle.textContent = favSelectMode ? '取消' : '多选';
      toggle.hidden = false;
      toggle.classList.toggle('is-active', favSelectMode);
    }
    if (bulk) {
      bulk.hidden = !favSelectMode;
      bulk.disabled = pickedCount === 0;
      bulk.textContent = pickedCount ? '删除(' + pickedCount + ')' : '删除';
    }

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>这一类还没有收藏。</p><p class="panel-note">聊天里长按消息、朋友圈点 ☆、信箱和集市里都能收藏。</p></div>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      const key = favKey(item);
      const picked = !!favPicked[key];
      return '<article class="fav-item' + (favSelectMode ? ' is-select' : '') + (picked ? ' is-picked' : '') + '" data-fav-key="' + App.esc(key) + '">' +
        (favSelectMode ? '<span class="fav-check" aria-hidden="true">' + (picked ? '✓' : '') + '</span>' : '') +
        '<div class="fav-item-body">' +
          '<p class="fav-item-text">' + App.esc(item.title) + '</p>' +
          '<div class="fav-item-foot"><span class="fav-item-from">' + App.esc(item.from) + '</span>' +
          '<span class="fav-item-who">★ ' + App.esc(item.who) + '</span></div>' +
          (item.ts ? '<time class="fav-item-time">' + App.fmtDate(new Date(item.ts)) + '</time>' : '') +
        '</div>' +
        '<button type="button" class="fav-del" data-fav-del="' + App.esc(key) + '" aria-label="删除这条收藏">删除</button>' +
      '</article>';
    }).join('');
  };

  App.resetFavSelect = function () {
    favSelectMode = false;
    favPicked = {};
  };

  App.initDesktop = function () {
    initPager();
    initAppDrag();
    document.querySelectorAll('[data-fav-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        favCat = btn.dataset.favCat || 'chat';
        favSelectMode = false;
        favPicked = {};
        App.renderFavorites();
      });
    });

    const favToggle = el('#fav-select-toggle');
    if (favToggle) {
      favToggle.addEventListener('click', function () {
        favSelectMode = !favSelectMode;
        favPicked = {};
        App.renderFavorites();
      });
    }
    const favBulk = el('#fav-delete-selected');
    if (favBulk) {
      favBulk.addEventListener('click', function () {
        const picked = favItems().filter(function (item) { return favPicked[favKey(item)]; });
        removeFavorites(picked);
      });
    }
    const favList = el('#fav-list');
    if (favList) {
      favList.addEventListener('click', function (e) {
        const del = e.target.closest('[data-fav-del]');
        if (del) {
          const key = del.dataset.favDel;
          const item = favItems().find(function (x) { return favKey(x) === key; });
          if (item) removeFavorites([item]);
          return;
        }
        if (!favSelectMode) return;
        const row = e.target.closest('[data-fav-key]');
        if (!row) return;
        const key = row.dataset.favKey;
        if (favPicked[key]) delete favPicked[key];
        else favPicked[key] = true;
        App.renderFavorites();
      });
    }

    document.querySelectorAll('[data-icon-shape]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.state.iconStyle.shape = btn.dataset.iconShape;
        App.save();
        App.applyIconStyle();
      });
    });
    document.querySelectorAll('[data-icon-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.state.iconStyle.color = btn.dataset.iconColor;
        App.save();
        App.applyIconStyle();
      });
    });

    setInterval(function () {
      const now = new Date();
      el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }, 1000 * 20);

    el('#btn-add-contact').addEventListener('click', function () { openContactDialog(null); });
    el('#btn-add-contact-2').addEventListener('click', function () { openContactDialog(null); });
    form.addEventListener('submit', saveContact);
    el('#contact-delete').addEventListener('click', deleteContact);

    el('#btn-contact-avatar').addEventListener('click', function () {
      el('#contact-avatar-file').click();
    });
    el('#contact-avatar-file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      App.compressImage(file, 192).then(function (src) {
        dialogAvatar = src;
        renderDialogAvatar();
      }).catch(function (err) {
        App.toast(err.message || '图片读取失败');
      });
    });

    // 角色弹窗里的数字/概率：手动输入或 −/+ 微调，保存时统一读取
    const noop = function () {};
    App.bindStepper('#ct-typing-min', noop, { min: 0, max: 300, step: 1, decimals: 0 });
    App.bindStepper('#ct-typing-max', noop, { min: 0, max: 300, step: 1, decimals: 0 });
    App.bindStepper('#ct-pat-back', noop);
    App.bindStepper('#ct-sticker', noop);
    App.bindStepper('#ct-like', noop);
    App.bindStepper('#ct-comment', noop);
    App.bindStepper('#ct-moment-cards', noop, { min: 1, max: 3, step: 1 });

    document.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit-contact]');
      if (edit) {
        const contact = App.state.contacts.find(function (c) { return c.id === edit.dataset.editContact; });
        if (contact) openContactDialog(contact);
        return;
      }
      const current = e.target.closest('[data-open-current-chat]');
      if (current) {
        App.openCurrentChat();
        return;
      }
      const person = e.target.closest('[data-open-chat]');
      if (person) {
        App.openChat(person.dataset.openChat);
        return;
      }
      const add = e.target.closest('[data-add-contact]');
      if (add) openContactDialog(null);
    });
  };
})();
