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
    renderCalendar(now);

    el('#w-days').textContent = App.daysSince(st.profile.since);
    const anniversary = (App.nearestAnniversary && App.nearestAnniversary()) || nextAnniversary(st.profile.since);
    el('#w-anniv').textContent = anniversary
      ? (anniversary.days === 0 ? '就是今天，' + anniversary.label + '快乐。' : '距 ' + anniversary.label + ' 还有 ' + anniversary.days + ' 天')
      : '在设置里写下你们的纪念日。';
    el('#w-since').textContent = st.profile.since ? '始于 ' + st.profile.since.replace(/-/g, '.') : '';

    App.applyIconStyle();
    if (App.renderMusic) App.renderMusic();
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
    el('#ct-typing').value = cs.typingMin;
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
    const settings = {
      replyMin: min,
      replyMax: max,
      typingMin: Math.max(0, Math.min(5, Number(el('#ct-typing').value) || 0.1)),
      taPatProb: Number(el('#ct-pat-back').value) || 0,
      taStickerProb: Math.max(0, Math.min(100, Number(el('#ct-sticker').value) || 0)),
      taLikeProb: Number(el('#ct-like').value) || 0,
      taCommentProb: Number(el('#ct-comment').value) || 0,
      taMomentCards: Math.max(1, Math.min(3, Number(el('#ct-moment-cards').value) || 1)),
    };

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
    if (!confirm('删除「' + editingContact.name + '」和这段对话？此操作不可撤销。')) return;
    const id = editingContact.id;
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
      const dx = x - gesture.x;
      const dy = y - gesture.y;
      gesture.dx = dx;

      if (!gesture.decided && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
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
      const current = gesture;
      gesture = null;
      if (!current.horizontal) return;

      pager.classList.remove('is-dragging');
      let next = deskPage;
      if (!cancelled && Math.abs(current.dx) >= 55) {
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
    App.bindStepper('#ct-typing', noop, { min: 0, max: 5, step: 0.1, decimals: 1 });
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
