/* 聊天与字卡触发回复 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  if (App.sendAs == null) App.sendAs = 'me';
  if (App.panelKind == null) App.panelKind = 'sticker';

  let quoteDraft = null;
  let actionMsgId = null;

  function currentContact() {
    return App.state.contacts.find(function (c) { return c.id === App.chatContactId; });
  }

  App.openChat = function (contactId) {
    const exists = App.state.contacts.some(function (c) { return c.id === contactId; });
    if (!exists) return;
    if (App.chatContactId !== contactId) {
      quoteDraft = null;
      closeMsgActions();
    }
    App.chatContactId = contactId;
    App.state.currentContactId = contactId;
    App.unread[contactId] = 0;
    App.save();
    closeStickerPanel();
    App.renderChat();
    App.renderContacts();
    App.updateBadges();
    App.go('chat');
  };

  App.renderChat = function () {
    const id = App.chatContactId;
    const contact = currentContact();
    if (!contact) return;

    el('#c-avatar').innerHTML = App.avatarHtml(contact.avatar);
    el('#c-name').textContent = contact.name;
    el('#c-note').textContent = contact.note || '字卡传讯';

    const chat = App.state.chats[id] || [];
    const list = el('#chat-list');
    list.innerHTML = chat.length
      ? chat.map(messageHtml).join('')
      : '<p class="chat-empty">还没有消息，先说一句吧。</p>';
    updateSideButtons();
    renderStickerPanel();
    renderComposerQuote();
    scrollBottom();
  };

  function messageHtml(m) {
    const mine = m.role === 'me';
    const contact = currentContact();
    const taName = contact ? contact.name : 'TA';
    if (m.type === 'pat') {
      return '<div class="pat-line" role="status">' + App.esc(m.text) + '</div>';
    }
    if (m.recalled) {
      return '<div class="msg-recall">' + App.esc(mine ? '你' : taName) + '撤回了一条消息</div>';
    }
    const hasFrequency = m.strength != null || m.percent != null || m.type === 'emotion';
    const hasEmotion = !!m.emotion || m.type === 'emotion';
    const strength = ['强', '中', '弱'].indexOf(m.strength) !== -1 ? m.strength : '中';
    const percent = Math.max(0, Math.min(100, Number(m.percent) || 0));
    const meta = hasFrequency
      ? '<span class="emotion-divider"></span>' +
        (hasEmotion
          ? '<div class="emotion-row"><span class="emotion-chip">情绪</span><span class="emotion-value">' + App.esc(m.emotion || '平常') + '</span></div>'
          : '') +
        '<div class="emotion-row"><span class="emotion-chip">频率</span><span class="emotion-value">链接度' + App.esc(strength) + ' ' + percent + '%</span></div>'
      : '';
    let body = '';
    if (m.type === 'image') {
      body = '<div class="bubble sticker"><img class="sticker-img" src="' + App.esc(m.src) + '" alt="表情包"></div>';
    } else if (m.type === 'audio') {
      body = '<div class="bubble bubble-audio' + (hasFrequency ? ' bubble-emotion' : '') + '">' +
        '<audio controls preload="metadata" src="' + App.esc(m.src) + '"></audio>' + meta +
        '</div>';
    } else if (hasFrequency) {
      body = '<div class="bubble bubble-emotion">' +
        '<p class="emotion-text">' + App.esc(m.text) + '</p>' + meta +
        '</div>';
    } else {
      body = '<div class="bubble">' + App.esc(m.text) + '</div>';
    }
    const quote = m.quote && m.quote.text
      ? '<span class="msg-quote"><strong>' + App.esc(m.quote.name || '') + '</strong>' + App.esc(m.quote.text) + '</span>'
      : '';
    const marks = [];
    if (m.favMine) marks.push('我收藏了');
    if (m.favTa) marks.push(App.esc(taName) + '收藏了');
    const marksHtml = marks.length
      ? '<div class="msg-marks">' + marks.map(function (t) { return '<span>★ ' + t + '</span>'; }).join('') + '</div>'
      : '';
    const avatarSrc = mine ? App.state.profile.userAvatar : (contact && contact.avatar);
    const avatarHtml = mine
      ? '<span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>'
      : '<button type="button" class="msg-avatar msg-avatar-button" data-pat-current="1" aria-label="拍一拍 ' + App.esc(contact ? contact.name : 'TA') + '" title="拍一拍">' + App.avatarHtml(avatarSrc) + '</button>';
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '" data-msg-id="' + App.esc(m.id) + '">' +
      avatarHtml +
      '<div class="msg-main">' +
        quote +
        '<div class="msg-bubble-hit" data-msg-bubble="1">' + body + '</div>' +
        marksHtml +
        '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 引用草稿 ---------- */
  function renderComposerQuote() {
    const box = el('#composer-quote');
    if (!box) return;
    box.hidden = !quoteDraft;
    if (!quoteDraft) return;
    el('#composer-quote-name').textContent = quoteDraft.name;
    el('#composer-quote-text').textContent = quoteDraft.text;
  }

  function messageAuthor(message, contact) {
    return message.role === 'me'
      ? (App.state.profile.userName || '我')
      : (contact ? contact.name : 'TA');
  }

  /* ---------- 消息操作菜单 ---------- */
  function findChatMessage(id) {
    const chat = App.state.chats[App.chatContactId] || [];
    return chat.find(function (m) { return m.id === id; });
  }

  function closeMsgActions() {
    const menu = el('#msg-actions');
    if (menu) menu.hidden = true;
    actionMsgId = null;
  }
  App.closeMsgActions = closeMsgActions;

  function openMsgActions(msgEl) {
    const menu = el('#msg-actions');
    const message = findChatMessage(msgEl.dataset.msgId);
    if (!menu || !message) return;
    actionMsgId = message.id;
    const mine = message.role === 'me';
    menu.querySelector('[data-msg-action="recall"]').hidden = !mine;
    menu.querySelector('[data-msg-action="favorite"]').textContent = message.favMine ? '取消收藏' : '收藏';
    menu.hidden = false;

    const rect = msgEl.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    let left = mine ? rect.right - box.width : rect.left;
    left = Math.max(8, Math.min(window.innerWidth - box.width - 8, left));
    let top = rect.top - box.height - 8;
    if (top < 8) top = rect.bottom + 8;
    top = Math.max(8, Math.min(window.innerHeight - box.height - 8, top));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function doMsgAction(action) {
    const menu = el('#msg-actions');
    if (menu) menu.hidden = true;
    const id = actionMsgId;
    actionMsgId = null;
    const message = findChatMessage(id);
    if (!message) return;
    const chat = App.state.chats[App.chatContactId] || [];

    if (action === 'recall') {
      if (message.role !== 'me') return;
      message.recalled = true;
      message.recalledBy = 'me';
      App.save();
      App.renderChat();
      App.renderContacts();
      App.toast('已撤回消息');
      return;
    }

    if (action === 'quote') {
      quoteDraft = {
        name: messageAuthor(message, currentContact()),
        text: App.messagePreview(message),
      };
      renderComposerQuote();
      const input = el('#msg-input');
      if (input) input.focus();
      return;
    }

    if (action === 'favorite') {
      message.favMine = !message.favMine;
      App.save();
      App.renderChat();
      App.toast(message.favMine ? '已收藏这条消息' : '已取消收藏');
      return;
    }

    if (action === 'delete') {
      if (!confirm('删除这条消息？')) return;
      const index = chat.indexOf(message);
      if (index !== -1) chat.splice(index, 1);
      App.save();
      App.renderChat();
      App.renderContacts();
      App.toast('已删除消息');
    }
  }

  function scrollBottom() {
    const box = el('#chat-scroll');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function setTyping(on) {
    if (App.chatContactId === null) return;
    const list = el('#chat-list');
    if (!list) return;
    let row = list.querySelector('.typing-row');
    if (on) {
      if (!row) {
        row = document.createElement('div');
        row.className = 'typing-row';
        row.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
        list.appendChild(row);
        scrollBottom();
      }
    } else if (row) {
      row.remove();
    }
  }

  function pushMessage(message) {
    const id = App.chatContactId;
    if (!id) return;
    const chat = App.state.chats[id] || (App.state.chats[id] = []);
    chat.push(message);
    App.save();
    App.renderChat();
  }

  function sendMessage() {
    const input = el('#msg-input');
    const text = input.value.trim();
    if (!App.chatContactId || !text) return;

    const role = App.sendAs;
    const message = { id: App.uid('m'), role: role, type: 'text', text: text, ts: Date.now() };
    if (quoteDraft) message.quote = quoteDraft;
    quoteDraft = null;
    renderComposerQuote();
    pushMessage(message);

    input.value = '';
    input.style.height = 'auto';

    if (role === 'me') {
      scheduleReply(App.chatContactId, text);
      maybeTaSticker(App.chatContactId);
    }
  }

  function sendSticker(src) {
    if (!App.chatContactId || !src) return;
    pushMessage({ id: App.uid('m'), role: App.sendAs, type: 'image', src: src, ts: Date.now() });
    closeStickerPanel();
  }

  App.sendPat = function (card) {
    const contact = currentContact();
    if (!contact) return;
    const picked = card || App.pickPatCard();
    const raw = picked ? picked.text : '拍了拍{name}';
    const action = raw.indexOf('{name}') !== -1
      ? raw.split('{name}').join(contact.name)
      : raw + ' ' + contact.name;
    pushMessage({
      id: App.uid('m'),
      role: 'me',
      type: 'pat',
      text: '你' + action,
      ts: Date.now(),
      cardId: picked ? picked.id : undefined,
    });
    closeStickerPanel();

    schedulePatBack(contact.id);
    scheduleReply(contact.id, '');
    maybeTaSticker(contact.id);
  };

  App.addChatSystemMessage = function (contactId, text) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact || !text) return;
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    chat.push({ id: App.uid('m'), role: 'ta', type: 'pat', text: text, ts: Date.now() });
    const chatOpen = App.chatContactId === contactId && el('#view-chat').classList.contains('is-active');
    if (chatOpen) App.renderChat();
    else App.unread[contactId] = (App.unread[contactId] || 0) + 1;
    App.save();
    App.renderContacts();
    App.updateBadges();
  };

  /* 我拍了 TA 之后，TA 按概率回拍我 */
  function schedulePatBack(contactId) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    const prob = Math.max(0, Math.min(100, Number(App.contactSettings(contact).patBackProb) || 0));
    if (Math.random() * 100 >= prob) return;

    const card = App.pickPatCard();
    const raw = card ? card.text : '拍了拍{name}';
    const action = raw.indexOf('{name}') !== -1
      ? raw.split('{name}').join('你')
      : raw + ' 你';

    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({
        id: App.uid('m'),
        role: 'ta',
        type: 'pat',
        text: contact.name + action,
        ts: Date.now(),
        cardId: card ? card.id : undefined,
      });
      App.save();
      if (App.chatContactId === contactId) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 900 + Math.random() * 1200);
  }

  /* TA 按概率主动发一张表情包（从 TA 的表情库随机抽） */
  function maybeTaSticker(contactId) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    const prob = Math.max(0, Math.min(100, Number(App.contactSettings(contact).taStickerProb) || 0));
    const pool = App.state.stickers.ta || [];
    if (!pool.length || Math.random() * 100 >= prob) return;
    const src = pool[Math.floor(Math.random() * pool.length)];

    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({ id: App.uid('m'), role: 'ta', type: 'image', src: src, ts: Date.now() });
      App.save();
      if (App.chatContactId === contactId) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 1600 + Math.random() * 1800);
  }

  App.openCurrentChat = function () {
    const st = App.state;
    let id = st.currentContactId;
    if (!st.contacts.some(function (c) { return c.id === id; })) {
      id = st.contacts.length ? st.contacts[0].id : null;
    }
    if (!id) {
      App.toast('先添加一个角色吧');
      App.go('contacts');
      return;
    }
    App.openChat(id);
  };

  function pickReplyEmotion(card) {
    if (card.category === '情绪' && card.emotion) return card.emotion;
    const pool = App.state.cards.filter(function (c) {
      return c.category === '情绪' && c.emotion;
    });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].emotion : '平常';
  }

  /* TA 按概率撤回/收藏自己或对方最近的消息 */
  function scheduleTaMessageExtras(contactId, contact, message, cs) {
    const recallProb = Math.max(0, Math.min(100, Number(cs.taRecallProb) || 0));
    if (Math.random() * 100 < recallProb) {
      setTimeout(function () {
        const target = (App.state.chats[contactId] || []).find(function (m) {
          return m.id === message.id;
        });
        if (!target || target.recalled) return;
        target.recalled = true;
        target.recalledBy = 'ta';
        App.save();
        if (App.chatContactId === contactId) App.renderChat();
        else {
          App.renderContacts();
          App.updateBadges();
        }
      }, 2400 + Math.random() * 3000);
    }

    const favProb = Math.max(0, Math.min(100, Number(cs.taFavProb) || 0));
    if (Math.random() * 100 < favProb) {
      setTimeout(function () {
        const pool = (App.state.chats[contactId] || []).filter(function (m) {
          return !m.recalled && m.type !== 'pat';
        }).slice(-8);
        if (!pool.length) return;
        const target = pool[Math.floor(Math.random() * pool.length)];
        if (target.favTa) return;
        target.favTa = true;
        App.save();
        if (App.chatContactId === contactId) App.renderChat();
      }, 1800 + Math.random() * 3200);
    }
  }

  async function scheduleReply(contactId, userText) {
    const st = App.state;
    const contact = st.contacts.find(function (c) { return c.id === contactId; });
    const cs = App.contactSettings(contact);
    const min = Math.max(0, Math.min(5, Number(cs.replyMin) || 0));
    const max = Math.max(min, Math.min(5, Number(cs.replyMax) || 0));
    const count = min + Math.floor(Math.random() * (max - min + 1));
    if (count <= 0) return;

    const cards = App.pickCards(userText, count, contactId, ['聊天', '情绪', '语音']);
    if (!cards.length) {
      App.toast('字卡库是空的，先去添加几张字卡');
      return;
    }
    const emotionProb = Math.max(0, Math.min(100, Number(cs.emotionProb) || 0));
    const strengths = ['强', '中', '弱'];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const stillThere = function () {
        return App.state.contacts.some(function (c) { return c.id === contactId; });
      };
      if (!stillThere()) return;

      const active = function () { return App.chatContactId === contactId; };
      if (active()) setTyping(true);

      const base = Number(cs.typingMs) || 700;
      const extra = card.category === '语音' ? 900 : 0;
      const wait = Math.min(2600, base + extra + card.text.length * 22 + Math.random() * 260);
      await sleep(wait);

      if (active()) setTyping(false);
      if (!stillThere()) return;

      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      const strength = strengths[Math.floor(Math.random() * strengths.length)];
      const message = {
        id: App.uid('m'),
        role: 'ta',
        type: card.category === '语音' ? 'audio' : 'text',
        text: card.text,
        ts: Date.now(),
        cardId: card.id,
        strength: strength,
        percent: App.emotionPercent(strength),
      };
      if (card.category === '语音') message.src = card.audio;
      if (Math.random() * 100 < emotionProb) message.emotion = pickReplyEmotion(card);

      const quoteProb = Math.max(0, Math.min(100, Number(cs.taQuoteProb) || 0));
      if (chat.length && Math.random() * 100 < quoteProb) {
        const pool = chat.filter(function (m) {
          return !m.recalled && m.type !== 'pat' && (m.text || m.type === 'image');
        }).slice(-12);
        if (pool.length) {
          const target = pool[Math.floor(Math.random() * pool.length)];
          message.quote = {
            name: messageAuthor(target, contact),
            text: App.messagePreview(target),
          };
        }
      }

      chat.push(message);
      App.save();
      scheduleTaMessageExtras(contactId, contact, message, cs);

      if (active()) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }

      await sleep(240);
    }
  }

  /* ---------- 表情包 ---------- */
  function updateSideButtons() {
    document.querySelectorAll('[data-sticker-side]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.stickerSide === App.sendAs);
    });
    const hint = el('#sticker-side-hint');
    if (hint) hint.textContent = App.sendAs === 'me' ? '当前：我的表情包' : '当前：TA 的表情包';
  }

  function renderStickerPanel() {
    const kind = App.panelKind || 'sticker';
    const isPat = kind === 'pat';
    document.querySelectorAll('[data-panel-kind]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.panelKind === kind);
    });
    el('#sticker-side-head').hidden = isPat;
    el('#sticker-grid').hidden = isPat;
    el('#pat-grid').hidden = !isPat;
    el('#btn-add-sticker').hidden = isPat;

    if (isPat) { renderPatGrid(); return; }

    const side = App.sendAs;
    const stickers = App.state.stickers[side] || [];
    el('#sticker-grid').innerHTML = stickers.length
      ? stickers.map(function (src, index) {
          return '<div class="sticker-cell">' +
            '<button type="button" class="sticker-item" data-send-sticker="' + index + '" aria-label="发送表情包">' +
              '<img src="' + App.esc(src) + '" alt="表情包">' +
            '</button>' +
            '<button type="button" class="sticker-delete" data-del-sticker="' + index + '" aria-label="删除表情包">×</button>' +
          '</div>';
        }).join('')
      : '<p class="sticker-empty">还没有表情包，点下方按钮从本地相册添加。</p>';
  }

  function renderPatGrid() {
    const contact = currentContact();
    const name = contact ? contact.name : '你';
    const cards = (App.state.cards || []).filter(function (c) {
      return c.category === '拍一拍' && c.enabled !== false && c.text;
    });
    el('#pat-grid').innerHTML = cards.length
      ? cards.map(function (c) {
          return '<button type="button" class="pat-item" data-send-pat="' + c.id + '">' +
            App.esc(c.text.split('{name}').join(name)) +
          '</button>';
        }).join('')
      : '<p class="sticker-empty">字卡库里还没有拍一拍字卡，去「字卡」添加。</p>';
  }

  function closeStickerPanel() {
    const panel = el('#sticker-panel');
    if (panel) panel.hidden = true;
  }

  function toggleStickerPanel() {
    const panel = el('#sticker-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderStickerPanel();
  }

  function compressImage(file) {
    return App.compressImage(file, 240);
  }

  async function addStickers(files) {
    const side = App.sendAs;
    const images = Array.from(files || []).slice(0, 12);
    if (!images.length) return;

    App.toast('正在处理图片…');
    const list = App.state.stickers[side] || (App.state.stickers[side] = []);
    let added = 0;
    let first = null;

    for (let i = 0; i < images.length; i++) {
      try {
        const src = await compressImage(images[i]);
        if (!list.includes(src)) {
          list.push(src);
          if (!first) first = src;
          added++;
        }
      } catch (e) {
        App.toast(e.message || '图片处理失败');
      }
    }

    if (!added) return;
    App.save();
    renderStickerPanel();
    if (first) sendSticker(first);
    App.toast('已添加 ' + added + ' 张表情包');
  }

  App.initChat = function () {
    const input = el('#msg-input');
    const form = el('#composer');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(118, input.scrollHeight) + 'px';
    });

    document.addEventListener('click', function (e) {
      const actionBtn = e.target.closest('[data-msg-action]');
      if (actionBtn) {
        e.preventDefault();
        doMsgAction(actionBtn.dataset.msgAction);
        return;
      }
      if (e.target.closest('#msg-actions')) return;

      const bubbleHit = e.target.closest('[data-msg-id] [data-msg-bubble]');
      if (bubbleHit) {
        if (e.target.closest('audio')) return;
        closeStickerPanel();
        openMsgActions(bubbleHit.closest('[data-msg-id]'));
        return;
      }
      closeMsgActions();

      const patAvatar = e.target.closest('[data-pat-current]');
      if (patAvatar) {
        App.sendPat();
        return;
      }

      const kindBtn = e.target.closest('[data-panel-kind]');
      if (kindBtn) {
        App.panelKind = kindBtn.dataset.panelKind;
        renderStickerPanel();
        return;
      }

      const patItem = e.target.closest('[data-send-pat]');
      if (patItem) {
        const card = (App.state.cards || []).find(function (c) {
          return c.id === patItem.dataset.sendPat;
        });
        if (card) App.sendPat(card);
        return;
      }

      const stickerTab = e.target.closest('[data-sticker-side]');
      if (stickerTab) {
        App.sendAs = stickerTab.dataset.stickerSide;
        updateSideButtons();
        renderStickerPanel();
        return;
      }

      const stickerItem = e.target.closest('[data-send-sticker]');
      if (stickerItem) {
        const list = App.state.stickers[App.sendAs] || [];
        const src = list[Number(stickerItem.dataset.sendSticker)];
        if (src) sendSticker(src);
        return;
      }

      const stickerDel = e.target.closest('[data-del-sticker]');
      if (stickerDel) {
        const list = App.state.stickers[App.sendAs] || [];
        const index = Number(stickerDel.dataset.delSticker);
        list.splice(index, 1);
        App.save();
        renderStickerPanel();
        return;
      }

      if (!e.target.closest('#composer, #sticker-panel, #btn-sticker')) closeStickerPanel();
    });

    el('#btn-sticker').addEventListener('click', toggleStickerPanel);
    el('#composer-quote-close').addEventListener('click', function () {
      quoteDraft = null;
      renderComposerQuote();
    });
    el('#chat-scroll').addEventListener('wheel', closeMsgActions, { passive: true });
    window.addEventListener('resize', closeMsgActions);
    el('#btn-add-sticker').addEventListener('click', function () { el('#sticker-file').click(); });
    el('#sticker-file').addEventListener('change', function (e) {
      const files = e.target.files;
      e.target.value = '';
      addStickers(files);
    });

    el('#btn-clear-chat').addEventListener('click', function () {
      const id = App.chatContactId;
      if (!id) return;
      if (!confirm('清空这段对话？此操作不可撤销。')) return;
      App.state.chats[id] = [];
      App.save();
      App.renderChat();
      App.renderContacts();
      App.renderDesktop();
      App.toast('已清空对话');
    });
  };
})();
