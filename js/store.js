window.__SHIYI_B_store='20261121-contract2';
/* 状态存储与通用工具 */
(function () {
  const App = (window.App = window.App || {});
  const KEY = 'xuyu.state.v1';
  /* 设置类数据的同步镜像：IndexedDB 写入是异步的，刷新或切后台时可能来不及落盘，
     每次保存时同步写一份很小的副本，下次加载时采用更新的那一份 */
  const SETTINGS_KEY = 'xuyu.settings.v1';
  let lastDbSavedAt = 0;

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

  let saveTimer = 0;
  /* 主数据已经搬到 IndexedDB；'local' 只在浏览器不支持时兜底 */
  let storageMode = 'db';
  let saveChain = Promise.resolve();
  let saveWarnAt = 0;

  function warnSaveFailed() {
    if (App.toast && Date.now() - saveWarnAt > 4000) {
      saveWarnAt = Date.now();
      App.toast('保存失败：本地存储空间不足');
    }
  }

  function saveToLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(coreStateForSave()));
      return true;
    } catch (e) {
      warnSaveFailed();
      return false;
    }
  }

  function saveSettingsSnapshot() {
    const st = App.state;
    if (!st) return;
    const look = st.look || {};
    const profile = st.profile || {};
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        savedAt: Date.now(),
        settings: st.settings || {},
        theme: st.theme || '',
        iconStyle: st.iconStyle || null,
        look: { opacity: look.opacity, bubbleCss: look.bubbleCss },
        profile: { userName: profile.userName, since: profile.since },
      }));
    } catch (e) {}
  }

  function readSettingsSnapshot() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (e) {
      return null;
    }
  }

  /* 镜像比本地库里的状态更新时，用镜像里的设置覆盖回来 */
  function applySettingsSnapshot(s) {
    const snap = readSettingsSnapshot();
    if (!snap || !(Number(snap.savedAt) > lastDbSavedAt)) return false;
    if (snap.settings && typeof snap.settings === 'object') {
      s.settings = Object.assign({}, s.settings, snap.settings);
    }
    if (snap.theme) s.theme = snap.theme;
    if (snap.iconStyle && typeof snap.iconStyle === 'object') {
      s.iconStyle = Object.assign({}, s.iconStyle, snap.iconStyle);
    }
    if (snap.look && typeof snap.look === 'object') {
      const opacity = Number(snap.look.opacity);
      if (Number.isFinite(opacity)) s.look.opacity = Math.max(20, Math.min(100, Math.round(opacity)));
      if (typeof snap.look.bubbleCss === 'string') s.look.bubbleCss = snap.look.bubbleCss;
    }
    if (snap.profile && typeof snap.profile === 'object') {
      if (typeof snap.profile.userName === 'string') s.profile.userName = snap.profile.userName;
      if (typeof snap.profile.since === 'string') s.profile.since = snap.profile.since;
    }
    return true;
  }

  /* ---------- 分模块存储 / 按需加载 ----------
     核心 state 只保留联系人、设置、外观和聊天摘要；大字段各自一条 kv 记录，
     聊天按联系人一条。没加载的模块绝不写回，避免空数据覆盖真实存档。 */
  const LAZY_VERSION = 1;
  const LAZY_MODULES = {
    cards: ['cards', 'builtinRemoved'],
    moments: ['moments'],
    music: ['music'],
    calendar: ['calendar'],
    mail: ['mail'],
    groups: ['groupChats'],
    anniversaries: ['anniversaries', 'reminders'],
    extras: ['memory', 'mood', 'sleep', 'location'],
  };
  const lazyLoaded = {};
  const lazyPromises = {};
  const chatLoaded = {};
  const chatPromises = {};
  let lazyEnabled = false;
  App.chatSummaries = {};

  function emptyLazyField(field) {
    if (field === 'cards' || field === 'moments' || field === 'mail' || field === 'anniversaries' || field === 'reminders') return [];
    if (field === 'music') return { tracks: [], currentId: '', mode: 'sequence', chatFloat: true };
    if (field === 'memory') return { photos: [] };
    if (field === 'mood') return { entries: {} };
    return {};
  }

  function detachLazyFields(target) {
    Object.keys(LAZY_MODULES).forEach(function (name) {
      LAZY_MODULES[name].forEach(function (field) { target[field] = emptyLazyField(field); });
    });
    target.chats = {};
    return target;
  }

  function modulePayload(name, source) {
    const data = {};
    LAZY_MODULES[name].forEach(function (field) {
      if (source[field] !== undefined) data[field] = source[field];
    });
    return data;
  }

  function summarizeChats() {
    const summaries = App.chatSummaries || (App.chatSummaries = {});
    Object.keys(App.state.chats || {}).forEach(function (id) {
      const list = App.state.chats[id] || [];
      if (list.length) summaries[id] = { last: list[list.length - 1] };
      else if (chatLoaded[id]) delete summaries[id];
    });
    return summaries;
  }

  function coreStateForSave() {
    if (!lazyEnabled) return App.state;
    const core = Object.assign({}, App.state);
    detachLazyFields(core);
    core.lazyVersion = LAZY_VERSION;
    core.chatMeta = summarizeChats();
    return core;
  }

  function putJsonRecord(key, value) {
    return withMediaStore('kv', 'readwrite', function (store) {
      return store.put({ data: JSON.stringify(value), savedAt: Date.now() }, key);
    });
  }

  function getJsonRecord(key) {
    return withMediaStore('kv', 'readonly', function (store) {
      return store.get(key);
    }).then(function (record) {
      if (!record || typeof record.data !== 'string') return null;
      try { return JSON.parse(record.data); } catch (e) { return null; }
    });
  }

  const lazySignatures = {};
  const chatSignatures = {};
  function listSignature(list) {
    if (!Array.isArray(list)) return 'x';
    const first = list[0];
    const last = list[list.length - 1];
    return list.length + ':' + (first && first.id || '') + ':' + (last && last.id || '');
  }
  /* 集合里已存在条目的字段变化（收藏、已读、点赞等）不会改变首尾 id，
     这里补一份轻量指纹，避免在别的页面改过之后保存被判定为“没变化”而漏存 */
  function itemFingerprint(field, list) {
    if (!Array.isArray(list)) return '';
    return list.map(function (item) {
      if (!item || typeof item !== 'object') return String(item);
      if (field === 'moments') {
        return (item.id || '') + ':' + (item.fav ? 1 : 0) + (item.favTa ? 1 : 0) + ':' +
          ((item.likes && item.likes.length) || 0) + ':' + ((item.comments && item.comments.length) || 0) +
          ':' + String(item.text || '').length;
      }
      if (field === 'mail') return (item.id || '') + ':' + (item.fav ? 1 : 0) + (item.read ? 1 : 0);
      if (field === 'cards') return (item.id || '') + ':' + (item.enabled === false ? 0 : 1) + ':' + (item.owner || '');
      if (field === 'anniversaries') return (item.id || '') + ':' + (item.date || '') + ':' + (item.name || '');
      if (field === 'reminders') return (item.id || '') + ':' + (item.done ? 1 : 0) + ':' + (item.date || '') + (item.time || '');
      return String(item.id || '');
    }).join(',');
  }
  function musicFingerprint(music) {
    const fav = music.favorites || {};
    return (music.mode || '') + ':' + (music.chatFloat === false ? 0 : 1) + ':' + (music.currentId || '') + ':' +
      (Array.isArray(fav.mine) ? fav.mine.join('+') : '') + ':' + (Array.isArray(fav.ta) ? fav.ta.join('+') : '') + ':' +
      (Array.isArray(music.tracks) ? music.tracks.map(function (t) { return (t && t.id) || ''; }).join(',') : '');
  }
  /* 照片的 base64 太大，指纹只取说明、日期、绑定关系这些会变的字段 */
  function memoryFingerprint(memory) {
    const photos = (memory && memory.photos) || [];
    return photos.length + ':' + photos.map(function (p) {
      p = p || {};
      const likes = p.likes ? ((p.likes.me ? 1 : 0) + (p.likes.ta ? 1 : 0)) : 0;
      return (p.id || '') + ':' + (p.date || '') + ':' + (p.caption || '') + ':' +
        (p.secret ? 1 : 0) + ':' + (p.annivId || '') + ':' + likes;
    }).join(',');
  }
  function moduleSignature(name) {
    return LAZY_MODULES[name].map(function (field) {
      const value = App.state[field];
      if (Array.isArray(value)) return listSignature(value) + '|' + itemFingerprint(field, value);
      if (!value || typeof value !== 'object') return String(value);
      if (field === 'groupChats') {
        return Object.keys(value).map(function (id) { return id + listSignature(value[id]); }).join('|');
      }
      if (field === 'music') return musicFingerprint(value);
      if (field === 'memory') return memoryFingerprint(value);
      if (field === 'calendar' || field === 'mood' || field === 'sleep' || field === 'location') return JSON.stringify(value);
      return Object.keys(value).length + ':' + (value.currentId || '') + ':' + listSignature(value.tracks) + ':' + listSignature(value.photos);
    }).join('|');
  }
  function chatSignature(id) {
    const list = App.state.chats[id] || [];
    let flags = 0;
    for (let i = 0; i < list.length; i++) {
      const m = list[i] || {};
      flags += (m.read ? 1 : 0) + (m.fav ? 1 : 0) + (m.recalled ? 1 : 0) + (m.noReply ? 1 : 0);
    }
    return listSignature(list) + ':' + flags;
  }
  function moduleIsActive(name) {
    const view = document.getElementById('app').dataset.view;
    const map = {
      cards: 'cards', moments: 'moments', music: 'music', calendar: 'calendar', mail: 'mail',
      groups: 'groups', anniversaries: 'anniversary', extras: 'memorywall'
    };
    if (map[name] === view) return true;
    if (name === 'groups' && (view === 'group-chat' || view === 'group-settings')) return true;
    if (name === 'anniversaries' && view === 'notes') return true;
    if (name === 'extras' && (view === 'mood' || view === 'location')) return true;
    return false;
  }

  function persistLazyParts() {
    if (!lazyEnabled) return Promise.resolve();
    let chain = Promise.resolve();
    Object.keys(LAZY_MODULES).forEach(function (name) {
      if (!lazyLoaded[name] && !moduleHasPending(name)) return;
      chain = chain.then(function () {
        /* 后台任务可能先给未加载模块写了新内容：先读旧记录合并，绝不能直接写空壳 */
        const ready = lazyLoaded[name] ? Promise.resolve() : App.loadModule(name);
        return ready.then(function () {
          if (!lazyLoaded[name]) return;
          const signature = moduleSignature(name);
          if (!moduleIsActive(name) && lazySignatures[name] === signature) return;
          return putJsonRecord('lazy:' + name, modulePayload(name, App.state)).then(function () {
            lazySignatures[name] = signature;
          });
        });
      });
    });
    const view = document.getElementById('app').dataset.view;
    const ids = {};
    Object.keys(chatLoaded).forEach(function (id) { ids[id] = true; });
    Object.keys(App.state.chats || {}).forEach(function (id) { ids[id] = true; });
    Object.keys(ids).forEach(function (id) {
      const pending = (App.state.chats[id] || []).length > 0;
      if (!chatLoaded[id] && !pending) return;
      chain = chain.then(function () {
        /* 新消息先于聊天加载到达时，也先合并完整历史再落盘，关页不会只剩摘要 */
        const ready = chatLoaded[id] ? Promise.resolve() : App.loadChat(id, false);
        return ready.then(function () {
          if (!chatLoaded[id]) return;
          const signature = chatSignature(id);
          const active = (view === 'chat' && App.state.currentContactId === id) || view === 'favorites';
          if (!active && chatSignatures[id] === signature) return;
          return putJsonRecord('chat:' + id, App.state.chats[id] || []).then(function () {
            chatSignatures[id] = signature;
          });
        });
      });
    });
    return chain;
  }

  /* state 里还留着聊天图片的 base64，整份 JSON.stringify 在手机上常要
     几百毫秒到几秒。它原来是同步的：只要恰好在用户点「从本地相册添加」
     的瞬间执行，就会卡住 WebKit 主线程，系统相册要隔好久才弹得出来，
     刷新时同样会卡在开屏。把序列化让出一次事件循环即可根治。 */
  function stringifyStateAsync() {
    return new Promise(function (resolve, reject) {
      var run = function () {
        try { resolve(JSON.stringify(coreStateForSave())); }
        catch (e) { reject(e); }
      };
      /* 优先在浏览器空闲时做；不支持或超时就退化为下一个事件循环 */
      if (window.requestIdleCallback) {
        try { requestIdleCallback(run, { timeout: 1500 }); }
        catch (e) { setTimeout(run, 0); }
      } else {
        setTimeout(run, 0);
      }
    });
  }

  /* 常规保存：序列化异步化，点击/弹相册永远优先 */
  function persistState() {
    const job = saveChain.catch(function () {}).then(function () {
      return stringifyStateAsync().then(function (json) {
        return withMediaStore('kv', 'readwrite', function (store) {
          return store.put({ data: json, savedAt: Date.now() }, 'state');
        });
      }).then(function () { return persistLazyParts(); });
    });
    saveChain = job.catch(function () {});
    return job;
  }

  /* 页面隐藏/关闭时的紧急落盘：必须同步，否则 idle 回调可能不再执行导致丢数据。
     此时用户已经切走，不会挡住系统相册弹出。 */
  function persistStateNow() {
    const json = JSON.stringify(coreStateForSave());
    const job = saveChain.catch(function () {}).then(function () {
      return withMediaStore('kv', 'readwrite', function (store) {
        return store.put({ data: json, savedAt: Date.now() }, 'state');
      });
    }).then(function () { return persistLazyParts(); });
    saveChain = job.catch(function () {});
    return job;
  }

  /* 每个联系人只留最近这么多条，聊天记录用一年也不会把存档撑爆 */
  const MAX_CHAT_MESSAGES = 3000;
  function trimChats() {
    const chats = App.state && App.state.chats;
    if (!chats) return;
    Object.keys(chats).forEach(function (id) {
      const arr = chats[id];
      if (Array.isArray(arr) && arr.length > MAX_CHAT_MESSAGES) {
        /* 原地删掉最旧的，别换数组引用，避免别处手里的引用失效 */
        arr.splice(0, arr.length - MAX_CHAT_MESSAGES);
      }
    });
  }

  function writeState(urgent) {
    /* 数据尚未从 IndexedDB 读回时界面是种子态占位，
       任何一次落盘都会把空数据覆盖掉真实存档。整体挂起，等 dataReady 再补写。 */
    if (App.dataReady === false) return;
    trimChats();
    /* 先同步写设置镜像，即使下面的异步写入被刷新打断，设置也不会丢 */
    saveSettingsSnapshot();
    if (storageMode === 'local') {
      saveToLocal();
      return;
    }
    const job = urgent ? persistStateNow() : persistState();
    job.catch(function () {
      storageMode = 'local';
      saveToLocal();
    });
  }

  /* 合并短时间内的多次保存，避免每次点击都同步序列化整份数据造成卡顿 */
  App.save = function () {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      writeState();
    }, 200);
  };

  /* 主动打扰：5 件事各算各的次数，谁也不占谁的。
     每一类单独计数、单独封顶，发满当天只有这一类安静，第二天零点各自重置。
     填 0 就是这一类彻底不主动冒出来。默认合计 12 次，跟以前共用一个总闸时一样，
     但不会再出现某一件事把次数全吃掉、别的事一次都轮不到。 */
  const DISTURB_FIELDS = {
    msg:    { setting: 'taDisturbMsgLimit',    fallback: 3, label: '主动发消息' },
    pat:    { setting: 'taDisturbPatLimit',    fallback: 3, label: '拍一拍' },
    music:  { setting: 'taDisturbMusicLimit',  fallback: 2, label: '邀请一起听歌' },
    survey: { setting: 'taDisturbSurveyLimit', fallback: 2, label: '发问卷' },
    mail:   { setting: 'taDisturbMailLimit',   fallback: 2, label: '写信' }
  };
  App.TA_DISTURB_FIELDS = DISTURB_FIELDS;

  function dayStampNow() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  App.taDisturbLimit = function (key) {
    const cfg = DISTURB_FIELDS[key];
    if (!cfg) return 0;
    const st = App.state;
    const raw = Math.round(Number(st && st.settings && st.settings[cfg.setting]));
    return Number.isFinite(raw) ? Math.max(0, Math.min(999, raw)) : cfg.fallback;
  };

  App.taDisturbUsed = function (key) {
    const st = App.state;
    const q = st && st.taDisturb;
    if (!q || q.day !== dayStampNow()) return 0;
    return Number(q[key]) || 0;
  };

  App.taDisturbHit = function (key) {
    const st = App.state;
    if (!st || !DISTURB_FIELDS[key]) return false;
    const limit = App.taDisturbLimit(key);
    if (limit <= 0) return false;
    const day = dayStampNow();
    const q = st.taDisturb || (st.taDisturb = { day: day });
    if (q.day !== day) {
      q.day = day;
      Object.keys(DISTURB_FIELDS).forEach(function (k) { q[k] = 0; });
      delete q.count;
    }
    if ((Number(q[key]) || 0) >= limit) return false;
    q[key] = (Number(q[key]) || 0) + 1;
    App.save();
    return true;
  };

  App.flushSave = function () {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = 0;
    /* 切后台/关页 = 紧急落盘，走同步路径，保证不丢数据 */
    writeState(true);
  };

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') App.flushSave();
  });
  window.addEventListener('pagehide', function () { App.flushSave(); });

  /* ---------- 本地媒体库（IndexedDB，和音乐共用 xuyu-media） ----------
     语音不再塞进 localStorage，改存 Blob，state 里只留 voice:<id> 索引。 */
  const MEDIA_DB = 'xuyu-media';
  const MEDIA_VERSION = 4;
  let mediaDbPromise = null;
  const voiceUrls = {};

  App.openMediaDB = function () {
    if (mediaDbPromise) return mediaDbPromise;
    mediaDbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('当前浏览器不支持本地媒体存储'));
        return;
      }
      const request = indexedDB.open(MEDIA_DB, MEDIA_VERSION);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('voice')) db.createObjectStore('voice', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        /* 表情包 base64 体积大，独立存储，不再塞进 App.state 导致序列化阻塞 */
        if (!db.objectStoreNames.contains('stickers')) db.createObjectStore('stickers', { keyPath: 'key' });
        /* 聊天图片 / 已发送的表情包 / 动态配图同理，state 里只留 img:<id> 索引 */
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('本地媒体库打开失败')); };
      /* 被其它连接挡住（版本升级 / 旧连接未关）时不能一直挂起；
         reject 后读取流程会回退到 localStorage / 种子数据，界面至少能跑起来。 */
      request.onblocked = function () { reject(new Error('本地媒体库打开被阻塞')); };
    });
    return mediaDbPromise;
  };

  function withMediaStore(name, mode, operation) {
    return App.openMediaDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(name, mode);
        const request = operation(tx.objectStore(name));
        let result;
        if (request) request.onsuccess = function () { result = request.result; };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('本地媒体存储失败')); };
        tx.onabort = function () { reject(tx.error || new Error('本地媒体存储已取消')); };
      });
    });
  }

  /* ---------- 表情包外置存储 ----------
     表情包是 base64，单张可达数百 KB，几百张就是几十上百 MB。
     以前全塞在 App.state 里，每次 App.save() 都要 JSON.stringify 整份，
     数据多时同步阻塞主线程数百 ms 到数秒 → 界面卡死、所有按钮（含导入、刷新）点不动。
     现在表情包独立存 IndexedDB，主 state 只留空壳，运行时用内存缓存。 */
  const STICKER_STORE = 'stickers';
  App.stickerCache = { public: null, mine: null, contacts: {} };
  let stickerCachePromise = null;

  function readAllStickers() {
    if (!window.indexedDB) return Promise.resolve([]);
    return withMediaStore(STICKER_STORE, 'readonly', function (store) {
      return store.getAll();
    }).catch(function () { return []; });
  }

  /* 加载所有表情包到内存缓存；同时把旧版本残留在 App.state 里的搬到 IDB 并清空 */
  App.loadStickers = function () {
    if (stickerCachePromise) return stickerCachePromise;
    stickerCachePromise = readAllStickers().then(function (all) {
      const map = {};
      (all || []).forEach(function (rec) { if (rec && rec.key) map[rec.key] = Array.isArray(rec.value) ? rec.value : []; });
      App.stickerCache.public = map['public'] || [];
      App.stickerCache.mine = map['mine'] || [];
      const cs = {};
      (App.state.contacts || []).forEach(function (c) { cs[c.id] = map['contact:' + c.id] || []; });
      App.stickerCache.contacts = cs;

      /* 迁移旧数据：state 里还残留的表情搬到 IDB，成功后清空主 state 里的大字段。
         不用 skipCache：saveStickerSet 默认会同步刷新内存缓存，这样本次会话面板立刻就能显示，
         不必等下一次 reload 才从 IDB 读出来。 */
      const jobs = [];
      if (App.state.stickers) {
        ['public', 'mine'].forEach(function (side) {
          const old = App.state.stickers[side];
          if (Array.isArray(old) && old.length) {
            const snapshot = old.slice();
            jobs.push(App.saveStickerSet(side, snapshot).then(function () {
              App.state.stickers[side] = [];
            }));
          }
        });
      }
      (App.state.contacts || []).forEach(function (c) {
        if (Array.isArray(c.stickers) && c.stickers.length) {
          const snapshot = c.stickers.slice();
          jobs.push(App.saveStickerSet('contact:' + c.id, snapshot).then(function () {
            c.stickers = [];
          }));
        }
      });
      return Promise.all(jobs).then(function () {
        if (jobs.length) {
          /* 清空大字段后的轻量 state 落盘一次，之后序列化就很快了 */
          try { App.save(); } catch (e) {}
        }
      });
    }).catch(function () {
      /* IDB 不可用：回退到读 state 里的旧数据，至少能显示 */
      App.stickerCache.public = (App.state.stickers && App.state.stickers.public) || [];
      App.stickerCache.mine = (App.state.stickers && App.state.stickers.mine) || [];
      (App.state.contacts || []).forEach(function (c) { App.stickerCache.contacts[c.id] = c.stickers || []; });
    });
    return stickerCachePromise;
  };

  /* key: 'public' | 'mine' | 'contact:<id>'。skipCache 用于迁移时只写 IDB 不刷缓存 */
  App.saveStickerSet = function (key, arr, skipCache) {
    const list = Array.isArray(arr) ? arr.slice() : [];
    if (!skipCache) {
      if (key === 'public') App.stickerCache.public = list;
      else if (key === 'mine') App.stickerCache.mine = list;
      else if (key.indexOf('contact:') === 0) App.stickerCache.contacts[key.slice(8)] = list;
    }
    if (!window.indexedDB) return Promise.resolve();
    /* stickers store 用 keyPath:'key'（inline key），put 时不能再传第二个 key 参数，
       否则部分浏览器会抛 DataError 导致写入静默失败、reload 后数据丢失。 */
    return withMediaStore(STICKER_STORE, 'readwrite', function (store) {
      return store.put({ key: key, value: list });
    }).catch(function () {});
  };

  App.stickerReady = function () { return App.loadStickers(); };

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'audio/mpeg';
    const binary = atob(parts[1] || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function revokeVoiceUrl(id) {
    const url = voiceUrls[id];
    if (!url) return;
    URL.revokeObjectURL(url);
    delete voiceUrls[id];
  }

  /* 把一段语音 dataURL 写进 IndexedDB，返回 voice:<id>；不可用时原样返回 */
  App.saveVoiceDataUrl = function (dataUrl) {
    const value = String(dataUrl || '');
    if (value.indexOf('data:audio') !== 0 || !window.indexedDB) return Promise.resolve(value);
    const id = App.uid('voice');
    return withMediaStore('voice', 'readwrite', function (store) {
      return store.put({ id: id, blob: dataUrlToBlob(value), createdAt: Date.now() });
    }).then(function () {
      return 'voice:' + id;
    }).catch(function () {
      return value;
    });
  };

  App.voiceBlob = function (ref) {
    const value = String(ref || '');
    if (value.indexOf('voice:') !== 0) return Promise.resolve(null);
    return withMediaStore('voice', 'readonly', function (store) {
      return store.get(value.slice(6));
    }).then(function (record) { return (record && record.blob) || null; });
  };

  /* 把 voice:<id> 解析成可直接播放的 objectURL（带缓存） */
  App.voiceSrc = function (ref) {
    const value = String(ref || '');
    if (value.indexOf('voice:') !== 0) return Promise.resolve(value);
    const id = value.slice(6);
    if (!id) return Promise.resolve('');
    if (voiceUrls[id]) return Promise.resolve(voiceUrls[id]);
    return App.voiceBlob(value).then(function (blob) {
      if (!blob) return '';
      const url = URL.createObjectURL(blob);
      voiceUrls[id] = url;
      return url;
    });
  };

  App.voiceDataUrl = function (ref) {
    return App.voiceBlob(ref).then(function (blob) {
      if (!blob) return '';
      return new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { resolve(''); };
        reader.readAsDataURL(blob);
      });
    });
  };

  /* 渲染后给 [data-media] 的音频元素补上真实 src */
  const warnedVoice = {};
  App.hydrateMedia = function (root) {
    const scope = root || document;
    scope.querySelectorAll('[data-media]').forEach(function (node) {
      const ref = node.getAttribute('data-media');
      if (!ref || node.getAttribute('data-media-loaded') === ref) return;
      node.setAttribute('data-media-loaded', ref);
      App.voiceSrc(ref).then(function (src) {
        if (src) {
          node.src = src;
          return;
        }
        node.removeAttribute('data-media-loaded');
        if (App.toast && !warnedVoice[ref]) {
          warnedVoice[ref] = true;
          App.toast('这段语音已经找不到了');
        }
      }).catch(function () {});
    });
  };

  /* 旧数据迁移：字卡和聊天里的 dataURL 语音全部搬进 IndexedDB */
  App.migrateVoiceToIdb = function () {
    if (!window.indexedDB || !App.state) return Promise.resolve(0);
    const jobs = [];
    const refs = {};
    function convert(value, apply) {
      if (typeof value !== 'string' || value.indexOf('data:audio') !== 0) return;
      /* 同一条语音被多条消息复制过，迁移时只写一份 */
      if (!refs[value]) refs[value] = App.saveVoiceDataUrl(value);
      jobs.push(refs[value].then(function (ref) {
        if (ref && ref.indexOf('voice:') === 0) apply(ref);
      }).catch(function () {}));
    }
    (App.state.cards || []).forEach(function (card) {
      convert(card.audio, function (ref) { card.audio = ref; });
    });
    Object.keys(App.state.chats || {}).forEach(function (contactId) {
      (App.state.chats[contactId] || []).forEach(function (message) {
        convert(message.src, function (ref) { message.src = ref; });
      });
    });
    if (!jobs.length) return Promise.resolve(0);
    return Promise.all(jobs).then(function () {
      App.save();
      App.flushSave();
      return jobs.length;
    });
  };

  /* ---------- 图片外置存储 ----------
     聊天图片、已发送的表情包、动态配图以前都是 base64 直接存在 App.state 里。
     聊天记录一多，每次 App.save() 都要把几十上百 MB 的照片整份 JSON.stringify，
     同步阻塞主线程数秒 → 界面卡住，点「导入」等按钮要排队很久才弹出文件选择器。
     现在统一写进 IndexedDB 的 images store，state 里只留 img:<id> 索引。 */
  const IMAGE_STORE = 'images';
  const imageUrls = {};

  function blobToDataUrl(blob) {
    if (!blob) return Promise.resolve('');
    return new Promise(function (resolve) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { resolve(''); };
      reader.readAsDataURL(blob);
    });
  }

  /* base64 图片写进 IndexedDB，返回 img:<id>；不可用时原样返回 */
  App.imageRef = function (dataUrl) {
    const value = String(dataUrl || '');
    if (value.indexOf('data:image') !== 0 || !window.indexedDB) return Promise.resolve(value);
    const id = App.uid('img');
    return withMediaStore(IMAGE_STORE, 'readwrite', function (store) {
      return store.put({ id: id, blob: dataUrlToBlob(value), createdAt: Date.now() });
    }).then(function () { return 'img:' + id; }).catch(function () { return value; });
  };

  /* 把 img:<id> 解析成可直接给 <img> 用的 objectURL（带缓存） */
  App.imageSrc = function (ref) {
    const value = String(ref || '');
    if (value.indexOf('img:') !== 0) return Promise.resolve(value);
    const id = value.slice(4);
    if (!id) return Promise.resolve('');
    if (imageUrls[id]) return Promise.resolve(imageUrls[id]);
    return withMediaStore(IMAGE_STORE, 'readonly', function (store) {
      return store.get(id);
    }).then(function (record) {
      if (!record || !record.blob) return '';
      const url = URL.createObjectURL(record.blob);
      imageUrls[id] = url;
      return url;
    }).catch(function () { return ''; });
  };

  App.imageDataUrl = function (ref) {
    const value = String(ref || '');
    if (value.indexOf('img:') !== 0) return Promise.resolve(value);
    return withMediaStore(IMAGE_STORE, 'readonly', function (store) {
      return store.get(value.slice(4));
    }).then(function (record) { return blobToDataUrl(record && record.blob); })
      .catch(function () { return ''; });
  };

  /* 渲染后给 [data-img-ref] 的图片补上真实 src */
  App.hydrateImages = function (root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('[data-img-ref]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const ref = node.getAttribute('data-img-ref');
      if (!ref || node.getAttribute('data-img-loaded') === ref) continue;
      node.setAttribute('data-img-loaded', ref);
      App.imageSrc(ref).then(function (src) {
        if (src) { node.src = src; return; }
        node.removeAttribute('data-img-loaded');
        node.removeAttribute('data-img-ref');
      }).catch(function () {});
    }
  };

  /* 旧数据迁移：聊天图片 / 表情包消息 / 引用缩略图 / 动态配图全部搬进 IndexedDB */
  App.migrateImagesToIdb = function () {
    if (!window.indexedDB || !App.state) return Promise.resolve(0);
    const jobs = [];
    const refs = {};
    function convert(obj, key) {
      const value = obj && obj[key];
      if (typeof value !== 'string' || value.indexOf('data:image') !== 0) return;
      /* 同一张表情包被多条消息复制过，迁移时只写一份 */
      if (!refs[value]) refs[value] = App.imageRef(value);
      jobs.push(refs[value].then(function (ref) {
        if (ref && ref.indexOf('img:') === 0) obj[key] = ref;
      }).catch(function () {}));
    }
    Object.keys(App.state.chats || {}).forEach(function (contactId) {
      (App.state.chats[contactId] || []).forEach(function (message) {
        if (!message || typeof message !== 'object') return;
        convert(message, 'src');
        convert(message, 'stickerSrc');
        if (message.quote && typeof message.quote === 'object') convert(message.quote, 'src');
      });
    });
    Object.keys(App.state.groupChats || {}).forEach(function (groupId) {
      (App.state.groupChats[groupId] || []).forEach(function (message) {
        if (message && typeof message === 'object') convert(message, 'src');
      });
    });
    (App.state.moments || []).forEach(function (moment) {
      if (!moment || typeof moment !== 'object') return;
      convert(moment, 'image');
      convert(moment, 'sticker');
    });
    if (!jobs.length) return Promise.resolve(0);
    return Promise.all(jobs).then(function () {
      /* 替换成索引后的轻量 state 落盘一次，之后序列化就很快了 */
      App.save();
      App.flushSave();
      return jobs.length;
    });
  };

  /* 只在备份导出/导入时遍历这些图片字段 */
  function walkImageFields(root, fn) {
    if (!root || typeof root !== 'object') return Promise.resolve(root);
    const jobs = [];
    function conv(obj, key) {
      if (!obj || typeof obj[key] !== 'string') return;
      const job = fn(obj[key]);
      if (!job) return;
      jobs.push(job.then(function (out) { if (out) obj[key] = out; }).catch(function () {}));
    }
    Object.keys(root.chats || {}).forEach(function (contactId) {
      (root.chats[contactId] || []).forEach(function (message) {
        if (!message || typeof message !== 'object') return;
        conv(message, 'src');
        conv(message, 'stickerSrc');
        if (message.quote && typeof message.quote === 'object') conv(message.quote, 'src');
      });
    });
    Object.keys(root.groupChats || {}).forEach(function (groupId) {
      (root.groupChats[groupId] || []).forEach(function (message) {
        if (message && typeof message === 'object') conv(message, 'src');
      });
    });
    (root.moments || []).forEach(function (moment) {
      if (!moment || typeof moment !== 'object') return;
      conv(moment, 'image');
      conv(moment, 'sticker');
    });
    return Promise.all(jobs).then(function () { return root; });
  }

  /* 导出时把图片还原成 dataURL，换设备导入也能看到 */
  App.inlineImages = function (root) {
    return walkImageFields(root, function (value) {
      if (value.indexOf('img:') !== 0) return null;
      return App.imageDataUrl(value);
    });
  };

  /* 导入时把 dataURL 图片写回 IndexedDB，state 里只留索引 */
  App.adoptImageDataUrls = function (root) {
    return walkImageFields(root, function (value) {
      if (value.indexOf('data:image') !== 0) return null;
      return App.imageRef(value);
    });
  };

  /* 统计某个 Blob 库里所有记录的总字节数（用游标，避免一次加载全部音频） */
  App.storeBytes = function (name) {
    const stats = { bytes: 0, count: 0 };
    return withMediaStore(name, 'readonly', function (store) {
      const request = store.openCursor();
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value;
        stats.bytes += (value && value.blob && value.blob.size) || 0;
        stats.count++;
        cursor.continue();
      };
      return null;
    }).then(function () { return stats; });
  };

  /* 内存统计：会话数据 + 语音 + 音乐，全部在 IndexedDB 里。
     会话大小直接读已落盘的那条 JSON 记录，绝不再 JSON.stringify(App.state)：
     存档几十 MB 时那句同步序列化会占住主线程好几秒，统计页和整个界面一起卡死。 */
  App.memoryUsage = function () {
    return Promise.all([
      App.savedStateBytes(),
      App.storeBytes('voice'),
      App.storeBytes('audio'),
      App.storeBytes('images')
    ]).then(function (results) {
      const local = results[0];
      const stats = results.slice(1);
      return {
        local: local,
        voice: stats[0].bytes,
        voiceCount: stats[0].count,
        music: stats[1].bytes,
        musicCount: stats[1].count,
        image: stats[2].bytes,
        imageCount: stats[2].count,
        total: local + stats[0].bytes + stats[1].bytes + stats[2].bytes,
      };
    });
  };

  /* 统计指定记录的总字节数 */
  function recordBytes(name, ids) {
    if (!ids.length) return Promise.resolve(0);
    const stats = { bytes: 0 };
    return withMediaStore(name, 'readonly', function (store) {
      ids.forEach(function (id) {
        const request = store.get(id);
        request.onsuccess = function () {
          const record = request.result;
          stats.bytes += (record && record.blob && record.blob.size) || 0;
        };
      });
      return null;
    }).then(function () { return stats.bytes; });
  }

  /* 清理孤儿媒体：没有字卡/消息引用的语音，以及歌单里已不存在的本地音乐 */
  function cleanOrphanMediaLoaded() {
    const usedVoice = {};
    (App.state.cards || []).forEach(function (card) {
      if (card.audio) usedVoice[card.audio] = true;
    });
    Object.keys(App.state.chats || {}).forEach(function (contactId) {
      (App.state.chats[contactId] || []).forEach(function (message) {
        if (message.src) usedVoice[message.src] = true;
      });
    });
    const trackIds = {};
    ((App.state.music && App.state.music.tracks) || []).forEach(function (track) {
      if (track && track.id) trackIds[track.id] = true;
    });

    return Promise.all([
      withMediaStore('voice', 'readonly', function (store) { return store.getAllKeys(); }),
      withMediaStore('audio', 'readonly', function (store) { return store.getAllKeys(); }),
    ]).then(function (keys) {
      const staleVoice = (keys[0] || []).filter(function (id) { return !usedVoice['voice:' + id]; });
      const staleAudio = (keys[1] || []).filter(function (id) { return !trackIds[id]; });
      if (!staleVoice.length && !staleAudio.length) {
        return { removed: 0, bytes: 0, voice: 0, music: 0 };
      }
      return Promise.all([
        recordBytes('voice', staleVoice),
        recordBytes('audio', staleAudio),
      ]).then(function (sizes) {
        const jobs = [];
        if (staleVoice.length) {
          jobs.push(withMediaStore('voice', 'readwrite', function (store) {
            staleVoice.forEach(function (id) {
              store.delete(id);
              revokeVoiceUrl(id);
            });
          }));
        }
        if (staleAudio.length) {
          jobs.push(withMediaStore('audio', 'readwrite', function (store) {
            staleAudio.forEach(function (id) { store.delete(id); });
          }));
        }
        return Promise.all(jobs).then(function () {
          return {
            removed: staleVoice.length + staleAudio.length,
            bytes: sizes[0] + sizes[1],
            voice: staleVoice.length,
            music: staleAudio.length,
          };
        });
      });
    });
  }

  App.cleanOrphanMedia = function () {
    /* 未加载的聊天/字卡/歌单也有媒体引用，必须全部读回后才能判断谁是孤儿 */
    return App.loadAllLazy().then(function () {
      const incomplete = lazyEnabled && (
        Object.keys(LAZY_MODULES).some(function (name) { return !lazyLoaded[name]; }) ||
        (App.state.contacts || []).some(function (c) { return !chatLoaded[c.id]; })
      );
      if (incomplete) throw new Error('本地数据还没完整读回，已取消清理');
      return cleanOrphanMediaLoaded();
    });
  };

  /* 清除缓存：孤儿语音/音乐 + 浏览器里的过期临时缓存，不动聊天、字卡等功能数据 */
  App.clearAppCache = function () {
    return App.cleanOrphanMedia().then(function (result) {
      const jobs = [];
      /* 旧版本 Service Worker 留下的站点缓存 */
      if (window.caches && window.caches.keys) {
        jobs.push(window.caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (key) { return window.caches.delete(key); }));
        }).catch(function () {}));
      }
      /* 选图跳转时的一次性记录，清掉不影响任何内容 */
      try { localStorage.removeItem('xuyu.pickView'); } catch (e) {}
      try { sessionStorage.removeItem('xuyu.stickerPick'); } catch (e) {}
      /* 数据已经以 IndexedDB 为准时，localStorage 里的旧副本可以安全删掉；
         如果当前是 localStorage 兜底模式，那就是主数据，不能碰 */
      if (storageMode !== 'local') {
        try { localStorage.removeItem(KEY); } catch (e) {}
      }
      return Promise.all(jobs).then(function () { return result; });
    });
  };

  App.clearVoiceMedia = function () {
    Object.keys(voiceUrls).forEach(revokeVoiceUrl);
    return withMediaStore('voice', 'readwrite', function (store) { return store.clear(); });
  };

  /* 深度遍历对象里的 voice: 索引或语音 dataURL，做导入导出的转换 */
  function walkVoiceStrings(root, handler) {
    const jobs = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      Object.keys(node).forEach(function (key) {
        const value = node[key];
        if (typeof value === 'string') {
          const job = handler(value);
          if (job) {
            jobs.push(job.then(function (next) {
              if (typeof next === 'string' && next) node[key] = next;
            }));
          }
        } else if (value && typeof value === 'object') {
          walk(value);
        }
      });
    }
    walk(root);
    return Promise.all(jobs).then(function () { return root; });
  }

  /* 导出时把语音还原成 dataURL，换设备导入也能播放 */
  App.inlineVoice = function (root) {
    return walkVoiceStrings(root, function (value) {
      if (value.indexOf('voice:') !== 0) return null;
      return App.voiceDataUrl(value);
    });
  };

  /* 导入时把 dataURL 语音写回 IndexedDB，state 里只留索引 */
  App.adoptVoiceDataUrls = function (root) {
    return walkVoiceStrings(root, function (value) {
      if (value.indexOf('data:audio') !== 0) return null;
      return App.saveVoiceDataUrl(value);
    });
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

  /* 读回语音库里真实存在的 blob 键，用来识别「指向已丢失音频」的残缺引用。
     读不到就返回 null：此时只清空的，不动 voice: 引用，避免误删。 */
  function readVoiceKeys() {
    if (!window.indexedDB) return Promise.resolve(null);
    return withMediaStore('voice', 'readonly', function (store) {
      return store.getAllKeys();
    }).then(function (keys) {
      var map = {};
      (keys || []).forEach(function (k) { map[String(k)] = true; });
      return map;
    }).catch(function () { return null; });
  }

  /* 从 IndexedDB 读回上次保存的整份状态 */
  function readSavedState() {
    return withMediaStore('kv', 'readonly', function (store) {
      return store.get('state');
    }).then(function (record) {
      if (!record) return null;
      lastDbSavedAt = Number(record.savedAt) || 0;
      if (typeof record.data === 'string') {
        /* 几千张字卡 + 图片 base64 时，这一句同步解析要占住主线程几百 ms。
           让出一次事件循环：浏览器先完成绘制/响应点击，再接着解析，
           控制流和返回值完全不变，只是不再一口气堵死。 */
        return new Promise(function (resolve) {
          setTimeout(function () {
            try { resolve(JSON.parse(record.data)); }
            catch (e) { resolve(null); }
          }, 0);
        });
      }
      if (record.state && record.state.version === 1) return record.state;
      if (record.version === 1) return record;
      return null;
    }).catch(function () { return null; });
  }

  /* 已保存会话数据的字节数：只读 IndexedDB 里现成的字符串，
     用 Blob 量 UTF-8 大小；不解析、不重新序列化，主线程零负担。 */
  App.savedStateBytes = function () {
    function blobSize(text) {
      try { return new Blob([text]).size; }
      catch (e) { return String(text || '').length; }
    }
    const result = { bytes: 0 };
    return withMediaStore('kv', 'readonly', function (store) {
      const request = store.openCursor();
      request.onsuccess = function () {
        const cursor = request.result;
        if (!cursor) return;
        const record = cursor.value;
        if (record && typeof record.data === 'string') result.bytes += blobSize(record.data);
        cursor.continue();
      };
      return null;
    }).then(function () {
      if (result.bytes) return result.bytes;
      try { return blobSize(localStorage.getItem(KEY) || ''); }
      catch (e) { return 0; }
    }).catch(function () {
      try { return blobSize(localStorage.getItem(KEY) || ''); }
      catch (e) { return 0; }
    });
  };

  function finishLoad(saved, voiceKeys) {
    let raw = saved;
    const fromDb = !!saved;
    /* 旧版本把数据放在 localStorage，第一次打开时自动搬过来 */
    if (!raw) {
      try {
        raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch (e) {
        raw = null;
      }
    }

    const s = (raw && raw.version === 1) ? raw : App.seedState();

    if (!Array.isArray(s.contacts)) s.contacts = [];
    if (!s.chats || typeof s.chats !== 'object' || Array.isArray(s.chats)) s.chats = {};
    /* 旧版「已读不回」是一条独立消息，改为标在我那条消息的已读状态上 */
    Object.keys(s.chats).forEach(function (id) {
      const list = Array.isArray(s.chats[id]) ? s.chats[id] : [];
      const out = [];
      list.forEach(function (m) {
        if (m && m.type === 'ignore') {
          for (let i = out.length - 1; i >= 0; i--) {
            if (out[i].role === 'me') {
              out[i].read = true;
              out[i].noReply = true;
              break;
            }
          }
          return;
        }
        out.push(m);
      });
      s.chats[id] = out;
    });
    if (!Array.isArray(s.cards)) s.cards = App.BUILTIN_CARDS.map(function (c) { return Object.assign({}, c); });
    /* 字卡按联系人隔离：owner 为联系人 id 的是某个角色专属的字卡，
       空 owner 是大家一起用的默认（内置）字卡；
       每个联系人各自记住自己删掉/去重掉的内置卡，刷新后不会再恢复 */
    if (!s.builtinRemoved || typeof s.builtinRemoved !== 'object' || Array.isArray(s.builtinRemoved)) s.builtinRemoved = {};
    if (!s.cardsOwnerMigrated) {
      const ownerId = s.currentContactId || (s.contacts[0] && s.contacts[0].id) || '';
      s.cards.forEach(function (c) {
        if (!c) return;
        if (c.builtin) c.owner = '';
        else if (typeof c.owner !== 'string') c.owner = ownerId;
      });
      s.cardsOwnerMigrated = true;
    }
    /* 情绪卡只作为气泡里的情绪标签，不再作为一条独立消息；清掉以前误发出来的那些 */
    if (!s.emotionTextCleaned) {
      const moodIds = {};
      s.cards.forEach(function (c) { if (c && c.category === '情绪') moodIds[c.id] = true; });
      Object.keys(s.chats).forEach(function (id) {
        s.chats[id] = (s.chats[id] || []).filter(function (m) {
          return !(m && m.type === 'text' && m.cardId && moodIds[m.cardId]);
        });
      });
      s.emotionTextCleaned = true;
    }
    if (!s.profile) s.profile = { userName: '我', userAvatar: App.DEFAULT_AVATAR, since: '' };
    /* 旧版默认形象（阿眠 / 🌙 / 🍊）换成中性 ta 与灰底人像，用户自己选的图片不受影响 */
    const legacyAvatar = function (src) {
      return src === '🌙' || src === '🍊';
    };
    if (!s.profile.userAvatar || legacyAvatar(s.profile.userAvatar)) s.profile.userAvatar = App.DEFAULT_AVATAR;
    s.contacts.forEach(function (contact) {
      if (!contact) return;
      if (contact.name === '阿眠') contact.name = 'ta';
      if (!contact.avatar || legacyAvatar(contact.avatar)) contact.avatar = App.DEFAULT_AVATAR;
    });
    if (!s.settings) s.settings = { replyMin: 1, replyMax: 2, typingMin: 0.1 };
    /* 打字停顿由毫秒改为分钟 */
    if (s.settings.typingMin == null) {
      const legacyMs = Number(s.settings.typingMs);
      s.settings.typingMin = Number.isFinite(legacyMs)
        ? Math.max(0.1, Math.round(legacyMs / 6000) / 10)
        : 0.1;
    }
    delete s.settings.typingMs;
    /* 回复时间改为「最快 / 最慢」区间（秒） */
    if (s.settings.replyDelayMinSec == null) {
      const oldSec = Math.round((Number(s.settings.typingMin) || 0.1) * 60);
      s.settings.replyDelayMinSec = Math.max(0, Math.min(300, oldSec));
    }
    if (s.settings.replyDelayMaxSec == null) {
      s.settings.replyDelayMaxSec = Math.min(300, Math.max(Number(s.settings.replyDelayMinSec) || 0, Math.round((Number(s.settings.typingMin) || 0.1) * 60) + 10));
    }
    if (!s.avatarPool || typeof s.avatarPool !== 'object') s.avatarPool = { mine: [], ta: [] };
    if (!Array.isArray(s.avatarPool.mine)) s.avatarPool.mine = [];
    if (!Array.isArray(s.avatarPool.ta)) s.avatarPool.ta = [];
    if (!s.namePool || typeof s.namePool !== 'object') s.namePool = { mine: [], ta: [] };
    ['mine', 'ta'].forEach(function (side) {
      if (!Array.isArray(s.namePool[side])) s.namePool[side] = [];
      s.namePool[side] = s.namePool[side].filter(function (name) {
        return typeof name === 'string' && name.trim();
      }).map(function (name) { return name.trim().slice(0, 16); });
    });
    if (s.profile.userName && s.namePool.mine.indexOf(s.profile.userName) === -1) {
      s.namePool.mine.unshift(s.profile.userName);
    }
    s.contacts.forEach(function (contact) {
      if (contact && contact.name && s.namePool.ta.indexOf(contact.name) === -1) {
        s.namePool.ta.push(contact.name);
      }
    });
    /* 旧默认名不再参与 TA 改名 */
    ['mine', 'ta'].forEach(function (side) {
      s.namePool[side] = s.namePool[side].filter(function (name) { return name !== '阿眠'; });
    });
    if (s.settings.avatarSelfProb == null) s.settings.avatarSelfProb = 40;
    if (s.settings.avatarMeProb == null) s.settings.avatarMeProb = 25;
    if (s.settings.nameSelfProb == null) s.settings.nameSelfProb = 20;
    if (s.settings.nameMeProb == null) s.settings.nameMeProb = 10;
    if (s.settings.taMsgProb == null) s.settings.taMsgProb = 8;
    if (s.settings.taMsgGapMin == null) s.settings.taMsgGapMin = 1;
    if (s.settings.taMsgMin == null) s.settings.taMsgMin = 1;
    if (s.settings.taMsgMax == null) s.settings.taMsgMax = 3;
    if (s.settings.taVoiceProb == null) s.settings.taVoiceProb = 20;
    if (s.settings.taIgnoreProb == null) s.settings.taIgnoreProb = 15;
    if (s.settings.mergeProb == null) s.settings.mergeProb = 15;
    if (s.settings.mergeMin == null) s.settings.mergeMin = 2;
    if (s.settings.mergeMax == null) s.settings.mergeMax = 3;
    if (s.settings.cardOfferProb == null) s.settings.cardOfferProb = 10;
    if (s.settings.taRedpacketProb == null) s.settings.taRedpacketProb = 8;
    if (s.settings.redpacketAcceptProb == null) s.settings.redpacketAcceptProb = 70;
    if (s.settings.redpacketReturnProb == null) s.settings.redpacketReturnProb = 20;
    if (s.settings.taPatProb == null) s.settings.taPatProb = 10;
    if (s.settings.taSurveyProb == null) s.settings.taSurveyProb = 10;
    if (s.settings.taSurveyCooldownMin == null) s.settings.taSurveyCooldownMin = 30;
    if (s.settings.taMarketGiftProb == null) s.settings.taMarketGiftProb = 6;
    if (s.settings.taMarketBuyProb == null) s.settings.taMarketBuyProb = 6;
    if (s.settings.taMarketWishProb == null) s.settings.taMarketWishProb = 8;
    if (s.settings.taMarketFavProb == null) s.settings.taMarketFavProb = 4;
    if (s.settings.taMarketBuyForMeProb == null) s.settings.taMarketBuyForMeProb = 4;
    if (s.settings.taMarketDailyLimit == null) s.settings.taMarketDailyLimit = 8;
    /* 主动打扰：由「一个共用次数」拆成 5 类各自独立的次数。
       老存档若把总闸关成 0，就沿用为全关；否则给每一类各自的默认值 */
    const legacyDisturb = Number(s.settings.taDailyDisturbLimit);
    const disturbAllOff = s.settings.taDailyDisturbLimit != null && legacyDisturb === 0;
    Object.keys(App.TA_DISTURB_FIELDS).forEach(function (k) {
      const f = App.TA_DISTURB_FIELDS[k];
      if (s.settings[f.setting] == null) s.settings[f.setting] = disturbAllOff ? 0 : f.fallback;
    });
    delete s.settings.taDailyDisturbLimit;
    if (s.settings.taDailyAllowance == null) s.settings.taDailyAllowance = 30;
    /* 集市互动恢复为 5 个各自独立的概率，清掉中间版本合并出来的单一概率字段；
       间隔改为按「每天几条」自动平均，旧的手动间隔字段不再使用 */
    delete s.settings.taMarketProb;
    delete s.settings.taMarketGapMin;
    if (s.settings.mailCardMin == null) s.settings.mailCardMin = 1;
    if (s.settings.mailCardMax == null) s.settings.mailCardMax = 3;
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
    if (s.settings.taMoodProb == null) s.settings.taMoodProb = 70;
    if (s.settings.locPromptProb == null) s.settings.locPromptProb = 20;
    if (typeof s.settings.iconsFollowTheme !== 'boolean') s.settings.iconsFollowTheme = true;
    if (!s.settings.calendarTheme || typeof s.settings.calendarTheme !== 'object') s.settings.calendarTheme = {};
    ['enabled', 'valentine', 'qixi', 'christmas', 'newyear', 'anniversary'].forEach(function (key) {
      if (s.settings.calendarTheme[key] == null) s.settings.calendarTheme[key] = true;
    });
    if (s.settings.taRecallProb == null) s.settings.taRecallProb = 5;
    if (s.settings.taQuoteProb == null) s.settings.taQuoteProb = 20;
    if (s.settings.taFavProb == null) s.settings.taFavProb = 15;
    if (s.settings.musicPauseProb == null) s.settings.musicPauseProb = 15;
    if (s.settings.musicFavProb == null) s.settings.musicFavProb = 25;
    if (s.settings.musicUnfavProb == null) {
      /* 旧存档首次升级到新音乐互动规则：旧的「重新播放 60%」改为默认必定重播 */
      if (Number(s.settings.musicPlayProb) === 60) s.settings.musicPlayProb = 100;
      s.settings.musicUnfavProb = 15;
    }
    if (s.settings.musicPlayProb == null) s.settings.musicPlayProb = 100;
    if (s.settings.musicSwitchProb == null) s.settings.musicSwitchProb = 30;
    if (s.settings.musicInviteProb == null) s.settings.musicInviteProb = 5;
    if (s.settings.jealousyProb == null) s.settings.jealousyProb = 30;
    if (typeof s.settings.contextReplyEnabled !== 'boolean') s.settings.contextReplyEnabled = true;
    if (s.settings.followupDelaySec == null) s.settings.followupDelaySec = 60;
    if (s.settings.callIncomingProb == null) s.settings.callIncomingProb = 12;
    if (s.settings.callAnswerProb == null) s.settings.callAnswerProb = 70;
    if (s.settings.callBusyProb == null) s.settings.callBusyProb = 15;
    if (s.settings.callRejectProb == null) s.settings.callRejectProb = 15;
    if (s.settings.callHangupProb == null) s.settings.callHangupProb = 10;
    if (s.settings.voiceTranscript == null) s.settings.voiceTranscript = true;
    if (!s.theme) s.theme = 'mist';
    if (typeof s.notes !== 'string') s.notes = '';
    if (!Array.isArray(s.moments)) s.moments = [];
    if (s.momentsSeenTs == null) s.momentsSeenTs = Date.now();
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
    if (!s.stickers || typeof s.stickers !== 'object') s.stickers = { mine: [], public: [] };
    if (!Array.isArray(s.stickers.mine)) s.stickers.mine = [];
    if (!Array.isArray(s.stickers.public)) s.stickers.public = [];
    /* 清理旧版本内置的默认表情包（矢量图），用户自己导入的图片不受影响 */
    ['mine', 'public', 'ta'].forEach(function (side) {
      if (Array.isArray(s.stickers[side])) {
        s.stickers[side] = s.stickers[side].filter(function (src) {
          return typeof src === 'string' && src && !/^data:image\/svg/i.test(src);
        });
      }
    });
    /* 兼容旧版本误存到 stickers.me 的表情，迁移到 mine */
    if (Array.isArray(s.stickers.me) && s.stickers.me.length) {
      s.stickers.mine = s.stickers.mine.concat(s.stickers.me);
      delete s.stickers.me;
    }
    if (!s.stickers.mine.length && App.DEFAULT_STICKERS) {
      s.stickers.mine = App.DEFAULT_STICKERS.mine.slice();
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
    /* 集市上架新商品：老存档只补一次，之后用户自己下架不会再被补回来 */
    if ((Number(s.settings.marketSeedVersion) || 1) < 3) {
      const haveIds = {};
      s.market.products.forEach(function (p) { haveIds[p.id] = true; });
      App.MARKET_SEED().forEach(function (p) {
        if (!haveIds[p.id]) s.market.products.push(p);
      });
      s.settings.marketSeedVersion = 3;
    }
    if (!s.iconStyle || typeof s.iconStyle !== 'object') s.iconStyle = { shape: 'rounded', color: 'blue' };
    if (!['rounded', 'circle', 'square'].includes(s.iconStyle.shape)) s.iconStyle.shape = 'rounded';
    if (!['blue', 'lilac', 'sage', 'apricot'].includes(s.iconStyle.color)) s.iconStyle.color = 'blue';

    /* 纪念日：自定义名称 + 日期 */
    if (!Array.isArray(s.anniversaries)) s.anniversaries = [];
    s.anniversaries = s.anniversaries.filter(function (a) {
      return a && typeof a === 'object' && String(a.name || '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || ''));
    }).map(function (a) {
      if (!a.id) a.id = App.uid('an');
      a.name = String(a.name).trim().slice(0, 12);
      a.date = String(a.date);
      return a;
    });

    /* 笔记：每天按开始 / 结束时间提醒 */
    if (!Array.isArray(s.reminders)) s.reminders = [];
    s.reminders = s.reminders.filter(function (r) {
      return r && typeof r === 'object' && String(r.title || '').trim();
    }).map(function (r) {
      if (!r.id) r.id = App.uid('rem');
      r.title = String(r.title).trim().slice(0, 40);
      r.start = /^\d{2}:\d{2}$/.test(String(r.start || '')) ? String(r.start) : '09:00';
      r.end = /^\d{2}:\d{2}$/.test(String(r.end || '')) ? String(r.end) : '18:00';
      r.active = r.active !== false;
      r.lastStart = String(r.lastStart || '');
      r.lastEnd = String(r.lastEnd || '');
      r.snoozeAt = Number(r.snoozeAt) || 0;
      return r;
    });

    /* 外观：背景图、透明度、自定义气泡 CSS */
    if (!s.look || typeof s.look !== 'object') s.look = {};
    const look = s.look;
    ['bgImage', 'chatBg', 'callBg', 'bubbleCss'].forEach(function (k) {
      if (typeof look[k] !== 'string') look[k] = '';
    });
    look.opacity = Number(look.opacity);
    if (!Number.isFinite(look.opacity)) look.opacity = 100;
    if (!look.v) {
      look.v = 2;
      if (look.opacity === 80) look.opacity = 100;
    }
    look.opacity = Math.max(20, Math.min(100, Math.round(look.opacity)));

    s.contacts.forEach(function (c) {
      if (!c.id) c.id = App.uid('c');
      if (!s.chats[c.id]) s.chats[c.id] = [];
      if (!c.settings || typeof c.settings !== 'object') c.settings = {};
      if (c.settings.typingMs != null && c.settings.typingMin == null) {
        c.settings.typingMin = Math.max(0.1, Math.round(Number(c.settings.typingMs) / 6000) / 10);
      }
      delete c.settings.typingMs;
      if (typeof c.birthday !== 'string') c.birthday = '';
      /* 每位联系人各自存一套表情包 */
      if (!Array.isArray(c.stickers)) c.stickers = [];
      c.stickers = c.stickers.filter(function (src) {
        return typeof src === 'string' && src && !/^data:image\/svg/i.test(src);
      });
    });
    /* 旧版全局的「TA 的表情包」拆到每位联系人各自的表情包里，之后只用联系人自己的 */
    if (Array.isArray(s.stickers.ta)) {
      if (s.stickers.ta.length) {
        s.contacts.forEach(function (c) {
          s.stickers.ta.forEach(function (src) {
            if (c.stickers.indexOf(src) === -1) c.stickers.push(src);
          });
        });
      }
      delete s.stickers.ta;
    }
    if (!s.contacts.some(function (c) { return c.id === s.currentContactId; })) {
      s.currentContactId = s.contacts.length ? s.contacts[0].id : null;
    }

    /* 设置镜像比本地库更新时（例如刚改完就刷新，异步写入没赶上），用镜像补齐 */
    const snapshotUsed = applySettingsSnapshot(s);

    /* ---- 启动自愈：清掉会让渲染中断、刷新后卡开屏的残缺记录 ----
       ① 空 src 的图片/语音消息；② 指向已不存在音频 blob 的 voice: 引用；
       ③ 同样失效的字卡语音。以前只能靠手动跑控制台脚本，现在每次加载自动完成。 */
    var cleaned = 0;
    Object.keys(s.chats || {}).forEach(function (id) {
      const list = Array.isArray(s.chats[id]) ? s.chats[id] : [];
      const out = [];
      list.forEach(function (m) {
        if (!m || typeof m !== 'object') { cleaned++; return; }
        const src = typeof m.src === 'string' ? m.src : '';
        if ((m.type === 'image' || m.type === 'audio') && !src) { cleaned++; return; }
        if (m.type === 'audio' && src.indexOf('voice:') === 0 && voiceKeys && !voiceKeys[src.slice(6)]) {
          cleaned++; return;
        }
        out.push(m);
      });
      s.chats[id] = out;
    });
    (s.cards || []).forEach(function (c) {
      if (!c || typeof c.audio !== 'string' || c.audio.indexOf('voice:') !== 0) return;
      if (voiceKeys && !voiceKeys[c.audio.slice(6)]) { c.audio = ''; cleaned++; }
    });

    /* 已是分模块核心记录时，规范化空字段会补入内置字卡、空聊天等占位；
       返回前再次摘掉，避免它们被误认为未加载期间的新数据。 */
    if (s.lazyVersion === LAZY_VERSION) detachLazyFields(s);
    App.state = s;
    return { state: s, fromDb: fromDb, snapshotUsed: snapshotUsed, cleaned: cleaned };
  }

  /* 合并「尚未加载时后台任务新写入」的内容，老记录为主，新消息按 id 补进来 */
  function mergeById(stored, current) {
    const oldList = Array.isArray(stored) ? stored : [];
    const newList = Array.isArray(current) ? current : [];
    if (!newList.length) return oldList;
    const seen = {};
    oldList.forEach(function (item, i) { if (item && item.id) seen[item.id] = i; });
    const extra = newList.filter(function (item) { return !item || !item.id || seen[item.id] === undefined; });
    return extra.length ? oldList.concat(extra) : oldList;
  }

  function sameJson(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch (e) { return a === b; }
  }

  function moduleHasPending(name) {
    return LAZY_MODULES[name].some(function (field) {
      const empty = emptyLazyField(field);
      const value = App.state[field];
      if (Array.isArray(empty)) return Array.isArray(value) && value.length > 0;
      return !sameJson(value, empty);
    });
  }

  /* 未加载时只能出现“相对空壳新增/修改”的内容。按空壳做差异合并，
     旧记录里的其他字段、历史和设置全部保留，新内容也不会被读取覆盖。 */
  function mergeLazyValue(stored, current, empty) {
    if (Array.isArray(current)) {
      if (!current.length) return Array.isArray(stored) ? stored : [];
      const objects = current.some(function (item) { return item && typeof item === 'object'; });
      if (objects) return mergeById(stored, current);
      const result = Array.isArray(stored) ? stored.slice() : [];
      current.forEach(function (item) { if (result.indexOf(item) === -1) result.push(item); });
      return result;
    }
    if (current && typeof current === 'object') {
      const result = stored && typeof stored === 'object' && !Array.isArray(stored)
        ? Object.assign({}, stored)
        : {};
      const base = empty && typeof empty === 'object' && !Array.isArray(empty) ? empty : {};
      Object.keys(current).forEach(function (key) {
        const value = current[key];
        if (Object.prototype.hasOwnProperty.call(base, key) && sameJson(value, base[key])) return;
        if (value && typeof value === 'object') {
          const childBase = base[key] !== undefined ? base[key] : (Array.isArray(value) ? [] : {});
          result[key] = mergeLazyValue(result[key], value, childBase);
        } else {
          result[key] = value;
        }
      });
      return result;
    }
    return current;
  }

  function mergeModulePayload(name, stored) {
    const result = {};
    LAZY_MODULES[name].forEach(function (field) {
      result[field] = mergeLazyValue(stored && stored[field], App.state[field], emptyLazyField(field));
    });
    return result;
  }

  App.isModuleLoaded = function (name) { return !lazyEnabled || !!lazyLoaded[name]; };
  App.isChatLoaded = function (id) { return !lazyEnabled || !!chatLoaded[id]; };

  /* 后台补齐模块后，给当前页补一次轻量刷新：
     桌面刷新角标，聊天页刷新音乐小窗，避免一直显示成空数据 */
  function refreshCurrentView() {
    const app = document.getElementById('app');
    const view = app && app.dataset.view;
    if (view === 'desktop') {
      if (App.updateBadges) App.updateBadges();
    } else if (view === 'chat' && App.renderMusic) {
      App.renderMusic();
    }
  }

  App.loadModule = function (name) {
    if (!lazyEnabled || !LAZY_MODULES[name] || lazyLoaded[name]) return Promise.resolve(App.state);
    if (lazyPromises[name]) return lazyPromises[name];
    lazyPromises[name] = getJsonRecord('lazy:' + name).then(function (data) {
      const hadPending = moduleHasPending(name);
      const merged = mergeModulePayload(name, data);
      LAZY_MODULES[name].forEach(function (field) { App.state[field] = merged[field]; });
      lazyLoaded[name] = true;
      /* 纯读回的内容无需立刻重写；有合并新内容时保持脏标记，下次保存落盘 */
      if (hadPending) delete lazySignatures[name];
      else lazySignatures[name] = moduleSignature(name);
      refreshCurrentView();
      return App.state;
    }).catch(function () {
      /* 读取失败不标记已加载，保存仍不会碰这份数据；下次进入允许重试 */
      delete lazyPromises[name];
      return App.state;
    });
    return lazyPromises[name];
  };

  function preloadChatVoices(list) {
    const refs = {};
    (list || []).forEach(function (m) {
      if (m && typeof m.src === 'string' && m.src.indexOf('voice:') === 0) refs[m.src] = true;
    });
    Object.keys(refs).forEach(function (ref) { App.voiceSrc(ref).catch(function () {}); });
  }

  App.loadChat = function (id, withVoices) {
    if (withVoices === undefined) withVoices = true;
    if (!id || !lazyEnabled || chatLoaded[id]) {
      if (withVoices && id && App.state.chats[id]) preloadChatVoices(App.state.chats[id]);
      return Promise.resolve(App.state.chats[id] || []);
    }
    if (chatPromises[id]) {
      return chatPromises[id].then(function (list) {
        if (withVoices) preloadChatVoices(list);
        return list;
      });
    }
    chatPromises[id] = getJsonRecord('chat:' + id).then(function (stored) {
      const hadPending = (App.state.chats[id] || []).length > 0;
      const merged = mergeById(stored || [], App.state.chats[id]);
      App.state.chats[id] = merged;
      chatLoaded[id] = true;
      if (hadPending) delete chatSignatures[id];
      else chatSignatures[id] = chatSignature(id);
      if (merged.length) App.chatSummaries[id] = { last: merged[merged.length - 1] };
      if (withVoices) preloadChatVoices(merged);
      return merged;
    }).catch(function () {
      delete chatPromises[id];
      return App.state.chats[id] || [];
    });
    return chatPromises[id];
  };

  /* 删除联系人时连带删掉磁盘上的聊天记录，否则没加载过的聊天会一直留在本地 */
  App.deleteChatData = function (id) {
    if (!id) return Promise.resolve();
    delete App.state.chats[id];
    delete chatLoaded[id];
    delete chatSignatures[id];
    if (App.chatSummaries) delete App.chatSummaries[id];
    if (!lazyEnabled) return Promise.resolve();
    return withMediaStore('kv', 'readwrite', function (store) {
      return store.delete('chat:' + id);
    }).catch(function () {});
  };

  /* 导入聊天记录时整份替换：导入里没有的旧聊天要连同磁盘记录一起清掉，避免刷新后复活 */
  App.replaceChats = function (next) {
    const map = {};
    Object.keys(next || {}).forEach(function (id) {
      map[id] = Array.isArray(next[id]) ? next[id] : [];
    });
    const stale = {};
    Object.keys(App.state.chats || {}).forEach(function (id) { stale[id] = true; });
    (App.state.contacts || []).forEach(function (c) { stale[c.id] = true; });
    Object.keys(App.chatSummaries || {}).forEach(function (id) { stale[id] = true; });
    App.state.chats = map;
    Object.keys(map).forEach(function (id) {
      chatLoaded[id] = true;
      delete chatSignatures[id];
      if (map[id].length) App.chatSummaries[id] = { last: map[id][map[id].length - 1] };
    });
    Object.keys(stale).forEach(function (id) { if (!map[id]) App.deleteChatData(id); });
  };

  function loadAllChats() {
    let chain = Promise.resolve();
    (App.state.contacts || []).forEach(function (c) {
      /* 收藏/导出/后台只读消息记录；语音在进入对应聊天时才预取 */
      chain = chain.then(function () { return App.loadChat(c.id, false); });
    });
    return chain;
  }

  App.loadAllLazy = function () {
    let chain = Promise.resolve();
    Object.keys(LAZY_MODULES).forEach(function (name) {
      chain = chain.then(function () { return App.loadModule(name); });
    });
    return chain.then(loadAllChats);
  };

  const VIEW_MODULES = {
    /* 桌面小组件直接展示字卡、音乐、回忆、日历和纪念日，进入桌面就要读这几块 */
    desktop: ['cards', 'music', 'extras', 'calendar', 'anniversaries'],
    cards: ['cards'], moments: ['moments', 'cards'], music: ['music'],
    calendar: ['calendar'], mail: ['mail', 'cards'], anniversary: ['anniversaries'],
    notes: ['anniversaries'], groups: ['groups', 'cards'],
    'group-chat': ['groups', 'cards'], 'group-settings': ['groups'],
    /* 回忆墙要绑定纪念日；位置页用的是「地点」字卡 */
    memorywall: ['extras', 'anniversaries'], mood: ['extras'], location: ['extras', 'cards'],
  };
  App.loadViewData = function (view) {
    if (!lazyEnabled) return null;
    const jobs = [];
    (VIEW_MODULES[view] || []).forEach(function (name) {
      if (!lazyLoaded[name]) jobs.push(App.loadModule(name));
    });
    if (view === 'chat') {
      const id = App.state.currentContactId;
      if (id && !chatLoaded[id]) jobs.push(App.loadChat(id, true));
      else if (id) preloadChatVoices(App.state.chats[id]);
      if (!lazyLoaded.cards) jobs.push(App.loadModule('cards'));
      /* 聊天里的音乐小窗和「一起听」邀请都取音乐模块 */
      if (!lazyLoaded.music) jobs.push(App.loadModule('music'));
    }
    if (view === 'favorites') {
      /* 收藏页同时汇总聊天、朋友圈和信件 */
      ['moments', 'mail'].forEach(function (name) {
        if (!lazyLoaded[name]) jobs.push(App.loadModule(name));
      });
      if ((App.state.contacts || []).some(function (c) { return !chatLoaded[c.id]; })) {
        jobs.push(loadAllChats());
      }
    }
    if (!jobs.length) return null;
    return Promise.all(jobs);
  };

  /* 用户不操作时，空闲逐个补齐；任何点击都会让对应模块插队先读 */
  let lazyBackgroundStarted = false;
  App.lazyLoadRemaining = function () {
    if (!lazyEnabled || lazyBackgroundStarted) return;
    lazyBackgroundStarted = true;
    const queue = Object.keys(LAZY_MODULES).map(function (name) {
      return function () { return App.loadModule(name); };
    });
    (App.state.contacts || []).forEach(function (c) {
      queue.push(function () { return App.loadChat(c.id, false); });
    });
    function next() {
      if (!queue.length || document.hidden) {
        if (queue.length) setTimeout(next, 5000);
        return;
      }
      const job = queue.shift();
      job().then(function () { setTimeout(next, 800); });
    }
    setTimeout(next, 1500);
  };

  /* 旧整包存档一次性拆分；拆分成功后才启用懒加载，失败则完整保留旧模式 */
  function migrateLazyState(full) {
    const summaries = {};
    Object.keys(full.chats || {}).forEach(function (id) {
      const list = full.chats[id] || [];
      if (list.length) summaries[id] = { last: list[list.length - 1] };
    });
    const core = Object.assign({}, full);
    detachLazyFields(core);
    core.lazyVersion = LAZY_VERSION;
    core.chatMeta = summaries;
    /* 同一事务拆分全部记录：任何一条失败都不会留下“核心已拆分、模块却缺失”的半迁移状态 */
    return withMediaStore('kv', 'readwrite', function (store) {
      const savedAt = Date.now();
      function put(key, value) {
        store.put({ data: JSON.stringify(value), savedAt: savedAt }, key);
      }
      Object.keys(LAZY_MODULES).forEach(function (name) {
        put('lazy:' + name, modulePayload(name, full));
      });
      Object.keys(full.chats || {}).forEach(function (id) {
        put('chat:' + id, full.chats[id] || []);
      });
      put('state', core);
      return null;
    }).then(function () {
      lazyEnabled = true;
      App.chatSummaries = summaries;
      detachLazyFields(full);
      full.lazyVersion = LAZY_VERSION;
      full.chatMeta = summaries;
      return full;
    });
  }

  App.markLazyFields = function (fields) {
    if (!lazyEnabled) return;
    Object.keys(LAZY_MODULES).forEach(function (name) {
      if (LAZY_MODULES[name].some(function (field) { return fields.indexOf(field) !== -1; })) lazyLoaded[name] = true;
    });
    if (fields.indexOf('chats') !== -1) {
      Object.keys(App.state.chats || {}).forEach(function (id) { chatLoaded[id] = true; });
    }
  };

  App.load = function () {
    return readVoiceKeys().then(function (voiceKeys) {
      return readSavedState().then(function (saved) {
        const result = finishLoad(saved, voiceKeys);
        storageMode = 'db';
        const state = result.state;
        const prepare = state.lazyVersion === LAZY_VERSION
          ? Promise.resolve().then(function () {
              lazyEnabled = true;
              App.chatSummaries = state.chatMeta || {};
              return state;
            })
          : migrateLazyState(state).catch(function () { return state; });
        return prepare.then(function (readyState) {
          /* 首次迁移、补回设置镜像、或自愈清掉了坏记录：都写回一次，
             否则下次刷新又要重复清理。 */
          if (!result.fromDb || result.snapshotUsed || result.cleaned) {
            persistState().then(function () {
              try { localStorage.removeItem(KEY); } catch (e) {}
            }).catch(function () {
              storageMode = 'local';
              saveToLocal();
            });
          }
          return readyState;
        });
      });
    }).catch(function () {
      const result = finishLoad(null, null);
      storageMode = 'local';
      return result.state;
    });
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
      replyDelayMinSec: pick('replyDelayMinSec', 6),
      replyDelayMaxSec: pick('replyDelayMaxSec', 20),
      taMsgProb: pick('taMsgProb', 8),
      taMsgGapMin: pick('taMsgGapMin', 1),
      taMsgMin: pick('taMsgMin', 1),
      taMsgMax: pick('taMsgMax', 3),
      taIgnoreProb: pick('taIgnoreProb', 15),
      mergeProb: pick('mergeProb', 15),
      mergeMin: pick('mergeMin', 2),
      mergeMax: pick('mergeMax', 3),
      cardOfferProb: pick('cardOfferProb', 10),
      taRedpacketProb: pick('taRedpacketProb', 8),
      redpacketAcceptProb: pick('redpacketAcceptProb', 70),
      redpacketReturnProb: pick('redpacketReturnProb', 20),
      emotionProb: pick('emotionProb', 30),
      taLikeProb: pick('taLikeProb', 60),
      taCommentProb: pick('taCommentProb', 40),
      taMomentCards: pick('taMomentCards', 1),
      taMomentProb: pick('taMomentProb', 25),
      taMomentDailyMax: pick('taMomentDailyMax', 3),
      taMomentGapMin: pick('taMomentGapMin', 10),
      taMomentGapMax: pick('taMomentGapMax', 60),
      taMomentCooldownMin: pick('taMomentCooldownMin', 10),
      taMomentCardMin: pick('taMomentCardMin', 1),
      taMomentCardMax: pick('taMomentCardMax', 3),
      taPatProb: pick('taPatProb', 10),
      taMarketGiftProb: pick('taMarketGiftProb', 6),
      taMarketBuyProb: pick('taMarketBuyProb', 6),
      taMarketWishProb: pick('taMarketWishProb', 8),
      taMarketFavProb: pick('taMarketFavProb', 4),
      taMarketBuyForMeProb: pick('taMarketBuyForMeProb', 4),
      taMarketDailyLimit: pick('taMarketDailyLimit', 8),
      taDailyAllowance: pick('taDailyAllowance', 30),
      taStickerProb: pick('taStickerProb', 30),
      taStickerComboProb: pick('taStickerComboProb', 25),
      taVoiceProb: pick('taVoiceProb', 20),
      taRecallProb: pick('taRecallProb', 5),
      taQuoteProb: pick('taQuoteProb', 20),
      taFavProb: pick('taFavProb', 15),
      musicPauseProb: pick('musicPauseProb', 15),
      musicPlayProb: pick('musicPlayProb', 100),
      musicFavProb: pick('musicFavProb', 25),
      musicUnfavProb: pick('musicUnfavProb', 15),
      musicSwitchProb: pick('musicSwitchProb', 30),
      musicInviteProb: pick('musicInviteProb', 5),
      jealousyProb: pick('jealousyProb', 30),
      contextReplyEnabled: pick('contextReplyEnabled', true) !== false,
      followupDelaySec: pick('followupDelaySec', 60),
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
    const step = opts.step != null ? opts.step : 1;
    const decimals = Math.max(0, Math.min(3, Number(opts.decimals) || 0));
    const factor = Math.pow(10, decimals);
    const fallback = opts.fallback != null ? opts.fallback : min;
    const input = document.querySelector(selector);
    if (!input) return;
    if (input.value !== '') input.dataset.last = input.value;

    function commit(raw) {
      const text = String(raw == null ? '' : raw).trim();
      let v;
      if (text === '') {
        /* 清空输入框时保留上一次的数值，不能悄悄变成 0 或默认值 */
        v = input.dataset.last != null ? Number(input.dataset.last) : fallback;
      } else {
        const num = Number(text);
        v = isNaN(num)
          ? (input.dataset.last != null ? Number(input.dataset.last) : fallback)
          : Math.round(num * factor) / factor;
      }
      v = Math.max(min, Math.min(max, v));
      const next = v.toFixed(decimals);
      input.dataset.last = String(v);
      if (input.value !== next) input.value = next;
      onCommit(Number(next));
    }

    input.addEventListener('input', function () {
      const text = String(input.value || '').trim();
      /* 记住用户刚输入的值，哪怕只有 1% */
      if (text !== '' && !isNaN(Number(text))) input.dataset.last = text;
    });
    input.addEventListener('change', function () { commit(input.value); });
    input.addEventListener('blur', function () { commit(input.value); });
    document.querySelectorAll('[data-step-for="' + selector.slice(1) + '"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const raw = String(input.value || '').trim();
        const base = raw !== '' && !isNaN(Number(raw))
          ? Number(raw)
          : (input.dataset.last != null ? Number(input.dataset.last) : fallback);
        commit(base + Number(btn.dataset.step != null ? btn.dataset.step : step));
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
        delete c.strength;
      }
    });
    /* 补齐新版内置字卡 */
    (App.BUILTIN_CARDS || []).forEach(function (c) {
      if (!s.cards.some(function (x) { return x.id === c.id; })) {
        s.cards.push(Object.assign({}, c));
      }
    });
    App.dedupeBuiltinCards(s);
  };

  /* 内置字卡优先：内容（文字）和内置字卡一样的导入字卡直接去掉，语音卡不受影响 */
  App.dedupeBuiltinCards = function (s) {
    if (!s || !Array.isArray(s.cards)) return 0;
    const texts = {};
    (App.BUILTIN_CARDS || []).forEach(function (c) {
      const text = String(c.text || '').trim();
      if (text) texts[(c.category || '') + '|' + text] = true;
    });
    const before = s.cards.length;
    s.cards = s.cards.filter(function (c) {
      if (c.builtin || c.audio) return true;
      const text = String(c.text || '').trim();
      return !text || !texts[(c.category || '') + '|' + text];
    });
    return before - s.cards.length;
  };

  /* ---------- 字卡的联系人归属与内置卡删除记忆 ---------- */
  App.activeContactId = function () {
    const s = App.state;
    if (!s) return null;
    if (s.currentContactId && (s.contacts || []).some(function (c) { return c.id === s.currentContactId; })) {
      return s.currentContactId;
    }
    return s.contacts && s.contacts.length ? s.contacts[0].id : null;
  };

  /* 当前联系人「删掉」的内置字卡 id 表 */
  App.builtinRemovedSet = function (contactId) {
    const s = App.state;
    if (!s) return {};
    if (!s.builtinRemoved || typeof s.builtinRemoved !== 'object') s.builtinRemoved = {};
    const id = contactId || App.activeContactId() || '_';
    if (!s.builtinRemoved[id] || typeof s.builtinRemoved[id] !== 'object') s.builtinRemoved[id] = {};
    return s.builtinRemoved[id];
  };

  App.markBuiltinRemoved = function (cardId, contactId) {
    App.builtinRemovedSet(contactId)[cardId] = true;
  };

  App.isBuiltinRemoved = function (card, contactId) {
    if (!card || !card.builtin) return false;
    return !!App.builtinRemovedSet(contactId)[card.id];
  };

  /* 当前联系人实际看到的字卡：共享的默认卡 + 自己导入的卡，
     并排除被自己删掉/去重掉的内置卡 */
  App.visibleCards = function (contactId) {
    const s = App.state;
    if (!s || !Array.isArray(s.cards)) return [];
    const id = contactId || App.activeContactId();
    const removed = App.builtinRemovedSet(id);
    return s.cards.filter(function (c) {
      if (!c) return false;
      if (c.builtin && removed[c.id]) return false;
      if (!c.owner) return true;
      return c.owner === id;
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
    if (chat.length) return chat[chat.length - 1];
    const meta = App.chatSummaries && App.chatSummaries[contactId];
    return meta && meta.last ? meta.last : null;
  };

  App.messagePreview = function (m) {
    if (!m) return '';
    if (m.recalled) return '[已撤回]';
    if (m.type === 'image') return '[图片]';
    if (m.type === 'audio') return '[语音]';
    if (m.type === 'pat') return m.text || '拍了拍';
    if (m.type === 'redpacket') return '[红包] ' + (m.amount || 0) + ' 同心币';
    if (m.type === 'gift') return '[礼物] ' + (m.productName || '');
    if (m.type === 'wish') return '[心愿] ' + (m.productName || '');
    if (m.type === 'marketBuy') return '[已买下] ' + (m.productName || '');
    if (m.type === 'location') return '[位置] ' + (m.placeName || '');
    if (m.type === 'musicInvite') return '[一起听] 《' + (m.trackTitle || '') + '》';
    return m.text || '';
  };

  /* ---------- 字卡抽取 ---------- */
  App.pickCards = function (userText, count, contactId, categories) {
    const cats = categories && categories.length ? categories : ['聊天', '情绪', '语音'];
    const enabled = App.visibleCards(contactId).filter(function (c) {
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
    /* 命中触发词的字卡：每一张都按 6% 的单次抽中概率加权，其他卡平分剩下的概率 */
    const HIT_SHARE = 0.06;
    for (let i = 0; i < count; i++) {
      const candidates = pool.filter(function (c) { return !used[c.id]; });
      if (!candidates.length) break;
      const hay = String(userText || '');
      const n = candidates.length;
      const hitWeight = n > 1 ? Math.max(1, (HIT_SHARE * n - 1) / (1 - HIT_SHARE)) : 1;
      const weights = candidates.map(function (c) {
        const words = String(c.trigger || '').split(/[/／]/).map(function (w) { return w.trim(); }).filter(Boolean);
        const hit = words.some(function (w) { return hay.indexOf(w) !== -1; });
        return hit ? hitWeight : 1;
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
    const pool = App.visibleCards().filter(function (c) {
      return c.enabled && c.category === '拍一拍' && c.text;
    });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  /* 情绪卡真正展示的情绪：优先用填写的情绪，没填就用卡片正文（如「欢喜」） */
  App.emotionLabel = function (card) {
    if (!card) return '平常';
    const e = String(card.emotion || '').trim();
    if (e && e !== '平常') return e;
    const t = String(card.text || '').trim();
    if (t && t.length <= 4 && !/[，。,.!！?？、；;：:]/.test(t)) return t;
    return e || '平常';
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
  App.compressImage = function (file, maxSize, options) {
    const max = maxSize || 240;
    const opts = options || {};
    const maxLength = opts.maxLength || 90000;
    const startQuality = opts.quality || 0.82;

    function drawToDataUrl(source, width, height, limit, quality) {
      let w = width;
      let h = height;
      if (w > h) {
        if (w > limit) { h = Math.round(h * limit / w); w = limit; }
      } else if (h > limit) {
        w = Math.round(w * limit / h); h = limit;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    }

    /* 逐步缩小，保证存进表情包的图片足够小，避免手机内存被撑爆 */
    function encode(source, width, height) {
      let limit = max;
      let quality = startQuality;
      let out = '';
      for (let i = 0; i < 7; i++) {
        out = drawToDataUrl(source, width, height, limit, quality);
        if (out.length <= maxLength) break;
        limit = Math.max(64, Math.round(limit * 0.78));
        quality = Math.max(0.5, quality - 0.06);
      }
      return out;
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
            finish(true, encode(img, img.naturalWidth || img.width, img.naturalHeight || img.height));
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
            const src = encode(bitmap, bitmap.width, bitmap.height);
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
