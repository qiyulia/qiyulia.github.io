/* 桌面与联系人 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function greeting(hour) {
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 23) return '晚上好';
    return '夜深了';
  }

  function pickDailyCard() {
    const enabled = App.state.cards.filter(function (c) { return c.enabled && c.text; });
    if (!enabled.length) return null;
    const now = new Date();
    const key = '' + now.getFullYear() + (now.getMonth() + 1) + now.getDate();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return enabled[hash % enabled.length];
  }

  App.renderDesktop = function () {
    const st = App.state;
    const now = new Date();
    el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    el('#d-date').textContent = App.fmtDate(now);
    el('#d-greeting').textContent = greeting(now.getHours());
    el('#d-days').textContent = App.daysSince(st.profile.since);
    el('#d-since').textContent = st.profile.since ? '自 ' + st.profile.since.replace(/-/g, '.') : '';

    const daily = pickDailyCard();
    el('#d-today-card').textContent = daily ? daily.text : '字卡库空空的，去添几张吧。';

    renderWidgets(now);
    renderStrip();
    App.renderContacts();
    App.updateBadges();
  };

  /* ---------- 小组件 ---------- */
  function nextAnniversary(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = new Date(today.getFullYear(), parts[1] - 1, parts[2]);
    if (next < today) next = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2]);
    return {
      days: Math.round((next - today) / 86400000),
      label: (next.getMonth() + 1) + '月' + next.getDate() + '日',
    };
  }

  function renderCalendar(now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    el('#w-month').textContent = year + '年' + (month + 1) + '月';
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<span class="is-outside"></span>';
    for (let day = 1; day <= total; day++) {
      html += '<span' + (day === now.getDate() ? ' class="is-today"' : '') + '>' + day + '</span>';
    }
    el('#w-calendar').innerHTML = html;
  }

  function renderWidgets(now) {
    const st = App.state;
    renderCalendar(now);

    el('#w-days').textContent = App.daysSince(st.profile.since);
    const anniversary = nextAnniversary(st.profile.since);
    el('#w-next').textContent = anniversary
      ? (anniversary.days === 0 ? '就是今天，纪念日快乐。' : '距 ' + anniversary.label + ' 还有 ' + anniversary.days + ' 天')
      : '在设置里写下你们的纪念日。';
    el('#w-since').textContent = st.profile.since ? '始于 ' + st.profile.since.replace(/-/g, '.') : '';

    const notes = el('#w-notes');
    if (document.activeElement !== notes) notes.value = st.notes;
    el('#w-notes-count').textContent = st.notes.length + ' / 500';
    App.applyIconStyle();
    renderMusic();
  }

  /* ---------- 图标美化 ---------- */
  const ICON_COLORS = { blue: '#6b9ed2', lilac: '#a18bc4', sage: '#79a98d', apricot: '#d99b72' };

  App.applyIconStyle = function () {
    const style = App.state.iconStyle;
    const app = el('#app');
    const radius = { rounded: '12px', circle: '50%', square: '5px' }[style.shape];
    app.style.setProperty('--icon-radius', radius);
    app.style.setProperty('--icon-bg', ICON_COLORS[style.color]);
    app.style.setProperty('--icon-fg', '#ffffff');
    document.querySelectorAll('[data-icon-shape]').forEach(function (btn) {
      const active = btn.dataset.iconShape === style.shape;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-icon-color]').forEach(function (btn) {
      const active = btn.dataset.iconColor === style.color;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };

  /* ---------- 离线音乐：Web Audio 合成短旋律 ---------- */
  const TRACKS = [
    { title: '晚风', artist: '絮语电台 · 轻柔旋律', tempo: 92, notes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66] },
    { title: '云端漫步', artist: '絮语电台 · 明亮琴音', tempo: 108, notes: [329.63, 392, 493.88, 587.33, 493.88, 392, 349.23, 440, 523.25, 659.25, 523.25, 440, 392, 493.88, 587.33, 493.88] },
    { title: '枕边星', artist: '絮语电台 · 睡前慢板', tempo: 72, notes: [220, 261.63, 329.63, 261.63, 196, 246.94, 293.66, 246.94, 174.61, 220, 261.63, 329.63, 293.66, 261.63, 246.94, 196] },
  ];
  const music = { index: 0, playing: false, step: 0, context: null, timer: null, nextTime: 0 };

  function renderMusic() {
    const track = TRACKS[music.index];
    el('#w-track').textContent = track.title;
    el('#w-artist').textContent = track.artist;
    el('#w-play').setAttribute('aria-label', music.playing ? '暂停音乐' : '播放音乐');
    el('#w-play-icon').innerHTML = music.playing
      ? '<path d="M8 5v14M16 5v14"/>'
      : '<path d="M8 5l11 7-11 7V5z"/>';
    el('#w-disc').classList.toggle('is-playing', music.playing);
    el('#w-music-status').textContent = music.playing ? '正在播放 · 第 ' + (music.index + 1) + ' 首' : '点一下，听首小曲';
    el('#w-progress').style.width = (music.step / track.notes.length * 100) + '%';
  }

  function playTone(freq, time, duration, volume) {
    const ctx = music.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
  }

  function scheduleMusic() {
    if (!music.playing) return;
    const track = TRACKS[music.index];
    const beat = 60 / track.tempo;
    while (music.nextTime < music.context.currentTime + 0.25) {
      const note = track.notes[music.step];
      playTone(note, music.nextTime, beat * 0.85, 0.065);
      if (music.step % 4 === 0) playTone(note / 2, music.nextTime, beat * 1.8, 0.025);
      music.step = (music.step + 1) % track.notes.length;
      music.nextTime += beat;
      el('#w-progress').style.width = (music.step / track.notes.length * 100) + '%';
    }
  }

  function startMusic() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      App.toast('当前浏览器不支持音乐播放');
      return;
    }
    if (!music.context) music.context = new AudioContext();
    music.context.resume();
    music.playing = true;
    music.nextTime = music.context.currentTime + 0.08;
    clearInterval(music.timer);
    scheduleMusic();
    music.timer = setInterval(scheduleMusic, 80);
    renderMusic();
  }

  function stopMusic() {
    music.playing = false;
    clearInterval(music.timer);
    music.timer = null;
    renderMusic();
  }

  function changeTrack(direction) {
    music.index = (music.index + direction + TRACKS.length) % TRACKS.length;
    music.step = 0;
    if (music.playing) music.nextTime = music.context.currentTime + 0.08;
    renderMusic();
  }

  function renderStrip() {
    const box = el('#d-contacts');
    const people = App.state.contacts.slice(0, 10);
    let html = people.map(function (c) {
      return '<button type="button" class="strip-person" data-open-chat="' + c.id + '">' +
        '<span class="avatar">' + App.esc(c.avatar || '🙂') + '</span>' +
        '<span class="strip-name">' + App.esc(c.name) + '</span>' +
        '</button>';
    }).join('');
    html += '<button type="button" class="strip-person is-add" data-add-contact>' +
      '<span class="avatar">＋</span><span class="strip-name">添加</span></button>';
    box.innerHTML = html;
  }

  App.renderContacts = function () {
    const list = el('#contact-list');
    const empty = el('#contact-empty');
    const contacts = App.state.contacts;

    if (!contacts.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = contacts.map(function (c) {
      const last = App.lastMessage(c.id);
      const unread = App.unread[c.id] || 0;
      const snippet = last
        ? (last.role === 'me' ? '我：' : '') + last.text
        : (c.note || '还没有聊天记录');
      return '<div class="contact-row">' +
        '<button type="button" class="contact-hit" data-open-chat="' + c.id + '">' +
          '<span class="avatar">' + App.esc(c.avatar || '🙂') + '</span>' +
          '<span class="contact-info">' +
            '<span class="contact-line"><strong>' + App.esc(c.name) + '</strong>' +
            '<span class="contact-time">' + (last ? App.fmtTime(last.ts) : '') + '</span></span>' +
            '<span class="contact-snippet">' + App.esc(snippet) + '</span>' +
          '</span>' +
          (unread ? '<span class="dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
        '</button>' +
        '<button type="button" class="mini-btn contact-edit" data-edit-contact="' + c.id + '" aria-label="编辑联系人">✎</button>' +
        '</div>';
    }).join('');
  };

  /* ---------- 联系人弹窗 ---------- */
  let editingContact = null;
  const dialog = el('#contact-dialog');
  const form = el('#contact-form');

  function openContactDialog(contact) {
    editingContact = contact || null;
    el('#contact-dialog-title').textContent = contact ? '编辑联系人' : '新建联系人';
    el('#contact-name').value = contact ? contact.name : '';
    el('#contact-avatar').value = contact ? (contact.avatar || '') : '🙂';
    el('#contact-note').value = contact ? (contact.note || '') : '';
    el('#contact-delete').hidden = !contact;
    dialog.showModal();
    setTimeout(function () { el('#contact-name').focus(); }, 60);
  }

  function saveContact(e) {
    e.preventDefault();
    const name = el('#contact-name').value.trim();
    if (!name) {
      el('#contact-name').focus();
      return;
    }
    const avatar = el('#contact-avatar').value.trim() || '🙂';
    const note = el('#contact-note').value.trim();

    if (editingContact) {
      editingContact.name = name;
      editingContact.avatar = avatar;
      editingContact.note = note;
    } else {
      const contact = { id: App.uid('c'), name: name, avatar: avatar, note: note };
      App.state.contacts.push(contact);
      App.state.chats[contact.id] = [];
    }

    App.save();
    dialog.close();
    App.renderDesktop();
    App.toast(editingContact ? '已更新联系人' : '已添加联系人');
    editingContact = null;
  }

  function deleteContact() {
    if (!editingContact) return;
    if (!confirm('删除「' + editingContact.name + '」和这段对话？此操作不可撤销。')) return;
    const id = editingContact.id;
    App.state.contacts = App.state.contacts.filter(function (c) { return c.id !== id; });
    delete App.state.chats[id];
    delete App.unread[id];
    if (App.chatContactId === id) App.chatContactId = null;
    App.save();
    dialog.close();
    editingContact = null;
    App.renderDesktop();
    App.toast('已删除联系人');
  }

  let deskPage = 1;
  let pagerScrollTimer = null;
  let notesTimer = null;

  function updatePagerDots() {
    document.querySelectorAll('[data-desk-page]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.deskPage) === deskPage);
    });
  }

  function jumpToDeskPage(index, smooth) {
    const pager = el('#desk-pager');
    deskPage = index;
    updatePagerDots();
    if (smooth && typeof pager.scrollTo === 'function') {
      pager.scrollTo({ left: index * pager.clientWidth, behavior: 'smooth' });
    } else {
      pager.classList.add('no-smooth');
      pager.scrollLeft = index * pager.clientWidth;
      requestAnimationFrame(function () { pager.classList.remove('no-smooth'); });
    }
  }

  function initPager() {
    const pager = el('#desk-pager');
    jumpToDeskPage(1, false);
    pager.addEventListener('scroll', function () {
      clearTimeout(pagerScrollTimer);
      pagerScrollTimer = setTimeout(function () {
        if (!pager.clientWidth) return;
        deskPage = Math.max(0, Math.min(1, Math.round(pager.scrollLeft / pager.clientWidth)));
        updatePagerDots();
      }, 70);
    });
    document.querySelectorAll('[data-desk-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { jumpToDeskPage(Number(btn.dataset.deskPage), true); });
    });
    window.addEventListener('resize', function () { jumpToDeskPage(deskPage, false); });
  }

  App.initDesktop = function () {
    initPager();

    el('#w-notes').addEventListener('input', function (e) {
      App.state.notes = e.target.value;
      el('#w-notes-count').textContent = App.state.notes.length + ' / 500';
      el('#w-notes-status').textContent = '已保存';
      App.save();
      clearTimeout(notesTimer);
      notesTimer = setTimeout(function () { el('#w-notes-status').textContent = '自动保存'; }, 1200);
    });

    el('#w-play').addEventListener('click', function () {
      if (music.playing) stopMusic();
      else startMusic();
    });
    el('#w-prev').addEventListener('click', function () { changeTrack(-1); });
    el('#w-next').addEventListener('click', function () { changeTrack(1); });

    document.querySelectorAll('[data-icon-shape]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.state.iconStyle.shape = btn.dataset.iconShape;
        App.save();
        App.applyIconStyle();
      });
    });
    document.querySelectorAll('[data-icon-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.state.iconStyle.color = btn.dataset.iconColor;
        App.save();
        App.applyIconStyle();
      });
    });

    setInterval(function () {
      const now = new Date();
      el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }, 1000 * 20);

    el('#d-manage').addEventListener('click', function () { App.go('contacts'); });
    el('#btn-add-contact').addEventListener('click', function () { openContactDialog(null); });
    el('#btn-add-contact-2').addEventListener('click', function () { openContactDialog(null); });
    form.addEventListener('submit', saveContact);
    el('#contact-delete').addEventListener('click', deleteContact);

    document.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit-contact]');
      if (edit) {
        const contact = App.state.contacts.find(function (c) { return c.id === edit.dataset.editContact; });
        if (contact) openContactDialog(contact);
        return;
      }
      const person = e.target.closest('[data-open-chat]');
      if (person) {
        App.openChat(person.dataset.openChat);
        return;
      }
      const add = e.target.closest('[data-add-contact]');
      if (add) openContactDialog(null);
    });
  };
})();
