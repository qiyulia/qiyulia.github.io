/* 设置、本地数据与备份 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function storageSize() {
    try {
      const bytes = new Blob([JSON.stringify(App.state)]).size;
      el('#storage-size').textContent = '本地数据约 ' + (bytes / 1024).toFixed(1) + ' KB';
    } catch (e) {
      el('#storage-size').textContent = '';
    }
  }

  App.renderSettings = function () {
    const st = App.state;
    el('#set-name').value = st.profile.userName || '';
    el('#set-avatar').value = st.profile.userAvatar || '';
    el('#set-since').value = st.profile.since || '';
    el('#set-min').value = st.settings.replyMin;
    el('#set-max').value = st.settings.replyMax;
    el('#set-typing').value = String(st.settings.typingMs || 700);
    el('#set-ta-like').value = String(st.settings.taLikeProb == null ? 60 : st.settings.taLikeProb);
    el('#set-ta-comment').value = String(st.settings.taCommentProb == null ? 40 : st.settings.taCommentProb);
    el('#set-ta-moment-cards').value = String(st.settings.taMomentCards == null ? 1 : st.settings.taMomentCards);

    document.querySelectorAll('#theme-row [data-theme]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.theme === st.theme);
    });
    storageSize();
  };

  function markDirty() {
    App.save();
    App.renderDesktop();
    storageSize();
  }

  App.initSettings = function () {
    el('#set-name').addEventListener('input', function (e) {
      App.state.profile.userName = e.target.value;
      markDirty();
    });

    el('#set-avatar').addEventListener('input', function (e) {
      App.state.profile.userAvatar = e.target.value;
      markDirty();
    });

    el('#set-since').addEventListener('change', function (e) {
      App.state.profile.since = e.target.value;
      markDirty();
    });

    el('#set-min').addEventListener('change', function (e) {
      let v = Math.max(0, Math.min(5, Number(e.target.value) || 0));
      const max = Number(App.state.settings.replyMax) || 0;
      if (v > max) {
        v = max;
        e.target.value = v;
      }
      App.state.settings.replyMin = v;
      markDirty();
    });

    el('#set-max').addEventListener('change', function (e) {
      let v = Math.max(0, Math.min(5, Number(e.target.value) || 0));
      const min = Number(App.state.settings.replyMin) || 0;
      if (v < min) {
        v = min;
        e.target.value = v;
      }
      App.state.settings.replyMax = v;
      markDirty();
    });

    el('#set-typing').addEventListener('change', function (e) {
      App.state.settings.typingMs = Number(e.target.value) || 700;
      markDirty();
    });

    el('#set-ta-like').addEventListener('change', function (e) {
      App.state.settings.taLikeProb = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      markDirty();
    });

    el('#set-ta-comment').addEventListener('change', function (e) {
      App.state.settings.taCommentProb = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      markDirty();
    });

    el('#set-ta-moment-cards').addEventListener('change', function (e) {
      App.state.settings.taMomentCards = Math.max(1, Math.min(3, Number(e.target.value) || 1));
      markDirty();
    });

    el('#theme-row').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      App.state.theme = btn.dataset.theme;
      App.applyTheme();
      markDirty();
      App.renderSettings();
    });

    el('#btn-export-all').addEventListener('click', function () {
      App.downloadJSON({
        app: 'xuyu',
        type: 'backup',
        exportedAt: new Date().toISOString(),
        data: App.state,
      }, 'xuyu-backup-' + App.stamp() + '.json');
      App.toast('备份已导出');
    });

    el('#btn-import-all').addEventListener('click', function () {
      el('#file-import-all').click();
    });

    el('#file-import-all').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;

      App.readJSONFile(file).then(function (payload) {
        const data = payload && payload.data ? payload.data : payload;
        if (!data || data.version !== 1 || !Array.isArray(data.contacts) || !Array.isArray(data.cards)) {
          throw new Error('这不是絮语的备份文件');
        }
        if (!confirm('导入会覆盖当前的全部数据，确定继续？')) return;

        if (!data.chats || typeof data.chats !== 'object' || Array.isArray(data.chats)) data.chats = {};
        if (!Array.isArray(data.moments)) data.moments = [];
        if (!data.stickers || typeof data.stickers !== 'object') data.stickers = { mine: [], ta: [] };
        if (!Array.isArray(data.stickers.mine)) data.stickers.mine = [];
        if (!Array.isArray(data.stickers.ta)) data.stickers.ta = [];
        if (!data.profile) data.profile = { userName: '我', userAvatar: '🍊', since: '' };
        if (!data.settings) data.settings = { replyMin: 1, replyMax: 2, typingMs: 700 };
        if (data.settings.taLikeProb == null) data.settings.taLikeProb = 60;
        if (data.settings.taCommentProb == null) data.settings.taCommentProb = 40;
        if (data.settings.taMomentCards == null) data.settings.taMomentCards = 1;
        if (!data.theme) data.theme = 'sand';
        data.contacts.forEach(function (c) {
          if (!c.id) c.id = App.uid('c');
          if (!data.chats[c.id]) data.chats[c.id] = [];
        });
        App.state = data;
        App.chatContactId = null;
        App.unread = {};
        App.save();
        App.applyTheme();
        App.renderAll();
        App.go('desktop');
        App.toast('备份已导入');
      }).catch(function (err) {
        App.toast(err.message || '导入失败');
      });
    });

    el('#btn-reset').addEventListener('click', function () {
      if (!confirm('清空全部数据并恢复初始状态？建议先导出备份。')) return;
      App.state = App.seedState();
      App.chatContactId = null;
      App.unread = {};
      App.cardFilter = { q: '', cat: '全部' };
      App.save();
      App.applyTheme();
      App.renderAll();
      App.go('desktop');
      App.toast('已恢复初始状态');
    });
  };
})();
