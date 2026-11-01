// ===== 上下文 AI 解读（免费接口，无需 Key） =====
// 说明：调用 Pollinations 文本接口（浏览器可跨域，无需 API Key，有速率/每日限制）。
// 只负责「请求 + 开关 + 今日次数」，界面与消息插入在 chat.js / chat-settings.js。
(function () { try {
(function () {
const G = 'xy-home-v2';
const KEY_EN = 'ai-interpret-enabled';
const KEY_USE = 'ai-interpret-usage';
const API_URL = 'https://text.pollinations.ai/openai';
const MIN_GAP = 4000;          // 两次请求最小间隔（免费接口限流，太快会被拒）
const TIMEOUT = 40000;
let lastAt = 0;
let inFlight = false;

function stores() {
const arr = [];
try { if (window.xyStore) { arr.push(window.xyStore(G)); arr.push(window.xyStore(G + ':default')); } } catch (e) {}
return arr;
}
function readKey(k) {
const ss = stores();
for (let i = 0; i < ss.length; i++) {
try { const v = ss[i].get(k); if (v !== null && v !== undefined) return v; } catch (e) {}
}
return null;
}
function writeKey(k, v) {
try { if (window.xyStore) window.xyStore(G).set(k, v); } catch (e) {}
try { document.dispatchEvent(new CustomEvent('ai-int-changed', { detail: { key: k } })); } catch (e) {}
}
function todayStr() {
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function usage() {
let o = null;
try { o = JSON.parse(readKey(KEY_USE) || ''); } catch (e) {}
if (!o || typeof o !== 'object' || o.d !== todayStr()) return { d: todayStr(), n: 0 };
return { d: o.d, n: Math.max(0, Number(o.n) || 0) };
}
function usageToday() { return usage().n; }
function bumpUsage() {
const u = usage();
u.n += 1;
writeKey(KEY_USE, JSON.stringify(u));
return u.n;
}
function enabled() {
const v = readKey(KEY_EN);
return v === '1';
}
function cleanText(t) {
let s = String(t || '').trim();
s = s.replace(/`+/g, '').replace(/^\s*[-*#]+\s*/gm, '').replace(/\*\*/g, '');
s = s.replace(/\s*(意思|语气|回应)：/g, '\n$1：').replace(/\n{2,}/g, '\n').trim();
s = s.split('\n').filter(l => l.trim()).slice(0, 6).join('\n');
return s.slice(0, 320);
}
function buildPrompt(text, ctx, me, ta) {
const lines = (ctx || []).map(m => (m.side === 'out' ? me : ta) + '：' + m.text).join('\n');
return '聊天记录（' + me + ' 是我，' + ta + ' 是对方）：\n' + (lines || '（无更早的对话）') +
'\n\n要解读的是 ' + ta + ' 刚说的这句：「' + text + '」\n\n' +
'请只输出 3 行中文，不要用 markdown、不要编号、不要客套：\n' +
'意思：结合上下文说明 ' + ta + ' 真正想表达什么\n' +
'语气：概括 ' + ta + ' 的情绪或态度（如撒娇、试探、赌气、想被哄）\n' +
'回应：给一句 ' + me + ' 可以接的话，不超过 20 字';
}
async function interpret(opts) {
opts = opts || {};
const text = String(opts.text || '').trim();
if (!text) throw new Error('没有可解读的文字');
const now = Date.now();
if (inFlight) { const e = new Error('正在解读上一条，稍等一下'); e.code = 'busy'; throw e; }
if (now - lastAt < MIN_GAP) { const e = new Error('点得太快了，' + Math.ceil((MIN_GAP - (now - lastAt)) / 1000) + ' 秒后再试'); e.code = 'fast'; throw e; }
inFlight = true;
const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
let timer = null;
try {
const body = JSON.stringify({
model: 'openai',
messages: [
{ role: 'system', content: '你擅长读懂情侣聊天里的言外之意。用「TA」指代对方、用「我」指代本人，不要用「你」称呼对方。回答简短克制，不评判、不说教。' },
{ role: 'user', content: buildPrompt(text, opts.context || [], opts.me || '我', opts.ta || 'TA') }
],
temperature: 0.7,
referrer: 'https://qiyulia.github.io'
});
timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, TIMEOUT) : null;
const res = await fetch(API_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: body,
signal: ctrl ? ctrl.signal : undefined
});
if (!res.ok) {
const e = new Error(res.status === 429 ? '免费接口请求太频繁，稍后再试' : '免费接口暂时不可用（' + res.status + '）');
e.code = 'http';
throw e;
}
const data = await res.json();
const msg = data && data.choices && data.choices[0] && data.choices[0].message;
let out = msg ? String(msg.content || '') : '';
if (!out && typeof data === 'string') out = data;
out = cleanText(out);
if (!out) { const e = new Error('没拿到解读结果，稍后再试'); e.code = 'empty'; throw e; }
lastAt = Date.now();
return out;
} catch (err) {
if (err && err.name === 'AbortError') { const e = new Error('解读超时了，稍后再试'); e.code = 'timeout'; throw e; }
throw err;
} finally {
if (timer) clearTimeout(timer);
inFlight = false;
}
}
window.mochiAIIntEnabled = enabled;
window.mochiAIIntUsage = usageToday;
window.mochiAIIntBump = bumpUsage;
window.mochiAIInterpret = interpret;
window.mochiAIIntKey = KEY_EN;
})();
} catch (e) { try { (window.__mochiExtFail = window.__mochiExtFail || []).push('ai-interpret.js:' + (e && e.message)); } catch (e2) {} } })();
