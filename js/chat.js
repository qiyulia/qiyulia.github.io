/* 聊天与字卡触发回复 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  App.openChat = function (contactId) {
    const exists = App.state.contacts.some(function (c) { return c.id === contactId; });
    if (!exists) return;
    App.chatContactId = contactId;
    App.unread[contactId] = 0;
    App.renderChat();
    App.renderContacts();
    App.updateBadges();
    App.go('chat');
  };

  App.renderChat = function () {
    const id = App.chatContactId;
    const contact = App.state.contacts.find(function (c) { return c.id === id; });
    if (!contact) return;

    el('#c-avatar').textContent = contact.avatar || '🙂';
    el('#c-name').textContent = contact.name;
    el('#c-note').textContent = contact.note || '字卡传讯';

    const chat = App.state.chats[id] || [];
    const list = el('#chat-list');
    list.innerHTML = chat.length
      ? chat.map(messageHtml).join('')
      : '<p class="chat-empty">还没有消息，先说一句吧。</p>';
    scrollBottom();
  };

  function messageHtml(m) {
    const mine = m.role === 'me';
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '">' +
      '<div class="bubble">' + App.esc(m.text) + '</div>' +
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

  function sendMessage() {
    const input = el('#msg-input');
    const text = input.value.trim();
    const id = App.chatContactId;
    if (!id || !text) return;

    const chat = App.state.chats[id] || (App.state.chats[id] = []);
    chat.push({ id: App.uid('m'), role: 'me', text: text, ts: Date.now() });

    input.value = '';
    input.style.height = 'auto';
    App.save();
    App.renderChat();
    scheduleReply(id, text);
  }

  async function scheduleReply(contactId, userText) {
    const st = App.state;
    const min = Math.max(0, Math.min(5, Number(st.settings.replyMin) || 0));
    const max = Math.max(min, Math.min(5, Number(st.settings.replyMax) || 0));
    const count = min + Math.floor(Math.random() * (max - min + 1));
    if (count <= 0) return;

    const cards = App.pickCards(userText, count, contactId);
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
      const wait = Math.min(2200, base + card.text.length * 22 + Math.random() * 260);
      await sleep(wait);

      if (active()) setTyping(false);
      if (!stillThere()) return;

      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({
        id: App.uid('m'),
        role: 'ta',
        text: card.text,
        ts: Date.now(),
        cardId: card.id,
      });
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
