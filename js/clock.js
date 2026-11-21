/* 时钟：闹钟 / 世界时间（次元时钟） / 专注计时
   独立模块，只通过 App.state.clock 存取数据，不改动其它模块逻辑。
   铃声由纯 JS 合成 WAV 交给 HTML5 <audio> 播放：
   不依赖外部音频文件，也不写进 App.state（避免被语音迁移误当成 data:audio 搬走）。 */
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
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(msg) { if (window.App && App.toast) App.toast(msg); }

  var TONES = [
    { key: 'chime', label: '风铃轻音' },
    { key: 'rain', label: '细雨白噪' },
    { key: 'wave', label: '远处海浪' },
    { key: 'mute', label: '静音' }
  ];
  var PRESETS = [25, 15, 5];

  /* ---------- 数据 ---------- */
  function randomOffset() {
    var sign = Math.random() < .5 ? -1 : 1;
    var h = 1 + Math.floor(Math.random() * 12);   /* 1~12 小时 */
    var m = 1 + Math.floor(Math.random() * 59);   /* 1~59 分，故意留个零头 */
    return sign * (h * 60 + m);
  }

  function data() {
    var st = window.App && App.state;
    if (!st) return { alarms: [], offsetMin: 134, tone: 'chime', focusMin: 25, tab: 'alarm' };
    if (!st.clock || typeof st.clock !== 'object') {
      st.clock = {
        alarms: [
          { id: 'ck-default-1', time: '08:00', label: '起床', enabled: true },
          { id: 'ck-default-2', time: '22:30', label: '睡觉', enabled: true }
        ],
        offsetMin: randomOffset(),
        tone: 'chime',
        focusMin: 25,
        tab: 'alarm'
      };
    }
    if (!Array.isArray(st.clock.alarms)) st.clock.alarms = [];
    if (typeof st.clock.offsetMin !== 'number' || !isFinite(st.clock.offsetMin)) st.clock.offsetMin = randomOffset();
    if (typeof st.clock.focusMin !== 'number') st.clock.focusMin = 25;
    if (!st.clock.tone) st.clock.tone = 'chime';
    if (!st.clock.tab) st.clock.tab = 'alarm';
    return st.clock;
  }

  function save() { if (window.App && App.save) App.save(); }

  /* ---------- 铃声：合成一段柔和 WAV，交给 HTML5 Audio 循环播放 ---------- */
  var ringAudio = null;
  var wavCache = {};

  function wavUrl(kind) {
    if (wavCache[kind]) return wavCache[kind];
    var rate = 16000, secs = kind === 'chime' ? 6 : 5;
    var n = rate * secs;
    var samples = new Float32Array(n);
    var i, t;

    /* 低通白噪 -> 近似粉噪，听感比纯白噪柔和 */
    var lp = 0, lp2 = 0;
    for (i = 0; i < n; i++) {
      t = i / rate;
      var white = Math.random() * 2 - 1;
      lp = lp * .96 + white * .04;
      lp2 = lp2 * .86 + white * .14;
      var noise = (lp * 2.4 + lp2 * .5);

      if (kind === 'rain') {
        /* 细雨：稳定粉噪 + 极缓慢起伏 + 几粒高频水珠 */
        var drip = Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI * .37)), 8) * .12;
        samples[i] = noise * .30 + (white * .035) + drip * (Math.sin(t * 2 * Math.PI * 3200) * .5);
      } else if (kind === 'wave') {
        /* 海浪：棕噪 + 8 秒一次的潮起潮落 */
        var swell = .5 + .5 * Math.sin(t * 2 * Math.PI / 7.5 - Math.PI / 2);
        samples[i] = lp * 1.5 * (.18 + swell * .42) + white * .012;
      } else {
        /* 风铃：C-E-G 柔和正弦和弦，每 2 秒轻轻敲一下，底下垫一层极轻噪音 */
        var phase = t % 2;
        var bellEnv = Math.exp(-phase * 2.1) * (1 - Math.exp(-phase * 40));
        var bell =
          Math.sin(t * 2 * Math.PI * 523.25) * .55 +
          Math.sin(t * 2 * Math.PI * 659.25) * .34 +
          Math.sin(t * 2 * Math.PI * 783.99) * .24 +
          Math.sin(t * 2 * Math.PI * 1046.5) * .08;
        samples[i] = bell * bellEnv * .22 + noise * .055;
      }
      /* 首尾各 120ms 淡入淡出，循环播放没有爆音接缝 */
      var edge = Math.min(1, i / (rate * .12), (n - i) / (rate * .12));
      samples[i] *= edge;
    }

    /* 16-bit PCM WAV */
    var bytes = new Uint8Array(44 + n * 2);
    var dv = new DataView(bytes.buffer);
    function str(off, s) { for (var k = 0; k < s.length; k++) dv.setUint8(off + k, s.charCodeAt(k)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) {
      var v = Math.max(-1, Math.min(1, samples[i]));
      dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    var bin = '';
    for (i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    wavCache[kind] = 'data:audio/wav;base64,' + btoa(bin);
    return wavCache[kind];
  }

  function audio() {
    if (!ringAudio) {
      ringAudio = new Audio();
      ringAudio.loop = true;
      ringAudio.volume = .55;
      ringAudio.preload = 'auto';
      ringAudio.setAttribute('data-clock-ring', '1');
      ringAudio.style.display = 'none';
      /* 挂进 DOM：部分手机 WebView 只播放文档内的 audio，也更方便核对音色 */
      if (document.body) document.body.appendChild(ringAudio);
    }
    return ringAudio;
  }

  function setTone(kind) {
    var a = audio();
    if (kind === 'mute') {
      /* 静音：立刻停掉正在响的声音，并卸载音频源，保证之后一点声音都不出 */
      stopRing();
      try { a.removeAttribute('src'); a.load(); } catch (e) {}
      return;
    }
    var wasPlaying = !a.paused;
    a.src = wavUrl(kind);
    if (wasPlaying) a.play().catch(function () {});
  }

  function playRing() {
    /* 静音：只弹窗，不加载音频、不调用 play() */
    if (data().tone === 'mute') { stopRing(); return; }
    var a = audio();
    if (!a.src) a.src = wavUrl(data().tone);
    a.currentTime = 0;
    var p = a.play();
    if (p && p.catch) p.catch(function () {
      /* 移动端把自动播放拦下来时，弹窗里的「播放铃声」按钮可以手动补一次 */
      var btn = el('#clock-ring-play');
      if (btn) btn.hidden = false;
    });
  }

  function stopRing() {
    if (!ringAudio) return;
    try { ringAudio.pause(); ringAudio.currentTime = 0; } catch (e) {}
  }

  /* 首次真实手势里解锁一次音频，让后续 setInterval 触发的 play() 有机会出声 */
  function unlockAudio() {
    var a = audio();
    /* 静音状态下也静默解锁一次，之后切回有声音的音色才不会被动播放策略拦住 */
    var unlockTone = data().tone === 'mute' ? 'chime' : data().tone;
    if (!a.src) a.src = wavUrl(unlockTone);
    var p = a.play();
    if (p && p.then) p.then(function () { a.pause(); a.currentTime = 0; }).catch(function () {});
    document.removeEventListener('pointerdown', unlockAudio, true);
  }

  /* ---------- 字卡文案 ---------- */
  function taName() {
    var st = window.App && App.state;
    if (!st) return 'TA';
    var c = (st.contacts || []).find(function (x) { return x && x.id === st.currentContactId; }) || st.contacts && st.contacts[0];
    return (c && c.name) || 'TA';
  }

  function pickCard() {
    if (!window.App || !App.visibleCards) return null;
    var pool;
    try { pool = App.visibleCards().filter(function (c) { return c && c.enabled !== false && String(c.text || '').trim(); }); }
    catch (e) { pool = []; }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------- 全屏毛玻璃弹窗 ---------- */
  var ringing = false;
  var snooze = null;

  function openRingPopup(opts) {
    var dlg = el('#clock-ringing-dialog');
    if (!dlg) return;
    var card = opts.card;
    var name = taName();
    el('#clock-ring-tag').textContent = opts.tag || '该起床啦';
    el('#clock-ring-time').textContent = opts.time || '';
    el('#clock-ring-label').textContent = opts.label || '';
    el('#clock-ring-from').textContent = '来自 ' + name + ' 的字卡';
    el('#clock-ring-text').textContent = card
      ? String(card.text).trim()
      : '（字卡库还是空的，先去存几句 TA 想对你说的话吧）';
    el('#clock-ring-cat').textContent = card ? '「' + (card.category || '字卡') + '」· ' + name + ' 的梦角' : '拾忆 · 字卡传讯';
    var playBtn = el('#clock-ring-play');
    if (playBtn) playBtn.hidden = true;   /* 自动播放被拦时才露出 */
    var stopBtn = el('#clock-ring-stop');
    if (stopBtn) stopBtn.hidden = data().tone === 'mute';
    ringing = true;
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    playRing();
    /* 页面在后台时，顺手发一条系统通知；sw.js 已支持 notify */
    if (document.hidden && navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'notify',
          title: (opts.label || '时钟') + ' · ' + (opts.time || ''),
          body: card ? String(card.text).slice(0, 60) : '时间到了',
          tag: 'shiyi-clock'
        });
      } catch (e) {}
    }
  }

  function closeRingPopup() {
    var dlg = el('#clock-ringing-dialog');
    if (!dlg) return;
    ringing = false;
    stopRing();
    try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); }
  }

  function fireAlarm(alarm) {
    if (ringing) return;
    var d = new Date();
    openRingPopup({
      tag: '闹钟 · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()),
      time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
      label: alarm.label || '该做的事',
      card: pickCard()
    });
  }

  function fireFocus() {
    if (ringing) return;
    openRingPopup({
      tag: '专注完成',
      time: data().focusMin + ' 分钟',
      label: '这一段只属于你，辛苦啦',
      card: pickCard()
    });
  }

  /* ---------- 闹钟列表 ---------- */
  function renderAlarms() {
    var box = el('#clock-alarm-list');
    if (!box) return;
    var list = data().alarms.slice().sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
    box.innerHTML = list.length ? list.map(function (a) {
      return '<div class="clock-alarm' + (a.enabled ? '' : ' is-off') + '">' +
        '<div class="clock-alarm-main">' +
          '<span class="clock-alarm-time">' + esc(a.time) + '</span>' +
          '<div class="clock-alarm-meta">' +
            '<span class="clock-alarm-label">' + esc(a.label || '未命名') + '</span>' +
            '<span class="clock-alarm-repeat">· 每天</span>' +
          '</div>' +
        '</div>' +
        '<div class="clock-alarm-side">' +
          '<button type="button" class="clock-toggle' + (a.enabled ? ' is-on' : '') + '" data-clock-toggle="' + esc(a.id) + '" role="switch" aria-checked="' + (!!a.enabled) + '" aria-label="' + (a.enabled ? '关闭' : '开启') + '闹钟"></button>' +
          '<button type="button" class="clock-mini-del" data-clock-del="' + esc(a.id) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('') : '<p class="clock-empty">还没有闹钟。<br>点下面的「+ 添加闹钟」，让 TA 的字卡叫你起床。</p>';
    var toneRow = el('#clock-tone-row');
    if (toneRow) {
      toneRow.innerHTML =
        '<div class="clock-tone-head">' +
          '<span class="clock-tone-label">闹铃音色</span>' +
          '<button type="button" class="clock-tone" data-clock-preview="1">试听</button>' +
        '</div>' +
        '<div class="clock-tone-pills">' +
          TONES.map(function (t) {
            return '<button type="button" class="clock-tone' + (data().tone === t.key ? ' is-active' : '') + '" data-clock-tone="' + t.key + '">' + t.label + '</button>';
          }).join('') +
        '</div>' +
        (data().tone === 'mute'
          ? '<span class="clock-tone-note">已静音 · 到点只弹窗，不播放任何声音</span>'
          : '');
    }
  }

  function openAddDialog() {
    var dlg = el('#clock-add-dialog');
    if (!dlg) return;
    /* 默认给下一个 5 分钟整点：直接填当前时间的话，保存完这一秒就会响 */
    var d = new Date();
    d.setTime(d.getTime() + 5 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    var timeInput = el('#clock-add-time');
    if (timeInput) timeInput.value = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var labelInput = el('#clock-add-label');
    if (labelInput) labelInput.value = '';
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  }

  function closeAddDialog() {
    var dlg = el('#clock-add-dialog');
    if (dlg) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
  }

  function addAlarm() {
    var t = el('#clock-add-time'), l = el('#clock-add-label');
    var time = t && /^\d{2}:\d{2}$/.test(t.value) ? t.value : '';
    if (!time) { toast('先选一个时间'); return; }
    var label = l && l.value.trim() ? l.value.trim().slice(0, 20) : '提醒';
    data().alarms.push({ id: uid(), time: time, label: label, enabled: true, createdAt: Date.now() });
    save();
    renderAlarms();
    closeAddDialog();
    toast('闹钟已添加');
  }

  /* ---------- 世界时间 ---------- */
  function phaseName(d) {
    var h = d.getHours();
    if (h < 5) return '深夜';
    if (h < 9) return '清晨';
    if (h < 12) return '上午';
    if (h < 17) return '午后';
    if (h < 20) return '黄昏';
    return '夜里';
  }

  function updateWorld() {
    var now = new Date();
    var off = data().offsetMin;
    var ta = new Date(now.getTime() + off * 60000);
    function put(id, val) { var n = el(id); if (n) n.textContent = val; }
    put('#clock-my-time', pad(now.getHours()) + ':' + pad(now.getMinutes()));
    put('#clock-my-sec', pad(now.getSeconds()));
    put('#clock-my-date', (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · ' + '周' + '日一二三四五六'[now.getDay()] + ' · ' + phaseName(now));
    put('#clock-ta-time', pad(ta.getHours()) + ':' + pad(ta.getMinutes()));
    put('#clock-ta-sec', pad(ta.getSeconds()));
    put('#clock-ta-date', (ta.getMonth() + 1) + ' 月 ' + ta.getDate() + ' 日 · ' + '周' + '日一二三四五六'[ta.getDay()] + ' · ' + phaseName(ta));
    var abs = Math.abs(off), h = Math.floor(abs / 60), m = abs % 60;
    var diff = (h ? h + ' 小时 ' : '') + m + ' 分';
    put('#clock-gap-main', 'TA 的世界比你 ' + (off > 0 ? '快' : '慢') + ' ' + diff);
    put('#clock-gap-poem', '你这边是' + phaseName(now) + '，TA 那边是' + phaseName(ta));
    put('#clock-ta-zone', (off > 0 ? '+' : '−') + h + 'h ' + pad(m) + 'm');
  }

  /* ---------- 专注计时 ---------- */
  var focus = { total: 25 * 60000, remain: 25 * 60000, endAt: 0, running: false };
  var CIRC = 2 * Math.PI * 96;

  function resetFocus(min) {
    focus.total = min * 60000;
    focus.remain = focus.total;
    focus.endAt = 0;
    focus.running = false;
    updateFocus();
  }

  function updateFocus() {
    var remain = focus.running ? Math.max(0, focus.endAt - Date.now()) : focus.remain;
    var secs = Math.ceil(remain / 1000);
    var n = el('#clock-focus-num');
    if (n) n.textContent = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
    var state = el('#clock-focus-state');
    if (state) state.textContent = focus.running ? '专注中 · 别急，慢慢来' : (remain < focus.total ? '已暂停' : '准备好了就开始');
    var fg = el('#clock-ring-fg');
    if (fg) {
      fg.setAttribute('stroke-dasharray', CIRC.toFixed(1));
      fg.setAttribute('stroke-dashoffset', (CIRC * (1 - remain / focus.total)).toFixed(1));
    }
    var main = el('#clock-focus-main');
    if (main) main.textContent = focus.running ? '暂停' : (remain < focus.total ? '继续' : '开始专注');
    el('#clock-preset-row') && Array.prototype.forEach.call(el('#clock-preset-row').children, function (b) {
      b.classList.toggle('is-active', Number(b.dataset.clockPreset) === data().focusMin);
    });
  }

  function toggleFocus() {
    if (focus.running) {
      focus.remain = Math.max(0, focus.endAt - Date.now());
      focus.running = false;
    } else {
      if (focus.remain <= 0) focus.remain = focus.total;
      focus.endAt = Date.now() + focus.remain;
      focus.running = true;
    }
    updateFocus();
  }

  /* ---------- Tab ---------- */
  function setTab(tab) {
    data().tab = tab;
    document.querySelectorAll('.clock-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.clockTab === tab);
    });
    document.querySelectorAll('.clock-pane').forEach(function (p) {
      p.hidden = p.dataset.clockPane !== tab;
    });
  }

  function renderClock() {
    var d = data();
    setTab(d.tab || 'alarm');
    renderAlarms();
    updateWorld();
    updateFocus();
  }

  /* ---------- 每秒心跳 ---------- */
  var fired = {};

  function tick() {
    var now = new Date();
    var hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var dayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

    /* 每分钟只触发一次，不会在同一分钟里连弹 60 次 */
    if (!ringing) {
      data().alarms.forEach(function (a) {
        if (!a.enabled || a.time !== hhmm) return;
        if (a.createdAt && now.getTime() - a.createdAt < 60000) return;
        var key = dayKey + ' ' + hhmm + ' ' + a.id;
        if (fired[key]) return;
        fired[key] = true;
        fireAlarm(a);
      });
    }
    if (snooze && !ringing && Date.now() >= snooze.at) {
      var a2 = snooze.alarm; snooze = null;
      fireAlarm(a2);
    }

    if (focus.running) {
      focus.remain = Math.max(0, focus.endAt - Date.now());
      if (focus.remain <= 0) {
        focus.running = false;
        focus.remain = 0;
        fireFocus();
      }
    }

    var app = el('#app');
    if (app && app.dataset.view === 'clock') {
      if (data().tab === 'world') updateWorld();
      if (data().tab === 'focus') updateFocus();
    }
  }

  /* ---------- 初始化 ---------- */
  App.initClock = function () {
    if (App.__clockInited) return;
    App.__clockInited = true;
    var d = data();

    document.addEventListener('pointerdown', unlockAudio, true);

    document.querySelectorAll('.clock-tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.clockTab); });
    });

    var addBtn = el('#clock-add-btn');
    if (addBtn) addBtn.addEventListener('click', openAddDialog);
    var saveBtn = el('#clock-add-save');
    if (saveBtn) saveBtn.addEventListener('click', addAlarm);
    document.querySelectorAll('#clock-add-dialog [data-close]').forEach(function (b) {
      b.addEventListener('click', closeAddDialog);
    });

    var list = el('#clock-alarm-list');
    if (list) list.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-clock-toggle]');
      if (tg) {
        var a = data().alarms.find(function (x) { return x.id === tg.dataset.clockToggle; });
        if (a) { a.enabled = !a.enabled; save(); renderAlarms(); }
        return;
      }
      var del = e.target.closest('[data-clock-del]');
      if (del) {
        data().alarms = data().alarms.filter(function (x) { return x.id !== del.dataset.clockDel; });
        save(); renderAlarms(); toast('已删除');
      }
    });

    var tones = el('#clock-tone-row');
    if (tones) tones.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clock-tone]');
      if (b) {
        d.tone = b.dataset.clockTone;
        save(); setTone(d.tone); renderAlarms();
        toast('闹铃已换成 ' + (TONES.find(function (t) { return t.key === d.tone; }) || {}).label);
        return;
      }
      if (e.target.closest('[data-clock-preview]')) {
        if (d.tone === 'mute') { toast('当前是静音，换个音色才能试听'); return; }
        setTone(d.tone); playRing(); setTimeout(stopRing, 3500);
      }
    });

    var reroll = el('#clock-reroll');
    if (reroll) reroll.addEventListener('click', function () {
      d.offsetMin = randomOffset();
      save(); updateWorld();
      toast('重新拨动了时差');
    });

    var presetRow = el('#clock-preset-row');
    if (presetRow) presetRow.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clock-preset]');
      if (!b) return;
      var min = Number(b.dataset.clockPreset);
      d.focusMin = min; save(); resetFocus(min);
    });

    var main = el('#clock-focus-main');
    if (main) main.addEventListener('click', toggleFocus);
    var reset = el('#clock-focus-reset');
    if (reset) reset.addEventListener('click', function () { resetFocus(data().focusMin); });

    /* 弹窗按钮 */
    var close = el('#clock-ring-close');
    if (close) close.addEventListener('click', closeRingPopup);
    var snoozeBtn = el('#clock-ring-snooze');
    if (snoozeBtn) snoozeBtn.addEventListener('click', function () {
      snooze = { at: Date.now() + 5 * 60000, alarm: data().alarms[0] || { label: '再睡一会儿' } };
      closeRingPopup();
      toast('好，5 分钟后再叫你');
    });
    var playBtn = el('#clock-ring-play');
    if (playBtn) playBtn.addEventListener('click', function () {
      if (data().tone === 'mute') { this.hidden = true; toast('当前是静音'); return; }
      setTone(data().tone); playRing(); this.hidden = true;
    });
    var stopBtn = el('#clock-ring-stop');
    if (stopBtn) stopBtn.addEventListener('click', function () { stopRing(); toast('铃声已停'); });

    var dlg = el('#clock-ringing-dialog');
    if (dlg) dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeRingPopup(); });

    resetFocus(d.focusMin || 25);
    renderClock();
    setInterval(tick, 1000);
  };

  App.renderClock = renderClock;
})();
