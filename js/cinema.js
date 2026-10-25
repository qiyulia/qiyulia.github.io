(function () { try {
(function () {
if (document.getElementById('cinema-mask')) return;
var mask = document.createElement('div');
mask.className = 'cinema-mask';
mask.id = 'cinema-mask';
mask.hidden = true;
mask.innerHTML =
'<div class="cinema-stage" id="cinema-stage">' +
'<video class="cinema-video" id="cinema-video" playsinline webkit-playsinline preload="metadata" hidden></video>' +
'<iframe class="cinema-frame" id="cinema-frame" allow="autoplay; fullscreen; encrypted-media" allowfullscreen hidden></iframe>' +
'<div class="cinema-danmaku" id="cinema-danmaku"></div>' +
'<div class="cinema-empty" id="cinema-empty">' +
'<div class="cinema-empty-t" id="cinema-empty-t">和 TA 一起看电影</div>' +
'<div class="cinema-empty-s" id="cinema-empty-s">导入手机里的视频，或粘贴线上链接。TA 会发字卡弹幕，左下角还能聊天。</div>' +
'<div class="cinema-empty-btns">' +
'<button class="cinema-pick" type="button" id="cinema-pick-file">选本地视频</button>' +
'<button class="cinema-pick ghost" type="button" id="cinema-pick-link">用线上链接</button>' +
'<a class="cinema-pick ghost" id="cinema-open-ext" target="_blank" rel="noopener noreferrer" hidden>在浏览器打开</a>' +
'</div>' +
'<div class="cinema-link-row" id="cinema-link-row" hidden>' +
'<input id="cinema-link-input" type="url" inputmode="url" placeholder="粘贴 B 站 / 小红书 / 快手 / 抖音链接">' +
'<button type="button" id="cinema-link-go">打开</button>' +
'</div>' +
'<div class="cinema-empty-s" id="cinema-link-hint"></div>' +
'</div>' +
'<div class="cinema-topbar">' +
'<span class="cinema-title" id="cinema-title">观影</span>' +
'<button class="cinema-top-btn" type="button" id="cinema-dm">弹幕 开</button>' +
'<button class="cinema-top-btn" type="button" id="cinema-land">横屏</button>' +
'<button class="cinema-top-btn" type="button" id="cinema-close">关闭</button>' +
'</div>' +
'<div class="cinema-bar" id="cinema-bar" hidden>' +
'<input class="cinema-seek" id="cinema-seek" type="range" min="0" max="1000" value="0">' +
'<div class="cinema-bar-row">' +
'<button class="cinema-bar-btn" type="button" id="cinema-play">播放</button>' +
'<span class="cinema-time" id="cinema-time">00:00 / 00:00</span>' +
'<button class="cinema-bar-btn" type="button" id="cinema-change">换视频</button>' +
'</div>' +
'</div>' +
'<div class="cinema-chat" id="cinema-chat">' +
'<div class="cinema-chat-head">' +
'<span class="cinema-chat-name" id="cinema-chat-name">和 TA 的影厅</span>' +
'<button class="cinema-chat-fold" type="button" id="cinema-chat-fold">－</button>' +
'</div>' +
'<div class="cinema-chat-list" id="cinema-chat-list"></div>' +
'<div class="cinema-chat-input">' +
'<input id="cinema-chat-text" type="text" maxlength="40" placeholder="说点什么…">' +
'<button type="button" id="cinema-chat-send">发送</button>' +
'</div>' +
'</div>' +
'</div>';
document.body.appendChild(mask);
var fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'video/*';
fileInput.hidden = true;
mask.appendChild(fileInput);
var stage = document.getElementById('cinema-stage');
var video = document.getElementById('cinema-video');
var frame = document.getElementById('cinema-frame');
var empty = document.getElementById('cinema-empty');
var emptyT = document.getElementById('cinema-empty-t');
var emptyS = document.getElementById('cinema-empty-s');
var linkRow = document.getElementById('cinema-link-row');
var linkInput = document.getElementById('cinema-link-input');
var linkHint = document.getElementById('cinema-link-hint');
var openExt = document.getElementById('cinema-open-ext');
var titleEl = document.getElementById('cinema-title');
var dmBtn = document.getElementById('cinema-dm');
var landBtn = document.getElementById('cinema-land');
var closeBtn = document.getElementById('cinema-close');
var bar = document.getElementById('cinema-bar');
var seek = document.getElementById('cinema-seek');
var playBtn = document.getElementById('cinema-play');
var timeEl = document.getElementById('cinema-time');
var changeBtn = document.getElementById('cinema-change');
var dmBox = document.getElementById('cinema-danmaku');
var chatBox = document.getElementById('cinema-chat');
var chatName = document.getElementById('cinema-chat-name');
var chatList = document.getElementById('cinema-chat-list');
var chatText = document.getElementById('cinema-chat-text');
var chatSend = document.getElementById('cinema-chat-send');
var chatFold = document.getElementById('cinema-chat-fold');
var isOpen = false;
var landscape = false;
var dmOn = true;
var objUrl = null;
var frameActive = false;
var taTimer = null;
var seekBusy = false;
var lastCard = '';
var chatCount = 0;
var DEF_LINES = ['这个镜头好好看', '一起看到这里了', '爆米花分你一半', '这里我看过，超好看',
'别眨眼，马上就到精彩的地方', '你靠过来一点', '这段我陪你再看一遍', '声音再大一点点'];
function toast(msg) { try { if (typeof window.toast === 'function') window.toast(msg); } catch (e) {} }
function taName() {
try { if (window.chatPartnerName) return window.chatPartnerName() || 'TA'; } catch (e) {}
return 'TA';
}
function textOnly(c) {
if (typeof c !== 'string') return false;
if (!c.trim()) return false;
if (/^(data:|@@m:|https?:)/i.test(c)) return false;
if (c.indexOf('|||') >= 0) return false;
return c.length <= 34;
}
function cardPool() {
var out = [];
try {
if (window.getDefaultCardGroups) {
var gs = window.getDefaultCardGroups('main') || [];
for (var i = 0; i < gs.length; i++) {
var g = gs[i];
if (!g || !g[1] || !g[1].length) continue;
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
return out.length ? out : DEF_LINES.slice();
}
function pickCard() {
var pool = cardPool();
var line = '';
for (var i = 0; i < 3; i++) {
line = pool[Math.floor(Math.random() * pool.length)] || '';
if (line && line !== lastCard) break;
}
if (!line) line = DEF_LINES[Math.floor(Math.random() * DEF_LINES.length)];
lastCard = line;
return line;
}
function addChat(text, mine) {
if (!chatList || !text) return;
var d = document.createElement('div');
d.className = 'cinema-chat-msg' + (mine ? ' mine' : '');
d.textContent = text;
chatList.appendChild(d);
chatCount++;
while (chatList.children.length > 60) chatList.removeChild(chatList.firstChild);
chatList.scrollTop = chatList.scrollHeight;
}
function spawnDanmaku(text) {
if (!dmOn || !dmBox || !text) return;
if (!(frameActive || (!video.hidden && !video.paused))) return;
var d = document.createElement('div');
d.className = 'dm-item';
d.textContent = text.length > 26 ? text.slice(0, 26) : text;
d.style.top = (6 + Math.random() * 62).toFixed(1) + '%';
var dur = 8 + Math.random() * 5;
d.style.animationDuration = dur.toFixed(2) + 's';
d.style.setProperty('--dm-w', (dmBox.clientWidth + 40) + 'px');
dmBox.appendChild(d);
setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, dur * 1000 + 500);
}
function taLine(text, asDanmaku) {
addChat(text, false);
if (asDanmaku !== false) spawnDanmaku(text);
}
function scheduleTa() {
if (taTimer) { clearTimeout(taTimer); taTimer = null; }
if (!isOpen) return;
taTimer = setTimeout(function () {
taTimer = null;
if (!isOpen) return;
if (document.hidden) { scheduleTa(); return; }
taLine(pickCard());
scheduleTa();
}, 8000 + Math.random() * 7000);
}
function stopTa() { if (taTimer) { clearTimeout(taTimer); taTimer = null; } }
function revokeUrl() {
if (!objUrl) return;
try { URL.revokeObjectURL(objUrl); } catch (e) {}
objUrl = null;
}
function clearMedia() {
frameActive = false;
try { video.pause(); } catch (e) {}
try { video.removeAttribute('src'); video.load(); } catch (e) {}
video.hidden = true;
frame.hidden = true;
try { frame.removeAttribute('src'); } catch (e) {}
revokeUrl();
bar.hidden = true;
}
function setEmptyMsg(t, s) {
if (emptyT) emptyT.textContent = t || '和 TA 一起看电影';
if (emptyS) emptyS.textContent = s || '导入手机里的视频，或粘贴线上链接。TA 会发字卡弹幕，左下角还能聊天。';
}
function showEmpty(t, s) {
empty.hidden = false;
setEmptyMsg(t, s);
}
function showMedia() {
empty.hidden = true;
openExt.hidden = true;
linkHint.textContent = '';
}
function fmtTime(sec) {
sec = Math.max(0, Math.floor(sec || 0));
var m = Math.floor(sec / 60);
var s = sec % 60;
return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function updateTime() {
if (!timeEl) return;
var d = video.duration || 0;
var c = video.currentTime || 0;
timeEl.textContent = fmtTime(c) + ' / ' + fmtTime(d);
if (!seekBusy && d > 0) seek.value = String(Math.round(c / d * 1000));
}
function playLocalFile(file) {
clearMedia();
showMedia();
objUrl = URL.createObjectURL(file);
video.hidden = false;
bar.hidden = false;
titleEl.textContent = file.name || '本地视频';
video.src = objUrl;
try { video.load(); } catch (e) {}
try {
var p = video.play();
if (p && p.catch) p.catch(function () {});
} catch (e) {}
updateTime();
}
function playVideoUrl(url) {
clearMedia();
showMedia();
video.hidden = false;
bar.hidden = false;
titleEl.textContent = '线上视频';
video.src = url;
try { video.load(); } catch (e) {}
try {
var p = video.play();
if (p && p.catch) p.catch(function () {});
} catch (e) {}
}
function playFrame(url, name) {
clearMedia();
showMedia();
frameActive = true;
frame.hidden = false;
titleEl.textContent = name || '线上视频';
frame.src = url;
if (linkHint) linkHint.textContent = '如果这里一片空白，是平台不允许内嵌：点上方「在浏览器打开」看。';
}
function platformName(url) {
if (/bilibili\.com|b23\.tv/i.test(url)) return '哔哩哔哩';
if (/xiaohongshu\.com|xhslink\.com/i.test(url)) return '小红书';
if (/kuaishou\.com|kwai/i.test(url)) return '快手';
if (/douyin\.com|iesdouyin\.com/i.test(url)) return '抖音';
return '';
}
function openLink(raw) {
var url = (raw || '').trim();
if (!url) return;
if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
if (!/^https?:\/\/[^\s]+$/i.test(url)) { toast('链接格式不对'); return; }
var bv = /(BV[0-9A-Za-z]{10})/.exec(url);
if (bv && /bilibili\.com/i.test(url)) {
playFrame('https://player.bilibili.com/player.html?bvid=' + bv[1] + '&autoplay=0&danmaku=0&high_quality=1', '哔哩哔哩');
linkRow.hidden = true;
return;
}
if (/\.(mp4|webm|ogv|ogg|m4v|mov|3gp|m3u8)(\?|#|$)/i.test(url)) {
playVideoUrl(url);
linkRow.hidden = true;
linkHint.textContent = '';
return;
}
var pn = platformName(url);
clearMedia();
showEmpty('这个平台不能内嵌播放', (pn || '该网站') + ' 有防盗链，页面里放不了视频。可以复制链接到浏览器/App 看，这里照样能陪 TA 聊天。');
openExt.href = url;
openExt.hidden = false;
linkHint.textContent = '已记下链接：点「在浏览器打开」就能看。';
}
function toggleLand() {
landscape = !landscape;
stage.classList.toggle('cinema-land', landscape);
landBtn.textContent = landscape ? '竖屏' : '横屏';
landBtn.classList.toggle('sel', landscape);
}
function toggleDm() {
dmOn = !dmOn;
dmBtn.textContent = dmOn ? '弹幕 开' : '弹幕 关';
dmBtn.classList.toggle('sel', dmOn);
if (!dmOn && dmBox) dmBox.innerHTML = '';
}
function open() {
isOpen = true;
mask.hidden = false;
chatList.innerHTML = '';
chatCount = 0;
chatName.textContent = '和 ' + taName() + ' 的影厅';
addChat('今天看什么？我陪你。', false);
chatBox.classList.remove('min');
chatFold.textContent = '－';
empty.hidden = false;
setEmptyMsg('和 TA 一起看电影', '导入手机里的视频，或粘贴线上链接。TA 会发字卡弹幕，左下角还能聊天。');
linkRow.hidden = true;
linkHint.textContent = '';
openExt.hidden = true;
if (landscape) toggleLand();
toggleDmText();
scheduleTa();
}
function toggleDmText() {
dmBtn.textContent = dmOn ? '弹幕 开' : '弹幕 关';
dmBtn.classList.toggle('sel', dmOn);
}
function close() {
if (!isOpen && mask.hidden) return;
isOpen = false;
stopTa();
clearMedia();
if (landscape) toggleLand();
mask.hidden = true;
chatList.innerHTML = '';
}
var mo = new MutationObserver(function () {
if (mask.hidden && isOpen) close();
});
mo.observe(mask, { attributes: true, attributeFilter: ['hidden'] });
document.getElementById('cinema-pick-file').addEventListener('click', function () { fileInput.click(); });
fileInput.addEventListener('change', function () {
var f = fileInput.files && fileInput.files[0];
fileInput.value = '';
if (!f) return;
if (!/^video\//i.test(f.type || '') && !/\.(mp4|webm|mov|m4v|ogv|3gp|mkv)$/i.test(f.name || '')) {
toast('这个文件不像视频，换一个试试');
return;
}
playLocalFile(f);
});
document.getElementById('cinema-pick-link').addEventListener('click', function () {
linkRow.hidden = !linkRow.hidden;
if (!linkRow.hidden) { try { linkInput.focus(); } catch (e) {} }
});
document.getElementById('cinema-link-go').addEventListener('click', function () {
openLink(linkInput.value);
});
linkInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); openLink(linkInput.value); }
});
changeBtn.addEventListener('click', function () {
clearMedia();
empty.hidden = false;
setEmptyMsg('换一个看', '选本地视频，或粘贴新的线上链接。');
linkRow.hidden = true;
openExt.hidden = true;
linkHint.textContent = '';
});
closeBtn.addEventListener('click', close);
landBtn.addEventListener('click', toggleLand);
dmBtn.addEventListener('click', toggleDm);
playBtn.addEventListener('click', function () {
if (video.hidden) return;
try {
if (video.paused) video.play(); else video.pause();
} catch (e) {}
});
video.addEventListener('play', function () { playBtn.textContent = '暂停'; });
video.addEventListener('pause', function () { playBtn.textContent = '播放'; });
video.addEventListener('timeupdate', updateTime);
video.addEventListener('loadedmetadata', function () {
updateTime();
if (video.duration && isFinite(video.duration)) seek.max = '1000';
});
video.addEventListener('ended', function () {
playBtn.textContent = '播放';
seek.value = '0';
taLine('看完了，还想再看点什么？');
});
video.addEventListener('error', function () {
if (!video.getAttribute('src')) return;
clearMedia();
showEmpty('这个视频打不开', '可能是格式不被浏览器支持，换成 MP4 再试试，或换一个线上直链。');
});
seek.addEventListener('pointerdown', function () { seekBusy = true; });
seek.addEventListener('touchstart', function () { seekBusy = true; }, { passive: true });
seek.addEventListener('change', function () { seekBusy = false; });
seek.addEventListener('input', function () {
if (video.hidden || !video.duration) return;
try { video.currentTime = (Number(seek.value) / 1000) * video.duration; } catch (e) {}
updateTime();
});
chatSend.addEventListener('click', function () {
var t = (chatText.value || '').trim();
if (!t) return;
addChat(t, true);
chatText.value = '';
setTimeout(function () {
if (!isOpen) return;
taLine(pickCard());
}, 600 + Math.random() * 900);
});
chatText.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); chatSend.click(); }
});
chatFold.addEventListener('click', function () {
var min = chatBox.classList.toggle('min');
chatFold.textContent = min ? '＋' : '－';
});
document.addEventListener('visibilitychange', function () {
if (!isOpen) return;
if (document.hidden) { try { video.pause(); } catch (e) {} }
});
(function makeDeskApp() {
if (document.querySelector('.app[data-app="cinema"]')) return;
var a = document.createElement('div');
a.className = 'app';
a.setAttribute('data-app', 'cinema');
a.setAttribute('data-desk-widget', 'app-cinema');
a.innerHTML = '<div class="app-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg></div><div class="app-name">观影</div>';
a.addEventListener('click', function () {
var editing = Array.prototype.slice.call(document.querySelectorAll('.app-grid')).some(function (g) { return g.classList.contains('editing'); });
if (editing) return;
try { open(); } catch (err) { toast('影厅打开失败，请重试'); }
});
var companion = document.querySelector('.app[data-app="companion"]');
if (companion && companion.parentNode) {
companion.parentNode.insertBefore(a, companion.nextSibling);
} else {
var grid = document.querySelector('.app-grid.p3-grid') || document.querySelector('.app-grid.p2-grid');
if (!grid) return;
grid.appendChild(a);
}
try { if (window.applyDeskLayout) window.applyDeskLayout(); } catch (e) {}
})();
window.openCinema = open;
window.closeCinema = close;
window.__cinemaProbe = { open: function () { return isOpen; }, landscape: function () { return landscape; } };
})();
if (window.__mochiLoaded) window.__mochiLoaded.push("cinema.js");
} catch (__e) { if (window.__mochiErrLoaded) window.__mochiErrLoaded.push("cinema.js"); try { console.error("[JS] cinema.js", __e && __e.message || __e); } catch (x) {} if (window.__jsErrors) window.__jsErrors.push("[cinema.js] " + String(__e && __e.message || __e)); } })();