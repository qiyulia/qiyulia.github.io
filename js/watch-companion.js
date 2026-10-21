(function () { try {
(function () {
'use strict';
var G = 'xy-home-v2';
function store() {
try { if (window.xyStore) return window.xyStore(G); } catch (e) {}
return {
get: function (k) { try { return localStorage.getItem(G + ':' + k); } catch (e2) { return null; } },
set: function (k, v) { try { localStorage.setItem(G + ':' + k, v); } catch (e3) {} },
remove: function (k) { try { localStorage.removeItem(G + ':' + k); } catch (e4) {} }
};
}
function toast(msg) {
if (window.toast) { try { window.toast(msg); return; } catch (e) {} }
var t = document.getElementById('cc-toast');
if (!t) { t = document.createElement('div'); t.id = 'cc-toast'; document.body.appendChild(t); }
t.textContent = msg; t.className = 'cc-toast'; void t.offsetWidth; t.className = 'cc-toast show';
clearTimeout(t._timer); t._timer = setTimeout(function () { t.className = 'cc-toast'; }, 2000);
}
function editing() {
var gs = document.querySelectorAll('.app-grid');
for (var i = 0; i < gs.length; i++) if (gs[i].classList.contains('editing')) return true;
return false;
}
function openPage(pg) {
document.querySelectorAll('.page').forEach(function (p) { p.hidden = true; });
pg.hidden = false;
try { pg.scrollTop = 0; } catch (e) {}
}
function backHome() {
document.querySelectorAll('.page').forEach(function (p) { p.hidden = true; });
var home = document.getElementById('page-phone');
if (home) home.hidden = false;
}
var watchApp = document.querySelector('.app[data-app="watch"]');
var watchPage = document.getElementById('page-watch');
var wVideo = document.getElementById('watch-video');
var wStage = document.getElementById('watch-stage');
var wEmpty = document.getElementById('watch-empty');
var wFile = document.getElementById('watch-file');
var wUrl = document.getElementById('watch-url');
var wPlay = document.getElementById('watch-play-url');
var wHis = document.getElementById('watch-history');
var wDmLayer = document.getElementById('watch-dm-layer');
var wCardLayer = document.getElementById('watch-card-layer');
var wDmInput = document.getElementById('watch-dm-input');
var wDmSend = document.getElementById('watch-dm-send');
var wDmToggle = document.getElementById('watch-dm-toggle');
var wLandBtn = document.getElementById('watch-landscape-btn');
var wEmbed = null;
var localUrl = '';
var HIS_KEY = 'yunlian-watch-history';
var DM_KEY = 'yunlian-watch-dm-on';
var lastMode = 'local';
var dmOn = true;
try { dmOn = store().get(DM_KEY) !== '0'; } catch (e) {}
var dmLaneAt = [];
var landOn = false;
var partnerTimer = 0;
var PARTNER_DM = [
'这段我也很喜欢', '你先看，我在呢', '别快进呀，慢慢看', '哈哈这里太好笑了',
'我靠过来一点', '一起看真好啊', '你看到这里记得叫我', '我倒杯水就回来',
'这个镜头真好看', '我刚才也想到这个', '你看他们的眼神', '声音再大一点点',
'好想和你一起坐在电影院里', '这段配乐好好听', '我不剧透，你继续', '看完我们聊聊这段'
];
var PARTNER_CARDS = [
'陪你看到最后', '记得喝水', '靠过来一点', '今天也想和你一起浪费时间',
'不着急，慢慢看', '我在你旁边', '看完给你留一句话', '这一幕替你记住了',
'你专注的样子很好看', '哪怕只看十分钟也很好', '灯关小一点，我在'
];
var PARTNER_REPLY = [
'看到啦', '我也是这么想的', '哈哈，被你发现了', '那我们继续看',
'嗯，我记下了', '你说得对', '我刚好也想说这句', '好，听你的'
];
function watchVisible() {
return !!(watchPage && !watchPage.hidden && !document.hidden);
}
function hasMedia() {
return !!(wEmbed || (wVideo && wVideo.getAttribute('src')));
}
function setDmOn(on) {
dmOn = !!on;
try { store().set(DM_KEY, dmOn ? '1' : '0'); } catch (e) {}
if (wDmLayer) {
wDmLayer.hidden = !dmOn;
if (!dmOn) wDmLayer.innerHTML = '';
}
if (wDmToggle) {
wDmToggle.textContent = dmOn ? '弹幕' : '弹幕关';
wDmToggle.classList.toggle('off', !dmOn);
}
}
function dmLaneCount() {
var h = 0;
try { h = wDmLayer ? wDmLayer.clientHeight : 0; } catch (e) {}
var n = Math.floor((h || 240) / 30);
return Math.min(10, Math.max(3, n));
}
function pickDmLane() {
var n = dmLaneCount(), now = Date.now(), best = 0;
for (var i = 0; i < n; i++) {
if (!dmLaneAt[i]) dmLaneAt[i] = 0;
if (dmLaneAt[i] < dmLaneAt[best]) best = i;
}
dmLaneAt[best] = now + 2400;
return best;
}
function spawnDanmaku(text, mine) {
text = String(text || '').replace(/\s+/g, ' ').trim();
if (!text || !wDmLayer) return;
if (!dmOn) {
if (!mine) return;
setDmOn(true);
}
var el = document.createElement('div');
el.className = 'watch-dm' + (mine ? ' me' : '');
el.textContent = text;
el.style.top = (pickDmLane() * 30 + 8) + 'px';
el.style.transform = 'translateX(' + ((wDmLayer.clientWidth || 320) + 12) + 'px)';
wDmLayer.appendChild(el);
var w = el.offsetWidth || 90;
var dur = 7.5 + Math.min(6, text.length * 0.12);
el.style.transition = 'transform ' + dur.toFixed(2) + 's linear';
requestAnimationFrame(function () {
el.style.transform = 'translateX(' + (-w - 16) + 'px)';
});
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, dur * 1000 + 300);
}
function showPartnerCard(text) {
if (!wCardLayer || !text) return;
var el = document.createElement('div');
el.className = 'watch-dm-card';
var who = document.createElement('b');
who.textContent = 'TA';
var body = document.createElement('span');
body.textContent = text;
el.appendChild(who);
el.appendChild(body);
wCardLayer.appendChild(el);
setTimeout(function () {
el.classList.add('out');
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
}, 5200);
}
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function partnerTick() {
clearTimeout(partnerTimer);
if (!watchVisible() || !dmOn) return;
var delay = 8000 + Math.random() * 9000;
partnerTimer = setTimeout(function () {
if (!watchVisible() || !dmOn) { partnerTick(); return; }
if (Math.random() < 0.3) showPartnerCard(pickOne(PARTNER_CARDS));
else spawnDanmaku(pickOne(PARTNER_DM), false);
partnerTick();
}, delay);
}
function sendDm() {
var v = wDmInput ? wDmInput.value : '';
v = String(v || '').replace(/\s+/g, ' ').trim();
if (!v) { toast('先写一句弹幕'); return; }
if (v.length > 40) v = v.slice(0, 40);
setDmOn(true);
spawnDanmaku(v, true);
if (wDmInput) wDmInput.value = '';
try { wDmInput.focus(); } catch (e) {}
setTimeout(function () {
if (watchVisible() && dmOn && Math.random() < 0.45) spawnDanmaku(pickOne(PARTNER_REPLY), false);
}, 1200 + Math.random() * 1600);
}
function portraitView() { return window.innerHeight > window.innerWidth; }
function applyRotate() {
if (!watchPage || !landOn) return;
watchPage.classList.toggle('watch-rot', portraitView());
}
function setLandscape(on) {
if (!watchPage) return;
if (on && !hasMedia()) { toast('先选一个视频，再横屏观看'); return; }
landOn = !!on;
watchPage.classList.toggle('watch-landscape', landOn);
watchPage.classList.toggle('watch-rot', landOn && portraitView());
document.documentElement.classList.toggle('watch-landscape-lock', landOn);
if (wLandBtn) wLandBtn.textContent = landOn ? '退出横屏' : '横屏';
if (landOn) { try { watchPage.scrollTop = 0; } catch (e) {} }
}
function watchHistory() {
try { var a = JSON.parse(store().get(HIS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function saveWatchHistory(a) {
try { store().set(HIS_KEY, JSON.stringify(a.slice(0, 12))); } catch (e) {}
}
function setWatchMode(m) {
lastMode = m;
document.querySelectorAll('.watch-tab').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-wsrc') === m); });
document.querySelectorAll('.watch-panel').forEach(function (p) { p.hidden = p.getAttribute('data-wpanel') !== m; });
}
function clearEmbed() {
if (wEmbed && wEmbed.parentNode) wEmbed.parentNode.removeChild(wEmbed);
wEmbed = null;
if (wStage) wStage.setAttribute('data-embed', '0');
}
function showEmpty(text) {
if (!wEmpty) return;
if (text) { wEmpty.textContent = text; wEmpty.hidden = false; }
else wEmpty.hidden = true;
}
function stopVideo() {
try { if (wVideo) { wVideo.pause(); } } catch (e) {}
}
function embedUrl(u) {
var m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
if (m) return 'https://www.youtube.com/embed/' + m[1];
var b = u.match(/(BV[0-9A-Za-z]{10})/);
if (b) return 'https://player.bilibili.com/player.html?bvid=' + b[1] + '&high_quality=1&autoplay=0';
var a = u.match(/\/video\/(?:av|AV)(\d+)/);
if (a) return 'https://player.bilibili.com/player.html?aid=' + a[1] + '&high_quality=1&autoplay=0';
var d = u.match(/(?:vimeo\.com\/)(\d+)/);
if (d) return 'https://player.vimeo.com/video/' + d[1];
return '';
}
function isDirectMedia(u) {
return /^(blob:|data:video)/i.test(u) || /\.(mp4|webm|ogv|ogg|m4v|mov|m3u8|flv)(\?|#|$)/i.test(u);
}
function playEmbed(src) {
clearEmbed();
stopVideo();
wEmbed = document.createElement('div');
wEmbed.className = 'watch-embed';
var f = document.createElement('iframe');
f.src = src;
f.setAttribute('allowfullscreen', 'true');
f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
f.setAttribute('referrerpolicy', 'no-referrer');
wEmbed.appendChild(f);
wStage.appendChild(wEmbed);
wStage.setAttribute('data-embed', '1');
showEmpty('');
}
function playVideo(src) {
clearEmbed();
if (!wVideo) return;
wVideo.src = src;
showEmpty('');
var p = wVideo.play();
if (p && p.catch) p.catch(function () {});
}
function pushWatchHistory(u, title) {
var a = watchHistory().filter(function (x) { return x && x.u !== u; });
a.unshift({ u: u, t: title || u, ts: Date.now() });
saveWatchHistory(a);
renderWatchHistory();
}
function renderWatchHistory() {
if (!wHis) return;
var a = watchHistory();
if (!a.length) { wHis.innerHTML = ''; return; }
var html = '<div class="watch-his-t">最近播放</div>';
a.forEach(function (x, i) {
html += '<div class="watch-his-row" data-whis="' + i + '"><span>' +
String(x.t || x.u || '').replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) +
'</span><button type="button" data-whis-play="' + i + '">播放</button></div>';
});
html += '<button type="button" class="watch-his-clear" id="watch-his-clear">清空最近播放</button>';
wHis.innerHTML = html;
}
function playOnline(u) {
u = String(u || '').trim();
if (!u) { toast('先粘贴一个视频链接'); return; }
setWatchMode('online');
var e = embedUrl(u);
if (e) {
playEmbed(e);
pushWatchHistory(u, u);
return;
}
if (!/^https?:\/\//i.test(u) && !/^blob:/i.test(u)) { toast('链接需要以 http:// 或 https:// 开头'); return; }
playVideo(u);
pushWatchHistory(u, u);
}
if (watchApp && watchPage) {
watchApp.addEventListener('click', function () {
if (editing()) return;
openPage(watchPage);
setWatchMode(lastMode);
renderWatchHistory();
partnerTick();
if (dmOn && !hasMedia()) {
setTimeout(function () {
if (watchVisible() && !hasMedia()) showPartnerCard('选好片子叫我，我搬好小板凳了');
}, 1400);
}
});
}
var watchBack = document.getElementById('watch-back');
if (watchBack) watchBack.addEventListener('click', function () {
stopVideo();
setLandscape(false);
clearTimeout(partnerTimer);
backHome();
});
if (wDmSend) wDmSend.addEventListener('click', sendDm);
if (wDmInput) wDmInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); sendDm(); }
});
if (wDmToggle) wDmToggle.addEventListener('click', function () {
setDmOn(!dmOn);
if (dmOn) partnerTick();
});
if (wLandBtn) wLandBtn.addEventListener('click', function () { setLandscape(!landOn); });
window.addEventListener('resize', applyRotate);
window.addEventListener('orientationchange', function () { setTimeout(applyRotate, 160); });
document.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && landOn) setLandscape(false);
});
document.addEventListener('visibilitychange', function () {
if (document.hidden) clearTimeout(partnerTimer);
else if (watchVisible()) partnerTick();
});
setDmOn(dmOn);
document.querySelectorAll('.watch-tab').forEach(function (b) {
b.addEventListener('click', function () { setWatchMode(b.getAttribute('data-wsrc')); });
});
if (wFile) {
wFile.addEventListener('change', function () {
var f = wFile.files && wFile.files[0];
if (!f) return;
if (localUrl) { try { URL.revokeObjectURL(localUrl); } catch (e) {} }
localUrl = URL.createObjectURL(f);
setWatchMode('local');
playVideo(localUrl);
pushWatchHistory(localUrl, f.name);
toast('正在播放：' + f.name);
});
}
if (wPlay) wPlay.addEventListener('click', function () { playOnline(wUrl && wUrl.value); });
if (wUrl) wUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); playOnline(wUrl.value); } });
if (wHis) {
wHis.addEventListener('click', function (e) {
var t = e.target;
if (!t || !t.closest) return;
var clear = t.closest('#watch-his-clear');
if (clear) { saveWatchHistory([]); renderWatchHistory(); return; }
var play = t.closest('[data-whis-play]');
if (!play) return;
var idx = Number(play.getAttribute('data-whis-play'));
var item = watchHistory()[idx];
if (!item) return;
if (/^blob:/i.test(item.u)) { toast('本地文件需重新选择（浏览器不保留文件访问）'); return; }
if (wUrl) wUrl.value = item.u;
playOnline(item.u);
});
}
if (wVideo) {
wVideo.addEventListener('error', function () {
if (!wVideo.getAttribute('src')) return;
showEmpty('这个链接播放不了：请换 mp4 / m3u8 直链，或使用 B站 / YouTube 链接');
});
wVideo.addEventListener('play', function () { showEmpty(''); });
}
var compApp = document.querySelector('.app[data-app="companion"]');
var compPage = document.getElementById('page-companion');
var cTime = document.getElementById('comp-time');
var cState = document.getElementById('comp-state');
var cRing = document.getElementById('comp-ring');
var cStart = document.getElementById('comp-start');
var cReset = document.getElementById('comp-reset');
var cMsg = document.getElementById('comp-msg');
var cStats = document.getElementById('comp-stats');
var cCustom = document.getElementById('comp-custom-min');
var cCustomApply = document.getElementById('comp-custom-apply');
var RING = 2 * Math.PI * 88;
var CFG_KEY = 'yunlian-companion-cfg';
var ST_KEY = 'yunlian-companion-state';
var TODAY_KEY = 'yunlian-companion-today';
var TOTAL_KEY = 'yunlian-companion-total';
var MODE_LABEL = { study: '学习', work: '工作' };
var MSGS = [
'我在你旁边，专心做你的事就好。',
'不用急着完成，先把这一小段走完。',
'渴了就喝口水，累了就伸个懒腰。',
'你已经开始了，这就很了不起。',
'剩下的时间交给我来数，你只管专注。',
'做完这一段，记得给自己一点奖励。'
];
var cs = { mode: 'study', minutes: 25, total: 25 * 60000, remain: 25 * 60000, running: false, endAt: 0, msgAt: 0, msgIdx: 0 };
var timer = null;
function readCfg() {
try {
var o = JSON.parse(store().get(CFG_KEY) || '{}');
if (o && (o.mode === 'study' || o.mode === 'work') && Number(o.minutes) > 0) return o;
} catch (e) {}
return { mode: 'study', minutes: 25 };
}
function saveCfg() { try { store().set(CFG_KEY, JSON.stringify({ mode: cs.mode, minutes: cs.minutes })); } catch (e) {} }
function saveState() {
try {
store().set(ST_KEY, JSON.stringify({
mode: cs.mode, minutes: cs.minutes, total: cs.total, remain: cs.remain,
running: cs.running, endAt: cs.endAt
}));
} catch (e) {}
}
function todayKey() {
var d = new Date();
return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function getToday() {
try {
var o = JSON.parse(store().get(TODAY_KEY) || '{}');
if (o && o.date === todayKey()) return { date: o.date, mins: Number(o.mins) || 0, count: Number(o.count) || 0 };
} catch (e) {}
return { date: todayKey(), mins: 0, count: 0 };
}
function getTotal() { return parseInt(store().get(TOTAL_KEY) || '0', 10) || 0; }
function addStat(minutes) {
var t = getToday();
t.mins += Math.max(1, Math.round(minutes));
t.count += 1;
try { store().set(TODAY_KEY, JSON.stringify(t)); store().set(TOTAL_KEY, String(getTotal() + 1)); } catch (e) {}
renderStats();
}
function renderStats() {
if (!cStats) return;
var t = getToday();
cStats.textContent = '今日专注 ' + t.mins + ' 分钟 · 累计 ' + getTotal() + ' 次';
}
function fmt(ms) {
var s = Math.max(0, Math.ceil(ms / 1000));
var m = Math.floor(s / 60);
var r = s % 60;
return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
}
function beep(times) {
try {
var AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
var ctx = beep._ctx || (beep._ctx = new AC());
var n = times || 3;
for (var i = 0; i < n; i++) {
(function (i2) {
var o = ctx.createOscillator();
var g = ctx.createGain();
o.type = 'sine'; o.frequency.value = 880;
o.connect(g); g.connect(ctx.destination);
var t0 = ctx.currentTime + i2 * 0.55;
g.gain.setValueAtTime(0.0001, t0);
g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
o.start(t0); o.stop(t0 + 0.45);
})(i);
}
} catch (e) {}
}
function renderComp() {
if (!cTime) return;
var total = cs.total > 0 ? cs.total : 1;
var remain = Math.max(0, cs.remain);
cTime.textContent = fmt(remain);
if (cRing) {
var pct = 1 - remain / total;
if (pct < 0) pct = 0; if (pct > 1) pct = 1;
cRing.style.strokeDasharray = String(RING);
cRing.style.strokeDashoffset = String(RING * (1 - pct));
}
if (cState) {
cState.textContent = cs.running ? (MODE_LABEL[cs.mode] + '中') : (remain <= 0 ? '已完成' : (remain < cs.total ? '已暂停' : '准备开始'));
}
if (cStart) cStart.textContent = cs.running ? '暂停' : (remain < cs.total && remain > 0 ? '继续' : '开始');
document.querySelectorAll('.comp-mode').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-cmode') === cs.mode); });
document.querySelectorAll('.comp-presets button').forEach(function (b) {
b.classList.toggle('sel', Number(b.getAttribute('data-cmin')) === cs.minutes);
});
renderStats();
}
function tick() {
if (!cs.running) return;
var now = Date.now();
cs.remain = cs.endAt - now;
if (cs.remain <= 0) { finishComp(); return; }
if (now - cs.msgAt > 24000) {
cs.msgAt = now;
cs.msgIdx = (cs.msgIdx + 1) % MSGS.length;
if (cMsg) cMsg.textContent = MSGS[cs.msgIdx];
}
renderComp();
}
function startComp() {
if (cs.running) {
cs.remain = Math.max(0, cs.endAt - Date.now());
cs.running = false;
cs.endAt = 0;
if (cMsg) cMsg.textContent = '已暂停，休息一下再继续。';
saveState(); renderComp();
return;
}
if (cs.remain <= 0) cs.remain = cs.total;
cs.running = true;
cs.endAt = Date.now() + cs.remain;
cs.msgAt = 0;
if (cMsg) cMsg.textContent = MODE_LABEL[cs.mode] + '计时开始，我陪着你。';
beep(1);
saveCfg(); saveState(); renderComp();
}
function finishComp() {
cs.running = false;
cs.remain = 0;
cs.endAt = 0;
addStat(cs.total / 60000);
if (cMsg) cMsg.textContent = '这一段' + MODE_LABEL[cs.mode] + '完成了，辛苦了，去放松一下吧。';
beep(3);
saveState(); renderComp();
try {
if (window.Notification && Notification.permission === 'granted' && document.hidden) {
new Notification('云恋 · ' + MODE_LABEL[cs.mode] + '完成', { body: '计时结束啦，休息一下吧。' });
}
} catch (e) {}
toast(MODE_LABEL[cs.mode] + '计时完成');
}
function resetComp() {
cs.running = false;
cs.endAt = 0;
cs.remain = cs.total;
if (cMsg) cMsg.textContent = '已重置，选好时长再开始。';
saveState(); renderComp();
}
function setMinutes(min) {
min = Math.round(Number(min));
if (!min || min < 1) { toast('请输入大于 0 的分钟数'); return; }
if (min > 600) min = 600;
cs.minutes = min;
cs.total = min * 60000;
cs.remain = cs.total;
cs.running = false;
cs.endAt = 0;
if (cMsg) cMsg.textContent = MODE_LABEL[cs.mode] + ' ' + min + ' 分钟，准备好了就点开始。';
saveCfg(); saveState(); renderComp();
}
function setMode(m) {
if (m !== 'study' && m !== 'work') return;
cs.mode = m;
if (!cs.running) { cs.remain = cs.total; }
if (cMsg) cMsg.textContent = '切换到「' + MODE_LABEL[m] + '」，选好时长就开始吧。';
saveCfg(); saveState(); renderComp();
}
(function restoreComp() {
var cfg = readCfg();
cs.mode = cfg.mode; cs.minutes = cfg.minutes; cs.total = cfg.minutes * 60000; cs.remain = cs.total;
try {
var st = JSON.parse(store().get(ST_KEY) || 'null');
if (st && Number(st.total) > 0) {
cs.mode = (st.mode === 'work') ? 'work' : 'study';
cs.minutes = Number(st.minutes) || cs.minutes;
cs.total = Number(st.total) || cs.total;
cs.remain = Number(st.remain) || cs.total;
if (st.running && Number(st.endAt) > Date.now()) {
cs.running = true; cs.endAt = Number(st.endAt); cs.remain = cs.endAt - Date.now();
} else {
cs.running = false; cs.endAt = 0;
if (st.running) { cs.remain = 0; }
}
}
} catch (e) {}
})();
if (compApp && compPage) {
compApp.addEventListener('click', function () {
if (editing()) return;
openPage(compPage);
if (cs.running) cs.remain = Math.max(0, cs.endAt - Date.now());
if (cMsg && cs.remain > 0 && !cs.running) cMsg.textContent = '准备好了就点开始，我陪着你。';
renderComp();
});
}
var compBack = document.getElementById('comp-back');
if (compBack) compBack.addEventListener('click', backHome);
document.querySelectorAll('.comp-mode').forEach(function (b) {
b.addEventListener('click', function () { setMode(b.getAttribute('data-cmode')); });
});
document.querySelectorAll('.comp-presets button').forEach(function (b) {
b.addEventListener('click', function () { setMinutes(b.getAttribute('data-cmin')); });
});
if (cCustomApply) cCustomApply.addEventListener('click', function () { setMinutes(cCustom && cCustom.value); });
if (cCustom) cCustom.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); setMinutes(cCustom.value); } });
if (cStart) cStart.addEventListener('click', startComp);
if (cReset) cReset.addEventListener('click', resetComp);
renderComp();
if (cs.running && cs.remain > 0) { if (cMsg) cMsg.textContent = MODE_LABEL[cs.mode] + '计时进行中，我陪着你。'; }
timer = setInterval(tick, 250);
document.addEventListener('visibilitychange', function () { if (!document.hidden && cs.running) tick(); });
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("watch-companion.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("watch-companion.js"); try { console.error("[JS] watch-companion.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[watch-companion.js] " + String(__e && __e.message || __e)); } })();