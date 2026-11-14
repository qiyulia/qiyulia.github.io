/* 统一音乐播放器：桌面小组件与音乐应用共享状态 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const SYNTH = {
    'synth-breeze': { tempo: 92, notes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66] },
    'synth-cloud': { tempo: 108, notes: [329.63, 392, 493.88, 587.33, 493.88, 392, 349.23, 440, 523.25, 659.25, 523.25, 440, 392, 493.88, 587.33, 493.88] },
    'synth-stars': { tempo: 72, notes: [220, 261.63, 329.63, 261.63, 196, 246.94, 293.66, 246.94, 174.61, 220, 261.63, 329.63, 293.66, 261.63, 246.94, 196] },
  };
  const MODE_LABELS = { sequence: '顺序播放', repeat: '单曲循环', shuffle: '随机播放' };
  const SOURCE_LABELS = { synth: '内置旋律', local: '本地音频', url: '音频直链', netease: '网易云音乐', kugou: '酷狗音乐' };
  const audio = new Audio();
  audio.preload = 'metadata';

  let playing = false;
  let statusText = '';
  let audioTrackId = '';
  let objectUrl = '';
  let mediaToken = 0;
  let taTimer = null;
  let taResumeTimer = null;
  const synth = { context: null, timer: null, endTimer: null, nextTime: 0, step: 0, trackId: '' };

  function tracks() { return App.state.music.tracks; }
  function currentTrack() {
    return tracks().find(function (track) { return track.id === App.state.music.currentId; }) || tracks()[0];
  }
  function sourceLabel(track) { return SOURCE_LABELS[track.source] || '导入音乐'; }
  function isFavorite(id, side) { return App.state.music.favorites[side].indexOf(id) !== -1; }
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function synthDuration(track) {
    const def = SYNTH[track.id];
    return def ? def.notes.length * 60 / def.tempo : 0;
  }
  function progressValues(track) {
    if (track.source === 'synth') {
      const duration = synthDuration(track);
      const def = SYNTH[track.id];
      const current = synth.trackId === track.id && def ? synth.step * 60 / def.tempo : 0;
      return { current: current, duration: duration, ratio: duration ? current / duration : 0 };
    }
    if (audioTrackId !== track.id) return { current: 0, duration: 0, ratio: 0 };
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    return { current: audio.currentTime || 0, duration: duration, ratio: duration ? audio.currentTime / duration : 0 };
  }
  function renderProgress() {
    const track = currentTrack();
    if (!track) return;
    const progress = progressValues(track);
    const ratio = Math.max(0, Math.min(1, progress.ratio));
    el('#music-current-time').textContent = formatTime(progress.current);
    el('#chat-music-time').textContent = formatTime(progress.current);
    el('#music-duration').textContent = formatTime(progress.duration);
    el('#music-progress-fill').style.width = (ratio * 100) + '%';
    el('#w-progress').style.width = (ratio * 100) + '%';
    el('#chat-music-progress').style.width = (ratio * 100) + '%';
  }

  function renderMusicEmpty() {
    const icon = '<path d="M8 5l11 7-11 7V5z"/>';
    ['#w-track', '#music-title', '#chat-music-title'].forEach(function (sel) { el(sel).textContent = '暂无歌曲'; });
    ['#w-artist', '#music-artist', '#chat-music-artist'].forEach(function (sel) { el(sel).textContent = '导入音乐后在这里播放'; });
    ['#w-play-icon', '#music-play-icon', '#chat-music-play-icon'].forEach(function (sel) { el(sel).innerHTML = icon; });
    ['#w-play', '#music-play', '#chat-music-play'].forEach(function (sel) { el(sel).setAttribute('aria-label', '播放音乐'); });
    ['#w-disc', '#music-disc', '#chat-music-disc'].forEach(function (sel) { el(sel).classList.remove('is-playing'); });
    ['#w-music-status', '#music-status', '#chat-music-status'].forEach(function (sel) { el(sel).textContent = '播放列表是空的，先导入一首歌'; });
    el('#music-source-label').textContent = '未导入';
    el('#music-mode').textContent = MODE_LABELS[App.state.music.mode];
    el('#music-favorite').classList.remove('is-active');
    el('#music-ta-favorite').textContent = '♡ TA';
    el('#music-ta-favorite').classList.remove('is-active');
    el('#chat-music-favorite').textContent = '♡ 收藏';
    el('#chat-music-favorite').classList.remove('is-active');
    const source = el('#music-open-source');
    source.hidden = true;
    source.removeAttribute('href');
    el('#music-count').textContent = '0 首 · 我 0 · TA 0';
    el('#music-list').innerHTML = '<p class="panel-note">还没有歌曲，导入直链或本地音频后会显示在这里。</p>';
    el('#music-current-time').textContent = '00:00';
    el('#chat-music-time').textContent = '00:00';
    el('#music-duration').textContent = '00:00';
    el('#music-progress-fill').style.width = '0%';
    el('#w-progress').style.width = '0%';
    el('#chat-music-progress').style.width = '0%';
  }

  /* 聊天页音乐小窗的开启 / 关闭状态 */
  function applyMusicFloatState() {
    const box = el('#chat-music-float');
    if (!box) return;
    const open = App.state.music.chatFloat !== false;
    const view = el('#view-chat');
    const scroller = el('#chat-scroll');
    const beforeHeight = scroller ? scroller.scrollHeight : 0;
    const beforeTop = scroller ? scroller.scrollTop : 0;
    box.hidden = !open;
    view.classList.toggle('music-is-closed', !open);
    if (scroller) {
      const delta = scroller.scrollHeight - beforeHeight;
      if (delta) scroller.scrollTop = beforeTop + delta;
    }
    const btn = el('#music-float-switch');
    if (btn) {
      btn.textContent = open ? '已开启' : '开启';
      btn.setAttribute('aria-pressed', String(open));
    }
  }

  App.renderMusic = function () {
    if (!App.state || !App.state.music) return;
    applyMusicFloatState();
    const track = currentTrack();
    if (!track) {
      renderMusicEmpty();
      return;
    }
    const mine = isFavorite(track.id, 'mine');
    const ta = isFavorite(track.id, 'ta');
    const index = tracks().indexOf(track);
    const icon = playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="M8 5l11 7-11 7V5z"/>';
    const status = statusText || (playing ? '正在播放 · 第 ' + (index + 1) + ' 首' : '点一下，听首小曲');

    el('#w-track').textContent = track.title;
    el('#w-artist').textContent = track.artist;
    el('#w-play-icon').innerHTML = icon;
    el('#w-play').setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    el('#w-disc').classList.toggle('is-playing', playing);
    el('#w-music-status').textContent = status;

    el('#music-title').textContent = track.title;
    el('#music-artist').textContent = track.artist;
    el('#music-source-label').textContent = sourceLabel(track);
    el('#music-play-icon').innerHTML = icon;
    el('#music-play').setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    el('#music-disc').classList.toggle('is-playing', playing);
    el('#music-status').textContent = status;
    el('#music-mode').textContent = MODE_LABELS[App.state.music.mode];
    el('#music-favorite').classList.toggle('is-active', mine);
    el('#music-favorite').setAttribute('aria-label', mine ? '取消收藏当前歌曲' : '收藏当前歌曲');
    el('#music-ta-favorite').textContent = (ta ? '♥' : '♡') + ' TA';
    el('#music-ta-favorite').classList.toggle('is-active', ta);

    el('#chat-music-title').textContent = track.title;
    el('#chat-music-artist').textContent = track.artist;
    el('#chat-music-play-icon').innerHTML = icon;
    el('#chat-music-play').setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    el('#chat-music-disc').classList.toggle('is-playing', playing);
    el('#chat-music-status').textContent = status;
    el('#chat-music-favorite').textContent = mine ? '♥ 已收藏' : '♡ 收藏';
    el('#chat-music-favorite').classList.toggle('is-active', mine);
    el('#chat-music-favorite').setAttribute('aria-label', mine ? '取消收藏当前歌曲' : '收藏当前歌曲');

    const source = el('#music-open-source');
    const pageUrl = safeUrl(track.pageUrl || (track.source === 'netease' || track.source === 'kugou' ? track.url : ''));
    source.hidden = !pageUrl;
    if (pageUrl) source.href = pageUrl;
    else source.removeAttribute('href');

    const music = App.state.music;
    el('#music-count').textContent = tracks().length + ' 首 · 我 ' + music.favorites.mine.length + ' · TA ' + music.favorites.ta.length;
    el('#music-list').innerHTML = tracks().map(function (item, itemIndex) {
      const id = App.esc(item.id);
      const current = item.id === track.id;
      const myFavorite = isFavorite(item.id, 'mine');
      const taFavorite = isFavorite(item.id, 'ta');
      return '<div class="music-track-row' + (current ? ' is-current' : '') + '">' +
        '<button type="button" class="music-track-select" data-music-select="' + id + '">' +
          '<span class="music-track-index">' + (current && playing ? '♪' : itemIndex + 1) + '</span>' +
          '<span class="music-track-copy"><strong>' + App.esc(item.title) + '</strong><span>' + App.esc(item.artist) + ' · ' + App.esc(sourceLabel(item)) + '</span></span>' +
        '</button>' +
        '<div class="music-track-actions">' +
          '<button type="button" class="music-row-heart' + (myFavorite ? ' is-active' : '') + '" data-music-favorite="' + id + '" aria-label="' + (myFavorite ? '取消我的收藏' : '加入我的收藏') + '">' + (myFavorite ? '♥' : '♡') + '</button>' +
          '<span class="music-row-ta' + (taFavorite ? ' is-active' : '') + '" title="' + (taFavorite ? 'TA 已收藏' : 'TA 未收藏') + '">' + (taFavorite ? '♥' : '♡') + ' TA</span>' +
          '<button type="button" class="music-row-edit" data-music-edit="' + id + '" aria-label="编辑歌曲信息">✎</button>' +
          (item.source === 'synth' ? '' : '<button type="button" class="music-row-delete" data-music-delete="' + id + '" aria-label="删除歌曲">×</button>') +
        '</div>' +
      '</div>';
    }).join('');
    renderProgress();
  };

  function clearTaTimers() {
    clearTimeout(taTimer);
    clearTimeout(taResumeTimer);
    taTimer = null;
    taResumeTimer = null;
  }

  function taProb(key, fallback) {
    const contact = App.state.contacts.find(function (c) { return c.id === App.state.currentContactId; });
    const value = Number(App.contactSettings(contact)[key]);
    if (isNaN(value)) return fallback / 100;
    return Math.max(0, Math.min(100, value)) / 100;
  }

  function scheduleTa() {
    clearTimeout(taTimer);
    taTimer = null;
    if (!playing || document.hidden || !App.state.currentContactId) return;
    taTimer = setTimeout(function () {
      taTimer = null;
      if (!playing || document.hidden) return;
      const pFav = taProb('musicFavProb', 25);
      const pSwitch = taProb('musicSwitchProb', 30);
      const pPause = taProb('musicPauseProb', 15);
      const roll = Math.random();
      if (roll < pFav) {
        toggleFavorite(currentTrack().id, 'ta');
        scheduleTa();
      } else if (roll < pFav + pSwitch) {
        changeTrack(Math.random() < 0.5 ? -1 : 1, true, Math.random() < 0.5);
      } else if (roll < pFav + pSwitch + pPause) {
        pauseByTa();
      } else {
        scheduleTa();
      }
    }, 20000 + Math.random() * 15000);
  }

  function pauseByTa() {
    const contact = App.state.contacts.find(function (c) { return c.id === App.state.currentContactId; });
    clearTimeout(taTimer);
    stopPlayback();
    statusText = 'TA 暂停了音乐';
    App.renderMusic();
    if (contact && App.addChatSystemMessage) App.addChatSystemMessage(contact.id, contact.name + '暂停了音乐');
    clearTimeout(taResumeTimer);
    taResumeTimer = setTimeout(function () {
      taResumeTimer = null;
      if (document.hidden || playing) return;
      if (Math.random() >= taProb('musicPlayProb', 60)) {
        App.renderMusic();
        return;
      }
      playCurrent().then(function (ok) {
        if (ok && contact && App.addChatSystemMessage) App.addChatSystemMessage(contact.id, contact.name + '播放了音乐');
      });
    }, 4000 + Math.random() * 3000);
  }

  function stopSynth() {
    clearInterval(synth.timer);
    clearTimeout(synth.endTimer);
    synth.timer = null;
    synth.endTimer = null;
  }

  function stopPlayback() {
    playing = false;
    stopSynth();
    if (!audio.paused) audio.pause();
  }

  function releaseAudioSource() {
    mediaToken++;
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    audioTrackId = '';
    audio.removeAttribute('src');
  }

  function playTone(freq, time, duration, volume) {
    const oscillator = synth.context.createOscillator();
    const gain = synth.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(synth.context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
  }

  function scheduleSynth() {
    const track = currentTrack();
    const def = track && SYNTH[track.id];
    if (!playing || !def) return;
    const beat = 60 / def.tempo;
    while (synth.step < def.notes.length && synth.nextTime < synth.context.currentTime + 0.25) {
      const note = def.notes[synth.step];
      playTone(note, synth.nextTime, beat * 0.85, 0.065);
      if (synth.step % 4 === 0) playTone(note / 2, synth.nextTime, beat * 1.8, 0.025);
      synth.step++;
      synth.nextTime += beat;
    }
    renderProgress();
    if (synth.step >= def.notes.length && !synth.endTimer) {
      synth.endTimer = setTimeout(function () {
        synth.endTimer = null;
        if (playing && currentTrack().id === track.id) handleEnded();
      }, Math.max(0, (synth.nextTime - synth.context.currentTime) * 1000));
    }
  }

  function startSynth(track) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      App.toast('当前浏览器不支持音乐播放');
      return Promise.resolve(false);
    }
    if (!synth.context) synth.context = new AudioContext();
    const def = SYNTH[track.id];
    if (synth.trackId !== track.id || synth.step >= def.notes.length) synth.step = 0;
    synth.trackId = track.id;
    return synth.context.resume().then(function () {
      stopSynth();
      playing = true;
      statusText = '';
      synth.nextTime = synth.context.currentTime + 0.08;
      scheduleSynth();
      synth.timer = setInterval(scheduleSynth, 80);
      App.renderMusic();
      scheduleTa();
      return true;
    }).catch(function () {
      App.toast('音乐播放失败，请再点一次播放');
      return false;
    });
  }

  function prepareAudio(track) {
    if (audioTrackId === track.id && audio.getAttribute('src')) return Promise.resolve(true);
    releaseAudioSource();
    const token = mediaToken;
    const setSource = function (src) {
      if (token !== mediaToken || currentTrack().id !== track.id) return false;
      objectUrl = src.indexOf('blob:') === 0 ? src : '';
      audioTrackId = track.id;
      audio.src = src;
      audio.load();
      return true;
    };
    if (track.source === 'local') {
      return getAudio(track.id).then(function (blob) {
        if (!blob) throw new Error('本地音频文件缺失，请删除后重新导入');
        if (token !== mediaToken || currentTrack().id !== track.id) return false;
        return setSource(URL.createObjectURL(blob));
      });
    }
    let candidate = track.audioUrl || track.url;
    if (track.source === 'netease' && !isAudioFileUrl(candidate)) {
      const id = neteaseId(track.pageUrl || track.url);
      if (id) candidate = neteaseAudioUrl(id);
    }
    const src = safeUrl(candidate);
    if (!src) return Promise.reject(new Error('音频链接无效，请重新导入'));
    return Promise.resolve(setSource(src));
  }

  function playCurrent() {
    const track = currentTrack();
    if (!track) {
      App.toast('播放列表是空的，先导入一首歌');
      return Promise.resolve(false);
    }
    clearTaTimers();
    statusText = '';
    if (track.source === 'synth') {
      releaseAudioSource();
      return startSynth(track);
    }
    stopSynth();
    statusText = '正在加载音频…';
    App.renderMusic();
    return prepareAudio(track).then(function (ready) {
      if (!ready) return false;
      return audio.play().then(function () {
        playing = true;
        statusText = '';
        App.renderMusic();
        scheduleTa();
        return true;
      });
    }).catch(function (err) {
      if (currentTrack().id !== track.id) return false;
      playing = false;
      statusText = track.source === 'netease'
        ? '这首歌需要会员或受版权限制，无法站外播放；请打开原平台或导入本地音频'
        : (track.source === 'kugou'
          ? '酷狗页面无法直接播放，请打开原平台或导入本地音频'
          : (err && /本地音频文件缺失|音频链接无效/.test(err.message || '')
            ? err.message
            : (err && err.name === 'NotAllowedError' ? '浏览器阻止了播放，请再点一次播放' : '音频加载失败，请检查直链或改从本地导入')));
      App.renderMusic();
      App.toast(statusText);
      return false;
    });
  }

  function togglePlay() {
    clearTaTimers();
    if (playing) {
      stopPlayback();
      statusText = '已暂停';
      App.renderMusic();
    } else {
      playCurrent();
    }
  }

  function selectTrack(id, autoplay) {
    if (!tracks().some(function (track) { return track.id === id; })) return Promise.resolve(false);
    clearTaTimers();
    stopPlayback();
    releaseAudioSource();
    App.state.music.currentId = id;
    synth.step = 0;
    synth.trackId = id;
    statusText = '';
    App.save();
    App.renderMusic();
    return autoplay ? playCurrent() : Promise.resolve(true);
  }

  function changeTrack(direction, autoplay, random) {
    const list = tracks();
    if (!list.length) return Promise.resolve(false);
    const currentIndex = list.findIndex(function (track) { return track.id === App.state.music.currentId; });
    let nextIndex;
    if (random && list.length > 1) {
      do { nextIndex = Math.floor(Math.random() * list.length); } while (nextIndex === currentIndex);
    } else {
      nextIndex = (Math.max(0, currentIndex) + direction + list.length) % list.length;
    }
    return selectTrack(list[nextIndex].id, autoplay);
  }

  function handleEnded() {
    clearTaTimers();
    stopPlayback();
    const track = currentTrack();
    if (!track) return;
    if (App.state.music.mode === 'repeat') selectTrack(track.id, true);
    else changeTrack(1, true, App.state.music.mode === 'shuffle');
  }

  function toggleFavorite(id, side) {
    if (!id) return;
    const list = App.state.music.favorites[side];
    const index = list.indexOf(id);
    if (index === -1) list.push(id);
    else list.splice(index, 1);
    App.save();
    App.renderMusic();
  }

  /* IndexedDB 只保存本地音频 Blob，歌名等元数据仍放在 localStorage。
     统一由 store.js 打开媒体库，保证和语音共用同一个版本。 */
  function openMediaDB() {
    return App.openMediaDB();
  }
  function withStore(mode, operation) {
    return openMediaDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('audio', mode);
        const request = operation(tx.objectStore('audio'));
        let result;
        if (request) request.onsuccess = function () { result = request.result; };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('音频存储失败')); };
        tx.onabort = function () { reject(tx.error || new Error('音频存储已取消')); };
      });
    });
  }
  function putAudio(id, blob) { return withStore('readwrite', function (store) { return store.put({ id: id, blob: blob }); }); }
  function getAudio(id) {
    return withStore('readonly', function (store) { return store.get(id); }).then(function (record) { return record && record.blob; });
  }
  function deleteAudio(id) { return withStore('readwrite', function (store) { return store.delete(id); }); }
  function clearAudio() { return withStore('readwrite', function (store) { return store.clear(); }); }

  App.resetMusicMedia = function () {
    clearTaTimers();
    stopPlayback();
    releaseAudioSource();
    synth.step = 0;
    synth.trackId = '';
    statusText = '';
    return clearAudio().catch(function () {});
  };

  function cleanBaseName(name) {
    let value = String(name || '未命名歌曲');
    try { value = decodeURIComponent(value); } catch (e) {}
    return value.replace(/\.[a-z0-9]{2,5}$/i, '').trim() || '未命名歌曲';
  }
  function localNameParts(name) {
    const base = cleanBaseName(name);
    const split = base.match(/^(.+?)\s+-\s+(.+)$/);
    return split ? { title: split[2].trim(), artist: split[1].trim() } : { title: base, artist: '' };
  }
  function urlNameParts(url) {
    try {
      const parsed = new URL(url);
      return localNameParts(parsed.pathname.split('/').pop());
    } catch (e) { return { title: '未命名歌曲', artist: '' }; }
  }
  function neteaseId(url) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)163\.com$/.test(parsed.hostname)) return '';
      const hash = (parsed.hash || '').replace(/^#\/?/, '');
      const query = parsed.search + '&' + hash;
      const match = query.match(/(?:^|[?&#])id=(\d+)/);
      if (match) return match[1];
      const path = parsed.pathname.match(/\/song\/(\d+)/);
      return path ? path[1] : '';
    } catch (e) { return ''; }
  }
  /* 网易云官方外链播放地址：免费歌曲可直接播放，会员或受限歌曲会跳转到 404。 */
  function neteaseAudioUrl(id) {
    return id ? 'https://music.163.com/song/media/outer/url?id=' + id + '.mp3' : '';
  }
  function isNeteaseUrl(url) {
    try { return /(^|\.)(163cn\.tv|163\.com)$/.test(new URL(url).hostname); } catch (e) { return false; }
  }
  function fetchTextViaProxy(url) {
    const enc = encodeURIComponent;
    const proxies = [
      function (u, signal) { return fetch('https://api.allorigins.win/raw?url=' + enc(u), { signal: signal }).then(function (res) { return res.ok ? res.text() : Promise.reject(new Error('raw ' + res.status)); }); },
      function (u, signal) { return fetch('https://api.allorigins.win/get?url=' + enc(u), { signal: signal }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('get ' + res.status)); }).then(function (data) { return data.contents || ''; }); },
      function (u, signal) { return fetch('https://corsproxy.io/?url=' + enc(u), { signal: signal }).then(function (res) { return res.ok ? res.text() : Promise.reject(new Error('corsproxy ' + res.status)); }); },
      function (u, signal) { return fetch('https://api.codetabs.com/v1/proxy/?quest=' + enc(u), { signal: signal }).then(function (res) { return res.ok ? res.text() : Promise.reject(new Error('codetabs ' + res.status)); }); }
    ];
    const run = function (fetchOne) {
      const controller = window.AbortController ? new AbortController() : null;
      const timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
      return fetchOne(url, controller ? controller.signal : undefined).then(function (text) {
        if (!text) throw new Error('empty');
        return text;
      }).finally(function () { if (timer) clearTimeout(timer); });
    };
    return proxies.reduce(function (chain, fetchOne) {
      return chain.catch(function () { return run(fetchOne); });
    }, Promise.reject(new Error('start'))).catch(function () { return ''; });
  }
  function decodeHtml(value) {
    const span = document.createElement('span');
    span.innerHTML = String(value || '');
    return span.textContent || '';
  }
  function parseMeta(html, property) {
    const tags = (html || '').match(/<meta\b[^>]*>/gi) || [];
    const propertyRe = new RegExp('property\\s*=\\s*"' + property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'i');
    for (let i = 0; i < tags.length; i++) {
      if (propertyRe.test(tags[i])) {
        const content = tags[i].match(/content\s*=\s*"([^"]*)"/i);
        return content ? decodeHtml(content[1]) : '';
      }
    }
    return '';
  }
  function parseNeteaseHtml(html) {
    if (!html) return {};
    const ogUrl = parseMeta(html, 'og:url');
    const result = { id: ogUrl ? neteaseId(ogUrl) : '', title: parseMeta(html, 'og:title'), artist: parseMeta(html, 'og:music:artist'), pageUrl: ogUrl || '' };
    if (!result.title || !result.artist) {
      const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleTag) {
        const raw = decodeHtml(titleTag[1]).replace(/\s*[-–—]\s*网易云音乐[\s\S]*$/, '').trim();
        const parts = raw.split(/\s*[-–—]\s*/);
        if (!result.title && parts[0]) result.title = parts[0].trim();
        if (!result.artist && parts[1]) result.artist = parts[1].trim();
      }
    }
    return result;
  }
  function parseNeteaseTitle(title) {
    const parts = String(title || '').split(/\s+-\s+/).filter(Boolean);
    const clean = function (value) { return value.replace(/(单曲|专辑|歌单|MV|视频|网易云音乐)$/g, '').trim(); };
    return { title: clean(parts[0] || ''), artist: clean(parts[1] || '') };
  }
  /* Microlink 支持跨域并会跟随短链跳转，可直接拿到最终歌曲页和标题。 */
  function fetchMicrolink(url) {
    const controller = window.AbortController ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
    return fetch('https://api.microlink.io/?url=' + encodeURIComponent(url), { signal: controller ? controller.signal : undefined })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('microlink ' + res.status)); })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (!data || data.status !== 'success' || !data.data) return {};
        const names = parseNeteaseTitle(data.data.title);
        const finalUrl = data.data.url || '';
        return { id: neteaseId(finalUrl), pageUrl: finalUrl, title: names.title, artist: names.artist };
      })
      .catch(function () { if (timer) clearTimeout(timer); return {}; });
  }
  function resolveNetease(url) {
    const directId = neteaseId(url);
    const pageUrl = directId ? 'https://music.163.com/song?id=' + directId : url;
    return fetchMicrolink(url).then(function (info) {
      if (info.id) return info;
      return fetchTextViaProxy(pageUrl).then(function (html) {
        const meta = parseNeteaseHtml(html);
        return {
          id: meta.id || directId || '',
          pageUrl: meta.pageUrl || pageUrl,
          title: meta.title || '',
          artist: meta.artist || ''
        };
      });
    });
  }
  function isAudioFileUrl(url) {
    return /\.(mp3|m4a|aac|ogg|wav|flac)(\?|#|$)/i.test(url || '');
  }
  function importLink(e) {
    e.preventDefault();
    const input = el('#music-url');
    const titleInput = el('#music-track-title');
    const artistInput = el('#music-track-artist');
    const status = el('#music-link-status');
    const url = safeUrl(input.value.trim());
    if (!url) {
      status.textContent = '请输入有效的 http 或 https 音频链接。';
      input.focus();
      return;
    }
    if (isNeteaseUrl(url)) {
      status.textContent = '正在识别网易云歌曲信息…';
      resolveNetease(url).then(function (info) {
        if (!info.id) throw new Error('未识别到网易云歌曲，请粘贴歌曲页面链接。');
        tracks().push({
          id: App.uid('track'),
          title: titleInput.value.trim() || info.title || '网易云音乐',
          artist: artistInput.value.trim() || info.artist || '未知歌手',
          source: 'netease',
          url: url,
          pageUrl: info.pageUrl,
          audioUrl: neteaseAudioUrl(info.id),
          createdAt: Date.now(),
        });
        App.save();
        App.renderMusic();
        el('#music-link-form').reset();
        status.textContent = '已识别网易云歌曲并加入播放列表；受版权或会员限制的歌曲可能无法站外播放。';
        App.toast('网易云歌曲已加入播放列表');
      }).catch(function (err) {
        status.textContent = err && err.message ? err.message : '网易云链接识别失败，请粘贴歌曲页面链接或导入本地音频。';
      });
      return;
    }
    const parts = urlNameParts(url);
    tracks().push({
      id: App.uid('track'),
      title: titleInput.value.trim() || parts.title,
      artist: artistInput.value.trim() || parts.artist || '未知歌手',
      source: 'url',
      url: url,
      createdAt: Date.now(),
    });
    App.save();
    App.renderMusic();
    el('#music-link-form').reset();
    status.textContent = '已加入播放列表，点击歌曲即可播放；若加载失败，请检查直链是否有效。';
    App.toast('歌曲已加入播放列表');
  }

  function importLocalFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    el('#music-local-status').textContent = '正在保存音频到本机…';
    let added = 0;
    let failed = 0;
    files.reduce(function (chain, file) {
      return chain.then(function () {
        const audioFile = /^audio\//.test(file.type) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
        if (!audioFile) { failed++; return; }
        const id = App.uid('track');
        return putAudio(id, file).then(function () {
          const parts = localNameParts(file.name);
          tracks().push({ id: id, title: parts.title, artist: parts.artist || '未知歌手', source: 'local', fileName: file.name, createdAt: Date.now() });
          added++;
        }).catch(function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      App.save();
      App.renderMusic();
      el('#music-local-status').textContent = '已导入 ' + added + ' 首' + (failed ? '，' + failed + ' 个文件失败' : '') + '；刷新后仍可播放。';
      App.toast(added ? '本地音频导入完成' : '没有可导入的音频');
    });
  }

  function deleteTrack(id) {
    const track = tracks().find(function (item) { return item.id === id; });
    if (!track || track.source === 'synth') return;
    if (!confirm('删除「' + track.title + '」？本地音频文件也会一并删除。')) return;
    clearTaTimers();
    const index = tracks().indexOf(track);
    if (App.state.music.currentId === id) {
      stopPlayback();
      releaseAudioSource();
      const next = tracks()[index + 1] || tracks()[index - 1];
      App.state.music.currentId = next ? next.id : '';
      synth.step = 0;
      synth.trackId = '';
    }
    App.state.music.tracks = tracks().filter(function (item) { return item.id !== id; });
    App.state.music.favorites.mine = App.state.music.favorites.mine.filter(function (item) { return item !== id; });
    App.state.music.favorites.ta = App.state.music.favorites.ta.filter(function (item) { return item !== id; });
    if (track.source === 'local') deleteAudio(id).catch(function () {});
    App.save();
    App.renderMusic();
    App.toast('已删除歌曲');
  }

  function openEdit(id) {
    const track = tracks().find(function (item) { return item.id === id; });
    if (!track) return;
    el('#music-edit-id').value = track.id;
    el('#music-edit-title').value = track.title;
    el('#music-edit-artist').value = track.artist;
    el('#music-edit-dialog').showModal();
  }

  function keepMusicFloatInside() {
    const box = el('#chat-music-float');
    if (!box.style.left) return;
    const viewRect = el('#view-chat').getBoundingClientRect();
    const rect = box.getBoundingClientRect();
    const minTop = el('.chat-topbar').getBoundingClientRect().bottom - viewRect.top + 8;
    const maxTop = Math.max(minTop, el('#composer').getBoundingClientRect().top - viewRect.top - rect.height - 8);
    const maxLeft = Math.max(8, viewRect.width - rect.width - 8);
    const left = Math.max(8, Math.min(maxLeft, parseFloat(box.style.left) || 0));
    const top = Math.max(minTop, Math.min(maxTop, parseFloat(box.style.top) || minTop));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }

  function setMusicFloatMinimized(minimized) {
    const box = el('#chat-music-float');
    const toggle = el('#chat-music-toggle');
    const scroller = el('#chat-scroll');
    const beforeHeight = scroller.scrollHeight;
    const beforeTop = scroller.scrollTop;
    box.classList.toggle('is-minimized', minimized);
    el('#view-chat').classList.toggle('music-is-minimized', minimized);
    /* 卡片高度变化会改变聊天区的顶部留白，这里同步滚动量，避免聊天内容被顶动。 */
    const delta = scroller.scrollHeight - beforeHeight;
    if (delta) {
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollTop = beforeTop + delta;
      scroller.style.scrollBehavior = '';
    }
    toggle.setAttribute('aria-expanded', String(!minimized));
    toggle.setAttribute('aria-label', minimized ? '展开音乐卡片' : '缩小音乐卡片');
    toggle.title = minimized ? '展开' : '缩小';
    toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + (minimized ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6') + '"/></svg>';
    keepMusicFloatInside();
  }

  function initMusicFloatDrag() {
    const box = el('#chat-music-float');
    let drag = null;

    box.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      const viewRect = el('#view-chat').getBoundingClientRect();
      const rect = box.getBoundingClientRect();
      drag = { pointerId: e.pointerId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, viewRect: viewRect };
      box.style.left = (rect.left - viewRect.left) + 'px';
      box.style.top = (rect.top - viewRect.top) + 'px';
      box.style.transform = 'none';
      box.classList.add('is-dragging');
      box.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    box.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const rect = box.getBoundingClientRect();
      const viewRect = drag.viewRect;
      const minTop = el('.chat-topbar').getBoundingClientRect().bottom - viewRect.top + 8;
      const maxTop = Math.max(minTop, el('#composer').getBoundingClientRect().top - viewRect.top - rect.height - 8);
      const maxLeft = Math.max(8, viewRect.width - rect.width - 8);
      const left = Math.max(8, Math.min(maxLeft, e.clientX - viewRect.left - drag.offsetX));
      const top = Math.max(minTop, Math.min(maxTop, e.clientY - viewRect.top - drag.offsetY));
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (box.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
      drag = null;
      box.classList.remove('is-dragging');
    }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', keepMusicFloatInside);
  }

  App.initMusic = function () {
    el('#w-play').addEventListener('click', togglePlay);
    el('#w-prev').addEventListener('click', function () { changeTrack(-1, playing, false); });
    el('#w-next').addEventListener('click', function () { changeTrack(1, playing, App.state.music.mode === 'shuffle'); });
    el('#music-play').addEventListener('click', togglePlay);
    el('#music-prev').addEventListener('click', function () { changeTrack(-1, playing, false); });
    el('#music-next').addEventListener('click', function () { changeTrack(1, playing, App.state.music.mode === 'shuffle'); });
    el('#chat-music-play').addEventListener('click', togglePlay);
    el('#chat-music-prev').addEventListener('click', function () { changeTrack(-1, playing, false); });
    el('#chat-music-next').addEventListener('click', function () { changeTrack(1, playing, App.state.music.mode === 'shuffle'); });
    el('#chat-music-favorite').addEventListener('click', function () {
      const track = currentTrack();
      if (track) toggleFavorite(track.id, 'mine');
    });
    el('#chat-music-toggle').addEventListener('click', function () {
      setMusicFloatMinimized(!el('#chat-music-float').classList.contains('is-minimized'));
    });
    el('#chat-music-close').addEventListener('click', function () {
      App.state.music.chatFloat = false;
      App.save();
      applyMusicFloatState();
      App.toast('已关闭聊天音乐小窗，可在音乐页重新开启');
    });
    el('#music-float-switch').addEventListener('click', function () {
      App.state.music.chatFloat = !(App.state.music.chatFloat !== false);
      App.save();
      applyMusicFloatState();
      App.toast(App.state.music.chatFloat ? '聊天音乐小窗已开启' : '聊天音乐小窗已关闭');
    });
    initMusicFloatDrag();
    el('#music-mode').addEventListener('click', function () {
      const modes = ['sequence', 'repeat', 'shuffle'];
      const next = (modes.indexOf(App.state.music.mode) + 1) % modes.length;
      App.state.music.mode = modes[next];
      App.save();
      App.renderMusic();
    });
    el('#music-favorite').addEventListener('click', function () {
      const track = currentTrack();
      if (track) toggleFavorite(track.id, 'mine');
    });
    el('#music-link-form').addEventListener('submit', importLink);
    el('#music-local-button').addEventListener('click', function () { el('#music-local-file').click(); });
    el('#music-local-file').addEventListener('change', function (e) {
      const files = Array.from(e.target.files);
      e.target.value = '';
      importLocalFiles(files);
    });

    el('#music-list').addEventListener('click', function (e) {
      const select = e.target.closest('[data-music-select]');
      if (select) {
        if (select.dataset.musicSelect === App.state.music.currentId) togglePlay();
        else selectTrack(select.dataset.musicSelect, true);
        return;
      }
      const favorite = e.target.closest('[data-music-favorite]');
      if (favorite) { toggleFavorite(favorite.dataset.musicFavorite, 'mine'); return; }
      const edit = e.target.closest('[data-music-edit]');
      if (edit) { openEdit(edit.dataset.musicEdit); return; }
      const remove = e.target.closest('[data-music-delete]');
      if (remove) deleteTrack(remove.dataset.musicDelete);
    });

    el('#music-edit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const track = tracks().find(function (item) { return item.id === el('#music-edit-id').value; });
      if (!track) return;
      const title = el('#music-edit-title').value.trim();
      if (!title) return;
      track.title = title;
      track.artist = el('#music-edit-artist').value.trim() || '未知歌手';
      App.save();
      el('#music-edit-dialog').close();
      App.renderMusic();
      App.toast('歌曲信息已更新');
    });

    audio.addEventListener('timeupdate', renderProgress);
    audio.addEventListener('loadedmetadata', function () { statusText = ''; renderProgress(); });
    audio.addEventListener('play', function () { playing = true; App.renderMusic(); });
    audio.addEventListener('pause', function () {
      if (!audioTrackId || audioTrackId !== App.state.music.currentId) return;
      playing = false;
      clearTimeout(taTimer);
      App.renderMusic();
    });
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', function () {
      if (!audioTrackId || audioTrackId !== App.state.music.currentId) return;
      clearTaTimers();
      playing = false;
      const track = currentTrack();
      statusText = track.source === 'netease'
        ? '这首歌需要会员或受版权限制，无法站外播放；请打开原平台或导入本地音频'
        : (track.source === 'kugou'
          ? '酷狗页面无法直接播放，请打开原平台或导入本地音频'
          : '音频加载失败，请检查链接或重新导入');
      App.renderMusic();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTaTimers();
      else if (playing) scheduleTa();
    });
    App.renderMusic();
  };
})();
