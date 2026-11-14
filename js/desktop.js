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

  function paintPager(offset) {
    const pager = el('#desk-pager');
    const width = pager.clientWidth || 1;
    const dx = offset || 0;
    pager.querySelector('.home-page').style.transform = 'translateX(' + (-deskPage * width + dx) + 'px)';
    pager.querySelector('.widget-page').style.transform = 'translateX(' + ((1 - deskPage) * width + dx) + 'px)';
  }

  function jumpToDeskPage(index) {
    const pager = el('#desk-pager');
    deskPage = index === 1 ? 1 : 0;
    pager.classList.toggle('show-widgets', deskPage === 1);
    updatePagerDots();
    paintPager(0);

    const home = pager.querySelector('.home-page');
    const widgets = pager.querySelector('.widget-page');
    home.inert = deskPage === 1;
    widgets.inert = deskPage === 0;
    home.setAttribute('aria-hidden', String(deskPage === 1));
    widgets.setAttribute('aria-hidden', String(deskPage === 0));
  }

  function initPager() {
    const pager = el('#desk-pager');
    let gesture = null;
    let suppressClick = false;
    App.showDeskPage = jumpToDeskPage;
    jumpToDeskPage(0);

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
      const atEnd = deskPage === 1 && dx < 0;
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
        if (deskPage === 0 && current.dx < 0) next = 1;
        else if (deskPage === 1 && current.dx > 0) next = 0;
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

  App.initDesktop = function () {
    initPager();

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
