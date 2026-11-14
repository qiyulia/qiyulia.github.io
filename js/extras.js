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
    /* 单选 7 题 */
    { text: '今天的心情怎么样？', mode: 'single', options: ['很好', '还不错', '有点累', '想静静'] },
    { text: '如果今晚可以一起做一件事，你想选？', mode: 'single', options: ['散步', '看电影', '聊天', '什么都不做'] },
    { text: '你更喜欢我怎么陪你？', mode: 'single', options: ['安静待着', '一起聊天', '一起做点什么', '给我空间'] },
    { text: '现在在干嘛呢？', mode: 'single', options: ['工作 / 学习', '躺着休息', '在外面', '刚忙完'] },
    { text: '我刚发消息的时候，你在看手机吗？', mode: 'single', options: ['一直在', '刚看到', '在忙没注意', '准备回你'] },
    { text: '今晚大概几点睡？', mode: 'single', options: ['十一点前', '十二点左右', '一两点', '说不准'] },
    { text: '明天有没有想见我？', mode: 'single', options: ['很想', '想', '看情况', '暂时不了'] },
    /* 多选 7 题 */
    { text: '最近最想让我陪你做什么？', mode: 'multi', options: ['吃饭', '散步', '看电影', '聊天', '一起发呆'] },
    { text: '哪些小事会让你觉得被在意？', mode: 'multi', options: ['早安晚安', '记得我说过的话', '主动找我', '小惊喜', '陪我吐槽'] },
    { text: '这周有哪些想和我分享的？', mode: 'multi', options: ['工作学习', '好吃的', '好风景', '心情起伏', '没什么特别的'] },
    { text: '现在身边都有谁？', mode: 'multi', options: ['就我一个', '同事 / 同学', '家人', '朋友'] },
    { text: '今天都和谁聊过天？', mode: 'multi', options: ['同事 / 同学', '家人', '朋友', '陌生人', '只和你'] },
    { text: '周末想怎么过？', mode: 'multi', options: ['宅家', '出门走走', '见朋友', '和你待着'] },
    { text: '最近在偷偷准备什么？', mode: 'multi', options: ['没什么', '一个惊喜', '工作上的事', '还没想好'] },
    /* 打字回答 7 题 */
    { text: '最近有什么想被我知道的小事？', mode: 'text', options: [] },
    { text: '如果现在能对我说一句话，你最想说什么？', mode: 'text', options: [] },
    { text: '今天最想记住的一个瞬间是什么？', mode: 'text', options: [] },
    { text: '睡前最想听到哪句话？', mode: 'text', options: [] },
    { text: '你现在具体在什么地方？', mode: 'text', options: [] },
    { text: '今天有没有哪一刻突然想起我？', mode: 'text', options: [] },
    { text: '最近有什么话，想说又没说出口？', mode: 'text', options: [] },
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
    if (mode === 'text') return '打字回答';
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

  const surveyTimers = {};

  function scheduleSurveyAnswers(contactId, surveyId, delaySec) {
    if (surveyTimers[surveyId]) return;
    const chat = App.state.chats[contactId] || [];
    const survey = chat.find(function (m) { return m.id === surveyId; });
    let waitMs = Math.max(1, Math.min(120, delaySec || 4)) * 1000;
    if (survey && survey.answerDueAt) {
      waitMs = Math.max(1000, survey.answerDueAt - Date.now());
    }
    surveyTimers[surveyId] = setTimeout(function () {
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
      delete surveyTimers[surveyId];
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

  /* TA 发来的问卷：点开卡片，直接在浮层里选 / 写答案 */
  let surveyAnswerState = null;

  function surveyAnswerFormHtml(questions) {
    return questions.map(function (q, index) {
      const head = '<p class="survey-answer-q">' + (index + 1) + '. ' + App.esc(q.text) +
        '<em>' + surveyModeLabel(q.mode) + '</em></p>';
      let body = '';
      if (q.mode === 'single' || q.mode === 'multi') {
        body = '<div class="survey-choices" data-q="' + index + '">' +
          (q.options || []).map(function (opt) {
            return '<button type="button" class="survey-choice" data-q="' + index +
              '" data-value="' + App.esc(opt) + '">' + App.esc(opt) + '</button>';
          }).join('') + '</div>';
      } else {
        body = '<input type="text" class="survey-answer-input" data-q="' + index +
          '" maxlength="80" placeholder="写一句回答">';
      }
      return '<div class="survey-answer-item">' + head + body + '</div>';
    }).join('');
  }

  App.openSurveyAnswer = function (contactId, surveyId) {
    const chat = App.state.chats[contactId] || [];
    const survey = chat.find(function (m) { return m.id === surveyId; });
    if (!survey || survey.answered) return;
    const body = el('#survey-answer-body');
    if (!body) return;
    surveyAnswerState = {
      contactId: contactId,
      surveyId: surveyId,
      questions: survey.questions || [],
      picked: {},
    };
    body.innerHTML = surveyAnswerFormHtml(surveyAnswerState.questions);
    showToolPanel('#survey-answer-dialog');
  };

  function submitSurveyAnswer() {
    if (!surveyAnswerState) return;
    const state = surveyAnswerState;
    const chat = App.state.chats[state.contactId] || [];
    const survey = chat.find(function (m) { return m.id === state.surveyId; });
    if (!survey || survey.answered) {
      hideToolPanel('#survey-answer-dialog');
      surveyAnswerState = null;
      return;
    }
    const answers = [];
    for (let i = 0; i < state.questions.length; i++) {
      const q = state.questions[i];
      let answer = '';
      if (q.mode === 'single' || q.mode === 'multi') {
        const chosen = state.picked[i] || [];
        if (!chosen.length) { App.toast('第 ' + (i + 1) + ' 题还没选'); return; }
        answer = chosen.join('、');
      } else {
        const input = document.querySelector('#survey-answer-body .survey-answer-input[data-q="' + i + '"]');
        answer = input ? String(input.value || '').trim() : '';
        if (!answer) { App.toast('第 ' + (i + 1) + ' 题还没写'); return; }
      }
      answers.push({ text: q.text, mode: q.mode, answer: answer });
    }
    survey.answered = true;
    survey.answeredAt = Date.now();
    deliverMessage(state.contactId, {
      id: App.uid('m'),
      role: 'me',
      type: 'surveyAnswerMine',
      text: '我的回答',
      surveyId: state.surveyId,
      answers: answers,
      ts: Date.now(),
    });
    hideToolPanel('#survey-answer-dialog');
    surveyAnswerState = null;
    scheduleSurveyAppend(state.contactId);
    App.toast('答案已提交');
  }

  /* 页面被关掉或切走时，已回答时间仍然按发送时刻计算 */
  function resumePendingSurveys() {
    Object.keys(App.state.chats || {}).forEach(function (contactId) {
      (App.state.chats[contactId] || []).forEach(function (m) {
        if (m.type !== 'survey' || m.role !== 'me' || m.answered) return;
        if (!m.answerDueAt) return;
        scheduleSurveyAnswers(contactId, m.id, (m.answerDueAt - Date.now()) / 1000);
      });
    });
  }

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
      answerDueAt: Date.now() + surveyAnswerDelay() * 1000,
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

  let divine = { type: '', count: 0, phase: 'idle', deck: [], picks: [], cards: {} };

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
    return '<button type="button" class="divine-card" data-divine-pick="' + index + '" aria-label="第 ' + (index + 1) + ' 张牌">' +
      '<span class="divine-card-inner">' +
        '<span class="divine-card-face divine-card-back">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.3l6.1-.7L12 3z"/></svg>' +
        '</span>' +
        '<span class="divine-card-face divine-card-front"></span>' +
      '</span>' +
      '<span class="divine-pick-order" hidden></span>' +
    '</button>';
  }

  function divineTakeCard(index) {
    if (divine.cards[index]) return divine.cards[index];
    const card = {
      name: divine.deck[index],
      reversed: divine.type === 'tarot' && Math.random() < 0.5,
    };
    divine.cards[index] = card;
    return card;
  }

  function renderDivineOrder() {
    document.querySelectorAll('#divine-board [data-divine-pick]').forEach(function (node) {
      const index = Number(node.dataset.divinePick);
      const order = divine.picks.indexOf(index);
      const badge = node.querySelector('.divine-pick-order');
      if (!badge) return;
      badge.textContent = order === -1 ? '' : String(order + 1);
      badge.hidden = order === -1;
    });
  }

  /* 点牌：选中 / 取消选中，选满数量后可以翻牌，也能随时重选 */
  function toggleDivinePick(button) {
    if (!button || divine.phase === 'idle') return;
    const index = Number(button.dataset.divinePick);
    if (!isFinite(index) || index < 0 || index >= divine.deck.length) return;
    const at = divine.picks.indexOf(index);
    if (at !== -1) {
      divine.picks.splice(at, 1);
      delete divine.cards[index];
      button.classList.remove('is-picked', 'is-flipped');
      const front = button.querySelector('.divine-card-front');
      if (front) front.innerHTML = '';
      if (divine.phase === 'revealed') divine.phase = 'pick';
    } else {
      if (divine.picks.length >= divine.count) {
        App.toast('最多选 ' + divine.count + ' 张，先点掉一张再选');
        return;
      }
      divine.picks.push(index);
      button.classList.add('is-picked');
    }
    renderDivineOrder();
    updateDivineControls();
  }

  function revealDivineCards() {
    if (divine.phase !== 'pick' || divine.picks.length < divine.count) return;
    divine.picks.forEach(function (index) {
      const button = document.querySelector('#divine-board [data-divine-pick="' + index + '"]');
      if (!button || button.classList.contains('is-flipped')) return;
      const card = divineTakeCard(index);
      const front = button.querySelector('.divine-card-front');
      if (front) {
        front.innerHTML = '<strong>' + App.esc(card.name) + '</strong>' +
          '<em class="' + (card.reversed ? 'is-reversed' : '') + '">' + (card.reversed ? '逆位' : '正位') + '</em>';
      }
      requestAnimationFrame(function () {
        button.classList.add('is-flipped');
      });
    });
    divine.phase = 'revealed';
    updateDivineControls();
  }

  function clearDivinePicks() {
    divine.picks = [];
    divine.cards = {};
    divine.phase = 'pick';
    document.querySelectorAll('#divine-board [data-divine-pick]').forEach(function (node) {
      node.classList.remove('is-picked', 'is-flipped');
      const front = node.querySelector('.divine-card-front');
      if (front) front.innerHTML = '';
    });
    renderDivineOrder();
    updateDivineControls();
  }

  function handleDivineDraw() {
    if (divine.phase === 'idle') startDivine();
    else if (divine.phase === 'pick') revealDivineCards();
    else clearDivinePicks();
  }

  function updateDivineControls() {
    const draw = el('#divine-draw');
    const reset = el('#divine-reset');
    const send = el('#divine-send');
    const hint = el('#divine-hint');
    if (draw) {
      if (divine.phase === 'idle') {
        draw.textContent = '摊开牌堆';
        draw.disabled = !divine.type || !divine.count;
      } else if (divine.phase === 'pick') {
        draw.textContent = '翻牌（' + divine.picks.length + '/' + divine.count + '）';
        draw.disabled = divine.picks.length < divine.count;
      } else {
        draw.textContent = '重新选牌';
        draw.disabled = false;
      }
    }
    if (reset) reset.disabled = divine.phase === 'idle' && !divine.type && !divine.count;
    if (send) send.disabled = !(divine.phase === 'revealed' && divine.picks.length === divine.count);
    document.querySelectorAll('[data-divine-type]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.divineType === divine.type);
      btn.disabled = divine.phase !== 'idle';
    });
    document.querySelectorAll('[data-divine-count]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.divineCount) === divine.count);
      btn.disabled = divine.phase !== 'idle';
    });
    if (hint) {
      if (!divine.type || !divine.count) {
        hint.textContent = '先选牌种和抽牌数量，再摊开牌堆。';
      } else if (divine.phase === 'idle') {
        hint.textContent = '已选' + divineTypeLabel(divine.type) + ' ' + divine.count + ' 张，点「摊开牌堆」。';
      } else if (divine.phase === 'pick') {
        hint.textContent = '左右滑动看牌，点选 ' + divine.count + ' 张（已选 ' + divine.picks.length + ' 张）' +
          (divine.picks.length >= divine.count ? '，可以翻牌了。' : '，选满后翻牌。');
      } else {
        hint.textContent = '点已选的牌可以取消重选，也可以直接发给 TA。';
      }
    }
  }

  function resetDivine(clearChoice) {
    divine.phase = 'idle';
    divine.deck = [];
    divine.picks = [];
    divine.cards = {};
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
    if (!divine.type || !divine.count || divine.phase !== 'idle') return;
    const source = divine.type === 'tarot' ? TAROT_DECK : LENORMAND_DECK;
    divine.deck = shuffleDeck(source);
    divine.picks = [];
    divine.cards = {};
    divine.phase = 'pick';
    const board = el('#divine-board');
    if (board) {
      board.className = 'divine-board is-deck';
      board.innerHTML = divine.deck.map(function (name, i) {
        return divineCardHtml(i);
      }).join('');
      board.scrollLeft = 0;
    }
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
    if (divine.phase !== 'revealed' || divine.picks.length < divine.count) return;
    const cards = divine.picks.map(function (index) {
      const card = divine.cards[index];
      return card ? { name: card.name, reversed: !!card.reversed } : null;
    }).filter(function (card) { return !!card; });
    if (cards.length < divine.count) return;
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
  App.resumePendingSurveys = resumePendingSurveys;

  /* ---------------- 工具：互换头像 ---------------- */
  let avatarPoolSide = 'mine';
  const avatarSwapTimers = {};

  function avatarPoolData() {
    const st = App.state;
    if (!st.avatarPool || typeof st.avatarPool !== 'object') st.avatarPool = { mine: [], ta: [] };
    if (!Array.isArray(st.avatarPool.mine)) st.avatarPool.mine = [];
    if (!Array.isArray(st.avatarPool.ta)) st.avatarPool.ta = [];
    return st.avatarPool;
  }

  function avatarToolContact() {
    const st = App.state;
    const id = st.currentContactId || (st.contacts[0] && st.contacts[0].id);
    return st.contacts.find(function (c) { return c.id === id; }) || st.contacts[0] || null;
  }

  function currentAvatarOf(side) {
    if (side === 'mine') return App.state.profile.userAvatar;
    const contact = avatarToolContact();
    return contact ? contact.avatar : '';
  }

  function renderAvatarPool() {
    document.querySelectorAll('#avatar-pool-tabs [data-avatar-side]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.avatarSide === avatarPoolSide);
    });
    const grid = el('#avatar-pool-grid');
    if (!grid) return;
    const list = avatarPoolData()[avatarPoolSide];
    const current = currentAvatarOf(avatarPoolSide);
    grid.innerHTML = list.length
      ? list.map(function (src, index) {
          return '<div class="avatar-pool-item' + (src === current ? ' is-current' : '') + '" data-avatar-use="' + index + '">' +
            '<img src="' + src + '" alt="">' +
            '<button type="button" class="avatar-pool-del" data-avatar-del="' + index + '" aria-label="删除">×</button>' +
            '</div>';
        }).join('')
      : '<p class="field-hint avatar-pool-empty">还没有图片，点下面的按钮从相册导入。</p>';
  }

  function importAvatarPool(files) {
    const list = avatarPoolData()[avatarPoolSide];
    const picked = Array.prototype.slice.call(files || []);
    if (!picked.length) return;
    let chain = Promise.resolve();
    let added = 0;
    picked.forEach(function (file) {
      chain = chain.then(function () {
        return App.compressImage(file, 192).then(function (src) {
          if (list.indexOf(src) === -1 && list.length < 40) {
            list.push(src);
            added += 1;
          }
        }).catch(function () {});
      });
    });
    chain.then(function () {
      App.save();
      renderAvatarPool();
      App.toast(added ? '已导入 ' + added + ' 张头像' : '这些头像已经导入过了');
    });
  }

  function usePoolAvatar(index) {
    const src = avatarPoolData()[avatarPoolSide][index];
    if (!src) return;
    if (avatarPoolSide === 'mine') {
      App.state.profile.userAvatar = src;
    } else {
      const contact = avatarToolContact();
      if (!contact) return;
      contact.avatar = src;
    }
    App.save();
    renderAvatarPool();
    App.renderChat();
    App.renderContacts();
    App.renderSettings();
    App.toast('已设为当前头像');
  }

  function removePoolAvatar(index) {
    const list = avatarPoolData()[avatarPoolSide];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    App.save();
    renderAvatarPool();
  }

  function avatarProb(key, fallback) {
    const value = Number(App.state.settings && App.state.settings[key]);
    return isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
  }

  function pickIndexBySameSlot(list, prefer, sameChance) {
    if (!list.length) return -1;
    if (list.length === 1) return 0;
    const base = Math.max(0, Math.min(prefer, list.length - 1));
    if (Math.random() < sameChance) return base;
    const others = [];
    for (let i = 0; i < list.length; i += 1) {
      if (i !== base) others.push(i);
    }
    return others[Math.floor(Math.random() * others.length)];
  }

  function changeContactAvatar(index) {
    const contact = avatarToolContact();
    const list = avatarPoolData().ta;
    if (!contact || !list[index]) return false;
    contact.avatar = list[index];
    App.save();
    App.renderChat();
    App.renderContacts();
    App.renderSettings();
    return true;
  }

  function changeMyAvatar(index) {
    if (!avatarPoolData().mine[index]) return false;
    App.state.profile.userAvatar = avatarPoolData().mine[index];
    App.save();
    App.renderChat();
    App.renderSettings();
    return true;
  }

  function runAvatarSwap(auto) {
    const pool = avatarPoolData();
    if (!pool.mine.length && !pool.ta.length) {
      if (!auto) App.toast('先导入几张头像');
      return;
    }
    const selfOn = pool.ta.length > 0 && Math.random() * 100 < avatarProb('avatarSelfProb', 40);
    const meOn = pool.mine.length > 0 && Math.random() * 100 < avatarProb('avatarMeProb', 25);
    if (!selfOn && !meOn) {
      if (!auto) App.toast('这次 TA 没换头像');
      return;
    }
    /* 以我当前头像在「我的头像」里的位置为基准，TA 大概率换到同一位置 */
    const mySlot = pool.mine.indexOf(App.state.profile.userAvatar);
    let selfSlot = -1;
    if (selfOn) {
      const prefer = mySlot === -1 ? Math.floor(Math.random() * pool.ta.length) : mySlot;
      selfSlot = pickIndexBySameSlot(pool.ta, prefer, 0.75);
      if (changeContactAvatar(selfSlot)) {
        App.toast('TA 换成了他的第 ' + (selfSlot + 1) + ' 张头像');
      }
    }
    if (!meOn) {
      renderAvatarPool();
      return;
    }
    const doMine = function () {
      const base = selfSlot >= 0
        ? selfSlot
        : (mySlot === -1 ? Math.floor(Math.random() * pool.mine.length) : mySlot);
      const slot = pickIndexBySameSlot(pool.mine, base, 0.78);
      if (changeMyAvatar(slot)) App.toast('TA 把你的头像换成了第 ' + (slot + 1) + ' 张');
      renderAvatarPool();
    };
    if (selfOn) {
      clearTimeout(avatarSwapTimers.mine);
      avatarSwapTimers.mine = setTimeout(doMine, 4000 + Math.random() * 5000);
    } else {
      doMine();
    }
  }

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
        } else if (btn.dataset.tool === 'avatar') {
          renderAvatarPool();
          showToolPanel('#avatar-dialog');
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

    /* TA 问卷的答题浮层：单选 / 多选 / 打字 */
    const answerBody = el('#survey-answer-body');
    if (answerBody) {
      answerBody.addEventListener('click', function (e) {
        const btn = e.target.closest('.survey-choice');
        if (!btn || !surveyAnswerState) return;
        const qIndex = Number(btn.dataset.q);
        const question = surveyAnswerState.questions[qIndex];
        if (!question) return;
        const group = btn.parentElement;
        if (question.mode === 'multi') {
          btn.classList.toggle('is-on');
          const picked = [];
          group.querySelectorAll('.survey-choice.is-on').forEach(function (node) {
            picked.push(node.dataset.value);
          });
          surveyAnswerState.picked[qIndex] = picked;
        } else {
          group.querySelectorAll('.survey-choice').forEach(function (node) {
            node.classList.toggle('is-on', node === btn);
          });
          surveyAnswerState.picked[qIndex] = [btn.dataset.value];
        }
      });
    }
    const answerSubmit = el('#survey-answer-submit');
    if (answerSubmit) answerSubmit.addEventListener('click', submitSurveyAnswer);
    resumePendingSurveys();

    /* 占卜：选牌种 / 张数、翻牌、重新开始、发送 */
    document.querySelectorAll('[data-divine-type]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (divine.phase !== 'idle') return;
        divine.type = btn.dataset.divineType;
        updateDivineControls();
      });
    });
    document.querySelectorAll('[data-divine-count]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (divine.phase !== 'idle') return;
        divine.count = Number(btn.dataset.divineCount) || 0;
        updateDivineControls();
      });
    });
    const divineDraw = el('#divine-draw');
    if (divineDraw) divineDraw.addEventListener('click', handleDivineDraw);
    const divineReset = el('#divine-reset');
    if (divineReset) divineReset.addEventListener('click', function () { resetDivine(false); });
    const divineSend = el('#divine-send');
    if (divineSend) divineSend.addEventListener('click', sendDivine);
    const divineBoard = el('#divine-board');
    if (divineBoard) {
      divineBoard.addEventListener('click', function (e) {
        const card = e.target.closest('[data-divine-pick]');
        if (card) toggleDivinePick(card);
      });
    }
    const avatarTabs = el('#avatar-pool-tabs');
    if (avatarTabs) {
      avatarTabs.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-avatar-side]');
        if (!btn) return;
        avatarPoolSide = btn.dataset.avatarSide;
        renderAvatarPool();
      });
    }
    const avatarGrid = el('#avatar-pool-grid');
    if (avatarGrid) {
      avatarGrid.addEventListener('click', function (e) {
        const del = e.target.closest('[data-avatar-del]');
        if (del) {
          removePoolAvatar(Number(del.dataset.avatarDel));
          return;
        }
        const use = e.target.closest('[data-avatar-use]');
        if (use) usePoolAvatar(Number(use.dataset.avatarUse));
      });
    }
    const avatarImportBtn = el('#avatar-pool-import');
    const avatarFile = el('#avatar-pool-file');
    if (avatarImportBtn && avatarFile) {
      avatarImportBtn.addEventListener('click', function () { avatarFile.click(); });
      avatarFile.addEventListener('change', function () {
        importAvatarPool(avatarFile.files);
        avatarFile.value = '';
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

    /* TA 自己隔一阵子按概率换头像，不需要手动点 */
    function scheduleAutoAvatarSwap() {
      setTimeout(function () {
        if (!document.hidden) runAvatarSwap(true);
        scheduleAutoAvatarSwap();
      }, 90000 + Math.random() * 150000);
    }
    scheduleAutoAvatarSwap();
  };
})();
