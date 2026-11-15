/* 设置、本地数据与备份 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function storageSize() {
    try {
      const bytes = new Blob([JSON.stringify(App.state)]).size;
      el('#storage-size').textContent = '数据约 ' + (bytes / 1024).toFixed(1) + ' KB';
    } catch (e) {
      el('#storage-size').textContent = '';
    }
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + ' MB';
    return (value / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  /* 内存分类：已用/总容量 + 分类占用 */
  App.refreshMemoryStats = function () {
    const localNode = el('#memory-local');
    const voiceNode = el('#memory-voice');
    const musicNode = el('#memory-music');
    const totalNode = el('#memory-total');
    const usedNode = el('#memory-used');
    const quotaNode = el('#memory-quota');
    if (!localNode || !voiceNode || !totalNode) return Promise.resolve();
    [localNode, voiceNode, musicNode, totalNode, usedNode, quotaNode].forEach(function (node) {
      if (node) node.textContent = '统计中…';
    });
    return Promise.all([App.memoryUsage(), storageEstimate()]).then(function (results) {
      const usage = results[0];
      const estimate = results[1];
      localNode.textContent = formatBytes(usage.local);
      voiceNode.textContent = formatBytes(usage.voice) + '（' + usage.voiceCount + ' 段）';
      if (musicNode) musicNode.textContent = formatBytes(usage.music) + '（' + usage.musicCount + ' 首）';
      totalNode.textContent = formatBytes(usage.total);
      if (usedNode) usedNode.textContent = estimate ? formatBytes(estimate.usage) : '—';
      if (quotaNode) quotaNode.textContent = estimate ? formatBytes(estimate.quota) : '—';
    }).catch(function () {
      [localNode, voiceNode, musicNode, totalNode, usedNode, quotaNode].forEach(function (node) {
        if (node) node.textContent = '—';
      });
    });
  };

  /* 备份分类：可勾选导出哪些内容，导入时只覆盖勾选的分类 */
  const BACKUP_SCOPES = [
    { key: 'profile', label: '资料与联系人', fields: ['profile', 'contacts', 'currentContactId', 'avatarPool'] },
    { key: 'chats', label: '聊天记录', fields: ['chats'] },
    { key: 'cards', label: '字卡库', fields: ['cards'] },
    { key: 'stickers', label: '表情包', fields: ['stickers'] },
    { key: 'look', label: '外观美化', fields: ['theme', 'look', 'iconStyle'] },
    { key: 'settings', label: '互动设置', fields: ['settings'] },
    { key: 'anniv', label: '纪念日与笔记', fields: ['anniversaries', 'reminders'] },
    { key: 'moments', label: '朋友圈', fields: ['moments'] },
    { key: 'mail', label: '信箱', fields: ['mail'] },
    { key: 'calendar', label: '日历', fields: ['calendar'] },
    { key: 'music', label: '音乐列表', fields: ['music'] },
    { key: 'market', label: '集市与钱包', fields: ['wallet', 'market'] },
  ];

  function backupScopeInputs() {
    return Array.from(document.querySelectorAll('[data-backup-scope]'));
  }

  function selectedBackupScopes() {
    return BACKUP_SCOPES.filter(function (scope) {
      const input = document.querySelector('[data-backup-scope="' + scope.key + '"]');
      return input && input.checked;
    });
  }

  function applyBackupData(data, scopes) {
    const st = App.state;
    scopes.forEach(function (scope) {
      switch (scope.key) {
        case 'profile':
          if (data.profile && typeof data.profile === 'object') {
            st.profile = Object.assign({}, st.profile, data.profile);
          }
          if (Array.isArray(data.contacts) && data.contacts.length) {
            st.contacts = data.contacts.map(function (c) {
              const copy = Object.assign({}, c);
              if (!copy.id) copy.id = App.uid('c');
              if (typeof copy.birthday !== 'string') copy.birthday = '';
              if (!copy.settings || typeof copy.settings !== 'object') copy.settings = {};
              return copy;
            });
            const want = data.currentContactId;
            st.currentContactId = st.contacts.some(function (c) { return c.id === want; })
              ? want
              : st.contacts[0].id;
          }
          break;
        case 'chats':
          if (data.chats && typeof data.chats === 'object' && !Array.isArray(data.chats)) {
            st.chats = data.chats;
          }
          break;
        case 'cards':
          if (Array.isArray(data.cards)) st.cards = data.cards;
          break;
        case 'stickers':
          if (data.stickers && typeof data.stickers === 'object') {
            st.stickers = {
              mine: Array.isArray(data.stickers.mine) ? data.stickers.mine : [],
              ta: Array.isArray(data.stickers.ta) ? data.stickers.ta : [],
              public: Array.isArray(data.stickers.public) ? data.stickers.public : [],
            };
          }
          break;
        case 'look':
          if (data.theme) st.theme = data.theme;
          if (data.look && typeof data.look === 'object') st.look = Object.assign({}, st.look, data.look);
          if (data.iconStyle && typeof data.iconStyle === 'object') {
            st.iconStyle = Object.assign({}, st.iconStyle, data.iconStyle);
          }
          break;
        case 'settings':
          if (data.settings && typeof data.settings === 'object') {
            st.settings = Object.assign({}, st.settings, data.settings);
          }
          break;
        case 'anniv':
          if (Array.isArray(data.anniversaries)) st.anniversaries = data.anniversaries;
          if (Array.isArray(data.reminders)) st.reminders = data.reminders;
          break;
        case 'moments':
          if (Array.isArray(data.moments)) st.moments = data.moments;
          break;
        case 'mail':
          if (Array.isArray(data.mail)) st.mail = data.mail;
          break;
        case 'calendar':
          if (data.calendar && typeof data.calendar === 'object') st.calendar = data.calendar;
          break;
        case 'music':
          if (data.music) st.music = data.music;
          break;
        case 'market':
          if (data.wallet && typeof data.wallet === 'object') st.wallet = data.wallet;
          if (data.market && typeof data.market === 'object') st.market = data.market;
          break;
        default:
          break;
      }
    });

    App.normalizeCards(st);
    if (App.normalizeMusic) App.normalizeMusic(st);
    if (App.resetMusicMedia) App.resetMusicMedia();
    App.chatContactId = null;
    App.unread = {};
    App.save();
    App.applyTheme();
    if (App.applyLook) App.applyLook();
    App.renderAll();
    App.renderSettings();
    storageSize();
    App.updateBadges();
    App.go('desktop');
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
      if (name === 'memory' && App.refreshMemoryStats) App.refreshMemoryStats();
      if (name === 'backend') refreshNotifyStatus();
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
    el('#set-merge-prob').value = st.settings.mergeProb == null ? 15 : st.settings.mergeProb;
    el('#set-merge-min').value = st.settings.mergeMin == null ? 2 : st.settings.mergeMin;
    el('#set-merge-max').value = st.settings.mergeMax == null ? 3 : st.settings.mergeMax;
    el('#set-ta-redpacket-prob').value = st.settings.taRedpacketProb == null ? 8 : st.settings.taRedpacketProb;
    el('#set-rp-accept-prob').value = st.settings.redpacketAcceptProb == null ? 70 : st.settings.redpacketAcceptProb;
    el('#set-rp-return-prob').value = st.settings.redpacketReturnProb == null ? 20 : st.settings.redpacketReturnProb;
    el('#set-emotion-prob').value = st.settings.emotionProb == null ? 30 : st.settings.emotionProb;
    el('#set-ta-like').value = st.settings.taLikeProb == null ? 60 : st.settings.taLikeProb;
    el('#set-ta-comment').value = st.settings.taCommentProb == null ? 40 : st.settings.taCommentProb;
    el('#set-ta-moment-prob').value = st.settings.taMomentProb == null ? 25 : st.settings.taMomentProb;
    el('#set-ta-moment-daily').value = st.settings.taMomentDailyMax == null ? 3 : st.settings.taMomentDailyMax;
    el('#set-ta-moment-gap-min').value = st.settings.taMomentGapMin == null ? 10 : st.settings.taMomentGapMin;
    el('#set-ta-moment-gap-max').value = st.settings.taMomentGapMax == null ? 60 : st.settings.taMomentGapMax;
    el('#set-ta-moment-card-min').value = st.settings.taMomentCardMin == null ? 1 : st.settings.taMomentCardMin;
    el('#set-ta-moment-card-max').value = st.settings.taMomentCardMax == null ? 3 : st.settings.taMomentCardMax;
    el('#set-ta-moment-cooldown').value = st.settings.taMomentCooldownMin == null ? 10 : st.settings.taMomentCooldownMin;
    el('#set-pat-back').value = st.settings.taPatProb == null ? 10 : st.settings.taPatProb;
    el('#set-ta-sticker').value = st.settings.taStickerProb == null ? 30 : st.settings.taStickerProb;
    el('#set-ta-voice-prob').value = st.settings.taVoiceProb == null ? 20 : st.settings.taVoiceProb;
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
    el('#set-avatar-self-prob').value = st.settings.avatarSelfProb == null ? 40 : st.settings.avatarSelfProb;
    el('#set-avatar-me-prob').value = st.settings.avatarMeProb == null ? 25 : st.settings.avatarMeProb;
    el('#set-avatar-cooldown').value = st.settings.avatarCooldownMin == null ? 30 : st.settings.avatarCooldownMin;
    el('#set-name-self-prob').value = st.settings.nameSelfProb == null ? 20 : st.settings.nameSelfProb;
    el('#set-name-me-prob').value = st.settings.nameMeProb == null ? 10 : st.settings.nameMeProb;
    el('#set-name-cooldown').value = st.settings.nameCooldownMin == null ? 120 : st.settings.nameCooldownMin;
    el('#set-ta-subsidy-prob').value = st.settings.taSubsidyProb == null ? 8 : st.settings.taSubsidyProb;
    el('#set-ta-subsidy-cooldown').value = st.settings.taSubsidyCooldownMin == null ? 30 : st.settings.taSubsidyCooldownMin;
    el('#set-ta-mail-prob').value = st.settings.taMailProb == null ? 12 : st.settings.taMailProb;
    el('#set-ta-mail-cooldown').value = st.settings.taMailCooldownMin == null ? 30 : st.settings.taMailCooldownMin;
    el('#set-mail-card-min').value = st.settings.mailCardMin == null ? 1 : st.settings.mailCardMin;
    el('#set-mail-card-max').value = st.settings.mailCardMax == null ? 3 : st.settings.mailCardMax;
    el('#set-card-offer-prob').value = st.settings.cardOfferProb == null ? 10 : st.settings.cardOfferProb;
    el('#set-ta-survey-prob').value = st.settings.taSurveyProb == null ? 10 : st.settings.taSurveyProb;
    el('#set-ta-survey-cooldown').value = st.settings.taSurveyCooldownMin == null ? 30 : st.settings.taSurveyCooldownMin;
    el('#set-ta-market-gift-prob').value = st.settings.taMarketGiftProb == null ? 6 : st.settings.taMarketGiftProb;
    el('#set-ta-market-buy-prob').value = st.settings.taMarketBuyProb == null ? 6 : st.settings.taMarketBuyProb;
    el('#set-ta-market-wish-prob').value = st.settings.taMarketWishProb == null ? 8 : st.settings.taMarketWishProb;
    el('#set-ta-market-fav-prob').value = st.settings.taMarketFavProb == null ? 4 : st.settings.taMarketFavProb;
    el('#set-ta-market-buy-for-me-prob').value = st.settings.taMarketBuyForMeProb == null ? 4 : st.settings.taMarketBuyForMeProb;
    el('#set-notify-enabled').checked = !!st.settings.notifyEnabled;
    el('#set-keepalive').checked = !!st.settings.keepAlive;
    refreshNotifyStatus();

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

  /* ---------- 通知弹窗与后台保活 ---------- */
  let swReg = null;
  let keepAliveTimer = 0;
  let keepAliveCtx = null;

  function notifyStatusText() {
    if (!('Notification' in window)) return '这个浏览器不支持通知弹窗。';
    if (Notification.permission === 'denied') return '通知权限被拒绝了，需要到浏览器或系统设置里重新允许。';
    if (!App.state.settings.notifyEnabled) return '还没有开启通知。';
    if (Notification.permission === 'granted') return '通知已开启，TA 发来新消息时会弹到通知栏。';
    return '还需要允许一次通知权限。';
  }

  function refreshNotifyStatus() {
    const node = el('#notify-status');
    if (node) node.textContent = notifyStatusText();
  }

  function ensureServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (swReg) return Promise.resolve(swReg);
    return navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      return reg;
    }).catch(function () {
      swReg = null;
      return null;
    });
  }

  /* 用 Service Worker 弹通知，页面切到后台也能留在通知栏里 */
  function sendNotification(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return Promise.resolve(false);
    const options = { body: body || '', tag: tag || 'shiyi-message', data: { url: './' } };
    return ensureServiceWorker().then(function (reg) {
      if (reg) {
        return reg.showNotification(title, options).then(function () { return true; });
      }
      try {
        new Notification(title, options);
        return true;
      } catch (e) {
        return false;
      }
    }).catch(function () { return false; });
  }

  /* 通知正文优先显示消息本身的内容，卡片类给出可读说明 */
  function notifyBody(message) {
    if (!message) return '发来一条新消息。';
    const preview = App.messagePreview ? App.messagePreview(message) : '';
    if (preview) return preview;
    const fallback = {
      survey: '[问卷] 想听听你的答案',
      surveyAnswer: '[问卷回答] 已经答好了',
      divine: '[占卜] 抽了一张牌',
      cardOffer: '[字卡] 想把这句话收进字卡库',
    };
    return fallback[message.type] || message.text || '发来一条新消息。';
  }

  App.notifyMessage = function (contactId, message) {
    if (!App.state.settings.notifyEnabled) return;
    if (!document.hidden) return;
    const contact = (App.state.contacts || []).find(function (c) { return c.id === contactId; });
    sendNotification(contact ? contact.name : 'TA', notifyBody(message), 'shiyi-' + contactId);
  };

  function stopKeepAlive() {
    clearInterval(keepAliveTimer);
    keepAliveTimer = 0;
    if (keepAliveCtx) {
      try { keepAliveCtx.close(); } catch (e) {}
      keepAliveCtx = null;
    }
  }

  function startKeepAlive() {
    stopKeepAlive();
    if (!App.state.settings.keepAlive) return;
    ensureServiceWorker().then(function (reg) {
      if (!reg || !App.state.settings.keepAlive) return;
      const ping = function () {
        try {
          if (reg.active) reg.active.postMessage({ type: 'keepalive' });
        } catch (e) {}
      };
      ping();
      keepAliveTimer = setInterval(ping, 20000);
      /* 安卓 Chrome 支持时顺带登记周期后台任务 */
      try {
        if (reg.periodicSync) {
          reg.periodicSync.register('shiyi-keepalive', { minInterval: 15 * 60 * 1000 }).catch(function () {});
        }
      } catch (e) {}
    });
    /* 极低音量的静音音轨，让系统认为页面仍在播放，减少后台被回收 */
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        keepAliveCtx = new Ctx();
        const osc = keepAliveCtx.createOscillator();
        const gain = keepAliveCtx.createGain();
        gain.gain.value = 0.001;
        osc.frequency.value = 20;
        osc.connect(gain);
        gain.connect(keepAliveCtx.destination);
        osc.start();
      }
    } catch (e) {}
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

    function bindAvatarProb(id, key) {
      const input = el(id);
      if (!input) return;
      input.addEventListener('input', function () {
        const raw = String(input.value || '').trim();
        if (!raw) return;
        const value = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
        App.state.settings[key] = value;
        App.save();
      });
    }
    bindAvatarProb('#set-avatar-self-prob', 'avatarSelfProb');
    bindAvatarProb('#set-avatar-me-prob', 'avatarMeProb');
    bindAvatarProb('#set-name-self-prob', 'nameSelfProb');
    bindAvatarProb('#set-name-me-prob', 'nameMeProb');
    bindAvatarProb('#set-ta-subsidy-prob', 'taSubsidyProb');
    bindAvatarProb('#set-ta-quote', 'taQuoteProb');
    bindAvatarProb('#set-ta-mail-prob', 'taMailProb');
    bindAvatarProb('#set-card-offer-prob', 'cardOfferProb');
    bindAvatarProb('#set-ta-survey-prob', 'taSurveyProb');
    bindAvatarProb('#set-ta-market-gift-prob', 'taMarketGiftProb');
    bindAvatarProb('#set-ta-market-buy-prob', 'taMarketBuyProb');
    bindAvatarProb('#set-ta-market-wish-prob', 'taMarketWishProb');
    bindAvatarProb('#set-ta-market-fav-prob', 'taMarketFavProb');
    bindAvatarProb('#set-ta-market-buy-for-me-prob', 'taMarketBuyForMeProb');

    function bindMinutes(id, key, max) {
      const input = el(id);
      if (!input) return;
      input.addEventListener('input', function () {
        const raw = String(input.value || '').trim();
        if (!raw) return;
        const value = Math.max(0, Math.min(max, parseInt(raw, 10) || 0));
        App.state.settings[key] = value;
        App.save();
      });
    }
    bindMinutes('#set-avatar-cooldown', 'avatarCooldownMin', 1440);
    bindMinutes('#set-name-cooldown', 'nameCooldownMin', 2880);
    bindMinutes('#set-ta-subsidy-cooldown', 'taSubsidyCooldownMin', 1440);
    bindMinutes('#set-ta-mail-cooldown', 'taMailCooldownMin', 1440);
    bindMinutes('#set-ta-survey-cooldown', 'taSurveyCooldownMin', 1440);

    const notifyToggle = el('#set-notify-enabled');
    if (notifyToggle) {
      notifyToggle.addEventListener('change', function () {
        if (!notifyToggle.checked) {
          App.state.settings.notifyEnabled = false;
          App.save();
          refreshNotifyStatus();
          return;
        }
        if (!('Notification' in window)) {
          notifyToggle.checked = false;
          refreshNotifyStatus();
          App.toast('这个浏览器不支持通知弹窗');
          return;
        }
        const finish = function (perm) {
          if (perm !== 'granted') {
            notifyToggle.checked = false;
            refreshNotifyStatus();
            App.toast('没有拿到通知权限');
            return;
          }
          App.state.settings.notifyEnabled = true;
          App.save();
          ensureServiceWorker().then(refreshNotifyStatus);
          App.toast('通知已开启');
        };
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(finish, function () { finish('denied'); });
        } else {
          finish(Notification.permission);
        }
      });
    }

    const testNotify = el('#btn-notify-test');
    if (testNotify) {
      testNotify.addEventListener('click', function () {
        if (!('Notification' in window)) {
          App.toast('这个浏览器不支持通知弹窗');
          return;
        }
        const send = function () {
          sendNotification('拾忆', '这是一条测试通知，收到就说明通知弹窗可以用了。', 'shiyi-test')
            .then(function (ok) { App.toast(ok ? '测试通知已发送' : '通知没发出去，检查一下权限'); });
        };
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(function (perm) {
            if (perm === 'granted') send();
            else App.toast('没有拿到通知权限');
          });
        } else {
          send();
        }
      });
    }

    const keepToggle = el('#set-keepalive');
    if (keepToggle) {
      keepToggle.addEventListener('change', function () {
        App.state.settings.keepAlive = !!keepToggle.checked;
        App.save();
        if (keepToggle.checked) {
          startKeepAlive();
          App.toast('已开启后台保活');
        } else {
          stopKeepAlive();
          App.toast('已关闭后台保活');
        }
      });
    }
    if (App.state.settings.keepAlive) startKeepAlive();
    else if (App.state.settings.notifyEnabled) ensureServiceWorker();

    ['#set-mail-card-min', '#set-mail-card-max'].forEach(function (sel) {
      const node = el(sel);
      if (!node) return;
      node.addEventListener('change', function () {
        const key = sel === '#set-mail-card-min' ? 'mailCardMin' : 'mailCardMax';
        const v = Math.max(0, Math.min(15, Math.round(Number(node.value) || 0)));
        node.value = v;
        App.state.settings[key] = v;
        markDirty();
      });
    });
    bindMinutes('#set-ta-moment-cooldown', 'taMomentCooldownMin', 1440);

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

    App.bindStepper('#set-merge-prob', function (v) {
      App.state.settings.mergeProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-redpacket-prob', function (v) {
      App.state.settings.taRedpacketProb = v;
      markDirty();
    });

    App.bindStepper('#set-rp-accept-prob', function (v) {
      App.state.settings.redpacketAcceptProb = v;
      markDirty();
    });

    App.bindStepper('#set-rp-return-prob', function (v) {
      App.state.settings.redpacketReturnProb = v;
      markDirty();
    });

    el('#set-merge-min').addEventListener('change', function (e) {
      let v = Math.max(2, Math.min(6, Number(e.target.value) || 2));
      const max = Number(App.state.settings.mergeMax) || 3;
      if (v > max) {
        v = max;
        e.target.value = v;
      }
      App.state.settings.mergeMin = v;
      markDirty();
    });

    el('#set-merge-max').addEventListener('change', function (e) {
      let v = Math.max(2, Math.min(6, Number(e.target.value) || 2));
      const min = Number(App.state.settings.mergeMin) || 2;
      if (v < min) {
        v = min;
        e.target.value = v;
      }
      App.state.settings.mergeMax = v;
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
      App.state.settings.taPatProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-sticker', function (v) {
      App.state.settings.taStickerProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-voice-prob', function (v) {
      App.state.settings.taVoiceProb = v;
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
      const scopes = selectedBackupScopes();
      if (!scopes.length) {
        App.toast('先勾选要备份的内容');
        return;
      }
      const data = { version: 1 };
      scopes.forEach(function (scope) {
        scope.fields.forEach(function (field) {
          if (App.state[field] !== undefined) data[field] = App.state[field];
        });
      });
      /* 复制一份再内联语音，避免改动当前状态；换设备导入也能播放 */
      const payload = JSON.parse(JSON.stringify(data));
      App.inlineVoice(payload).catch(function () { return payload; }).then(function (filled) {
        App.downloadJSON({
          app: 'xuyu',
          type: 'backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          scopes: scopes.map(function (scope) { return scope.key; }),
          data: filled,
        }, 'xuyu-backup-' + App.stamp() + '.json');
        App.toast('已导出 ' + scopes.length + ' 项内容');
      });
    });

    const selectAllBtn = el('#backup-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function () {
        backupScopeInputs().forEach(function (input) { input.checked = true; });
      });
    }
    const selectNoneBtn = el('#backup-select-none');
    if (selectNoneBtn) {
      selectNoneBtn.addEventListener('click', function () {
        backupScopeInputs().forEach(function (input) { input.checked = false; });
      });
    }

    el('#btn-import-all').addEventListener('click', function () {
      el('#file-import-all').click();
    });

    el('#file-import-all').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;

      App.readJSONFile(file).then(function (payload) {
        const data = payload && payload.data ? payload.data : payload;
        if (!data || typeof data !== 'object') {
          throw new Error('这不是拾忆的备份文件');
        }
        const scopes = selectedBackupScopes().filter(function (scope) {
          return scope.fields.some(function (field) { return data[field] !== undefined; });
        });
        if (!scopes.length) {
          App.toast('备份里没有勾选的内容');
          return;
        }
        const names = scopes.map(function (scope) { return scope.label; }).join('、');
        if (!confirm('将用备份里的「' + names + '」覆盖本机对应内容，其他分类保持不动，继续？')) return;

        /* 备份里的语音是 dataURL，先写回 IndexedDB 再把索引交给状态 */
        return App.adoptVoiceDataUrls(data).then(function () {
          applyBackupData(data, scopes);
          App.toast('已导入：' + names);
        });
      }).catch(function (err) {
        App.toast(err.message || '导入失败');
      });
    });

    const memoryRefresh = el('#btn-memory-refresh');
    if (memoryRefresh) {
      memoryRefresh.addEventListener('click', function () { App.refreshMemoryStats(); });
    }

    const memoryClean = el('#btn-memory-clean');
    if (memoryClean) {
      memoryClean.addEventListener('click', function () {
        App.cleanOrphanMedia().then(function (result) {
          App.toast(result.removed
            ? '已清理 ' + result.removed + ' 项媒体，释放 ' + formatBytes(result.bytes)
            : '没有可清理的媒体');
          return App.refreshMemoryStats();
        }).catch(function (err) {
          App.toast(err && err.message ? err.message : '清理失败');
        });
      });
    }

    el('#btn-reset').addEventListener('click', function () {
      if (!confirm('清空全部数据并恢复初始状态？建议先导出备份。')) return;
      if (App.resetMusicMedia) App.resetMusicMedia();
      if (App.clearVoiceMedia) App.clearVoiceMedia().catch(function () {});
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
