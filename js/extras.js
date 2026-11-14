/* 纪念日、笔记提醒、美化、其他工具（问卷 / 占卜 / 扫雷） */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const pad = function (n) { return String(n).padStart(2, '0'); };

  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function daysTo(dateStr) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(String(dateStr) + 'T00:00:00');
    if (isNaN(next.getTime())) return 0;
    next.setFullYear(now.getFullYear());
    if (next < today) next.setFullYear(now.getFullYear() + 1);
    return Math.round((next - today) / 86400000);
  }

  /* ---------------- 纪念日 ---------------- */
  App.nearestAnniversary = function () {
    const list = App.state.anniversaries || [];
    let best = null;
    list.forEach(function (a) {
      const days = daysTo(a.date);
      if (!best || days < best.days) best = { label: a.name, days: days };
    });
    return best;
  };

  App.renderAnniversaries = function () {
    const list = el('#anniv-list');
    if (!list) return;
    const items = (App.state.anniversaries || []).slice().sort(function (a, b) {
      return daysTo(a.date) - daysTo(b.date);
    });
    list.innerHTML = items.length
      ? items.map(function (a) {
          const d = daysTo(a.date);
          return '<div class="anniv-item">' +
            '<main><strong>' + App.esc(a.name) + '</strong>' +
            '<span>' + a.date.replace(/-/g, '.') + ' · ' + (d === 0 ? '就是今天' : '还有 ' + d + ' 天') + '</span></main>' +
            '<button type="button" class="mini-btn" data-del-anniv="' + App.esc(a.id) + '" aria-label="删除">×</button>' +
          '</div>';
        }).join('')
      : '<p class="field-hint">还没有纪念日，先在上面写一个名字和日期。</p>';
  };

  /* ---------------- 笔记：每天定时提醒 ---------------- */
  App.renderReminders = function () {
    const list = el('#reminder-list');
    if (!list) return;
    const items = App.state.reminders || [];
    list.innerHTML = items.length
      ? items.map(function (r) {
          return '<div class="reminder-item' + (r.active ? '' : ' is-off') + '">' +
            '<main><strong>' + App.esc(r.title) + '</strong>' +
            '<span>' + r.start + ' – ' + r.end + (r.active ? ' · 每天提醒' : ' · 已取消提醒') + '</span></main>' +
            '<button type="button" class="mini-btn" data-toggle-rem="' + App.esc(r.id) + '">' + (r.active ? '暂停' : '继续') + '</button>' +
            '<button type="button" class="mini-btn" data-del-rem="' + App.esc(r.id) + '" aria-label="删除">×</button>' +
          '</div>';
        }).join('')
      : '<p class="field-hint">还没有提醒。写一件要记的事，再选开始和结束时间。</p>';
  };

  function reminderContactId() {
    const st = App.state;
    if (st.currentContactId && st.contacts.some(function (c) { return c.id === st.currentContactId; })) {
      return st.currentContactId;
    }
    return st.contacts.length ? st.contacts[0].id : null;
  }

  function sendReminder(reminder, phase) {
    const contactId = reminderContactId();
    if (!contactId) return;
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    const text = phase === 'end'
      ? '到结束时间了：' + reminder.title
      : '到时间了：' + reminder.title;
    chat.push({
      id: App.uid('m'),
      role: 'ta',
      type: 'reminder',
      text: text,
      quote: { name: '提醒', text: reminder.title + ' · ' + reminder.start + '–' + reminder.end },
      reminderId: reminder.id,
      phase: phase,
      ts: Date.now(),
    });
    App.save();
    if (App.chatOpen(contactId)) App.renderChat();
    else App.unread[contactId] = (App.unread[contactId] || 0) + 1;
    App.renderContacts();
    App.updateBadges();
  }

  function tickReminders() {
    const st = App.state;
    if (!st || !Array.isArray(st.reminders) || !st.reminders.length) return;
    const now = new Date();
    const hm = hhmm(now);
    const today = dateKey(now);
    let changed = false;
    st.reminders.forEach(function (r) {
      if (!r.active) return;
      if (r.snoozeAt && Date.now() >= r.snoozeAt) {
        r.snoozeAt = 0;
        changed = true;
        sendReminder(r, 'snooze');
        return;
      }
      if (r.start === hm && r.lastStart !== today) {
        r.lastStart = today;
        changed = true;
        sendReminder(r, 'start');
      } else if (r.end === hm && r.lastEnd !== today) {
        r.lastEnd = today;
        changed = true;
        sendReminder(r, 'end');
      }
    });
    if (changed) App.save();
  }
  App.tickReminders = tickReminders;

  /* ---------------- 外观 ---------------- */
  App.applyLook = function () {
    const look = (App.state && App.state.look) || {};
    const app = document.getElementById('app');
    if (app) app.style.setProperty('--ui-opacity', String((look.opacity == null ? 100 : look.opacity) / 100));

    const wall = document.querySelector('.wallpaper');
    if (wall) {
      if (look.bgImage) {
        wall.style.backgroundImage = 'url("' + look.bgImage + '")';
        wall.classList.add('has-look-bg');
      } else {
        wall.style.backgroundImage = '';
        wall.classList.remove('has-look-bg');
      }
    }
    const chat = el('#view-chat');
    if (chat) {
      if (look.chatBg) {
        chat.style.backgroundImage = 'url("' + look.chatBg + '")';
        chat.classList.add('has-look-chat-bg');
      } else {
        chat.style.backgroundImage = '';
        chat.classList.remove('has-look-chat-bg');
      }
    }
    const call = el('#call-overlay');
    if (call) {
      if (look.callBg) {
        call.style.backgroundImage = 'url("' + look.callBg + '")';
        call.classList.add('has-look-call-bg');
      } else {
        call.style.backgroundImage = '';
        call.classList.remove('has-look-call-bg');
      }
    }

    let style = document.getElementById('look-custom-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'look-custom-css';
      document.head.appendChild(style);
    }
    style.textContent = look.bubbleCss || '';

    const slider = el('#look-opacity');
    if (slider && document.activeElement !== slider) slider.value = String(look.opacity == null ? 100 : look.opacity);
    const css = el('#look-bubble-css');
    if (css && document.activeElement !== css) css.value = look.bubbleCss || '';
  };

  function setLookBg(kind, src) {
    const look = App.state.look;
    if (kind === 'bg') look.bgImage = src;
    else if (kind === 'chat') look.chatBg = src;
    else look.callBg = src;
    App.save();
    App.applyLook();
  }

  /* ---------------- 工具：问卷 ---------------- */
  const SURVEY_TA_TEMPLATES = [
    { text: '今天的心情怎么样？', mode: 'single', options: ['很好', '还不错', '有点累', '想静静'] },
    { text: '如果今晚可以一起做一件事，你想选？', mode: 'single', options: ['散步', '看电影', '聊天', '什么都不做'] },
    { text: '最近有什么想被我知道的小事？', mode: 'card', options: [] },
  ];

  let surveyMode = 'card';

  function parseSurveyOptions(text) {
    const parts = String(text || '').split(/[/／、,，\n]+/);
    const out = [];
    parts.forEach(function (part) {
      const value = part.trim();
      if (value && out.indexOf(value) === -1) out.push(value);
    });
    return out;
  }

  function surveyModeLabel(mode) {
    if (mode === 'single') return '单选';
    if (mode === 'multi') return '多选';
    return '字卡回答';
  }

  function renderSurveyForm() {
    document.querySelectorAll('#survey-mode [data-survey-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.surveyMode === surveyMode);
    });
    const optionsWrap = el('#survey-options-wrap');
    if (optionsWrap) optionsWrap.hidden = surveyMode === 'card';
    const scopeWrap = el('#survey-scope-wrap');
    if (scopeWrap) scopeWrap.hidden = surveyMode !== 'card';
  }

  function resetSurveyForm() {
    surveyMode = 'card';
    const input = el('#survey-question-input');
    if (input) input.value = '';
    const options = el('#survey-options');
    if (options) options.value = '';
    const scope = el('#survey-scope');
    if (scope) scope.value = 'all';
    const delay = el('#survey-answer-delay');
    if (delay) delay.value = '4';
    renderSurveyForm();
  }

  function surveyAnswerDelay() {
    const input = el('#survey-answer-delay');
    const value = input ? parseInt(String(input.value || '').trim(), 10) : NaN;
    if (!isFinite(value) || value <= 0) return 4;
    return Math.min(120, value);
  }

  function collectSurveyQuestion() {
    const input = el('#survey-question-input');
    const text = input ? String(input.value || '').trim() : '';
    if (!text) return { error: '先写一个问题' };
    if (surveyMode === 'single' || surveyMode === 'multi') {
      const optionsInput = el('#survey-options');
      const options = parseSurveyOptions(optionsInput ? optionsInput.value : '');
      if (options.length < 2 || options.length > 6) return { error: '需要 2~6 个选项' };
      return { question: { text: text, mode: surveyMode, options: options } };
    }
    const scopeSel = el('#survey-scope');
    return {
      question: {
        text: text,
        mode: 'card',
        options: [],
        scope: scopeSel ? scopeSel.value : 'all',
      },
    };
  }

  function surveyScopeCats(scope) {
    if (scope === '聊天' || scope === '情绪') return [scope];
    return ['聊天', '情绪'];
  }

  function deliverMessage(contactId, message) {
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    chat.push(message);
    App.save();
    if (App.chatOpen(contactId)) {
      App.renderChat();
    } else {
      App.unread[contactId] = (App.unread[contactId] || 0) + 1;
      App.updateBadges();
      App.renderContacts();
    }
  }

  function surveyAnswerFor(question, contactId) {
    if (question.mode === 'single' || question.mode === 'multi') {
      const options = (question.options || []).slice();
      if (!options.length) return { text: question.text, mode: question.mode, answer: '（没有选项）' };
      if (question.mode === 'single') {
        return { text: question.text, mode: 'single', answer: options[Math.floor(Math.random() * options.length)] };
      }
      const count = 1 + Math.floor(Math.random() * options.length);
      const picked = [];
      while (picked.length < count && options.length) {
        picked.push(options.splice(Math.floor(Math.random() * options.length), 1)[0]);
      }
      return { text: question.text, mode: 'multi', answer: picked.join('、') };
    }
    const cards = App.pickCards('', 1, contactId, surveyScopeCats(question.scope));
    const card = cards.length ? cards[0] : null;
    return {
      text: question.text,
      mode: 'card',
      answer: card ? card.text : '这次先不答，留一点空白。',
      cardId: card ? card.id : '',
    };
  }

  function scheduleSurveyAnswers(contactId, surveyId, delaySec) {
    const waitMs = Math.max(1, Math.min(120, delaySec || 4)) * 1000;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || [];
      const survey = chat.find(function (m) { return m.id === surveyId; });
      if (!survey) return;
      const answers = (survey.questions || []).map(function (q) {
        return surveyAnswerFor(q, contactId);
      });
      survey.answered = true;
      deliverMessage(contactId, {
        id: App.uid('m'),
        role: 'ta',
        type: 'surveyAnswer',
        text: '问卷答案',
        surveyId: surveyId,
        answers: answers,
        ts: Date.now(),
        read: App.chatOpen(contactId),
      });
      maybeTaSurveyBack(contactId);
    }, waitMs);
  }

  function maybeTaSurveyBack(contactId) {
    if (Math.random() >= 0.3) return;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const total = 2 + Math.floor(Math.random() * 2);
      const pool = SURVEY_TA_TEMPLATES.slice();
      const questions = [];
      while (questions.length < total && pool.length) {
        const item = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        questions.push({
          text: item.text,
          mode: item.mode,
          options: item.options.slice(),
          scope: 'all',
        });
      }
      deliverMessage(contactId, {
        id: App.uid('m'),
        role: 'ta',
        type: 'survey',
        text: 'TA 发来一份小问卷',
        questions: questions,
        answered: false,
        fromTa: true,
        ts: Date.now(),
        read: App.chatOpen(contactId),
      });
    }, 2200 + Math.random() * 2200);
  }

  function scheduleSurveyAppend(contactId) {
    if (Math.random() >= 0.4) return;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const cards = App.pickCards('', 1, contactId, ['聊天', '情绪']);
      const card = cards.length ? cards[0] : null;
      deliverMessage(contactId, {
        id: App.uid('m'),
        role: 'ta',
        type: 'text',
        text: card ? card.text : '刚刚想说的，又忘了。',
        cardId: card ? card.id : undefined,
        surveyAppend: true,
        ts: Date.now(),
        read: App.chatOpen(contactId),
      });
    }, 2600 + Math.random() * 2600);
  }

  /* 我在聊天里用文字回答 TA 的问卷后调用 */
  App.noteSurveyTextReply = function (contactId) {
    const chat = App.state.chats[contactId] || [];
    for (let i = chat.length - 1; i >= 0; i--) {
      const message = chat[i];
      if (message.type === 'survey' && message.role === 'ta' && !message.answered) {
        message.answered = true;
        App.save();
        if (App.chatOpen(contactId)) App.renderChat();
        scheduleSurveyAppend(contactId);
        return;
      }
    }
  };

  function sendSurvey() {
    const contactId = reminderContactId();
    if (!contactId) { App.toast('先添加一个角色吧'); return; }
    const collected = collectSurveyQuestion();
    if (collected.error) { App.toast(collected.error); return; }
    const message = {
      id: App.uid('m'),
      role: 'me',
      type: 'survey',
      text: '发来一份小问卷',
      questions: [collected.question],
      answerDelay: surveyAnswerDelay(),
      answered: false,
      ts: Date.now(),
    };
    deliverMessage(contactId, message);
    hideToolPanel('#survey-dialog');
    resetSurveyForm();
    App.toast('问卷已发出');
    scheduleSurveyAnswers(contactId, message.id, message.answerDelay);
  }

  /* ---------------- 工具：占卜 ---------------- */
  const TAROT_MAJOR = [
    '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车',
    '力量', '隐者', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔',
    '高塔', '星星', '月亮', '太阳', '审判', '世界',
  ];
  const TAROT_SUITS = ['权杖', '圣杯', '宝剑', '星币'];
  const TAROT_RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '王后', '国王'];
  const TAROT_DECK = TAROT_MAJOR.slice();
  TAROT_SUITS.forEach(function (suit) {
    TAROT_RANKS.forEach(function (rank) {
      TAROT_DECK.push(suit + rank);
    });
  });
  const LENORMAND_DECK = [
    '骑士', '四叶草', '船', '房子', '树', '云', '蛇', '棺材', '花束', '镰刀', '鞭子', '鸟',
    '小孩', '狐狸', '熊', '星星', '鹳', '狗', '高塔', '花园', '山', '十字路口', '老鼠', '心',
    '戒指', '书', '信', '男人', '女人', '百合', '太阳', '月亮', '钥匙', '鱼', '锚', '十字架',
  ];

  let divine = { type: '', count: 0, started: false, deck: [], drawn: [], revealed: 0 };

  function divineTypeLabel(type) {
    return type === 'lenormand' ? '雷诺曼' : '塔罗牌';
  }

  function shuffleDeck(list) {
    const deck = list.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function divineCardHtml(index) {
    return '<button type="button" class="divine-card" data-divine-flip="' + index + '" aria-label="翻开第 ' + (index + 1) + ' 张牌">' +
      '<span class="divine-card-inner">' +
        '<span class="divine-card-face divine-card-back">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.3l6.1-.7L12 3z"/></svg>' +
        '</span>' +
        '<span class="divine-card-face divine-card-front"></span>' +
      '</span>' +
    '</button>';
  }

  function divineRevealedCount() {
    return divine.drawn.filter(function (card) { return !!card; }).length;
  }

  function updateDivineControls() {
    const draw = el('#divine-draw');
    const reset = el('#divine-reset');
    const send = el('#divine-send');
    const hint = el('#divine-hint');
    if (draw) draw.disabled = divine.started || !divine.type || !divine.count;
    if (reset) reset.disabled = !divine.started && !divine.type && !divine.count;
    if (send) send.disabled = !divine.started || divineRevealedCount() < divine.count;
    document.querySelectorAll('[data-divine-type]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.divineType === divine.type);
      btn.disabled = divine.started;
    });
    document.querySelectorAll('[data-divine-count]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.divineCount) === divine.count);
      btn.disabled = divine.started;
    });
    if (hint) {
      if (!divine.type || !divine.count) {
        hint.textContent = '先选牌种和抽牌数量，再开始抽牌。';
      } else if (!divine.started) {
        hint.textContent = '已选' + divineTypeLabel(divine.type) + ' ' + divine.count + ' 张，点「开始抽牌」。';
      } else if (divineRevealedCount() < divine.count) {
        hint.textContent = '点牌背翻开，还剩 ' + (divine.count - divineRevealedCount()) + ' 张。';
      } else {
        hint.textContent = '牌阵完成，可以发给 TA，或重新开始。';
      }
    }
  }

  function resetDivine(clearChoice) {
    divine.started = false;
    divine.deck = [];
    divine.drawn = [];
    divine.revealed = 0;
    if (clearChoice) {
      divine.type = '';
      divine.count = 0;
    }
    const board = el('#divine-board');
    if (board) {
      board.innerHTML = '';
      board.className = 'divine-board';
    }
    updateDivineControls();
  }

  function startDivine() {
    if (!divine.type || !divine.count || divine.started) return;
    const source = divine.type === 'tarot' ? TAROT_DECK : LENORMAND_DECK;
    divine.started = true;
    divine.deck = shuffleDeck(source);
    divine.drawn = [];
    divine.revealed = 0;
    for (let i = 0; i < divine.count; i++) divine.drawn.push(null);
    const board = el('#divine-board');
    if (board) {
      board.className = 'divine-board count-' + divine.count;
      let html = '';
      for (let i = 0; i < divine.count; i++) html += divineCardHtml(i);
      board.innerHTML = html;
    }
    updateDivineControls();
  }

  function flipDivineCard(button) {
    if (!button || !divine.started) return;
    if (button.classList.contains('is-flipped')) return;
    const index = Number(button.dataset.divineFlip);
    if (!isFinite(index) || index < 0 || index >= divine.count) return;
    if (divine.drawn[index]) return;
    if (!divine.deck.length) return;
    const name = divine.deck.pop();
    const card = {
      name: name,
      reversed: divine.type === 'tarot' && Math.random() < 0.5,
    };
    divine.drawn[index] = card;
    const front = button.querySelector('.divine-card-front');
    if (front) {
      front.innerHTML = '<strong>' + App.esc(card.name) + '</strong>' +
        '<em class="' + (card.reversed ? 'is-reversed' : '') + '">' + (card.reversed ? '逆位' : '正位') + '</em>';
    }
    button.disabled = true;
    requestAnimationFrame(function () {
      button.classList.add('is-flipped');
    });
    updateDivineControls();
  }

  function scheduleDivineReply(contactId, messageId) {
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || [];
      const message = chat.find(function (m) { return m.id === messageId; });
      if (!message || message.reply) return;
      const cards = App.pickCards('', 1, contactId, ['聊天', '情绪']);
      const card = cards.length ? cards[0] : null;
      message.reply = {
        text: card ? card.text : '牌面很安静，我先陪你坐一会儿。',
        cardId: card ? card.id : '',
      };
      App.save();
      if (App.chatOpen(contactId)) App.renderChat();
    }, 2400 + Math.random() * 2400);
  }

  function sendDivine() {
    const contactId = reminderContactId();
    if (!contactId) { App.toast('先添加一个角色吧'); return; }
    if (!divine.started || divineRevealedCount() < divine.count) return;
    const cards = divine.drawn.filter(function (card) { return !!card; }).map(function (card) {
      return { name: card.name, reversed: !!card.reversed };
    });
    const message = {
      id: App.uid('m'),
      role: 'me',
      type: 'divine',
      text: '发了一个' + divineTypeLabel(divine.type) + '牌阵',
      system: divineTypeLabel(divine.type),
      cards: cards,
      ts: Date.now(),
    };
    deliverMessage(contactId, message);
    hideToolPanel('#divine-dialog');
    App.toast('牌阵已发出');
    scheduleDivineReply(contactId, message.id);
  }

  /* ---------------- 游戏：扫雷 ---------------- */
  const MINE_SIZE = 9;
  const MINE_COUNT = 10;
  let mine = null; /* { cells:[{mine,open,flag,n}], over, opened } */

  function mineNeighbors(i) {
    const x = i % MINE_SIZE;
    const y = Math.floor(i / MINE_SIZE);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MINE_SIZE || ny >= MINE_SIZE) continue;
        out.push(ny * MINE_SIZE + nx);
      }
    }
    return out;
  }

  function resetMine() {
    const cells = [];
    for (let i = 0; i < MINE_SIZE * MINE_SIZE; i++) cells.push({ mine: false, open: false, flag: false, n: 0 });
    let placed = 0;
    while (placed < MINE_COUNT) {
      const i = Math.floor(Math.random() * cells.length);
      if (cells[i].mine) continue;
      cells[i].mine = true;
      placed++;
    }
    cells.forEach(function (c, i) {
      if (c.mine) return;
      c.n = mineNeighbors(i).filter(function (j) { return cells[j].mine; }).length;
    });
    mine = { cells: cells, over: false, opened: 0 };
    renderMine();
  }

  function renderMine() {
    const board = el('#mine-board');
    if (!board || !mine) return;
    board.innerHTML = mine.cells.map(function (c, i) {
      let text = '';
      let cls = 'mine-cell';
      if (c.open) {
        cls += ' is-open';
        if (c.mine) { text = '💣'; cls += ' is-boom'; }
        else if (c.n) { text = String(c.n); cls += ' n' + c.n; }
      } else if (c.flag) {
        text = '🚩';
        cls += ' is-flag';
      }
      return '<button type="button" class="' + cls + '" data-mine="' + i + '"' +
        (c.open ? ' aria-label="已翻开"' : ' aria-label="未翻开"') + '>' + text + '</button>';
    }).join('');

    if (el('#mine-status')) {
      el('#mine-status').textContent = mine.over === 'win'
        ? '扫完了，今天也很厉害。'
        : (mine.over === 'lose' ? '踩到雷了。点下面重新来一局。' : '点格子翻开，长按插旗。9 × 9，10 颗雷。');
    }
  }

  function openMineCell(i) {
    if (!mine || mine.over) return;
    const cell = mine.cells[i];
    if (!cell || cell.open || cell.flag) return;
    if (cell.mine) {
      cell.open = true;
      mine.over = 'lose';
      mine.cells.forEach(function (c) { if (c.mine) c.open = true; });
      renderMine();
      return;
    }
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop();
      const c = mine.cells[cur];
      if (!c || c.open || c.flag) continue;
      c.open = true;
      mine.opened++;
      if (!c.n) mineNeighbors(cur).forEach(function (j) { stack.push(j); });
    }
    if (mine.opened >= MINE_SIZE * MINE_SIZE - MINE_COUNT) mine.over = 'win';
    renderMine();
  }

  function toggleMineFlag(i) {
    if (!mine || mine.over) return;
    const cell = mine.cells[i];
    if (!cell || cell.open) return;
    cell.flag = !cell.flag;
    renderMine();
  }

  /* ---------------- 事件绑定 ---------------- */
  function hideAllToolPanels() {
    document.querySelectorAll('.tool-overlay').forEach(function (layer) {
      layer.hidden = true;
    });
  }

  function hideToolPanel(sel) {
    const layer = document.querySelector(sel);
    if (layer) layer.hidden = true;
  }

  function showToolPanel(sel) {
    hideAllToolPanels();
    const layer = document.querySelector(sel);
    if (!layer) return;
    layer.hidden = false;
    const body = layer.querySelector('.tool-sheet-body');
    if (body) body.scrollTop = 0;
  }

  App.hideToolPanels = hideAllToolPanels;

  App.initExtras = function () {
    document.addEventListener('click', function (e) {
      const closer = e.target.closest('[data-tool-close]');
      if (!closer) return;
      const layer = closer.closest('.tool-overlay');
      if (layer) layer.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideAllToolPanels();
    });

    const annivForm = el('#anniv-form');
    if (annivForm) {
      annivForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = el('#anniv-name').value.trim();
        const date = el('#anniv-date').value;
        if (!name || !date) return;
        App.state.anniversaries.push({ id: App.uid('an'), name: name.slice(0, 12), date: date });
        App.save();
        el('#anniv-name').value = '';
        el('#anniv-date').value = '';
        App.renderAnniversaries();
        App.renderDesktop();
        App.toast('纪念日已添加');
      });
    }
    const annivList = el('#anniv-list');
    if (annivList) {
      annivList.addEventListener('click', function (e) {
        const del = e.target.closest('[data-del-anniv]');
        if (!del) return;
        App.state.anniversaries = App.state.anniversaries.filter(function (a) { return a.id !== del.dataset.delAnniv; });
        App.save();
        App.renderAnniversaries();
        App.renderDesktop();
      });
    }

    const remForm = el('#reminder-form');
    if (remForm) {
      remForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const title = el('#rem-title').value.trim();
        const start = el('#rem-start').value;
        const end = el('#rem-end').value;
        if (!title || !start || !end) return;
        App.state.reminders.push({
          id: App.uid('rem'),
          title: title.slice(0, 40),
          start: start,
          end: end,
          active: true,
          lastStart: '',
          lastEnd: '',
          snoozeAt: 0,
        });
        App.save();
        el('#rem-title').value = '';
        App.renderReminders();
        App.toast('提醒已添加');
      });
    }
    const remList = el('#reminder-list');
    if (remList) {
      remList.addEventListener('click', function (e) {
        const toggle = e.target.closest('[data-toggle-rem]');
        if (toggle) {
          const r = App.state.reminders.find(function (x) { return x.id === toggle.dataset.toggleRem; });
          if (r) { r.active = !r.active; App.save(); App.renderReminders(); }
          return;
        }
        const del = e.target.closest('[data-del-rem]');
        if (del) {
          App.state.reminders = App.state.reminders.filter(function (x) { return x.id !== del.dataset.delRem; });
          App.save();
          App.renderReminders();
        }
      });
    }

    /* 聊天里的提醒卡片：取消 / 还没做完 */
    document.addEventListener('click', function (e) {
      const cancel = e.target.closest('[data-rem-cancel]');
      const keep = e.target.closest('[data-rem-keep]');
      if (!cancel && !keep) return;
      e.preventDefault();
      e.stopPropagation();
      const btn = cancel || keep;
      const reminder = (App.state.reminders || []).find(function (r) { return r.id === btn.dataset.remCancel || r.id === btn.dataset.remKeep; });
      const contactId = reminderContactId();
      const chat = contactId ? (App.state.chats[contactId] || []) : [];
      const msg = chat.find(function (m) { return m.id === (cancel ? cancel.dataset.remCancelMsg : keep.dataset.remKeepMsg); });
      if (msg) msg.reminderDone = true;
      if (reminder) {
        if (cancel) {
          reminder.active = false;
          reminder.snoozeAt = 0;
          App.toast('已取消这个提醒');
        } else {
          reminder.snoozeAt = Date.now() + 10 * 60 * 1000;
          App.toast('10 分钟后再提醒你');
        }
      }
      App.save();
      if (App.chatOpen(contactId)) App.renderChat();
      App.renderReminders();
    });

    /* 美化 */
    const slider = el('#look-opacity');
    if (slider) {
      function commitOpacity() {
        const digits = String(slider.value).replace(/[^\d]/g, '');
        const num = digits ? Number(digits) : 100;
        const v = Math.max(20, Math.min(100, num));
        slider.value = String(v);
        App.state.look.opacity = v;
        App.save();
        App.applyLook();
      }
      slider.addEventListener('change', commitOpacity);
      slider.addEventListener('blur', commitOpacity);
    }
    const cssBox = el('#look-bubble-css');
    if (cssBox) {
      cssBox.addEventListener('input', function () {
        App.state.look.bubbleCss = cssBox.value;
        App.applyLook();
      });
      cssBox.addEventListener('change', function () { App.save(); });
    }
    document.querySelectorAll('[data-look-file]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = el('#look-file-' + btn.dataset.lookFile);
        if (input) input.click();
      });
    });
    ['bg', 'chat', 'call'].forEach(function (kind) {
      const input = el('#look-file-' + kind);
      if (!input) return;
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        try { input.value = ''; } catch (err) {}
        if (!file) return;
        App.toast('正在处理背景图…');
        App.compressImage(file, 1280, { quality: 0.82, maxLength: 900000 }).then(function (src) {
          setLookBg(kind, src);
          App.toast('背景已更新');
        }).catch(function (err) {
          App.toast(err.message || '图片读取失败');
        });
      });
    });
    document.querySelectorAll('[data-look-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLookBg(btn.dataset.lookClear, '');
      });
    });
    const reset = el('#look-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        App.state.look = { bgImage: '', chatBg: '', callBg: '', bubbleCss: '', opacity: 100 };
        App.state.iconStyle = { shape: 'rounded', color: 'blue' };
        App.save();
        App.applyLook();
        App.applyIconStyle();
        App.toast('已恢复默认外观');
      });
    }
    document.querySelectorAll('[data-chat-settings-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { setTimeout(App.applyLook, 0); });
    });

    /* 其他：工具 / 游戏 */
    const moreBtn = el('#btn-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        const d = el('#more-dialog');
        if (!d) return;
        d.style.height = 'auto';
        d.showModal();
        const natural = d.offsetHeight;
        d.style.height = Math.min(natural * 1.5, window.innerHeight * 0.86) + 'px';
        d.addEventListener('close', function () { d.style.height = ''; }, { once: true });
      });
    }
    document.querySelectorAll('[data-more-cat]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const cat = tab.dataset.moreCat;
        document.querySelectorAll('[data-more-cat]').forEach(function (t) {
          const on = t === tab;
          t.classList.toggle('is-on', on);
          t.setAttribute('aria-selected', String(on));
        });
        document.querySelectorAll('#more-apps [data-cat]').forEach(function (app) {
          app.hidden = app.dataset.cat !== cat;
        });
      });
    });
    document.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const more = el('#more-dialog');
        if (more) more.close();
        if (btn.dataset.tool === 'survey') {
          renderSurveyForm();
          showToolPanel('#survey-dialog');
        } else if (btn.dataset.tool === 'divine') {
          resetDivine(true);
          showToolPanel('#divine-dialog');
        } else if (btn.dataset.tool === 'mine') {
          resetMine();
          showToolPanel('#mine-dialog');
        }
      });
    });

    /* 问卷：写一个问题、选回答方式、直接发送 */
    const surveyInput = el('#survey-question-input');
    if (surveyInput) {
      surveyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendSurvey();
        }
      });
    }
    document.querySelectorAll('#survey-mode [data-survey-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        surveyMode = btn.dataset.surveyMode || 'card';
        renderSurveyForm();
      });
    });
    const surveySend = el('#survey-send');
    if (surveySend) surveySend.addEventListener('click', sendSurvey);

    /* 占卜：选牌种 / 张数、翻牌、重新开始、发送 */
    document.querySelectorAll('[data-divine-type]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (divine.started) return;
        divine.type = btn.dataset.divineType;
        updateDivineControls();
      });
    });
    document.querySelectorAll('[data-divine-count]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (divine.started) return;
        divine.count = Number(btn.dataset.divineCount) || 0;
        updateDivineControls();
      });
    });
    const divineDraw = el('#divine-draw');
    if (divineDraw) divineDraw.addEventListener('click', startDivine);
    const divineReset = el('#divine-reset');
    if (divineReset) divineReset.addEventListener('click', function () { resetDivine(false); });
    const divineSend = el('#divine-send');
    if (divineSend) divineSend.addEventListener('click', sendDivine);
    const divineBoard = el('#divine-board');
    if (divineBoard) {
      divineBoard.addEventListener('click', function (e) {
        const card = e.target.closest('[data-divine-flip]');
        if (card) flipDivineCard(card);
      });
    }
    const mineReset = el('#mine-reset');
    if (mineReset) mineReset.addEventListener('click', resetMine);
    const mineBoard = el('#mine-board');
    if (mineBoard) {
      let pressTimer = null;
      let pressed = -1;
      mineBoard.addEventListener('pointerdown', function (e) {
        const cell = e.target.closest('[data-mine]');
        if (!cell) return;
        pressed = Number(cell.dataset.mine);
        pressTimer = setTimeout(function () {
          pressTimer = null;
          toggleMineFlag(pressed);
          pressed = -1;
        }, 520);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
        mineBoard.addEventListener(type, function () {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        });
      });
      mineBoard.addEventListener('click', function (e) {
        const cell = e.target.closest('[data-mine]');
        if (!cell) return;
        openMineCell(Number(cell.dataset.mine));
      });
      mineBoard.addEventListener('contextmenu', function (e) {
        const cell = e.target.closest('[data-mine]');
        if (!cell) return;
        e.preventDefault();
        toggleMineFlag(Number(cell.dataset.mine));
      });
    }

    App.applyLook();
    setTimeout(tickReminders, 2500);
    setInterval(tickReminders, 30000);
  };
})();
