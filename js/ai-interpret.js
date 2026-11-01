// ===== 上下文 AI 解读（免费接口，无需 Key） =====
// 说明：调用 Pollinations 文本接口（浏览器可跨域，无需 API Key，有速率/每日限制）。
// 只负责「请求 + 开关 + 今日次数」，界面与消息插入在 chat.js / chat-settings.js。
(function () { try {
(function () {
const G = 'xy-home-v2';
const KEY_EN = 'ai-interpret-enabled';
const KEY_USE = 'ai-interpret-usage';
const KEY_URL = 'ai-api-url';
const KEY_APIKEY = 'ai-api-key';
const KEY_MODEL = 'ai-api-model';
const API_URL = 'https://text.pollinations.ai/openai';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const MIN_GAP = 15000;         // 两次请求最小间隔（匿名免费档 1 次/15 秒，太快会被 429）
const TIMEOUT = 50000;
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
return '这段聊天记录按时间顺序（' + me + ' 是我，' + ta + ' 是对方；含要解读的这句，以及它附近双方最近各 5 句）：\n' + (lines || '（附近没有其它对话）') +
'\n\n要解读的是 ' + ta + ' 说的这句：「' + text + '」\n\n' +
'请只输出 2 行中文，不要用 markdown、不要编号、不要客套；一律用「TA」指代对方，不要出现「他」「她」：\n' +
'意思：结合上下文用 2~3 句（合计不超过 80 字）说清 ' + ta + ' 真正想表达什么，并点出是从哪句话/哪种语气判断出来的\n' +
'语气：用 1 句概括 ' + ta + ' 当下的情绪或态度（如撒娇、试探、赌气、想被哄、想确认关系）';
}
function cfg() {
const url = String(readKey(KEY_URL) || '').trim();
const key = String(readKey(KEY_APIKEY) || '').trim();
const model = String(readKey(KEY_MODEL) || '').trim();
// Groq 不允许浏览器直连（CORS 403），所以填了 Key 时默认走 OpenRouter 免费模型；
// 没 Key 才退回匿名免费接口。想用 Groq 需自己填代理地址。
const useGroq = /^https:\/\/api\.groq\.com\//i.test(url);
const useOR = /^https:\/\/openrouter\.ai\//i.test(url);
return {
url: url || (key ? OR_URL : API_URL),
key: key,
model: model || (useGroq ? GROQ_MODEL : key ? OR_MODEL : 'openai'),
custom: !!(url || key),
or: useOR || (!url && !!key)
};
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
const c = cfg();
const payload = {
model: c.model,
messages: [
{ role: 'system', content: '你擅长读懂情侣聊天里的言外之意。用「TA」指代对方、用「我」指代本人，不要用「你」「他」「她」称呼对方。回答简短克制，不评判、不说教。' },
{ role: 'user', content: buildPrompt(text, opts.context || [], opts.me || '我', opts.ta || 'TA') }
],
temperature: 0.7
};
if (!c.custom) {
payload.reasoning_effort = 'low'; // 压低思考长度：免费模型默认会长篇推理，容易超时
payload.max_tokens = 500;
payload.referrer = 'https://qiyulia.github.io';
}
const headers = { 'Content-Type': 'application/json' };
if (c.key) headers['Authorization'] = 'Bearer ' + c.key;
if (c.or) { headers['HTTP-Referer'] = 'https://qiyulia.github.io'; headers['X-Title'] = 'Mochi 字卡传讯'; }
timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, TIMEOUT) : null;
const res = await fetch(c.url, {
method: 'POST',
headers: headers,
body: JSON.stringify(payload),
signal: ctrl ? ctrl.signal : undefined
});
if (!res.ok) {
const e = new Error(res.status === 401 || res.status === 403 ? '接口拒绝了请求，请检查 API Key 是否有效'
: res.status === 429 ? '接口请求太频繁，稍后再试'
: '接口暂时不可用（' + res.status + '）');
e.code = 'http';
throw e;
}
const raw = await res.text();
let data = null;
try { data = JSON.parse(raw); } catch (e) { data = null; }
const msg = data && data.choices && data.choices[0] && data.choices[0].message;
let out = msg ? String(msg.content || '') : '';
if (!out) out = data && data.output ? String(data.output) : '';  // 兼容部分非 OpenAI 兼容接口
if (!out && typeof data === 'string') out = data;
if (!out && !data) out = raw;
out = cleanText(out);
if (!out) { const e = new Error('没拿到解读结果，稍后再试'); e.code = 'empty'; throw e; }
lastAt = Date.now();
return out;
} catch (err) {
if (err && err.name === 'AbortError') { const e = new Error('解读超时了，稍后再试'); e.code = 'timeout'; throw e; }
if (err && err.name === 'TypeError') { const e = new Error('连不上接口，请检查地址或网络（Groq 等接口不允许浏览器直连）'); e.code = 'net'; throw e; }
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
