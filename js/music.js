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
  let recognizedAudioUrl = '';
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
    el('#music-duration').textContent = formatTime(progress.duration);
    el('#music-progress-fill').style.width = (ratio * 100) + '%';
    el('#w-progress').style.width = (ratio * 100) + '%';
  }

  App.renderMusic = function () {
    if (!App.state || !App.state.music) return;
    const track = currentTrack();
    if (!track) return;
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

  function scheduleTa() {
    clearTimeout(taTimer);
    taTimer = null;
    if (!playing || document.hidden || !App.state.currentContactId) return;
    taTimer = setTimeout(function () {
      taTimer = null;
      if (!playing || document.hidden) return;
      const roll = Math.random();
      if (roll < 0.35) {
        toggleFavorite(currentTrack().id, 'ta');
        scheduleTa();
      } else if (roll < 0.75) {
        const direction = roll < 0.45 ? -1 : 1;
        changeTrack(direction, true, roll >= 0.6);
      } else {
        pauseByTa();
      }
    }, 20000 + Math.random() * 15000);
  }

  function pauseByTa() {
    const contact = App.state.contacts.find(function (c) { return c.id === App.state.currentContactId; });
    clearTimeout(taTimer);
    stopPlayback();
    statusText = 'TA 暂停了音乐，稍后会重新播放';
    App.renderMusic();
    if (contact && App.addChatSystemMessage) App.addChatSystemMessage(contact.id, contact.name + '暂停了音乐');
    clearTimeout(taResumeTimer);
    taResumeTimer = setTimeout(function () {
      taResumeTimer = null;
      if (document.hidden || playing) return;
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
    const src = safeUrl(track.audioUrl || track.url);
    if (!src) return Promise.reject(new Error('音频链接无效，请重新导入'));
    return Promise.resolve(setSource(src));
  }

  function playCurrent() {
    const track = currentTrack();
    if (!track) return Promise.resolve(false);
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
      statusText = track.source === 'netease' || track.source === 'kugou'
        ? '原平台页面无法直接播放，请打开原平台或导入本地音频'
        : (err && /本地音频文件缺失|音频链接无效/.test(err.message || '')
          ? err.message
          : (err && err.name === 'NotAllowedError' ? '浏览器阻止了播放，请再点一次播放' : '音频加载失败，请检查直链或改从本地导入'));
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
    if (App.state.music.mode === 'repeat') selectTrack(currentTrack().id, true);
    else changeTrack(1, true, App.state.music.mode === 'shuffle');
  }

  function toggleFavorite(id, side) {
    const list = App.state.music.favorites[side];
    const index = list.indexOf(id);
    if (index === -1) list.push(id);
    else list.splice(index, 1);
    App.save();
    App.renderMusic();
  }

  /* IndexedDB 只保存本地音频 Blob，歌名等元数据仍放在 localStorage。 */
  let dbPromise = null;
  function openMediaDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('当前浏览器不支持本地音频存储'));
      const request = indexedDB.open('xuyu-media', 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains('audio')) request.result.createObjectStore('audio', { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('音频库打开失败')); };
    });
    return dbPromise;
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
  function platformNameParts(text) {
    const clean = String(text || '').replace(/\s*[-_丨|]?\s*(单曲|MV)?\s*[-_丨|]?\s*(网易云音乐|酷狗音乐|酷狗).*$/i, '').trim();
    const split = clean.match(/^(.+?)\s+-\s+(.+)$/);
    return split ? { title: split[1].trim(), artist: split[2].trim() } : { title: clean, artist: '' };
  }
  function urlNameParts(url) {
    try {
      const parsed = new URL(url);
      return localNameParts(parsed.pathname.split('/').pop());
    } catch (e) { return { title: '未命名歌曲', artist: '' }; }
  }
  function sourceForUrl(url) {
    try {
      const host = new URL(url).hostname;
      if (/(^|\.)163\.com$/.test(host)) return 'netease';
      if (/(^|\.)kugou\.com$/.test(host)) return 'kugou';
    } catch (e) {}
    return 'url';
  }
  function fetchPlatformMetadata(url) {
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 6000);
    return fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal }).then(function (response) {
      if (!response.ok) throw new Error('平台页面读取失败');
      return response.text();
    }).then(function (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const meta = function (property) {
        const node = doc.querySelector('meta[property="' + property + '"],meta[name="' + property + '"]');
        return node ? node.getAttribute('content') || '' : '';
      };
      return {
        title: meta('og:title') || (doc.title || ''),
        audioUrl: safeUrl(meta('og:audio') || meta('og:audio:url') || meta('twitter:player:stream')),
      };
    }).finally(function () { clearTimeout(timeout); });
  }

  function identifyLink() {
    const input = el('#music-url');
    const url = safeUrl(input.value.trim());
    if (!url) {
      el('#music-link-status').textContent = '请输入有效的 http 或 https 链接。';
      input.focus();
      return;
    }
    input.value = url;
    recognizedAudioUrl = '';
    const source = sourceForUrl(url);
    const fallback = urlNameParts(url);
    el('#music-track-title').value = fallback.title;
    el('#music-track-artist').value = fallback.artist;
    if (source === 'url') {
      el('#music-link-status').textContent = '已从链接读取文件名，可修改歌名和歌手后导入。';
      return;
    }
    const button = el('#music-identify');
    button.disabled = true;
    el('#music-link-status').textContent = '正在读取平台公开信息…';
    fetchPlatformMetadata(url).then(function (meta) {
      const parts = platformNameParts(meta.title);
      if (parts.title) el('#music-track-title').value = parts.title;
      if (parts.artist) el('#music-track-artist').value = parts.artist;
      recognizedAudioUrl = meta.audioUrl || '';
      el('#music-link-status').textContent = parts.title
        ? '已识别公开信息，请确认后导入；能否播放仍以实际加载为准。'
        : '没有读到歌曲信息，请手动补全后导入。';
    }).catch(function () {
      el('#music-link-status').textContent = '平台限制了自动读取，请手动补全歌名和歌手后导入。';
    }).finally(function () { button.disabled = false; });
  }

  function importLink(e) {
    e.preventDefault();
    const url = safeUrl(el('#music-url').value.trim());
    if (!url) {
      el('#music-link-status').textContent = '请输入有效的 http 或 https 链接。';
      return;
    }
    const title = el('#music-track-title').value.trim() || urlNameParts(url).title;
    const artist = el('#music-track-artist').value.trim() || '未知歌手';
    const source = sourceForUrl(url);
    const track = {
      id: App.uid('track'),
      title: title,
      artist: artist,
      source: source,
      url: recognizedAudioUrl || url,
      pageUrl: url,
      createdAt: Date.now(),
    };
    tracks().push(track);
    App.save();
    App.renderMusic();
    el('#music-link-form').reset();
    recognizedAudioUrl = '';
    el('#music-link-status').textContent = source === 'url'
      ? '已加入播放列表，点击歌曲时会验证音频直链是否可播放。'
      : '已加入播放列表；若平台页面不能播放，请打开原平台或改用本地音频。';
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

  App.initMusic = function () {
    el('#w-play').addEventListener('click', togglePlay);
    el('#w-prev').addEventListener('click', function () { changeTrack(-1, playing, false); });
    el('#w-next').addEventListener('click', function () { changeTrack(1, playing, App.state.music.mode === 'shuffle'); });
    el('#music-play').addEventListener('click', togglePlay);
    el('#music-prev').addEventListener('click', function () { changeTrack(-1, playing, false); });
    el('#music-next').addEventListener('click', function () { changeTrack(1, playing, App.state.music.mode === 'shuffle'); });
    el('#music-mode').addEventListener('click', function () {
      const modes = ['sequence', 'repeat', 'shuffle'];
      const next = (modes.indexOf(App.state.music.mode) + 1) % modes.length;
      App.state.music.mode = modes[next];
      App.save();
      App.renderMusic();
    });
    el('#music-favorite').addEventListener('click', function () { toggleFavorite(currentTrack().id, 'mine'); });
    el('#music-identify').addEventListener('click', identifyLink);
    el('#music-url').addEventListener('input', function () { recognizedAudioUrl = ''; });
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
      statusText = track.source === 'netease' || track.source === 'kugou'
        ? '原平台页面无法直接播放，请打开原平台或导入本地音频'
        : '音频加载失败，请检查链接或重新导入';
      App.renderMusic();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTaTimers();
      else if (playing) scheduleTa();
    });
    App.renderMusic();
  };
})();
