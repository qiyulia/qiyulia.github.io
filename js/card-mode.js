(function () { try {
/* ===== 功能：字卡模式（聊天输入栏） =====
入口：聊天输入栏右侧「字卡」按钮（注入 .chat-input-row，data-io="cardmode" 排在发送前）。
语义：开启后把 #chat-input 设为不可编辑（contenteditable=false + inputmode=none），
输入法弹不出来；只能点字卡把内容发出去。关闭即恢复输入框与输入法。
数据：直接读字卡库的原始分组——公用库 xy-home-v2:cc-groups-public、当前桌面专属库
xy-home-v2:<cid>:cc-groups，四个页签「全部 / 公用 / 专属 / 预设」；不再按「停用分组」
过滤，也不截断张数，公用 + 专属全部可用。顶部搜索框可按字卡内容 / 分组名筛选后点击发送。
图片字卡走 media-pool 令牌扩展后交给 chatSendImg。
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
'<button type="button" class="cm-tab sel" data-cm="all">全部</button>' +
'<button type="button" class="cm-tab" data-cm="pub">公用</button>' +
'<button type="button" class="cm-tab" data-cm="own">专属</button>' +
'<button type="button" class="cm-tab" data-cm="preset">预设</button>' +
'<button type="button" class="poke-card-close" id="cm-close">✕</button>' +
'</span>' +
'</div>' +
'<div class="cm-search-wrap"><input type="text" class="cm-search" id="cm-search" placeholder="搜索字卡内容或分组名，点结果直接发送" autocomplete="off"></div>' +
'<div class="cm-hint">可以搜索字卡再点发送；退出字卡模式才能打字</div>' +
'<div class="poke-card-scroll cm-grid" id="cm-grid"></div>';
page.appendChild(panel);
var grid = panel.querySelector('#cm-grid');
var searchEl = panel.querySelector('#cm-search');
var tab = 'all';
var on = false;
var SIBLINGS = ['chat-more-panel', 'emoji-panel', 'chat-search', 'chat-ask-panel', 'chat-doodle-panel', 'chat-drawguess-panel'];
var TYPES = ['text', 'kaomoji', 'emoji', 'voice']; // 不含「图片」「拍一拍」「表情包」分类
var SCOPE_LABEL = { pub: '公用', own: '专属' };
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
/* ===== 读库：原始分组，不做停用过滤、不截断 ===== */
function parseGroups(raw) {
try {
var g = JSON.parse(raw || 'null');
if (g && typeof g === 'object' && !Array.isArray(g)) return g;
} catch (e) {}
return {};
}
function pubGroups() {
try { return parseGroups(window.xyStore('xy-home-v2').get('cc-groups-public')); } catch (e) { return {}; }
}
function ownGroups() {
try {
var st = window.storeFor ? window.storeFor(cid()) : window.xyStore('xy-home-v2:' + cid());
return parseGroups(st ? st.get('cc-groups') : null);
} catch (e) { return {}; }
}
function flatten(g, scope) {
var out = [];
if (!g || typeof g !== 'object') return out;
TYPES.forEach(function (t) {
var gs = g[t];
if (!gs || typeof gs.forEach !== 'function') return;
gs.forEach(function (grp) {
if (!Array.isArray(grp) || !Array.isArray(grp[1])) return;
var name = String(grp[0] == null ? '' : grp[0]);
grp[1].forEach(function (c) {
if (typeof c !== 'string' || !c) return;
if (!isImg(c) && !textOf(c)) return;
out.push({ c: c, scope: scope, type: t, group: name });
});
});
});
return out;
}
function presetList() {
var out = [];
try {
var gs = (window.getDefaultCardGroups && window.getDefaultCardGroups('main')) || [];
gs.forEach(function (g) {
if (!g || !Array.isArray(g[1])) return;
var name = String(g[0] == null ? '' : g[0]);
g[1].forEach(function (c) {
if (typeof c !== 'string' || !c) return;
if (!isImg(c) && !textOf(c)) return;
out.push({ c: c, scope: 'preset', type: 'text', group: name });
});
});
} catch (e) {}
return out;
}
function cardKey(it) {
return it.scope + '|' + (isImg(it.c) ? ('m:' + it.c) : ('t:' + textOf(it.c)));
}
function dedupe(list) {
var seen = {}, out = [];
for (var i = 0; i < list.length; i++) {
var k = cardKey(list[i]);
if (seen[k]) continue;
seen[k] = 1;
out.push(list[i]);
}
return out;
}
function match(it, q) {
if (!q) return true;
var label = (it.scope === 'preset' ? '预设' : (SCOPE_LABEL[it.scope] || ''));
var hay = (textOf(it.c) + '\n' + (it.group || '') + '\n' + label).toLowerCase();
return hay.indexOf(q) >= 0;
}
function render() {
var q = (searchEl.value || '').trim().toLowerCase();
var list;
if (tab === 'preset') list = presetList();
else if (tab === 'pub') list = flatten(pubGroups(), 'pub');
else if (tab === 'own') list = flatten(ownGroups(), 'own');
else list = flatten(ownGroups(), 'own').concat(flatten(pubGroups(), 'pub')); // 专属 + 公用全部
list = dedupe(list);
if (q) list = list.filter(function (it) { return match(it, q); });
grid.innerHTML = '';
for (var i = 0; i < list.length; i++) {
var it = list[i];
var chip = document.createElement('button');
chip.type = 'button';
chip.className = 'cm-chip' + (isImg(it.c) ? ' img' : '');
chip.setAttribute('data-card', it.c);
if (isImg(it.c)) {
var src = imgSrc(it.c);
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
var tx = document.createElement('span');
tx.className = 'cm-tx';
tx.textContent = textOf(it.c);
chip.appendChild(tx);
}
if (tab === 'all' && !isImg(it.c) && it.scope !== 'preset') {
var tag = document.createElement('span');
tag.className = 'cm-tag';
tag.textContent = SCOPE_LABEL[it.scope] || '';
chip.appendChild(tag);
}
grid.appendChild(chip);
}
if (!list.length) {
var empty = document.createElement('div');
empty.className = 'cm-empty';
if (q) empty.textContent = '没有匹配「' + searchEl.value.trim() + '」的字卡，换个关键词试试。';
else empty.textContent = tab === 'preset'
? '系统预设字卡这一栏是空的（可能被分类开关全部关掉了）。'
: (tab === 'pub' ? '公用字卡库还是空的，去「字卡库 → 公用字卡」加几张。'
: (tab === 'own' ? '当前桌面的专属字卡库还是空的，去「字卡库 → 专属字卡」加几张。'
: '公用字卡和专属字卡都是空的，先去「字卡库」加几张。'));
grid.appendChild(empty);
}
}
function hydrateThenRender() {
try {
if (!window.hydrateLibForCid) return;
window.hydrateLibForCid(cid(), function () { if (on) render(); });
} catch (e) {}
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
hydrateThenRender();
} else {
input.setAttribute('contenteditable', 'true');
input.removeAttribute('inputmode');
input.setAttribute('data-ph', '说点什么…');
panel.hidden = true;
searchEl.value = '';
}
}
btn.addEventListener('click', function (e) {
e.stopPropagation();
setMode(!on);
});
searchEl.addEventListener('input', function () { if (on) render(); });
panel.querySelector('#cm-close').addEventListener('click', function () { setMode(false); });
panel.querySelectorAll('.cm-tab').forEach(function (t) {
t.addEventListener('click', function () {
tab = t.getAttribute('data-cm') || 'all';
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
function cmEnabled() {
try { return window.xyStore ? window.xyStore('xy-home-v2').get('chat-cardmode-enabled') !== '0' : true; } catch (e) { return true; }
}
function applyCmEnabled() {
if (cmEnabled()) { btn.style.display = ''; }
else { if (on) setMode(false); panel.hidden = true; btn.style.display = 'none'; }
}
applyCmEnabled();
document.addEventListener('cardmode-setting-changed', applyCmEnabled);
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("card-mode.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("card-mode.js"); try { console.error("[JS] card-mode.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[card-mode.js] " + String(__e && __e.message || __e)); } })();
