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
var freqPanel = document.getElementById('chat-freq-panel');
var freqBtn = document.getElementById('more-freq');
var freqPct = document.getElementById('yl-freq-pct');
var freqFill = document.getElementById('yl-freq-fill');
var freqStatus = document.getElementById('yl-freq-status');
var freqMeta = document.getElementById('yl-freq-meta');
var freqRefresh = document.getElementById('yl-freq-refresh');
var freqClose = document.getElementById('chat-freq-close');
var freqTimer = null, freqN = 0;
function freqStatusText(p) {
if (p >= 85) return '链接能量很稳，像被轻轻托住';
if (p >= 70) return '链接平稳流动，彼此都在线';
if (p >= 55) return '有一点起伏，但还连得很紧';
if (p >= 40) return '能量在轻轻晃动，慢一点就好';
if (p >= 25) return '信号偏低，像隔着一层雾';
return '这一刻很安静，等一等会回来';
}
function runFreq() {
if (!freqPct) return;
clearTimeout(freqTimer);
freqN++;
var target = 12 + Math.floor(Math.random() * 88); // 纯随机，不可调整
var cur = 0;
freqPct.textContent = '0';
if (freqFill) freqFill.style.width = '0%';
if (freqStatus) freqStatus.textContent = '正在感知链接能量…';
if (freqMeta) freqMeta.textContent = '';
var steps = 16 + Math.floor(Math.random() * 8);
var i = 0;
function tick() {
i++;
var left = steps - i;
var next = Math.round(target * (1 - Math.pow(left / steps, 2)));
if (next > cur) cur = next;
if (i >= steps) cur = target;
freqPct.textContent = String(cur);
if (freqFill) freqFill.style.width = cur + '%';
if (i < steps) {
freqTimer = setTimeout(tick, 45 + Math.random() * 55);
} else {
if (freqStatus) freqStatus.textContent = freqStatusText(target);
if (freqMeta) {
var d = new Date();
var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
freqMeta.textContent = '第 ' + freqN + ' 次观测 · ' + hh + ':' + mm;
}
}
}
tick();
}
function openFreq() {
if (!freqPanel) return;
hideMore();
freqPanel.hidden = false;
runFreq();
}
if (freqBtn) freqBtn.addEventListener('click', function (e) { e.stopPropagation(); openFreq(); });
if (freqClose) freqClose.addEventListener('click', function () { freqPanel.hidden = true; clearTimeout(freqTimer); });
if (freqRefresh) freqRefresh.addEventListener('click', runFreq);
var input = document.getElementById('chat-input');
var sendBtn = document.getElementById('chat-send');
var trash = document.getElementById('chat-cardmode-trash');
var cmPanel = document.getElementById('chat-cardmode-panel');
var cmList = document.getElementById('chat-cardmode-list');
var cmSearch = document.getElementById('chat-cardmode-search');
var cmClose = document.getElementById('chat-cardmode-close');
var cmBtn = document.getElementById('more-cardmode');
var cmOn = false;
function cardPool() {
var out = [];
try {
var own = window.getCustomCards && window.getCustomCards();
if (own && own.length) out = out.concat(own);
} catch (e) {}
return out.filter(function (s) {
return typeof s === 'string' && s && s.indexOf('data:') !== 0 && s.indexOf('@@m:') !== 0 && s.indexOf('|||') < 0;
});
}
function renderCmList() {
if (!cmList) return;
var q = cmSearch ? String(cmSearch.value || '').trim().toLowerCase() : '';
var pool = cardPool().filter(function (s) { return !q || s.toLowerCase().indexOf(q) >= 0; });
cmList.innerHTML = '';
if (!pool.length) {
var empty = document.createElement('div');
empty.className = 'yl-cm-empty';
empty.textContent = q ? '没有匹配的字卡' : '还没有「我的字卡」\n到 字卡库 → 主字卡 里添加';
empty.style.whiteSpace = 'pre-line';
cmList.appendChild(empty);
return;
}
pool.slice(0, 300).forEach(function (card) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'yl-cm-item';
b.textContent = card;
b.addEventListener('click', function () {
if (input) input.textContent = card;
if (cmPanel) cmPanel.hidden = true;
syncTrash();
try { if (window.logFish) window.logFish(); } catch (e) {}
});
cmList.appendChild(b);
});
}
function syncTrash() {
if (!trash || !input) return;
var has = String(input.textContent || '').trim().length > 0;
var want = cmOn && has;
if (trash.hidden === !want) return;
trash.hidden = !want;
}
function openCmPanel() {
if (!cmPanel) return;
renderCmList();
if (cmSearch) cmSearch.value = '';
cmPanel.hidden = false;
try { if (cmSearch) cmSearch.focus(); } catch (e) {}
}
function setCmOn(on, silent) {
cmOn = !!on;
try { store().set('yl-card-mode', cmOn ? '1' : '0'); } catch (e) {}
if (input) {
input.classList.toggle('yl-cm-on', cmOn);
input.setAttribute('contenteditable', cmOn ? 'false' : 'true');
input.setAttribute('inputmode', cmOn ? 'none' : 'text');
if (cmOn) {
input.setAttribute('data-cm-ph', '点这里放入一张字卡');
try { input.blur(); } catch (e) {}
} else {
input.removeAttribute('data-cm-ph');
input.textContent = '';
try { input.focus(); } catch (e) {}
}
}
if (!cmOn && cmPanel) cmPanel.hidden = true;
syncTrash();
try {
if (cmBtn) cmBtn.classList.toggle('yl-on', cmOn);
if (!silent) toast(cmOn ? '字卡模式已开启：点输入框选字卡' : '字卡模式已关闭：可以正常打字了');
} catch (e) {}
if (cmOn && !silent) openCmPanel();
}
if (cmBtn) cmBtn.addEventListener('click', function (e) {
e.stopPropagation();
hideMore();
setCmOn(!cmOn);
});
if (input) {
input.addEventListener('pointerdown', function (e) {
if (!cmOn) return;
e.preventDefault();
e.stopPropagation();
openCmPanel();
}, true);
input.addEventListener('focus', function () {
if (!cmOn) return;
try { input.blur(); } catch (err) {}
});
input.addEventListener('keydown', function (e) {
if (cmOn) { e.preventDefault(); }
}, true);
}
if (cmSearch) cmSearch.addEventListener('input', renderCmList);
if (cmClose) cmClose.addEventListener('click', function () { if (cmPanel) cmPanel.hidden = true; });
if (trash) trash.addEventListener('click', function (e) {
e.stopPropagation();
if (!input) return;
input.textContent = '';
syncTrash();
try { input.blur(); } catch (err) {}
});
if (sendBtn) sendBtn.addEventListener('click', function () {
setTimeout(syncTrash, 60);
setTimeout(syncTrash, 260);
});
if (input) {
try {
new MutationObserver(syncTrash).observe(input, { childList: true, characterData: true, subtree: true });
} catch (e) {}
}
document.addEventListener('contact-switched', function () {
setTimeout(function () {
if (input) {
input.setAttribute('contenteditable', cmOn ? 'false' : 'true');
input.setAttribute('inputmode', cmOn ? 'none' : 'text');
input.classList.toggle('yl-cm-on', cmOn);
if (cmOn) input.setAttribute('data-cm-ph', '点这里放入一张字卡');
}
syncTrash();
}, 80);
});
try {
var saved = store().get('yl-card-mode') === '1';
if (saved) setTimeout(function () { setCmOn(true, true); }, 600);
} catch (e) {}
window.__ylFreqOpen = openFreq;
window.__ylCardMode = { on: function () { setCmOn(true); }, off: function () { setCmOn(false); }, isOn: function () { return cmOn; } };
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("link-freq.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("link-freq.js"); try { console.error("[JS] link-freq.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[link-freq.js] " + String(__e && __e.message || __e)); } })();