/* 信箱：我和 TA 用字卡互相写信 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  let currentMailId = null;
  let composeMode = 'new';
  let composeContactId = null;
  let selectedCardId = null;

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
      return c.enabled !== false && c.text && c.category !== '拍一拍';
    });
  }

  function pickTaCard() {
    const pool = mailCards();
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
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
    if (mail.from === 'me') return App.state.profile.userAvatar || '🍊';
    const contact = contactOf(mail.contactId);
    return contact ? contact.avatar : '🌙';
  }

  function mailTime(ts) {
    const now = new Date();
    const date = new Date(ts);
    if (date.toDateString() === now.toDateString()) return App.fmtTime(ts);
    return App.fmtDate(date) + ' ' + App.fmtTime(ts);
  }

  function renderList() {
    const items = mailList().slice().sort(function (a, b) { return b.ts - a.ts; });
    const unread = items.filter(function (m) { return m.from === 'ta' && !m.read; }).length;
    el('#mail-summary').textContent = items.length
      ? '共 ' + items.length + ' 封' + (unread ? ' · ' + unread + ' 封未读' : '')
      : '写信给 TA，也可以等 TA 的来信';
    el('#mail-empty').hidden = items.length > 0;

    el('#mail-list').innerHTML = items.map(function (m) {
      const mine = m.from === 'me';
      const name = senderName(m);
      const line = String(m.text || '').split('\n')[0];
      return '<button type="button" class="mail-item' + (mine ? '' : ' from-ta') + (!mine && !m.read ? ' is-unread' : '') + '" data-mail-id="' + App.esc(m.id) + '">' +
        '<span class="mail-item-avatar avatar">' + App.avatarHtml(senderAvatar(m)) + '</span>' +
        '<span class="mail-item-main">' +
          '<span class="mail-item-head"><strong>' + App.esc(mine ? '寄给 ' + (contactOf(m.contactId) ? contactOf(m.contactId).name : 'TA') : name) + '</strong>' +
            '<time>' + App.esc(mailTime(m.ts)) + '</time></span>' +
          '<span class="mail-item-snippet">' + (mine ? '我：' : '') + App.esc(line) + '</span>' +
        '</span>' +
        (m.fav ? '<span class="mail-fav-mark">★</span>' : '') +
        (!mine && !m.read ? '<span class="dot mail-dot"></span>' : '') +
        '</button>';
    }).join('');
  }

  function showList() {
    currentMailId = null;
    el('#mail-detail').hidden = true;
    el('#mail-list-pane').hidden = false;
    renderList();
  }

  function renderDetail(id) {
    const mail = mailList().find(function (m) { return m.id === id; });
    if (!mail) {
      showList();
      return;
    }
    const mine = mail.from === 'me';
    const name = senderName(mail);
    const contact = contactOf(mail.contactId);
    const target = contact ? contact.name : 'TA';
    el('#mail-list-pane').hidden = true;
    const detail = el('#mail-detail');
    detail.hidden = false;
    detail.innerHTML =
      '<button type="button" class="mail-back" data-mail-back="1">‹ 返回信箱</button>' +
      '<article class="letter">' +
        '<div class="letter-meta">' +
          '<span class="avatar letter-avatar">' + App.avatarHtml(senderAvatar(mail)) + '</span>' +
          '<div class="letter-address">' +
            '<strong>' + (mine ? '寄给：' + App.esc(target) : '来自：' + App.esc(name)) + '</strong>' +
            '<span>' + App.esc(mailTime(mail.ts)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="letter-paper">' +
          '<p class="letter-body">' + App.esc(mail.text) + '</p>' +
          '<p class="letter-sign">—— ' + App.esc(mine ? (App.state.profile.userName || '我') : name) + '</p>' +
        '</div>' +
      '</article>' +
      '<div class="letter-actions">' +
        '<button type="button" class="letter-btn' + (mail.fav ? ' is-on' : '') + '" data-mail-fav="' + App.esc(mail.id) + '">' +
          (mail.fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
        '<button type="button" class="letter-btn" data-mail-reply="' + App.esc(mail.id) + '">回信</button>' +
        '<button type="button" class="letter-btn letter-delete" data-mail-delete="' + App.esc(mail.id) + '">删除</button>' +
      '</div>';
  }

  function openMail(id) {
    const mail = mailList().find(function (m) { return m.id === id; });
    if (!mail) return;
    currentMailId = id;
    if (mail.from === 'ta' && !mail.read) {
      mail.read = true;
      App.save();
      App.updateMailBadge();
    }
    renderList();
    renderDetail(id);
  }

  function openCompose(mode, contactId) {
    const contact = contactOf(contactId) || fallbackContact();
    if (!contact) {
      App.toast('先添加一个角色吧');
      return;
    }
    const cards = mailCards();
    if (!cards.length) {
      App.toast('字卡库是空的，先去添加几张字卡');
      return;
    }
    composeMode = mode === 'reply' ? 'reply' : 'new';
    composeContactId = contact.id;
    selectedCardId = cards[0].id;
    el('#mail-dialog-title').textContent = composeMode === 'reply' ? '回信' : '写信';
    el('#mail-dialog-hint').textContent = (composeMode === 'reply' ? '回信给 ' : '寄给 ') + contact.name + ' · 从字卡库选一张装进信封';
    renderComposeCards();
    el('#mail-dialog').showModal();
  }

  function renderComposeCards() {
    const cards = mailCards();
    el('#mail-card-list').innerHTML = cards.map(function (c) {
      return '<button type="button" class="mail-card-option' + (c.id === selectedCardId ? ' is-selected' : '') + '" data-mail-card="' + App.esc(c.id) + '">' +
        App.esc(c.text) +
      '</button>';
    }).join('');
  }

  function sendMail() {
    const cards = mailCards();
    const card = cards.find(function (c) { return c.id === selectedCardId; }) || cards[0];
    if (!card) {
      App.toast('先选一张字卡');
      return false;
    }
    const contact = contactOf(composeContactId) || fallbackContact();
    if (!contact) {
      App.toast('先添加一个角色吧');
      return false;
    }
    mailList().unshift({
      id: App.uid('mail'),
      from: 'me',
      contactId: contact.id,
      text: card.text,
      cardId: card.id,
      ts: Date.now(),
      read: true,
      fav: false,
    });
    App.save();
    App.updateMailBadge();
    el('#mail-dialog').close();
    App.toast('信已寄出');
    if (el('#view-mail').classList.contains('is-active')) showList();
    scheduleTaReply(contact.id);
    return true;
  }

  /* TA 收到信后会用一张字卡回信 */
  function scheduleTaReply(contactId) {
    const card = pickTaCard();
    if (!card) return;
    setTimeout(function () {
      if (!contactOf(contactId)) return;
      mailList().unshift({
        id: App.uid('mail'),
        from: 'ta',
        contactId: contactId,
        text: card.text,
        cardId: card.id,
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
    const taMails = mailList().filter(function (m) { return m.from === 'ta'; });
    const lastTa = taMails.length ? taMails.reduce(function (a, b) { return a.ts > b.ts ? a : b; }) : null;
    const settings = st.settings || {};
    const cooldownMin = settings.taMailCooldownMin == null
      ? 30
      : Math.max(0, Math.min(1440, Number(settings.taMailCooldownMin) || 0));
    const prob = settings.taMailProb == null
      ? 12
      : Math.max(0, Math.min(100, Number(settings.taMailProb) || 0));
    if (lastTa && Date.now() - lastTa.ts < cooldownMin * 60000) return;
    if (Math.random() * 100 >= prob) return;

    const contact = fallbackContact();
    const card = pickTaCard();
    if (!contact || !card) return;
    mailList().unshift({
      id: App.uid('mail'),
      from: 'ta',
      contactId: contact.id,
      text: card.text,
      cardId: card.id,
      ts: Date.now(),
      read: false,
      fav: false,
    });
    App.save();
    App.updateMailBadge();
    if (el('#view-mail').classList.contains('is-active') && !currentMailId) renderList();
  }

  App.renderMail = function () {
    showList();
    App.updateMailBadge();
  };

  App.initMail = function () {
    el('#btn-write-mail').addEventListener('click', function () { openCompose('new'); });
    el('#btn-mail-compose').addEventListener('click', function () { openCompose('new'); });
    el('#btn-mail-compose-2').addEventListener('click', function () { openCompose('new'); });

    el('#mail-list').addEventListener('click', function (e) {
      const item = e.target.closest('[data-mail-id]');
      if (!item) return;
      openMail(item.dataset.mailId);
    });

    el('#mail-detail').addEventListener('click', function (e) {
      if (e.target.closest('[data-mail-back]')) {
        showList();
        return;
      }
      const fav = e.target.closest('[data-mail-fav]');
      if (fav) {
        const mail = mailList().find(function (m) { return m.id === fav.dataset.mailFav; });
        if (mail) {
          mail.fav = !mail.fav;
          App.save();
          renderDetail(mail.id);
          renderList();
        }
        return;
      }
      const reply = e.target.closest('[data-mail-reply]');
      if (reply) {
        const mail = mailList().find(function (m) { return m.id === reply.dataset.mailReply; });
        if (mail) openCompose('reply', mail.contactId);
        return;
      }
      const remove = e.target.closest('[data-mail-delete]');
      if (remove && confirm('删除这封信？')) {
        App.state.mail = mailList().filter(function (m) { return m.id !== remove.dataset.mailDelete; });
        App.save();
        App.updateMailBadge();
        showList();
        App.toast('信已删除');
      }
    });

    el('#mail-card-list').addEventListener('click', function (e) {
      const option = e.target.closest('[data-mail-card]');
      if (!option) return;
      selectedCardId = option.dataset.mailCard;
      renderComposeCards();
    });

    el('#mail-form').addEventListener('submit', function (e) {
      e.preventDefault();
      sendMail();
    });

    setInterval(maybeTaWrites, 90000);
  };
})();
