window.__SHIYI_B_app='20261121-clock1';
/* 入口与路由 */
(function () {
  const App = window.App;
  const app = document.getElementById('app');

  /* 全站禁止缩放：双指、双击和桌面 Ctrl+滚轮都不放大 */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gestureend', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  /* 防双击缩放改由 CSS 的 touch-action: manipulation 处理。
     原来这段全局 touchend 拦截有致命副作用：自定义按钮（div.btn、span、
     覆盖层里的空白区）不在白名单里，用户第一次点没反应后再点一次就会命中
     300ms 判定，e.preventDefault() 直接取消后续 click，
     于是「点导入不弹文件框」且换任何浏览器都一样。此处整段移除。 */
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  App.go = function (view, skipDataLoad) {
    /* 点击哪个模块就先读哪个；读完后只在仍停留该页时重渲一次 */
    if (!skipDataLoad && App.loadViewData) {
      const pendingData = App.loadViewData(view);
      if (pendingData) {
        pendingData.then(function () {
          /* 只补一次渲染，不再触发同一路由的加载，读取失败也不会递归重试 */
          if (app.dataset.view === view) App.go(view, true);
        }).catch(function () {});
      }
    }
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
      if (App.markMomentsSeen) App.markMomentsSeen();
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
    else if (view === 'location' && App.renderLocation) App.renderLocation();
    else if (view === 'memorywall' && App.renderMemoryWall) App.renderMemoryWall();
    else if (view === 'mood' && App.renderMood) App.renderMood();
    else if (view === 'clock' && App.renderClock) App.renderClock();
    else if (view === 'groups' && App.renderGroups) App.renderGroups();
    else if (view === 'group-chat' && App.renderGroupChat) App.renderGroupChat();
    else if (view === 'group-settings' && App.renderGroupSettings) App.renderGroupSettings();
    else if (view === 'steps') {
      /* 安装成 App 后启动时模块初始化偶发失败，按钮会全部没监听。
         进入步数页时补一次初始化（幂等，不会重复绑定）。 */
      if (App.initSteps) { try { App.initSteps(); } catch (err) {} }
      if (App.renderSteps) App.renderSteps();
    }
    if (App.applyLook && (view === 'chat-settings' || view === 'desktop' || view === 'chat' || view === 'group-chat')) App.applyLook();
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
    if (App.applyIconStyle) App.applyIconStyle();
  };

  /* 跟随可视视口高度，避免弹出输入法时底部露出空白。 */
  let lastAppHeight = 0;
  let heightRaf = 0;
  let expandTimer = 0;

  /* 问卷浮层打开时，键盘弹出不改外壳高度：弹窗按原尺寸停在原位置 */
  function surveyOverlayOpen() {
    const ids = ['survey-dialog', 'survey-answer-dialog'];
    for (let i = 0; i < ids.length; i++) {
      const node = document.getElementById(ids[i]);
      if (node && !node.hidden) return true;
    }
    return false;
  }

  function applyAppHeight() {
    heightRaf = 0;
    const viewport = window.visualViewport;
    const height = Math.round((viewport ? viewport.height : window.innerHeight) || 0);
    if (!height) return;
    if (surveyOverlayOpen()) {
      if (viewport && viewport.offsetTop > 0) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
      }
      return;
    }
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
  App.syncAppHeight = syncAppHeight;
  window.addEventListener('resize', syncAppHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncAppHeight);
    window.visualViewport.addEventListener('scroll', syncAppHeight);
  }

  App.updateBadges = function () {
    const groupIds = (App.state && Array.isArray(App.state.groups)) ? App.state.groups.map(function (g) { return g.id; }) : [];
    const isGroup = {};
    groupIds.forEach(function (id) { isGroup[id] = true; });
    /* 单聊角标不含群聊未读，群聊单独一个角标 */
    const total = Object.keys(App.unread).reduce(function (sum, key) {
      if (isGroup[key]) return sum;
      return sum + (App.unread[key] || 0);
    }, 0);
    const badge = document.getElementById('d-badge-msg');
    if (badge) {
      badge.hidden = total === 0;
      badge.textContent = total > 99 ? '99+' : String(total);
    }
    /* 群聊有自己的角标 */
    const groupTotal = groupIds.reduce(function (sum, id) { return sum + (App.unread[id] || 0); }, 0);
    const groupBadge = document.getElementById('d-badge-groups');
    if (groupBadge) {
      groupBadge.hidden = groupTotal === 0;
      groupBadge.textContent = groupTotal > 99 ? '99+' : String(groupTotal);
    }
    const chatDot = document.getElementById('d-badge-chat');
    if (chatDot) {
      chatDot.hidden = total === 0;
      chatDot.textContent = total > 99 ? '99+' : String(total);
    }
    if (App.updateMailBadge) App.updateMailBadge();
    if (App.updateMomentsBadge) App.updateMomentsBadge();
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
      /* 懒加载首次读回的历史消息不是新消息，只登记位置，不弹横幅 */
      if (!Object.prototype.hasOwnProperty.call(lastSeen, id)) {
        lastSeen[id] = lastId;
        return;
      }
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

  /* 每个模块独立初始化：单个模块抛错不能拖垮整站的事件绑定，
     否则就会出现「界面在、但什么都点不了」的假死状态。 */
  ['initDesktop','initChat','initCards','initSettings','initMoments','initCalendar',
   'initMusic','initMarket','initMail','initExtras','initCompanion','initMemoir',
   'initGroups','initSteps','initClock'].forEach(function (name) {
    const fn = App[name];
    if (typeof fn !== 'function') return;
    try { fn.call(App); } catch (e) {
      try { console.error('[boot] ' + name + ' 初始化失败：', e); } catch (_) {}
    }
  });

  /* 旧版本在选图时写入的跳转标记已废弃：启动时直接清掉，不再据此自动打开聊天或
     表情面板。老用户升级后刷新一次即可摆脱之前被卡住的状态。 */
  try { localStorage.removeItem('xuyu.pickView'); } catch (e) {}
  try { sessionStorage.removeItem('xuyu.stickerPick'); } catch (e) {}

  App.go('desktop');

  /* 旧版本的语音存在 localStorage 里，这里悄悄搬进 IndexedDB */
  if (App.migrateVoiceToIdb) {
    App.migrateVoiceToIdb().then(function (count) {
      if (!count) return;
      App.renderAll();
    }).catch(function () {});
  }

  /* 表情包不在启动时预读：几百张 base64 全读进内存会让手机一开站就卡。
     改为打开表情面板时按需加载（面板自己会显示「正在加载」并重渲）。 */

  /* 聊天图片 / 已发出的表情包 / 动态配图外置到 IndexedDB。
     首次运行会把旧版本留在主 state 里的 base64 搬走，之后 serialize 不再卡主线程。 */
  if (App.migrateImagesToIdb) {
    App.migrateImagesToIdb().then(function (count) {
      if (!count) return;
      if (App.renderChat) App.renderChat();
    }).catch(function () {});
  }

  /* 用户不点任何东西时，后台按模块慢慢补齐，不一次性读整包 */
  if (App.lazyLoadRemaining) App.lazyLoadRemaining();

  }

  /* 界面按用户自己的数据渲染完成后，通知开屏动画「内容已就绪」。
     双 rAF 确保这一帧真正画出来；开屏会在「动画放满 + 就绪」都满足后淡出。 */
  function notifyBootReady() {
    /* 必须同步先调一次：页面在后台或标签页被节流时 rAF 可能不触发，
       只靠双 rAF 会让开屏一直挂着并吃掉所有点击。 */
    if (window.__bootReady) window.__bootReady();
    else if (window.hideBootSplash) window.hideBootSplash();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (window.__bootReady) window.__bootReady();
      });
    });
  }

  /* 无论 boot 正常完成还是中途某个模块异常，都通知开屏（幂等）。
     这样偶发的脚本加载问题也不会把人一直挡在开屏页。 */
  var booted = false;
  /* seedMode=true 表示「真实数据还没读回来，先用空数据把界面撑起来」。
     此时 App.dataReady=false，store.js 的 writeState() 会整体挂起，
     绝不会把种子数据写进 IndexedDB 覆盖掉真实存档。 */
  function runBoot(seedMode) {
    if (booted) return;          /* 超时兜底与正常完成只能跑一次，避免重复绑定事件 */
    booted = true;
    if (!App.state) App.state = App.seedState();
    App.dataReady = !seedMode;
    try { boot(); } finally { notifyBootReady(); }
  }
  /* 3 秒还没读完：先让界面和事件绑定起来（开屏也会消失），但只是占位。 */
  var loadGuard = setTimeout(function () { runBoot(true); }, 3000);
  App.load().then(function (realState) {
    clearTimeout(loadGuard);
    if (booted && App.dataReady === false) {
      /* 真实数据晚到了：换回来、整体重渲，之前那屏种子界面作废。
         hotfix1 缺的正是这一步 —— 只起界面不换数据，
         于是「刚进去能用，过一会数据全空 / 又点不动」。 */
      App.dataReady = true;
      if (realState) App.state = realState;
      try { App.renderAll(); } catch (e) {}
      try { App.go(app.dataset.view || 'desktop'); } catch (e) {}
      try { if (App.lazyLoadRemaining) App.lazyLoadRemaining(); } catch (e) {}
      try { App.save(); } catch (e) {}
    } else {
      runBoot(false);
    }
  }, function () {
    clearTimeout(loadGuard);
    runBoot(false);
  });
})();
