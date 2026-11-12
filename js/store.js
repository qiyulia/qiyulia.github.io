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
    if (!s.theme) s.theme = 'mist';
    if (typeof s.notes !== 'string') s.notes = '';
    if (!s.iconStyle || typeof s.iconStyle !== 'object') s.iconStyle = { shape: 'rounded', color: 'blue' };
    if (!['rounded', 'circle', 'square'].includes(s.iconStyle.shape)) s.iconStyle.shape = 'rounded';
    if (!['blue', 'lilac', 'sage', 'apricot'].includes(s.iconStyle.color)) s.iconStyle.color = 'blue';

    s.contacts.forEach(function (c) {
      if (!c.id) c.id = App.uid('c');
      if (!s.chats[c.id]) s.chats[c.id] = [];
    });

    App.state = s;
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

  /* ---------- 字卡抽取 ---------- */
  App.pickCards = function (userText, count, contactId) {
    const enabled = App.state.cards.filter(function (c) { return c.enabled && c.text; });
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
