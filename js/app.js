/* 入口与路由 */
(function () {
  const App = window.App;
  const app = document.getElementById('app');

  /* 记住离开前的聊天页，手机相册选图后如果页面被系统重载，仍能回到聊天 */
  function rememberView(view) {
    try {
      if (view === 'desktop') {
        sessionStorage.removeItem('xuyu.view');
      } else if (view === 'chat' && App.chatContactId) {
        sessionStorage.setItem('xuyu.view', JSON.stringify({ view: 'chat', contactId: App.chatContactId }));
      }
    } catch (e) {}
  }

  App.go = function (view) {
    /* 切页面前关掉所有弹窗，避免弹窗留在主界面挡住操作 */
    document.querySelectorAll('dialog[open]').forEach(function (d) {
      try { d.close(); } catch (err) {}
    });
    if (App.closePatPicker) App.closePatPicker();
    if (App.hideToolPanels) App.hideToolPanels();
    if (App.hideChatBanner) App.hideChatBanner();
    rememberView(view);
    if (App.closeMsgActions) App.closeMsgActions();
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    app.dataset.view = view;

    if (view === 'desktop') {
      if (App.showDeskPage) App.showDeskPage(0);
      App.renderDesktop();
    }
    else if (view === 'contacts') App.renderContacts();
    else if (view === 'chat') App.renderChat();
    else if (view === 'moments') {
      if (App.maybeTaPosts) App.maybeTaPosts();
      App.renderMoments();
    }
    else if (view === 'cards') {
      /* 每次进入字卡库都回到「全部」，避免上次停留的分类或搜索词把列表清空 */
      App.cardFilter = { q: '', cat: '全部' };
      const search = document.getElementById('card-search');
      if (search) search.value = '';
      App.renderCards();
    }
    else if (view === 'settings') App.renderSettings();
    else if (view === 'chat-settings') App.renderChatSettings();
    else if (view === 'calendar') App.renderCalendar();
    else if (view === 'music') App.renderMusic();
    else if (view === 'market') App.renderMarket();
    else if (view === 'favorites') {
      if (App.resetFavSelect) App.resetFavSelect();
      App.renderFavorites();
    }
    else if (view === 'mail') App.renderMail();
    else if (view === 'anniversary') App.renderAnniversaries();
    else if (view === 'notes') App.renderReminders();
    if (App.applyLook && (view === 'chat-settings' || view === 'desktop' || view === 'chat')) App.applyLook();
  };

  App.toast = function (message) {
    const box = document.getElementById('toast');
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.remove('show'); }, 1800);
  };

  App.applyTheme = function () {
    const theme = App.state.theme || 'mist';
    app.className = 'app theme-' + theme;
    const colors = { sand: '#f6f1e9', mist: '#edf5fc', rose: '#f9eff1', night: '#14161c' };
    const color = colors[theme] || colors.sand;
    document.documentElement.style.setProperty('--shell-bg', color);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
  };

  /* 跟随可视视口高度，避免弹出输入法时底部露出空白。 */
  function syncAppHeight() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    if (height) document.documentElement.style.setProperty('--app-height', Math.round(height) + 'px');
  }
  syncAppHeight();
  window.addEventListener('resize', syncAppHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncAppHeight);
    window.visualViewport.addEventListener('scroll', syncAppHeight);
  }

  App.updateBadges = function () {
    const total = Object.keys(App.unread).reduce(function (sum, key) {
      return sum + (App.unread[key] || 0);
    }, 0);
    const badge = document.getElementById('d-badge-msg');
    if (badge) {
      badge.hidden = total === 0;
      badge.textContent = total > 99 ? '99+' : String(total);
    }
    const chatDot = document.getElementById('d-badge-chat');
    if (chatDot) {
      chatDot.hidden = total === 0;
      chatDot.textContent = total > 99 ? '99+' : String(total);
    }
    if (App.updateMailBadge) App.updateMailBadge();
  };

  /* ---------- 主页新消息横幅 ---------- */
  const lastSeen = {};
  let watchReady = false;
  let bannerContactId = null;
  let bannerTimer = null;

  function hideChatBanner() {
    const box = document.getElementById('chat-banner');
    if (box) box.hidden = true;
    bannerContactId = null;
    clearTimeout(bannerTimer);
  }
  App.hideChatBanner = hideChatBanner;

  App.showChatBanner = function (contactId, message) {
    if (document.hidden) return;
    if (App.chatOpen && App.chatOpen(contactId)) return;
    const contact = (App.state.contacts || []).find(function (c) { return c.id === contactId; });
    const box = document.getElementById('chat-banner');
    if (!contact || !box || !message) return;

    document.getElementById('chat-banner-avatar').innerHTML = App.avatarHtml(contact.avatar);
    document.getElementById('chat-banner-name').textContent = contact.name;
    document.getElementById('chat-banner-text').textContent = App.messagePreview(message);
    document.getElementById('chat-banner-time').textContent = '现在';
    box.dataset.contact = contactId;

    if (bannerContactId !== contactId) {
      box.hidden = false;
      box.style.animation = 'none';
      void box.offsetWidth;
      box.style.animation = '';
    }
    box.hidden = false;
    bannerContactId = contactId;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideChatBanner, 4800);
  };

  document.getElementById('chat-banner').addEventListener('click', function () {
    const id = this.dataset.contact;
    hideChatBanner();
    if (id) App.openChat(id);
  });

  function seedSeenChats() {
    Object.keys(App.state.chats || {}).forEach(function (id) {
      const chat = App.state.chats[id] || [];
      lastSeen[id] = chat.length ? chat[chat.length - 1].id : '';
    });
    watchReady = true;
  }

  function watchChats() {
    if (!watchReady) return;
    const chats = App.state.chats || {};
    Object.keys(chats).forEach(function (id) {
      const chat = chats[id] || [];
      const last = chat[chat.length - 1];
      const lastId = last ? last.id : '';
      if (lastSeen[id] === lastId) return;
      lastSeen[id] = lastId;
      if (!last || last.role !== 'ta') return;
      App.showChatBanner(id, last);
    });
  }

  const rawSave = App.save;
  App.save = function () {
    rawSave.apply(App, arguments);
    watchChats();
  };
  App.renderAll = function () {
    App.renderDesktop();
    App.renderContacts();
    App.renderMoments();
    if (App.chatContactId) App.renderChat();
    App.renderCards();
    App.renderSettings();
    if (App.renderMusic) App.renderMusic();
  };

  document.addEventListener('click', function (e) {
    const go = e.target.closest('[data-go]');
    if (go) {
      App.go(go.dataset.go);
      return;
    }
    const back = e.target.closest('[data-back]');
    if (back) App.go(back.dataset.back);
  });

  document.querySelectorAll('dialog [data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.closest('dialog').close();
    });
  });

  /* 页面加载时如果还有弹窗处于打开状态，先关掉 */
  document.querySelectorAll('dialog[open]').forEach(function (d) {
    try { d.close(); } catch (err) {}
  });

  /* 同一个时间只允许一个弹窗：打开新弹窗前先关掉其它已打开的，避免叠层卡死 */
  if (window.HTMLDialogElement) {
    const nativeShowModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      document.querySelectorAll('dialog[open]').forEach(function (other) {
        if (other !== this) {
          try { other.close(); } catch (err) {}
        }
      });
      if (!this.open) nativeShowModal.call(this);
    };
    const nativeShow = HTMLDialogElement.prototype.show;
    HTMLDialogElement.prototype.show = function () {
      document.querySelectorAll('dialog[open]').forEach(function (other) {
        if (other !== this) {
          try { other.close(); } catch (err) {}
        }
      });
      if (!this.open) nativeShow.call(this);
    };
  }

  /* 统一的关闭兜底：任何带 data-close 的按钮都能关掉所在弹窗 */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-close]');
    if (!btn) return;
    const dialog = btn.closest('dialog');
    if (dialog) {
      e.preventDefault();
      dialog.close();
    }
  });

  /* 点弹窗外的遮罩也能关闭 */
  document.addEventListener('click', function (e) {
    if (e.target.tagName !== 'DIALOG') return;
    const rect = e.target.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) e.target.close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
    }
  });

  /* 数据在 IndexedDB 里，读取是异步的，读完再初始化界面 */
  function boot() {
  seedSeenChats();
  App.chatContactId = null;
  App.applyTheme();

  App.initDesktop();
  App.initChat();
  App.initCards();
  App.initSettings();
  App.initMoments();
  App.initCalendar();
  App.initMusic();
  App.initMarket();
  App.initMail();
  if (App.initExtras) App.initExtras();

  let lastView = null;
  try { lastView = JSON.parse(sessionStorage.getItem('xuyu.view') || 'null'); } catch (e) { lastView = null; }
  /* 选图前写入的记忆，localStorage 比 sessionStorage 更容易在系统重载后保留 */
  let pickView = null;
  try {
    pickView = localStorage.getItem('xuyu.pickView');
    localStorage.removeItem('xuyu.pickView');
  } catch (e) { pickView = null; }

  App.go('desktop');

  /* 旧版本的语音存在 localStorage 里，这里悄悄搬进 IndexedDB */
  if (App.migrateVoiceToIdb) {
    App.migrateVoiceToIdb().then(function (count) {
      if (!count) return;
      App.renderAll();
    }).catch(function () {});
  }

  /* 手机选图时页面可能被系统重载，重载后回到原来的聊天 */
  if (pickView && App.state.contacts.some(function (c) { return c.id === pickView; })) {
    App.openChat(pickView);
  } else if (lastView && lastView.view === 'chat' && lastView.contactId &&
      App.state.contacts.some(function (c) { return c.id === lastView.contactId; })) {
    App.openChat(lastView.contactId);
  }

  /* 选图过程中页面被系统重载时，给出明确提示并重新打开表情面板 */
  let pickInterrupted = false;
  try {
    const pickedAt = Number(sessionStorage.getItem('xuyu.stickerPick')) || 0;
    sessionStorage.removeItem('xuyu.stickerPick');
    pickInterrupted = pickedAt > 0 && Date.now() - pickedAt < 10 * 60 * 1000;
  } catch (e) {}
  if ((pickInterrupted || pickView) && App.chatContactId) {
    setTimeout(function () {
      if (App.openStickerPanel) App.openStickerPanel();
      if (App.stickerNotice) App.stickerNotice('上次选图被系统中断了，请重新选择', true);
      App.toast('上次选图被系统中断了，请重新选择');
    }, 400);
  }

  /* 如果上次选中的图片已暂存，重载后自动恢复成表情包 */
  setTimeout(function () {
    if (App.recoverPendingStickers) App.recoverPendingStickers();
  }, 900);
  }

  App.load().then(boot, function () {
    if (!App.state) App.state = App.seedState();
    boot();
  });
})();
