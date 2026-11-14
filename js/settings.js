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

  let chatSettingsPage = 0;

  function showChatSettingsPage(index) {
    const pager = el('#chat-settings-pager');
    if (!pager) return;
    const pages = Array.from(pager.querySelectorAll('.chat-settings-page'));
    chatSettingsPage = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));

    pages.forEach(function (page, pageIndex) {
      const inactive = pageIndex !== chatSettingsPage;
      page.hidden = inactive;
      page.inert = inactive;
      page.setAttribute('aria-hidden', String(inactive));
    });

    document.querySelectorAll('[data-chat-settings-page]').forEach(function (tab) {
      const active = Number(tab.dataset.chatSettingsPage) === chatSettingsPage;
      tab.classList.toggle('is-on', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  function initChatSettingsPager() {
    showChatSettingsPage(0);
    el('.chat-settings-tabs').addEventListener('click', function (e) {
      const tab = e.target.closest('[data-chat-settings-page]');
      if (tab) showChatSettingsPage(Number(tab.dataset.chatSettingsPage));
    });
  }

  /* 设置页：资料 / 美化 两个分类 */
  function initSettingsPager() {
    const tabs = document.querySelectorAll('[data-settings-page]');
    const pages = document.querySelectorAll('[data-settings-panel]');

    function show(name) {
      pages.forEach(function (page) {
        const active = page.dataset.settingsPanel === name;
        page.hidden = !active;
      });
      tabs.forEach(function (tab) {
        const active = tab.dataset.settingsPage === name;
        tab.classList.toggle('is-on', active);
        tab.setAttribute('aria-selected', String(active));
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab.dataset.settingsPage); });
    });
    show('profile');
  }

  App.renderSettings = function () {
    const st = App.state;
    el('#set-name').value = st.profile.userName || '';
    el('#set-avatar-preview').innerHTML = App.avatarHtml(st.profile.userAvatar);
    el('#set-since').value = st.profile.since || '';
    el('#set-min').value = st.settings.replyMin;
    el('#set-max').value = st.settings.replyMax;
    el('#set-typing').value = st.settings.typingMin == null ? 0.1 : st.settings.typingMin;
    el('#set-ta-msg-prob').value = st.settings.taMsgProb == null ? 8 : st.settings.taMsgProb;
    el('#set-ta-ignore').value = st.settings.taIgnoreProb == null ? 15 : st.settings.taIgnoreProb;
    el('#set-emotion-prob').value = st.settings.emotionProb == null ? 30 : st.settings.emotionProb;
    el('#set-ta-like').value = st.settings.taLikeProb == null ? 60 : st.settings.taLikeProb;
    el('#set-ta-comment').value = st.settings.taCommentProb == null ? 40 : st.settings.taCommentProb;
    el('#set-ta-moment-prob').value = st.settings.taMomentProb == null ? 25 : st.settings.taMomentProb;
    el('#set-ta-moment-daily').value = st.settings.taMomentDailyMax == null ? 3 : st.settings.taMomentDailyMax;
    el('#set-ta-moment-gap-min').value = st.settings.taMomentGapMin == null ? 10 : st.settings.taMomentGapMin;
    el('#set-ta-moment-gap-max').value = st.settings.taMomentGapMax == null ? 60 : st.settings.taMomentGapMax;
    el('#set-ta-moment-card-min').value = st.settings.taMomentCardMin == null ? 1 : st.settings.taMomentCardMin;
    el('#set-ta-moment-card-max').value = st.settings.taMomentCardMax == null ? 3 : st.settings.taMomentCardMax;
    el('#set-pat-back').value = st.settings.patBackProb == null ? 50 : st.settings.patBackProb;
    el('#set-ta-sticker').value = st.settings.taStickerProb == null ? 30 : st.settings.taStickerProb;
    el('#set-ta-recall').value = st.settings.taRecallProb == null ? 5 : st.settings.taRecallProb;
    el('#set-ta-quote').value = st.settings.taQuoteProb == null ? 20 : st.settings.taQuoteProb;
    el('#set-ta-fav').value = st.settings.taFavProb == null ? 15 : st.settings.taFavProb;
    el('#set-music-pause').value = st.settings.musicPauseProb == null ? 15 : st.settings.musicPauseProb;
    el('#set-music-play').value = st.settings.musicPlayProb == null ? 60 : st.settings.musicPlayProb;
    el('#set-music-fav').value = st.settings.musicFavProb == null ? 25 : st.settings.musicFavProb;
    el('#set-music-switch').value = st.settings.musicSwitchProb == null ? 30 : st.settings.musicSwitchProb;
    el('#set-call-incoming').value = st.settings.callIncomingProb == null ? 12 : st.settings.callIncomingProb;
    el('#set-call-answer').value = st.settings.callAnswerProb == null ? 70 : st.settings.callAnswerProb;
    el('#set-call-busy').value = st.settings.callBusyProb == null ? 15 : st.settings.callBusyProb;
    el('#set-call-reject').value = st.settings.callRejectProb == null ? 15 : st.settings.callRejectProb;
    el('#set-call-hangup').value = st.settings.callHangupProb == null ? 10 : st.settings.callHangupProb;
    el('#set-voice-transcript').checked = st.settings.voiceTranscript !== false;

    const partnerSelect = el('#set-partner');
    partnerSelect.innerHTML = st.contacts.length
      ? st.contacts.map(function (c) {
          return '<option value="' + App.esc(c.id) + '"' + (c.id === st.currentContactId ? ' selected' : '') + '>' + App.esc(c.name) + '</option>';
        }).join('')
      : '<option value="">还没有联系人</option>';
    const partner = st.contacts.find(function (c) { return c.id === st.currentContactId; });
    partnerSelect.disabled = !partner;
    el('#btn-edit-partner').disabled = !partner;
    el('#set-partner-avatar').innerHTML = App.avatarHtml(partner ? partner.avatar : '🙂');
    el('#set-partner-name').textContent = partner ? partner.name : 'TA';
    el('#set-partner-note').textContent = partner && partner.note ? partner.note : '还没有备注';
    el('#set-partner-birthday').textContent = partner && partner.birthday ? '生日 · ' + partner.birthday.replace(/-/g, '.') : '生日未填写';

    document.querySelectorAll('#theme-row [data-theme]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.theme === st.theme);
    });
    storageSize();
  };

  App.renderChatSettings = function () {
    App.renderSettings();
    const contact = App.state.contacts.find(function (c) { return c.id === App.chatContactId; });
    el('#chat-settings-delete-note').textContent = contact
      ? '删除你与「' + contact.name + '」的本次聊天记录，删除后无法恢复。'
      : '删除后，本次聊天记录将无法恢复。';
    showChatSettingsPage(0);
  };

  function markDirty() {
    App.save();
    App.renderDesktop();
    storageSize();
  }

  App.initSettings = function () {
    initChatSettingsPager();
    initSettingsPager();

    el('#set-name').addEventListener('input', function (e) {
      App.state.profile.userName = e.target.value;
      markDirty();
    });

    el('#btn-set-avatar').addEventListener('click', function () {
      el('#set-avatar-file').click();
    });

    el('#set-avatar-file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      App.compressImage(file, 192).then(function (src) {
        App.state.profile.userAvatar = src;
        markDirty();
        App.renderSettings();
        App.toast('头像已更新');
      }).catch(function (err) {
        App.toast(err.message || '图片读取失败');
      });
    });

    el('#set-since').addEventListener('change', function (e) {
      App.state.profile.since = e.target.value;
      markDirty();
    });

    el('#set-partner').addEventListener('change', function (e) {
      if (!App.state.contacts.some(function (c) { return c.id === e.target.value; })) return;
      App.state.currentContactId = e.target.value;
      App.save();
      App.renderAll();
    });

    el('#set-voice-transcript').addEventListener('change', function (e) {
      App.state.settings.voiceTranscript = !!e.target.checked;
      markDirty();
      if (App.renderChat) App.renderChat();
    });

    el('#btn-edit-partner').addEventListener('click', function () {
      const partner = App.state.contacts.find(function (c) { return c.id === App.state.currentContactId; });
      if (partner && App.openContactDialog) App.openContactDialog(partner);
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

    App.bindStepper('#set-typing', function (v) {
      App.state.settings.typingMin = v;
      markDirty();
    }, { min: 0, max: 5, step: 0.1, decimals: 1 });

    App.bindStepper('#set-ta-msg-prob', function (v) {
      App.state.settings.taMsgProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-ignore', function (v) {
      App.state.settings.taIgnoreProb = v;
      markDirty();
    });

    App.bindStepper('#set-emotion-prob', function (v) {
      App.state.settings.emotionProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-like', function (v) {
      App.state.settings.taLikeProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-comment', function (v) {
      App.state.settings.taCommentProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-moment-prob', function (v) {
      App.state.settings.taMomentProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-moment-daily', function (v) {
      App.state.settings.taMomentDailyMax = v;
      markDirty();
    }, { min: 1, max: 20, step: 1 });

    ['#set-ta-moment-gap-min', '#set-ta-moment-gap-max', '#set-ta-moment-card-min', '#set-ta-moment-card-max'].forEach(function (selector) {
      el(selector).addEventListener('change', function (e) {
        const key = {
          '#set-ta-moment-gap-min': 'taMomentGapMin',
          '#set-ta-moment-gap-max': 'taMomentGapMax',
          '#set-ta-moment-card-min': 'taMomentCardMin',
          '#set-ta-moment-card-max': 'taMomentCardMax',
        }[selector];
        let v = Math.max(0, Math.min(2880, Number(e.target.value) || 0));
        if (key === 'taMomentGapMax') v = Math.max(1, v);
        if (key === 'taMomentCardMin') v = Math.max(1, Math.min(9, v));
        if (key === 'taMomentCardMax') v = Math.max(1, Math.min(9, v));
        if (key === 'taMomentGapMin' && v > Number(App.state.settings.taMomentGapMax)) {
          v = Number(App.state.settings.taMomentGapMax);
        }
        if (key === 'taMomentGapMax' && v < Number(App.state.settings.taMomentGapMin)) {
          v = Number(App.state.settings.taMomentGapMin);
        }
        if (key === 'taMomentCardMin' && v > Number(App.state.settings.taMomentCardMax)) {
          v = Number(App.state.settings.taMomentCardMax);
        }
        if (key === 'taMomentCardMax' && v < Number(App.state.settings.taMomentCardMin)) {
          v = Number(App.state.settings.taMomentCardMin);
        }
        e.target.value = v;
        App.state.settings[key] = v;
        markDirty();
      });
    });

    App.bindStepper('#set-pat-back', function (v) {
      App.state.settings.patBackProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-sticker', function (v) {
      App.state.settings.taStickerProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-recall', function (v) {
      App.state.settings.taRecallProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-quote', function (v) {
      App.state.settings.taQuoteProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-fav', function (v) {
      App.state.settings.taFavProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-pause', function (v) {
      App.state.settings.musicPauseProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-play', function (v) {
      App.state.settings.musicPlayProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-fav', function (v) {
      App.state.settings.musicFavProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-switch', function (v) {
      App.state.settings.musicSwitchProb = v;
      markDirty();
    });

    App.bindStepper('#set-call-incoming', function (v) {
      App.state.settings.callIncomingProb = v;
      markDirty();
    });

    App.bindStepper('#set-call-answer', function (v) {
      App.state.settings.callAnswerProb = v;
      markDirty();
    });

    App.bindStepper('#set-call-busy', function (v) {
      App.state.settings.callBusyProb = v;
      markDirty();
    });

    App.bindStepper('#set-call-reject', function (v) {
      App.state.settings.callRejectProb = v;
      markDirty();
    });

    App.bindStepper('#set-call-hangup', function (v) {
      App.state.settings.callHangupProb = v;
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
        if (!Array.isArray(data.mail)) data.mail = [];
        data.mail = data.mail.filter(function (m) {
          return m && typeof m === 'object' && m.text;
        }).map(function (m) {
          if (!m.id) m.id = App.uid('mail');
          m.from = m.from === 'me' ? 'me' : 'ta';
          m.text = String(m.text);
          m.ts = Number(m.ts) || Date.now();
          m.read = m.from === 'me' ? true : !!m.read;
          m.fav = !!m.fav;
          if (!m.contactId) m.contactId = data.currentContactId;
          return m;
        });
        if (!data.calendar || typeof data.calendar !== 'object') data.calendar = {};
        if (!data.stickers || typeof data.stickers !== 'object') data.stickers = { mine: [], ta: [] };
        if (!Array.isArray(data.stickers.mine)) data.stickers.mine = [];
        if (!Array.isArray(data.stickers.ta)) data.stickers.ta = [];
        if (!data.profile) data.profile = { userName: '我', userAvatar: '🍊', since: '' };
        if (!data.settings) data.settings = { replyMin: 1, replyMax: 2, typingMin: 0.1 };
        if (data.settings.typingMin == null) {
          const legacyMs = Number(data.settings.typingMs);
          data.settings.typingMin = Number.isFinite(legacyMs)
            ? Math.max(0.1, Math.round(legacyMs / 6000) / 10)
            : 0.1;
        }
        delete data.settings.typingMs;
        if (data.settings.taMsgProb == null) data.settings.taMsgProb = 8;
        if (data.settings.taIgnoreProb == null) data.settings.taIgnoreProb = 15;
        if (data.settings.taLikeProb == null) data.settings.taLikeProb = 60;
        if (data.settings.taCommentProb == null) data.settings.taCommentProb = 40;
        if (data.settings.taMomentCards == null) data.settings.taMomentCards = 1;
        if (data.settings.taMomentProb == null) data.settings.taMomentProb = 25;
        if (data.settings.taMomentDailyMax == null) data.settings.taMomentDailyMax = 3;
        if (data.settings.taMomentGapMin == null) data.settings.taMomentGapMin = 10;
        if (data.settings.taMomentGapMax == null) data.settings.taMomentGapMax = 60;
        if (data.settings.taMomentCardMin == null) data.settings.taMomentCardMin = Number(data.settings.taMomentCards) || 1;
        if (data.settings.taMomentCardMax == null) data.settings.taMomentCardMax = Math.max(Number(data.settings.taMomentCardMin) || 1, Number(data.settings.taMomentCards) || 1);
        if (data.settings.emotionProb == null) data.settings.emotionProb = 30;
        if (data.settings.taRecallProb == null) data.settings.taRecallProb = 5;
        if (data.settings.taQuoteProb == null) data.settings.taQuoteProb = 20;
        if (data.settings.taFavProb == null) data.settings.taFavProb = 15;
        if (data.settings.musicPauseProb == null) data.settings.musicPauseProb = 15;
        if (data.settings.musicPlayProb == null) data.settings.musicPlayProb = 60;
        if (data.settings.musicFavProb == null) data.settings.musicFavProb = 25;
        if (data.settings.musicSwitchProb == null) data.settings.musicSwitchProb = 30;
        if (data.settings.callIncomingProb == null) data.settings.callIncomingProb = 12;
        if (data.settings.callAnswerProb == null) data.settings.callAnswerProb = 70;
        if (data.settings.callBusyProb == null) data.settings.callBusyProb = 15;
        if (data.settings.callRejectProb == null) data.settings.callRejectProb = 15;
        if (data.settings.callHangupProb == null) data.settings.callHangupProb = 10;
        if (!data.theme) data.theme = 'sand';
        data.contacts.forEach(function (c) {
          if (!c.id) c.id = App.uid('c');
          if (!data.chats[c.id]) data.chats[c.id] = [];
          if (!c.settings || typeof c.settings !== 'object') c.settings = {};
          if (typeof c.birthday !== 'string') c.birthday = '';
        });
        if (!data.contacts.some(function (c) { return c.id === data.currentContactId; })) {
          data.currentContactId = data.contacts.length ? data.contacts[0].id : null;
        }
        App.normalizeCards(data);
        App.normalizeMusic(data);
        if (App.resetMusicMedia) App.resetMusicMedia();
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
      if (App.resetMusicMedia) App.resetMusicMedia();
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
