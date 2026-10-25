(function () { try {
/* ===== 功能：字卡模式（聊天输入栏） =====
入口：聊天输入栏右侧「字卡」按钮（注入 .chat-input-row，data-io="cardmode" 排在发送前）。
语义：开启后把 #chat-input 设为不可编辑（contenteditable=false + inputmode=none），
输入法弹不出来；只能点字卡把内容发出去。关闭即恢复输入框与输入法。
数据：我的字卡＝chatcard.js getCustomCardsFor(当前联系人)；预设字卡＝default-cards.js
getDefaultCardGroups('main')。图片字卡走 media-pool 令牌扩展后交给 chatSendImg。
====================================================== */
(function () {
'use strict';
var row = document.querySelector('#page-chat .chat-input-row');
var input = document.getElementById('chat-input');
var page = document.getElementById('page-chat');
if (!row || !input || !page) return;
var btn = document.createElement('button');
btn.className = 'ch-input-btn';
btn.id = 'chat-cardmode-btn';
btn.type = 'button';
btn.title = '字卡模式（只能发字卡）';
btn.setAttribute('data-io', 'cardmode');
btn.style.order = '990';   // 紧挨发送按钮左侧；不参与 chat.js 的输入栏排序表
btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="14" rx="2.5"/><path d="M8 3h10a2.5 2.5 0 012.5 2.5V17"/><path d="M6.5 11h6M6.5 15h4"/></svg>';
var send = row.querySelector('#chat-send');
row.insertBefore(btn, send || null);
var panel = document.createElement('div');
panel.className = 'poke-card cm-panel';
panel.id = 'chat-cardmode-panel';
panel.hidden = true;
panel.innerHTML =
'<div class="poke-card-head">' +
'<span>字卡模式</span>' +
'<span class="poke-card-head-actions">' +
'<button type="button" class="cm-tab sel" data-cm="mine">我的字卡</button>' +
'<button type="button" class="cm-tab" data-cm="preset">预设字卡</button>' +
'<button type="button" class="poke-card-close" id="cm-close">✕</button>' +
'</span>' +
'</div>' +
'<div class="cm-hint">输入法已停用：点一张字卡发出去，退出字卡模式才能打字</div>' +
'<div class="poke-card-scroll cm-grid" id="cm-grid"></div>';
page.appendChild(panel);
var grid = panel.querySelector('#cm-grid');
var tab = 'mine';
var on = false;
var SIBLINGS = ['chat-more-panel', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-doodle-panel', 'chat-drawguess-panel'];
function toast(msg) { try { if (window.toast) window.toast(msg); } catch (e) {} }
function cid() { try { return window.__activeCid || 'default'; } catch (e) { return 'default'; } }
function isImg(c) {
if (typeof c !== 'string') return false;
if (c.indexOf('data:image') === 0) return true;
try { return !!(window.mochiMediaIsToken && window.mochiMediaIsToken(c)); } catch (e) { return false; }
}
function textOf(c) {
if (typeof c !== 'string') return '';
var first = c.split('|||')[0];
return (first || '').trim();
}
function imgSrc(c) {
if (c.indexOf('data:image') === 0) return c;
try { return (window.mochiMediaExpand && window.mochiMediaExpand(c)) || ''; } catch (e) { return ''; }
}
function myCards() {
var out = [];
try { out = (window.getCustomCardsFor ? window.getCustomCardsFor(cid()) : []) || []; } catch (e) { out = []; }
return out;
}
function presetCards() {
var out = [];
try {
var gs = (window.getDefaultCardGroups && window.getDefaultCardGroups('main')) || [];
gs.forEach(function (g) {
var arr = (g && g[1]) || [];
for (var i = 0; i < arr.length; i++) out.push(arr[i]);
});
} catch (e) {}
return out;
}
function render() {
var list = tab === 'mine' ? myCards() : presetCards();
var seen = {};
var n = 0;
grid.innerHTML = '';
for (var i = 0; i < list.length && n < 300; i++) {
var c = list[i];
if (typeof c !== 'string') continue;
var key;
if (isImg(c)) { key = c; }
else {
var t = textOf(c);
if (!t) continue;
key = 't:' + t;
}
if (seen[key]) continue;
seen[key] = 1;
n++;
var chip = document.createElement('button');
chip.type = 'button';
chip.className = 'cm-chip' + (isImg(c) ? ' img' : '');
chip.setAttribute('data-card', c);
if (isImg(c)) {
var src = imgSrc(c);
if (src) {
var im = document.createElement('img');
im.src = src;
im.alt = '图片字卡';
im.loading = 'lazy';
chip.appendChild(im);
} else {
chip.textContent = '图片字卡';
}
} else {
chip.textContent = textOf(c);
}
grid.appendChild(chip);
}
if (!n) {
var empty = document.createElement('div');
empty.className = 'cm-empty';
empty.textContent = tab === 'mine'
? '这个联系人还没有自定义字卡，去「字卡库」加几张，或切到「预设字卡」先用着。'
: '系统预设字卡一栏是空的（可能被分类开关全部关掉了）。';
grid.appendChild(empty);
}
}
function sendCard(c) {
var ok = false;
if (isImg(c)) {
var src = imgSrc(c);
if (!src) { toast('这张图片字卡还没取到，稍后再试'); return; }
try { ok = window.chatSendImg ? window.chatSendImg(src, '') : false; } catch (e) { ok = false; }
} else {
var t = textOf(c);
if (!t) return;
try { ok = window.chatSendMsg ? (window.chatSendMsg(t), true) : false; } catch (e) { ok = false; }
}
if (!ok) { toast('聊天还没准备好，稍后再试'); return; }
toast('字卡已发出');
}
function setMode(next) {
on = !!next;
btn.classList.toggle('on', on);
row.classList.toggle('cardmode-on', on);
if (on) {
SIBLINGS.forEach(function (id) {
var el = document.getElementById(id);
if (el) el.hidden = true;
});
try { input.blur(); } catch (e) {}
input.setAttribute('contenteditable', 'false');
input.setAttribute('inputmode', 'none');
input.setAttribute('data-ph', '字卡模式：只能发字卡');
try { input.textContent = ''; } catch (e) {}
panel.hidden = false;
render();
} else {
input.setAttribute('contenteditable', 'true');
input.removeAttribute('inputmode');
input.setAttribute('data-ph', '说点什么…');
panel.hidden = true;
}
}
btn.addEventListener('click', function (e) {
e.stopPropagation();
setMode(!on);
});
panel.querySelector('#cm-close').addEventListener('click', function () { setMode(false); });
panel.querySelectorAll('.cm-tab').forEach(function (t) {
t.addEventListener('click', function () {
tab = t.getAttribute('data-cm') || 'mine';
panel.querySelectorAll('.cm-tab').forEach(function (n) { n.classList.toggle('sel', n === t); });
render();
});
});
grid.addEventListener('click', function (e) {
var chip = e.target && e.target.closest ? e.target.closest('.cm-chip') : null;
if (!chip) return;
e.preventDefault();
sendCard(chip.getAttribute('data-card') || '');
});
input.addEventListener('focus', function () { if (on) { try { input.blur(); } catch (e) {} } });
input.addEventListener('beforeinput', function (e) { if (on) e.preventDefault(); });
try {
if (window.MutationObserver) {
var mo = new MutationObserver(function () {
if (!on) return;
for (var i = 0; i < SIBLINGS.length; i++) {
var el = document.getElementById(SIBLINGS[i]);
if (el && !el.hidden) { setMode(false); return; }
}
});
SIBLINGS.forEach(function (id) {
var el = document.getElementById(id);
if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
});
}
} catch (e) {}
document.addEventListener('contact-switched', function () { if (on) { setMode(false); render(); } });
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("card-mode.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("card-mode.js"); try { console.error("[JS] card-mode.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[card-mode.js] " + String(__e && __e.message || __e)); } })();