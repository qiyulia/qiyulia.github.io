/* 聊天与字卡触发回复 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  if (App.sendAs == null) App.sendAs = 'me';
  if (App.panelKind == null) App.panelKind = 'sticker';

  function currentContact() {
    return App.state.contacts.find(function (c) { return c.id === App.chatContactId; });
  }

  App.openChat = function (contactId) {
    const exists = App.state.contacts.some(function (c) { return c.id === contactId; });
    if (!exists) return;
    App.chatContactId = contactId;
    App.unread[contactId] = 0;
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

    el('#c-avatar').textContent = contact.avatar || '🙂';
    el('#c-name').textContent = contact.name;
    el('#c-note').textContent = contact.note || '字卡传讯';

    const chat = App.state.chats[id] || [];
    const list = el('#chat-list');
    list.innerHTML = chat.length
      ? chat.map(messageHtml).join('')
      : '<p class="chat-empty">还没有消息，先说一句吧。</p>';
    updateSideButtons();
    renderStickerPanel();
    scrollBottom();
  };

  function messageHtml(m) {
    const mine = m.role === 'me';
    if (m.type === 'pat') {
      return '<div class="pat-line" role="status">' + App.esc(m.text) + '</div>';
    }
    let body = '';
    if (m.type === 'image') {
      body = '<div class="bubble sticker"><img class="sticker-img" src="' + App.esc(m.src) + '" alt="表情包"></div>';
    } else if (m.type === 'audio') {
      body = '<div class="bubble bubble-audio">' +
        '<audio controls preload="metadata" src="' + App.esc(m.src) + '"></audio>' +
        '</div>';
    } else if (m.type === 'emotion') {
      body = '<div class="bubble bubble-emotion">' +
        '<p class="emotion-text">' + App.esc(m.text) + '</p>' +
        '<span class="emotion-divider"></span>' +
        '<div class="emotion-row"><span class="emotion-chip">情绪</span><span class="emotion-value">' + App.esc(m.emotion || '平常') + '</span></div>' +
        '<div class="emotion-row"><span class="emotion-chip">频率</span><span class="emotion-value">链接度' + App.esc(m.strength || '中') + ' ' + Math.max(0, Math.min(100, Number(m.percent || 0))) + '%</span></div>' +
        '</div>';
    } else {
      body = '<div class="bubble">' + App.esc(m.text) + '</div>';
    }
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '">' +
      body +
      '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
      '</div>';
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
    pushMessage({ id: App.uid('m'), role: role, type: 'text', text: text, ts: Date.now() });

    input.value = '';
    input.style.height = 'auto';

    if (role === 'me') scheduleReply(App.chatContactId, text);
  }

  function sendSticker(src) {
    if (!App.chatContactId || !src) return;
    pushMessage({ id: App.uid('m'), role: App.sendAs, type: 'image', src: src, ts: Date.now() });
    closeStickerPanel();
  }

  function sendPat(card) {
    const contact = currentContact();
    if (!contact) return;
    const picked = card || App.pickPatCard();
    const raw = picked ? picked.text : '拍了拍{name}';
    const target = App.sendAs === 'me' ? contact.name : '你';
    const subject = App.sendAs === 'me' ? '你' : contact.name;
    const action = raw.indexOf('{name}') !== -1
      ? raw.split('{name}').join(target)
      : raw + ' ' + target;
    pushMessage({
      id: App.uid('m'),
      role: App.sendAs,
      type: 'pat',
      text: subject + action,
      ts: Date.now(),
      cardId: picked ? picked.id : undefined,
    });
  }

  async function scheduleReply(contactId, userText) {
    const st = App.state;
    const min = Math.max(0, Math.min(5, Number(st.settings.replyMin) || 0));
    const max = Math.max(min, Math.min(5, Number(st.settings.replyMax) || 0));
    const count = min + Math.floor(Math.random() * (max - min + 1));
    if (count <= 0) return;

    const cards = App.pickCards(userText, count, contactId, ['聊天', '情绪', '语音']);
    if (!cards.length) {
      App.toast('字卡库是空的，先去添加几张字卡');
      return;
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const stillThere = function () {
        return App.state.contacts.some(function (c) { return c.id === contactId; });
      };
      if (!stillThere()) return;

      const active = function () { return App.chatContactId === contactId; };
      if (active()) setTyping(true);

      const base = Number(st.settings.typingMs) || 700;
      const extra = card.category === '语音' ? 900 : 0;
      const wait = Math.min(2600, base + extra + card.text.length * 22 + Math.random() * 260);
      await sleep(wait);

      if (active()) setTyping(false);
      if (!stillThere()) return;

      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      const baseMsg = { id: App.uid('m'), role: 'ta', ts: Date.now(), cardId: card.id };

      if (card.category === '情绪') {
        chat.push(Object.assign(baseMsg, {
          type: 'emotion',
          text: card.text,
          emotion: card.emotion || '平常',
          strength: card.strength || '中',
          percent: App.emotionPercent(card.strength),
        }));
      } else if (card.category === '语音') {
        chat.push(Object.assign(baseMsg, {
          type: 'audio',
          src: card.audio,
          text: card.text,
        }));
      } else {
        chat.push(Object.assign(baseMsg, {
          type: 'text',
          text: card.text,
        }));
      }
      App.save();

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
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          const max = 240;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > max) { height = Math.round(height * max / width); width = max; }
          } else if (height > max) {
            width = Math.round(width * max / height); height = max;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function () { reject(new Error('图片读取失败')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('图片读取失败')); };
      reader.readAsDataURL(file);
    });
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
        if (card) sendPat(card);
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
