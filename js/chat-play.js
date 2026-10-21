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
function hideMore() {
var mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
}
function esc(s) {
return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function rnd(n) { return Math.floor(Math.random() * n); }
function pickOne(a) { return a && a.length ? a[rnd(a.length)] : ''; }
function pickLibText(maxLen) {
var out = [];
try { var own = window.getCustomCards && window.getCustomCards(); if (own && own.length) out = out.concat(own); } catch (e) {}
try { var def = window.getDefaultCards && window.getDefaultCards('chat'); if (def && def.length) out = out.concat(def); } catch (e2) {}
out = out.filter(function (s) {
return typeof s === 'string' && s && s.indexOf('data:') !== 0 && s.indexOf('@@m:') !== 0 &&
s.indexOf('|||') < 0 && s.length <= (maxLen || 32);
});
return pickOne(out);
}
var COLORS = ['#2b3040', '#d9534f', '#e59a3c', '#5aa469', '#3c9ae8', '#8e6fd0', '#e06fae', '#8a6a45'];
function CanvasPad(canvas, opt) {
opt = opt || {};
var ctx = canvas.getContext('2d');
if (!ctx) return null;
var pad = { strokes: [], color: COLORS[0], width: opt.width || 3, w: 0, h: 0, dpr: 1 };
function paintBg() {
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function redraw() {
paintBg();
ctx.setTransform(pad.dpr, 0, 0, pad.dpr, 0, 0);
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
pad.strokes.forEach(function (s) {
if (!s.p.length) return;
ctx.strokeStyle = s.c;
ctx.lineWidth = s.w;
ctx.beginPath();
ctx.moveTo(s.p[0].x, s.p[0].y);
for (var i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i].x, s.p[i].y);
if (s.p.length === 1) ctx.lineTo(s.p[0].x + 0.1, s.p[0].y);
ctx.stroke();
});
}
function resize() {
var r = canvas.getBoundingClientRect();
if (!r.width || !r.height) return false;
var dpr = Math.min(window.devicePixelRatio || 1, 2);
var w = Math.round(r.width), h = Math.round(r.height);
if (w === pad.w && h === pad.h && dpr === pad.dpr) return true;
pad.w = w; pad.h = h; pad.dpr = dpr;
canvas.width = Math.round(w * dpr);
canvas.height = Math.round(h * dpr);
redraw();
return true;
}
function pos(e) {
var r = canvas.getBoundingClientRect();
return { x: e.clientX - r.left, y: e.clientY - r.top };
}
var drawing = false, cur = null;
function stop() { drawing = false; cur = null; }
canvas.addEventListener('pointerdown', function (e) {
if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
e.preventDefault();
try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
drawing = true;
cur = { c: pad.color, w: pad.width, p: [pos(e)] };
pad.strokes.push(cur);
redraw();
if (opt.onDraw) { try { opt.onDraw(); } catch (e2) {} }
});
canvas.addEventListener('pointermove', function (e) {
if (!drawing || !cur) return;
e.preventDefault();
var p = pos(e), q = cur.p[cur.p.length - 1];
if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) < 0.8) return;
cur.p.push(p);
redraw();
});
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);
canvas.addEventListener('pointerleave', function () { if (drawing) stop(); });
pad.resize = resize;
pad.undo = function () { if (!pad.strokes.length) return; pad.strokes.pop(); redraw(); };
pad.clear = function () { pad.strokes = []; redraw(); };
pad.empty = function () { return !pad.strokes.length; };
pad.setColor = function (c) { pad.color = c; };
pad.export = function () {
try { paintBg(); return canvas.toDataURL('image/jpeg', 0.86); } catch (e) { return ''; }
};
return pad;
}
function buildColorDots(box, pad) {
if (!box || !pad) return;
box.innerHTML = '';
COLORS.forEach(function (c, i) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'yl-doodle-dot' + (i === 0 ? ' sel' : '');
b.style.background = c;
b.addEventListener('click', function () {
pad.setColor(c);
Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('sel'); });
b.classList.add('sel');
});
box.appendChild(b);
});
}
var doodlePanel = document.getElementById('chat-doodle-panel');
var doodleCanvas = document.getElementById('yl-doodle-canvas');
var doodleColors = document.getElementById('yl-doodle-colors');
var doodleOpen = document.getElementById('more-doodle');
var doodleClose = document.getElementById('chat-doodle-close');
var doodleUndo = document.getElementById('yl-doodle-undo');
var doodleClear = document.getElementById('yl-doodle-clear');
var doodleSend = document.getElementById('yl-doodle-send');
var padDoodle = doodleCanvas ? CanvasPad(doodleCanvas, { width: 3 }) : null;
if (padDoodle) buildColorDots(doodleColors, padDoodle);
var MARK_KEY = 'yl-doodle-marks';
var STICK_EMOJI = ['💗', '✨', '🌸', '🥰', '😆', '👍', '🌟', '🐰', '🍀', '💫', '🫶', '🎀', '🐣', '🍓'];
function srcHash(s) {
s = String(s || '');
var t = s.slice(-72), h = 5381;
for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
return s.length.toString(36) + '-' + (h >>> 0).toString(36);
}
function marksAll() {
try {
var v = store().get(MARK_KEY);
var o = v ? JSON.parse(v) : null;
return o && typeof o === 'object' ? o : {};
} catch (e) { return {}; }
}
function marksSave(o) { try { store().set(MARK_KEY, JSON.stringify(o)); } catch (e) {} }
function markHtml(marks) {
var out = '';
(marks || []).forEach(function (m) {
out += '<span class="yl-doodle-mark" style="left:' + m.x + '%;top:' + m.y + '%">' + esc(m.e) + '</span>';
});
return out;
}
function paintMarks(h, marks) {
var nodes = document.querySelectorAll('.yl-doodle-wrap[data-ylhash="' + h + '"] .yl-doodle-marks');
Array.prototype.forEach.call(nodes, function (box) { box.innerHTML = markHtml(marks); });
}
function taStick(h) {
var all = marksAll();
if (Array.isArray(all[h]) && all[h].length) return;
var n = 1 + rnd(2), arr = [];
for (var i = 0; i < n; i++) {
arr.push({ x: 16 + rnd(66), y: 18 + rnd(62), e: STICK_EMOJI[rnd(STICK_EMOJI.length)] });
}
all[h] = arr;
marksSave(all);
paintMarks(h, arr);
}
function scheduleTaStick(h) {
setTimeout(function () { try { taStick(h); } catch (e) {} }, 1800 + rnd(2200));
}
window.mochiDoodleRender = function (b, rec) {
if (!b || !rec) return;
var src = String(rec.text || '');
var h = srcHash(src);
var all = marksAll();
var marks = Array.isArray(all[h]) ? all[h] : [];
b.classList.add('yl-doodle-bubble');
b.innerHTML = '<div class="yl-doodle-wrap" data-ylhash="' + esc(h) + '">' +
'<img class="msg-img msg-img-big" src="' + esc(src) + '" alt="涂鸦" loading="lazy" decoding="async">' +
'<div class="yl-doodle-marks">' + markHtml(marks) + '</div></div>';
var img = b.querySelector('img');
if (img) {
img.addEventListener('click', function (e) {
e.stopPropagation();
try { if (window.viewChatImage) window.viewChatImage(src); } catch (e2) {}
});
}
try { if (window.bindMediaFailPlaceholder) window.bindMediaFailPlaceholder(b); } catch (e3) {}
};
function openDoodle() {
if (!doodlePanel) return;
hideMore();
doodlePanel.hidden = false;
requestAnimationFrame(function () {
if (padDoodle) padDoodle.resize();
setTimeout(function () { if (padDoodle && !doodlePanel.hidden) padDoodle.resize(); }, 160);
});
}
function closeDoodle() { if (doodlePanel) doodlePanel.hidden = true; }
if (doodleOpen) doodleOpen.addEventListener('click', function (e) { e.stopPropagation(); openDoodle(); });
if (doodleClose) doodleClose.addEventListener('click', closeDoodle);
if (doodleUndo) doodleUndo.addEventListener('click', function () { if (padDoodle) padDoodle.undo(); });
if (doodleClear) doodleClear.addEventListener('click', function () { if (padDoodle) padDoodle.clear(); });
if (doodleSend) doodleSend.addEventListener('click', function () {
if (!padDoodle) return;
if (padDoodle.empty()) { toast('先画点什么吧'); return; }
var src = padDoodle.export();
if (!src) { toast('涂鸦没画出来，再试一次'); return; }
if (typeof window.chatSendDoodle !== 'function') { toast('聊天还没准备好，稍后再试'); return; }
var ok = window.chatSendDoodle(src);
if (!ok) { toast('涂鸦没发出去，再试一次'); return; }
padDoodle.clear();
closeDoodle();
toast('涂鸦已发给 TA');
scheduleTaStick(srcHash(src));
});
if (doodlePanel) {
window.addEventListener('resize', function () {
if (!doodlePanel.hidden && padDoodle) setTimeout(function () { padDoodle.resize(); }, 120);
});
}
var WORDS = ['太阳', '月亮', '星星', '彩虹', '云朵', '雨伞', '雪人', '花朵', '大树', '小猫',
'小狗', '兔子', '熊猫', '海豚', '蝴蝶', '恐龙', '乌龟', '小鸟', '苹果', '香蕉',
'西瓜', '草莓', '蛋糕', '面包', '咖啡', '火车', '气球', '风筝', '书包', '眼镜',
'电话', '时钟', '蜡烛', '钢琴', '蘑菇', '松鼠', '灯塔', '风车', '沙滩', '贝壳',
'火箭', '星球', '棒棒糖', '棉花糖', '海浪', '森林', '山谷', '雨滴', '雪花', '糖果'];
var dgPanel = document.getElementById('chat-drawguess-panel');
var dgOpen = document.getElementById('more-drawguess');
var dgClose = document.getElementById('chat-drawguess-close');
var dgName = document.getElementById('yl-dg-name');
var dgSetup = document.getElementById('yl-dg-setup');
var dgPlay = document.getElementById('yl-dg-play');
var dgGuess = document.getElementById('yl-dg-guess');
var dgResult = document.getElementById('yl-dg-result');
var dgWord = document.getElementById('yl-dg-word');
var dgWord2 = document.getElementById('yl-dg-word2');
var dgReroll = document.getElementById('yl-dg-reroll');
var dgTime = document.getElementById('yl-dg-time');
var dgStart = document.getElementById('yl-dg-start');
var dgCanvas = document.getElementById('yl-dg-canvas');
var dgColors = document.getElementById('yl-dg-colors');
var dgDesc = document.getElementById('yl-dg-desc');
var dgClear = document.getElementById('yl-dg-clear');
var dgReady = document.getElementById('yl-dg-ready');
var dgLog = document.getElementById('yl-dg-log');
var dgChatInput = document.getElementById('yl-dg-chat-input');
var dgChatSend = document.getElementById('yl-dg-chat-send');
var dgOptions = document.getElementById('yl-dg-options');
var dgCount = document.getElementById('yl-dg-count');
var dgResultEmoji = document.getElementById('yl-dg-result-emoji');
var dgResultTitle = document.getElementById('yl-dg-result-title');
var dgResultSub = document.getElementById('yl-dg-result-sub');
var dgEnd = document.getElementById('yl-dg-end');
var dgAgain = document.getElementById('yl-dg-again');
var padDg = dgCanvas ? CanvasPad(dgCanvas, { width: 3 }) : null;
if (padDg && dgColors) buildColorDots(dgColors, padDg);
var dg = { word: '', time: 20, opts: [], answer: 0, picked: -1, left: 0, tick: null, pickT: null, timerOn: false };
function dgScreen(name) {
[['setup', dgSetup], ['play', dgPlay], ['guess', dgGuess], ['result', dgResult]].forEach(function (p) {
if (p[1]) p[1].hidden = p[0] !== name;
});
}
function dgRoll() {
dg.word = pickOne(WORDS) || '太阳';
if (dgWord) dgWord.textContent = dg.word;
if (dgWord2) dgWord2.textContent = dg.word;
}
function dgBuildOptions() {
var pool = WORDS.filter(function (w) { return w !== dg.word; });
var out = [dg.word];
while (out.length < 4 && pool.length) {
var i = rnd(pool.length);
out.push(pool.splice(i, 1)[0]);
}
for (var i = out.length - 1; i > 0; i--) {
var j = rnd(i + 1), t = out[i]; out[i] = out[j]; out[j] = t;
}
dg.opts = out;
dg.answer = out.indexOf(dg.word);
}
function dgLogLine(who, text) {
if (!dgLog) return;
var d = document.createElement('div');
d.className = 'yl-dg-msg' + (who === 'ta' ? ' ta' : '');
d.innerHTML = '<b>' + (who === 'ta' ? 'TA' : '我') + '</b>' + esc(text);
dgLog.appendChild(d);
while (dgLog.children.length > 40) dgLog.removeChild(dgLog.firstChild);
dgLog.scrollTop = dgLog.scrollHeight;
}
function dgTaReply(delay) {
var t = pickLibText(26) || '嗯嗯，我在看';
setTimeout(function () { dgLogLine('ta', t); }, delay || (900 + rnd(900)));
}
function dgStopTimers() {
if (dg.tick) { clearInterval(dg.tick); dg.tick = null; }
if (dg.pickT) { clearTimeout(dg.pickT); dg.pickT = null; }
dg.timerOn = false;
}
function dgOpenPanel() {
if (!dgPanel) return;
hideMore();
dgStopTimers();
dgScreen('setup');
dgRoll();
dg.picked = -1;
if (dgLog) dgLog.innerHTML = '';
if (dgDesc) dgDesc.value = '';
if (dgChatInput) dgChatInput.value = '';
var nm = '';
try { nm = window.chatPartnerName ? window.chatPartnerName() : ''; } catch (e) {}
if (!nm) { try { nm = (document.getElementById('chat-partner-name') || {}).textContent || ''; } catch (e2) {} }
if (dgName) dgName.textContent = nm || 'TA';
dgPanel.hidden = false;
dgTaReply(1200);
}
function dgClosePanel() {
if (dgPanel) dgPanel.hidden = true;
dgStopTimers();
}
function dgStartPlay() {
dgScreen('play');
if (dgWord2) dgWord2.textContent = dg.word;
if (dgDesc) dgDesc.value = '';
if (padDg) padDg.clear();
requestAnimationFrame(function () {
if (padDg) padDg.resize();
setTimeout(function () { if (padDg && dgPlay && !dgPlay.hidden) padDg.resize(); }, 160);
});
dgTaReply(900);
}
function dgTaPick() {
if (!dg.timerOn) return;
dgStopTimers();
if (dg.picked >= 0) return;
var idx;
if (Math.random() < 0.55) idx = dg.answer;
else {
var others = [0, 1, 2, 3].filter(function (i) { return i >= 0 && i < dg.opts.length && i !== dg.answer; });
idx = pickOne(others);
if (typeof idx !== 'number') idx = dg.answer;
}
dg.picked = idx;
if (dgOptions) {
Array.prototype.forEach.call(dgOptions.children, function (b, i) {
b.classList.remove('sel');
if (i === idx) b.classList.add('sel');
if (i === dg.answer) b.classList.add('right');
});
}
dgLogLine('ta', '我猜是「' + dg.opts[idx] + '」');
setTimeout(dgShowResult, 900);
}
function dgShowResult() {
if (dg.picked < 0) return;
var right = dg.picked === dg.answer;
if (dgResultEmoji) dgResultEmoji.textContent = right ? '🎉' : '🫣';
if (dgResultTitle) dgResultTitle.textContent = right ? 'TA 猜对了！' : 'TA 猜错了';
if (dgResultSub) {
dgResultSub.textContent = right
? '这一局的答案是「' + dg.word + '」'
: 'TA 选了「' + dg.opts[dg.picked] + '」，正确答案是「' + dg.word + '」';
}
dgScreen('result');
if (!right) dgTaReply(1100);
}
function dgBeginGuess() {
if (!dg.word) dgRoll();
dgBuildOptions();
dg.picked = -1;
dgStopTimers();
if (dgOptions) {
dgOptions.innerHTML = '';
var letters = ['A', 'B', 'C', 'D'];
dg.opts.forEach(function (w, i) {
var b = document.createElement('div');
b.className = 'yl-dg-opt';
b.innerHTML = '<b>' + letters[i] + '</b>' + esc(w);
dgOptions.appendChild(b);
});
}
dgScreen('guess');
dg.time = parseInt(dgTime ? dgTime.value : '20', 10) || 20;
dg.left = dg.time;
dg.timerOn = true;
if (dgCount) dgCount.textContent = String(dg.left);
dg.tick = setInterval(function () {
dg.left--;
if (dg.left <= 0) { if (dgCount) dgCount.textContent = '0'; dgTaPick(); return; }
if (dgCount) dgCount.textContent = String(dg.left);
}, 1000);
var think = Math.max(2, Math.round(dg.time * (0.4 + Math.random() * 0.5)));
dg.pickT = setTimeout(dgTaPick, think * 1000);
}
if (dgOpen) dgOpen.addEventListener('click', function (e) { e.stopPropagation(); dgOpenPanel(); });
if (dgClose) dgClose.addEventListener('click', dgClosePanel);
if (dgReroll) dgReroll.addEventListener('click', dgRoll);
if (dgStart) dgStart.addEventListener('click', dgStartPlay);
if (dgClear) dgClear.addEventListener('click', function () { if (padDg) padDg.clear(); });
if (dgReady) dgReady.addEventListener('click', function () {
if (dgDesc) {
var d = String(dgDesc.value || '').trim();
if (d) { dgLogLine('me', d); dgDesc.value = ''; }
}
dgBeginGuess();
});
if (dgChatSend) dgChatSend.addEventListener('click', function () {
if (!dgChatInput) return;
var v = String(dgChatInput.value || '').trim();
if (!v) return;
dgChatInput.value = '';
dgLogLine('me', v);
dgTaReply();
});
if (dgChatInput) dgChatInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (dgChatSend) dgChatSend.click(); }
});
if (dgAgain) dgAgain.addEventListener('click', function () {
dgStopTimers();
dgScreen('setup');
dgRoll();
dgTaReply(900);
});
if (dgEnd) dgEnd.addEventListener('click', function () {
dgClosePanel();
});
if (dgPanel) {
window.addEventListener('resize', function () {
if (!dgPanel.hidden && dgPlay && !dgPlay.hidden && padDg) setTimeout(function () { padDg.resize(); }, 120);
});
}
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("chat-play.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("chat-play.js"); try { console.error("[JS] chat-play.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[chat-play.js] " + String(__e && __e.message || __e)); } })();