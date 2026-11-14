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
    else if (view === 'cards') App.renderCards();
    else if (view === 'settings') App.renderSettings();
    else if (view === 'chat-settings') App.renderChatSettings();
    else if (view === 'calendar') App.renderCalendar();
    else if (view === 'music') App.renderMusic();
    else if (view === 'market') App.renderMarket();
    else if (view === 'mail') App.renderMail();
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
    if (App.updateMailBadge) App.updateMailBadge();
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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
    }
  });

  App.load();
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

  let lastView = null;
  try { lastView = JSON.parse(sessionStorage.getItem('xuyu.view') || 'null'); } catch (e) { lastView = null; }

  App.go('desktop');

  /* 手机选图时页面可能被系统重载，重载后回到原来的聊天 */
  if (lastView && lastView.view === 'chat' && lastView.contactId &&
      App.state.contacts.some(function (c) { return c.id === lastView.contactId; })) {
    App.openChat(lastView.contactId);
  }
})();
