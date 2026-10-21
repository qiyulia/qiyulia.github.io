(function () { try {
(function () {
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function dayHash(d) {
const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
let h = 2166136261;
for (let i = 0; i < key.length; i++) {
h ^= key.charCodeAt(i);
h = Math.imul(h, 16777619);
}
return h >>> 0;
}
function paint() {
const now = new Date();
const dateEl = document.getElementById('rs-date');
if (dateEl) dateEl.textContent = WEEK[now.getDay()] + ' ' + pad2(now.getMonth() + 1) + '.' + pad2(now.getDate());
const hzEl = document.getElementById('rs-hz');
if (hzEl) hzEl.textContent = (100 + (dayHash(now) % 500) / 10).toFixed(1);
const grid = document.querySelector('.app-grid[data-app="main"]');
const countEl = document.getElementById('rs-app-count');
if (grid && countEl) {
const shown = Array.prototype.slice.call(grid.querySelectorAll('.app'))
.filter(a => !a.hidden && a.offsetParent !== null).length;
countEl.textContent = pad2(shown);
}
}
function boot() {
paint();
setTimeout(paint, 600);
let lastDay = new Date().toDateString();
setInterval(() => {
const d = new Date().toDateString();
if (d !== lastDay) { lastDay = d; paint(); }
}, 60000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("home-reskin.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("home-reskin.js"); try { console.error("[JS] home-reskin.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[home-reskin.js] " + String(__e && __e.message || __e)); } })();