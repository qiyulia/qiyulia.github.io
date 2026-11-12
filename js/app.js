/* 入口与路由 */
(function () {
  const App = window.App;
  const app = document.getElementById('app');

  App.go = function (view) {
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    app.dataset.view = view;

    if (view === 'desktop') App.renderDesktop();
    else if (view === 'contacts') App.renderContacts();
    else if (view === 'chat') App.renderChat();
    else if (view === 'cards') App.renderCards();
    else if (view === 'settings') App.renderSettings();
  };

  App.toast = function (message) {
    const box = document.getElementById('toast');
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.remove('show'); }, 1800);
  };

  App.applyTheme = function () {
    const theme = App.state.theme || 'sand';
    app.className = 'app theme-' + theme;
    const colors = { sand: '#f6f1e9', mist: '#eef3f3', rose: '#f9eff1', night: '#14161c' };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors[theme] || colors.sand);
  };

  App.updateBadges = function () {
    const total = Object.keys(App.unread).reduce(function (sum, key) {
      return sum + (App.unread[key] || 0);
    }, 0);
    const badge = document.getElementById('d-badge-msg');
    if (badge) {
      badge.hidden = total === 0;
      badge.textContent = total > 99 ? '99+' : String(total);
    }
  };

  App.renderAll = function () {
    App.renderDesktop();
    App.renderContacts();
    if (App.chatContactId) App.renderChat();
    App.renderCards();
    App.renderSettings();
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

  App.go('desktop');
})();
