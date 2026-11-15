/* 入口与路由 */
(function () {
  const App = window.App;
  const app = document.getElementById('app');

  App.go = function (view) {
    /* 切页面前关掉所有弹窗，避免弹窗留在主界面挡住操作 */
    document.querySelectorAll('dialog[open]').forEach(function (d) {
      try { d.close(); } catch (err) {}
    });
    if (App.closePatPicker) App.closePatPicker();
    if (App.hideToolPanels) App.hideToolPanels();
    if (App.hideChatBanner) App.hideChatBanner();
    if (App.closeMsgActions) App.closeMsgActions();
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    app.dataset.view = view;

    if (view === 'desktop') {
      /* 从哪一页点进功能，退出就停在哪一页，不自动滑回第一页 */
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

  /* 站内确认弹窗：返回 Promise<boolean>，替代系统 confirm */
  App.confirmDialog = function (text, options) {
    const dialog = document.getElementById('confirm-dialog');
    if (!dialog) return Promise.resolve(window.confirm(text));
    const opts = options || {};
    document.getElementById('confirm-title').textContent = opts.title || '确认操作';
    document.getElementById('confirm-text').textContent = text;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = opts.okText || '确定';
    return new Promise(function (resolve) {
      let settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        okBtn.removeEventListener('click', onOk);
        dialog.removeEventListener('close', onClose);
        if (dialog.open) dialog.close();
        resolve(value);
      }
      function onOk() { finish(true); }
      function onClose() { finish(false); }
      okBtn.addEventListener('click', onOk);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
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
  let lastAppHeight = 0;
  let heightRaf = 0;
  let expandTimer = 0;

  function applyAppHeight() {
    heightRaf = 0;
    const viewport = window.visualViewport;
    const height = Math.round((viewport ? viewport.height : window.innerHeight) || 0);
    if (!height) return;
    const diff = lastAppHeight > 0 ? height - lastAppHeight : 0;
    lastAppHeight = height;
    if (Math.abs(diff) > 24) {
      /* 输入法弹出往上收、收起往下放，都让高度平滑过渡，输入框跟着键盘一起移动 */
      document.documentElement.classList.add('is-keyboard-animating');
      clearTimeout(expandTimer);
      expandTimer = setTimeout(function () {
        document.documentElement.classList.remove('is-keyboard-animating');
      }, 320);
    }
    document.documentElement.style.setProperty('--app-height', height + 'px');
    /* iOS 会把可视视口往上平移去露出输入框，拉回原位，避免输入框先停在上面再掉下来 */
    if (viewport && viewport.offsetTop > 0) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
    }
  }

  /* 输入法弹出/收起会连续触发几十次 resize，合并到每帧只改一次高度，避免卡顿 */
  function syncAppHeight() {
    if (heightRaf) return;
    heightRaf = requestAnimationFrame(applyAppHeight);
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
      if (App.notifyMessage) App.notifyMessage(id, last);
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
