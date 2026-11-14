/* 状态存储与通用工具 */
(function () {
  const App = (window.App = window.App || {});
  const KEY = 'xuyu.state.v1';

  App.state = null;
  App.chatContactId = null;
  App.unread = {};
  App.cardFilter = { q: '', cat: '全部' };

  App.uid = function (prefix) {
    const rand = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now() + '-' + Math.random().toString(16).slice(2);
    return (prefix || 'id') + '-' + rand;
  };

  App.esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };

  App.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(App.state));
    } catch (e) {
      if (App.toast) App.toast('保存失败：浏览器存储不可用');
    }
  };

  App.normalizeMusic = function (s) {
    const defaults = App.MUSIC_SEED();
    if (!s.music || typeof s.music !== 'object' || Array.isArray(s.music)) s.music = defaults;
    const music = s.music;
    const seen = {};
    const list = Array.isArray(music.tracks) ? music.tracks : [];
    music.tracks = list.filter(function (track) {
      if (!track || typeof track.id !== 'string' || !track.id || seen[track.id]) return false;
      seen[track.id] = true;
      track.title = String(track.title || '未命名歌曲');
      track.artist = String(track.artist || '未知歌手');
      if (['synth', 'local', 'url', 'netease', 'kugou'].indexOf(track.source) === -1) track.source = track.url ? 'url' : 'local';
      if (track.source === 'synth') return false;
      if (track.source !== 'local' && !/^https?:\/\//.test(track.url || track.audioUrl || '')) return false;
      return true;
    });
    defaults.tracks.forEach(function (track) {
      if (!seen[track.id]) music.tracks.push(Object.assign({}, track));
    });
    if (!music.favorites || typeof music.favorites !== 'object') music.favorites = { mine: [], ta: [] };
    ['mine', 'ta'].forEach(function (side) {
      if (!Array.isArray(music.favorites[side])) music.favorites[side] = [];
      music.favorites[side] = music.favorites[side].filter(function (id, index, ids) {
        return music.tracks.some(function (track) { return track.id === id; }) && ids.indexOf(id) === index;
      });
    });
    if (['sequence', 'repeat', 'shuffle'].indexOf(music.mode) === -1) music.mode = 'sequence';
    if (typeof music.chatFloat !== 'boolean') music.chatFloat = true;
    if (!music.tracks.some(function (track) { return track.id === music.currentId; })) {
      music.currentId = music.tracks.length ? music.tracks[0].id : '';
    }
    return s;
  };

  App.load = function () {
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) {
      raw = null;
    }

    const s = (raw && raw.version === 1) ? raw : App.seedState();

    if (!Array.isArray(s.contacts)) s.contacts = [];
    if (!s.chats || typeof s.chats !== 'object' || Array.isArray(s.chats)) s.chats = {};
    if (!Array.isArray(s.cards)) s.cards = App.BUILTIN_CARDS.map(function (c) { return Object.assign({}, c); });
    if (!s.profile) s.profile = { userName: '我', userAvatar: '🍊', since: '' };
    if (!s.settings) s.settings = { replyMin: 1, replyMax: 2, typingMin: 0.1 };
    /* 打字停顿由毫秒改为分钟 */
    if (s.settings.typingMin == null) {
      const legacyMs = Number(s.settings.typingMs);
      s.settings.typingMin = Number.isFinite(legacyMs)
        ? Math.max(0.1, Math.round(legacyMs / 6000) / 10)
        : 0.1;
    }
    delete s.settings.typingMs;
    if (s.settings.taMsgProb == null) s.settings.taMsgProb = 8;
    if (s.settings.taLikeProb == null) s.settings.taLikeProb = 60;
    if (s.settings.taCommentProb == null) s.settings.taCommentProb = 40;
    if (s.settings.taMomentCards == null) s.settings.taMomentCards = 1;
    if (s.settings.taMomentProb == null) s.settings.taMomentProb = 25;
    if (s.settings.taMomentDailyMax == null) s.settings.taMomentDailyMax = 3;
    if (s.settings.taMomentGapMin == null) s.settings.taMomentGapMin = 10;
    if (s.settings.taMomentGapMax == null) s.settings.taMomentGapMax = 60;
    if (s.settings.taMomentCardMin == null) s.settings.taMomentCardMin = Number(s.settings.taMomentCards) || 1;
    if (s.settings.taMomentCardMax == null) s.settings.taMomentCardMax = Math.max(Number(s.settings.taMomentCardMin) || 1, Number(s.settings.taMomentCards) || 1);
    if (s.settings.emotionProb == null) s.settings.emotionProb = 30;
    if (s.settings.taRecallProb == null) s.settings.taRecallProb = 5;
    if (s.settings.taQuoteProb == null) s.settings.taQuoteProb = 20;
    if (s.settings.taFavProb == null) s.settings.taFavProb = 15;
    if (s.settings.musicPauseProb == null) s.settings.musicPauseProb = 15;
    if (s.settings.musicPlayProb == null) s.settings.musicPlayProb = 60;
    if (s.settings.musicFavProb == null) s.settings.musicFavProb = 25;
    if (s.settings.musicSwitchProb == null) s.settings.musicSwitchProb = 30;
    if (s.settings.callIncomingProb == null) s.settings.callIncomingProb = 12;
    if (s.settings.callAnswerProb == null) s.settings.callAnswerProb = 70;
    if (s.settings.callBusyProb == null) s.settings.callBusyProb = 15;
    if (s.settings.callRejectProb == null) s.settings.callRejectProb = 15;
    if (s.settings.callHangupProb == null) s.settings.callHangupProb = 10;
    if (!s.theme) s.theme = 'mist';
    if (typeof s.notes !== 'string') s.notes = '';
    if (!Array.isArray(s.moments)) s.moments = [];
    if (!Array.isArray(s.mail)) s.mail = [];
    s.mail = s.mail.filter(function (m) {
      return m && typeof m === 'object' && m.text;
    }).map(function (m) {
      if (!m.id) m.id = App.uid('mail');
      m.from = m.from === 'me' ? 'me' : 'ta';
      m.text = String(m.text);
      m.ts = Number(m.ts) || Date.now();
      m.read = m.from === 'me' ? true : !!m.read;
      m.fav = !!m.fav;
      if (!m.contactId) m.contactId = s.currentContactId;
      return m;
    });
    if (!s.calendar || typeof s.calendar !== 'object' || Array.isArray(s.calendar)) s.calendar = {};
    if (!s.stickers || typeof s.stickers !== 'object') s.stickers = { mine: [], ta: [], public: [] };
    if (!Array.isArray(s.stickers.mine)) s.stickers.mine = [];
    if (!Array.isArray(s.stickers.ta)) s.stickers.ta = [];
    if (!Array.isArray(s.stickers.public)) s.stickers.public = [];
    /* 兼容旧版本误存到 stickers.me 的表情，迁移到 mine */
    if (Array.isArray(s.stickers.me) && s.stickers.me.length) {
      s.stickers.mine = s.stickers.mine.concat(s.stickers.me);
      delete s.stickers.me;
    }
    if (!s.stickers.mine.length && !s.stickers.ta.length && App.DEFAULT_STICKERS) {
      s.stickers.mine = App.DEFAULT_STICKERS.mine.slice();
      s.stickers.ta = App.DEFAULT_STICKERS.ta.slice();
    }
    App.normalizeCards(s);
    App.normalizeMusic(s);
    if (!s.wallet || typeof s.wallet !== 'object' || Array.isArray(s.wallet)) s.wallet = App.WALLET_SEED();
    ['me', 'ta'].forEach(function (side) {
      const value = Math.round(Number(s.wallet[side]));
      s.wallet[side] = Number.isFinite(value) ? Math.max(0, value) : 520;
    });
    if (!s.market || typeof s.market !== 'object' || Array.isArray(s.market)) s.market = {};
    if (!Array.isArray(s.market.products)) s.market.products = App.MARKET_SEED();
    s.market.products = s.market.products.filter(function (p) {
      return p && typeof p === 'object' && String(p.name || '').trim();
    }).map(function (p) {
      if (!p.id) p.id = App.uid('p');
      p.name = String(p.name).trim().slice(0, 20);
      p.price = Math.max(1, Math.round(Number(p.price) || 1));
      p.icon = String(p.icon || '🎁').slice(0, 4);
      p.fav = p.fav && typeof p.fav === 'object' ? p.fav : { me: false, ta: false };
      return p;
    });
    if (!s.iconStyle || typeof s.iconStyle !== 'object') s.iconStyle = { shape: 'rounded', color: 'blue' };
    if (!['rounded', 'circle', 'square'].includes(s.iconStyle.shape)) s.iconStyle.shape = 'rounded';
    if (!['blue', 'lilac', 'sage', 'apricot'].includes(s.iconStyle.color)) s.iconStyle.color = 'blue';

    s.contacts.forEach(function (c) {
      if (!c.id) c.id = App.uid('c');
      if (!s.chats[c.id]) s.chats[c.id] = [];
      if (!c.settings || typeof c.settings !== 'object') c.settings = {};
      if (c.settings.typingMs != null && c.settings.typingMin == null) {
        c.settings.typingMin = Math.max(0.1, Math.round(Number(c.settings.typingMs) / 6000) / 10);
      }
      delete c.settings.typingMs;
      if (typeof c.birthday !== 'string') c.birthday = '';
    });
    if (!s.contacts.some(function (c) { return c.id === s.currentContactId; })) {
      s.currentContactId = s.contacts.length ? s.contacts[0].id : null;
    }

    App.state = s;
  };

  /* 每个角色独立的回复/互动设置，未单独设置的项回落到全局默认值 */
  App.contactSettings = function (contact) {
    const base = (App.state && App.state.settings) || {};
    const own = contact && contact.settings ? contact.settings : {};
    function pick(key, fallback) {
      if (own[key] != null) return own[key];
      return base[key] != null ? base[key] : fallback;
    }
    return {
      replyMin: pick('replyMin', 1),
      replyMax: pick('replyMax', 2),
      typingMin: pick('typingMin', 0.1),
      taMsgProb: pick('taMsgProb', 8),
      emotionProb: pick('emotionProb', 30),
      taLikeProb: pick('taLikeProb', 60),
      taCommentProb: pick('taCommentProb', 40),
      taMomentCards: pick('taMomentCards', 1),
      taMomentProb: pick('taMomentProb', 25),
      taMomentDailyMax: pick('taMomentDailyMax', 3),
      taMomentGapMin: pick('taMomentGapMin', 10),
      taMomentGapMax: pick('taMomentGapMax', 60),
      taMomentCardMin: pick('taMomentCardMin', 1),
      taMomentCardMax: pick('taMomentCardMax', 3),
      patBackProb: pick('patBackProb', 50),
      taStickerProb: pick('taStickerProb', 30),
      taRecallProb: pick('taRecallProb', 5),
      taQuoteProb: pick('taQuoteProb', 20),
      taFavProb: pick('taFavProb', 15),
      musicPauseProb: pick('musicPauseProb', 15),
      musicPlayProb: pick('musicPlayProb', 60),
      musicFavProb: pick('musicFavProb', 25),
      musicSwitchProb: pick('musicSwitchProb', 30),
      callIncomingProb: pick('callIncomingProb', 12),
      callAnswerProb: pick('callAnswerProb', 70),
      callBusyProb: pick('callBusyProb', 15),
      callRejectProb: pick('callRejectProb', 15),
      callHangupProb: pick('callHangupProb', 10),
    };
  };

  /* 头像：本地图片（dataURL）优先，兼容旧的 emoji */
  App.avatarHtml = function (src) {
    const value = String(src || '');
    if (/^(data:image\/|https?:|blob:)/.test(value)) {
      return '<img class="avatar-img" src="' + App.esc(value) + '" alt="">';
    }
    return '<span class="avatar-emoji">' + App.esc(value || '🙂') + '</span>';
  };

  /* 数字输入 + 步进按钮（可手动输入，也可 +/- 微调） */
  App.bindStepper = function (selector, onCommit, options) {
    const opts = options || {};
    const min = opts.min != null ? opts.min : 0;
    const max = opts.max != null ? opts.max : 100;
    const step = opts.step != null ? opts.step : 5;
    const decimals = Math.max(0, Math.min(3, Number(opts.decimals) || 0));
    const factor = Math.pow(10, decimals);
    const input = document.querySelector(selector);
    if (!input) return;

    function commit(raw) {
      const num = Number(raw);
      let v = isNaN(num) ? min : Math.round(num * factor) / factor;
      v = Math.max(min, Math.min(max, v));
      const text = v.toFixed(decimals);
      if (input.value !== text) input.value = text;
      onCommit(Number(text));
    }

    input.addEventListener('change', function () { commit(input.value); });
    document.querySelectorAll('[data-step-for="' + selector.slice(1) + '"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        commit((Number(input.value) || 0) + Number(btn.dataset.step));
      });
    });
  };

  /* 下拉框赋值：没有完全匹配的选项时取数值最接近的一项 */
  App.setSelect = function (selector, value) {
    const node = document.querySelector(selector);
    if (!node) return;
    const str = String(value);
    const options = Array.from(node.options);
    if (options.some(function (o) { return o.value === str; })) {
      node.value = str;
      return;
    }
    let best = null;
    let bestDiff = Infinity;
    options.forEach(function (o) {
      const diff = Math.abs(Number(o.value) - Number(value));
      if (diff < bestDiff) { bestDiff = diff; best = o.value; }
    });
    if (best != null) node.value = best;
  };

  /* 分类迁移与字段补全（聊天/拍一拍/情绪/语音） */
  App.normalizeCards = function (s) {
    if (!s || !Array.isArray(s.cards)) return;
    const OLD_CATEGORY = {
      '日常': '聊天', '撒娇': '聊天', '关心': '聊天',
      '吐槽': '聊天', '深夜': '聊天', '鼓励': '聊天',
    };
    s.cards.forEach(function (c) {
      if (OLD_CATEGORY[c.category]) c.category = '聊天';
      if (c.text === '拍一拍') {
        c.category = '拍一拍';
        c.text = '拍了拍{name}';
        c.trigger = '';
      }
      if (App.CATEGORIES.indexOf(c.category) === -1) c.category = '聊天';
      if (c.category === '情绪') {
        if (!c.emotion) c.emotion = '平常';
        if (['强', '中', '弱'].indexOf(c.strength) === -1) c.strength = '中';
      }
    });
    /* 补齐新版内置字卡 */
    (App.BUILTIN_CARDS || []).forEach(function (c) {
      if (!s.cards.some(function (x) { return x.id === c.id; })) {
        s.cards.push(Object.assign({}, c));
      }
    });
  };

  /* ---------- 时间与文案工具 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  App.fmtTime = function (ts) {
    const d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  App.fmtDate = function (date) {
    const d = new Date(date);
    const week = '日一二三四五六'[d.getDay()];
    return (d.getMonth() + 1) + '.' + d.getDate() + ' 周' + week;
  };

  App.daysSince = function (dateStr) {
    if (!dateStr) return 1;
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 1;
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((today - start) / 86400000);
    return Math.max(1, diff + 1);
  };

  App.lastMessage = function (contactId) {
    const chat = App.state.chats[contactId] || [];
    return chat.length ? chat[chat.length - 1] : null;
  };

  App.messagePreview = function (m) {
    if (!m) return '';
    if (m.recalled) return '[已撤回]';
    if (m.type === 'image') return '[图片]';
    if (m.type === 'audio') return '[语音]';
    if (m.type === 'pat') return m.text || '拍了拍';
    if (m.type === 'redpacket') return '[红包] ' + (m.amount || 0) + ' 同心币';
    if (m.type === 'gift') return '[礼物] ' + (m.productName || '');
    return m.text || '';
  };

  /* ---------- 情绪强度 → 百分比 ---------- */
  App.emotionPercent = function (strength) {
    if (strength === '强') return 70 + Math.floor(Math.random() * 31); // 70~100
    if (strength === '弱') return Math.floor(Math.random() * 40);      // 0~39
    return 40 + Math.floor(Math.random() * 30);                        // 40~69
  };

  /* ---------- 字卡抽取 ---------- */
  App.pickCards = function (userText, count, contactId, categories) {
    const cats = categories && categories.length ? categories : ['聊天', '情绪', '语音'];
    const enabled = App.state.cards.filter(function (c) {
      if (!c.enabled || !c.text) return false;
      if (cats.indexOf(c.category) === -1) return false;
      if (c.category === '语音' && !c.audio) return false;
      return true;
    });
    if (!enabled.length || count <= 0) return [];

    const recent = {};
    (App.state.chats[contactId || App.chatContactId] || []).slice(-10).forEach(function (m) {
      if (m.cardId) recent[m.cardId] = true;
    });

    let pool = enabled.filter(function (c) { return !recent[c.id]; });
    if (pool.length < count) pool = enabled.slice();

    const picked = [];
    const used = {};
    for (let i = 0; i < count; i++) {
      const candidates = pool.filter(function (c) { return !used[c.id]; });
      if (!candidates.length) break;
      const weights = candidates.map(function (c) {
        return (c.trigger && userText.indexOf(c.trigger) !== -1) ? 8 : 1;
      });
      let total = weights.reduce(function (a, b) { return a + b; }, 0);
      let r = Math.random() * total;
      let index = 0;
      while (index < candidates.length - 1 && r > weights[index]) {
        r -= weights[index];
        index++;
      }
      picked.push(candidates[index]);
      used[candidates[index].id] = true;
    }
    return picked;
  };

  /* 随机抽一张“拍一拍”字卡 */
  App.pickPatCard = function () {
    const pool = App.state.cards.filter(function (c) {
      return c.enabled && c.category === '拍一拍' && c.text;
    });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  /* ---------- 文件工具 ---------- */
  App.stamp = function () {
    const d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  };

  App.downloadJSON = function (data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };

  /* 本地图片压缩为 dataURL（头像、表情包共用）
     使用 objectURL + createImageBitmap 缩放解码，避免大图在手机上占用过多内存导致页面重载 */
  App.compressImage = function (file, maxSize) {
    const max = maxSize || 240;

    function drawToDataUrl(source, width, height) {
      let w = width;
      let h = height;
      if (w > h) {
        if (w > max) { h = Math.round(h * max / w); w = max; }
      } else if (h > max) {
        w = Math.round(w * max / h); h = max;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      let settled = false;

      function finish(ok, value) {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        if (ok) resolve(value);
        else reject(value);
      }

      function fromImage() {
        const img = new Image();
        img.onload = function () {
          try {
            finish(true, drawToDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height));
          } catch (e) {
            finish(false, e);
          }
        };
        img.onerror = function () { finish(false, new Error('图片读取失败')); };
        img.src = url;
      }

      if (typeof createImageBitmap === 'function') {
        const opts = { resizeWidth: max, resizeQuality: 'medium' };
        let pending;
        try {
          pending = createImageBitmap(file, opts);
        } catch (e) {
          fromImage();
          return;
        }
        pending.then(function (bitmap) {
          try {
            const src = drawToDataUrl(bitmap, bitmap.width, bitmap.height);
            if (bitmap.close) bitmap.close();
            finish(true, src);
          } catch (e) {
            if (bitmap.close) bitmap.close();
            fromImage();
          }
        }).catch(fromImage);
      } else {
        fromImage();
      }
    });
  };

  App.readJSONFile = function (file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        try { resolve(JSON.parse(String(reader.result))); }
        catch (e) { reject(new Error('文件不是有效的 JSON')); }
      };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsText(file);
    });
  };
})();
