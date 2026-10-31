(function () { try {
(function () {
var COLORS = ['#111111', '#ffffff', '#e8657f', '#f7a072', '#f7d154', '#7bc96f', '#4aa8d4', '#7b6cf6', '#b06ab3', '#8b5a2b', '#9e9e9e', '#ff3b5c'];
var store = null;
try { store = window.xyStore ? window.xyStore('xy-home-v2') : null; } catch (e) { store = null; }
function toast(msg) { try { if (window.toast) window.toast(msg); } catch (e) {} }
function getStore(k, def) {
try { var v = store && store.get(k); return v === null || v === undefined || v === '' ? def : v; } catch (e) { return def; }
}
function setStore(k, v) { try { if (store) store.set(k, String(v)); } catch (e) {} }
function panelHost() {
var snake = document.getElementById('chat-snake-panel');
if (snake && snake.parentNode) return snake.parentNode;
return document.getElementById('page-chat') || document.getElementById('page-phone') || document.body;
}
var SIBLINGS = ['poke-card', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-divine-panel',
'chat-decision-panel', 'chat-gdecision-panel', 'chat-rps-panel', 'chat-rp-panel', 'chat-call-panel',
'chat-snake-panel', 'chat-pong-panel', 'chat-brick-panel', 'chat-fish-panel', 'chat-c4-panel',
'chat-memory-panel', 'chat-more-panel'];
function hideSiblings(exceptId) {
for (var i = 0; i < SIBLINGS.length; i++) {
var id = SIBLINGS[i];
if (id === exceptId) continue;
var el = document.getElementById(id);
if (el) el.hidden = true;
}
try { if (window.closeAvlib) window.closeAvlib(); } catch (e) {}
}
window.mochiSketch = function (canvas, opts) {
opts = opts || {};
var ctx = canvas.getContext('2d');
var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
var color = opts.color || '#111111';
var size = opts.size || 8;
var eraser = false;
var dirty = false;
var strokes = [];
var MAX_STROKES = 300;
var drawing = false;
var last = null;
var curStroke = null;
function strokeCtx(s) {
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.globalCompositeOperation = s.eraser ? 'destination-out' : 'source-over';
ctx.strokeStyle = s.color;
ctx.fillStyle = s.color;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.lineWidth = s.size;
}
function redraw() {
var w = canvas.width / dpr, h = canvas.height / dpr;
ctx.save();
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalCompositeOperation = 'source-over';
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.restore();
for (var i = 0; i < strokes.length; i++) {
var s = strokes[i];
if (!s.points.length) continue;
strokeCtx(s);
if (s.points.length === 1) {
ctx.beginPath();
ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
ctx.fill();
} else {
ctx.beginPath();
ctx.moveTo(s.points[0].x, s.points[0].y);
for (var j = 1; j < s.points.length; j++) ctx.lineTo(s.points[j].x, s.points[j].y);
ctx.stroke();
}
}
ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function resize() {
var rect = canvas.getBoundingClientRect();
if (!rect || rect.width < 2 || rect.height < 2) return; // 面板隐藏/未布局：别缩成 1px 再放大（晕染来源）
var w = Math.max(1, Math.round(rect.width * dpr));
var h = Math.max(1, Math.round(rect.height * dpr));
if (w === canvas.width && h === canvas.height) return;
canvas.width = w;
canvas.height = h;
redraw();
}
function start(e) {
if (canvas.hidden || drawing) return;
drawing = true;
var p = pos(e);
last = p;
curStroke = { color: color, size: size, eraser: eraser, points: [p] };
strokes.push(curStroke);
if (strokes.length > MAX_STROKES) strokes.shift();
dirty = true;
strokeCtx(curStroke);
ctx.beginPath();
ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
ctx.fill();
try { if (canvas.setPointerCapture && e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId); } catch (e2) {}
}
function move(e) {
if (!drawing || !curStroke) return;
e.preventDefault();
var p = pos(e);
var lx = last.x, ly = last.y;
if (Math.abs(p.x - lx) < 0.5 && Math.abs(p.y - ly) < 0.5) return;
last = p;
curStroke.points.push(p);
strokeCtx(curStroke);
ctx.beginPath();
ctx.moveTo(lx, ly);
ctx.lineTo(p.x, p.y);
ctx.stroke();
}
function end() {
if (!drawing) return;
drawing = false;
last = null;
curStroke = null;
}
function pos(e) {
var r = canvas.getBoundingClientRect();
var cx = e.clientX, cy = e.clientY;
if (e.touches && e.touches.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
else if (e.changedTouches && e.changedTouches.length) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
return { x: cx - r.left, y: cy - r.top };
}
if (window.PointerEvent) {
canvas.addEventListener('pointerdown', start);
canvas.addEventListener('pointermove', move);
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('pointerleave', end);
} else {
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); start(e); }, { passive: false });
canvas.addEventListener('touchmove', function (e) { e.preventDefault(); move(e); }, { passive: false });
canvas.addEventListener('touchend', end);
canvas.addEventListener('touchcancel', end);
canvas.addEventListener('mousedown', start);
canvas.addEventListener('mousemove', move);
canvas.addEventListener('mouseup', end);
canvas.addEventListener('mouseleave', end);
}
canvas.addEventListener('dragstart', function (e) { e.preventDefault(); });
var rt = null;
if (window.ResizeObserver) {
try { new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(resize, 120); }).observe(canvas); } catch (e) {}
}
window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 160); });
setTimeout(resize, 30);
return {
resize: resize,
clear: function () {
try { strokes = []; dirty = false; redraw(); } catch (e) {}
},
undo: function () {
if (!strokes.length) return false;
strokes.pop();
dirty = strokes.length > 0;
redraw();
return true;
},
isEmpty: function () { return !dirty || !strokes.length; },
setColor: function (c) { color = c || '#111111'; eraser = false; },
setSize: function (n) { var v = Number(n); if (v > 0) size = v; },
setEraser: function (on) { eraser = !!on; },
isEraser: function () { return eraser; },
exportDataURL: function (maxSide) {
if (!dirty) return '';
try {
var m = maxSide || 1080;
var scale = Math.min(1, m / Math.max(canvas.width, canvas.height));
var w = Math.max(1, Math.round(canvas.width * scale));
var h = Math.max(1, Math.round(canvas.height * scale));
var off = document.createElement('canvas');
off.width = w; off.height = h;
var oc = off.getContext('2d');
oc.fillStyle = '#ffffff';
oc.fillRect(0, 0, w, h);
oc.drawImage(canvas, 0, 0, w, h);
return off.toDataURL('image/jpeg', 0.88);
} catch (e) { return ''; }
}
};
};
function colorSwatches(box, onPick) {
box.innerHTML = '';
COLORS.forEach(function (c, i) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'doodle-swatch' + (i === 0 ? ' sel' : '');
b.style.background = c;
b.setAttribute('data-color', c);
b.addEventListener('click', function (e) {
e.stopPropagation();
box.querySelectorAll('.doodle-swatch').forEach(function (n) { n.classList.remove('sel'); });
b.classList.add('sel');
onPick(c);
});
box.appendChild(b);
});
var custom = document.createElement('label');
custom.className = 'doodle-swatch custom';
custom.title = '自定义颜色';
custom.textContent = '＋';
var inp = document.createElement('input');
inp.type = 'color';
inp.value = '#e8657f';
inp.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
inp.addEventListener('input', function () {
box.querySelectorAll('.doodle-swatch').forEach(function (n) { n.classList.remove('sel'); });
custom.classList.add('sel');
onPick(inp.value);
});
custom.appendChild(inp);
custom.addEventListener('click', function (e) { e.stopPropagation(); try { inp.click(); } catch (err) {} });
box.appendChild(custom);
}
var dPanel = document.createElement('div');
dPanel.className = 'poke-card xy-big doodle-panel';
dPanel.id = 'chat-doodle-panel';
dPanel.hidden = true;
dPanel.innerHTML =
'<div class="poke-card-head">' +
'<span>涂鸦</span>' +
'<span class="xy-head-actions">' +
'<button class="xy-icon-btn" type="button" id="doodle-undo">撤销</button>' +
'<button class="xy-icon-btn" type="button" id="doodle-clear">清空</button>' +
'<button class="xy-icon-btn" type="button" id="doodle-eraser">橡皮</button>' +
'<button class="xy-icon-btn" type="button" id="doodle-close">关闭</button>' +
'</span>' +
'</div>' +
'<div class="doodle-canvas-wrap"><canvas id="doodle-canvas"></canvas></div>' +
'<div class="doodle-tools">' +
'<div class="doodle-colors" id="doodle-colors"></div>' +
'<label class="doodle-size">粗细<input type="range" id="doodle-size" min="2" max="26" value="8"></label>' +
'</div>' +
'<div class="doodle-foot">' +
'<input class="doodle-caption" id="doodle-caption" maxlength="40" placeholder="说点什么（可不填）">' +
'<button class="doodle-send" type="button" id="doodle-send">发给 TA</button>' +
'</div>';
panelHost().appendChild(dPanel);
var dCanvas = dPanel.querySelector('#doodle-canvas');
var sketch = window.mochiSketch(dCanvas, { color: COLORS[0], size: 8 });
colorSwatches(dPanel.querySelector('#doodle-colors'), function (c) {
sketch.setColor(c);
dPanel.querySelector('#doodle-eraser').classList.remove('sel');
});
dPanel.querySelector('#doodle-size').addEventListener('input', function () {
sketch.setSize(Number(this.value));
});
dPanel.querySelector('#doodle-eraser').addEventListener('click', function () {
var on = !sketch.isEraser();
sketch.setEraser(on);
this.classList.toggle('sel', on);
toast(on ? '橡皮：开' : '橡皮：关');
});
dPanel.querySelector('#doodle-undo').addEventListener('click', function () {
if (!sketch.undo()) toast('没有可撤销的笔画了');
});
dPanel.querySelector('#doodle-clear').addEventListener('click', function () {
sketch.clear();
toast('已清空');
});
dPanel.querySelector('#doodle-close').addEventListener('click', function () { closeDoodle(); });
dPanel.querySelector('#doodle-send').addEventListener('click', function () {
if (sketch.isEmpty()) { toast('先画点什么再发送吧'); return; }
var url = sketch.exportDataURL(1080);
if (!url) { toast('画得有点大，再试一次'); return; }
var cap = (dPanel.querySelector('#doodle-caption').value || '').trim();
var ok = false;
try { ok = window.chatSendImg ? window.chatSendImg(url, cap) : false; } catch (e) { ok = false; }
if (!ok) { toast('聊天还没准备好，稍后再试'); return; }
toast('涂鸦已发给 TA');
closeDoodle();
});
function openDoodle() {
hideSiblings('chat-doodle-panel');
var mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
if (dPanel.parentNode !== panelHost()) panelHost().appendChild(dPanel);
dPanel.hidden = false;
try { sketch.resize(); } catch (e) {}
}
function closeDoodle() { dPanel.hidden = true; }
window.openDoodlePanel = openDoodle;
window.closeDoodlePanel = closeDoodle;
var doodleBtn = document.getElementById('more-doodle');
if (doodleBtn) {
doodleBtn.addEventListener('click', function (e) {
e.stopPropagation();
try { openDoodle(); } catch (err) { dPanel.hidden = false; }
});
}
var WORD_BANK = [
['动物', ['猫', '狗', '兔子', '大象', '长颈鹿', '熊猫', '鱼', '小鸟', '蛇', '老虎', '猴子', '企鹅', '蝴蝶', '螃蟹']],
['食物', ['苹果', '香蕉', '西瓜', '蛋糕', '面条', '汉堡', '冰淇淋', '咖啡', '米饭', '火锅', '草莓', '饺子', '披萨', '棒棒糖']],
['生活', ['雨伞', '眼镜', '手机', '电脑', '钥匙', '牙刷', '台灯', '椅子', '自行车', '风筝', '闹钟', '背包', '水杯', '剪刀']],
['自然', ['太阳', '月亮', '星星', '彩虹', '云朵', '大山', '大树', '花朵', '雪人', '海浪', '闪电', '落叶', '小草', '河流']],
['动作', ['跑步', '睡觉', '跳舞', '唱歌', '游泳', '吃饭', '看书', '打球', '走路', '大笑', '刷牙', '做饭', '写字', '洗手']]
];
var DEF_CHAT_LINES = ['我先猜这个', '等一下，让我想想', '画得好像啊', '这个有点难', '我选好了', '你别偷看答案哦'];
var DD_KEYS = ['A', 'B', 'C', 'D'];
var gPanel = document.createElement('div');
gPanel.className = 'poke-card xy-big dg-panel';
gPanel.id = 'chat-drawguess-panel';
gPanel.hidden = true;
gPanel.innerHTML =
'<div class="poke-card-head">' +
'<span>你画我猜</span>' +
'<span class="xy-head-actions">' +
'<button class="xy-icon-btn" type="button" id="dg-undo">撤回</button>' +
'<button class="xy-icon-btn" type="button" id="dg-newword">换词</button>' +
'<button class="xy-icon-btn" type="button" id="dg-close">关闭</button>' +
'</span>' +
'</div>' +
'<div class="dg-scroll">' +
'<div class="dg-word" id="dg-wordbox">' +
'<span class="dg-word-label">本轮词语</span>' +
'<span class="dg-word-val" id="dg-wordval">—</span>' +
'<button class="xy-icon-btn" type="button" id="dg-hideword">遮住</button>' +
'</div>' +
'<div class="dg-tabs">' +
'<button class="dg-tab sel" type="button" data-dgmode="draw">画给他看</button>' +
'<button class="dg-tab" type="button" data-dgmode="desc">用话描述</button>' +
'</div>' +
'<div class="dg-canvas-wrap" id="dg-canvaswrap"><canvas id="dg-canvas"></canvas></div>' +
'<textarea class="dg-desc" id="dg-desc" maxlength="120" placeholder="用一句话描述它（别直接写答案）" hidden></textarea>' +
'<div class="dg-options" id="dg-options"></div>' +
'<div class="dg-timer-row"><div class="dg-timer-bar"><div class="dg-timer-fill" id="dg-timerfill"></div></div><span class="dg-timer-num" id="dg-timernum">—</span></div>' +
'<div class="dg-result" id="dg-result">选好词，画或描述，然后发题给 TA。</div>' +
'<div class="dg-think-set">TA 思考时间<input type="number" id="dg-thinks" min="10" max="180" step="5"><span>秒</span>' +
'<button class="xy-icon-btn" type="button" id="dg-start">发题给 TA</button></div>' +
'<div class="dg-chat">' +
'<div class="dg-chat-head"><span>TA 的碎碎念（字卡）</span><button class="xy-icon-btn" type="button" id="dg-tease">让 TA 说一句</button></div>' +
'<div class="dg-chat-list" id="dg-chatlist"></div>' +
'<div class="dg-chat-input"><input id="dg-chattext" maxlength="40" placeholder="我也说一句"><button type="button" id="dg-chatsend">发送</button></div>' +
'</div>' +
'</div>';
panelHost().appendChild(gPanel);
var gCanvas = gPanel.querySelector('#dg-canvas');
var gSketch = window.mochiSketch(gCanvas, { color: COLORS[0], size: 8 });
colorSwatches((function () {
var box = document.createElement('div');
box.className = 'doodle-colors';
var wrap = gPanel.querySelector('#dg-canvaswrap');
wrap.parentNode.insertBefore(box, wrap.nextSibling);
return box;
})(), function (c) { gSketch.setColor(c); });
var dgMode = 'draw';
var dgWord = '';
var dgCat = '';
var dgOptions = [];
var dgCorrectIdx = 0;
var dgRunning = false;
var dgThinkSecs = Math.max(10, Math.min(180, Number(getStore('dg-think-secs', 30)) || 30));
var dgThinkTimer = null;
var dgPickTimer = null;
var dgStartAt = 0;
var dgRoundDone = false;
var dgChatTimer = null;
function newWord() {
var g = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
dgCat = g[0];
var arr = g[1].slice();
dgWord = arr[Math.floor(Math.random() * arr.length)];
var pool = g[1].filter(function (w) { return w !== dgWord; });
shuffle(pool);
dgOptions = [dgWord].concat(pool.slice(0, 3));
shuffle(dgOptions);
dgCorrectIdx = dgOptions.indexOf(dgWord);
renderWord();
renderOptions();
}
function shuffle(a) {
for (var i = a.length - 1; i > 0; i--) {
var j = Math.floor(Math.random() * (i + 1));
var t = a[i]; a[i] = a[j]; a[j] = t;
}
return a;
}
function renderWord() {
var el = gPanel.querySelector('#dg-wordval');
if (el) el.textContent = dgWord || '—';
}
function renderOptions() {
var box = gPanel.querySelector('#dg-options');
box.innerHTML = '';
dgOptions.forEach(function (w, i) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'dg-opt';
b.setAttribute('data-idx', String(i));
b.innerHTML = '<span class="dg-k">' + DD_KEYS[i] + '.</span>' + escapeHtml(w);
box.appendChild(b);
});
}
function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, function (c) {
return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
});
}
gPanel.querySelectorAll('.dg-tab').forEach(function (t) {
t.addEventListener('click', function () {
dgMode = t.getAttribute('data-dgmode') || 'draw';
gPanel.querySelectorAll('.dg-tab').forEach(function (n) { n.classList.toggle('sel', n === t); });
var isDraw = dgMode === 'draw';
gPanel.querySelector('#dg-canvaswrap').hidden = !isDraw;
gPanel.querySelector('#dg-desc').hidden = isDraw;
if (isDraw) { try { gSketch.resize(); } catch (e) {} }
});
});
gPanel.querySelector('#dg-undo').addEventListener('click', function () {
if (!gSketch.undo()) { toast('没有可撤回的笔画了'); return; }
toast('已撤回上一笔');
});
gPanel.querySelector('#dg-newword').addEventListener('click', function () {
if (dgRunning) { toast('先等 TA 猜完这一轮'); return; }
newWord();
try { gSketch.clear(); } catch (e) {}
dgRoundDone = false;
gPanel.querySelector('#dg-start').textContent = '发题给 TA';
toast('换了一个词');
});
gPanel.querySelector('#dg-hideword').addEventListener('click', function () {
var box = gPanel.querySelector('#dg-wordbox');
var hidden = box.classList.toggle('hide-word');
this.textContent = hidden ? '显示' : '遮住';
});
var thinkInput = gPanel.querySelector('#dg-thinks');
thinkInput.value = String(dgThinkSecs);
thinkInput.addEventListener('change', function () {
var v = Number(this.value);
if (!v || isNaN(v)) v = 30;
v = Math.max(10, Math.min(180, Math.round(v)));
this.value = String(v);
dgThinkSecs = v;
setStore('dg-think-secs', v);
});
gPanel.querySelector('#dg-close').addEventListener('click', function () { closeDrawGuess(); });
gPanel.querySelector('#dg-start').addEventListener('click', function () {
if (dgRunning) { toast('这一轮还没结束'); return; }
if (dgRoundDone) {
newWord();
try { gSketch.clear(); } catch (e) {}
gPanel.querySelector('#dg-desc').value = '';
dgRoundDone = false;
this.textContent = '发题给 TA';
}
sendQuestion();
});
function sendQuestion() {
if (!dgWord) { newWord(); }
var hint = '';
if (dgMode === 'draw') {
if (gSketch.isEmpty()) { toast('先画点什么，或者切到「用话描述」'); return; }
var url = gSketch.exportDataURL(900);
var ok = false;
try { ok = window.chatSendImg ? window.chatSendImg(url, '我画好了，猜猜是什么？') : false; } catch (e) { ok = false; }
if (!ok) { toast('聊天还没准备好，稍后再试'); return; }
hint = '我画好了，猜猜是什么？';
} else {
var desc = (gPanel.querySelector('#dg-desc').value || '').trim();
if (!desc) { toast('写一句描述再发题'); return; }
try { if (window.chatSendMsg) window.chatSendMsg('提示：' + desc + ' 猜猜是什么？'); } catch (e) {}
hint = '提示：' + desc;
}
startRound(hint);
}
function startRound(hint) {
dgRunning = true;
dgStartAt = Date.now();
var res = gPanel.querySelector('#dg-result');
res.textContent = 'TA 正在想…（限时 ' + dgThinkSecs + ' 秒）';
gPanel.querySelectorAll('.dg-opt').forEach(function (n) { n.classList.remove('ta-pick', 'right', 'wrong', 'dim'); });
var pickDelay = Math.max(1200, dgThinkSecs * 1000 * (0.32 + Math.random() * 0.5));
dgPickTimer = setTimeout(function () { taPick(false); }, pickDelay);
var total = dgThinkSecs * 1000;
clearInterval(dgThinkTimer);
dgThinkTimer = setInterval(function () {
var left = total - (Date.now() - dgStartAt);
if (left <= 0) { left = 0; }
var pct = Math.max(0, Math.min(100, left / total * 100));
var fill = gPanel.querySelector('#dg-timerfill');
var num = gPanel.querySelector('#dg-timernum');
if (fill) fill.style.width = pct + '%';
if (num) num.textContent = Math.ceil(left / 1000) + 's';
if (left <= 0) { taPick(true); }
}, 200);
}
function taPick(timeout) {
if (!dgRunning) return;
dgRunning = false;
clearTimeout(dgPickTimer);
dgPickTimer = null;
clearInterval(dgThinkTimer);
dgThinkTimer = null;
var pick;
if (timeout) {
pick = 0;
} else {
var right = Math.random() < 0.62;
pick = right ? dgCorrectIdx : (dgCorrectIdx + 1 + Math.floor(Math.random() * 3)) % 4;
}
var opts = gPanel.querySelectorAll('.dg-opt');
opts.forEach(function (n, i) {
n.classList.add('dim');
if (i === pick) n.classList.add('ta-pick');
if (i === dgCorrectIdx) n.classList.add('right');
if (i === pick && i !== dgCorrectIdx) n.classList.add('wrong');
});
var correct = dgOptions[dgCorrectIdx];
var picked = dgOptions[pick];
var resultTxt;
var chatTxt;
if (timeout && pick === 0) {
resultTxt = '超时了，TA 没来得及选。正确答案：' + correct;
chatTxt = '你画我猜 · TA 超时没选出来，正确答案是「' + correct + '」';
} else if (pick === dgCorrectIdx) {
resultTxt = 'TA 猜对了！答案是「' + correct + '」';
chatTxt = '你画我猜 · TA 猜对了：' + correct;
} else {
resultTxt = 'TA 选了「' + picked + '」，正确答案是「' + correct + '」';
chatTxt = '你画我猜 · TA 猜成了「' + picked + '」，正确答案是「' + correct + '」';
}
gPanel.querySelector('#dg-result').textContent = resultTxt;
gPanel.querySelector('#dg-timerfill').style.width = '0%';
gPanel.querySelector('#dg-timernum').textContent = '0s';
dgRoundDone = true;
try {
if (window.chatAddIn) window.chatAddIn(chatTxt, { special: 'poke', nightAllow: true, rateAllow: true });
} catch (e) {}
setTimeout(function () {
var startBtn = gPanel.querySelector('#dg-start');
if (startBtn) startBtn.textContent = '再来一轮';
}, 200);
}
function textOnly(c) {
if (typeof c !== 'string') return false;
if (!c.trim()) return false;
if (/^(data:|@@m:|https?:)/i.test(c)) return false;
if (c.indexOf('|||') >= 0) return false;
return c.length <= 32;
}
function cardPool() {
var out = [];
try {
if (window.getDefaultCardGroups) {
var gs = window.getDefaultCardGroups('main') || [];
for (var i = 0; i < gs.length && i < 12; i++) {
var g = gs[Math.floor(Math.random() * gs.length)];
if (!g || !g[1]) continue;
for (var j = 0; j < g[1].length; j++) if (textOnly(g[1][j])) out.push(g[1][j]);
}
}
} catch (e) {}
try {
if (window.getCustomCards) {
var cc = window.getCustomCards() || [];
for (var k = 0; k < cc.length; k++) if (textOnly(cc[k])) out.push(cc[k]);
}
} catch (e) {}
return out.length ? out : DEF_CHAT_LINES.slice();
}
var chatSeq = 0;
function addChatLine(text, mine) {
var list = gPanel.querySelector('#dg-chatlist');
if (!list) return;
var d = document.createElement('div');
d.className = 'dg-chat-msg' + (mine ? ' mine' : '');
d.textContent = text;
list.appendChild(d);
chatSeq++;
while (list.children.length > 40) list.removeChild(list.firstChild);
list.scrollTop = list.scrollHeight;
}
function taSay() {
var pool = cardPool();
var line = pool[Math.floor(Math.random() * pool.length)] || '我在看呢';
if (line.length > 30) line = line.slice(0, 30);
addChatLine(line, false);
}
gPanel.querySelector('#dg-tease').addEventListener('click', function () { taSay(); });
gPanel.querySelector('#dg-chatsend').addEventListener('click', function () {
var inp = gPanel.querySelector('#dg-chattext');
var t = (inp.value || '').trim();
if (!t) return;
addChatLine(t, true);
inp.value = '';
setTimeout(function () {
var pool = cardPool();
addChatLine(pool[Math.floor(Math.random() * pool.length)] || '嗯嗯，我在', false);
}, 700 + Math.random() * 900);
});
gPanel.querySelector('#dg-chattext').addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); gPanel.querySelector('#dg-chatsend').click(); }
});
function startChatTicker() {
stopChatTicker();
dgChatTimer = setInterval(function () {
if (gPanel.hidden) return;
if (document.hidden) return;
taSay();
}, 9000 + Math.random() * 6000);
}
function stopChatTicker() { if (dgChatTimer) { clearInterval(dgChatTimer); dgChatTimer = null; } }
function openDrawGuess() {
hideSiblings('chat-drawguess-panel');
var mp = document.getElementById('chat-more-panel');
if (mp) mp.hidden = true;
if (gPanel.parentNode !== panelHost()) panelHost().appendChild(gPanel);
gPanel.hidden = false;
if (!dgWord) newWord();
try { gSketch.resize(); } catch (e) {}
if (dgRoundDone) gPanel.querySelector('#dg-start').textContent = '再来一轮';
startChatTicker();
setTimeout(taSay, 600);
}
function closeDrawGuess() {
gPanel.hidden = true;
// 关掉面板不算中断：本轮继续走，TA 到点照常选，重新打开时倒计时接着走（不刷新）
stopChatTicker();
}
function resetDrawGuess() {
gPanel.hidden = true;
dgRunning = false;
dgRoundDone = false;
clearTimeout(dgPickTimer);
dgPickTimer = null;
clearInterval(dgThinkTimer);
dgThinkTimer = null;
stopChatTicker();
try { gSketch.clear(); } catch (e) {}
var st = gPanel.querySelector('#dg-start');
if (st) st.textContent = '发题给 TA';
var fill = gPanel.querySelector('#dg-timerfill');
if (fill) fill.style.width = '100%';
var num = gPanel.querySelector('#dg-timernum');
if (num) num.textContent = '—';
}
window.openDrawGuessPanel = openDrawGuess;
window.closeDrawGuessPanel = closeDrawGuess;
var dgBtn = document.getElementById('more-drawguess');
if (dgBtn) {
dgBtn.addEventListener('click', function (e) {
e.stopPropagation();
try { openDrawGuess(); } catch (err) { gPanel.hidden = false; }
});
}
try {
if (window.MutationObserver) {
var mo = new MutationObserver(function () {
if (!dPanel.hidden) {
for (var i = 0; i < SIBLINGS.length; i++) {
if (SIBLINGS[i] === 'chat-doodle-panel' || SIBLINGS[i] === 'chat-drawguess-panel') continue;
var el = document.getElementById(SIBLINGS[i]);
if (el && !el.hidden) { closeDoodle(); break; }
}
}
if (!gPanel.hidden) {
for (var j = 0; j < SIBLINGS.length; j++) {
var el2 = document.getElementById(SIBLINGS[j]);
if (el2 && !el2.hidden && el2 !== gPanel) { closeDrawGuess(); break; }
}
}
});
SIBLINGS.forEach(function (id) {
var el = document.getElementById(id);
if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
});
}
} catch (e) {}
document.addEventListener('contact-switched', function () {
try { closeDoodle(); } catch (e) {}
try { resetDrawGuess(); } catch (e) {}
});
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("play-features.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("play-features.js"); try { console.error("[JS] play-features.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[play-features.js] " + String(__e && __e.message || __e)); } })();