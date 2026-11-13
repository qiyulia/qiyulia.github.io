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
    if (!s.settings) s.settings = { replyMin: 1, replyMax: 2, typingMs: 700 };
    if (s.settings.taLikeProb == null) s.settings.taLikeProb = 60;
    if (s.settings.taCommentProb == null) s.settings.taCommentProb = 40;
    if (s.settings.taMomentCards == null) s.settings.taMomentCards = 1;
    if (!s.theme) s.theme = 'mist';
    if (typeof s.notes !== 'string') s.notes = '';
    if (!Array.isArray(s.moments)) s.moments = [];
    if (!s.calendar || typeof s.calendar !== 'object' || Array.isArray(s.calendar)) s.calendar = {};
    if (!s.stickers || typeof s.stickers !== 'object') s.stickers = { mine: [], ta: [] };
    if (!Array.isArray(s.stickers.mine)) s.stickers.mine = [];
    if (!Array.isArray(s.stickers.ta)) s.stickers.ta = [];
    if (!s.stickers.mine.length && !s.stickers.ta.length && App.DEFAULT_STICKERS) {
      s.stickers = {
        mine: App.DEFAULT_STICKERS.mine.slice(),
        ta: App.DEFAULT_STICKERS.ta.slice(),
      };
    }
    App.normalizeCards(s);
    if (!s.iconStyle || typeof s.iconStyle !== 'object') s.iconStyle = { shape: 'rounded', color: 'blue' };
    if (!['rounded', 'circle', 'square'].includes(s.iconStyle.shape)) s.iconStyle.shape = 'rounded';
    if (!['blue', 'lilac', 'sage', 'apricot'].includes(s.iconStyle.color)) s.iconStyle.color = 'blue';

    s.contacts.forEach(function (c) {
      if (!c.id) c.id = App.uid('c');
      if (!s.chats[c.id]) s.chats[c.id] = [];
      if (!c.settings || typeof c.settings !== 'object') c.settings = {};
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
      typingMs: pick('typingMs', 700),
      taLikeProb: pick('taLikeProb', 60),
      taCommentProb: pick('taCommentProb', 40),
      taMomentCards: pick('taMomentCards', 1),
      patBackProb: pick('patBackProb', 50),
      taStickerProb: pick('taStickerProb', 30),
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
    const input = document.querySelector(selector);
    if (!input) return;

    function commit(raw) {
      const num = Number(raw);
      let v = isNaN(num) ? min : Math.round(num);
      v = Math.max(min, Math.min(max, v));
      if (input.value !== String(v)) input.value = String(v);
      onCommit(v);
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
    if (m.type === 'image') return '[图片]';
    if (m.type === 'audio') return '[语音]';
    if (m.type === 'pat') return m.text || '拍了拍';
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

  /* 本地图片压缩为 dataURL（头像、表情包共用） */
  App.compressImage = function (file, maxSize) {
    const max = maxSize || 240;
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > max) { height = Math.round(height * max / width); width = max; }
          } else if (height > max) {
            width = Math.round(width * max / height); height = max;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { reject(new Error('图片读取失败')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('图片读取失败')); };
      reader.readAsDataURL(file);
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
