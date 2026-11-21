/* 婚帖 · 跨次元契约书
   独立模块：数据只存 App.state.contract；上传的背景图走站内已有的
   App.imageRef → IndexedDB images 库，state 里只留 img:<id> 短引用，不堆 base64。
   导出前用 App.imageDataUrl 把图片还原成 Base64 交给 html2canvas，避免空白/跨域。 */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  function el(sel) { return document.querySelector(sel); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function toast(msg) { if (App.toast) App.toast(msg); }
  function save() { if (App.save) App.save(); }

  /* 随机抽取的几段誓词：用主站已有字体，不引入外部字体 */
  var VOWS = [
    '我愿跨越所有次元的缝隙，在每一个故事的版本里，都与你重逢。从今往后，晨昏与四季，都写在我们共同的名字后面。',
    '此生不问归期，只问你。若世界是一本书，我愿做夹在你那一页的书签，岁岁年年，不被翻过去。',
    '我们把心跳调成同一个频率，把想念折成纸船放进每一条时间线。从此，你的清晨是我的黄昏，我的雨天也总有你撑伞。',
    '不是因为完美才相爱，是因为相爱才完整。我签下这个名字，也签下所有还没发生的明天。',
    '屏幕会暗，字卡会旧，但我记得你第一次回我消息的那秒。往后漫长，请继续做我唯一的例外。',
    '以心为凭，以今日为界：我把所有平行宇宙里的自己都托付给你，每一个，都只走向你。'
  ];

  var BG_DEFAULT = 'linear-gradient(160deg, rgba(255,255,255,.92), rgba(230,241,253,.86))';
  var BG_RED = 'linear-gradient(155deg, #8e2436, #5d1426 62%, #3d0d1b)';

  /* IDB 不可用时，上传的背景只留在内存里，绝不写进 state 撑大存档 */
  var runtimeBgUrl = '';

  /* ---------- 数据 ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function data() {
    var st = App.state;
    var empty = {
      signed: false, date: today(), bg: 'default', bgRef: '', dark: false,
      vow: 0, rewarded: false, contactId: '', avatars: { ta: {}, me: {} }
    };
    if (!st) return empty;
    if (!st.contract || typeof st.contract !== 'object') {
      st.contract = {
        signed: false,
        date: today(),                 /* 默认值为今天的真实日期 */
        bg: 'default',
        bgRef: '',
        dark: false,
        vow: Math.floor(Math.random() * VOWS.length),
        rewarded: false,
        contactId: '',                 /* 空 = 跟随当前聊天对象 */
        /* 婚帖专属头像，按联系人分别记：换联系人时 TA 和「我」一起刷新，
           互不串；不动资料页/聊天页里的原头像。 */
        avatars: { ta: {}, me: {} }
      };
    }
    var d = st.contract;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''))) d.date = today();
    if (['default', 'red', 'custom'].indexOf(d.bg) < 0) d.bg = 'default';
    if (typeof d.vow !== 'number' || d.vow < 0 || d.vow >= VOWS.length) d.vow = 0;
    /* 兼容旧数据：补齐新字段，不破坏已签好的契约 */
    if (!d.avatars || typeof d.avatars !== 'object') d.avatars = { ta: {}, me: {} };
    if (!d.avatars.ta || typeof d.avatars.ta !== 'object') d.avatars.ta = {};
    /* 早期版本 me 是单个字符串，转成按联系人存 */
    if (typeof d.avatars.me === 'string') {
      var legacyMe = d.avatars.me;
      d.avatars.me = {};
      if (legacyMe) {
        var legacyId = d.contactId || (App.activeContactId ? App.activeContactId() : '') || (st.currentContactId || '');
        if (legacyId) d.avatars.me[legacyId] = legacyMe;
      }
    }
    if (!d.avatars.me || typeof d.avatars.me !== 'object') d.avatars.me = {};
    var contacts = (st.contacts || []).filter(function (c) { return c && c.id; });
    if (d.contactId && !contacts.some(function (c) { return c.id === d.contactId; })) {
      d.contactId = '';               /* 联系人被删了就回落到当前对象 */
    }
    return d;
  }

  function activeId() {
    return App.activeContactId ? App.activeContactId() : (App.state && App.state.currentContactId) || '';
  }

  function currentContact() {
    var st = App.state || {};
    var list = st.contacts || [];
    var want = data().contactId || activeId();
    return list.find(function (c) { return c && c.id === want; }) || list[0] || null;
  }

  function fmtDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return s || '';
    return Number(p[0]) + ' 年 ' + Number(p[1]) + ' 月 ' + Number(p[2]) + ' 日';
  }

  function parties() {
    var st = App.state || {};
    var d = data();
    var c = currentContact() || {};
    var profile = st.profile || {};
    /* 关键：两侧都按「当前选中的联系人 id」取，换人时整张契约书一起刷新 */
    var cid = c.id || '';
    var taCustom = d.avatars.ta[cid] || '';
    var meCustom = d.avatars.me[cid] || '';
    return {
      ta: { name: String(c.name || 'TA'), avatar: taCustom || c.avatar || '' },
      me: { name: String(profile.userName || '我'), avatar: meCustom || profile.userAvatar || '' },
      contactId: c.id || null,
      taCustom: !!taCustom,
      meCustom: !!meCustom
    };
  }

  /* ---------- 头像：统一用站里的灰底人物 SVG ----------
     解析 img:<id> → dataURL；空值、加载失败、跨域、老版 emoji 头像一律回退
     App.DEFAULT_AVATAR，不再降级成名字首字母占位。 */
  function fallbackAvatar() {
    if (App.DEFAULT_AVATAR) return App.DEFAULT_AVATAR;
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
        '<rect width="96" height="96" fill="#e8eaee"/>' +
        '<circle cx="48" cy="37" r="16" fill="#c2c6cd"/>' +
        '<path d="M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#c2c6cd"/>' +
      '</svg>'
    );
  }

  function resolveAvatar(raw) {
    var v = String(raw || '');
    var fallback = fallbackAvatar();
    return new Promise(function (resolve) {
      var settled = false;
      function done(src) {
        if (settled) return;
        settled = true;
        resolve({ src: src || fallback });
      }
      function preload(src) {
        if (!src) return done(fallback);
        var probe = new Image();
        probe.onload = function () { done(src); };
        probe.onerror = function () { done(fallback); };
        probe.src = src;
        /* 个别 WebView 对 data:svg 不触发 onload，超时也回退 SVG 而不是首字母 */
        setTimeout(function () { done(fallback); }, 2500);
      }
      if (v.indexOf('img:') === 0 && App.imageDataUrl) {
        App.imageDataUrl(v).then(preload).catch(function () { done(fallback); });
      } else if (/^(data:image\/|blob:|https?:)/i.test(v)) {
        preload(v);
      } else {
        /* 老版 emoji / 空值：不再显示字母，直接用默认 SVG */
        done(fallback);
      }
    });
  }

  function avatarMarkup(a) {
    return '<img class="contract-avatar-img" src="' + esc(a.src) + '" alt="">';
  }

  /* ---------- 背景：CSS 变量统一控制卡片内部 ---------- */
  function applyBackground() {
    var d = data();
    var card = el('#contract-card');
    var img = el('#contract-bg-img');
    if (!card) return Promise.resolve();

    var dark = d.bg === 'red' || (d.bg === 'custom' && !!d.dark);
    card.classList.toggle('is-dark', dark);
    card.style.setProperty('--contract-bg', d.bg === 'red' ? BG_RED : BG_DEFAULT);
    card.style.setProperty('--contract-text-color', dark ? '#ffffff' : '#2b3a52');
    card.style.setProperty('--contract-sub-color', dark ? 'rgba(255,255,255,.82)' : 'rgba(43,58,82,.68)');
    card.style.setProperty('--contract-line-color', dark ? 'rgba(255,255,255,.5)' : 'rgba(43,58,82,.22)');
    card.style.setProperty('--contract-gold', dark ? '#f7d774' : '#b08a45');
    /* 爱心始终是红色，只在暗底上提亮一档，保证不糊进背景 */
    card.style.setProperty('--contract-bond-color', dark ? '#ff8fa3' : '#e8536f');

    if (d.bg !== 'custom') {
      card.classList.remove('has-image');
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      return Promise.resolve();
    }

    var pending = d.bgRef && d.bgRef.indexOf('img:') === 0 && App.imageDataUrl
      ? App.imageDataUrl(d.bgRef)
      : Promise.resolve(runtimeBgUrl);
    return pending.then(function (url) {
      if (!url) {                       /* 引用失效：回到默认，不留空卡片 */
        d.bg = 'default'; d.bgRef = ''; runtimeBgUrl = ''; save();
        card.classList.remove('has-image');
        card.classList.remove('is-dark');
        card.style.setProperty('--contract-bg', BG_DEFAULT);
        card.style.setProperty('--contract-text-color', '#2b3a52');
        card.style.setProperty('--contract-bond-color', '#e8536f');
        if (img) { img.hidden = true; img.removeAttribute('src'); }
        renderBgPills();
        return;
      }
      if (img) { img.src = url; img.hidden = false; }
      card.classList.add('has-image');
    }).catch(function () {
      card.classList.remove('has-image');
    });
  }

  function renderBgPills() {
    var d = data();
    document.querySelectorAll('[data-contract-bg]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.contractBg === d.bg);
    });
    var hint = el('#contract-bg-hint');
    if (hint) {
      hint.textContent = d.bg === 'custom'
        ? (d.dark ? '检测到深色图片：文字、边框、印章已自动切为白色/金色。' : '检测到浅色图片：文字保持深色。')
        : d.bg === 'red'
          ? '经典红底：文字、边框、印章自动切为纯白与金色。'
          : '网站默认：卡片保持淡色，文字为深色。改背景只影响卡片内部。';
    }
  }

  /* ---------- 契约对象：可切换联系人，只影响这张婚帖 ---------- */
  function contactAvatarHtml(src) {
    var v = String(src || '');
    if (v.indexOf('img:') === 0) {
      return '<img data-img-ref="' + esc(v) + '" src="' + esc(fallbackAvatar()) + '" alt="">';
    }
    if (App.avatarHtml) return App.avatarHtml(v);
    return '<img src="' + esc(fallbackAvatar()) + '" alt="">';
  }

  function openDialog(sel) {
    var dlg = el(sel);
    if (dlg) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  }
  function closeDialog(sel) {
    var dlg = el(sel);
    if (dlg) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
  }

  function renderContactList() {
    var box = el('#contract-contact-list');
    if (!box) return;
    var d = data();
    var chosen = d.contactId || activeId();
    var list = (App.state && App.state.contacts) || [];
    box.innerHTML = list.length ? list.map(function (c) {
      return '<button type="button" class="contract-contact' +
        (c.id === chosen ? ' is-current' : '') + '" data-contract-contact="' + esc(c.id) + '">' +
        '<span class="contract-contact-av">' + contactAvatarHtml(c.avatar) + '</span>' +
        '<span class="contract-contact-name">' + esc(c.name || 'TA') + '</span>' +
        (c.id === chosen ? '<span class="contract-contact-tag">当前</span>' : '') +
        '</button>';
    }).join('') : '<p class="contract-empty">还没有联系人，先去聊天里添加一个吧。</p>';
    if (App.hydrateImages) App.hydrateImages(box);
  }

  function openContactDialog() {
    renderContactList();
    openDialog('#contract-contact-dialog');
  }

  function pickContact(id) {
    var d = data();
    var c = ((App.state && App.state.contacts) || []).find(function (x) { return x && x.id === id; });
    if (!c) return;
    d.contactId = id;
    save();
    closeDialog('#contract-contact-dialog');
    render().then(function () { toast('契约对象已换成 ' + (c.name || 'TA')); });
  }

  /* ---------- 双方头像：婚帖专属，存 IndexedDB，state 只留 img:<id> ---------- */
  var avatarSide = 'ta';

  function poolFor(side) {
    var pool = (App.state && App.state.avatarPool) || {};
    var arr = side === 'ta' ? pool.ta : pool.mine;
    return Array.isArray(arr) ? arr : [];
  }

  function renderAvatarGrid() {
    var box = el('#contract-avatar-grid');
    if (!box) return;
    var list = poolFor(avatarSide);
    box.innerHTML = list.length ? list.map(function (src, i) {
      var v = String(src || '');
      return '<button type="button" class="contract-pool-item" data-contract-pool="' + i + '">' +
        (v.indexOf('img:') === 0
          ? '<img data-img-ref="' + esc(v) + '" src="' + esc(fallbackAvatar()) + '" alt="">'
          : '<img src="' + esc(v) + '" alt="">') +
        '</button>';
    }).join('') : '<p class="contract-empty">这一侧的头像池还是空的。<br>可以先在「头像工具」里导入几张，或直接从相册选。</p>';
    if (App.hydrateImages) App.hydrateImages(box);
  }

  function openAvatarDialog(side) {
    avatarSide = side === 'me' ? 'me' : 'ta';
    var title = el('#contract-avatar-title');
    if (title) title.textContent = avatarSide === 'ta' ? '更换 TA 的头像' : '更换我的头像';
    renderAvatarGrid();
    openDialog('#contract-avatar-dialog');
  }

  function storeAvatarSrc(side, src) {
    if (!src) return Promise.resolve();
    var promise = App.imageRef ? App.imageRef(src) : Promise.resolve(src);
    return promise.then(function (ref) {
      var d = data();
      var c = currentContact();
      if (!c || !c.id) { toast('先选一个契约对象'); return; }
      if (side === 'ta') d.avatars.ta[c.id] = ref;
      else d.avatars.me[c.id] = ref;
      save();
      return render();
    }).then(function () {
      closeDialog('#contract-avatar-dialog');
      toast('头像已更换');
    }).catch(function () {
      toast('这张图片存不进去，换一张试试');
    });
  }

  function useAvatarFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('请选择一张图片'); return; }
    if (!App.compressImage) { toast('图片组件还没加载好'); return; }
    App.compressImage(file, 256).then(function (src) {
      return storeAvatarSrc(avatarSide, src);
    }).catch(function () { toast('这张图片读不出来，换一张试试'); });
  }

  function resetAvatar() {
    var d = data();
    var c = currentContact();
    if (!c || !c.id) return;
    if (avatarSide === 'ta') delete d.avatars.ta[c.id];
    else delete d.avatars.me[c.id];
    save();
    closeDialog('#contract-avatar-dialog');
    render().then(function () { toast('已恢复为资料里的头像'); });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var d = data();
    var p = parties();
    var card = el('#contract-card');
    if (!card) return Promise.resolve();

    return Promise.all([
      resolveAvatar(p.ta.avatar),
      resolveAvatar(p.me.avatar),
      applyBackground()
    ]).then(function (r) {
      var ta = el('#contract-avatar-ta'), me = el('#contract-avatar-me');
      if (ta) ta.innerHTML = avatarMarkup(r[0]);
      if (me) me.innerHTML = avatarMarkup(r[1]);
      var tn = el('#contract-name-ta'), mn = el('#contract-name-me');
      if (tn) tn.textContent = p.ta.name;
      if (mn) mn.textContent = p.me.name;
      var vow = el('#contract-vow-text');
      if (vow) vow.textContent = VOWS[d.vow];
      var date = el('#contract-sign-date');
      if (date) date.textContent = fmtDate(d.date);

      card.classList.toggle('is-unsigned', !d.signed);
      var unsigned = el('#contract-unsigned');
      if (unsigned) unsigned.hidden = !!d.signed;
      var actions = el('#contract-actions');
      /* 未签订时也能先挑好契约对象、换好双方头像；签完才放开背景/导出/换誓词 */
      if (actions) {
        actions.hidden = false;
        actions.classList.toggle('is-unsigned', !d.signed);
      }
      var obj = el('#contract-object-name');
      if (obj) obj.textContent = p.ta.name;
      var objHint = el('#contract-object-hint');
      if (objHint) objHint.textContent = d.contactId ? '已指定契约对象' : '跟随当前聊天对象';
      renderBgPills();
    });
  }

  /* ---------- 登记 ---------- */
  function grantReward() {
    var d = data();
    if (d.rewarded) return;
    var p = parties();
    var name = p.ta.name;
    var st = App.state;
    if (!st.wallet || typeof st.wallet !== 'object') st.wallet = { me: 0, ta: 0 };
    st.wallet.me = (Number(st.wallet.me) || 0) + 520;
    try {
      if (App.addChatSystemMessage && p.contactId) {
        App.addChatSystemMessage(p.contactId, '[系统]：你与 ' + name + ' 的跨次元契约已生效。');
      }
    } catch (e) {}
    d.rewarded = true;
    save();
    var box = el('#contract-reward');
    if (box) box.innerHTML = '登记完成 · 已向聊天发送系统消息，并赠予 <strong>520 同心币</strong>。';
  }

  function register() {
    var d = data();
    var p = parties();
    if (!App.confirmDialog) { finishRegister(); return; }
    App.confirmDialog(
      '确定要与 ' + p.ta.name + ' 签订这份跨次元契约吗？\n签订即刻生效，并赠予你们 520 同心币。',
      { title: '签订契约', okText: '我愿意' }
    ).then(function (ok) {
      if (ok) finishRegister();
    });
  }

  function finishRegister() {
    var d = data();
    var card = el('#contract-card');
    if (card) {
      card.classList.add('is-beating');
      setTimeout(function () { card.classList.remove('is-beating'); }, 1550);
    }
    d.signed = true;
    save();
    /* 心跳播完再揭幕，保留一点仪式感 */
    setTimeout(function () {
      render().then(function () { grantReward(); });
      toast('契约已生效');
    }, 900);
  }

  /* ---------- 日期 ---------- */
  function openDateDialog() {
    var dlg = el('#contract-date-dialog');
    var input = el('#contract-date-input');
    if (input) input.value = data().date;
    if (dlg) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  }
  function closeDateDialog() {
    var dlg = el('#contract-date-dialog');
    if (dlg) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
  }
  function commitDate() {
    var input = el('#contract-date-input');
    var v = input && input.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) { toast('先选一个日期'); return; }
    data().date = v;
    save();
    render();
    closeDateDialog();
    toast('登记日期已更新');
  }

  /* ---------- 背景选择 / 上传 ---------- */
  function fileToCompressed(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1100;
          var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
          var k = Math.min(1, max / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          resolve(cv.toDataURL('image/jpeg', .82));
        };
        img.onerror = function () { reject(new Error('decode')); };
        img.src = String(reader.result);
      };
      reader.onerror = function () { reject(new Error('read')); };
      reader.readAsDataURL(file);
    });
  }

  function detectDark(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 32; c.height = 32;
          var x = c.getContext('2d');
          x.drawImage(img, 0, 0, 32, 32);
          var px = x.getImageData(0, 0, 32, 32).data;
          var sum = 0, n = 0;
          for (var i = 0; i < px.length; i += 4) {
            sum += px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114; n++;
          }
          resolve(n ? sum / n < 135 : false);
        } catch (e) { resolve(false); }
      };
      img.onerror = function () { resolve(false); };
      img.src = url;
    });
  }

  function useUploadedImage(file) {
    if (!file || !/^image\//.test(file.type)) { toast('请选择一张图片'); return; }
    toast('正在处理背景…');
    fileToCompressed(file).then(function (url) {
      return Promise.all([detectDark(url), App.imageRef ? App.imageRef(url) : Promise.resolve(url)])
        .then(function (r) {
          var dark = r[0], ref = r[1];
          var d = data();
          d.bg = 'custom';
          d.dark = !!dark;
          if (String(ref).indexOf('img:') === 0) {
            d.bgRef = ref;           /* 短引用进 state，实体在 IndexedDB */
            runtimeBgUrl = '';
          } else {
            /* IDB 不可用：只在本次会话内存里用，绝不把大 base64 写进存档 */
            d.bgRef = '';
            runtimeBgUrl = url;
            toast('背景已应用（本次会话有效）');
          }
          save();
          render();
        });
    }).catch(function () { toast('这张图片读不出来，换一张试试'); });
  }

  function pickBg(kind) {
    var d = data();
    if (kind === 'custom') {
      var input = el('#contract-bg-file');
      if (input) input.click();
      return;
    }
    d.bg = kind;
    save();
    render();
  }

  /* ---------- 导出 PNG ---------- */
  function exportPng() {
    if (typeof html2canvas !== 'function') { toast('导出组件还没加载好，刷新后再试'); return; }
    var card = el('#contract-card');
    if (!card) return;
    toast('正在生成图片…');

    var stage = document.createElement('div');
    stage.className = 'contract-export-stage';
    var clone = card.cloneNode(true);
    clone.classList.add('is-exporting');
    clone.classList.remove('is-beating', 'is-unsigned');
    var u = clone.querySelector('#contract-unsigned');
    if (u) u.hidden = true;
    stage.appendChild(clone);
    document.body.appendChild(stage);

    /* 等克隆里的图片解码完再截，避免导出空白 */
    var imgs = Array.prototype.slice.call(clone.querySelectorAll('img'));
    Promise.all(imgs.map(function (im) {
      if (im.complete) return Promise.resolve();
      return new Promise(function (res) { im.onload = res; im.onerror = res; });
    })).then(function () {
      /* 头像先栅格化：默认头像是 SVG，html2canvas 直接画会变成空白圆。
         data:/blob: 是站内资源，不能加 crossOrigin（加了反而加载失败）；
         只有 http(s) 才尝试匿名跨域。任何失败都回退默认 SVG，不出现字母占位。 */
      return Promise.all(imgs.map(function (im) {
        var box = im.closest('.contract-avatar');
        if (!box || !im.getAttribute('src')) return Promise.resolve();
        var original = im.getAttribute('src');
        var fallback = fallbackAvatar();

        function rasterize(src, allowFallback, onFail) {
          return new Promise(function (res) {
            var probe = new Image();
            /* 仅远程图片尝试 CORS；data:/blob: 保持原生加载 */
            if (/^https?:/i.test(src)) probe.crossOrigin = 'anonymous';
            probe.onload = function () {
              try {
                var c = document.createElement('canvas');
                var side = 160;
                c.width = side; c.height = side;
                var x = c.getContext('2d');
                var w = probe.naturalWidth || side, h = probe.naturalHeight || side;
                var k = Math.min(side / w, side / h);
                var dw = w * k, dh = h * k;
                x.drawImage(probe, (side - dw) / 2, (side - dh) / 2, dw, dh);
                im.src = c.toDataURL('image/png');
              } catch (e) {
                if (allowFallback) { rasterize(fallback, false).then(res); return; }
              }
              res();
            };
            probe.onerror = function () {
              if (allowFallback) { rasterize(fallback, false).then(res); return; }
              onFail(); res();
            };
            probe.src = src;
          });
        }

        return rasterize(original, true, function () {
          /* 连默认 SVG 都画不出来时，也保留 SVG 本身，绝不换成首字母 */
          im.src = fallback;
        });
      }));
    }).then(function () {
      return html2canvas(clone, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        width: clone.offsetWidth,
        height: clone.offsetHeight
      });
    }).then(function (canvas) {
      var link = document.createElement('a');
      link.download = '跨次元婚帖-' + data().date + '.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('婚帖图片已开始下载');
    }).catch(function () {
      toast('导出失败了，再试一次');
    }).then(function () {
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    });
  }

  /* ---------- 初始化 ---------- */
  App.initContract = function () {
    if (App.__contractInited) return;
    App.__contractInited = true;

    var reg = el('#contract-register');
    if (reg) reg.addEventListener('click', register);

    var dateBtn = el('#contract-date-btn');
    if (dateBtn) dateBtn.addEventListener('click', openDateDialog);
    var dateSave = el('#contract-date-save');
    if (dateSave) dateSave.addEventListener('click', commitDate);
    document.querySelectorAll('#contract-date-dialog [data-close]').forEach(function (b) {
      b.addEventListener('click', closeDateDialog);
    });

    var pills = el('#contract-bg-pills');
    if (pills) pills.addEventListener('click', function (e) {
      var b = e.target.closest('[data-contract-bg]');
      if (b) pickBg(b.dataset.contractBg);
    });

    var fileInput = el('#contract-bg-file');
    if (fileInput) fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) useUploadedImage(f);
      e.target.value = '';
    });

    var vowBtn = el('#contract-vow-btn');
    if (vowBtn) vowBtn.addEventListener('click', function () {
      var d = data();
      d.vow = (d.vow + 1 + Math.floor(Math.random() * (VOWS.length - 1))) % VOWS.length;
      save(); render(); toast('换了一句誓词');
    });

    var exportBtn = el('#contract-export');
    if (exportBtn) exportBtn.addEventListener('click', exportPng);

    /* 契约对象 */
    var contactBtn = el('#contract-btn-contact');
    if (contactBtn) contactBtn.addEventListener('click', openContactDialog);
    var contactList = el('#contract-contact-list');
    if (contactList) contactList.addEventListener('click', function (e) {
      var b = e.target.closest('[data-contract-contact]');
      if (b) pickContact(b.dataset.contractContact);
    });
    document.querySelectorAll('#contract-contact-dialog [data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeDialog('#contract-contact-dialog'); });
    });

    /* 双方头像：卡片上的圆头像 + 操作区里的两个按钮，都进同一个弹窗 */
    var card = el('#contract-card');
    if (card) card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-contract-avatar]');
      if (b) openAvatarDialog(b.dataset.contractAvatar);
    });
    [['#contract-btn-avatar-ta', 'ta'], ['#contract-btn-avatar-me', 'me']].forEach(function (pair) {
      var btn = el(pair[0]);
      if (btn) btn.addEventListener('click', function () { openAvatarDialog(pair[1]); });
    });
    var grid = el('#contract-avatar-grid');
    if (grid) grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-contract-pool]');
      if (!b) return;
      var src = poolFor(avatarSide)[Number(b.dataset.contractPool)];
      if (src) storeAvatarSrc(avatarSide, src);
    });
    var avReset = el('#contract-avatar-reset');
    if (avReset) avReset.addEventListener('click', resetAvatar);
    var avPick = el('#contract-avatar-pick');
    if (avPick) avPick.addEventListener('click', function () {
      var f = el('#contract-avatar-file');
      if (f) f.click();
    });
    var avFile = el('#contract-avatar-file');
    if (avFile) avFile.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) useAvatarFile(f);
      e.target.value = '';
    });
    document.querySelectorAll('#contract-avatar-dialog [data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeDialog('#contract-avatar-dialog'); });
    });

    /* 粘贴图片：头像弹窗开着就当头像，否则当背景。全程不弹任何权限框。 */
    document.addEventListener('paste', function (e) {
      var app = el('#app');
      if (!app || app.dataset.view !== 'contract') return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (!f) break;
          var dlg = el('#contract-avatar-dialog');
          if (dlg && dlg.open) useAvatarFile(f);
          else useUploadedImage(f);
          e.preventDefault();
          break;
        }
      }
    });

    render();
  };

  App.renderContract = function () { return render(); };
})();
