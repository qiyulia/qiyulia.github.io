(function () { try {
(function () {
'use strict';
var G = 'xy-home-v2';
var GRAD_KEY = G + ':soft-grad';
var INTRO_KEY = G + ':yl-intro';
function readJSON(key) {
try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}
function writeJSON(key, obj) {
try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
}
function sessionGet(key) {
try { return sessionStorage.getItem(key); } catch (e) { return null; }
}
function sessionSet(key, v) {
try { sessionStorage.setItem(key, v); } catch (e) {}
}
function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
var PRESETS = [
{ name: '云隙微光', a: '#a9c1ee', b: '#cbbcec', c: '#f2d9e4' },
{ name: '雾蓝', a: '#bcd8ee', b: '#c6d3ef', c: '#e2e8f6' },
{ name: '暮山', a: '#d3c1ec', b: '#e0c3d7', c: '#f0d7d2' },
{ name: '青岚', a: '#c2e2d8', b: '#c9dcec', c: '#dfe4f6' },
{ name: '暖沙', a: '#f0ddca', b: '#e9d3e6', c: '#f6e6e8' }
];
function applyGrad(g) {
if (!g || !isHex(g.a) || !isHex(g.b)) return;
var c = isHex(g.c) ? g.c : g.b;
var root = document.documentElement;
root.style.setProperty('--grad-a', g.a);
root.style.setProperty('--grad-b', g.b);
root.style.setProperty('--grad-c', c);
writeJSON(GRAD_KEY, { a: g.a, b: g.b, c: c });
paintPresetSel(g);
paintInputs(g);
try {
var meta = document.querySelector('meta[name="theme-color"]');
if (meta) meta.setAttribute('content', g.b);
} catch (e) {}
}
function resetGrad() {
var root = document.documentElement;
root.style.removeProperty('--grad-a');
root.style.removeProperty('--grad-b');
root.style.removeProperty('--grad-c');
try { localStorage.removeItem(GRAD_KEY); } catch (e) {}
paintPresetSel(null);
paintInputs(null);
}
var ui = { presets: null, a: null, b: null, c: null };
function paintPresetSel(g) {
if (!ui.presets) return;
var btns = ui.presets.querySelectorAll('.sgp');
for (var i = 0; i < btns.length; i++) {
var p = PRESETS[i];
var on = !!g && String(p.a).toLowerCase() === String(g.a).toLowerCase() &&
String(p.b).toLowerCase() === String(g.b).toLowerCase();
btns[i].classList.toggle('sel', on);
}
}
function paintInputs(g) {
if (!ui.a) return;
if (!g) {
ui.a.value = '#a9c1ee'; ui.b.value = '#cbbcec'; ui.c.value = '#f2d9e4';
return;
}
ui.a.value = g.a; ui.b.value = g.b; ui.c.value = isHex(g.c) ? g.c : g.b;
}
function buildThemeUI() {
if (document.getElementById('yl-grad-block')) return;
var anchor = document.getElementById('row-accent-color');
if (!anchor) return;
var group = anchor.closest ? anchor.closest('.set-group') : null;
if (!group || !group.parentNode) return;
var title = group.previousElementSibling;
if (!title || !title.classList || !title.classList.contains('cg-title')) title = group;
var t = document.createElement('div');
t.className = 'cg-title';
t.textContent = '渐变主题';
var box = document.createElement('div');
box.className = 'set-group glass soft-grad-block';
box.id = 'yl-grad-block';
var strip = document.createElement('div');
strip.className = 'soft-grad-presets';
box.appendChild(strip);
ui.presets = strip;
PRESETS.forEach(function (p) {
var btn = document.createElement('button');
btn.type = 'button';
btn.className = 'sgp';
btn.setAttribute('data-name', p.name);
var i = document.createElement('i');
i.style.background = 'linear-gradient(135deg,' + p.a + ' 0%,' + p.b + ' 55%,' + p.c + ' 100%)';
var s = document.createElement('span');
s.textContent = p.name;
btn.appendChild(i); btn.appendChild(s);
btn.addEventListener('click', function () { applyGrad(p); });
strip.appendChild(btn);
});
function row(label, sub, init) {
var r = document.createElement('div');
r.className = 'soft-grad-row';
var tx = document.createElement('div');
tx.className = 'sgr-t';
tx.textContent = label;
var em = document.createElement('em');
em.textContent = sub;
tx.appendChild(em);
var input = document.createElement('input');
input.type = 'color';
input.value = init;
input.addEventListener('input', function () {
applyGrad({
a: ui.a.value, b: ui.b.value, c: ui.c.value
});
});
r.appendChild(tx); r.appendChild(input);
box.appendChild(r);
return input;
}
ui.a = row('渐变起点', '页面左上与按钮的高光色', '#a9c1ee');
ui.b = row('渐变终点', '主色相，决定整体气质', '#cbbcec');
ui.c = row('氛围色', '右下角的暖光，可同于终点', '#f2d9e4');
var reset = document.createElement('button');
reset.type = 'button';
reset.className = 'soft-grad-reset';
reset.textContent = '恢复默认渐变';
reset.addEventListener('click', resetGrad);
box.appendChild(reset);
group.parentNode.insertBefore(t, title);
group.parentNode.insertBefore(box, title);
}
var BUBBLE_KEYS = ['cs-out-bg', 'cs-out-ink', 'cs-in-bg', 'cs-in-ink', 'cs-bubble-opacity', 'cs-bubble-css'];
function hasCustomBubble() {
var st = null;
try { st = typeof window.activeStore === 'function' ? window.activeStore() : null; } catch (e) {}
for (var i = 0; i < BUBBLE_KEYS.length; i++) {
var k = BUBBLE_KEYS[i], v = null;
if (st) { try { v = st.get(k); } catch (e) {} }
if (v === null || v === undefined || v === '') {
try { v = localStorage.getItem(G + ':' + k); } catch (e) {}
}
if (v !== null && v !== undefined && v !== '') return true;
}
return false;
}
function syncBubbleSoft() {
document.documentElement.classList.toggle('yl-bubble-soft', !hasCustomBubble());
}
function watchBubble() {
syncBubbleSoft();
if (!window.MutationObserver) return;
var page = document.getElementById('page-chat');
if (page && page.style) {
new MutationObserver(syncBubbleSoft).observe(page, { attributes: true, attributeFilter: ['style'] });
}
new MutationObserver(syncBubbleSoft).observe(document.documentElement, {
attributes: true, attributeFilter: ['data-theme', 'style']
});
}
function initIntro() {
var el = document.getElementById('yl-intro');
if (!el) return;
if (sessionGet(INTRO_KEY) === '1') {
if (el.parentNode) el.parentNode.removeChild(el);
document.documentElement.classList.add('yl-intro-off');
return;
}
var done = false;
function hide() {
if (done) return;
done = true;
sessionSet(INTRO_KEY, '1');
el.classList.add('yl-skip');
setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
}
el.addEventListener('click', hide);
el.addEventListener('touchstart', hide, { passive: true });
setTimeout(hide, 3600);
}
function boot() {
var saved = readJSON(GRAD_KEY);
if (saved) applyGrad(saved);
buildThemeUI();
if (saved) paintInputs(saved); else paintInputs(null);
watchBubble();
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}
initIntro();
window.ylSoft = { apply: applyGrad, reset: resetGrad, presets: PRESETS };
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("soft-theme.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("soft-theme.js"); try { console.error("[JS] soft-theme.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[soft-theme.js] " + String(__e && __e.message || __e)); } })();