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
    /* 群聊沿用同一张聊天背景 */
    const groupChat = el('#view-group-chat');
    if (groupChat) {
      if (look.chatBg) {
        groupChat.style.backgroundImage = 'url("' + look.chatBg + '")';
        groupChat.classList.add('has-look-chat-bg');
      } else {
        groupChat.style.backgroundImage = '';
        groupChat.classList.remove('has-look-chat-bg');
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
    /* 单选 8 题 */
    { text: '今天有好好吃饭吗？', mode: 'single', options: ['三餐都吃了', '只吃了两顿', '随便对付了', '还没顾上吃'] },
    { text: '如果现在能收到一份小礼物，你想要？', mode: 'single', options: ['一杯热饮', '一束花', '一份甜品', '你的陪伴'] },
    { text: '你现在最需要什么？', mode: 'single', options: ['好好睡一觉', '有人听我说话', '一点独处时间', '一个拥抱'] },
    { text: '最近睡得怎么样？', mode: 'single', options: ['倒头就睡', '还算安稳', '偶尔失眠', '总是睡不好'] },
    { text: '你更想听我说哪句话？', mode: 'single', options: ['我在', '辛苦了', '想你了', '早点休息'] },
    { text: '如果明天放假，你最想？', mode: 'single', options: ['睡到自然醒', '出门逛逛', '在家待着', '见想见的人'] },
    { text: '今天的天气你喜欢吗？', mode: 'single', options: ['很喜欢', '还行', '不太喜欢', '没注意'] },
    { text: '我找你的时候，你更希望我怎么开头？', mode: 'single', options: ['直接说事', '先问候', '随便聊聊', '发个表情'] },
    /* 多选 6 题 */
    { text: '最近有哪些事情让你开心？', mode: 'multi', options: ['吃到好吃的', '睡了个好觉', '被夸了', '见到了朋友', '和你聊天'] },
    { text: '你今天想做的事有哪些？', mode: 'multi', options: ['把工作做完', '好好休息', '出去走走', '和我说说话'] },
    { text: '哪些话你会想反复听？', mode: 'multi', options: ['想你', '等你回来', '有我在', '你很好'] },
    { text: '什么会让你突然有安全感？', mode: 'multi', options: ['有人回消息', '被记得', '熟悉的环境', '你的声音'] },
    { text: '最近想尝试哪些新东西？', mode: 'multi', options: ['新的餐厅', '新的路线', '新的爱好', '暂时不想'] },
    { text: '如果有空闲的一下午，你会？', mode: 'multi', options: ['补觉', '刷剧', '看书', '出门走走', '发呆'] },
    /* 打字回答 6 题 */
    { text: '最近一次笑出声，是因为什么？', mode: 'text', options: [] },
    { text: '如果今天可以重来一次，你想改哪一段？', mode: 'text', options: [] },
    { text: '有什么小事一直想告诉我却忘了说？', mode: 'text', options: [] },
    { text: '用一句话形容你现在的心情？', mode: 'text', options: [] },
    { text: '最近有没有偷偷为我做了什么？', mode: 'text', options: [] },
    { text: '此刻最想见的人是谁，为什么？', mode: 'text', options: [] },
  ];

  let surveyMode = 'card';
  let surveyKind = 'one';
  const SURVEY_MAX_QUESTIONS = 10;

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
    document.querySelectorAll('#survey-kind [data-survey-kind]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.surveyKind === surveyKind);
    });
    const one = el('#survey-one');
    if (one) one.hidden = surveyKind !== 'one';
    const many = el('#survey-many');
    if (many) many.hidden = surveyKind !== 'many';
    document.querySelectorAll('#survey-mode [data-survey-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.surveyMode === surveyMode);
    });
    const optionsWrap = el('#survey-options-wrap');
    if (optionsWrap) optionsWrap.hidden = surveyMode === 'card';
    const scopeWrap = el('#survey-scope-wrap');
    if (scopeWrap) scopeWrap.hidden = surveyMode !== 'card';
    if (surveyKind === 'many' && !document.querySelector('#survey-question-list [data-survey-row]')) {
      addSurveyRow();
    }
  }

  /* 多问卷：每一行就是一道题，回答方式各自独立 */
  function addSurveyRow() {
    const list = el('#survey-question-list');
    if (!list) return;
    if (list.querySelectorAll('[data-survey-row]').length >= SURVEY_MAX_QUESTIONS) {
      App.toast('一次最多 ' + SURVEY_MAX_QUESTIONS + ' 题');
      return;
    }
    const row = document.createElement('div');
    row.className = 'survey-editor-item';
    row.setAttribute('data-survey-row', '');
    row.innerHTML =
      '<div class="survey-editor-top">' +
        '<span class="survey-index">1</span>' +
        '<input class="survey-editor-title" data-survey-row-q maxlength="80" placeholder="写一个问题">' +
        '<button type="button" class="icon-btn" data-survey-row-del aria-label="删除这题">×</button>' +
      '</div>' +
      '<div class="survey-scope"><span>回答方式</span>' +
        '<select data-survey-row-mode>' +
          '<option value="card">字卡回答</option>' +
          '<option value="single">单选</option>' +
          '<option value="multi">多选</option>' +
        '</select>' +
      '</div>' +
      '<input class="survey-option-input" data-survey-row-options maxlength="120" placeholder="用 / 分隔 2~6 个选项" hidden>';
    list.appendChild(row);
    renumberSurveyRows();
  }

  function renumberSurveyRows() {
    document.querySelectorAll('#survey-question-list [data-survey-row]').forEach(function (row, index) {
      const badge = row.querySelector('.survey-index');
      if (badge) badge.textContent = String(index + 1);
    });
  }

  function resetSurveyForm() {
    surveyKind = 'one';
    surveyMode = 'card';
    const input = el('#survey-question-input');
    if (input) input.value = '';
    const options = el('#survey-options');
    if (options) options.value = '';
    const scope = el('#survey-scope');
    if (scope) scope.value = 'all';
    const delay = el('#survey-answer-delay');
    if (delay) delay.value = '4';
    const list = el('#survey-question-list');
    if (list) list.innerHTML = '';
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

  function collectSurveyMany() {
    const rows = Array.prototype.slice.call(
      document.querySelectorAll('#survey-question-list [data-survey-row]')
    );
    if (!rows.length) return { error: '先添加一道题' };
    const questions = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const input = row.querySelector('[data-survey-row-q]');
      const text = input ? String(input.value || '').trim() : '';
      if (!text) return { error: '第 ' + (i + 1) + ' 题还没写问题' };
      const modeSel = row.querySelector('[data-survey-row-mode]');
      const mode = modeSel ? modeSel.value : 'card';
      if (mode === 'single' || mode === 'multi') {
        const optionsInput = row.querySelector('[data-survey-row-options]');
        const options = parseSurveyOptions(optionsInput ? optionsInput.value : '');
        if (options.length < 2 || options.length > 6) {
          return { error: '第 ' + (i + 1) + ' 题需要 2~6 个选项' };
        }
        questions.push({ text: text, mode: mode, options: options });
      } else {
        questions.push({ text: text, mode: 'card', options: [], scope: 'all' });
      }
    }
    return { questions: questions };
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

  /* 每道题独立抽答案：上一题选过什么不影响这一题，可以选到同一个位置 */
  function surveyAnswerFor(question, contactId, used) {
    const avoid = used || { cards: {} };
    if (question.mode === 'single' || question.mode === 'multi') {
      const options = (question.options || []).slice();
      if (!options.length) return { text: question.text, mode: question.mode, answer: '（没有选项）' };
      if (question.mode === 'single') {
        const picked = Math.floor(Math.random() * options.length);
        return { text: question.text, mode: 'single', answer: options[picked] };
      }
      const count = 1 + Math.floor(Math.random() * options.length);
      const picked = [];
      while (picked.length < count && options.length) {
        picked.push(options.splice(Math.floor(Math.random() * options.length), 1)[0]);
      }
      return { text: question.text, mode: 'multi', answer: picked.join('、') };
    }
    /* 字卡回答：优先避开这份问卷里已经用过的字卡 */
    const candidates = App.pickCards('', 24, contactId, surveyScopeCats(question.scope))
      .filter(function (c) { return !avoid.cards[c.id]; });
    const cards = candidates.length ? candidates : App.pickCards('', 1, contactId, surveyScopeCats(question.scope));
    const card = cards.length ? cards[0] : null;
    if (card) avoid.cards[card.id] = true;
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
      const used = { cards: {} };
      const answers = (survey.questions || []).map(function (q) {
        return surveyAnswerFor(q, contactId, used);
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
      delete surveyTimers[surveyId];
    }, waitMs);
  }

  /* TA 主动发来一份问卷：概率和冷却时间在 设置 → 问卷 里改 */
  function taSurveyProbability() {
    const settings = App.state.settings || {};
    return settings.taSurveyProb == null
      ? 10
      : Math.max(0, Math.min(100, Number(settings.taSurveyProb) || 0));
  }

  function taSurveyCooldownMs() {
    const settings = App.state.settings || {};
    const min = settings.taSurveyCooldownMin == null
      ? 30
      : Math.max(0, Math.min(1440, Number(settings.taSurveyCooldownMin) || 0));
    return min * 60000;
  }

  function sendTaSurvey(contactId, delayMs) {
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
    }, delayMs);
  }

  function maybeTaSendSurvey() {
    if (document.hidden) return;
    const st = App.state;
    if (!st || !st.contacts.length) return;
    const settings = st.settings || {};
    const last = Number(settings.taSurveyLastAt) || 0;
    if (last && Date.now() - last < taSurveyCooldownMs()) return;
    const contactId = st.contacts.some(function (c) { return c.id === st.currentContactId; })
      ? st.currentContactId
      : st.contacts[0].id;
    const chat = st.chats[contactId] || [];
    /* 上一份问卷还没答，就先不再发新的 */
    if (chat.some(function (m) { return m.type === 'survey' && m.role === 'ta' && !m.answered; })) return;
    if (Math.random() * 100 >= taSurveyProbability()) return;
    if (!App.taDisturbHit('survey')) return;
    settings.taSurveyLastAt = Date.now();
    App.save();
    sendTaSurvey(contactId, 1500 + Math.random() * 3000);
  }

  App.maybeTaSurvey = maybeTaSendSurvey;

  function scheduleSurveyAppend(contactId) {
    if (Math.random() >= 0.4) return;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const cards = App.pickCards('', 1, contactId, ['聊天']);
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
        /* 用可编辑文本块代替 input，避开浏览器/输入法在上方弹出的站外自动填充条 */
        body = '<div class="survey-answer-input" contenteditable="true" role="textbox" aria-multiline="false"' +
          ' data-q="' + index + '" data-placeholder="写一句回答" aria-label="写一句回答"></div>';
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
        answer = input ? String(input.value != null ? input.value : input.textContent || '').trim() : '';
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
    const collected = surveyKind === 'many' ? collectSurveyMany() : collectSurveyQuestion();
    if (collected.error) { App.toast(collected.error); return; }
    const questions = surveyKind === 'many' ? collected.questions : [collected.question];
    const message = {
      id: App.uid('m'),
      role: 'me',
      type: 'survey',
      text: questions.length > 1 ? '发来一份多问卷' : '发来一份小问卷',
      questions: questions,
      answerDelay: surveyAnswerDelay(),
      answerDueAt: Date.now() + surveyAnswerDelay() * 1000,
      answered: false,
      ts: Date.now(),
    };
    /* 群聊「工具 → 问卷」：这一份发到群里，不进私聊，也不排 TA 的自动回答 */
    if (App.pendingGroupSurvey && App.pushGroupToolMessage) {
      const gid = App.pendingGroupSurvey;
      App.pendingGroupSurvey = null;
      App.pushGroupToolMessage(gid, message);
      hideToolPanel('#survey-dialog');
      resetSurveyForm();
      App.toast('问卷已发到群里');
      return;
    }
    deliverMessage(contactId, message);
    hideToolPanel('#survey-dialog');
    resetSurveyForm();
    App.toast('问卷已发出');
    scheduleSurveyAnswers(contactId, message.id, message.answerDelay);
  }

  /* 群聊「工具」入口：打开同一份问卷表单，提交时发到群里 */
  App.openGroupSurveyDialog = function (gid) {
    renderSurveyForm();
    showToolPanel('#survey-dialog');
    App.pendingGroupSurvey = gid;
  };

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

  /* 把牌放回牌堆里它原来的位置（按牌的序号插回去） */
  function returnCardToDeck(button) {
    const deck = el('#divine-deck');
    if (!deck || !button) return;
    const index = Number(button.dataset.divinePick);
    let next = null;
    Array.prototype.forEach.call(deck.children, function (node) {
      if (next) return;
      if (Number(node.dataset.divinePick) > index) next = node;
    });
    deck.insertBefore(button, next || null);
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
      returnCardToDeck(button);
      if (divine.phase === 'revealed') divine.phase = 'pick';
    } else {
      if (divine.picks.length >= divine.count) {
        App.toast('最多选 ' + divine.count + ' 张，先点掉一张再选');
        return;
      }
      divine.picks.push(index);
      button.classList.add('is-picked');
      const picked = el('#divine-picked');
      if (picked) picked.appendChild(button);
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
      returnCardToDeck(node);
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
    const picked = el('#divine-picked');
    if (picked) {
      picked.innerHTML = '';
      picked.className = 'divine-row divine-picked';
    }
    const deck = el('#divine-deck');
    if (deck) deck.innerHTML = '';
    const board = el('#divine-board');
    if (board) board.className = 'divine-board';
    updateDivineControls();
  }

  function startDivine() {
    if (!divine.type || !divine.count || divine.phase !== 'idle') return;
    const source = divine.type === 'tarot' ? TAROT_DECK : LENORMAND_DECK;
    divine.deck = shuffleDeck(source);
    divine.picks = [];
    divine.cards = {};
    divine.phase = 'pick';
    const picked = el('#divine-picked');
    if (picked) {
      picked.innerHTML = '';
      picked.className = 'divine-row divine-picked count-' + divine.count;
    }
    const deck = el('#divine-deck');
    if (deck) {
      deck.innerHTML = divine.deck.map(function (name, i) {
        return divineCardHtml(i);
      }).join('');
      deck.scrollLeft = 0;
    }
    const board = el('#divine-board');
    if (board) board.className = 'divine-board is-deck';
    updateDivineControls();
  }

  function scheduleDivineReply(contactId, messageId) {
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || [];
      const message = chat.find(function (m) { return m.id === messageId; });
      if (!message || message.reply) return;
      const cards = App.pickCards('', 1, contactId, ['聊天']);
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

  /* ---------------- 游戏：双人扫雷（我一下，TA 一下） ---------------- */
  const MINE_DIFFS = {
    easy: { size: 9, count: 10, label: '简单 9×9 · 10 雷' },
    hard: { size: 12, count: 24, label: '困难 12×12 · 24 雷' },
    extreme: { size: 14, count: 45, label: '极限 14×14 · 45 雷' },
  };
  let mineDiff = 'easy';
  let mine = null; /* { cells:[{mine,open,flag,n,by}], over, opened, turn, meCount, taCount, timer } */

  function mineNeighbors(i) {
    const size = MINE_DIFFS[mineDiff].size;
    const x = i % size;
    const y = Math.floor(i / size);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        out.push(ny * size + nx);
      }
    }
    return out;
  }

  function resetMine() {
    const diff = MINE_DIFFS[mineDiff];
    if (mine && mine.timer) clearTimeout(mine.timer);
    const cells = [];
    for (let i = 0; i < diff.size * diff.size; i++) cells.push({ mine: false, open: false, flag: false, n: 0, by: '' });
    let placed = 0;
    while (placed < diff.count) {
      const i = Math.floor(Math.random() * cells.length);
      if (cells[i].mine) continue;
      cells[i].mine = true;
      placed++;
    }
    cells.forEach(function (c, i) {
      if (c.mine) return;
      c.n = mineNeighbors(i).filter(function (j) { return cells[j].mine; }).length;
    });
    mine = { cells: cells, over: false, opened: 0, turn: 'me', meCount: 0, taCount: 0, timer: 0, winner: '' };
    document.querySelectorAll('[data-mine-diff]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.mineDiff === mineDiff);
    });
    renderMine();
  }

  function renderMine() {
    const board = el('#mine-board');
    if (!board || !mine) return;
    const diff = MINE_DIFFS[mineDiff];
    board.style.gridTemplateColumns = 'repeat(' + diff.size + ', 1fr)';
    board.innerHTML = mine.cells.map(function (c, i) {
      let text = '';
      let cls = 'mine-cell';
      if (c.open) {
        cls += ' is-open';
        if (c.mine) { text = '💣'; cls += ' is-boom'; }
        else if (c.n) { text = String(c.n); cls += ' n' + c.n; }
        if (c.by === 'ta') cls += ' by-ta';
      } else if (c.flag) {
        text = '🚩';
        cls += ' is-flag';
      }
      return '<button type="button" class="' + cls + '" data-mine="' + i + '"' +
        (c.open ? ' aria-label="已翻开"' : ' aria-label="未翻开"') + '>' + text + '</button>';
    }).join('');

    if (el('#mine-status')) {
      let text;
      if (mine.over === 'lose') {
        text = mine.winner === 'me' ? 'TA 踩到雷了，你赢了！点重新开始再来一局。' : '你踩到雷了，TA 赢了。点重新开始再战。';
      } else if (mine.over === 'flagwin') {
        text = '所有雷都插上小旗子了，游戏胜利！点重新开始再来一局。';
      } else if (mine.over === 'win') {
        text = mine.winner === 'draw'
          ? '全部扫完，你们打成了平手。'
          : (mine.winner === 'me' ? '全部扫完，你翻的格子更多，你赢了！' : '全部扫完，TA 翻的格子更多，TA 赢了。');
      } else {
        text = (mine.turn === 'me' ? '轮到你点一格' : 'TA 正在选格子…') +
          ' · 我 ' + mine.meCount + ' 格 / TA ' + mine.taCount + ' 格 · ' + diff.label;
      }
      el('#mine-status').textContent = text;
    }
  }

  function openMineCell(i, by) {
    if (!mine || mine.over) return;
    if (mine.turn !== by) return;
    const diff = MINE_DIFFS[mineDiff];
    const cell = mine.cells[i];
    if (!cell || cell.open || cell.flag) return;
    if (cell.mine) {
      cell.open = true;
      cell.by = by;
      mine.over = 'lose';
      mine.winner = by === 'me' ? 'ta' : 'me';
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
      c.by = by;
      mine.opened++;
      if (by === 'me') mine.meCount++;
      else mine.taCount++;
      if (!c.n) mineNeighbors(cur).forEach(function (j) { stack.push(j); });
    }
    if (mine.opened >= diff.size * diff.size - diff.count) {
      mine.over = 'win';
      mine.winner = mine.meCount === mine.taCount ? 'draw' : (mine.meCount > mine.taCount ? 'me' : 'ta');
      renderMine();
      return;
    }
    mine.turn = by === 'me' ? 'ta' : 'me';
    renderMine();
    if (mine.turn === 'ta') {
      mine.timer = setTimeout(taMineMove, 900 + Math.random() * 900);
    }
  }

  function taMineMove() {
    if (!mine || mine.over || mine.turn !== 'ta') return;
    const layer = el('#mine-dialog');
    if (layer && layer.hidden) { mine.turn = 'me'; renderMine(); return; }
    const candidates = [];
    mine.cells.forEach(function (c, i) {
      if (!c.open && !c.flag) candidates.push(i);
    });
    if (!candidates.length) { mine.turn = 'me'; renderMine(); return; }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    openMineCell(pick, 'ta');
  }

  function toggleMineFlag(i) {
    if (!mine || mine.over) return;
    const cell = mine.cells[i];
    if (!cell || cell.open) return;
    cell.flag = !cell.flag;
    if (cell.flag) {
      const diff = MINE_DIFFS[mineDiff];
      const done = mine.cells.filter(function (c) { return c.mine && c.flag; }).length;
      /* 所有雷的位置都插上小旗子即获胜，插在非雷位置不影响判定 */
      if (done >= diff.count) {
        mine.over = 'flagwin';
        if (mine.timer) { clearTimeout(mine.timer); mine.timer = 0; }
      }
    }
    renderMine();
  }

  /* ---------------- 游戏：跳一跳（长条量距离，跳上平台继续） ---------------- */
  let jump = null;
  const JUMP_MAX = 200; /* 长条滑到最右对应的最远跳跃距离（屏幕放不下时按舞台宽度收缩） */

  function jumpBaseX() {
    const stage = el('#jump-stage');
    const w = (stage && stage.clientWidth) || 0;
    return (w || 320) * 0.2;
  }

  /* 竖线走到最右时，落点刚好接近舞台右沿，保证长条和平台的位置对得上 */
  function jumpMaxDist() {
    const stage = el('#jump-stage');
    const w = (stage && stage.clientWidth) || 320;
    return Math.max(80, Math.min(JUMP_MAX, w - jumpBaseX() - 34));
  }

  function showJumpResult() {
    const result = el('#jump-result');
    if (result) result.hidden = false;
    if (el('#jump-result-score')) {
      el('#jump-result-score').textContent = '我 ' + jump.me + ' 分 · TA ' + jump.ta + ' 分';
    }
    const startBtn = el('#jump-start');
    if (startBtn) startBtn.hidden = true;
  }

  function renderJump() {
    if (!jump) return;
    const world = el('#jump-world');
    const cur = el('#jump-plat-cur');
    const next = el('#jump-plat-next');
    const piece = el('#jump-piece');
    const marker = el('#jump-marker');
    if (world) world.style.transform = 'translateX(' + (-jump.camX) + 'px)';
    if (cur) {
      cur.style.left = (jump.curX - jump.curW / 2) + 'px';
      cur.style.width = jump.curW + 'px';
      cur.style.height = jump.curH + 'px';
    }
    if (next) {
      next.style.left = (jump.nextX - jump.nextW / 2) + 'px';
      next.style.width = jump.nextW + 'px';
      next.style.height = jump.nextH + 'px';
    }
    if (piece) {
      piece.style.left = (jump.pieceX - (piece.offsetWidth || 22) / 2) + 'px';
      piece.style.bottom = jump.pieceBottom + 'px';
      if (!jump.over) piece.style.transform = 'rotate(' + (jump.spin || 0) + 'deg)';
    }
    if (marker) {
      /* 竖线按落点在舞台里的实际位置摆放，看到哪里就跳到哪里 */
      const stage = el('#jump-stage');
      const track = el('#jump-track');
      const stageW = (stage && stage.clientWidth) || 320;
      const trackW = (track && track.clientWidth) || stageW;
      const maxDist = jump.maxDist || jumpMaxDist();
      const landX = jumpBaseX() + jump.pos * maxDist;
      const pct = Math.max(0, Math.min(100, (landX - 8) / trackW * 100));
      marker.style.left = pct + '%';
    }
    if (el('#jump-me')) el('#jump-me').textContent = String(jump.me);
    if (el('#jump-ta')) el('#jump-ta').textContent = String(jump.ta);
  }

  function jumpFrame(now) {
    if (!jump || !jump.running) return;
    const layer = el('#jump-dialog');
    if (!layer || layer.hidden) { jump.running = false; return; }
    const dt = Math.min(50, now - (jump.last || now));
    jump.last = now;
    jump.pos += jump.dir * jump.speed * dt / 1000;
    if (jump.pos >= 1) { jump.pos = 1; jump.dir = -1; }
    if (jump.pos <= 0) { jump.pos = 0; jump.dir = 1; }
    renderJump();
    /* TA 的回合：竖线滑到它选好的距离就自动起跳 */
    if (jump.turn === 'ta' && jump.taPlan != null) {
      const nowDist = jump.pos * (jump.maxDist || JUMP_MAX);
      const prev = jump.taPrev == null ? nowDist : jump.taPrev;
      jump.taPrev = nowDist;
      if ((prev - jump.taPlan) * (nowDist - jump.taPlan) <= 0) {
        jumpCommit();
        return;
      }
    }
    jump.raf = requestAnimationFrame(jumpFrame);
  }

  function jumpPlanTa() {
    const gap = jump.nextX - jump.curX;
    const half = Math.max(2, jump.nextW / 2 - 8);
    let dist;
    if (Math.random() < 0.85) {
      dist = gap + (Math.random() * 2 - 1) * half;
    } else {
      /* 偶尔踩空，让对局有输赢 */
      dist = gap + (Math.random() < 0.5 ? -1 : 1) * (half + 12 + Math.random() * 36);
    }
    jump.taPlan = Math.max(2, Math.min(jump.maxDist || JUMP_MAX, dist));
    jump.taPrev = null;
  }

  function startJumpRound() {
    if (!jump || jump.running || jump.over) return;
    if (jump.turn === 'ta') jumpPlanTa();
    jump.locked = false;
    jump.running = true;
    jump.last = 0;
    jump.raf = requestAnimationFrame(jumpFrame);
  }

  function jumpSpawnNext() {
    jump.nextX = jump.curX + 90 + Math.random() * 80;
    jump.nextW = 44 + Math.random() * 8;
    jump.nextH = 30 + Math.floor(Math.random() * 3) * 8;
  }

  function resetJump() {
    if (jump) {
      if (jump.raf) cancelAnimationFrame(jump.raf);
      if (jump.timer) clearTimeout(jump.timer);
    }
    const piece = el('#jump-piece');
    if (piece) piece.classList.remove('is-fall');
    jump = {
      pos: 0, dir: 1, speed: 0.55,
      curX: 0, curW: 46, curH: 36,
      nextX: 0, nextW: 46, nextH: 36,
      pieceX: 0, pieceBottom: 36, spin: 0,
      camX: 0,
      turn: 'me', me: 0, ta: 0, taPlan: null, taPrev: null,
      running: false, locked: false, started: false, raf: 0, last: 0, timer: 0, over: false,
      maxDist: jumpMaxDist(),
    };
    jumpSpawnNext();
    jump.camX = jump.curX - jumpBaseX();
    const next = el('#jump-plat-next');
    if (next) next.classList.remove('is-rise');
    const result = el('#jump-result');
    if (result) result.hidden = true;
    const startBtn = el('#jump-start');
    if (startBtn) startBtn.hidden = false;
    const trackHint = el('#jump-dialog .jump-track-hint');
    if (trackHint) trackHint.textContent = '先点「开始游戏」';
    if (el('#jump-status')) {
      el('#jump-status').textContent = '点「开始游戏」，然后轮流跳上平台。';
    }
    renderJump();
  }

  function startJumpGame() {
    if (!jump || jump.started || jump.over) return;
    jump.started = true;
    jump.maxDist = jumpMaxDist();
    const startBtn = el('#jump-start');
    if (startBtn) startBtn.hidden = true;
    const result = el('#jump-result');
    if (result) result.hidden = true;
    const trackHint = el('#jump-dialog .jump-track-hint');
    if (trackHint) trackHint.textContent = '点这里起跳';
    if (el('#jump-status')) {
      el('#jump-status').textContent = '轮到你：竖线在长条上滑，点一下长条就起跳，落在平台上才站得住。';
    }
    startJumpRound();
  }

  /* 棋子起跳：横向移动到落点，同时走一段抛物线 */
  function jumpFly(dist, done) {
    if (!jump) return;
    const from = jump.curX;
    const to = jump.curX + dist;
    const start = performance.now();
    const dur = 300 + Math.min(240, dist * 0.9);
    function frame(now) {
      if (!jump) return;
      const layer = el('#jump-dialog');
      if (!layer || layer.hidden) return;
      const t = Math.min(1, (now - start) / dur);
      jump.pieceX = from + (to - from) * t;
      jump.pieceBottom = jump.curH + Math.sin(Math.PI * t) * 58;
      jump.spin = Math.sin(Math.PI * t) * 10;
      renderJump();
      if (t < 1) requestAnimationFrame(frame);
      else { jump.spin = 0; done(); }
    }
    requestAnimationFrame(frame);
  }

  function jumpLand() {
    if (!jump) return;
    const next = el('#jump-plat-next');
    const diff = jump.pieceX - jump.nextX;
    /* 棋子中心要真的落在平台顶面上，离得远一点就站不住 */
    if (Math.abs(diff) > Math.max(6, jump.nextW / 2 - 6)) {
      jump.over = true;
      const piece = el('#jump-piece');
      if (piece) {
        piece.classList.add('is-fall');
        piece.style.transform = '';
      }
      if (el('#jump-status')) {
        el('#jump-status').textContent = jump.turn === 'me'
          ? '你踩空了，TA 赢了。我 ' + jump.me + ' 分 / TA ' + jump.ta + ' 分。'
          : 'TA 踩空了，你赢了！我 ' + jump.me + ' 分 / TA ' + jump.ta + ' 分。';
      }
      showJumpResult();
      renderJump();
      return;
    }
    const perfect = Math.abs(diff) <= 8;
    const gain = perfect ? 2 : 1;
    if (jump.turn === 'me') jump.me += gain;
    else jump.ta += gain;
    jump.curX = jump.nextX;
    jump.curW = jump.nextW;
    jump.curH = jump.nextH;
    jump.pieceX = jump.curX;
    jump.pieceBottom = jump.curH;
    jumpSpawnNext();
    /* 相机跟着平移到新平台，新平台从下方升起 */
    jump.camX = jump.curX - jumpBaseX();
    jump.turn = jump.turn === 'me' ? 'ta' : 'me';
    jump.taPlan = null;
    jump.taPrev = null;
    if (el('#jump-status')) {
      el('#jump-status').textContent = (jump.turn === 'ta' ? '轮到 TA' : '轮到你') +
        ' · ' + (perfect ? '完美 +2' : '+1') + ' · 我 ' + jump.me + ' / TA ' + jump.ta;
    }
    renderJump();
    if (next) {
      next.classList.remove('is-rise');
      void next.offsetWidth;
      next.classList.add('is-rise');
    }
    jump.speed = Math.min(1.4, jump.speed + 0.05);
    jump.timer = setTimeout(function () {
      const layer = el('#jump-dialog');
      if (jump && !jump.over && layer && !layer.hidden) startJumpRound();
    }, 520);
  }

  function jumpCommit() {
    if (!jump || jump.locked || !jump.running || jump.over) return;
    jump.running = false;
    jump.locked = true;
    if (jump.raf) cancelAnimationFrame(jump.raf);
    jumpFly(Math.max(2, jump.pos * (jump.maxDist || JUMP_MAX)), jumpLand);
  }

  function stopJump() {
    /* 只有轮到我时才能点长条起跳，TA 的回合由它自己跳 */
    if (!jump || jump.over || !jump.started || jump.turn !== 'me') return;
    jumpCommit();
  }

  /* ---------------- 游戏：羊了个羊（三层牌堆，双人回合制） ---------------- */
  const SHEEP_EMOJI = ['🐑', '🍎', '🍓', '🍋', '🍇', '🌰', '🥕', '🌽', '🍄', '🍰', '🐟'];
  /* 每一层牌的位置（百分比，相对牌桌宽高）；越靠后的层越在上面 */
  const SHEEP_LAYOUT = [
    [0, 12, 26], [0, 31, 26], [0, 50, 26], [0, 69, 26], [0, 88, 26],
    [0, 12, 50], [0, 31, 50], [0, 50, 50], [0, 69, 50], [0, 88, 50],
    [0, 12, 74], [0, 31, 74], [0, 50, 74], [0, 69, 74], [0, 88, 74],
    [1, 21, 38], [1, 40, 38], [1, 59, 38], [1, 78, 38],
    [1, 21, 62], [1, 40, 62], [1, 59, 62], [1, 78, 62],
    [1, 50, 50],
    [2, 31, 38], [2, 50, 38], [2, 69, 38],
    [2, 31, 62], [2, 50, 62], [2, 69, 62],
    [3, 38, 50], [3, 50, 50], [3, 62, 50]
  ];
  let sheep = null; /* { tiles:[{x,y,layer,emoji,taken}], slots:[], turn, me, ta, over, winner, timer } */

  /* 上面一层的牌压住了就点不动 */
  function sheepBlocked(tile, tiles) {
    return tiles.some(function (other) {
      if (other.taken || other.layer <= tile.layer) return false;
      return Math.abs(other.x - tile.x) < 11.5 && Math.abs(other.y - tile.y) < 13;
    });
  }

  function sheepShuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* 随机生成一条合法的拿牌顺序：每一步只从当前没有被压住的牌里挑 */
  function sheepPeelOrder(tiles) {
    const work = tiles.map(function (t, i) {
      return { layer: t.layer, x: t.x, y: t.y, taken: false, index: i };
    });
    const order = [];
    while (order.length < work.length) {
      const free = work.filter(function (t) { return !t.taken && !sheepBlocked(t, work); });
      if (!free.length) break;
      const pick = free[Math.floor(Math.random() * free.length)];
      pick.taken = true;
      order.push(pick.index);
    }
    return order;
  }

  /* 顺着合法顺序把同款三张交错隔开：整副牌一定清得完，
     但又不像按层成组那样一眼就能消，需要先垫上几张牌顶着槽位 */
  function sheepDeal(tiles) {
    const order = sheepPeelOrder(tiles);
    const pools = sheepShuffle(SHEEP_EMOJI);
    const BLOCK = 9; /* 9 张 3 组交错放置，同时最多占 6 个槽位，不会爆槽 */
    let ei = 0;
    for (let start = 0; start < order.length; start += BLOCK) {
      const block = order.slice(start, start + BLOCK);
      const groups = Math.ceil(block.length / 3);
      for (let g = 0; g < groups; g++) {
        const emoji = pools[ei++ % pools.length];
        for (let k = 0; k < 3; k++) {
          const pos = g + k * groups;
          if (pos < block.length) tiles[block[pos]].emoji = emoji;
        }
      }
    }
  }

  function resetSheep() {
    if (sheep && sheep.timer) clearTimeout(sheep.timer);
    const tiles = SHEEP_LAYOUT.map(function (item) {
      return { layer: item[0], x: item[1], y: item[2], emoji: '', taken: false };
    });
    sheepDeal(tiles);
    sheep = { tiles: tiles, slots: [], turn: 'me', me: 0, ta: 0, over: '', winner: '', timer: 0 };
    renderSheep();
  }

  function renderSheepSlots() {
    const box = el('#sheep-slots');
    if (!box || !sheep) return;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const e = sheep.slots[i] || '';
      html += '<span class="sheep-slot' + (e ? ' is-filled' : '') + '">' + e + '</span>';
    }
    box.innerHTML = html;
  }

  function renderSheep() {
    if (!sheep) return;
    const board = el('#sheep-board');
    if (board) {
      board.innerHTML = sheep.tiles.map(function (t, i) {
        if (t.taken) return '';
        const blocked = sheepBlocked(t, sheep.tiles);
        return '<button type="button" class="sheep-tile' + (blocked ? ' is-blocked' : '') + '" data-sheep="' + i + '"' +
          ' style="left:' + t.x + '%;top:' + t.y + '%;z-index:' + (t.layer + 1) + '"' +
          ' aria-label="' + (blocked ? '被上面的牌压住' : '选这张牌') + '">' + t.emoji + '</button>';
      }).join('');
    }
    renderSheepSlots();
    if (el('#sheep-me')) el('#sheep-me').textContent = String(sheep.me);
    if (el('#sheep-ta')) el('#sheep-ta').textContent = String(sheep.ta);
    const status = el('#sheep-status');
    if (!status) return;
    const left = sheep.tiles.filter(function (t) { return !t.taken; }).length;
    if (sheep.over === 'overflow') {
      status.textContent = sheep.winner === 'me'
        ? 'TA 把槽位塞满了，你赢了！点「重新开始」再来一局。'
        : '槽位满了，TA 赢了。点「重新开始」再来一局。';
    } else if (sheep.over === 'clear') {
      status.textContent = sheep.winner === 'draw'
        ? '牌都清完了，你们打成平手。'
        : (sheep.winner === 'me' ? '牌都清完了，你消掉的组数更多，你赢了！' : '牌都清完了，TA 消掉的组数更多，TA 赢了。');
    } else {
      status.textContent = (sheep.turn === 'me' ? '轮到你选一张牌' : 'TA 正在选牌…') +
        ' · 剩余 ' + left + ' 张 · 槽位 ' + sheep.slots.length + '/7 · 消掉一组后换人';
    }
  }

  function sheepTake(index, by) {
    if (!sheep || sheep.over || sheep.turn !== by) return;
    const tile = sheep.tiles[index];
    if (!tile || tile.taken) return;
    if (sheepBlocked(tile, sheep.tiles)) {
      if (by === 'me') App.toast('这张被上面的牌压住了');
      return;
    }
    tile.taken = true;
    sheep.slots.push(tile.emoji);
    /* 槽里凑够三张同款就消掉，记一组；消掉一组才换人 */
    const same = sheep.slots.filter(function (e) { return e === tile.emoji; }).length;
    const cleared = same >= 3;
    if (cleared) {
      let removed = 0;
      sheep.slots = sheep.slots.filter(function (e) {
        if (e === tile.emoji && removed < 3) { removed++; return false; }
        return true;
      });
      if (by === 'me') sheep.me++;
      else sheep.ta++;
    }
    if (sheep.tiles.every(function (t) { return t.taken; })) {
      sheep.over = 'clear';
      sheep.winner = sheep.me === sheep.ta ? 'draw' : (sheep.me > sheep.ta ? 'me' : 'ta');
      renderSheep();
      return;
    }
    if (sheep.slots.length >= 7) {
      sheep.over = 'overflow';
      sheep.winner = by === 'me' ? 'ta' : 'me';
      renderSheep();
      return;
    }
    if (cleared) sheep.turn = by === 'me' ? 'ta' : 'me';
    renderSheep();
    if (sheep.turn === 'ta') sheep.timer = setTimeout(taSheepMove, 800 + Math.random() * 900);
  }

  function taSheepMove() {
    if (!sheep || sheep.over || sheep.turn !== 'ta') return;
    const layer = el('#sheep-dialog');
    if (layer && layer.hidden) { sheep.turn = 'me'; return; }
    const free = [];
    sheep.tiles.forEach(function (t, i) {
      if (!t.taken && !sheepBlocked(t, sheep.tiles)) free.push(i);
    });
    if (!free.length) { sheep.turn = 'me'; renderSheep(); return; }
    const countOf = function (e) {
      return sheep.slots.filter(function (x) { return x === e; }).length;
    };
    /* 优先补齐槽里已有的两张，其次是有一张的，否则随机挑一张 */
    const two = free.filter(function (i) { return countOf(sheep.tiles[i].emoji) >= 2; });
    const one = free.filter(function (i) { return countOf(sheep.tiles[i].emoji) === 1; });
    const pool = two.length ? two : (one.length ? one : free);
    sheepTake(pool[Math.floor(Math.random() * pool.length)], 'ta');
  }

  /* ---------------- 游戏：五子棋（我执黑先手，TA 执白） ---------------- */
  const GOMOKU_SIZE = 15;
  let gomoku = null; /* { cells:[], turn, over, winner, last, timer } */

  function gomokuIndex(x, y) { return y * GOMOKU_SIZE + x; }

  function resetGomoku() {
    if (gomoku && gomoku.timer) clearTimeout(gomoku.timer);
    gomoku = {
      cells: new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(''),
      turn: 'me', over: '', winner: '', last: -1, timer: 0
    };
    renderGomoku();
  }

  function renderGomoku() {
    const board = el('#gomoku-board');
    if (!board || !gomoku) return;
    board.innerHTML = gomoku.cells.map(function (cell, i) {
      return '<button type="button" class="gomoku-cell" data-gomoku="' + i + '" aria-label="' +
        (cell === 'me' ? '黑棋' : cell === 'ta' ? '白棋' : '空位') + '">' +
        (cell ? '<span class="gomoku-stone is-' + (cell === 'me' ? 'black' : 'white') + (gomoku.last === i ? ' is-last' : '') + '"></span>' : '') +
        '</button>';
    }).join('');
    const meSide = el('#gomoku-me-side');
    const taSide = el('#gomoku-ta-side');
    if (meSide) meSide.classList.toggle('is-turn', !gomoku.over && gomoku.turn === 'me');
    if (taSide) taSide.classList.toggle('is-turn', !gomoku.over && gomoku.turn === 'ta');
    const status = el('#gomoku-status');
    if (!status) return;
    if (gomoku.over === 'win') {
      status.textContent = gomoku.winner === 'me'
        ? '五子连成，你赢了！点「重新开始」再来一局。'
        : 'TA 连成了五子，这局 TA 赢了。点「重新开始」再战。';
    } else if (gomoku.over === 'draw') {
      status.textContent = '棋盘下满了，平局。点「重新开始」再来一局。';
    } else {
      status.textContent = gomoku.turn === 'me' ? '轮到你落黑子。' : 'TA 正在想白子落在哪里…';
    }
  }

  function gomokuWin(cells, index, role) {
    const x = index % GOMOKU_SIZE;
    const y = Math.floor(index / GOMOKU_SIZE);
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let d = 0; d < dirs.length; d++) {
      const dx = dirs[d][0];
      const dy = dirs[d][1];
      let count = 1;
      for (let s = 1; s <= 4; s++) {
        const nx = x + dx * s;
        const ny = y + dy * s;
        if (nx < 0 || ny < 0 || nx >= GOMOKU_SIZE || ny >= GOMOKU_SIZE) break;
        if (cells[gomokuIndex(nx, ny)] !== role) break;
        count++;
      }
      for (let s = 1; s <= 4; s++) {
        const nx = x - dx * s;
        const ny = y - dy * s;
        if (nx < 0 || ny < 0 || nx >= GOMOKU_SIZE || ny >= GOMOKU_SIZE) break;
        if (cells[gomokuIndex(nx, ny)] !== role) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function gomokuPlace(index, role) {
    if (!gomoku || gomoku.over || gomoku.turn !== role) return;
    if (gomoku.cells[index]) return;
    gomoku.cells[index] = role;
    gomoku.last = index;
    if (gomokuWin(gomoku.cells, index, role)) {
      gomoku.over = 'win';
      gomoku.winner = role;
      renderGomoku();
      return;
    }
    if (gomoku.cells.every(function (c) { return c; })) {
      gomoku.over = 'draw';
      renderGomoku();
      return;
    }
    gomoku.turn = role === 'me' ? 'ta' : 'me';
    renderGomoku();
    if (gomoku.turn === 'ta') gomoku.timer = setTimeout(taGomokuMove, 480 + Math.random() * 420);
  }

  /* TA 落子：先看能不能自己连成五子，再堵我的棋，其余按周围密度挑位置 */
  function taGomokuMove() {
    if (!gomoku || gomoku.over || gomoku.turn !== 'ta') return;
    const layer = el('#gomoku-dialog');
    if (layer && layer.hidden) { gomoku.turn = 'me'; return; }
    const empty = [];
    gomoku.cells.forEach(function (c, i) { if (!c) empty.push(i); });
    if (!empty.length) { gomoku.turn = 'me'; renderGomoku(); return; }
    const score = function (index, role) {
      const x = index % GOMOKU_SIZE;
      const y = Math.floor(index / GOMOKU_SIZE);
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      let total = 0;
      for (let d = 0; d < dirs.length; d++) {
        let run = 1;
        for (let sign = -1; sign <= 1; sign += 2) {
          for (let s = 1; s <= 4; s++) {
            const nx = x + dirs[d][0] * s * sign;
            const ny = y + dirs[d][1] * s * sign;
            if (nx < 0 || ny < 0 || nx >= GOMOKU_SIZE || ny >= GOMOKU_SIZE) break;
            if (gomoku.cells[gomokuIndex(nx, ny)] !== role) break;
            run++;
          }
        }
        total += run * run;
      }
      return total;
    };
    let best = empty[Math.floor(Math.random() * empty.length)];
    let bestValue = -1;
    empty.forEach(function (i) {
      const value = score(i, 'ta') * 1.05 + score(i, 'me');
      if (value > bestValue) { bestValue = value; best = i; }
    });
    gomokuPlace(best, 'ta');
  }

  /* ---------------- 游戏：你画我猜 ---------------- */
  const DG_WORDS = {
    水果: ['香蕉', '苹果', '西瓜', '草莓', '葡萄', '菠萝', '橙子', '桃子', '梨', '樱桃'],
    动物: ['大象', '熊猫', '长颈鹿', '小猫', '小狗', '兔子', '老虎', '企鹅', '海豚', '蝴蝶'],
    食物: ['汉堡', '披萨', '面条', '饺子', '蛋糕', '冰淇淋', '火锅', '寿司', '包子', '薯条'],
    日用品: ['雨伞', '牙刷', '水杯', '闹钟', '台灯', '剪刀', '钥匙', '眼镜', '梳子', '手套'],
    交通工具: ['自行车', '汽车', '飞机', '火车', '轮船', '热气球', '摩托车', '地铁', '滑板', '火箭'],
    自然: ['月亮', '太阳', '彩虹', '雪人', '大树', '山峰', '云朵', '星星', '海浪', '火山'],
    运动: ['篮球', '足球', '乒乓球', '羽毛球', '游泳', '跳绳', '跑步', '滑雪', '瑜伽', '排球'],
    乐器: ['吉他', '钢琴', '小提琴', '架子鼓', '口琴', '笛子', '萨克斯', '竖琴', '二胡', '手鼓'],
  };
  let drawGuess = null;
  let dgDraw = null;

  function dgShuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function dgSetHint(text) {
    const hint = el('#dg-hint');
    if (hint) hint.textContent = text;
  }

  function dgPoint(e) {
    const canvas = dgDraw.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * canvas.width / (rect.width || 1),
      y: (e.clientY - rect.top) * canvas.height / (rect.height || 1),
    };
  }

  function dgClearCanvas() {
    if (!dgDraw) return;
    const ctx = dgDraw.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dgDraw.canvas.width, dgDraw.canvas.height);
    ctx.restore();
  }

  /* 全屏/退出全屏时把画布分辨率对齐显示尺寸，并把已有笔迹等比搬过去 */
  function dgResizeCanvas() {
    if (!dgDraw) return;
    const canvas = dgDraw.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (Math.abs(canvas.width - w) < 2 && Math.abs(canvas.height - h) < 2) return;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = w;
    canvas.height = h;
    dgDraw.ctx = canvas.getContext('2d');
    dgClearCanvas();
    dgDraw.ctx.drawImage(tmp, 0, 0, w, h);
    dgDraw.undo = [];
  }

  function dgSetupCanvas() {
    const canvas = el('#dg-canvas');
    if (!canvas || !canvas.getContext) return;
    if (!dgDraw || dgDraw.canvas !== canvas) {
      dgDraw = { canvas: canvas, ctx: canvas.getContext('2d'), color: '#2f3b4a', erasing: false, drawing: false, undo: [], moved: false };
    }
    canvas.style.touchAction = 'none';
    if (!canvas.dataset.bound) {
      canvas.dataset.bound = '1';
      canvas.addEventListener('pointerdown', function (e) {
        if (!dgDraw) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        dgDraw.drawing = true;
        dgDraw.moved = false;
        dgDraw.undo.push(dgDraw.ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (dgDraw.undo.length > 12) dgDraw.undo.shift();
        const p = dgPoint(e);
        dgDraw.last = p;
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!dgDraw || !dgDraw.drawing) return;
        e.preventDefault();
        const p = dgPoint(e);
        const ctx = dgDraw.ctx;
        ctx.strokeStyle = dgDraw.erasing ? '#ffffff' : dgDraw.color;
        ctx.lineWidth = dgDraw.erasing ? 18 : 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(dgDraw.last.x, dgDraw.last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        dgDraw.last = p;
        dgDraw.moved = true;
      }, { passive: false });
      const end = function () {
        if (!dgDraw || !dgDraw.drawing) return;
        if (!dgDraw.moved) {
          const ctx = dgDraw.ctx;
          ctx.fillStyle = dgDraw.erasing ? '#ffffff' : dgDraw.color;
          ctx.beginPath();
          ctx.arc(dgDraw.last.x, dgDraw.last.y, dgDraw.erasing ? 9 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
        dgDraw.drawing = false;
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('pointerleave', end);
    }
    dgClearCanvas();
  }

  function dgRenderScore() {
    if (!drawGuess) return;
    const right = el('#dg-right');
    const total = el('#dg-total');
    if (right) right.textContent = drawGuess.right;
    if (total) total.textContent = drawGuess.total;
  }

  function dgRenderWord() {
    if (!drawGuess) return;
    const word = el('#dg-word');
    const cat = el('#dg-cat');
    if (word) word.textContent = drawGuess.word;
    if (cat) cat.textContent = drawGuess.cat;
  }

  function dgRenderOptions() {
    const box = el('#dg-options');
    if (!box || !drawGuess) return;
    const letters = ['A', 'B', 'C', 'D'];
    box.innerHTML = drawGuess.options.map(function (option, i) {
      return '<button type="button" class="dg-option" data-dg-option="' + i + '">' +
        '<b>' + letters[i] + '</b><span>' + App.esc(option) + '</span></button>';
    }).join('');
    box.hidden = false;
  }

  function dgResetUi() {
    const options = el('#dg-options');
    if (options) { options.hidden = true; options.innerHTML = ''; }
    const result = el('#dg-result');
    if (result) { result.hidden = true; result.className = 'dg-result'; result.textContent = ''; }
    const guess = el('#dg-guess');
    if (guess) { guess.hidden = false; guess.disabled = false; }
    const next = el('#dg-next');
    if (next) next.hidden = true;
    const desc = el('#dg-desc');
    if (desc) desc.value = '';
  }

  function dgNewRound() {
    if (!drawGuess) return;
    if (drawGuess.timer) clearTimeout(drawGuess.timer);
    if (drawGuess.thinkTimer) { clearInterval(drawGuess.thinkTimer); drawGuess.thinkTimer = 0; }
    const cats = Object.keys(DG_WORDS);
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const pool = DG_WORDS[cat];
    let word = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && word === drawGuess.lastWord) {
      word = pool[(pool.indexOf(word) + 1) % pool.length];
    }
    const wrongs = dgShuffle(pool.filter(function (item) { return item !== word; })).slice(0, 3);
    const options = dgShuffle([word].concat(wrongs));
    drawGuess.word = word;
    drawGuess.cat = cat;
    drawGuess.options = options;
    drawGuess.correct = options.indexOf(word);
    drawGuess.lastWord = word;
    drawGuess.picked = null;
    drawGuess.over = false;
    dgRenderWord();
    dgRenderScore();
    dgResetUi();
    dgSetHint('画出这个词，或者写一句描述，再让 TA 从四个同类选项里猜。');
    dgClearCanvas();
    if (dgDraw) dgDraw.undo = [];
    dgRenderScore();
  }

  function resetDrawGuess() {
    if (drawGuess) {
      if (drawGuess.timer) clearTimeout(drawGuess.timer);
      if (drawGuess.thinkTimer) clearInterval(drawGuess.thinkTimer);
    }
    drawGuess = { right: 0, total: 0, lastWord: '', word: '', cat: '', options: [], correct: 0, picked: null, over: false, timer: null, thinkTimer: 0 };
    dgSetupCanvas();
    dgNewRound();
  }

  function dgGuess() {
    if (!drawGuess || drawGuess.over || drawGuess.picked !== null) return;
    const desc = el('#dg-desc');
    const text = desc ? String(desc.value || '').trim() : '';
    const longDesc = text.length >= 6;
    dgRenderOptions();
    const guessBtn = el('#dg-guess');
    if (guessBtn) { guessBtn.hidden = true; guessBtn.disabled = true; }
    const accuracy = longDesc ? 0.82 : 0.6;
    let pick = drawGuess.correct;
    if (Math.random() >= accuracy) {
      const others = [0, 1, 2, 3].filter(function (i) { return i !== drawGuess.correct; });
      pick = others[Math.floor(Math.random() * others.length)];
    }
    drawGuess.picked = pick;
    /* 先想 9~15 秒，结束再选；也有机会想一会儿就提前选 */
    const thinkMs = 9000 + Math.random() * 6000;
    const pickAt = Math.random() < 0.4 ? thinkMs * (0.35 + Math.random() * 0.4) : thinkMs;
    const startedAt = Date.now();
    const tick = function () {
      if (!drawGuess || drawGuess.picked === null) {
        if (drawGuess && drawGuess.thinkTimer) {
          clearInterval(drawGuess.thinkTimer);
          drawGuess.thinkTimer = 0;
        }
        return;
      }
      const left = Math.max(0, Math.ceil((pickAt - (Date.now() - startedAt)) / 1000));
      dgSetHint((longDesc ? 'TA 一边看你的描述一边想…' : 'TA 盯着画想…') + ' 还剩 ' + left + ' 秒');
    };
    tick();
    drawGuess.thinkTimer = setInterval(tick, 200);
    drawGuess.timer = setTimeout(function () {
      if (drawGuess && drawGuess.thinkTimer) {
        clearInterval(drawGuess.thinkTimer);
        drawGuess.thinkTimer = 0;
      }
      const layer = el('#drawguess-dialog');
      if (!drawGuess || !layer || layer.hidden) return;
      dgReveal(pick);
    }, pickAt);
  }

  function dgReveal(pick) {
    const box = el('#dg-options');
    if (!box || !drawGuess) return;
    const correct = pick === drawGuess.correct;
    const letters = ['A', 'B', 'C', 'D'];
    Array.from(box.querySelectorAll('.dg-option')).forEach(function (btn, i) {
      btn.disabled = true;
      if (i === pick) btn.classList.add('is-picked');
      if (i === drawGuess.correct) btn.classList.add('is-right');
      else if (i === pick) btn.classList.add('is-wrong');
    });
    drawGuess.total += 1;
    if (correct) drawGuess.right += 1;
    dgRenderScore();
    const result = el('#dg-result');
    if (result) {
      result.hidden = false;
      result.className = 'dg-result ' + (correct ? 'is-right' : 'is-wrong');
      result.textContent = correct
        ? 'TA 猜对了：' + letters[pick] + ' · ' + drawGuess.word
        : 'TA 选了 ' + letters[pick] + ' · ' + drawGuess.options[pick] + '，正确答案是 ' + letters[drawGuess.correct] + ' · ' + drawGuess.word;
    }
    dgSetHint(correct ? '猜对啦，换一个词再来。' : '没猜中，换个画法再试试。');
    const next = el('#dg-next');
    if (next) next.hidden = false;
    drawGuess.over = true;
  }

  /* ---------------- 事件绑定 ---------------- */
  function hideAllToolPanels() {
    document.querySelectorAll('.tool-overlay').forEach(function (layer) {
      if (layer.hidden) return;
      layer.hidden = true;
      /* 问卷弹窗被关掉时，别把「发到群里」的标记留到下一次 */
      if (layer.id === 'survey-dialog' && App.pendingGroupSurvey) App.pendingGroupSurvey = null;
      /* 关闭听音识曲弹窗的同时自动暂停音乐 */
      if (layer.id === 'songquiz-dialog' && App.stopSongQuiz) App.stopSongQuiz();
    });
  }

  function hideToolPanel(sel) {
    const layer = document.querySelector(sel);
    if (layer) layer.hidden = true;
    if (App.syncAppHeight) App.syncAppHeight();
  }

  function showToolPanel(sel) {
    hideAllToolPanels();
    const layer = document.querySelector(sel);
    if (!layer) return;
    layer.hidden = false;
    const body = layer.querySelector('.tool-sheet-body');
    if (body) body.scrollTop = 0;
    if (App.syncAppHeight) App.syncAppHeight();
  }

  App.hideToolPanels = hideAllToolPanels;
  App.resumePendingSurveys = resumePendingSurveys;

  /* ---------------- 工具：头像与名字 ---------------- */
  let avatarPoolSide = 'mine';
  let avatarToolView = 'avatar';
  let nameSide = 'mine';

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

  function renderAvatarToolView() {
    document.querySelectorAll('#avatar-tool-tabs [data-avatar-view]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.avatarView === avatarToolView);
    });
    document.querySelectorAll('#avatar-dialog [data-avatar-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.avatarPanel !== avatarToolView;
    });
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

  /* ---------------- 工具：名字 ---------------- */
  function namePoolData() {
    const st = App.state;
    if (!st.namePool || typeof st.namePool !== 'object') st.namePool = { mine: [], ta: [] };
    if (!Array.isArray(st.namePool.mine)) st.namePool.mine = [];
    if (!Array.isArray(st.namePool.ta)) st.namePool.ta = [];
    return st.namePool;
  }

  function currentNameOf(side) {
    if (side === 'mine') return App.state.profile.userName || '我';
    const contact = avatarToolContact();
    return contact ? contact.name : '';
  }

  function refreshNameViews() {
    App.save();
    renderNamePool();
    App.renderChat();
    App.renderContacts();
    App.renderSettings();
    if (App.renderDesktop) App.renderDesktop();
  }

  function applyName(value) {
    if (nameSide === 'mine') {
      App.state.profile.userName = value;
    } else {
      const contact = avatarToolContact();
      if (!contact) return;
      contact.name = value;
    }
    refreshNameViews();
  }

  function renderNamePool() {
    document.querySelectorAll('#name-pool-tabs [data-name-side]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.nameSide === nameSide);
    });
    const input = el('#name-input');
    if (input) input.value = currentNameOf(nameSide);
    const box = el('#name-chip-list');
    if (!box) return;
    const list = namePoolData()[nameSide];
    const current = currentNameOf(nameSide);
    if (current && list.indexOf(current) === -1) list.push(current);
    box.innerHTML = list.length
      ? list.map(function (name) {
          return '<span class="name-chip' + (name === current ? ' is-current' : '') + '" data-name-use="' + App.esc(name) + '">' +
            '<span>' + App.esc(name) + '</span>' +
            '<button type="button" class="name-chip-del" data-name-del="' + App.esc(name) + '" aria-label="删除这个名字">×</button>' +
            '</span>';
        }).join('')
      : '<p class="field-hint avatar-pool-empty">还没有保存过名字。</p>';
  }

  function saveNameFromInput() {
    const input = el('#name-input');
    if (!input) return;
    const value = String(input.value || '').trim().slice(0, 16);
    if (!value) {
      App.toast('先写一个名字');
      return;
    }
    const list = namePoolData()[nameSide];
    if (list.indexOf(value) === -1) {
      if (list.length >= 40) {
        App.toast('名字已经够多了，先删掉几个吧');
        return;
      }
      list.push(value);
    }
    applyName(value);
    renderNamePool();
    App.toast('名字已保存');
  }

  function usePoolName(name) {
    if (!name) return;
    applyName(name);
    App.toast('名字已更新');
  }

  function removePoolName(name) {
    const list = namePoolData()[nameSide];
    const index = list.indexOf(name);
    if (index === -1) return;
    if (name === currentNameOf(nameSide)) {
      App.toast('这是当前名字，换一个再删');
      return;
    }
    list.splice(index, 1);
    App.save();
    renderNamePool();
  }

  function nameProb(key, fallback) {
    const value = Number(App.state.settings && App.state.settings[key]);
    return isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
  }

  function nameCooldownMs() {
    const raw = Number(App.state.settings && App.state.settings.nameCooldownMin);
    const minutes = isFinite(raw) ? Math.max(0, Math.min(2880, raw)) : 120;
    return minutes * 60000;
  }

  /* TA 按概率从名字列表里给自己或我改名 */
  function runNameChange(auto) {
    const pool = namePoolData();
    const contact = avatarToolContact();
    const myName = App.state.profile.userName || '我';
    const taName = contact ? contact.name : '';
    const myCandidates = pool.mine.filter(function (name) { return name !== myName; });
    const taCandidates = contact
      ? pool.ta.filter(function (name) { return name !== taName; })
      : [];
    if (!myCandidates.length && !taCandidates.length) return;
    if (auto && Date.now() - (Number(App.state.nameLastChange) || 0) < nameCooldownMs()) return;
    const selfOn = taCandidates.length > 0 && Math.random() * 100 < nameProb('nameSelfProb', 20);
    const meOn = myCandidates.length > 0 && Math.random() * 100 < nameProb('nameMeProb', 10);
    if (!selfOn && !meOn) return;
    let selfName = '';
    let newMyName = '';
    if (selfOn) {
      selfName = taCandidates[Math.floor(Math.random() * taCandidates.length)];
      contact.name = selfName;
    }
    if (meOn) {
      newMyName = myCandidates[Math.floor(Math.random() * myCandidates.length)];
      App.state.profile.userName = newMyName;
    }
    App.state.nameLastChange = Date.now();
    App.save();
    renderNamePool();
    App.renderChat();
    App.renderContacts();
    App.renderSettings();
    if (App.renderDesktop) App.renderDesktop();
    const who = contact ? contact.name : 'TA';
    let text = '';
    if (selfName && newMyName) text = who + ' 把名字改成了「' + selfName + '」，也把你的名字改成了「' + newMyName + '」';
    else if (selfName) text = who + ' 把名字改成了「' + selfName + '」';
    else text = who + ' 把你的名字改成了「' + newMyName + '」';
    pushAvatarNotice(text);
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
    App.renderContacts();
    App.renderSettings();
    if (App.renderDesktop) App.renderDesktop();
    return true;
  }

  function avatarNoticeContactId() {
    const st = App.state;
    if (st.currentContactId && st.contacts.some(function (c) { return c.id === st.currentContactId; })) {
      return st.currentContactId;
    }
    return st.contacts.length ? st.contacts[0].id : null;
  }

  function pushAvatarNotice(text) {
    const contactId = avatarNoticeContactId();
    if (!contactId) return;
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    chat.push({ id: App.uid('m'), role: 'ta', type: 'avatarNotice', text: text, ts: Date.now(), read: true });
    App.save();
    if (App.chatOpen(contactId)) App.renderChat();
  }

  function taDisplayName() {
    const contact = avatarToolContact();
    return contact ? contact.name : 'TA';
  }

  function avatarCooldownMs() {
    const raw = Number(App.state.settings && App.state.settings.avatarCooldownMin);
    const minutes = isFinite(raw) ? Math.max(0, Math.min(1440, raw)) : 30;
    return minutes * 60000;
  }

  function markAvatarSwap() {
    App.state.avatarLastSwap = Date.now();
    App.save();
  }

  function runAvatarSwap(auto) {
    /* 设置里的总开关关掉时，TA 不会换任何一边的头像 */
    if (App.state.settings && App.state.settings.avatarEnabled === false) return;
    const pool = avatarPoolData();
    if (!pool.mine.length && !pool.ta.length) {
      if (!auto) App.toast('先导入几张头像');
      return;
    }
    if (auto && Date.now() - (Number(App.state.avatarLastSwap) || 0) < avatarCooldownMs()) return;
    const name = taDisplayName();
    let selfOn = pool.ta.length > 0 && Math.random() * 100 < avatarProb('avatarSelfProb', 40);
    const meOn = pool.mine.length > 0 && Math.random() * 100 < avatarProb('avatarMeProb', 25);
    let refused = false;
    if (selfOn && Math.random() < 0.3) {
      selfOn = false;
      refused = true;
    }
    if (!selfOn && !meOn) {
      if (refused) pushAvatarNotice(name + ' 想了想，这次没换自己的头像');
      else if (!auto) App.toast('这次 TA 没换头像');
      return;
    }
    /* 以我当前头像在「我的头像」里的位置为基准，TA 大概率换到同一位置 */
    const mySlot = pool.mine.indexOf(App.state.profile.userAvatar);
    let selfSlot = -1;
    if (selfOn) {
      const prefer = mySlot === -1 ? Math.floor(Math.random() * pool.ta.length) : mySlot;
      selfSlot = pickIndexBySameSlot(pool.ta, prefer, 0.75);
      if (changeContactAvatar(selfSlot)) {
        markAvatarSwap();
        pushAvatarNotice(name + ' 换成了他的第 ' + (selfSlot + 1) + ' 张头像');
      } else {
        selfOn = false;
      }
    }
    if (refused) pushAvatarNotice(name + ' 想了想，这次没换自己的头像');
    if (!meOn) {
      renderAvatarPool();
      return;
    }
    /* 不再弹窗征询，直接换上 */
    const base = selfSlot >= 0
      ? selfSlot
      : (mySlot === -1 ? Math.floor(Math.random() * pool.mine.length) : mySlot);
    const slot = pickIndexBySameSlot(pool.mine, base, 0.78);
    if (changeMyAvatar(slot)) {
      markAvatarSwap();
      pushAvatarNotice(name + ' 把你的头像换成了第 ' + (slot + 1) + ' 张');
    }
    renderAvatarPool();
  }

  App.initExtras = function () {
    document.addEventListener('click', function (e) {
      const closer = e.target.closest('[data-tool-close]');
      if (!closer) return;
      const layer = closer.closest('.tool-overlay');
      if (layer) {
        layer.hidden = true;
        /* 问卷弹窗被关掉时，别把「发到群里」的标记留到下一次 */
        if (layer.id === 'survey-dialog' && App.pendingGroupSurvey) App.pendingGroupSurvey = null;
        /* 关闭听音识曲弹窗的同时自动暂停音乐 */
        if (layer.id === 'songquiz-dialog' && App.stopSongQuiz) App.stopSongQuiz();
      }
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
        d.showModal();
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
        if (btn.dataset.tool === 'redpacket') {
          App.pendingGroupRedpacket = null;
          if (App.openRedPacketDialog) App.openRedPacketDialog();
        } else if (btn.dataset.tool === 'survey') {
          renderSurveyForm();
          showToolPanel('#survey-dialog');
        } else if (btn.dataset.tool === 'divine') {
          resetDivine(true);
          showToolPanel('#divine-dialog');
        } else if (btn.dataset.tool === 'avatar') {
          avatarToolView = 'avatar';
          renderAvatarToolView();
          renderAvatarPool();
          renderNamePool();
          showToolPanel('#avatar-dialog');
        } else if (btn.dataset.tool === 'mine') {
          /* 每次打开默认还原成半屏卡片 */
          const mineLayer = el('#mine-dialog');
          if (mineLayer) mineLayer.classList.remove('is-full');
          resetMine();
          showToolPanel('#mine-dialog');
        } else if (btn.dataset.tool === 'jump') {
          showToolPanel('#jump-dialog');
          resetJump();
        } else if (btn.dataset.tool === 'sheep') {
          showToolPanel('#sheep-dialog');
          resetSheep();
        } else if (btn.dataset.tool === 'gomoku') {
          showToolPanel('#gomoku-dialog');
          resetGomoku();
        } else if (btn.dataset.tool === 'drawguess') {
          resetDrawGuess();
          const dgLayer = el('#drawguess-dialog');
          if (dgLayer) dgLayer.classList.remove('is-full');
          const dgFs = el('#dg-fullscreen');
          if (dgFs) {
            dgFs.setAttribute('aria-label', '全屏');
            dgFs.title = '全屏';
          }
          showToolPanel('#drawguess-dialog');
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
    document.querySelectorAll('#survey-kind [data-survey-kind]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        surveyKind = btn.dataset.surveyKind || 'one';
        renderSurveyForm();
      });
    });
    const surveyAddQuestion = el('#survey-add-question');
    if (surveyAddQuestion) surveyAddQuestion.addEventListener('click', addSurveyRow);
    const surveyQuestionList = el('#survey-question-list');
    if (surveyQuestionList) {
      surveyQuestionList.addEventListener('click', function (e) {
        const del = e.target.closest('[data-survey-row-del]');
        if (!del) return;
        const row = del.closest('[data-survey-row]');
        if (row) row.remove();
        renumberSurveyRows();
      });
      surveyQuestionList.addEventListener('change', function (e) {
        const modeSel = e.target.closest('[data-survey-row-mode]');
        if (!modeSel) return;
        const row = modeSel.closest('[data-survey-row]');
        const optionsInput = row ? row.querySelector('[data-survey-row-options]') : null;
        if (optionsInput) optionsInput.hidden = modeSel.value === 'card';
      });
    }
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
      answerBody.addEventListener('keydown', function (e) {
        const field = e.target.closest('.survey-answer-input');
        if (field && e.key === 'Enter') e.preventDefault();
      });
      answerBody.addEventListener('input', function (e) {
        const field = e.target.closest('.survey-answer-input');
        if (!field) return;
        const text = field.textContent || '';
        /* 删空后清掉残留的 <br>，占位文字才能重新出现 */
        if (!text) { field.innerHTML = ''; return; }
        if (text.length <= 80) return;
        field.textContent = text.slice(0, 80);
        const range = document.createRange();
        range.selectNodeContents(field);
        range.collapse(false);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
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
    const avatarToolTabs = el('#avatar-tool-tabs');
    if (avatarToolTabs) {
      avatarToolTabs.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-avatar-view]');
        if (!btn) return;
        avatarToolView = btn.dataset.avatarView;
        renderAvatarToolView();
        renderNamePool();
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

    const nameTabs = el('#name-pool-tabs');
    if (nameTabs) {
      nameTabs.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-name-side]');
        if (!btn) return;
        nameSide = btn.dataset.nameSide;
        renderNamePool();
      });
    }
    const nameSave = el('#name-save');
    if (nameSave) nameSave.addEventListener('click', saveNameFromInput);
    const nameInput = el('#name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveNameFromInput();
      });
    }
    const nameList = el('#name-chip-list');
    if (nameList) {
      nameList.addEventListener('click', function (e) {
        const del = e.target.closest('[data-name-del]');
        if (del) {
          removePoolName(del.dataset.nameDel);
          return;
        }
        const use = e.target.closest('[data-name-use]');
        if (use) usePoolName(use.dataset.nameUse);
      });
    }

    const mineReset = el('#mine-reset');
    if (mineReset) mineReset.addEventListener('click', resetMine);
    document.querySelectorAll('[data-mine-diff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        mineDiff = btn.dataset.mineDiff || 'easy';
        resetMine();
      });
    });
    const jumpTrack = el('#jump-track');
    if (jumpTrack) {
      jumpTrack.addEventListener('click', stopJump);
      jumpTrack.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopJump(); }
      });
    }
    const jumpClose = el('#jump-close');
    if (jumpClose) jumpClose.addEventListener('click', function () { hideToolPanel('#jump-dialog'); });
    const jumpCancel = el('#jump-cancel');
    if (jumpCancel) jumpCancel.addEventListener('click', function () { hideToolPanel('#jump-dialog'); });
    const jumpReset = el('#jump-reset');
    if (jumpReset) jumpReset.addEventListener('click', function () {
      resetJump();
      startJumpGame();
    });
    const jumpStart = el('#jump-start');
    if (jumpStart) jumpStart.addEventListener('click', startJumpGame);
    const sheepBoard = el('#sheep-board');
    if (sheepBoard) {
      sheepBoard.addEventListener('click', function (e) {
        const tile = e.target.closest('[data-sheep]');
        if (!tile) return;
        sheepTake(Number(tile.dataset.sheep), 'me');
      });
    }
    const sheepReset = el('#sheep-reset');
    if (sheepReset) sheepReset.addEventListener('click', resetSheep);
    const gomokuBoard = el('#gomoku-board');
    if (gomokuBoard) {
      gomokuBoard.addEventListener('click', function (e) {
        const cell = e.target.closest('[data-gomoku]');
        if (!cell) return;
        gomokuPlace(Number(cell.dataset.gomoku), 'me');
      });
    }
    const gomokuReset = el('#gomoku-reset');
    if (gomokuReset) gomokuReset.addEventListener('click', resetGomoku);

    /* 你画我猜 */
    const dgGuessBtn = el('#dg-guess');
    if (dgGuessBtn) dgGuessBtn.addEventListener('click', dgGuess);
    const dgNextBtn = el('#dg-next');
    if (dgNextBtn) dgNextBtn.addEventListener('click', dgNewRound);
    const dgResetBtn = el('#dg-reset');
    if (dgResetBtn) dgResetBtn.addEventListener('click', resetDrawGuess);
    const dgClearBtn = el('#dg-clear');
    if (dgClearBtn) {
      dgClearBtn.addEventListener('click', function () {
        if (!dgDraw) return;
        dgClearCanvas();
        dgDraw.undo = [];
      });
    }
    const dgUndoBtn = el('#dg-undo');
    if (dgUndoBtn) {
      dgUndoBtn.addEventListener('click', function () {
        if (!dgDraw || !dgDraw.undo.length) return;
        dgDraw.ctx.putImageData(dgDraw.undo.pop(), 0, 0);
      });
    }
    const dgEraserBtn = el('#dg-eraser');
    if (dgEraserBtn) {
      dgEraserBtn.addEventListener('click', function () {
        if (!dgDraw) return;
        dgDraw.erasing = !dgDraw.erasing;
        dgEraserBtn.classList.toggle('is-active', dgDraw.erasing);
      });
    }
    document.querySelectorAll('[data-dg-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!dgDraw) return;
        dgDraw.color = btn.dataset.dgColor;
        dgDraw.erasing = false;
        if (dgEraserBtn) dgEraserBtn.classList.remove('is-active');
        document.querySelectorAll('[data-dg-color]').forEach(function (other) {
          other.classList.toggle('is-active', other === btn);
        });
      });
    });
    const dgFsBtn = el('#dg-fullscreen');
    if (dgFsBtn) {
      dgFsBtn.addEventListener('click', function () {
        const layer = el('#drawguess-dialog');
        if (!layer) return;
        const on = !layer.classList.contains('is-full');
        layer.classList.toggle('is-full', on);
        dgFsBtn.setAttribute('aria-label', on ? '退出全屏' : '全屏');
        dgFsBtn.title = on ? '退出全屏' : '全屏';
        /* 等布局稳定后再按新的显示尺寸调整画布 */
        setTimeout(dgResizeCanvas, 40);
      });
    }
    if (!document.body.dataset.dgFsResize) {
      document.body.dataset.dgFsResize = '1';
      window.addEventListener('resize', function () {
        const layer = el('#drawguess-dialog');
        if (layer && !layer.hidden && layer.classList.contains('is-full')) dgResizeCanvas();
      });
    }
    const mineBoard = el('#mine-board');
    if (mineBoard) {
      let pressTimer = null;
      let pressed = -1;
      let suppressClick = false;
      let flagAt = 0;
      mineBoard.addEventListener('pointerdown', function (e) {
        const cell = e.target.closest('[data-mine]');
        if (!cell) return;
        suppressClick = false;
        pressed = Number(cell.dataset.mine);
        pressTimer = setTimeout(function () {
          pressTimer = null;
          /* 长按插旗后要吃掉紧随其后的 click，否则会顺便把格子翻开 */
          suppressClick = true;
          flagAt = Date.now();
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
        if (suppressClick) { suppressClick = false; return; }
        openMineCell(Number(cell.dataset.mine), 'me');
      });
      mineBoard.addEventListener('contextmenu', function (e) {
        const cell = e.target.closest('[data-mine]');
        if (!cell) return;
        e.preventDefault();
        /* 手机长按本身会补发 contextmenu，刚插过旗就忽略，避免把旗子又取消掉 */
        if (Date.now() - flagAt < 3000) return;
        toggleMineFlag(Number(cell.dataset.mine));
      });
    }
    const mineFullscreen = el('#mine-fullscreen');
    if (mineFullscreen) {
      mineFullscreen.addEventListener('click', function () {
        const layer = el('#mine-dialog');
        if (!layer) return;
        const on = !layer.classList.contains('is-full');
        layer.classList.toggle('is-full', on);
        mineFullscreen.setAttribute('aria-label', on ? '退出全屏' : '全屏');
        mineFullscreen.title = on ? '退出全屏' : '全屏';
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

    /* TA 也隔一阵子按概率给自己或我改名字 */
    function scheduleAutoNameChange() {
      setTimeout(function () {
        if (!document.hidden) runNameChange(true);
        scheduleAutoNameChange();
      }, 120000 + Math.random() * 180000);
    }
    scheduleAutoNameChange();
  };
})();
