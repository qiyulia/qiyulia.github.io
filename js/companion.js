(function () { try {
(function () {
var page = document.getElementById('page-companion');
if (!page) return;
var RING_C = 2 * Math.PI * 88;
var PRESETS = { study: [15, 25, 45, 60], work: [25, 45, 60, 90] };
var LABEL = { study: '学习', work: '工作' };
var store = null;
try { store = window.xyStore ? window.xyStore('xy-home-v2') : null; } catch (e) { store = null; }
var els = {
tabs: document.getElementById('cmp-tabs'),
time: document.getElementById('cmp-time'),
state: document.getElementById('cmp-state'),
ring: document.getElementById('cmp-ring'),
presets: document.getElementById('cmp-presets'),
start: document.getElementById('cmp-start'),
add5: document.getElementById('cmp-add5'),
reset: document.getElementById('cmp-reset'),
msg: document.getElementById('cmp-msg'),
stats: document.getElementById('cmp-stats'),
dur: document.getElementById('cmp-dur'),
notify: document.getElementById('cmp-notify'),
chat: document.getElementById('cmp-chat'),
back: document.getElementById('cmp-back')
};
if (els.ring) {
els.ring.setAttribute('stroke-dasharray', String(RING_C));
els.ring.setAttribute('stroke-dashoffset', '0');
}
function toast(m) { try { if (typeof window.toast === 'function') window.toast(m); } catch (e) {} }
function get(k, def) {
try { var v = store && store.get(k); return v === null || v === undefined || v === '' ? def : v; } catch (e) { return def; }
}
function set(k, v) { try { if (store) store.set(k, String(v)); } catch (e) {} }
function clampDur(ms) { return Math.max(60000, Math.min(300 * 60000, ms || 0)); }
var st = { mode: 'study', t: {
study: { totalMs: 25 * 60000, remainMs: 25 * 60000, endAt: 0, running: false },
work: { totalMs: 45 * 60000, remainMs: 45 * 60000, endAt: 0, running: false }
} };
(function loadState() {
var raw = get('companion-state', '');
if (!raw) return;
try {
var o = JSON.parse(raw);
if (!o || !o.t) return;
if (o.mode === 'work' || o.mode === 'study') st.mode = o.mode;
['study', 'work'].forEach(function (k) {
var m = o.t[k];
if (!m) return;
var d = PRESETS[k][1] * 60000;
st.t[k].totalMs = clampDur(Number(m.totalMs) || d);
st.t[k].remainMs = Math.max(0, Math.min(st.t[k].totalMs, Number(m.remainMs) || st.t[k].totalMs));
st.t[k].running = !!m.running;
st.t[k].endAt = Number(m.endAt) || 0;
});
} catch (e) {}
})();
function saveState() {
try { set('companion-state', JSON.stringify(st)); } catch (e) {}
}
function cur() { return st.t[st.mode]; }
function remainOf(m) {
if (!m.running) return Math.max(0, m.remainMs);
return Math.max(0, m.endAt - Date.now());
}
function fmt(sec) {
sec = Math.max(0, Math.ceil(sec));
var mm = Math.floor(sec / 60);
var ss = sec % 60;
return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
}
function ymd(d) {
return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}
var dayCache = null;
function loadDay() {
var dk = ymd(new Date());
if (dayCache && dayCache.d === dk) return dayCache;
try {
var o = JSON.parse(get('companion-day', '') || 'null');
if (o && o.d === dk) { dayCache = { d: dk, study: Number(o.study) || 0, work: Number(o.work) || 0 }; return dayCache; }
} catch (e) {}
dayCache = { d: dk, study: 0, work: 0 };
return dayCache;
}
function addDay(mode, mins) {
var d = loadDay();
d[mode] += mins;
try { set('companion-day', JSON.stringify(d)); } catch (e) {}
}
function notifyOn() { return get('companion-notify', '1') !== '0'; }
function chatOn() { return get('companion-chat', '1') !== '0'; }
var presetSig = '';
function renderPresets() {
var sig = st.mode + ':' + Math.round(cur().totalMs / 60000);
if (sig === presetSig || !els.presets) return;
presetSig = sig;
var mins = Math.round(cur().totalMs / 60000);
var arr = PRESETS[st.mode];
var html = '';
for (var i = 0; i < arr.length; i++) {
html += '<button class="cmp-preset' + (arr[i] === mins ? ' sel' : '') + '" type="button" data-cmp-min="' + arr[i] + '">' + arr[i] + ' 分钟</button>';
}
els.presets.innerHTML = html;
}
function render() {
var m = cur();
var total = Math.max(60000, m.totalMs || 60000);
var rem = remainOf(m);
if (els.time) els.time.textContent = fmt(rem / 1000);
if (els.ring) {
var pct = Math.max(0, Math.min(1, rem / total));
els.ring.style.strokeDashoffset = String(RING_C * (1 - pct));
}
if (els.state) {
els.state.textContent = m.running ? (st.mode === 'study' ? '学习中…' : '工作中…')
: (rem <= 0 ? '完成' : (rem < total ? '已暂停' : '准备开始'));
}
if (els.start) els.start.textContent = m.running ? '暂停' : (rem <= 0 ? '再来一轮' : (rem < total ? '继续' : '开始'));
if (els.dur) els.dur.value = String(Math.max(1, Math.round(total / 60000)));
if (els.tabs) {
Array.prototype.forEach.call(els.tabs.querySelectorAll('.cmp-tab'), function (b) {
b.classList.toggle('sel', b.getAttribute('data-cmp') === st.mode);
});
}
if (els.notify) {
var onN = notifyOn();
els.notify.textContent = onN ? '开' : '关';
els.notify.classList.toggle('on', onN);
}
if (els.chat) {
var onC = chatOn();
els.chat.textContent = onC ? '开' : '关';
els.chat.classList.toggle('on', onC);
}
var d = loadDay();
if (els.stats) els.stats.textContent = '今天学习 ' + d.study + ' 分钟 · 工作 ' + d.work + ' 分钟';
renderPresets();
}
function notify(title, body) {
try {
if (!('Notification' in window) || Notification.permission !== 'granted') return;
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
navigator.serviceWorker.ready.then(function (reg) {
try { reg.showNotification(title, { body: body, tag: 'companion-' + Date.now() }); }
catch (e) { try { new Notification(title, { body: body }); } catch (e2) {} }
});
} else {
try { new Notification(title, { body: body }); } catch (e) {}
}
} catch (e) {}
}
var armTimers = { study: null, work: null };
function disarm(mode) {
if (armTimers[mode]) { clearTimeout(armTimers[mode]); armTimers[mode] = null; }
}
function arm(mode) {
disarm(mode);
var m = st.t[mode];
if (!m.running) return;
var delay = m.endAt - Date.now();
if (!(delay > 0)) return;
var mins = Math.max(1, Math.round(m.totalMs / 60000));
armTimers[mode] = setTimeout(function () {
armTimers[mode] = null;
var mm = st.t[mode];
if (!mm.running) return;
if (Date.now() < mm.endAt - 1500) return;
if (document.visibilityState === 'visible') return; // 前台由震动/铃音负责
if (notifyOn()) notify('陪伴 · ' + LABEL[mode] + '结束', '这一轮 ' + mins + ' 分钟完成了，休息一下吧');
}, delay + 120);
}
var tickTimer = null;
function ensureTick() {
if (tickTimer) return;
tickTimer = setInterval(tick, 400);
}
function stopTickIfIdle() {
if (!st.t.study.running && !st.t.work.running && tickTimer) {
clearInterval(tickTimer);
tickTimer = null;
}
}
function tick() {
var now = Date.now();
var active = false;
['study', 'work'].forEach(function (k) {
var m = st.t[k];
if (!m.running) return;
active = true;
if (now >= m.endAt) complete(k);
});
render();
if (!active) stopTickIfIdle();
}
function complete(mode, quiet) {
var m = st.t[mode];
var wasRunning = m.running;
m.running = false;
m.endAt = 0;
m.remainMs = 0;
disarm(mode);
saveState();
if (!wasRunning) return;
var mins = Math.max(1, Math.round(m.totalMs / 60000));
addDay(mode, mins);
if (mode === st.mode) {
render();
if (els.msg) els.msg.textContent = '这一轮完成了。休息一下，再开始下一轮吧。';
}
if (quiet) return;
try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) {}
try { if (window.playBuiltinSfx) window.playBuiltinSfx('ring-warm', false); } catch (e) {}
if (document.visibilityState === 'visible') toast('陪伴 · ' + LABEL[mode] + ' ' + mins + ' 分钟完成');
if (notifyOn()) notify('陪伴 · ' + LABEL[mode] + '结束', '这一轮 ' + mins + ' 分钟完成了，休息一下吧');
if (chatOn()) {
try {
if (window.chatAddIn) window.chatAddIn('陪伴 · ' + LABEL[mode] + ' ' + mins + ' 分钟完成，休息一下吧', { special: 'poke', nightAllow: true, rateAllow: true });
} catch (e) {}
}
}
function toggleStart() {
var m = cur();
if (m.running) {
m.remainMs = Math.max(0, m.endAt - Date.now());
m.running = false;
m.endAt = 0;
disarm(st.mode);
if (els.msg) els.msg.textContent = '先休息一下，想继续就点「继续」。';
} else {
if (m.remainMs <= 0) m.remainMs = m.totalMs;
m.endAt = Date.now() + m.remainMs;
m.running = true;
arm(st.mode);
ensureTick();
if (els.msg) els.msg.textContent = st.mode === 'study' ? '这一轮好好学，我陪你。' : '这一轮专心做事，我在旁边。';
}
saveState();
render();
}
function resetTimer() {
var m = cur();
m.running = false;
m.endAt = 0;
m.remainMs = m.totalMs;
disarm(st.mode);
saveState();
if (els.msg) els.msg.textContent = '已经重置，随时可以重新开始。';
render();
}
function addFive() {
var m = cur();
m.totalMs = clampDur(m.totalMs + 5 * 60000);
if (m.running) m.endAt += 5 * 60000;
else m.remainMs = Math.min(m.totalMs, m.remainMs + 5 * 60000);
if (m.running) { disarm(st.mode); arm(st.mode); }
saveState();
render();
}
function applyDuration(mins) {
var m = cur();
mins = Math.max(1, Math.min(180, Math.round(mins) || 1));
m.totalMs = mins * 60000;
m.remainMs = m.totalMs;
m.running = false;
m.endAt = 0;
disarm(st.mode);
saveState();
if (els.msg) els.msg.textContent = '时长改成 ' + mins + ' 分钟，点开始就好。';
render();
}
function switchMode(mode) {
if (mode !== 'study' && mode !== 'work') return;
st.mode = mode;
saveState();
render();
}
if (els.start) els.start.addEventListener('click', toggleStart);
if (els.reset) els.reset.addEventListener('click', resetTimer);
if (els.add5) els.add5.addEventListener('click', addFive);
if (els.tabs) {
els.tabs.addEventListener('click', function (e) {
var b = e.target.closest ? e.target.closest('.cmp-tab') : null;
if (!b) return;
switchMode(b.getAttribute('data-cmp'));
});
}
if (els.presets) {
els.presets.addEventListener('click', function (e) {
var b = e.target.closest ? e.target.closest('.cmp-preset') : null;
if (!b) return;
applyDuration(Number(b.getAttribute('data-cmp-min')));
});
}
if (els.dur) {
els.dur.addEventListener('change', function () { applyDuration(Number(els.dur.value)); });
}
if (els.notify) {
els.notify.addEventListener('click', function () {
var on = !notifyOn();
set('companion-notify', on ? '1' : '0');
if (on && 'Notification' in window && Notification.permission === 'default') {
try { Notification.requestPermission(); } catch (e) {}
}
render();
});
}
if (els.chat) {
els.chat.addEventListener('click', function () {
set('companion-chat', chatOn() ? '0' : '1');
render();
});
}
function makeApp() {
var a = document.createElement('div');
a.className = 'app';
a.setAttribute('data-app', 'companion');
a.setAttribute('data-desk-widget', 'app-companion');
a.innerHTML = '<div class="app-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12.5" r="8"/><path d="M12 8.2v4.5l2.9 1.7"/><path d="M9 3.2L7.6 1.9M15 3.2l1.4-1.3"/></svg></div><div class="app-name">陪伴</div>';
a.addEventListener('click', function () {
var editing = Array.prototype.slice.call(document.querySelectorAll('.app-grid')).some(function (g) { return g.classList.contains('editing'); });
if (editing) return;
openPage();
});
return a;
}
var existing = document.querySelector('.app[data-app="companion"]');
if (!existing) {
var app = makeApp();
var grid = document.querySelector('.app-grid.p3-grid');
if (!grid) grid = document.querySelector('.app-grid.p2-grid');
if (grid) grid.appendChild(app);
else {
var phone = document.getElementById('page-phone');
if (phone) phone.appendChild(app);
}
try { if (window.applyDeskLayout) window.applyDeskLayout(); } catch (e) {}
}
function openPage() {
document.querySelectorAll('.page').forEach(function (p) { p.hidden = true; });
page.hidden = false;
if (els.msg) els.msg.textContent = '选一个时长，开始这轮陪伴。';
render();
if (st.t.study.running || st.t.work.running) ensureTick();
}
if (els.back) {
els.back.addEventListener('click', function () {
document.querySelectorAll('.page').forEach(function (p) { p.hidden = true; });
var home = document.getElementById('page-phone');
if (home) home.hidden = false;
});
}
(function bootRestore() {
var now = Date.now();
['study', 'work'].forEach(function (k) {
var m = st.t[k];
if (!m.running) return;
if (m.endAt <= now) {
var late = now - m.endAt;
m.running = false;
m.endAt = 0;
m.remainMs = 0;
if (late < 10 * 60000) complete(k);
else { saveState(); }
} else {
m.remainMs = Math.max(0, m.endAt - now);
arm(k);
ensureTick();
}
});
saveState();
render();
})();
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'visible') { render(); if (st.t.study.running || st.t.work.running) ensureTick(); }
else saveState();
});
window.openCompanion = openPage;
window.__companionProbe = { state: function () { return { mode: st.mode, study: st.t.study, work: st.t.work }; } };
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("companion.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("companion.js"); try { console.error("[JS] companion.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[companion.js] " + String(__e && __e.message || __e)); } })();