/* 设置、本地数据与备份 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  /* TA 主动发朋友圈这一组的节奏（概率、每日上限、最短/最长间隔、冷却、字卡数）
     只属于当前打开设置的这个联系人：存进 contact.settings，
     改他的不会连带改到别的联系人。运行时 moments.js 也是按联系人的这份设置走的。 */
  function momentContact() {
    const id = App.chatContactId;
    if (!id) return null;
    return (App.state.contacts || []).find(function (c) { return c.id === id; }) || null;
  }
  function momentLimit(key, fallback) {
    const value = Number(App.contactSettings(momentContact())[key]);
    return isNaN(value) ? fallback : value;
  }
  function setMomentLimit(key, value) {
    const contact = momentContact();
    if (!contact) { App.state.settings[key] = value; return; }
    if (!contact.settings) contact.settings = {};
    contact.settings[key] = value;
  }

  function storageSize() {
    const node = el('#storage-size');
    if (!node) return;
    /* 读已落盘记录的大小，不再同步序列化整份 state（数据大时会卡死设置页） */
    App.savedStateBytes().then(function (bytes) {
      node.textContent = '数据约 ' + (bytes / 1024).toFixed(1) + ' KB';
    }).catch(function () { node.textContent = ''; });
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
    { key: 'clock', label: '时钟与闹钟', fields: ['clock'] },
    { key: 'contract', label: '婚帖契约', fields: ['contract'] },
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
            if (App.replaceChats) App.replaceChats(data.chats);
            else st.chats = data.chats;
          }
          break;
        case 'cards':
          if (Array.isArray(data.cards)) st.cards = data.cards;
          break;
        case 'stickers':
          if (data.stickers && typeof data.stickers === 'object') {
            /* 表情包外置在 IndexedDB：直接写进独立存储，主 state 只留空壳 */
            if (App.saveStickerSet) {
              App.saveStickerSet('mine', Array.isArray(data.stickers.mine) ? data.stickers.mine : []);
              App.saveStickerSet('public', Array.isArray(data.stickers.public) ? data.stickers.public : []);
              st.stickers = { mine: [], ta: [], public: [] };
            } else {
              st.stickers = {
                mine: Array.isArray(data.stickers.mine) ? data.stickers.mine : [],
                ta: Array.isArray(data.stickers.ta) ? data.stickers.ta : [],
                public: Array.isArray(data.stickers.public) ? data.stickers.public : [],
              };
            }
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

    /* 导入进来的模块已有完整数据，允许随后保存；未导入的懒加载模块仍保持保护 */
    if (App.markLazyFields) {
      const importedFields = [];
      scopes.forEach(function (scope) { scope.fields.forEach(function (field) { importedFields.push(field); }); });
      App.markLazyFields(importedFields);
    }
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
      if ((name === 'memory' || name === 'backup') && App.refreshMemoryStats) App.refreshMemoryStats();
      if (name === 'backend') refreshNotifyStatus();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab.dataset.settingsPage); });
    });
    show('profile');
  }

  /* 主动打扰：5 类各自独立的每日次数，分别显示今天已用多少 */
  function renderDisturbHint() {
    if (!App.TA_DISTURB_FIELDS) return;
    Object.keys(App.TA_DISTURB_FIELDS).forEach(function (k) {
      const hint = el('#disturb-used-' + k);
      if (!hint) return;
      const limit = App.taDisturbLimit(k);
      const used = App.taDisturbUsed(k);
      hint.textContent = limit <= 0
        ? '这一类已关闭，TA 不会自己冒出来。'
        : '今天已用 ' + used + ' / ' + limit + ' 次，第二天零点重置。';
    });
  }

  function renderMarketIntervalHint() {
    const hint = el('#market-interval-hint');
    if (!hint) return;
    const raw = Math.round(Number(App.state.settings && App.state.settings.taMarketDailyLimit));
    const cap = Number.isFinite(raw) ? Math.max(0, Math.min(999, raw)) : 8;
    if (cap <= 0) {
      hint.textContent = '当前：已关闭，TA 不会主动发集市消息。';
      return;
    }
    const mins = Math.max(1, Math.round(1440 / cap));
    const pretty = mins >= 60
      ? (mins % 60 === 0 ? (mins / 60) + ' 小时' : (mins / 60).toFixed(1) + ' 小时')
      : mins + ' 分钟';
    hint.textContent = '当前：一天最多 ' + cap + ' 条，平均每 ' + mins + ' 分钟（' + pretty + '）有一次机会。';
  }

  function bindMarketDaily() {
    const input = el('#set-ta-market-daily');
    if (!input) return;
    input.addEventListener('input', function () {
      const raw = String(input.value || '').trim();
      if (!raw) return;
      const value = Math.max(0, Math.min(999, parseInt(raw, 10) || 0));
      App.state.settings.taMarketDailyLimit = value;
      /* 条数改了就按新间隔重新计时，不用等旧间隔走完 */
      if (App.state.market) App.state.market.taNextAt = 0;
      renderMarketIntervalHint();
      App.save();
    });
  }

  App.renderSettings = function () {
    const st = App.state;
    el('#set-name').value = st.profile.userName || '';
    el('#set-avatar-preview').innerHTML = App.avatarHtml(st.profile.userAvatar);
    el('#set-since').value = st.profile.since || '';
    el('#set-min').value = st.settings.replyMin;
    el('#set-max').value = st.settings.replyMax;
    el('#set-typing-min').value = Math.round(Number(st.settings.replyDelayMinSec) || 0);
    el('#set-typing-max').value = Math.round(Number(st.settings.replyDelayMaxSec) || 0);
    el('#set-ta-msg-prob').value = st.settings.taMsgProb == null ? 8 : st.settings.taMsgProb;
    el('#set-ta-msg-gap').value = st.settings.taMsgGapMin == null ? 1 : st.settings.taMsgGapMin;
    el('#set-ta-msg-min').value = st.settings.taMsgMin == null ? 1 : st.settings.taMsgMin;
    el('#set-ta-msg-max').value = st.settings.taMsgMax == null ? 3 : st.settings.taMsgMax;
    el('#set-ta-ignore').value = st.settings.taIgnoreProb == null ? 15 : st.settings.taIgnoreProb;
    el('#set-merge-prob').value = st.settings.mergeProb == null ? 15 : st.settings.mergeProb;
    el('#set-merge-min').value = st.settings.mergeMin == null ? 2 : st.settings.mergeMin;
    el('#set-merge-max').value = st.settings.mergeMax == null ? 3 : st.settings.mergeMax;
    el('#set-ta-redpacket-prob').value = st.settings.taRedpacketProb == null ? 8 : st.settings.taRedpacketProb;
    el('#set-rp-accept-prob').value = st.settings.redpacketAcceptProb == null ? 70 : st.settings.redpacketAcceptProb;
    el('#set-rp-return-prob').value = st.settings.redpacketReturnProb == null ? 20 : st.settings.redpacketReturnProb;
    el('#set-emotion-prob').value = st.settings.emotionProb == null ? 30 : st.settings.emotionProb;
    el('#set-ta-mood-prob').value = st.settings.taMoodProb == null ? 70 : st.settings.taMoodProb;
    el('#set-loc-prompt-prob').value = st.settings.locPromptProb == null ? 20 : st.settings.locPromptProb;
    el('#set-ta-like').value = st.settings.taLikeProb == null ? 60 : st.settings.taLikeProb;
    el('#set-ta-comment').value = st.settings.taCommentProb == null ? 40 : st.settings.taCommentProb;
    el('#set-ta-moment-prob').value = momentLimit('taMomentProb', 25);
    el('#set-ta-moment-daily').value = momentLimit('taMomentDailyMax', 3);
    el('#set-ta-moment-gap-min').value = momentLimit('taMomentGapMin', 10);
    el('#set-ta-moment-gap-max').value = momentLimit('taMomentGapMax', 60);
    el('#set-ta-moment-card-min').value = momentLimit('taMomentCardMin', 1);
    el('#set-ta-moment-card-max').value = momentLimit('taMomentCardMax', 3);
    el('#set-ta-moment-cooldown').value = momentLimit('taMomentCooldownMin', 10);
    el('#set-pat-back').value = st.settings.taPatProb == null ? 10 : st.settings.taPatProb;
    el('#set-ta-sticker').value = st.settings.taStickerProb == null ? 30 : st.settings.taStickerProb;
    el('#set-ta-sticker-combo').value = st.settings.taStickerComboProb == null ? 25 : st.settings.taStickerComboProb;
    el('#set-ta-voice-prob').value = st.settings.taVoiceProb == null ? 20 : st.settings.taVoiceProb;
    el('#set-ta-recall').value = st.settings.taRecallProb == null ? 5 : st.settings.taRecallProb;
    el('#set-ta-quote').value = st.settings.taQuoteProb == null ? 20 : st.settings.taQuoteProb;
    el('#set-ta-fav').value = st.settings.taFavProb == null ? 15 : st.settings.taFavProb;
    el('#set-music-pause').value = st.settings.musicPauseProb == null ? 15 : st.settings.musicPauseProb;
    el('#set-music-play').value = st.settings.musicPlayProb == null ? 100 : st.settings.musicPlayProb;
    el('#set-music-fav').value = st.settings.musicFavProb == null ? 25 : st.settings.musicFavProb;
    el('#set-music-unfav').value = st.settings.musicUnfavProb == null ? 15 : st.settings.musicUnfavProb;
    el('#set-music-switch').value = st.settings.musicSwitchProb == null ? 30 : st.settings.musicSwitchProb;
    el('#set-music-invite').value = st.settings.musicInviteProb == null ? 5 : st.settings.musicInviteProb;
    el('#set-jealousy-prob').value = st.settings.jealousyProb == null ? 30 : st.settings.jealousyProb;
    el('#set-context-reply').checked = st.settings.contextReplyEnabled !== false;
    el('#set-call-incoming').value = st.settings.callIncomingProb == null ? 12 : st.settings.callIncomingProb;
    el('#set-call-answer').value = st.settings.callAnswerProb == null ? 70 : st.settings.callAnswerProb;
    el('#set-call-busy').value = st.settings.callBusyProb == null ? 15 : st.settings.callBusyProb;
    el('#set-call-reject').value = st.settings.callRejectProb == null ? 15 : st.settings.callRejectProb;
    el('#set-call-hangup').value = st.settings.callHangupProb == null ? 10 : st.settings.callHangupProb;
    el('#set-voice-transcript').checked = st.settings.voiceTranscript !== false;
    el('#set-avatar-enabled').checked = st.settings.avatarEnabled !== false;
    el('#set-avatar-self-prob').value = st.settings.avatarSelfProb == null ? 40 : st.settings.avatarSelfProb;
    el('#set-avatar-me-prob').value = st.settings.avatarMeProb == null ? 25 : st.settings.avatarMeProb;
    el('#set-avatar-cooldown').value = st.settings.avatarCooldownMin == null ? 30 : st.settings.avatarCooldownMin;
    el('#set-name-self-prob').value = st.settings.nameSelfProb == null ? 20 : st.settings.nameSelfProb;
    el('#set-name-me-prob').value = st.settings.nameMeProb == null ? 10 : st.settings.nameMeProb;
    el('#set-name-cooldown').value = st.settings.nameCooldownMin == null ? 120 : st.settings.nameCooldownMin;
    el('#set-ta-mail-prob').value = st.settings.taMailProb == null ? 12 : st.settings.taMailProb;
    el('#set-ta-mail-cooldown').value = st.settings.taMailCooldownMin == null ? 30 : st.settings.taMailCooldownMin;
    el('#set-mail-card-min').value = st.settings.mailCardMin == null ? 1 : st.settings.mailCardMin;
    el('#set-mail-card-max').value = st.settings.mailCardMax == null ? 3 : st.settings.mailCardMax;
    el('#set-card-offer-prob').value = st.settings.cardOfferProb == null ? 10 : st.settings.cardOfferProb;
    el('#set-ta-survey-prob').value = st.settings.taSurveyProb == null ? 10 : st.settings.taSurveyProb;
    el('#set-ta-survey-cooldown').value = st.settings.taSurveyCooldownMin == null ? 30 : st.settings.taSurveyCooldownMin;
    Object.keys(App.TA_DISTURB_FIELDS).forEach(function (k) {
      const input = el('#set-disturb-' + k);
      if (input) input.value = App.taDisturbLimit(k);
    });
    el('#set-ta-daily-allowance').value = st.settings.taDailyAllowance == null ? 30 : st.settings.taDailyAllowance;
    el('#set-ta-market-daily').value = st.settings.taMarketDailyLimit == null ? 8 : st.settings.taMarketDailyLimit;
    renderMarketIntervalHint();
    renderDisturbHint();
    el('#set-ta-market-gift-prob').value = st.settings.taMarketGiftProb == null ? 6 : st.settings.taMarketGiftProb;
    el('#set-ta-market-buy-prob').value = st.settings.taMarketBuyProb == null ? 6 : st.settings.taMarketBuyProb;
    el('#set-ta-market-wish-prob').value = st.settings.taMarketWishProb == null ? 8 : st.settings.taMarketWishProb;
    el('#set-ta-market-fav-prob').value = st.settings.taMarketFavProb == null ? 4 : st.settings.taMarketFavProb;
    el('#set-ta-market-buy-for-me-prob').value = st.settings.taMarketBuyForMeProb == null ? 4 : st.settings.taMarketBuyForMeProb;
    el('#set-ta-wish-accept-prob').value = st.settings.taWishAcceptProb == null ? 25 : st.settings.taWishAcceptProb;
    el('#set-ta-wish-reject-prob').value = st.settings.taWishRejectProb == null ? 20 : st.settings.taWishRejectProb;
    el('#set-notify-enabled').checked = !!st.settings.notifyEnabled;
    el('#set-keepalive').checked = !!st.settings.keepAlive;
    const wordsHangupToggle = el('#set-call-words-hangup');
    if (wordsHangupToggle) wordsHangupToggle.checked = st.settings.callWordsHangup !== false;
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
    const followThemeToggle = el('#set-icons-follow-theme');
    if (followThemeToggle) followThemeToggle.checked = st.settings.iconsFollowTheme !== false;
    const fullscreenToggle = el('#set-force-fullscreen');
    if (fullscreenToggle) fullscreenToggle.checked = !!st.settings.forceFullscreen;
    const calTheme = st.settings.calendarTheme || {};
    el('#set-calendar-theme').checked = calTheme.enabled !== false;
    document.querySelectorAll('#festival-options [data-festival-opt]').forEach(function (input) {
      input.checked = calTheme[input.dataset.festivalOpt] !== false;
      input.disabled = calTheme.enabled === false;
    });
    storageSize();
    if (App.renderStepSettings) App.renderStepSettings();
  };

  App.renderChatSettings = function () {
    App.renderSettings();
    const contact = App.state.contacts.find(function (c) { return c.id === App.chatContactId; });
    el('#chat-settings-delete-note').textContent = contact
      ? '删除你与「' + contact.name + '」的本次聊天记录，删除后无法恢复。'
      : '删除后，本次聊天记录将无法恢复。';
    showChatSettingsPage(0);
  };

  function applyForceFullscreen(on) {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('is-force-fullscreen', !!on);
    if (App.syncAppHeight) App.syncAppHeight();
  }

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
    /* 记一笔：用户从通知回到页面时，聊天要直接落在最新一条 */
    App.pendingNotifyScroll = true;
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
    applyForceFullscreen(!!App.state.settings.forceFullscreen);

    /* 手机上在输入框打完字常常不会失焦，change 也就不触发，刷新后设置会丢。
       这里在停止输入后补发一次 change，并在刷新 / 切后台时把还没提交的输入框提交掉 */
    const SETTING_VIEWS = '#view-settings, #view-chat-settings';
    function commitSettingInput(node) {
      if (!node || !node.matches || !node.matches('input, textarea, select')) return;
      if (!node.closest(SETTING_VIEWS)) return;
      if (node.type === 'file' || node.type === 'checkbox' || node.type === 'radio') return;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }
    let pendingSettingInput = null;
    let pendingSettingTimer = 0;
    document.addEventListener('input', function (e) {
      const node = e.target;
      if (!node || !node.closest || !node.closest(SETTING_VIEWS)) return;
      if (node.type === 'file' || node.type === 'checkbox' || node.type === 'radio') return;
      pendingSettingInput = node;
      clearTimeout(pendingSettingTimer);
      pendingSettingTimer = setTimeout(function () {
        const target = pendingSettingInput;
        pendingSettingInput = null;
        commitSettingInput(target);
      }, 800);
    }, true);
    function flushSettingInput() {
      clearTimeout(pendingSettingTimer);
      const target = pendingSettingInput || document.activeElement;
      pendingSettingInput = null;
      commitSettingInput(target);
      App.flushSave();
    }
    window.addEventListener('pagehide', flushSettingInput);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flushSettingInput();
    });

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

    el('#set-avatar-enabled').addEventListener('change', function (e) {
      App.state.settings.avatarEnabled = !!e.target.checked;
      markDirty();
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
    bindAvatarProb('#set-ta-quote', 'taQuoteProb');
    bindAvatarProb('#set-ta-mail-prob', 'taMailProb');
    bindAvatarProb('#set-card-offer-prob', 'cardOfferProb');
    bindAvatarProb('#set-ta-survey-prob', 'taSurveyProb');
    bindAvatarProb('#set-ta-market-gift-prob', 'taMarketGiftProb');
    bindAvatarProb('#set-ta-market-buy-prob', 'taMarketBuyProb');
    bindAvatarProb('#set-ta-market-wish-prob', 'taMarketWishProb');
    bindAvatarProb('#set-ta-market-fav-prob', 'taMarketFavProb');
    bindAvatarProb('#set-ta-market-buy-for-me-prob', 'taMarketBuyForMeProb');
    bindAvatarProb('#set-ta-wish-accept-prob', 'taWishAcceptProb');
    bindAvatarProb('#set-ta-wish-reject-prob', 'taWishRejectProb');

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
    bindMinutes('#set-ta-mail-cooldown', 'taMailCooldownMin', 1440);
    bindMinutes('#set-ta-daily-allowance', 'taDailyAllowance', 100000);
    bindMarketDaily();
    const clearMarketBtn = el('#btn-clear-market-cards');
    if (clearMarketBtn) {
      clearMarketBtn.addEventListener('click', function () {
        App.confirmDialog('把已结束 / 过期的集市卡片（含集市订单）从聊天里清掉？还没处理的礼物和心愿会保留。',
          { title: '清理集市卡片', okText: '清理' }).then(function (ok) {
          if (!ok) return;
          let removed = 0;
          const chats = App.state.chats || {};
          Object.keys(chats).forEach(function (id) {
            const arr = chats[id];
            if (!Array.isArray(arr)) return;
            /* 倒着删，原地改动，别换数组引用 */
            for (let i = arr.length - 1; i >= 0; i--) {
              const m = arr[i];
              if (!m || ['gift', 'wish', 'marketBuy'].indexOf(m.type) === -1) continue;
              const gone = m.type === 'marketBuy'
                || m.status !== 'pending'
                || Date.now() - (Number(m.ts) || 0) > 24 * 60 * 60 * 1000;
              if (gone) { arr.splice(i, 1); removed++; }
            }
          });
          App.save();
          App.toast(removed ? '已清理 ' + removed + ' 张集市卡片' : '没有需要清理的集市卡片');
          if (App.chatContactId && App.chatOpen && App.chatOpen(App.chatContactId) && App.renderChat) App.renderChat();
        });
      });
    }
    /* 主动打扰：5 类各自独立的每日次数，改哪一个只影响那一类 */
    Object.keys(App.TA_DISTURB_FIELDS).forEach(function (k) {
      const input = el('#set-disturb-' + k);
      if (!input) return;
      input.addEventListener('input', function () {
        const raw = String(input.value || '').trim();
        if (!raw) return;
        App.state.settings[App.TA_DISTURB_FIELDS[k].setting] = Math.max(0, Math.min(999, parseInt(raw, 10) || 0));
        renderDisturbHint();
        App.save();
      });
    });
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

    const wordsHangupToggle = el('#set-call-words-hangup');
    if (wordsHangupToggle) {
      wordsHangupToggle.addEventListener('change', function () {
        App.state.settings.callWordsHangup = !!wordsHangupToggle.checked;
        App.save();
        App.toast(wordsHangupToggle.checked ? '说「挂电话」后 TA 可能挂断' : '说「挂电话」后 TA 不会挂断');
      });
    }

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
    const momentCooldown = el('#set-ta-moment-cooldown');
    if (momentCooldown) {
      /* 清空输入框想重打时，别在停顿 800ms 后把 0 填回去 */
      momentCooldown.addEventListener('change', function () {
        if (String(momentCooldown.value).trim() === '') return;
        const v = Math.max(0, Math.min(1440, Math.round(Number(momentCooldown.value) || 0)));
        momentCooldown.value = v;
        setMomentLimit('taMomentCooldownMin', v);
        markDirty();
      });
      momentCooldown.addEventListener('blur', function () {
        if (String(momentCooldown.value).trim() === '') {
          momentCooldown.value = momentLimit('taMomentCooldownMin', 10);
        }
      });
    }

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

    el('#set-typing-min').addEventListener('change', function (e) {
      let v = Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0)));
      const max = Number(App.state.settings.replyDelayMaxSec);
      if (Number.isFinite(max) && v > max) {
        v = max;
        e.target.value = v;
      }
      App.state.settings.replyDelayMinSec = v;
      markDirty();
    });

    el('#set-typing-max').addEventListener('change', function (e) {
      let v = Math.max(0, Math.min(300, Math.round(Number(e.target.value) || 0)));
      const min = Number(App.state.settings.replyDelayMinSec) || 0;
      if (v < min) {
        v = min;
        e.target.value = v;
      }
      App.state.settings.replyDelayMaxSec = v;
      markDirty();
    });

    App.bindStepper('#set-ta-msg-prob', function (v) {
      App.state.settings.taMsgProb = v;
      markDirty();
    });

    App.bindStepper('#set-ta-msg-gap', function (v) {
      App.state.settings.taMsgGapMin = v;
      markDirty();
    }, { min: 1, max: 120, step: 1 });

    App.bindStepper('#set-ta-msg-min', function (v) {
      App.state.settings.taMsgMin = v;
      if (Number(App.state.settings.taMsgMax) < v) App.state.settings.taMsgMax = v;
      markDirty();
    }, { min: 1, max: 10, step: 1 });

    App.bindStepper('#set-ta-msg-max', function (v) {
      App.state.settings.taMsgMax = v;
      if (Number(App.state.settings.taMsgMin) > v) App.state.settings.taMsgMin = v;
      markDirty();
    }, { min: 1, max: 10, step: 1 });

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

    App.bindStepper('#set-ta-mood-prob', function (v) {
      App.state.settings.taMoodProb = v;
      App.save();
      if (App.refreshTaMood) App.refreshTaMood(true);
    });

    App.bindStepper('#set-loc-prompt-prob', function (v) {
      App.state.settings.locPromptProb = v;
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
      setMomentLimit('taMomentProb', v);
      markDirty();
    });

    App.bindStepper('#set-ta-moment-daily', function (v) {
      setMomentLimit('taMomentDailyMax', v);
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
        if (key === 'taMomentGapMin' && v > momentLimit('taMomentGapMax', 60)) {
          v = momentLimit('taMomentGapMax', 60);
        }
        if (key === 'taMomentGapMax' && v < momentLimit('taMomentGapMin', 10)) {
          v = momentLimit('taMomentGapMin', 10);
        }
        if (key === 'taMomentCardMin' && v > momentLimit('taMomentCardMax', 3)) {
          v = momentLimit('taMomentCardMax', 3);
        }
        if (key === 'taMomentCardMax' && v < momentLimit('taMomentCardMin', 1)) {
          v = momentLimit('taMomentCardMin', 1);
        }
        e.target.value = v;
        setMomentLimit(key, v);
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

    App.bindStepper('#set-ta-sticker-combo', function (v) {
      App.state.settings.taStickerComboProb = v;
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

    App.bindStepper('#set-music-unfav', function (v) {
      App.state.settings.musicUnfavProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-switch', function (v) {
      App.state.settings.musicSwitchProb = v;
      markDirty();
    });

    App.bindStepper('#set-music-invite', function (v) {
      App.state.settings.musicInviteProb = v;
      markDirty();
    });

    App.bindStepper('#set-jealousy-prob', function (v) {
      App.state.settings.jealousyProb = v;
      markDirty();
    });

    const contextReplyToggle = el('#set-context-reply');
    if (contextReplyToggle) {
      contextReplyToggle.addEventListener('change', function () {
        App.state.settings.contextReplyEnabled = contextReplyToggle.checked;
        markDirty();
      });
    }

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

    const calThemeToggle = el('#set-calendar-theme');
    if (calThemeToggle) {
      calThemeToggle.addEventListener('change', function () {
        const settings = App.state.settings;
        if (!settings.calendarTheme || typeof settings.calendarTheme !== 'object') settings.calendarTheme = {};
        settings.calendarTheme.enabled = !!calThemeToggle.checked;
        document.querySelectorAll('#festival-options [data-festival-opt]').forEach(function (input) {
          input.disabled = !calThemeToggle.checked;
        });
        App.save();
        if (App.renderDesktop) App.renderDesktop();
        App.toast(calThemeToggle.checked ? '已开启日历联动' : '已关闭日历联动');
      });
    }
    document.querySelectorAll('#festival-options [data-festival-opt]').forEach(function (input) {
      input.addEventListener('change', function () {
        const settings = App.state.settings;
        if (!settings.calendarTheme || typeof settings.calendarTheme !== 'object') settings.calendarTheme = {};
        settings.calendarTheme[input.dataset.festivalOpt] = !!input.checked;
        App.save();
        if (App.renderDesktop) App.renderDesktop();
      });
    });

    el('#theme-row').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      App.state.theme = btn.dataset.theme;
      App.applyTheme();
      markDirty();
      App.renderSettings();
    });

    const iconsFollowTheme = el('#set-icons-follow-theme');
    if (iconsFollowTheme) {
      iconsFollowTheme.addEventListener('change', function () {
        App.state.settings.iconsFollowTheme = !!iconsFollowTheme.checked;
        App.save();
        App.applyIconStyle();
        App.toast(iconsFollowTheme.checked ? '图标已跟随外观主题' : '图标已使用自定义颜色');
      });
    }

    const forceFullscreen = el('#set-force-fullscreen');
    if (forceFullscreen) {
      forceFullscreen.addEventListener('change', function () {
        App.state.settings.forceFullscreen = !!forceFullscreen.checked;
        applyForceFullscreen(forceFullscreen.checked);
        App.save();
        App.toast(forceFullscreen.checked ? '已强制延伸至全屏幕' : '已恢复手机外壳比例');
      });
    }

    el('#btn-export-all').addEventListener('click', function () {
      const scopes = selectedBackupScopes();
      if (!scopes.length) {
        App.toast('先勾选要备份的内容');
        return;
      }
      App.toast('正在整理完整备份…');
      /* 按需加载下先补齐全部模块，否则没点过的模块不会被导出 */
      App.loadAllLazy().then(function () {
        const data = { version: 1 };
        scopes.forEach(function (scope) {
          scope.fields.forEach(function (field) {
            if (App.state[field] !== undefined) data[field] = App.state[field];
          });
        });
        /* 复制一份再内联语音/图片，避免改动当前状态；换设备导入也能看到 */
        const payload = JSON.parse(JSON.stringify(data));
        return App.inlineVoice(payload).catch(function () { return payload; })
          .then(function (filled) {
            return App.inlineImages ? App.inlineImages(filled).catch(function () { return filled; }) : filled;
          })
          .then(function (filled) {
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
      }).catch(function () { App.toast('整理备份失败，请再试一次'); });
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
        return App.confirmDialog('将用备份里的「' + names + '」覆盖本机对应内容，其他分类保持不动，继续？', { title: '导入备份', okText: '导入' }).then(function (ok) {
          if (!ok) return;
          /* 备份里的语音/图片是 dataURL，先写回 IndexedDB 再把索引交给状态 */
          return App.adoptVoiceDataUrls(data)
            .then(function () { return App.adoptImageDataUrls ? App.adoptImageDataUrls(data) : null; })
            .then(function () {
              applyBackupData(data, scopes);
              App.toast('已导入：' + names);
            });
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
        const clear = App.clearAppCache || App.cleanOrphanMedia;
        clear.call(App).then(function (result) {
          App.toast(result.removed
            ? '已清除缓存，释放 ' + formatBytes(result.bytes)
            : '已清除过期缓存');
          return App.refreshMemoryStats();
        }).catch(function (err) {
          App.toast(err && err.message ? err.message : '清理失败');
        });
      });
    }

    el('#btn-reset').addEventListener('click', async function () {
      const ok = await App.confirmDialog('清空全部数据并恢复初始状态？建议先导出备份。', { title: '清空全部数据', okText: '清空' });
      if (!ok) return;
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
