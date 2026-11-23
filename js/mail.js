/* 信箱：我和 TA 用字卡互相写信 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  let currentMailId = null;
  /* 打字编辑器有两种模式：'new' = 在「我的信」里写一封新信；'reply' = 回信（带原信引用） */
  let editorMode = 'new';
  let editorContactId = null;
  let replyMailId = null;
  let mailTab = 'ta';

  function contactOf(id) {
    return (App.state.contacts || []).find(function (c) { return c.id === id; }) || null;
  }

  function fallbackContact() {
    const st = App.state;
    return contactOf(st.currentContactId) || st.contacts[0] || null;
  }

  function mailList() {
    if (!Array.isArray(App.state.mail)) App.state.mail = [];
    return App.state.mail;
  }

  function mailCards() {
    return (App.state.cards || []).filter(function (c) {
      return c.enabled !== false && c.text && c.category !== '拍一拍' && c.category !== '默契问答' && c.category !== '地点';
    });
  }

  function clampCount(value, fallback) {
    const n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.max(0, Math.min(15, Math.round(n)));
  }

  /* TA 写信时从字卡库随机取 0~15 条拼成一封 */
  function composeTaMail() {
    const st = App.state.settings || {};
    let min = st.mailCardMin == null ? 1 : clampCount(st.mailCardMin, 1);
    let max = st.mailCardMax == null ? 3 : clampCount(st.mailCardMax, 3);
    if (max < min) { const tmp = min; min = max; max = tmp; }
    const count = min + Math.floor(Math.random() * (max - min + 1));
    const pool = mailCards();
    const picked = [];
    const copy = pool.slice();
    while (picked.length < count && copy.length) {
      const index = Math.floor(Math.random() * copy.length);
      const card = copy.splice(index, 1)[0];
      if (card && card.text) picked.push(card);
    }
    if (!picked.length) {
      const lines = [
        '今天没什么事，就是忽然想给你写封信。',
        '窗外的风很好，想让你也看看。',
        '不知道你那边天气怎么样，记得照顾好自己。',
      ];
      return { text: lines[Math.floor(Math.random() * lines.length)], cardIds: [] };
    }
    return {
      text: picked.map(function (c) { return c.text; }).join('\n'),
      cardIds: picked.map(function (c) { return c.id; }),
    };
  }

  App.updateMailBadge = function () {
    const badge = document.getElementById('d-badge-mail');
    if (!badge) return;
    const unread = mailList().filter(function (m) {
      return m.from === 'ta' && !m.read;
    }).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  };

  function senderName(mail) {
    if (mail.from === 'me') return App.state.profile.userName || '我';
    const contact = contactOf(mail.contactId);
    return contact ? contact.name : 'TA';
  }

  function senderAvatar(mail) {
    if (mail.from === 'me') return App.state.profile.userAvatar || App.DEFAULT_AVATAR;
    const contact = contactOf(mail.contactId);
    return contact ? contact.avatar : App.DEFAULT_AVATAR;
  }

  function mailTime(ts) {
    const now = new Date();
    const date = new Date(ts);
    if (date.toDateString() === now.toDateString()) return App.fmtTime(ts);
    return App.fmtDate(date) + ' ' + App.fmtTime(ts);
  }

  function renderList() {
    const all = mailList().slice().sort(function (a, b) { return b.ts - a.ts; });
    const items = all.filter(function (m) {
      if (mailTab === 'replies') return !!m.replyTo;
      if (m.replyTo) return false;
      return mailTab === 'mine' ? m.from === 'me' : m.from === 'ta';
    });
    const unread = all.filter(function (m) { return m.from === 'ta' && !m.read; }).length;
    const tabText = {
      ta: items.length ? '共 ' + items.length + ' 封' + (unread ? ' · ' + unread + ' 封未读' : '') : '还没有他的来信',
      mine: items.length ? '共 ' + items.length + ' 封' : '还没写过信',
      replies: items.length ? '共 ' + items.length + ' 封回信' : '还没有回信',
    };
    el('#mail-summary').textContent = tabText[mailTab] || '';
    const readAllBtn = el('#btn-mail-read-all');
    if (readAllBtn) readAllBtn.hidden = unread === 0;
    el('#mail-empty-text').textContent = mailTab === 'ta'
      ? 'TA 还没有寄信来，再等等吧。'
      : (mailTab === 'replies'
        ? '你和他回过的信都会收在这里。'
        : '在我的信里写一封给 TA，TA 会回信的。');
    el('#mail-empty').hidden = items.length > 0;
    const emptyCompose = el('#btn-mail-compose-2');
    if (emptyCompose) emptyCompose.hidden = mailTab !== 'mine';
    const composeWrap = el('#mail-compose-wrap');
    if (composeWrap) composeWrap.hidden = mailTab !== 'mine' || items.length === 0;
    document.querySelectorAll('[data-mail-tab]').forEach(function (btn) {
      const on = btn.dataset.mailTab === mailTab;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', String(on));
    });

    el('#mail-list').innerHTML = items.map(function (m) {
      const mine = m.from === 'me';
      const name = senderName(m);
      const line = String(m.text || '').split('\n')[0];
      return '<button type="button" class="mail-item' + (mine ? '' : ' from-ta') + (!mine && !m.read ? ' is-unread' : '') + '" data-mail-id="' + App.esc(m.id) + '">' +
        '<span class="mail-item-avatar avatar">' + App.avatarHtml(senderAvatar(m)) + '</span>' +
        '<span class="mail-item-main">' +
          '<span class="mail-item-head"><strong>' + App.esc(mine ? '寄给 ' + (contactOf(m.contactId) ? contactOf(m.contactId).name : 'TA') : name) + '</strong>' +
            '<time>' + App.esc(mailTime(m.ts)) + '</time></span>' +
          '<span class="mail-item-snippet">' + (m.replyTo ? '<span class="mail-reply-tag">回信</span>' : '') + (mine ? '我：' : '') + App.esc(line) + '</span>' +
        '</span>' +
        (m.fav ? '<span class="mail-fav-mark">★</span>' : '') +
        (!mine && !m.read ? '<span class="dot mail-dot"></span>' : '') +
        '</button>';
    }).join('');
  }

  function showList() {
    currentMailId = null;
    el('#mail-list-pane').hidden = false;
    renderList();
  }

  function quoteHtml(mail) {
    const quoted = mail.replyTo
      ? mailList().find(function (m) { return m.id === mail.replyTo; })
      : null;
    if (!quoted) return '';
    return '<div class="letter-quote">' +
      '<p class="letter-quote-head">『' + App.esc(senderName(quoted)) + ' 的信 · ' + App.esc(mailTime(quoted.ts)) + '』</p>' +
      '<p class="letter-quote-text">' + App.esc(quoted.text) + '</p>' +
      '</div>';
  }

  /* 点开一封信：先在小窗里看内容 */
  function renderPreview(mail) {
    const mine = mail.from === 'me';
    const name = senderName(mail);
    const contact = contactOf(mail.contactId);
    const target = contact ? contact.name : 'TA';
    el('#mail-preview-title').textContent = mine ? '寄给 ' + target : '来自 ' + name;
    el('#mail-preview-body').innerHTML =
      '<div class="mail-preview-meta">' +
        '<span class="avatar letter-avatar">' + App.avatarHtml(senderAvatar(mail)) + '</span>' +
        '<div class="mail-preview-addr">' +
          '<strong>' + App.esc(mine ? '寄给：' + target : '来自：' + name) + '</strong>' +
          '<span>' + App.esc(mailTime(mail.ts)) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="mail-preview-paper">' +
        quoteHtml(mail) +
        '<p class="letter-body">' + App.esc(mail.text) + '</p>' +
        '<p class="letter-sign">—— ' + App.esc(mine ? (App.state.profile.userName || '我') : name) + '</p>' +
      '</div>';
    const favBtn = el('#mail-preview-fav');
    if (favBtn) {
      favBtn.textContent = mail.fav ? '★ 已收藏' : '☆ 收藏';
      favBtn.classList.toggle('is-on', !!mail.fav);
    }
  }

  function openPreview(mail) {
    currentMailId = mail.id;
    renderPreview(mail);
    const box = el('#mail-preview');
    if (box) box.hidden = false;
  }

  function closePreview() {
    const box = el('#mail-preview');
    if (box) box.hidden = true;
    currentMailId = null;
  }

  function openMail(id) {
    const mail = mailList().find(function (m) { return m.id === id; });
    if (!mail) return;
    if (mail.from === 'ta' && !mail.read) {
      mail.read = true;
      App.save();
      App.updateMailBadge();
    }
    renderList();
    openPreview(mail);
  }

  /* 打字编辑器：既用于「我的信」写新信，也用于回信（回信时上方带原信引用）。
     写信内容完全由我手动输入，不再从字卡库里选。 */
  function openEditor(mode, mailOrContactId) {
    const isReply = mode === 'reply';
    const mail = isReply ? mailList().find(function (m) { return m.id === mailOrContactId; }) : null;
    const contact = isReply
      ? ((mail && contactOf(mail.contactId)) || fallbackContact())
      : (contactOf(mailOrContactId) || fallbackContact());
    if (!contact) {
      App.toast('先添加一个角色吧');
      return;
    }
    editorMode = isReply ? 'reply' : 'new';
    replyMailId = isReply && mail ? mail.id : null;
    editorContactId = contact.id;

    const title = el('#mail-editor-title');
    if (title) title.textContent = (isReply ? '回信给 ' : '写信给 ') + contact.name;
    const quote = el('#mail-editor-quote');
    if (quote) {
      if (isReply && mail) {
        quote.innerHTML = '<p class="mail-quote-head">『' + App.esc(senderName(mail)) + ' 的信 · ' + App.esc(mailTime(mail.ts)) + '』</p>' +
          '<p class="mail-quote-text">' + App.esc(mail.text) + '</p>';
        quote.hidden = false;
        quote.scrollTop = 0;
      } else {
        quote.innerHTML = '';
        quote.hidden = true;
      }
    }
    const input = el('#mail-editor-text');
    if (input) input.value = '';
    closePreview();
    const box = el('#mail-editor');
    if (box) box.hidden = false;
    setTimeout(function () {
      if (input) input.focus();
    }, 60);
  }

  function closeEditor() {
    replyMailId = null;
    editorContactId = null;
    const box = el('#mail-editor');
    if (box) box.hidden = true;
    const input = el('#mail-editor-text');
    if (input) input.value = '';
    const quote = el('#mail-editor-quote');
    if (quote) { quote.innerHTML = ''; quote.hidden = true; }
  }

  function sendLetter() {
    const input = el('#mail-editor-text');
    const text = String((input && input.value) || '').trim();
    if (!text) {
      App.toast('先写点什么');
      return;
    }
    const contact = contactOf(editorContactId) || fallbackContact();
    if (!contact) {
      App.toast('先添加一个角色吧');
      return;
    }
    const isReply = editorMode === 'reply';
    const id = App.uid('mail');
    mailList().unshift({
      id: id,
      from: 'me',
      contactId: contact.id,
      text: text,
      cardId: null,
      cardIds: [],
      replyTo: isReply ? replyMailId : null,
      ts: Date.now(),
      read: true,
      fav: false,
    });
    App.save();
    App.updateMailBadge();
    closeEditor();
    App.toast(isReply ? '回信已寄出' : '信已寄出');
    mailTab = isReply ? 'replies' : 'mine';
    if (el('#view-mail').classList.contains('is-active')) showList();
    scheduleTaReply(contact.id, id);
  }

  /* TA 收到信后用 0~15 条字卡回信，并引用收到的那封信 */
  function scheduleTaReply(contactId, replyToId) {
    const letter = composeTaMail();
    setTimeout(function () {
      if (!contactOf(contactId)) return;
      mailList().unshift({
        id: App.uid('mail'),
        from: 'ta',
        contactId: contactId,
        text: letter.text,
        cardId: letter.cardIds[0] || null,
        cardIds: letter.cardIds,
        replyTo: replyToId || null,
        ts: Date.now(),
        read: false,
        fav: false,
      });
      App.save();
      App.updateMailBadge();
      App.toast('收到一封回信');
      if (el('#view-mail').classList.contains('is-active') && !currentMailId) renderList();
    }, 6000 + Math.random() * 9000);
  }

  /* TA 也会隔一段时间主动寄信 */
  function maybeTaWrites() {
    if (document.hidden) return;
    const st = App.state;
    if (!st || !st.contacts.length) return;
    const settings = st.settings || {};
    const cooldownMin = settings.taMailCooldownMin == null
      ? 30
      : Math.max(0, Math.min(1440, Number(settings.taMailCooldownMin) || 0));
    const prob = settings.taMailProb == null
      ? 12
      : Math.max(0, Math.min(100, Number(settings.taMailProb) || 0));
    const contact = fallbackContact();
    if (!contact) return;
    /* 冷却结束才投一次；中不中都重新计冷却 */
    if (!App.taRollTick('mail', cooldownMin, prob)) return;
    const letter = composeTaMail();
    mailList().unshift({
      id: App.uid('mail'),
      from: 'ta',
      contactId: contact.id,
      text: letter.text,
      cardId: letter.cardIds[0] || null,
      cardIds: letter.cardIds,
      ts: Date.now(),
      read: false,
      fav: false,
    });
    /* 信已经呈现，冷却从这一刻重新计时（内部会落盘） */
    App.taRollMark('mail');
    App.updateMailBadge();
    if (el('#view-mail').classList.contains('is-active') && !currentMailId) renderList();
  }

  /* 一键已读：不用逐封点开，TA 的来信全部标为已读 */
  function markAllRead() {
    let changed = 0;
    mailList().forEach(function (m) {
      if (m.from === 'ta' && !m.read) {
        m.read = true;
        changed++;
      }
    });
    if (!changed) return;
    App.save();
    App.updateMailBadge();
    renderList();
    App.toast('全部信件已标记为已读');
  }

  App.renderMail = function () {
    /* 徽标是全局的，后台收信也要更新；列表只在信箱页打开时才重建 */
    if (!App.viewActive || App.viewActive('mail')) showList();
    App.updateMailBadge();
  };

  App.initMail = function () {
    document.querySelectorAll('#btn-mail-compose-2, #btn-mail-compose-3').forEach(function (btn) {
      btn.addEventListener('click', function () { openEditor('new', null); });
    });

    const readAll = el('#btn-mail-read-all');
    if (readAll) readAll.addEventListener('click', markAllRead);

    const preview = el('#mail-preview');
    if (preview) {
      preview.addEventListener('click', function (e) {
        if (e.target.closest('[data-mail-preview-close]')) {
          closePreview();
          return;
        }
        if (e.target.closest('#mail-preview-fav')) {
          const mail = mailList().find(function (m) { return m.id === currentMailId; });
          if (!mail) return;
          mail.fav = !mail.fav;
          App.save();
          renderPreview(mail);
          renderList();
          return;
        }
        if (e.target.closest('#mail-preview-delete')) {
          const mailId = currentMailId;
          App.confirmDialog('删除这封信？删除后无法恢复。', { title: '删除信件', okText: '删除' }).then(function (ok) {
            if (!ok) return;
            App.state.mail = mailList().filter(function (m) { return m.id !== mailId; });
            App.save();
            App.updateMailBadge();
            closePreview();
            showList();
            App.toast('信已删除');
          });
          return;
        }
        if (e.target.closest('#mail-preview-reply')) {
          const mail = mailList().find(function (m) { return m.id === currentMailId; });
          if (mail) openEditor('reply', mail.id);
        }
      });
    }

    const editor = el('#mail-editor');
    if (editor) {
      editor.addEventListener('click', function (e) {
        if (e.target.closest('[data-mail-editor-close]')) {
          closeEditor();
          return;
        }
        if (e.target.closest('#mail-editor-save')) sendLetter();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const editorBox = el('#mail-editor');
      if (editorBox && !editorBox.hidden) closeEditor();
      else if (currentMailId) closePreview();
    });

    document.querySelectorAll('[data-mail-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tab = btn.dataset.mailTab;
        mailTab = tab === 'mine' || tab === 'replies' ? tab : 'ta';
        showList();
      });
    });

    el('#mail-list').addEventListener('click', function (e) {
      const item = e.target.closest('[data-mail-id]');
      if (!item) return;
      openMail(item.dataset.mailId);
    });

    setInterval(maybeTaWrites, 90000);
  };
})();
