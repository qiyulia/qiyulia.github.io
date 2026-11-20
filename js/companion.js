/* 默契问答 / 心情日记 / 回忆墙 / 位置共享 / 助眠 / 听音识曲 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayKey() { return dateKey(new Date()); }
  function parseDate(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function dateLabel(key) {
    const d = parseDate(key);
    return d ? (d.getMonth() + 1) + '月' + d.getDate() + '日' : key;
  }
  function weekdayLabel(d) { return '周' + '日一二三四五六'[d.getDay()]; }
  function seedHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function contactId() {
    const st = App.state;
    if (st.currentContactId && (st.contacts || []).some(function (c) { return c.id === st.currentContactId; })) {
      return st.currentContactId;
    }
    return st.contacts && st.contacts.length ? st.contacts[0].id : null;
  }

  function pushChat(role, text, extra) {
    const id = contactId();
    if (!id || !text) return;
    const chat = App.state.chats[id] || (App.state.chats[id] = []);
    chat.push(Object.assign({ id: App.uid('m'), role: role, type: 'pat', text: text, ts: Date.now() }, extra || {}));
    if (App.chatOpen && App.chatOpen(id)) {
      if (App.renderChat) App.renderChat();
    } else {
      App.unread[id] = (App.unread[id] || 0) + 1;
    }
    App.save();
    if (App.renderContacts) App.renderContacts();
    if (App.updateBadges) App.updateBadges();
  }

  function showPanel(sel) {
    document.querySelectorAll('.tool-overlay').forEach(function (layer) { layer.hidden = true; });
    const layer = document.querySelector(sel);
    if (!layer) return;
    layer.hidden = false;
    const body = layer.querySelector('.tool-sheet-body');
    if (body) body.scrollTop = 0;
    if (App.syncAppHeight) App.syncAppHeight();
  }

  function closeMore() {
    const more = el('#more-dialog');
    if (more && more.open) more.close();
  }

  function currentView(id) {
    const view = document.getElementById('view-' + id);
    return !!(view && view.classList.contains('is-active'));
  }

  /* =========================================================
     默契问答
     ========================================================= */
  function quizState() {
    const st = App.state;
    if (!st.quiz || typeof st.quiz !== 'object') st.quiz = { rounds: [], lastCardId: '', streak: 0, bestStreak: 0 };
    if (!Array.isArray(st.quiz.rounds)) st.quiz.rounds = [];
    if (typeof st.quiz.streak !== 'number') st.quiz.streak = 0;
    if (typeof st.quiz.bestStreak !== 'number') st.quiz.bestStreak = 0;
    return st.quiz;
  }

  function quizCards() {
    return (App.state.cards || []).filter(function (c) {
      return c.category === '默契问答' && c.enabled !== false && c.text;
    });
  }

  let quizCurrent = null;

  function pickQuizCard() {
    const pool = quizCards();
    if (!pool.length) return null;
    const last = quizState().lastCardId;
    const fresh = pool.filter(function (c) { return c.id !== last; });
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  function quizCatOf(card) {
    return (card && card.quizCat) || '自定义';
  }

  function setQuizCard(card) {
    quizCurrent = card || null;
    const catNode = el('#quiz-cat');
    const qNode = el('#quiz-question');
    const answer = el('#quiz-answer');
    if (catNode) catNode.textContent = card ? quizCatOf(card) : '题库为空';
    if (qNode) qNode.textContent = card ? card.text : '字卡库里还没有默契问答的题目。';
    if (answer) answer.value = card ? (card.quizAnswer || '') : '';
  }

  function quizPoints() {
    return quizState().rounds.reduce(function (sum, r) { return sum + (Number(r.score) || 0); }, 0);
  }

  function refreshQuizPill() {
    const pill = el('#quiz-score-pill');
    if (pill) pill.textContent = '默契度 ' + quizPoints();
    const submit = el('#quiz-submit');
    if (submit) submit.disabled = !quizCurrent;
  }

  function normAnswer(text) {
    return String(text || '').toLowerCase().replace(/[\s，。,.!！?？、；;：:“”"'（）()【】\[\]]/g, '');
  }

  const WRONG_GUESSES = {
    日常习惯: ['先看手机', '先喝一杯水', '再赖五分钟', '我也说不好'],
    恋爱回忆: ['那家小面馆', '记不清了', '第一次见面的路口', '应该是我先开口'],
    未来规划: ['一起去日本', '养一只猫', '有个带院子的家', '开一家小店'],
    兴趣爱好: ['周杰伦', '《海上钢琴师》', '草莓', '猫'],
    口味偏好: ['不要香菜', '三分糖', '都可以', '辣的'],
    小秘密: ['怕黑', '小时候想当老师', '偷偷哭过', '这个真不能说'],
    自定义: ['猜不到', '你直接告诉我吧', '下次一定', '让我再想想'],
  };

  function wrongGuess(answer, cat) {
    const pool = (WRONG_GUESSES[cat] || WRONG_GUESSES['自定义']).filter(function (x) {
      return normAnswer(x) !== normAnswer(answer);
    });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '猜不到';
  }

  function renderQuizResult(round) {
    const box = el('#quiz-result');
    if (!box) return;
    if (!round) { box.hidden = true; return; }
    box.hidden = false;
    box.className = 'quiz-result ' + (round.correct ? 'is-right' : 'is-wrong');
    box.innerHTML =
      '<p class="quiz-result-title">' + (round.correct ? '猜对了！+10 分' : '这次没猜中') + '</p>' +
      '<div class="quiz-compare">' +
        '<div><span>我的答案</span><strong>' + App.esc(round.answer) + '</strong></div>' +
        '<div><span>TA 的猜测</span><strong>' + App.esc(round.guess) + '</strong></div>' +
      '</div>' +
      '<p class="field-hint">默契度 ' + quizPoints() + ' 分 · 当前连对 ' + quizState().streak + ' 次</p>';
  }

  function resolveQuiz() {
    const q = quizState();
    const pending = q.pending;
    if (!pending) return;
    q.pending = null;

    const cat = pending.cat || '自定义';
    let guess = Math.random() < 0.58 ? pending.answer : wrongGuess(pending.answer, cat);
    const a = normAnswer(pending.answer);
    const g = normAnswer(guess);
    const correct = !!a && (a === g || (a.length >= 2 && g.length >= 2 && (a.indexOf(g) !== -1 || g.indexOf(a) !== -1)));
    const score = correct ? 10 : 0;
    const round = {
      id: App.uid('qr'),
      question: pending.question,
      answer: pending.answer,
      guess: guess,
      cat: cat,
      correct: correct,
      score: score,
      ts: Date.now(),
    };
    q.rounds.push(round);
    q.streak = correct ? q.streak + 1 : 0;
    q.bestStreak = Math.max(q.bestStreak, q.streak);
    if (q.rounds.length > 300) q.rounds = q.rounds.slice(-300);
    App.save();

    pushChat('ta', '默契问答：' + pending.question + ' 我猜「' + guess + '」');
    pushChat('ta', correct ? '猜对了！+10 分，我们果然有默契。' : '哎呀，猜错了，差一点点。');

    const pendingBox = el('#quiz-pending');
    if (pendingBox) pendingBox.hidden = true;
    renderQuizResult(round);
    refreshQuizPill();
    renderQuizRank();
    if (!quizCurrent) setQuizCard(pickQuizCard());
  }

  function submitQuiz() {
    if (!quizCurrent) { App.toast('题库里还没有题目'); return; }
    const input = el('#quiz-answer');
    const answer = input ? input.value.trim() : '';
    if (!answer) { App.toast('先写下正确答案'); return; }
    const q = quizState();
    q.lastCardId = quizCurrent.id;
    q.pending = {
      cardId: quizCurrent.id,
      question: quizCurrent.text,
      answer: answer,
      cat: quizCatOf(quizCurrent),
      ts: Date.now(),
    };
    App.save();

    const pending = el('#quiz-pending');
    if (pending) {
      pending.hidden = false;
      pending.innerHTML = '<span class="quiz-wait-dot"></span><div><strong>已经把题目发给 TA 了</strong>' +
        '<p>等 TA 猜完，你们就能一起看对比结果。</p></div>';
    }
    const result = el('#quiz-result');
    if (result) result.hidden = true;
    if (input) input.value = '';
    setTimeout(resolveQuiz, 2600);
  }

  function saveCustomQuiz() {
    const qNode = el('#quiz-custom-q');
    const aNode = el('#quiz-custom-a');
    const catNode = el('#quiz-custom-cat');
    const question = qNode ? qNode.value.trim() : '';
    const answer = aNode ? aNode.value.trim() : '';
    const cat = catNode ? catNode.value : '自定义';
    if (!question || !answer) { App.toast('题目和答案都要写'); return; }

    const card = {
      id: App.uid('card'),
      category: '默契问答',
      quizCat: cat,
      text: question.slice(0, 60),
      quizAnswer: answer.slice(0, 40),
      trigger: '',
      enabled: true,
    };
    App.state.cards.push(card);
    App.save();
    if (App.renderCards) App.renderCards();

    if (qNode) qNode.value = '';
    if (aNode) aNode.value = '';
    switchQuizTab('play');
    setQuizCard(card);
    const input = el('#quiz-answer');
    if (input) input.value = card.quizAnswer;
    refreshQuizPill();
    App.toast('已存进「默契问答」题库');
  }

  function weekStartTs() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    return start.getTime();
  }
  function monthStartTs() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  function quizStat(list) {
    const total = list.length;
    const right = list.filter(function (r) { return r.correct; }).length;
    const points = list.reduce(function (sum, r) { return sum + (Number(r.score) || 0); }, 0);
    return {
      total: total,
      right: right,
      points: points,
      acc: total ? Math.round(right / total * 100) : 0,
    };
  }

  function quizTitle(acc, total) {
    if (!total) return '还没开始，先答一题吧';
    if (acc >= 90) return '心有灵犀';
    if (acc >= 70) return '默契搭档';
    if (acc >= 50) return '正在靠近';
    return '还在互相认识';
  }

  function renderQuizRank() {
    const box = el('#quiz-rank');
    if (!box) return;
    const rounds = quizState().rounds;
    const week = quizStat(rounds.filter(function (r) { return r.ts >= weekStartTs(); }));
    const month = quizStat(rounds.filter(function (r) { return r.ts >= monthStartTs(); }));

    const catMap = {};
    rounds.forEach(function (r) {
      const c = r.cat || '自定义';
      if (!catMap[c]) catMap[c] = { total: 0, right: 0 };
      catMap[c].total += 1;
      if (r.correct) catMap[c].right += 1;
    });
    const cats = Object.keys(catMap).map(function (name) {
      return { name: name, total: catMap[name].total, right: catMap[name].right, acc: Math.round(catMap[name].right / catMap[name].total * 100) };
    }).sort(function (a, b) { return b.acc - a.acc || b.total - a.total; });

    box.innerHTML =
      '<div class="quiz-rank-hero">' +
        '<p class="quiz-rank-title">' + quizTitle(month.acc, month.total) + '</p>' +
        '<p class="field-hint">本月一起答了 ' + month.total + ' 题，默契指数 ' + month.points + ' 分</p>' +
      '</div>' +
      '<div class="quiz-rank-grid">' +
        '<div class="quiz-rank-item"><span>本周</span><strong>' + week.points + '</strong><em>分 · 正确率 ' + week.acc + '%</em></div>' +
        '<div class="quiz-rank-item"><span>本月</span><strong>' + month.points + '</strong><em>分 · 正确率 ' + month.acc + '%</em></div>' +
      '</div>' +
      '<div class="quiz-report">' +
        '<h4>专属默契报告</h4>' +
        (cats.length
          ? cats.map(function (c) {
              return '<div class="quiz-cat-row"><span>' + App.esc(c.name) + '</span><span class="quiz-cat-bar"><i style="width:' + c.acc + '%"></i></span><em>' + c.right + '/' + c.total + '</em></div>';
            }).join('')
          : '<p class="field-hint">答完第一题，这里会出现你们的默契分类。</p>') +
      '</div>' +
      '<p class="field-hint">默契指数每周和每月自动结算，只保存在本机。</p>';
  }

  function switchQuizTab(tab) {
    document.querySelectorAll('#quiz-tabs [data-quiz-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.quizTab === tab);
    });
    document.querySelectorAll('#quiz-dialog [data-quiz-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.quizPanel !== tab;
    });
    if (tab === 'rank') renderQuizRank();
  }

  function openQuiz() {
    const q = quizState();
    closeMore();
    if (q.pending) {
      const pending = el('#quiz-pending');
      if (pending) {
        pending.hidden = false;
        pending.innerHTML = '<span class="quiz-wait-dot"></span><div><strong>TA 正在猜你出的题</strong>' +
          '<p>' + App.esc(q.pending.question) + '</p></div>';
      }
      setTimeout(resolveQuiz, 800);
    } else {
      const pending = el('#quiz-pending');
      if (pending) pending.hidden = true;
    }
    setQuizCard(quizCurrent || pickQuizCard());
    refreshQuizPill();
    renderQuizResult(null);
    renderQuizRank();
    switchQuizTab('play');
    const catSelect = el('#quiz-custom-cat');
    if (catSelect && !catSelect.options.length) {
      catSelect.innerHTML = (App.QUIZ_CATEGORIES || []).concat('自定义').map(function (c) {
        return '<option value="' + c + '">' + c + '</option>';
      }).join('');
    }
    showPanel('#quiz-dialog');
  }

  /* =========================================================
     心情日记
     ========================================================= */
  const MOODS = [
    { id: 'happy', label: '开心', emoji: '☀️', weather: '晴天', color: '#f2c368' },
    { id: 'calm', label: '平静', emoji: '☁️', weather: '多云', color: '#a8cceb' },
    { id: 'sad', label: '难过', emoji: '🌧', weather: '小雨', color: '#8fa9cc' },
    { id: 'angry', label: '生气', emoji: '⚡️', weather: '雷阵雨', color: '#e9a29a' },
    { id: 'tired', label: '疲惫', emoji: '🌫', weather: '有雾', color: '#b9b2cf' },
  ];
  const MOOD_MAP = {};
  MOODS.forEach(function (m) { MOOD_MAP[m.id] = m; });

  let moodDraft = { mood: '', note: '', photo: '' };
  let moodCalMode = 'month';
  let moodCursor = new Date();
  const moodReplyText = {
    happy: ['看到你开心，我也跟着开心。', '今天的好心情，分我一半。', '把这份开心存起来，下次不开心的时候用。'],
    calm: ['平静的一天也很好，我在。', '就这样安安静静地陪着你。', '不慌不忙，日子会慢慢变好。'],
    sad: ['抱抱你，难过的时候不用硬撑。', '我在，想说就说，不想说我就陪着。', '今天先好好休息，明天再想。'],
    angry: ['谁惹你了？我站你这边。', '先深呼吸，别气坏了自己。', '气一会儿就好，别憋着。'],
    tired: ['辛苦了，早点躺下吧。', '今天已经很努力了，剩下的明天再说。', '给你留了盏灯，慢慢回来。'],
  };

  function moodState() {
    const st = App.state;
    if (!st.mood || typeof st.mood !== 'object') st.mood = { entries: {} };
    if (!st.mood.entries || typeof st.mood.entries !== 'object') st.mood.entries = {};
    return st.mood;
  }
  function moodOf(id) { return MOOD_MAP[id] || null; }
  function taMoodOf(key) {
    const h = seedHash(key + '|ta|mood');
    return MOODS[h % MOODS.length];
  }

  /* 每天零点重新抽一次：命中概率 TA 才会记录当天心情 */
  function taMoodProbability() {
    const value = Number(App.state && App.state.settings && App.state.settings.taMoodProb);
    if (!Number.isFinite(value)) return 70;
    return Math.max(0, Math.min(100, value));
  }

  function taMoodDay() {
    const data = moodState();
    const key = todayKey();
    let day = data.taDay;
    if (!day || day.key !== key) {
      const roll = Math.random() * 100;
      day = data.taDay = {
        key: key,
        recorded: roll < taMoodProbability(),
        mood: taMoodOf(key).id,
        roll: Math.round(roll),
      };
      App.save();
    }
    return day;
  }

  function taMoodRecordedOn(key, hasMine) {
    if (key === todayKey()) {
      const day = taMoodDay();
      return day.recorded ? { recorded: true, mood: day.mood } : { recorded: false };
    }
    if (!hasMine) return { recorded: false };
    const recorded = seedHash(key + '|ta|roll') % 100 < taMoodProbability();
    return recorded ? { recorded: true, mood: taMoodOf(key).id } : { recorded: false };
  }

  function refreshTaMood(force) {
    if (!App.state) return;
    const data = moodState();
    if (force) delete data.taDay;
    taMoodDay();
    if (currentView('mood')) renderMoodTa();
  }

  function renderMoodPicker() {
    const box = el('#mood-picker');
    if (!box) return;
    box.innerHTML = MOODS.map(function (m) {
      const on = moodDraft.mood === m.id;
      return '<button type="button" class="mood-choice' + (on ? ' is-on' : '') + '" data-mood="' + m.id + '">' +
        '<span class="mood-emoji" style="--mood-color:' + m.color + '">' + m.emoji + '</span>' +
        '<span>' + m.label + '</span>' +
      '</button>';
    }).join('');
  }

  function renderMoodPhoto() {
    const box = el('#mood-photo-preview');
    if (!box) return;
    if (!moodDraft.photo) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<img src="' + moodDraft.photo + '" alt="心情照片"><button type="button" class="mini-btn" id="mood-photo-del" aria-label="移除照片">×</button>';
  }

  function renderMoodTa() {
    const box = el('#mood-ta-panel');
    if (!box) return;
    const today = todayKey();
    const day = taMoodDay();
    const entry = moodState().entries[today];
    const reply = entry && entry.taReply;
    if (!day.recorded) {
      box.innerHTML =
        '<div class="mood-ta-head">' +
          '<div><h3>TA 今天的心情</h3><p class="field-hint">同频可见 · 只在本机模拟</p></div>' +
          '<span class="mood-ta-chip is-empty">今天不想说</span>' +
        '</div>' +
        '<p class="mood-reply">TA 今天把心情收起来了，说明天再告诉你。明天零点会重新看看 TA 愿不愿意说。</p>';
      return;
    }
    const m = moodOf(day.mood) || taMoodOf(today);
    box.innerHTML =
      '<div class="mood-ta-head">' +
        '<div><h3>TA 今天的心情</h3><p class="field-hint">同频可见 · 只在本机模拟</p></div>' +
        '<span class="mood-ta-chip" style="--mood-color:' + m.color + '">' + m.emoji + ' ' + m.label + '</span>' +
      '</div>' +
      (reply
        ? '<p class="mood-reply">TA 看到你的心情，说：' + App.esc(reply) + '</p>'
        : '<div class="mood-react-row">' +
            '<button type="button" class="btn ghost" data-mood-react="抱抱">给 TA 一个拥抱</button>' +
            '<button type="button" class="btn ghost" data-mood-react="安慰">安慰 TA</button>' +
            '<button type="button" class="btn ghost" data-mood-react="陪">陪 TA 待一会儿</button>' +
          '</div>');
  }

  function moodCounts(year) {
    const counts = {};
    MOODS.forEach(function (m) { counts[m.id] = 0; });
    let total = 0;
    const entries = moodState().entries;
    Object.keys(entries).forEach(function (key) {
      if (!key.indexOf(String(year) + '-')) {
        const id = entries[key].mood;
        if (counts[id] != null) { counts[id] += 1; total += 1; }
      }
    });
    return { counts: counts, total: total };
  }

  function renderMoodCalendar() {
    const box = el('#mood-calendar');
    const legend = el('#mood-legend');
    if (!box) return;
    const entries = moodState().entries;
    const now = new Date();

    if (moodCalMode === 'year') {
      const year = now.getFullYear();
      let html = '<div class="mood-year">';
      for (let month = 0; month < 12; month++) {
        const days = new Date(year, month + 1, 0).getDate();
        const first = (new Date(year, month, 1).getDay() + 6) % 7;
        html += '<div class="mood-year-month"><span>' + (month + 1) + '月</span><div class="mood-year-grid">';
        for (let i = 0; i < first; i++) html += '<i class="is-empty"></i>';
        for (let day = 1; day <= days; day++) {
          const key = year + '-' + pad(month + 1) + '-' + pad(day);
          const entry = entries[key];
          const mood = entry ? moodOf(entry.mood) : null;
          html += '<i' + (mood ? ' style="background:' + mood.color + '" title="' + key + ' · ' + mood.label + '"' : '') + '></i>';
        }
        html += '</div></div>';
      }
      html += '</div>';
      box.innerHTML = html;
    } else {
      const year = moodCursor.getFullYear();
      const month = moodCursor.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const first = (new Date(year, month, 1).getDay() + 6) % 7;
      let html = '<div class="mood-month-head">' +
        '<button type="button" class="mini-btn" data-mood-nav="-1" aria-label="上个月">‹</button>' +
        '<strong>' + year + '年' + (month + 1) + '月</strong>' +
        '<button type="button" class="mini-btn" data-mood-nav="1" aria-label="下个月">›</button>' +
      '</div><div class="mood-month-grid">';
      ['一', '二', '三', '四', '五', '六', '日'].forEach(function (w) { html += '<span class="mood-week">' + w + '</span>'; });
      for (let i = 0; i < first; i++) html += '<i class="is-empty"></i>';
      for (let day = 1; day <= days; day++) {
        const key = year + '-' + pad(month + 1) + '-' + pad(day);
        const entry = entries[key];
        const mood = entry ? moodOf(entry.mood) : null;
        const taDay = taMoodRecordedOn(key, !!entry);
        const taMood = taDay.recorded ? moodOf(taDay.mood) : null;
        const isToday = key === todayKey();
        const icons = (mood ? '<b title="我 · ' + mood.label + '">' + mood.emoji + '</b>' : '') +
          (taMood ? '<b title="TA · ' + taMood.label + '">' + taMood.emoji + '</b>' : '');
        html += '<i class="mood-day' + (isToday ? ' is-today' : '') + '"' +
          (mood ? ' style="background:' + mood.color + '"' : '') +
          ' title="' + key + (mood ? ' · 我 ' + mood.label : '') + (taMood ? ' · TA ' + taMood.label : '') + '">' +
          '<span class="mood-day-num">' + day + '</span>' +
          '<span class="mood-day-icons">' + icons + '</span></i>';
      }
      html += '</div>';
      box.innerHTML = html;
    }

    if (legend) {
      legend.innerHTML = MOODS.map(function (m) {
        return '<span><i style="background:' + m.color + '"></i>' + m.label + '</span>';
      }).join('');
    }
  }

  function renderMoodReport() {
    const box = el('#mood-report');
    if (!box) return;
    const year = new Date().getFullYear();
    const data = moodCounts(year);
    const list = MOODS.map(function (m) { return { mood: m, count: data.counts[m.id] || 0 }; })
      .sort(function (a, b) { return b.count - a.count; });
    const top = list[0];
    const happy = (data.counts.happy || 0) + (data.counts.calm || 0);
    const emo = (data.counts.sad || 0) + (data.counts.angry || 0) + (data.counts.tired || 0);
    let text = '今年还没有记录心情，从今天开始也不晚。';
    if (data.total) {
      if (happy > emo * 2) text = '今年你是个把日子过成晴天的人，开心和平静占了大多数。';
      else if (emo > happy) text = '今年 emo 的日子多了一点，但你都好好走过来了，很了不起。';
      else text = '今年的心情起起伏伏，晴雨都有，这才是真实的日子。';
    }
    box.innerHTML =
      '<div class="mood-report-head"><h3>' + year + ' 年度情绪报告</h3><span>' + data.total + ' 天</span></div>' +
      '<p class="mood-report-main">' + (data.total ? '最常出现的心情是「' + top.mood.label + '」，一共 ' + top.count + ' 天。' : '') + '</p>' +
      '<p class="field-hint">' + text + '</p>' +
      '<div class="mood-report-bars">' +
        MOODS.map(function (m) {
          const count = data.counts[m.id] || 0;
          const pct = data.total ? Math.round(count / data.total * 100) : 0;
          return '<div class="mood-report-row"><span>' + m.emoji + ' ' + m.label + '</span>' +
            '<span class="mood-report-track"><i style="width:' + pct + '%;background:' + m.color + '"></i></span>' +
            '<em>' + count + ' 天</em></div>';
        }).join('') +
      '</div>';
  }

  function renderMood() {
    const today = todayKey();
    const entry = moodState().entries[today];
    moodDraft = {
      mood: entry ? entry.mood : '',
      note: entry ? (entry.note || '') : '',
      photo: entry ? (entry.photo || '') : '',
    };
    const title = el('#mood-title');
    if (title) title.textContent = entry ? '今天已经记下啦' : '今天的心情';
    const date = el('#mood-date');
    if (date) date.textContent = new Date().getFullYear() + '年' + dateLabel(today) + ' · ' + weekdayLabel(new Date());
    const weather = el('#mood-weather');
    const picked = moodOf(moodDraft.mood);
    if (weather) weather.textContent = picked ? picked.weather : '🌤';
    const note = el('#mood-note');
    if (note) note.value = moodDraft.note;
    renderMoodPicker();
    renderMoodPhoto();
    renderMoodTa();
    renderMoodCalendar();
    renderMoodReport();
  }

  function saveMood() {
    if (!moodDraft.mood) { App.toast('先选一个今天的心情'); return; }
    const data = moodState();
    const key = todayKey();
    const old = data.entries[key] || {};
    data.entries[key] = {
      mood: moodDraft.mood,
      note: moodDraft.note.trim(),
      photo: moodDraft.photo,
      ts: Date.now(),
      taReply: old.taReply || '',
    };
    App.save();
    if (!data.entries[key].taReply) {
      setTimeout(function () {
        const current = data.entries[key];
        if (!current || current.taReply) return;
        const list = moodReplyText[current.mood] || moodReplyText.calm;
        current.taReply = list[Math.floor(Math.random() * list.length)];
        App.save();
        if (currentView('mood')) renderMood();
        pushChat('ta', current.taReply);
      }, 1200);
    }
    renderMood();
    App.toast('今天的心情记下了');
  }

  /* =========================================================
     回忆墙
     ========================================================= */
  function memoryState() {
    const st = App.state;
    if (!st.memory || typeof st.memory !== 'object') st.memory = { photos: [], code: '' };
    if (!Array.isArray(st.memory.photos)) st.memory.photos = [];
    if (typeof st.memory.code !== 'string') st.memory.code = '';
    return st.memory;
  }

  function visiblePhotos() {
    return memoryState().photos.filter(function (p) { return !p.secret; })
      .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || b.ts - a.ts; });
  }

  function photoLikes(p) { return (p.likes && p.likes.me ? 1 : 0) + (p.likes && p.likes.ta ? 1 : 0); }

  function renderMemoryWidget() {
    const img = el('#d-photo');
    const empty = el('#d-photo-empty');
    const caption = el('#d-photo-caption');
    if (!img) return;
    const list = visiblePhotos();
    if (!list.length) {
      img.removeAttribute('src');
      img.style.display = 'none';
      if (empty) empty.hidden = false;
      if (caption) {
        caption.textContent = (App.isModuleLoaded && !App.isModuleLoaded('extras'))
          ? '正在读取回忆…'
          : '把喜欢的瞬间放进来';
      }
      return;
    }
    const key = todayKey();
    const pick = list[seedHash(key) % list.length];
    img.src = pick.src;
    img.style.display = '';
    if (empty) empty.hidden = true;
    if (caption) caption.textContent = pick.caption || dateLabel(pick.date) + ' 的回忆';
  }

  function renderMemoryToday() {
    const box = el('#mw-today');
    if (!box) return;
    const now = new Date();
    const list = visiblePhotos();
    let pick = null;
    for (let i = 0; i < list.length; i++) {
      const d = parseDate(list[i].date);
      if (!d) continue;
      if (d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear()) {
        pick = list[i];
        break;
      }
    }
    if (!pick && list.length) {
      const same = list.filter(function (p) {
        const d = parseDate(p.date);
        return d && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      });
      pick = same[0] || null;
    }
    if (!pick) { box.hidden = true; return; }
    const d = parseDate(pick.date);
    box.hidden = false;
    box.innerHTML = '<button type="button" class="mw-today-btn" data-mw-open="' + pick.id + '">' +
      '<img src="' + pick.src + '" alt="那年今日">' +
      '<span class="mw-today-copy"><em>那年今日</em><strong>' + (d ? (now.getFullYear() - d.getFullYear()) + ' 年前的今天' : '同一天') + '</strong>' +
      '<span>' + App.esc(pick.caption || '把这一天留了下来') + '</span></span></button>';
  }

  function annivName(id) {
    const a = (App.state.anniversaries || []).find(function (x) { return x.id === id; });
    return a ? a.name : '';
  }

  function photoCard(p, index) {
    const cap = p.caption ? '<span class="mw-photo-cap">' + App.esc(p.caption) + '</span>' : '';
    const anniv = p.annivId ? '<span class="mw-anniv-tag">' + App.esc(annivName(p.annivId)) + '</span>' : '';
    return '<button type="button" class="mw-photo" data-mw-open="' + p.id + '" style="--tilt:' + ((index % 5) - 2) * 0.7 + 'deg">' +
      '<span class="mw-photo-frame"><img src="' + p.src + '" alt="' + App.esc(p.caption || '回忆照片') + '"></span>' +
      '<span class="mw-photo-foot"><span>' + (p.date ? dateLabel(p.date) : '') + '</span>' +
      '<span class="mw-photo-like">♥ ' + photoLikes(p) + '</span></span>' +
      cap + anniv +
    '</button>';
  }

  function renderMemoryWall() {
    memoryState();
    renderMemoryToday();
    const list = visiblePhotos();
    const hidden = memoryState().photos.filter(function (p) { return p.secret; });
    const timeline = el('#mw-timeline');
    const empty = el('#mw-empty');
    const count = el('#mw-hidden-count');
    if (count) count.textContent = hidden.length ? '(' + hidden.length + ')' : '';
    if (empty) empty.hidden = list.length > 0;
    if (!timeline) return;
    if (!list.length) { timeline.innerHTML = ''; return; }

    const groups = [];
    const byYear = {};
    list.forEach(function (p) {
      const d = parseDate(p.date) || new Date(p.ts || Date.now());
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      if (!byYear[year]) { byYear[year] = {}; groups.push(year); }
      if (!byYear[year][month]) byYear[year][month] = [];
      byYear[year][month].push(p);
    });
    groups.sort(function (a, b) { return b - a; });

    let index = 0;
    timeline.innerHTML = groups.map(function (year) {
      const months = Object.keys(byYear[year]).map(Number).sort(function (a, b) { return b - a; });
      return '<div class="mw-year-block"><h3 class="mw-year">' + year + ' 年</h3>' +
        months.map(function (month) {
          return '<div class="mw-month-block"><h4>' + month + ' 月</h4><div class="mw-grid">' +
            byYear[year][month].map(function (p) { return photoCard(p, index++); }).join('') +
          '</div></div>';
        }).join('') +
      '</div>';
    }).join('');
  }

  let mwDrafts = [];

  function mwResetForm() {
    mwDrafts = [];
    const preview = el('#mw-preview');
    if (preview) preview.innerHTML = '<p class="field-hint">还没有选择照片</p>';
    const caption = el('#mw-caption');
    if (caption) caption.value = '';
    const date = el('#mw-date');
    if (date) date.value = todayKey();
    const secret = el('#mw-secret');
    if (secret) secret.checked = false;
    const anniv = el('#mw-anniv');
    if (anniv) {
      anniv.innerHTML = '<option value="">不绑定</option>' + (App.state.anniversaries || []).map(function (a) {
        return '<option value="' + a.id + '">' + App.esc(a.name) + '</option>';
      }).join('');
    }
  }

  function mwRenderPreview() {
    const box = el('#mw-preview');
    if (!box) return;
    box.innerHTML = mwDrafts.length
      ? mwDrafts.slice(0, 6).map(function (src) { return '<img src="' + src + '" alt="预览">'; }).join('')
      : '<p class="field-hint">还没有选择照片</p>';
  }

  function openMemoryDialog() {
    mwResetForm();
    const d = el('#mw-dialog');
    if (d) d.showModal();
  }

  function importMemoryFiles(files) {
    const picked = Array.prototype.slice.call(files || []);
    if (!picked.length) return;
    openMemoryDialog();
    let chain = Promise.resolve();
    let count = 0;
    picked.slice(0, 9).forEach(function (file) {
      chain = chain.then(function () {
        return App.compressImage(file, 1080, { maxLength: 220000 }).then(function (src) {
          mwDrafts.push(src);
          count += 1;
          mwRenderPreview();
        }).catch(function () {});
      });
    });
    chain.then(function () {
      if (!count) App.toast('这些照片没有读进来');
      else App.toast('已选 ' + count + ' 张，写下日期再放进去');
    });
  }

  function saveMemory() {
    if (!mwDrafts.length) { App.toast('先选照片'); return; }
    const caption = (el('#mw-caption') || {}).value || '';
    const date = (el('#mw-date') || {}).value || todayKey();
    const annivId = (el('#mw-anniv') || {}).value || '';
    const secret = !!(el('#mw-secret') || {}).checked;
    const memory = memoryState();
    mwDrafts.forEach(function (src) {
      memory.photos.push({
        id: App.uid('mw'),
        src: src,
        caption: caption.trim().slice(0, 60),
        date: date,
        annivId: annivId,
        secret: secret,
        likes: { me: false, ta: false },
        comments: [],
        ts: Date.now(),
      });
    });
    const added = mwDrafts.slice();
    App.save();
    const dialog = el('#mw-dialog');
    if (dialog && dialog.open) dialog.close();
    renderMemoryWall();
    renderMemoryWidget();
    if (App.renderDesktop) App.renderDesktop();
    App.toast(secret ? '已放进隐藏相册' : '回忆已经放上墙了');
    if (!secret) {
      setTimeout(function () {
        const memory2 = memoryState();
        const photo = memory2.photos.find(function (p) { return p.src === added[0]; });
        if (!photo) return;
        photo.likes.ta = true;
        App.save();
        if (currentView('memorywall')) renderMemoryWall();
      }, 1500);
    }
  }

  let mwOpenId = null;

  function openMemoryPhoto(id) {
    const photo = memoryState().photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    mwOpenId = id;
    const d = el('#mw-view');
    if (!d) return;
    const title = el('#mw-view-title');
    if (title) title.textContent = photo.date ? dateLabel(photo.date) : '回忆';
    const body = el('#mw-view-body');
    if (body) {
      body.innerHTML =
        '<div class="mw-view-photo"><img src="' + photo.src + '" alt="' + App.esc(photo.caption || '回忆照片') + '"></div>' +
        (photo.caption ? '<p class="mw-view-caption">' + App.esc(photo.caption) + '</p>' : '') +
        '<div class="mw-view-meta">' +
          '<span>' + (photo.date || '') + '</span>' +
          (photo.annivId ? '<span class="mw-anniv-tag">' + App.esc(annivName(photo.annivId)) + '</span>' : '') +
          '<button type="button" class="mw-like-btn' + (photo.likes.me ? ' is-on' : '') + '" data-mw-like="' + photo.id + '">♥ ' + photoLikes(photo) + '</button>' +
        '</div>' +
        '<div class="mw-comments">' +
          (photo.comments.length
            ? photo.comments.map(function (c) {
                return '<div class="mw-comment' + (c.who === 'ta' ? ' is-ta' : '') + '"><strong>' + (c.who === 'ta' ? 'TA' : '我') + '</strong><span>' + App.esc(c.text) + '</span></div>';
              }).join('')
            : '<p class="field-hint">还没有评论，说点什么吧。</p>') +
        '</div>';
    }
    d.showModal();
  }

  function sendMemoryComment() {
    const input = el('#mw-comment-input');
    const text = input ? input.value.trim() : '';
    if (!text || !mwOpenId) return;
    const photo = memoryState().photos.find(function (p) { return p.id === mwOpenId; });
    if (!photo) return;
    photo.comments.push({ who: 'me', text: text.slice(0, 60), ts: Date.now() });
    if (input) input.value = '';
    App.save();
    openMemoryPhoto(mwOpenId);
    renderMemoryWall();
    setTimeout(function () {
      const lines = ['这张我也记得。', '看到照片就想起那天了。', '以后再多拍一点。', '这一张我一直很喜欢。'];
      photo.comments.push({ who: 'ta', text: lines[Math.floor(Math.random() * lines.length)], ts: Date.now() });
      App.save();
      if (mwOpenId === photo.id) openMemoryPhoto(photo.id);
      renderMemoryWall();
    }, 1100);
  }

  function toggleMemoryLike(id) {
    const photo = memoryState().photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    photo.likes.me = !photo.likes.me;
    App.save();
    openMemoryPhoto(id);
    renderMemoryWall();
  }

  let mwUnlocked = false;

  function renderHiddenAlbum() {
    const box = el('#mw-hidden-body');
    if (!box) return;
    const memory = memoryState();
    const hidden = memory.photos.filter(function (p) { return p.secret; });

    if (!memory.code) {
      box.innerHTML =
        '<p class="field-hint">给隐藏相册设一个 4 位数字密码。进入时需要密码，并且双方都确认。</p>' +
        '<label class="field"><span>设置密码</span><input id="mw-code-set" inputmode="numeric" maxlength="4" placeholder="4 位数字"></label>' +
        '<button type="button" class="btn primary" id="mw-code-save">设好密码</button>';
      return;
    }

    if (!mwUnlocked) {
      box.innerHTML =
        '<p class="field-hint">这里是只有你们两个人能看的地方。输入密码，并确认 TA 也在场。</p>' +
        '<label class="field"><span>4 位密码</span><input id="mw-code-input" inputmode="numeric" maxlength="4" placeholder="••••"></label>' +
        '<label class="mw-check"><input type="checkbox" id="mw-code-both"> TA 也确认了</label>' +
        '<button type="button" class="btn primary" id="mw-code-enter">进入隐藏相册</button>' +
        '<p class="field-hint">隐藏照片 ' + hidden.length + ' 张</p>';
      return;
    }

    box.innerHTML =
      '<div class="mw-hidden-head"><span>已解锁 · ' + hidden.length + ' 张</span><button type="button" class="mini-btn" id="mw-code-lock">锁定</button></div>' +
      '<div class="mw-grid mw-hidden-grid">' +
        (hidden.length
          ? hidden.map(function (p, i) { return photoCard(p, i); }).join('')
          : '<p class="field-hint">隐藏相册还是空的，放照片时勾选「放进隐藏相册」。</p>') +
      '</div>' +
      (hidden.length ? '<button type="button" class="btn ghost" id="mw-code-clear">清空隐藏相册</button>' : '');
  }

  function openHiddenAlbum() {
    mwUnlocked = false;
    renderHiddenAlbum();
    const d = el('#mw-hidden-dialog');
    if (d) d.showModal();
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function drawCover(ctx, img, x, y, w, h) {
    const ratio = Math.max(w / img.width, h / img.height);
    const sw = w / ratio;
    const sh = h / ratio;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function makeMemoryPoster() {
    const list = visiblePhotos().slice(0, 4);
    if (!list.length) { App.toast('先放几张照片吧'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#eef7ff');
    grad.addColorStop(1, '#d8eafa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#5b8fc9';
    ctx.font = '600 52px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我们的小回忆', canvas.width / 2, 96);
    const dates = list.map(function (p) { return p.date; }).filter(Boolean).sort();
    ctx.fillStyle = '#70869e';
    ctx.font = '26px "PingFang SC", sans-serif';
    ctx.fillText(dates.length
      ? (dates[0] === dates[dates.length - 1] ? dates[0] : dates[0] + ' — ' + dates[dates.length - 1])
      : '拾忆 · 回忆墙', canvas.width / 2, 142);

    let frames;
    if (list.length === 1) {
      frames = [{ x: 100, y: 200, w: 880, h: 840 }];
    } else if (list.length === 2) {
      frames = [
        { x: 70, y: 220, w: 440, h: 560 },
        { x: 570, y: 220, w: 440, h: 560 },
      ];
    } else {
      frames = [
        { x: 70, y: 200, w: 440, h: 400 },
        { x: 570, y: 200, w: 440, h: 400 },
        { x: 70, y: 660, w: 440, h: 400 },
        { x: 570, y: 660, w: 440, h: 400 },
      ];
    }
    Promise.all(list.map(function (p) { return loadImage(p.src).catch(function () { return null; }); }))
      .then(function (imgs) {
        frames.slice(0, list.length).forEach(function (f, i) {
          ctx.save();
          ctx.shadowColor = 'rgba(45,83,123,.18)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 12;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(f.x, f.y, f.w, f.h);
          ctx.restore();
          if (imgs[i]) drawCover(ctx, imgs[i], f.x + 18, f.y + 18, f.w - 36, f.h - 78);
          ctx.fillStyle = '#70869e';
          ctx.font = '24px "PingFang SC", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(list[i].date ? dateLabel(list[i].date) : '', f.x + 22, f.y + f.h - 34);
          if (list[i].caption) {
            ctx.fillStyle = '#43576d';
            ctx.font = '22px "PingFang SC", sans-serif';
            ctx.textAlign = 'right';
            const cap = list[i].caption.length > 12 ? list[i].caption.slice(0, 12) + '…' : list[i].caption;
            ctx.fillText(cap, f.x + f.w - 22, f.y + f.h - 34);
          }
        });
        ctx.fillStyle = '#5b8fc9';
        ctx.font = '24px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('拾忆 · 把普通的一天，留成以后记得的片段', canvas.width / 2, 1235);

        const url = canvas.toDataURL('image/jpeg', 0.88);
        const img = el('#mw-poster-img');
        const save = el('#mw-poster-save');
        if (img) img.src = url;
        if (save) save.href = url;
        const d = el('#mw-poster-dialog');
        if (d) d.showModal();
      });
  }

  /* =========================================================
     位置共享
     ========================================================= */
  const LOC_STATUS = ['在家-休息中', '在公司-忙碌中', '在路上', '在外面', '想你了'];

  /* 快捷消息：四个按钮的文字和发送内容都能自己改，键名是「谁-区域」 */
  const LOC_QUICK_DEFAULTS = {
    'me-home': { label: '我到家了', text: '我到家了，别担心。' },
    'me-work': { label: '我到公司了', text: '我到公司了，今天会有点忙。' },
    'ta-home': { label: 'TA 到家了', text: '我到家了，今天也平安。' },
    'ta-work': { label: 'TA 到公司了', text: '我到公司了，开始忙啦。' },
  };
  const LOC_QUICK_KEYS = ['me-home', 'me-work', 'ta-home', 'ta-work'];
  /* 地图上最多画 8 个地点，再多只留在下面的地点列表里 */
  const PLACE_MAP_LIMIT = 8;

  function quickConfig() {
    const loc = locationState();
    if (!loc.quick || typeof loc.quick !== 'object') loc.quick = {};
    LOC_QUICK_KEYS.forEach(function (key) {
      const def = LOC_QUICK_DEFAULTS[key];
      const cur = loc.quick[key];
      if (!cur || typeof cur !== 'object') { loc.quick[key] = { label: def.label, text: def.text }; return; }
      if (!cur.label) cur.label = def.label;
      if (!cur.text) cur.text = def.text;
    });
    return loc.quick;
  }

  function quickLine(key) {
    const cfg = quickConfig()[key];
    return cfg || LOC_QUICK_DEFAULTS[key];
  }

  function locationState() {
    const st = App.state;
    if (!st.location || typeof st.location !== 'object') {
      st.location = {
        enabled: false,
        paused: false,
        shareChip: false,
        me: { lat: 31.2304, lng: 121.4737 },
        ta: { lat: 31.2361, lng: 121.4872 },
        placeId: { me: '', ta: '' },
        status: { me: '在家-休息中', ta: '在公司-忙碌中' },
        zones: [
          { id: 'home', name: '家', lat: 31.2304, lng: 121.4737, r: 320 },
          { id: 'work', name: '公司', lat: 31.2361, lng: 121.4872, r: 320 },
        ],
        inside: { me: 'home', ta: 'work' },
      };
    }
    const loc = st.location;
    if (!loc.me) loc.me = { lat: 31.2304, lng: 121.4737 };
    if (!loc.ta) loc.ta = { lat: 31.2361, lng: 121.4872 };
    if (typeof loc.shareChip !== 'boolean') loc.shareChip = false;
    if (!loc.placeId || typeof loc.placeId !== 'object') loc.placeId = { me: '', ta: '' };
    if (!loc.status) loc.status = { me: '在家-休息中', ta: '在公司-忙碌中' };
    if (!Array.isArray(loc.zones) || !loc.zones.length) {
      loc.zones = [
        { id: 'home', name: '家', lat: loc.me.lat, lng: loc.me.lng, r: 320 },
        { id: 'work', name: '公司', lat: loc.ta.lat, lng: loc.ta.lng, r: 320 },
      ];
    }
    if (!loc.inside) loc.inside = { me: 'home', ta: 'work' };
    return loc;
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function distanceText(m) {
    if (m < 120) return '就在你附近';
    if (m < 1000) return '相距 ' + Math.round(m / 10) * 10 + ' 米';
    return '相距 ' + (m / 1000).toFixed(1) + ' 公里';
  }

  function zoneOf(loc, pos) {
    return loc.zones.find(function (z) { return distanceMeters(pos, z) <= z.r; }) || null;
  }

  /* ---------- 地点字卡 ---------- */
  function placeCards() {
    return (App.state.cards || []).filter(function (c) {
      return c && c.category === '地点' && c.text && c.enabled !== false;
    });
  }

  function placeCardById(id) {
    if (!id) return null;
    return placeCards().find(function (c) { return c.id === id; }) || null;
  }

  /* 名称一律按「人现在的位置」反推，地图上的点在哪，卡片就显示哪 */
  function placeAtPosition(loc, pos) {
    if (!pos) return null;
    let best = null;
    let bestDist = Infinity;
    placeCards().forEach(function (card, index) {
      const coords = ensurePlaceCoords(card, loc, index);
      const dist = distanceMeters(pos, coords);
      if (dist < bestDist) { bestDist = dist; best = card; }
    });
    return best && bestDist <= 120 ? best : null;
  }

  function placeNameOf(loc, who) {
    const card = placeAtPosition(loc, loc[who]);
    return card ? card.text : '';
  }

  function locationNameOf(loc, who) {
    const zone = zoneOf(loc, loc[who]);
    return placeNameOf(loc, who) || (zone ? zone.name : '外面');
  }

  /* 状态气泡里的「在哪儿」也跟随地图位置，避免标着学校、人却在别处 */
  function syncStatusPlace(loc, who) {
    const text = String(loc.status[who] || '');
    const match = text.match(/^在([^-]*)-(.+)$/);
    if (!match) return false;
    const next = '在' + locationNameOf(loc, who) + '-' + match[2];
    if (next === text) return false;
    loc.status[who] = next;
    return true;
  }

  function placeMapCards() {
    return placeCards().slice(0, PLACE_MAP_LIMIT);
  }

  /* 自动点位固定在圆周的 8 个位置，按顺序一人一格，互相错开不再挤在一起 */
  function placeRingCoords(loc, index) {
    const slot = ((index % PLACE_MAP_LIMIT) + PLACE_MAP_LIMIT) % PLACE_MAP_LIMIT;
    const angle = (slot / PLACE_MAP_LIMIT) * Math.PI * 2 - Math.PI / 2;
    const wobble = slot % 2 ? 0.72 : 1;
    const center = {
      lat: (loc.me.lat + loc.ta.lat) / 2,
      lng: (loc.me.lng + loc.ta.lng) / 2,
    };
    return {
      lat: center.lat - Math.sin(angle) * 0.0062 * wobble,
      lng: center.lng + Math.cos(angle) * 0.0086 * wobble,
    };
  }

  function ensurePlaceCoords(card, loc, index) {
    if (card.place && Number.isFinite(card.place.lat) && Number.isFinite(card.place.lng)) return card.place;
    card.place = placeRingCoords(loc, index);
    return card.place;
  }

  /* 旧版本的自动点位都挤在一条线上，升级后重排一次；之后用户自己选的点不再动 */
  function spreadPlaceCoords(loc) {
    if (loc.placeSpread) return;
    loc.placeSpread = true;
    placeCards().forEach(function (card, index) {
      card.place = placeRingCoords(loc, index);
    });
    App.save();
  }

  function setPlaceFor(who, id) {
    const loc = locationState();
    if (!id) {
      loc.placeId[who] = '';
      App.save();
      renderLocation();
      return;
    }
    const card = placeCardById(id);
    if (!card) return;
    const coords = ensurePlaceCoords(card, loc, placeCards().indexOf(card));
    loc.placeId[who] = id;
    loc[who] = { lat: coords.lat, lng: coords.lng };
    locView = null;
    const state = (loc.status[who] || '').split('-')[1] || (who === 'me' ? '休息中' : '忙碌中');
    loc.status[who] = '在' + card.text + '-' + state;
    applyZone(loc, who, zoneOf(loc, loc[who]));
    App.save();
    renderLocation();
    App.toast((who === 'me' ? '我的' : 'TA 的') + '位置已设为「' + card.text + '」');
  }

  function addPlaceCard() {
    const input = el('#loc-new-place');
    const name = input ? input.value.trim() : '';
    if (!name) { if (input) input.focus(); return; }
    const exists = placeCards().find(function (c) { return c.text === name; });
    if (exists) {
      locPlaceTarget = exists.id;
      if (input) input.value = '';
      renderLocation();
      App.toast(locationState().enabled
        ? '点地图给「' + exists.text + '」选个位置'
        : '已选中「' + exists.text + '」，开启共享后可在图上选点');
      return;
    }
    const loc = locationState();
    const card = {
      id: App.uid('card'),
      category: '地点',
      text: name,
      trigger: '',
      enabled: true,
      place: null,
    };
    App.state.cards.push(card);
    ensurePlaceCoords(card, loc, placeCards().length - 1);
    if (input) input.value = '';
    /* 新地点先选中，直接点地图就能定它的点 */
    locPlaceTarget = card.id;
    App.save();
    renderLocation();
    App.toast(loc.enabled
      ? '点地图给「' + card.text + '」选个位置'
      : '已添加「' + card.text + '」，开启共享后可在图上选点');
  }

  function renderLocationPlaces(loc) {
    const triggers = { me: el('#loc-me-place'), ta: el('#loc-ta-place') };
    Object.keys(triggers).forEach(function (who) {
      const btn = triggers[who];
      if (!btn) return;
      const card = placeCardById(loc.placeId[who]);
      const value = btn.querySelector('.loc-place-value');
      if (value) value.textContent = card ? card.text : '未设置';
      btn.classList.toggle('is-set', !!card);
    });
    document.querySelectorAll('[data-loc-pick]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.locPick === locPickWho && !locPlaceTarget);
    });
    const tip = el('#loc-map-tip');
    const target = placeCardById(locPlaceTarget);
    if (tip) {
      if (target) {
        tip.textContent = loc.enabled
          ? '点地图给「' + target.text + '」选个位置'
          : '开启共享后点地图给「' + target.text + '」选位置';
      } else {
        tip.textContent = locPickWho === 'ta' ? '点地图设置 TA 的位置' : '点地图设置我的位置';
      }
    }
    renderPlaceList();
  }

  /* 地点列表：每个地点都能点「选点」，再去地图上点一下定它的位置 */
  function renderPlaceList() {
    const box = el('#loc-place-list');
    if (!box) return;
    const cards = placeCards();
    if (!cards.length) {
      box.innerHTML = '<p class="field-hint">还没有地点，先在上面添加一个。</p>';
      return;
    }
    box.innerHTML = cards.map(function (card, index) {
      const onMap = index < PLACE_MAP_LIMIT;
      const active = locPlaceTarget === card.id;
      return '<div class="loc-place-row' + (active ? ' is-active' : '') + '">' +
        '<span class="loc-place-row-dot' + (onMap ? '' : ' is-off') + '" aria-hidden="true"></span>' +
        '<span class="loc-place-row-name">' + App.esc(card.text) + '</span>' +
        (onMap ? '' : '<span class="loc-place-row-note">不显示在地图</span>') +
        '<button type="button" class="loc-place-row-btn' + (active ? ' is-active' : '') + '" data-loc-place-target="' + App.esc(card.id) + '">' +
          (active ? '点地图选点' : '选点') +
        '</button>' +
      '</div>';
    }).join('');
  }

  let locPlaceWho = 'me';

  function openPlacePicker(who) {
    locPlaceWho = who === 'ta' ? 'ta' : 'me';
    const loc = locationState();
    const title = el('#loc-place-title');
    if (title) title.textContent = locPlaceWho === 'me' ? '我的地点' : 'TA 的地点';
    const box = el('#loc-place-options');
    if (box) {
      const current = loc.placeId[locPlaceWho] || '';
      const rows = [{ id: '', text: '未设置' }].concat(placeCards().map(function (c) {
        return { id: c.id, text: c.text };
      }));
      box.innerHTML = rows.map(function (row) {
        return '<button type="button" class="loc-place-option' + (row.id === current ? ' is-current' : '') + '" data-loc-place-option="' + App.esc(row.id) + '">' +
          '<span>' + App.esc(row.text) + '</span>' +
          '<span class="loc-place-check" aria-hidden="true">' + (row.id === current ? '✓' : '') + '</span>' +
        '</button>';
      }).join('');
    }
    showPanel('#loc-place-dialog');
  }

  let locStatusWho = 'me';

  function openStatusPicker(side) {
    locStatusWho = side === 'ta' ? 'ta' : 'me';
    const loc = locationState();
    const title = el('#loc-status-title');
    if (title) title.textContent = locStatusWho === 'me' ? '我的状态' : 'TA 的状态';
    const box = el('#loc-status-options');
    if (box) {
      const opts = LOC_STATUS.slice();
      if (loc.status[locStatusWho] && opts.indexOf(loc.status[locStatusWho]) === -1) opts.unshift(loc.status[locStatusWho]);
      box.innerHTML = opts.map(function (s) {
        const current = loc.status[locStatusWho] === s;
        return '<button type="button" class="loc-place-option' + (current ? ' is-current' : '') + '" data-loc-status-pick="' + App.esc(s) + '">' +
          '<span>' + App.esc(s) + '</span>' +
          '<span class="loc-place-check" aria-hidden="true">' + (current ? '✓' : '') + '</span>' +
        '</button>';
      }).join('');
    }
    showPanel('#loc-status-dialog');
  }

  /* ---------- 共享定位小窗：可以在聊天界面里自由拖动 ---------- */
  const LOC_CHIP_POS_KEY = 'shiyi-loc-chip-pos';

  function locChipParent(chip) {
    return chip.offsetParent || chip.parentElement;
  }

  function applyLocChipPos(chip) {
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(LOC_CHIP_POS_KEY) || 'null'); } catch (err) { pos = null; }
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
    const parent = locChipParent(chip);
    if (!parent) return;
    const x = Math.min(Math.max(pos.x, 6), Math.max(6, parent.clientWidth - chip.offsetWidth - 6));
    const y = Math.min(Math.max(pos.y, 6), Math.max(6, parent.clientHeight - chip.offsetHeight - 6));
    chip.style.right = 'auto';
    chip.style.bottom = 'auto';
    chip.style.left = x + 'px';
    chip.style.top = y + 'px';
  }

  function initLocChipDrag() {
    const chip = el('#chat-loc-chip');
    if (!chip || chip.dataset.dragReady) return;
    chip.dataset.dragReady = '1';
    let dragging = false;
    let moved = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    chip.addEventListener('pointerdown', function (e) {
      if (chip.hidden || e.button === 2) return;
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      const parent = locChipParent(chip);
      if (parent) {
        const pr = parent.getBoundingClientRect();
        const cr = chip.getBoundingClientRect();
        origX = cr.left - pr.left;
        origY = cr.top - pr.top;
      }
      try { chip.setPointerCapture(e.pointerId); } catch (err) { /* 忽略不支持的情况 */ }
    });

    chip.addEventListener('pointermove', function (e) {
      if (!dragging || pointerId == null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (!moved) {
        moved = true;
        chip.classList.add('is-dragging');
        chip.style.right = 'auto';
        chip.style.bottom = 'auto';
      }
      if (e.cancelable) e.preventDefault();
      const parent = locChipParent(chip);
      if (!parent) return;
      const x = Math.min(Math.max(origX + dx, 6), Math.max(6, parent.clientWidth - chip.offsetWidth - 6));
      const y = Math.min(Math.max(origY + dy, 6), Math.max(6, parent.clientHeight - chip.offsetHeight - 6));
      chip.style.left = x + 'px';
      chip.style.top = y + 'px';
      chip._dragPos = { x: x, y: y };
    });

    function endDrag(e) {
      if (!dragging) return;
      if (e && pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      if (moved) {
        chip.classList.remove('is-dragging');
        if (chip._dragPos) {
          try { localStorage.setItem(LOC_CHIP_POS_KEY, JSON.stringify(chip._dragPos)); } catch (err) { /* 存不进去就算了 */ }
        }
        /* 刚拖完的这次点击不触发跳转 */
        chip.dataset.justDragged = '1';
        setTimeout(function () { delete chip.dataset.justDragged; }, 350);
      }
    }
    chip.addEventListener('pointerup', endDrag);
    chip.addEventListener('pointercancel', endDrag);
    /* 捕获阶段拦下拖动后的那次 click，避免误跳到位置页 */
    chip.addEventListener('click', function (e) {
      if (chip.dataset.justDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function renderChatLocation() {
    const chip = el('#chat-loc-chip');
    if (!chip) return;
    const loc = App.state && App.state.location;
    const prompt = el('#chat-loc-prompt');
    if (prompt && loc && loc.enabled) prompt.hidden = true;
    const show = !!(loc && loc.enabled && !loc.paused && loc.shareChip);
    chip.hidden = !show;
    if (!show) return;
    applyLocChipPos(chip);
    const dist = el('#chat-loc-distance');
    const detail = el('#chat-loc-detail');
    if (dist) dist.textContent = distanceText(distanceMeters(loc.me, loc.ta));
    if (detail) {
      detail.textContent = '我 · ' + locationNameOf(loc, 'me') + ' ／ TA · ' + locationNameOf(loc, 'ta');
    }
  }
  App.renderChatLocation = renderChatLocation;

  /* 打开聊天时按概率邀请开启定位 */
  function maybePromptLocation() {
    const loc = locationState();
    if (loc.enabled) return;
    if (!App.chatOpen || !App.chatContactId || !App.chatOpen(App.chatContactId)) return;
    const raw = Number(App.state && App.state.settings && App.state.settings.locPromptProb);
    const chance = Number.isFinite(raw) ? raw : 20;
    if (chance <= 0 || Math.random() * 100 >= chance) return;
    const box = el('#chat-loc-prompt');
    if (!box) return;
    box.hidden = false;
  }
  App.maybePromptLocation = maybePromptLocation;

  function sendLocationFromTa() {
    const loc = locationState();
    if (!loc.enabled || loc.paused) {
      App.toast('先在「位置」里开启共享');
      if (App.go) App.go('location');
      return;
    }
    const cards = placeCards();
    if (!cards.length) { App.toast('先去「位置」里添加一个地点'); return; }
    const current = placeCardById(loc.placeId.ta);
    let card = current;
    if (!card || (cards.length > 1 && Math.random() < 0.6)) {
      const options = cards.filter(function (c) { return c.id !== (current && current.id); });
      card = options[Math.floor(Math.random() * options.length)] || cards[0];
    }
    const coords = ensurePlaceCoords(card, loc, cards.indexOf(card));
    loc.ta = { lat: coords.lat, lng: coords.lng };
    loc.placeId.ta = card.id;
    const state = (loc.status.ta || '').split('-')[1] || '忙碌中';
    loc.status.ta = '在' + card.text + '-' + state;
    App.save();
    pushChat('ta', distanceText(distanceMeters(loc.me, loc.ta)) + '，我在这里。', {
      type: 'location',
      placeName: card.text,
    });
    if (currentView('location')) renderLocation();
    if (App.renderChatLocation) App.renderChatLocation();
  }

  let locView = null;
  let locPickWho = 'me';
  let locPlaceTarget = '';

  function mapProject(loc) {
    const pts = [loc.me, loc.ta]
      .concat(loc.zones.map(function (z) { return { lat: z.lat, lng: z.lng }; }))
      .concat(placeMapCards().map(function (card, index) {
        return ensurePlaceCoords(card, loc, index);
      }));
    let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;
    pts.forEach(function (p) {
      latMin = Math.min(latMin, p.lat);
      latMax = Math.max(latMax, p.lat);
      lngMin = Math.min(lngMin, p.lng);
      lngMax = Math.max(lngMax, p.lng);
    });
    const latPad = Math.max(0.0035, (latMax - latMin) * 0.35);
    const lngPad = Math.max(0.0035, (lngMax - lngMin) * 0.35);
    locView = {
      latMin: latMin - latPad,
      latMax: latMax + latPad,
      lngMin: lngMin - lngPad,
      lngMax: lngMax + lngPad,
    };
    return locView;
  }

  function projectPoint(view, p) {
    const x = 34 + (p.lng - view.lngMin) / (view.lngMax - view.lngMin) * 332;
    const y = 306 - (p.lat - view.latMin) / (view.latMax - view.latMin) * 250;
    return { x: clamp(x, 24, 376), y: clamp(y, 30, 300) };
  }

  function renderZoneCircles(loc, view) {
    return loc.zones.map(function (z) {
      const p = projectPoint(view, z);
      return '<g class="loc-zone"><circle cx="' + p.x + '" cy="' + p.y + '" r="30"></circle>' +
        '<text x="' + p.x + '" y="' + (p.y + 46) + '">' + App.esc(z.name) + '</text></g>';
    }).join('');
  }

  /* 自己添加的地点也画在地图上，方便一眼看到都放了哪些地方；最多画 8 个 */
  function renderPlaceMarkers(loc, view) {
    return placeMapCards().map(function (card, index) {
      const coords = ensurePlaceCoords(card, loc, index);
      const p = projectPoint(view, coords);
      return '<g class="loc-place" data-place-id="' + App.esc(card.id) + '" transform="translate(' + p.x + ',' + p.y + ')">' +
        '<circle r="5"></circle>' +
        '<text y="-9">' + App.esc(card.text) + '</text>' +
      '</g>';
    }).join('');
  }

  function pinSvg(loc, view, person) {
    const p = projectPoint(view, loc[person]);
    const me = person === 'me';
    const status = loc.status[person] || '';
    const bubbleW = Math.max(46, status.length * 9 + 14);
    const bubbleX = p.x > 250 ? -bubbleW - 12 : 12;
    return '<g class="loc-pin ' + (me ? 'is-me' : 'is-ta') + '" transform="translate(' + p.x + ',' + p.y + ')">' +
      '<circle class="loc-pin-pulse" r="18"></circle>' +
      '<circle class="loc-pin-dot" r="9"></circle>' +
      '<circle class="loc-pin-hit" cx="8" cy="-12" r="34"></circle>' +
      '<g class="loc-pin-bubble" transform="translate(' + bubbleX + ',-60)">' +
        '<rect width="' + bubbleW + '" height="20" rx="10"></rect>' +
        '<text x="' + (bubbleW / 2) + '" y="13.5">' + App.esc(status) + '</text>' +
      '</g>' +
      '<g class="loc-pin-flag">' +
        '<circle class="loc-pin-avatar" cx="17" cy="-15" r="16"></circle>' +
        '<text x="17" y="-11">' + (me ? '我' : 'TA') + '</text>' +
      '</g>' +
    '</g>';
  }

  function drawLocationMap(loc) {
    const svg = el('#loc-map');
    if (!svg) return;
    const view = (locView && locView.latMax > locView.latMin && locView.lngMax > locView.lngMin)
      ? locView
      : mapProject(loc);
    const me = loc.me;
    const ta = loc.ta;
    const mp = projectPoint(view, me);
    const tp = projectPoint(view, ta);
    const mid = { x: (mp.x + tp.x) / 2, y: (mp.y + tp.y) / 2 };

    let roads = '';
    [70, 140, 210, 280].forEach(function (y) {
      roads += '<line x1="0" y1="' + y + '" x2="400" y2="' + (y + 18) + '" class="loc-road"></line>';
    });
    [60, 145, 230, 315].forEach(function (x) {
      roads += '<line x1="' + x + '" y1="0" x2="' + (x - 20) + '" y2="340" class="loc-road"></line>';
    });

    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="loc-bg" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#eef7ff"></stop><stop offset="1" stop-color="#dcecf9"></stop>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="400" height="340" fill="url(#loc-bg)"></rect>' +
      '<path class="loc-river" d="M-20 250 C 80 220, 120 290, 210 260 S 340 210, 430 240 L 430 340 L -20 340 Z"></path>' +
      '<rect x="26" y="26" width="76" height="52" rx="8" class="loc-block"></rect>' +
      '<rect x="196" y="24" width="88" height="46" rx="8" class="loc-block"></rect>' +
      '<rect x="300" y="92" width="74" height="58" rx="8" class="loc-block"></rect>' +
      '<rect x="40" y="176" width="66" height="50" rx="8" class="loc-block"></rect>' +
      '<rect x="236" y="166" width="80" height="56" rx="8" class="loc-block"></rect>' +
      roads +
      '<line class="loc-link" x1="' + mp.x + '" y1="' + mp.y + '" x2="' + tp.x + '" y2="' + tp.y + '"></line>' +
      '<text class="loc-link-text" x="' + mid.x + '" y="' + (mid.y - 8) + '">' + App.esc(distanceText(distanceMeters(me, ta))) + '</text>' +
      renderZoneCircles(loc, view) +
      renderPlaceMarkers(loc, view) +
      pinSvg(loc, view, 'ta') +
      pinSvg(loc, view, 'me');
  }

  function renderLocationCards(loc) {
    const meBox = el('#loc-card-me');
    const taBox = el('#loc-card-ta');
    if (!meBox || !taBox) return;
    const mePlace = locationNameOf(loc, 'me');
    const taPlace = locationNameOf(loc, 'ta');
    const statusButton = function (side) {
      return '<button type="button" class="loc-status-select loc-status-open" data-loc-status-open="' + side + '" aria-haspopup="dialog">' +
        '<span>' + App.esc(loc.status[side]) + '</span>' +
        '<span class="loc-place-chevron" aria-hidden="true">›</span>' +
      '</button>';
    };
    meBox.innerHTML =
      '<div class="loc-card-head"><span class="loc-who is-me">我</span>' +
        '<span class="loc-zone-name">' + (loc.paused ? '已暂停共享' : App.esc(mePlace)) + '</span></div>' +
      '<div class="loc-bubble">' + App.esc(loc.status.me) + '</div>' +
      (loc.paused ? '<p class="field-hint">暂停期间，TA 看不到你的位置。</p>' : statusButton('me'));
    taBox.innerHTML =
      '<div class="loc-card-head"><span class="loc-who is-ta">TA</span>' +
        '<span class="loc-zone-name">' + (loc.paused ? '看不到你' : App.esc(taPlace)) + '</span></div>' +
      '<div class="loc-bubble is-ta">' + App.esc(loc.status.ta) + '</div>' +
      statusButton('ta');
  }

  function renderLocationZones(loc) {
    const box = el('#loc-zone-list');
    if (box) {
      /* 名称和半径都直接打字修改；谁在里面用小徽标提示，不再挤占文字 */
      box.innerHTML = loc.zones.map(function (z) {
        const badge =
          z.id === loc.inside.me && z.id === loc.inside.ta ? '<span class="loc-zone-badge">我和TA都在</span>'
          : z.id === loc.inside.me ? '<span class="loc-zone-badge">我在这里</span>'
          : z.id === loc.inside.ta ? '<span class="loc-zone-badge">TA 在这里</span>'
          : '';
        return '<div class="loc-zone-row">' +
          '<span class="loc-zone-dot"></span>' +
          '<input type="text" class="loc-zone-name-input" data-zone-name="' + App.esc(z.id) + '" value="' + App.esc(z.name) + '" maxlength="12" aria-label="安全区域名称">' +
          '<span class="loc-zone-r-wrap">' +
            '<input type="number" class="loc-zone-r-input" data-zone-r="' + App.esc(z.id) + '" value="' + App.esc(String(z.r)) + '" min="10" max="5000" step="10" inputmode="numeric" aria-label="安全区域半径（米）">米' +
          '</span>' +
          badge +
        '</div>';
      }).join('');
    }
    renderQuickButtons();
  }

  function renderQuickButtons() {
    const box = el('#loc-quick');
    if (!box) return;
    const cfg = quickConfig();
    box.innerHTML = LOC_QUICK_KEYS.map(function (key) {
      const line = cfg[key] || LOC_QUICK_DEFAULTS[key];
      return '<button type="button" class="btn ghost loc-quick-btn" data-loc-quick="' + key + '">' +
        App.esc(line.label) + '</button>';
    }).join('');
  }

  function renderLocation() {
    const loc = locationState();
    /* 旧存档里的地点点位挤成一条线，第一次打开位置页时把它们铺开 */
    spreadPlaceCoords(loc);
    let statusChanged = syncStatusPlace(loc, 'me');
    if (syncStatusPlace(loc, 'ta')) statusChanged = true;
    if (statusChanged) App.save();
    const state = el('#loc-state');
    const hint = el('#loc-hint');
    const enable = el('#loc-enable');
    const pause = el('#loc-pause');
    const lock = el('#loc-map-lock');
    const distance = el('#loc-distance');

    if (state) {
      state.textContent = loc.enabled ? (loc.paused ? '已暂停' : '共享中') : '未开启';
      state.className = 'loc-state' + (loc.enabled ? (loc.paused ? ' is-paused' : ' is-on') : '');
    }
    if (hint) {
      hint.textContent = !loc.enabled
        ? '点击开启即可用虚拟位置共享，不会读取手机定位，也不会弹授权。'
        : loc.paused
          ? '共享已暂停，TA 现在看不到你的位置，随时可以继续。'
          : '位置只在本机模拟，不会上传到任何地方。';
    }
    if (enable) enable.textContent = loc.enabled ? '重新定位' : '开启共享';
    if (pause) pause.textContent = loc.paused ? '继续共享' : '暂停共享';
    if (pause) pause.disabled = !loc.enabled;
    if (lock) {
      lock.hidden = loc.enabled && !loc.paused;
      lock.textContent = loc.paused ? '共享已暂停，TA 看不到你的位置' : '开启共享后显示地图';
    }
    if (distance) {
      distance.textContent = !loc.enabled ? '相距 —' : loc.paused ? '已暂停' : distanceText(distanceMeters(loc.me, loc.ta));
    }
    const shareChip = el('#loc-share-chip');
    if (shareChip) shareChip.checked = !!loc.shareChip;

    if (loc.enabled && !loc.paused) drawLocationMap(loc);
    else {
      const svg = el('#loc-map');
      if (svg) svg.innerHTML = '<rect width="400" height="340" fill="#e9f2fa"></rect>';
    }
    renderLocationCards(loc);
    renderLocationZones(loc);
    renderLocationPlaces(loc);
    if (App.renderChatLocation) App.renderChatLocation();
  }

  /* 虚拟定位：不申请真实定位权限，直接在默认城市附近模拟一个坐标 */
  function virtualPosition() {
    const jitter = function () { return (Math.random() - 0.5) * 0.03; };
    return { lat: 31.2304 + jitter(), lng: 121.4737 + jitter() };
  }

  function enableLocation() {
    const loc = locationState();
    const home = virtualPosition();
    const work = { lat: home.lat + 0.0048, lng: home.lng + 0.0042 };
    loc.me = home;
    loc.ta = { lat: work.lat + 0.0007, lng: work.lng + 0.0008 };
    loc.zones = [
      { id: 'home', name: '家', lat: home.lat, lng: home.lng, r: 320 },
      { id: 'work', name: '公司', lat: work.lat, lng: work.lng, r: 320 },
    ];
    loc.inside = { me: 'home', ta: 'work' };
    loc.enabled = true;
    loc.paused = false;
    locView = null;
    App.save();
    renderLocation();
    App.toast('已开启虚拟位置共享');
  }

  function zoneMessage(who, nextZone, prevZone, customText) {
    const loc = locationState();
    if (!loc.enabled || loc.paused) return;
    const prevName = prevZone ? prevZone.name : '外面';
    if (customText) {
      pushChat(who, customText, { type: 'text' });
    } else if (who === 'ta') {
      if (nextZone && nextZone.id === 'home') pushChat('ta', '我到家了，今天也平安。', { type: 'text' });
      else if (nextZone && nextZone.id === 'work') pushChat('ta', '我到公司了，开始忙啦。', { type: 'text' });
      else pushChat('ta', '我从' + prevName + '出发了，现在在路上。', { type: 'text' });
    } else {
      if (nextZone && nextZone.id === 'home') pushChat('me', '我到家了，别担心。', { type: 'text' });
      else if (nextZone && nextZone.id === 'work') pushChat('me', '我到公司了，今天会有点忙。', { type: 'text' });
      else pushChat('me', '我从' + prevName + '出发了，晚点再聊。', { type: 'text' });
    }
    App.toast(who === 'ta' ? 'TA 的位置有变化，已发来一条私信' : '已自动给 TA 发了一条私信');
  }

  function applyZone(loc, who, nextZone, customText) {
    const prevId = loc.inside[who];
    const prevZone = loc.zones.find(function (z) { return z.id === prevId; }) || null;
    const nextId = nextZone ? nextZone.id : '';
    if (prevId === nextId) {
      /* 已经在同一个区域里，再点一次快捷消息也照样发出去 */
      if (customText) zoneMessage(who, nextZone, prevZone, customText);
      return;
    }
    loc.inside[who] = nextId;
    App.save();
    zoneMessage(who, nextZone, prevZone, customText);
  }

  /* 旧版本把位置提醒存成了拍一拍样式，这里一次性改成普通聊天消息 */
  function migrateLocationMessages() {
    let changed = false;
    Object.keys(App.state.chats || {}).forEach(function (id) {
      (App.state.chats[id] || []).forEach(function (m) {
        if (!m || typeof m.text !== 'string') return;
        /* 旧版本可能给位置提醒带了一个无法显示的符号，先去掉开头符号 */
        const stripped = m.text.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '');
        const isZoneLine = /^(我到家了|我到公司了|我从.+出发了)/.test(stripped);
        if (isZoneLine) {
          if (stripped !== m.text) { m.text = stripped; changed = true; }
          if (m.type === 'pat') { m.type = 'text'; changed = true; }
        }
        if (m.type !== 'pat') return;
        const text = m.text;
        if (text === 'TA 已到家，今天也平安。') {
          m.text = '我到家了，今天也平安。';
          m.type = 'text';
          changed = true;
        } else if (text === 'TA 已到公司，开始忙啦。') {
          m.text = '我到公司了，开始忙啦。';
          m.type = 'text';
          changed = true;
        } else if (/^TA 离开了.+，现在在路上。$/.test(text)) {
          m.text = text.replace(/^TA 离开了(.+)，现在在路上。$/, '我从$1出发了，现在在路上。');
          m.type = 'text';
          changed = true;
        } else if (text === '我已到家，别担心。' || text === '我到公司了，今天会有点忙。' || /^我从.+出发了，晚点再聊。$/.test(text)) {
          m.type = 'text';
          changed = true;
        }
      });
    });
    if (changed) {
      App.save();
      if (App.chatContactId && App.renderChat) App.renderChat();
    }
  }

  function movePersonToZone(who, zoneId, customText) {
    const loc = locationState();
    if (!loc.enabled) { App.toast('先开启共享'); return; }
    const zone = loc.zones.find(function (z) { return z.id === zoneId; });
    if (!zone) return;
    loc[who].lat = zone.lat;
    loc[who].lng = zone.lng;
    applyZone(loc, who, zone, customText);
    renderLocation();
  }

  function runQuick(key) {
    if (!key) return;
    const dash = key.indexOf('-');
    if (dash < 0) return;
    const who = key.slice(0, dash);
    const zoneId = key.slice(dash + 1);
    const line = quickLine(key);
    movePersonToZone(who, zoneId, line ? line.text : '');
  }

  let locQuickDraft = null;

  function openQuickEditor() {
    const cfg = quickConfig();
    locQuickDraft = {};
    LOC_QUICK_KEYS.forEach(function (key) {
      locQuickDraft[key] = { label: cfg[key].label, text: cfg[key].text };
    });
    renderQuickEditor();
    showPanel('#loc-quick-dialog');
  }

  function renderQuickEditor() {
    const box = el('#loc-quick-form');
    if (!box || !locQuickDraft) return;
    const loc = locationState();
    const zoneName = function (id) {
      const z = loc.zones.find(function (item) { return item.id === id; });
      return z ? z.name : (id === 'home' ? '家' : '公司');
    };
    box.innerHTML = LOC_QUICK_KEYS.map(function (key) {
      const dash = key.indexOf('-');
      const who = key.slice(0, dash) === 'ta' ? 'TA' : '我';
      const zoneId = key.slice(dash + 1);
      const item = locQuickDraft[key];
      return '<div class="loc-quick-row">' +
        '<div class="loc-quick-row-head">' + who + ' · ' + App.esc(zoneName(zoneId)) + '</div>' +
        '<label class="loc-quick-field"><span>按钮文字</span>' +
          '<input type="text" data-quick-label="' + key + '" maxlength="12" value="' + App.esc(item.label) + '">' +
        '</label>' +
        '<label class="loc-quick-field"><span>发送内容</span>' +
          '<input type="text" data-quick-text="' + key + '" maxlength="60" value="' + App.esc(item.text) + '">' +
        '</label>' +
      '</div>';
    }).join('');
  }

  function saveQuickEditor() {
    if (!locQuickDraft) locQuickDraft = {};
    const cfg = quickConfig();
    LOC_QUICK_KEYS.forEach(function (key) {
      const labelInput = document.querySelector('[data-quick-label="' + key + '"]');
      const textInput = document.querySelector('[data-quick-text="' + key + '"]');
      const def = LOC_QUICK_DEFAULTS[key];
      const label = labelInput ? labelInput.value.trim() : '';
      const text = textInput ? textInput.value.trim() : '';
      cfg[key] = {
        label: label || def.label,
        text: text || def.text,
      };
      locQuickDraft[key] = { label: cfg[key].label, text: cfg[key].text };
    });
    App.save();
    const dialog = el('#loc-quick-dialog');
    if (dialog) dialog.hidden = true;
    renderLocation();
    App.toast('快捷消息已更新');
  }

  function resetQuickEditor() {
    const cfg = quickConfig();
    locQuickDraft = {};
    LOC_QUICK_KEYS.forEach(function (key) {
      cfg[key] = { label: LOC_QUICK_DEFAULTS[key].label, text: LOC_QUICK_DEFAULTS[key].text };
      locQuickDraft[key] = { label: cfg[key].label, text: cfg[key].text };
    });
    App.save();
    renderQuickEditor();
    renderLocation();
    App.toast('已恢复默认快捷消息');
  }

  function mapPointFromEvent(evt, svg) {
    svg = svg || el('#loc-map');
    if (!svg || !locView) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = evt.clientX;
    point.y = evt.clientY;
    const local = point.matrixTransform(ctm.inverse());
    return {
      x: clamp(local.x, 24, 376),
      y: clamp(local.y, 30, 300),
    };
  }

  function latLngFromMapPoint(p) {
    return {
      lat: locView.latMin + (306 - p.y) / 250 * (locView.latMax - locView.latMin),
      lng: locView.lngMin + (p.x - 34) / 332 * (locView.lngMax - locView.lngMin),
    };
  }

  function moveMeByTap(evt) {
    const svg = evt.currentTarget;
    if (evt.target && evt.target.closest && evt.target.closest('.loc-pin')) return;
    const loc = locationState();
    if (!loc.enabled || loc.paused || !locView) return;
    const pt = mapPointFromEvent(evt, svg);
    if (!pt) return;
    const pos = latLngFromMapPoint(pt);
    /* 正在给某个地点选点时，这一下点的是地点，不动人 */
    const target = placeCardById(locPlaceTarget);
    if (target) {
      target.place = { lat: pos.lat, lng: pos.lng };
      if (loc.placeId.me === target.id) loc.me = { lat: pos.lat, lng: pos.lng };
      if (loc.placeId.ta === target.id) loc.ta = { lat: pos.lat, lng: pos.lng };
      locPlaceTarget = '';
      App.save();
      renderLocation();
      App.toast('「' + target.text + '」已放到这里');
      return;
    }
    const who = locPickWho;
    loc[who].lat = pos.lat;
    loc[who].lng = pos.lng;
    /* 选过地点卡时，把这张卡的坐标一起更新，相当于在地图上改地点 */
    const card = placeCardById(loc.placeId[who]);
    if (card) card.place = { lat: pos.lat, lng: pos.lng };
    applyZone(loc, who, zoneOf(loc, loc[who]));
    App.save();
    renderLocation();
  }

  /* =========================================================
     助眠
     ========================================================= */
  const SLEEP_SOUNDS = [
    { id: 'rain', name: '雨声', icon: '雨', desc: '细密雨点落在窗台' },
    { id: 'waves', name: '海浪', icon: '浪', desc: '缓慢推来的潮汐' },
    { id: 'fire', name: '篝火', icon: '火', desc: '木柴轻轻作响' },
    { id: 'forest', name: '森林', icon: '林', desc: '风穿过树叶' },
    { id: 'fan', name: '风扇', icon: '风', desc: '稳定的白色噪音' },
  ];

  let sleepCtx = null;
  let sleepMaster = null;
  let sleepNodes = {};
  let sleepVolumes = { rain: 0.6, waves: 0.55, fire: 0.45, forest: 0.45, fan: 0.5 };
  let sleepPlaying = false;
  let sleepTimerMin = 0;
  let sleepCountdown = 0;
  let sleepTimer = null;
  let sleepTogether = false;

  function sleepState() {
    const st = App.state;
    if (!st.sleep || typeof st.sleep !== 'object') st.sleep = {};
    if (st.sleep.volumes && typeof st.sleep.volumes === 'object') {
      SLEEP_SOUNDS.forEach(function (s) {
        if (typeof st.sleep.volumes[s.id] === 'number') sleepVolumes[s.id] = st.sleep.volumes[s.id];
      });
    }
    if (typeof st.sleep.together === 'boolean') sleepTogether = st.sleep.together;
    return st.sleep;
  }

  function ensureSleepCtx() {
    if (!sleepCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      sleepCtx = new Ctx();
      sleepMaster = sleepCtx.createGain();
      sleepMaster.gain.value = 0.9;
      sleepMaster.connect(sleepCtx.destination);
    }
    if (sleepCtx.state === 'suspended') sleepCtx.resume();
    return sleepCtx;
  }

  function noiseBuffer(kind) {
    const ctx = sleepCtx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
    } else {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function buildSleepSound(id) {
    const ctx = ensureSleepCtx();
    if (!ctx) return null;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(id === 'waves' || id === 'fire' ? 'brown' : 'white');
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const vol = sleepVolumes[id] == null ? 0.5 : sleepVolumes[id];
    gain.gain.value = vol * 0.5;

    if (id === 'rain') {
      filter.type = 'highpass';
      filter.frequency.value = 700;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 5200;
      src.connect(filter);
      filter.connect(low);
      low.connect(gain);
    } else if (id === 'waves') {
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      src.connect(filter);
      filter.connect(gain);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = vol * 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      sleepNodes[id] = { src: src, filter: filter, gain: gain, lfo: lfo };
      src.start();
      return sleepNodes[id];
    } else if (id === 'fire') {
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      src.connect(filter);
      filter.connect(gain);
      const crackle = setInterval(function () {
        if (!sleepCtx || !sleepNodes.fire) return;
        const click = sleepCtx.createBufferSource();
        click.buffer = noiseBuffer('white');
        const clickGain = sleepCtx.createGain();
        const clickFilter = sleepCtx.createBiquadFilter();
        clickFilter.type = 'bandpass';
        clickFilter.frequency.value = 1800 + Math.random() * 1600;
        clickGain.gain.value = 0.0001;
        click.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(sleepMaster);
        click.start();
        const t = sleepCtx.currentTime;
        clickGain.gain.setValueAtTime(0.0001, t);
        clickGain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        click.stop(t + 0.14);
      }, 900);
      sleepNodes[id] = { src: src, filter: filter, gain: gain, crackle: crackle };
      src.start();
      return sleepNodes[id];
    } else if (id === 'forest') {
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;
      src.connect(filter);
      filter.connect(gain);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = vol * 0.2;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      sleepNodes[id] = { src: src, filter: filter, gain: gain, lfo: lfo };
      src.start();
      return sleepNodes[id];
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 460;
      src.connect(filter);
      filter.connect(gain);
      gain.gain.value = vol * 0.6;
    }

    gain.connect(sleepMaster);
    src.start();
    sleepNodes[id] = { src: src, filter: filter, gain: gain };
    return sleepNodes[id];
  }

  function stopSleepSound(id) {
    const node = sleepNodes[id];
    if (!node) return;
    try { node.src.stop(); } catch (e) {}
    if (node.lfo) { try { node.lfo.stop(); } catch (e) {} }
    if (node.crackle) clearInterval(node.crackle);
    try { node.src.disconnect(); node.gain.disconnect(); } catch (e) {}
    delete sleepNodes[id];
  }

  function activeSleepIds() { return Object.keys(sleepNodes); }

  function sleepVolumeChange(id, value) {
    sleepVolumes[id] = value;
    const node = sleepNodes[id];
    if (node && sleepCtx) {
      const target = id === 'fan' ? value * 0.6 : value * 0.5;
      node.gain.gain.setTargetAtTime(target, sleepCtx.currentTime, 0.15);
    }
    App.state.sleep = Object.assign({}, App.state.sleep, { volumes: Object.assign({}, sleepVolumes) });
    App.save();
    renderSleepHint();
  }

  function renderSleepHint() {
    const ids = activeSleepIds();
    const sub = el('#sleep-sub');
    const title = el('#sleep-title');
    const disc = el('#sleep-disc');
    const master = el('#sleep-master');
    if (ids.length) {
      const names = ids.map(function (id) {
        const s = SLEEP_SOUNDS.find(function (x) { return x.id === id; });
        return s ? s.name : id;
      });
      if (title) title.textContent = sleepPlaying ? names.join(' + ') : '已暂停';
      if (sub) sub.textContent = sleepPlaying ? '音量可以单独调 · 正在播放 ' + names.length + ' 层声音' : '点播放继续';
      if (disc) disc.textContent = (SLEEP_SOUNDS.find(function (x) { return x.id === ids[0]; }) || {}).icon || '眠';
    } else {
      if (title) title.textContent = '雨声';
      if (sub) sub.textContent = '点一个声音开始，可以叠加混音';
      if (disc) disc.textContent = '雨';
    }
    if (master) master.textContent = sleepPlaying ? '❚❚' : '▶';
    const hint = el('#sleep-together-hint');
    if (hint) hint.textContent = sleepTogether
      ? 'TA 也在听 · 已同步同一段声音'
      : '双人同听：你们会在同一时间听同一段声音，像住在同一个屋檐下。';
  }

  function renderSleep() {
    sleepState();
    const box = el('#sleep-sounds');
    if (box) {
      box.innerHTML = SLEEP_SOUNDS.map(function (s) {
        const on = !!sleepNodes[s.id];
        const vol = Math.round((sleepVolumes[s.id] == null ? 0.5 : sleepVolumes[s.id]) * 100);
        return '<div class="sleep-sound' + (on ? ' is-on' : '') + '" data-sleep-sound="' + s.id + '">' +
          '<button type="button" class="sleep-sound-main" data-sleep-toggle="' + s.id + '">' +
            '<span class="sleep-sound-icon">' + s.icon + '</span>' +
            '<span class="sleep-sound-copy"><strong>' + s.name + '</strong><em>' + s.desc + '</em></span>' +
            '<span class="sleep-sound-state">' + (on ? '停止' : '播放') + '</span>' +
          '</button>' +
          '<input type="range" min="0" max="100" value="' + vol + '" data-sleep-vol="' + s.id + '" aria-label="' + s.name + '音量">' +
        '</div>';
      }).join('');
    }
    document.querySelectorAll('#sleep-timer [data-sleep-min]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.sleepMin) === sleepTimerMin);
    });
    const countdown = el('#sleep-countdown');
    if (countdown) countdown.textContent = sleepTimerMin ? fmtCountdown(sleepCountdown) : '';
    renderSleepHint();
  }

  function fmtCountdown(sec) {
    return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
  }

  function toggleSleepSound(id) {
    ensureSleepCtx();
    if (sleepNodes[id]) {
      stopSleepSound(id);
    } else {
      buildSleepSound(id);
    }
    if (activeSleepIds().length && !sleepPlaying) {
      sleepPlaying = true;
      if (sleepCtx && sleepCtx.state === 'suspended') sleepCtx.resume();
    }
    renderSleep();
  }

  function toggleSleepMaster() {
    if (!activeSleepIds().length) {
      toggleSleepSound('rain');
      return;
    }
    sleepPlaying = !sleepPlaying;
    if (!sleepCtx) return;
    if (sleepPlaying) sleepCtx.resume();
    else sleepCtx.suspend();
    renderSleepHint();
  }

  function stopAllSleep() {
    Object.keys(sleepNodes).forEach(stopSleepSound);
    sleepPlaying = false;
    clearInterval(sleepTimer);
    sleepTimer = null;
    sleepCountdown = 0;
    sleepTimerMin = 0;
    renderSleep();
  }

  function setSleepTimer(minutes) {
    sleepTimerMin = minutes;
    sleepCountdown = minutes * 60;
    clearInterval(sleepTimer);
    sleepTimer = null;
    if (minutes > 0) {
      sleepTimer = setInterval(function () {
        sleepCountdown -= 1;
        const node = el('#sleep-countdown');
        if (node) node.textContent = fmtCountdown(Math.max(0, sleepCountdown));
        if (sleepCountdown <= 0) {
          clearInterval(sleepTimer);
          sleepTimer = null;
          stopAllSleep();
          App.toast('定时到了，声音已经关掉');
        }
      }, 1000);
    }
    renderSleep();
  }

  function toggleSleepTogether() {
    sleepTogether = !sleepTogether;
    App.state.sleep = Object.assign({}, App.state.sleep, { together: sleepTogether });
    App.save();
    if (sleepTogether) {
      const ids = activeSleepIds();
      const name = ids.length
        ? (SLEEP_SOUNDS.find(function (x) { return x.id === ids[0]; }) || {}).name
        : '雨声';
      pushChat('ta', '我戴上耳机了，和你一起听' + (name || '雨声') + '。');
      App.toast('已和 TA 同步');
    }
    renderSleepHint();
  }

  /* =========================================================
     听音识曲
     ========================================================= */
  /* 曲库只取「音乐」里已经导入的网易云音乐 */
  function songPool() {
    const music = App.state && App.state.music;
    const list = music && Array.isArray(music.tracks) ? music.tracks : [];
    return list.filter(function (t) { return t && t.source === 'netease' && t.title; });
  }

  let songAudio = null;
  let songAudioTimer = null;
  let songPlayToken = 0;
  let songPlaying = false;
  let songMode = 'solo';
  let songRound = 0;
  let songCurrent = null;
  let songAnswered = true;
  let songHumStream = null;
  let songRecorder = null;
  let songChunks = [];
  let songStopTimer = null;

  function songState() {
    const st = App.state;
    if (!st.songQuiz || typeof st.songQuiz !== 'object') st.songQuiz = { me: 0, ta: 0, rounds: 0 };
    if (typeof st.songQuiz.me !== 'number') st.songQuiz.me = 0;
    if (typeof st.songQuiz.ta !== 'number') st.songQuiz.ta = 0;
    if (typeof st.songQuiz.rounds !== 'number') st.songQuiz.rounds = 0;
    return st.songQuiz;
  }

  function stopSongMelody() {
    songPlaying = false;
    songPlayToken += 1;
    if (songStopTimer) {
      clearTimeout(songStopTimer);
      songStopTimer = null;
    }
    if (songAudioTimer) {
      clearTimeout(songAudioTimer);
      songAudioTimer = null;
    }
    if (songAudio && !songAudio.paused) songAudio.pause();
    const wave = el('#song-wave');
    if (wave) wave.classList.remove('is-playing');
    const play = el('#song-play');
    if (play) play.textContent = '▶';
  }

  /* 关闭听音识曲弹窗时调用：立刻暂停还在播放的片段 */
  App.stopSongQuiz = function () {
    stopSongMelody();
    if (songRecorder && songRecorder.state === 'recording') {
      try { songRecorder.stop(); } catch (err) {}
    }
    if (songHumStream) {
      songHumStream.getTracks().forEach(function (track) { track.stop(); });
      songHumStream = null;
    }
  };

  function playSongSnippet(song) {
    if (!song) return;
    stopSongMelody();
    if (!App.musicSourceUrl) { App.toast('音乐模块还没准备好'); return; }
    if (!songAudio) {
      songAudio = new Audio();
      songAudio.preload = 'auto';
    }
    const hint = el('#song-hint');
    const wave = el('#song-wave');
    const play = el('#song-play');
    const token = ++songPlayToken;
    if (hint) hint.textContent = '正在加载这首歌的片段…';
    function start(src) {
      if (!src) throw new Error('no-src');
      songAudio.src = src;
      return songAudio.play();
    }
    const source = App.musicSourceUrl(song);
    let started;
    if (typeof source === 'string') {
      try { started = start(source); } catch (err) { started = Promise.reject(err); }
    } else {
      started = Promise.resolve(source).then(start);
    }
    /* 音频直链可能既不触发 canplay 也不触发 error，避免一直卡在“正在加载这首歌的片段…” */
    const songLoadTimeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('SONG_LOAD_TIMEOUT')); }, 20000);
    });
    Promise.race([started, songLoadTimeout]).then(function () {
      if (token !== songPlayToken) {
        songAudio.pause();
        return;
      }
      songPlaying = true;
      if (wave) wave.classList.add('is-playing');
      if (play) play.textContent = '❚❚';
      if (hint) hint.textContent = '正在播放一段…听出来了吗？';
      songAudioTimer = setTimeout(function () {
        stopSongMelody();
        const nowHint = el('#song-hint');
        if (nowHint) nowHint.textContent = '曲库：音乐里导入的网易云音乐';
      }, 12000);
    }).catch(function () {
      if (token !== songPlayToken) return;
      stopSongMelody();
      if (hint) hint.textContent = '播放不了，可能受版权限制，点下一题换一首。';
      App.toast('这段音频播放失败，换一首试试');
    });
  }

  function newSongRound() {
    stopSongMelody();
    const input = el('#song-input');
    const result = el('#song-result');
    const submit = el('#song-submit');
    const rounds = el('#song-round');
    const hint = el('#song-hint');
    const pool = songPool();
    if (!pool.length) {
      songCurrent = null;
      songAnswered = true;
      if (hint) hint.textContent = '曲库还是空的，先去「音乐」里导入网易云音乐。';
      if (input) input.value = '';
      if (result) {
        result.hidden = false;
        result.className = 'song-result is-wrong';
        result.textContent = '听音识曲现在会用「音乐」里导入的网易云音乐出题，先去导入几首吧。';
      }
      if (submit) submit.textContent = '提交';
      App.toast('先去音乐里导入网易云音乐');
      return;
    }
    const options = pool.filter(function (s) { return !songCurrent || s.id !== songCurrent.id; });
    songCurrent = options[Math.floor(Math.random() * options.length)] || pool[0];
    songAnswered = false;
    songRound += 1;
    if (rounds) rounds.textContent = '第 ' + songRound + ' 题';
    if (input) input.value = '';
    if (result) result.hidden = true;
    if (submit) submit.textContent = '提交';
    playSongSnippet(songCurrent);
  }

  function songMatch(guess, song) {
    const g = normAnswer(guess);
    const t = normAnswer(song.title);
    if (!g) return false;
    return g === t || g.indexOf(t) !== -1 || (t.indexOf(g) !== -1 && g.length >= 2) || g === normAnswer(song.artist);
  }

  function updateSongScore() {
    const st = songState();
    const me = el('#song-me');
    const ta = el('#song-ta');
    if (me) me.textContent = String(st.me);
    if (ta) ta.textContent = String(st.ta);
    renderSongRank();
  }

  function songSubmit() {
    if (songAnswered) {
      newSongRound();
      return;
    }
    if (!songCurrent) { newSongRound(); return; }
    const input = el('#song-input');
    const guess = input ? input.value.trim() : '';
    if (!guess) { App.toast('先写下你猜的歌名'); return; }
    const correct = songMatch(guess, songCurrent);
    songAnswered = true;
    const result = el('#song-result');
    const st = songState();
    if (songMode === 'battle') {
      if (correct) { st.me += 10; }
      else { st.me -= 5; }
      st.rounds += 1;
      App.save();
      if (result) {
        result.hidden = false;
        result.className = 'song-result ' + (correct ? 'is-right' : 'is-wrong');
        result.textContent = (correct ? '你答对了！+10 分' : '没答对，扣 5 分') + '，正确答案是《' + songCurrent.title + '》 · ' + songCurrent.artist;
      }
      setTimeout(function () {
        const taRight = Math.random() < 0.55;
        if (taRight) st.ta += 10;
        else st.ta -= 5;
        st.rounds += 1;
        App.save();
        if (result) {
          result.textContent += '；TA 猜「' + (taRight ? songCurrent.title : '另一首') + '」' + (taRight ? '，+10 分' : '，-5 分');
        }
        updateSongScore();
      }, 1100);
      pushChat('ta', '听音识曲：我猜是《' + (Math.random() < 0.5 ? songCurrent.title : '另一首歌') + '》。');
    } else {
      if (correct) st.me += 10;
      st.rounds += 1;
      App.save();
      if (result) {
        result.hidden = false;
        result.className = 'song-result ' + (correct ? 'is-right' : 'is-wrong');
        result.textContent = correct
          ? '答对了！《' + songCurrent.title + '》 · ' + songCurrent.artist + '，+10 分'
          : '没猜中，正确答案是《' + songCurrent.title + '》 · ' + songCurrent.artist;
      }
    }
    if (correct) {
      const wave = el('#song-wave');
      if (wave) wave.classList.add('is-playing');
      setTimeout(function () { if (wave) wave.classList.remove('is-playing'); }, 900);
    }
    const submit = el('#song-submit');
    if (submit) submit.textContent = '下一题';
    updateSongScore();
  }

  function renderSongRank() {
    const box = el('#song-rank');
    if (!box) return;
    const st = songState();
    const total = st.me + st.ta;
    const title = total >= 200 ? '中华小曲库' : total >= 100 ? '麦霸预备役' : total >= 40 ? '曲库新星' : '还在找调';
    box.innerHTML =
      '<div class="song-rank-title">' + title + '</div>' +
      '<p class="field-hint">累计：我 ' + st.me + ' 分 · TA ' + st.ta + ' 分 · 一起玩了 ' + st.rounds + ' 轮</p>';
  }

  function setSongMode(mode) {
    songMode = mode;
    songRound = 0;
    songAnswered = true;
    stopSongMelody();
    document.querySelectorAll('#song-mode [data-song-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.songMode === mode);
    });
    const label = el('#song-mode-label');
    if (label) label.textContent = mode === 'battle' ? '双人对战' : mode === 'hum' ? '哼唱模式' : '单人模式';
    const guessRow = el('#song-guess-row');
    const humBox = el('#song-hum-box');
    const stage = document.querySelector('.song-stage');
    if (guessRow) guessRow.hidden = mode === 'hum';
    if (humBox) humBox.hidden = mode !== 'hum';
    if (stage) stage.hidden = mode === 'hum';
    const result = el('#song-result');
    if (result) result.hidden = true;
    updateSongScore();
    if (mode !== 'hum') {
      songCurrent = null;
      newSongRound();
    }
  }

  function startHumRecording(btn) {
    if (songRecorder && songRecorder.state === 'recording') {
      songRecorder.stop();
      btn.textContent = '开始哼唱';
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      App.toast('这个浏览器不支持录音');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      songHumStream = stream;
      songChunks = [];
      songRecorder = new MediaRecorder(stream);
      songRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size) songChunks.push(e.data);
      };
      songRecorder.onstop = function () {
        const blob = new Blob(songChunks, { type: songChunks[0] ? songChunks[0].type : 'audio/webm' });
        const audio = el('#song-audio');
        if (audio) {
          audio.src = URL.createObjectURL(blob);
          audio.hidden = false;
        }
        const taBtn = el('#song-ta-guess');
        if (taBtn) taBtn.hidden = false;
        stream.getTracks().forEach(function (t) { t.stop(); });
        const hint = el('#song-hum-hint');
        if (hint) hint.textContent = '录好了，放给自己听听，也可以让 TA 猜。';
      };
      songRecorder.start();
      btn.textContent = '停止录音';
      const hint = el('#song-hum-hint');
      if (hint) hint.textContent = '正在录…哼一段你熟悉的旋律。';
    }).catch(function () {
      App.toast('没有拿到麦克风权限');
    });
  }

  function taGuessHum() {
    const pool = songPool();
    if (!pool.length) {
      App.toast('先去音乐里导入网易云音乐');
      return;
    }
    const song = pool[Math.floor(Math.random() * pool.length)];
    const hint = el('#song-hum-hint');
    if (hint) hint.textContent = 'TA 听完说：是《' + song.title + '》吗？我猜对了吗？';
    pushChat('ta', '听音识曲：你哼的旋律，我猜是《' + song.title + '》。');
  }

  /* =========================================================
     事件绑定
     ========================================================= */
  App.initCompanion = function () {
    /* 新的工具 / 游戏入口 */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tool]');
      if (!btn) return;
      const tool = btn.dataset.tool;
      if (tool === 'quiz') { openQuiz(); }
      else if (tool === 'sleep') {
        closeMore();
        sleepState();
        renderSleep();
        showPanel('#sleep-dialog');
      } else if (tool === 'songquiz') {
        closeMore();
        songState();
        setSongMode('solo');
        showPanel('#songquiz-dialog');
      } else if (tool === 'sendloc') {
        closeMore();
        sendLocationFromTa();
      }
    });

    /* 默契问答 */
    document.querySelectorAll('#quiz-tabs [data-quiz-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchQuizTab(btn.dataset.quizTab); });
    });
    const quizRefresh = el('#quiz-refresh');
    if (quizRefresh) quizRefresh.addEventListener('click', function () {
      setQuizCard(pickQuizCard());
      refreshQuizPill();
      renderQuizResult(null);
    });
    const quizSubmit = el('#quiz-submit');
    if (quizSubmit) quizSubmit.addEventListener('click', submitQuiz);
    const quizAnswer = el('#quiz-answer');
    if (quizAnswer) quizAnswer.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitQuiz(); }
    });
    const quizCustom = el('#quiz-custom-save');
    if (quizCustom) quizCustom.addEventListener('click', saveCustomQuiz);

    /* 心情日记 */
    const picker = el('#mood-picker');
    if (picker) picker.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mood]');
      if (!btn) return;
      moodDraft.mood = btn.dataset.mood;
      const mood = moodOf(moodDraft.mood);
      const weather = el('#mood-weather');
      if (weather) weather.textContent = mood ? mood.weather : '🌤';
      renderMoodPicker();
    });
    const moodNote = el('#mood-note');
    if (moodNote) moodNote.addEventListener('input', function () { moodDraft.note = moodNote.value; });
    const moodPhoto = el('#mood-photo');
    if (moodPhoto) moodPhoto.addEventListener('change', function () {
      const file = moodPhoto.files && moodPhoto.files[0];
      if (!file) return;
      App.compressImage(file, 900, { maxLength: 160000 }).then(function (src) {
        moodDraft.photo = src;
        renderMoodPhoto();
      }).catch(function () {});
      moodPhoto.value = '';
    });
    const moodSave = el('#mood-save');
    if (moodSave) moodSave.addEventListener('click', saveMood);
    const moodClear = el('#mood-clear');
    if (moodClear) moodClear.addEventListener('click', function () {
      delete moodState().entries[todayKey()];
      App.save();
      renderMood();
      App.toast('今天的心情已清除');
    });
    document.addEventListener('click', function (e) {
      const photoDel = e.target.closest('#mood-photo-del');
      if (photoDel) {
        moodDraft.photo = '';
        renderMoodPhoto();
        return;
      }
      const react = e.target.closest('[data-mood-react]');
      if (react) {
        const kind = react.dataset.moodReact;
        const text = kind === '抱抱' ? '给你一个拥抱，抱紧一点。' : kind === '安慰' ? '别难过，我一直在。' : '什么都不用说，我陪你待一会儿。';
        pushChat('me', text);
        App.toast('已回应 TA 的心情');
        return;
      }
      const nav = e.target.closest('[data-mood-nav]');
      if (nav) {
        moodCursor = new Date(moodCursor.getFullYear(), moodCursor.getMonth() + Number(nav.dataset.moodNav), 1);
        renderMoodCalendar();
      }
    });
    document.querySelectorAll('#mood-cal-tabs [data-mood-cal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        moodCalMode = btn.dataset.moodCal;
        document.querySelectorAll('#mood-cal-tabs [data-mood-cal]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderMoodCalendar();
      });
    });

    /* 回忆墙 */
    const mwAdd = el('#mw-add');
    const mwFile = el('#mw-file');
    if (mwAdd && mwFile) mwAdd.addEventListener('click', function () { mwFile.click(); });
    if (mwFile) mwFile.addEventListener('change', function () {
      importMemoryFiles(mwFile.files);
      mwFile.value = '';
    });
    const mwForm = el('#mw-form');
    if (mwForm) mwForm.addEventListener('submit', function (e) {
      e.preventDefault();
      saveMemory();
    });
    const mwPoster = el('#mw-poster');
    if (mwPoster) mwPoster.addEventListener('click', makeMemoryPoster);
    const mwHidden = el('#mw-hidden');
    if (mwHidden) mwHidden.addEventListener('click', openHiddenAlbum);
    const mwHiddenBody = el('#mw-hidden-body');
    if (mwHiddenBody) mwHiddenBody.addEventListener('click', function (e) {
      if (e.target.closest('#mw-code-save')) {
        const input = el('#mw-code-set');
        const code = input ? input.value.trim() : '';
        if (!/^\d{4}$/.test(code)) { App.toast('请输入 4 位数字密码'); return; }
        memoryState().code = code;
        App.save();
        mwUnlocked = false;
        renderHiddenAlbum();
        App.toast('密码已设好');
        return;
      }
      if (e.target.closest('#mw-code-enter')) {
        const input = el('#mw-code-input');
        const both = el('#mw-code-both');
        if (!both || !both.checked) { App.toast('等 TA 也确认一下'); return; }
        if (!input || input.value.trim() !== memoryState().code) { App.toast('密码不对'); return; }
        mwUnlocked = true;
        renderHiddenAlbum();
        return;
      }
      if (e.target.closest('#mw-code-lock')) {
        mwUnlocked = false;
        renderHiddenAlbum();
        return;
      }
      if (e.target.closest('#mw-code-clear')) {
        const memory = memoryState();
        memory.photos = memory.photos.filter(function (p) { return !p.secret; });
        App.save();
        renderHiddenAlbum();
        renderMemoryWall();
        return;
      }
      const open = e.target.closest('[data-mw-open]');
      if (open) openMemoryPhoto(open.dataset.mwOpen);
    });
    const mwTimeline = el('#mw-timeline');
    if (mwTimeline) mwTimeline.addEventListener('click', function (e) {
      const open = e.target.closest('[data-mw-open]');
      if (open) openMemoryPhoto(open.dataset.mwOpen);
    });
    const mwToday = el('#mw-today');
    if (mwToday) mwToday.addEventListener('click', function (e) {
      const open = e.target.closest('[data-mw-open]');
      if (open) openMemoryPhoto(open.dataset.mwOpen);
    });
    const mwViewBody = el('#mw-view-body');
    if (mwViewBody) mwViewBody.addEventListener('click', function (e) {
      const like = e.target.closest('[data-mw-like]');
      if (like) toggleMemoryLike(like.dataset.mwLike);
    });
    const mwCommentSend = el('#mw-comment-send');
    if (mwCommentSend) mwCommentSend.addEventListener('click', sendMemoryComment);
    const mwCommentInput = el('#mw-comment-input');
    if (mwCommentInput) mwCommentInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendMemoryComment(); }
    });

    /* 位置 */
    const locEnable = el('#loc-enable');
    if (locEnable) locEnable.addEventListener('click', enableLocation);
    const locPause = el('#loc-pause');
    if (locPause) locPause.addEventListener('click', function () {
      const loc = locationState();
      if (!loc.enabled) { App.toast('先开启共享'); return; }
      loc.paused = !loc.paused;
      App.save();
      renderLocation();
      App.toast(loc.paused ? '已暂停共享，TA 看不到你了' : '已继续共享');
    });
    const locMap = el('#loc-map');
    if (locMap) locMap.addEventListener('click', moveMeByTap);
    const locShareChip = el('#loc-share-chip');
    if (locShareChip) locShareChip.addEventListener('change', function () {
      const loc = locationState();
      loc.shareChip = !!locShareChip.checked;
      App.save();
      renderLocation();
      App.toast(loc.shareChip ? '聊天界面会显示距离小窗，可以随便拖' : '已关闭聊天距离小窗');
    });
    initLocChipDrag();
    /* 安全区域：直接打字改名称 / 半径 */
    const zoneListBox = el('#loc-zone-list');
    if (zoneListBox) zoneListBox.addEventListener('change', function (e) {
      const nameInput = e.target.closest ? e.target.closest('[data-zone-name]') : null;
      const rInput = e.target.closest ? e.target.closest('[data-zone-r]') : null;
      if (!nameInput && !rInput) return;
      const loc = locationState();
      let changed = false;
      if (nameInput) {
        const z = loc.zones.find(function (item) { return item.id === nameInput.dataset.zoneName; });
        if (z) {
          const value = String(nameInput.value || '').trim().slice(0, 12);
          if (value && value !== z.name) {
            z.name = value;
            changed = true;
          } else {
            nameInput.value = z.name;
          }
        }
      }
      if (rInput) {
        const z = loc.zones.find(function (item) { return item.id === rInput.dataset.zoneR; });
        if (z) {
          const raw = Math.round(Number(rInput.value));
          if (Number.isFinite(raw)) {
            const r = Math.min(5000, Math.max(10, raw));
            rInput.value = String(r);
            if (r !== z.r) {
              z.r = r;
              changed = true;
            }
          } else {
            rInput.value = String(z.r);
          }
        }
      }
      if (changed) {
        App.save();
        App.toast('安全区域已更新');
        renderLocation();
      }
    });
    const locPromptGo = el('#chat-loc-prompt-go');
    if (locPromptGo) locPromptGo.addEventListener('click', function () {
      const box = el('#chat-loc-prompt');
      if (box) box.hidden = true;
      if (App.go) App.go('location');
      enableLocation();
    });
    const locPromptLater = el('#chat-loc-prompt-later');
    if (locPromptLater) locPromptLater.addEventListener('click', function () {
      const box = el('#chat-loc-prompt');
      if (box) box.hidden = true;
      App.toast('好，等你想开的时候再说');
    });
    const locAddPlace = el('#loc-add-place');
    if (locAddPlace) locAddPlace.addEventListener('click', addPlaceCard);
    const locNewPlace = el('#loc-new-place');
    if (locNewPlace) locNewPlace.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addPlaceCard(); }
    });
    document.querySelectorAll('[data-loc-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        locPickWho = btn.dataset.locPick;
        locPlaceTarget = '';
        renderLocation();
        App.toast(locPickWho === 'ta' ? '点地图设置 TA 的位置' : '点地图设置我的位置');
      });
    });
    document.addEventListener('change', function (e) {
      const status = e.target.closest('[data-loc-status]');
      if (status) {
        const side = status.dataset.locStatus;
        const loc = locationState();
        loc.status[side] = status.value;
        App.save();
        renderLocation();
      }
    });
    document.addEventListener('click', function (e) {
      const placeTrigger = e.target.closest('#loc-me-place, #loc-ta-place');
      if (placeTrigger) {
        openPlacePicker(placeTrigger.dataset.locPlace);
        return;
      }
      const placeOption = e.target.closest('[data-loc-place-option]');
      if (placeOption) {
        setPlaceFor(locPlaceWho, placeOption.dataset.locPlaceOption || '');
        const dialog = el('#loc-place-dialog');
        if (dialog) dialog.hidden = true;
        return;
      }
      const placeTarget = e.target.closest('[data-loc-place-target]');
      if (placeTarget) {
        const id = placeTarget.dataset.locPlaceTarget;
        locPlaceTarget = locPlaceTarget === id ? '' : id;
        renderLocation();
        const targetCard = placeCardById(locPlaceTarget);
        App.toast(targetCard ? '点地图给「' + targetCard.text + '」选个位置' : '已取消选点');
        return;
      }
      const statusTrigger = e.target.closest('[data-loc-status-open]');
      if (statusTrigger) {
        openStatusPicker(statusTrigger.dataset.locStatusOpen);
        return;
      }
      const statusOption = e.target.closest('[data-loc-status-pick]');
      if (statusOption) {
        const loc = locationState();
        const picked = statusOption.dataset.locStatusPick;
        /* 选「在家 / 在公司」时，人也一起移过去，文字和地图上的点保持一致 */
        const atMatch = picked.match(/^在([^-]*)-/);
        if (atMatch) {
          const zone = loc.zones.find(function (z) { return z.name === atMatch[1]; });
          if (zone) {
            loc[locStatusWho].lat = zone.lat;
            loc[locStatusWho].lng = zone.lng;
            loc.inside[locStatusWho] = zone.id;
          }
        }
        loc.status[locStatusWho] = picked;
        App.save();
        const dialog = el('#loc-status-dialog');
        if (dialog) dialog.hidden = true;
        renderLocation();
        return;
      }
      const quickBtn = e.target.closest('[data-loc-quick]');
      if (quickBtn) { runQuick(quickBtn.dataset.locQuick); return; }
      if (e.target.closest('#loc-quick-edit')) { openQuickEditor(); return; }
      if (e.target.closest('#loc-quick-save')) { saveQuickEditor(); return; }
      if (e.target.closest('#loc-quick-reset')) { resetQuickEditor(); return; }
    });

    /* 助眠 */
    const sleepMaster = el('#sleep-master');
    if (sleepMaster) sleepMaster.addEventListener('click', toggleSleepMaster);
    const sleepSounds = el('#sleep-sounds');
    if (sleepSounds) sleepSounds.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-sleep-toggle]');
      if (btn) toggleSleepSound(btn.dataset.sleepToggle);
    });
    if (sleepSounds) sleepSounds.addEventListener('input', function (e) {
      const slider = e.target.closest('[data-sleep-vol]');
      if (slider) sleepVolumeChange(slider.dataset.sleepVol, Number(slider.value) / 100);
    });
    document.querySelectorAll('#sleep-timer [data-sleep-min]').forEach(function (btn) {
      btn.addEventListener('click', function () { setSleepTimer(Number(btn.dataset.sleepMin)); });
    });
    const sleepTogetherBtn = el('#sleep-together');
    if (sleepTogetherBtn) sleepTogetherBtn.addEventListener('click', toggleSleepTogether);

    /* 听音识曲 */
    document.querySelectorAll('#song-mode [data-song-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () { setSongMode(btn.dataset.songMode); });
    });
    const songPlay = el('#song-play');
    if (songPlay) songPlay.addEventListener('click', function () {
      if (songMode === 'hum') return;
      if (songPlaying) stopSongMelody();
      else if (songCurrent) playSongSnippet(songCurrent);
      else newSongRound();
    });
    const songSubmitBtn = el('#song-submit');
    if (songSubmitBtn) songSubmitBtn.addEventListener('click', songSubmit);
    const songInput = el('#song-input');
    if (songInput) songInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); songSubmit(); }
    });
    const songRecord = el('#song-record');
    if (songRecord) songRecord.addEventListener('click', function () { startHumRecording(songRecord); });
    const songTaGuess = el('#song-ta-guess');
    if (songTaGuess) songTaGuess.addEventListener('click', taGuessHum);

    initExtraFeatures();
  };

  /* ================= 日历联动与主题变换 ================= */

  const QIXI_DATES = {
    2024: '2024-08-10', 2025: '2025-08-29', 2026: '2026-08-19', 2027: '2027-08-08',
    2028: '2028-08-26', 2029: '2029-08-16', 2030: '2030-08-05', 2031: '2031-08-24',
    2032: '2032-08-12', 2033: '2033-08-02', 2034: '2034-08-20', 2035: '2035-08-10',
  };

  const FESTIVALS = {
    newyear: {
      name: '元旦', greeting: '新年快乐', sub: '新年的第一天',
      line: '新年快乐！新的一年，也请多多指教。',
      badge: '✦',
    },
    valentine: {
      name: '情人节', greeting: '情人节快乐', sub: '今天是属于我们的日子',
      line: '情人节快乐，今天想和我去哪里？',
      badge: '❤',
    },
    qixi: {
      name: '七夕', greeting: '七夕快乐', sub: '今晚一起看星星吧',
      line: '七夕快乐，今晚的星星，我想和你一起看。',
      badge: '✧',
    },
    christmas: {
      name: '圣诞', greeting: '圣诞快乐', sub: '下雪的话就一起堆雪人',
      line: '圣诞快乐，今年的愿望里还有我，对吧？',
      badge: '❉',
    },
  };

  function calTheme() {
    const st = App.state;
    return (st && st.settings && st.settings.calendarTheme) || {};
  }

  function festivalOn(date) {
    const ct = calTheme();
    if (ct.enabled === false) return null;
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    let id = '';
    if (m === 1 && d === 1) id = 'newyear';
    else if (m === 2 && d === 14) id = 'valentine';
    else if (m === 12 && d === 25) id = 'christmas';
    else if (QIXI_DATES[y] === dateKey(date)) id = 'qixi';
    if (!id || ct[id] === false) return null;
    return Object.assign({ id: id }, FESTIVALS[id]);
  }

  function daysFromTo(dateStr, date) {
    const parts = String(dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 0;
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.floor((today - start) / 86400000);
    return diff >= 0 ? diff + 1 : 0;
  }

  function milestoneInfo(date) {
    const st = App.state;
    const ct = calTheme();
    if (!st || ct.enabled === false || ct.anniversary === false) return null;
    const since = st.profile && st.profile.since;
    const days = since ? daysFromTo(since, date) : 0;
    const parts = String(since || '').split('-').map(Number);
    let annual = false;
    let years = 0;
    if (parts.length === 3 && !parts.some(isNaN)) {
      const sameDay = parts[1] === date.getMonth() + 1 && parts[2] === date.getDate();
      years = date.getFullYear() - parts[0];
      annual = sameDay && years >= 1;
    }
    const names = (st.anniversaries || []).filter(function (a) {
      const p = String(a.date || '').split('-').map(Number);
      return p.length === 3 && !p.some(isNaN)
        && p[1] === date.getMonth() + 1 && p[2] === date.getDate();
    }).map(function (a) { return a.name; });
    const hundred = days >= 100 && days % 100 === 0;
    if (!hundred && !annual && !names.length) return null;
    return { key: dateKey(date), days: days, hundred: hundred, annual: annual, years: years, names: names };
  }

  function milestoneTitle(info) {
    if (info.hundred) return '写在第 ' + info.days + ' 天';
    if (info.annual) return '在一起的第 ' + info.years + ' 周年';
    if (info.names.length) return info.names[0] + ' · 今天';
    return '今天';
  }

  function milestoneLetter(info) {
    const st = App.state;
    const name = (st.profile && st.profile.userName) || '你';
    const since = (st.profile && st.profile.since ? st.profile.since.replace(/-/g, '.') : '');
    const lines = [];
    lines.push('给' + name + '：');
    if (info.hundred) {
      lines.push('今天是我们认识以来的第 ' + info.days + ' 天。数字看起来只是数字，可每往后翻一页，我都能想起一点什么。');
    } else if (info.annual) {
      lines.push('又到了 ' + since + ' 这一天。原来我们已经一起走过 ' + info.years + ' 年了。');
    } else {
      lines.push('今天是「' + info.names.join('、') + '」。这种日子，我总想认真和你说点什么。');
    }
    lines.push('我记得你随口提过的小事，记得你笑起来的停顿，也记得那些谁都没在意的瞬间。它们在我这里，都被好好地收着。');
    lines.push('有时候我不太会说漂亮的话，但我想让你知道：不管今天顺不顺利，回来的时候，这里一直有一盏灯是亮着的。');
    lines.push('接下来的日子，还想和你一起过。想一起去没去过的地方，一起把普通的一天过成值得记住的一天。');
    lines.push('纪念日快乐。' + (info.hundred ? '第 ' + info.days + ' 天只是开始。' : '') + '');
    return lines;
  }

  function openAnnivLetter() {
    const info = milestoneInfo(new Date());
    const dialog = el('#anniv-letter-dialog');
    if (!info || !dialog) return;
    el('#anniv-letter-title').textContent = milestoneTitle(info);
    el('#anniv-letter-body').innerHTML = milestoneLetter(info).map(function (line) {
      return '<p>' + App.esc(line) + '</p>';
    }).join('');
    el('#anniv-letter-from').textContent = 'TA 写给你 · ' + dateLabel(todayKey());
    App._annivLetterText = milestoneLetter(info).join('\n');
    dialog.showModal();
  }

  function applyFestivalBadges(fest) {
    document.querySelectorAll('.app-entry').forEach(function (entry) {
      const go = entry.dataset.go;
      if (go !== 'mail' && go !== 'music') return;
      entry.classList.toggle('has-festival-badge', !!fest);
      if (fest) entry.setAttribute('data-festival-badge', fest.badge);
      else entry.removeAttribute('data-festival-badge');
    });
  }

  function maybeSendFestival(fest) {
    const st = App.state;
    const key = todayKey();
    if (!st.festivalMsg || typeof st.festivalMsg !== 'object') st.festivalMsg = {};
    if (st.festivalMsg[key]) return;
    st.festivalMsg[key] = true;
    App.save();
    pushChat('ta', fest.line);
  }

  function baseGreeting(hour) {
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 23) return '晚上好';
    return '夜深了';
  }

  function applyFestivalTheme(date) {
    const st = App.state;
    if (!st) return;
    const day = date || new Date();
    const view = el('#view-desktop');
    if (!view) return;
    const fest = festivalOn(day);
    const milestone = milestoneInfo(day);
    ['newyear', 'valentine', 'qixi', 'christmas'].forEach(function (id) {
      view.classList.remove('festival-' + id);
    });
    const line = el('#d-festival-line');
    const greeting = el('#d-greeting');
    if (fest) {
      view.classList.add('festival-' + fest.id);
      if (line) {
        line.hidden = false;
        line.textContent = fest.name + ' · ' + fest.sub;
      }
      if (greeting) greeting.textContent = fest.greeting;
      const card = el('#d-today-card');
      if (card) card.textContent = fest.line;
      maybeSendFestival(fest);
    } else {
      if (line) line.hidden = true;
      if (greeting) greeting.textContent = baseGreeting(day.getHours());
    }
    applyFestivalBadges(fest);
    document.querySelectorAll('.days-widget, .anniversary-widget').forEach(function (widget) {
      widget.classList.toggle('is-milestone', !!milestone);
    });
    App._milestoneInfo = milestone;
  }

  /* ================= 次元电台 ================= */

  const RADIO_META = {
    morning: {
      name: '早安电台', icon: '☀',
      quote: '早安，昨晚睡得好吗？今天也要加油哦。',
      sub: '鸟鸣 · 煮咖啡 · 轻快纯音乐',
    },
    night: {
      name: '晚安电台', icon: '☾',
      quote: '晚安，今天辛苦了，我陪你一会儿。',
      sub: '雨声 · 篝火 · 缓慢八音盒',
    },
  };

  let radioStation = '';
  let radioPaused = false;
  let radioNodes = null;
  let radioMaster = null;
  let radioTimerMin = 0;
  let radioCountdown = 0;
  let radioTick = 0;

  function radioWindow(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 21 || hour < 2) return 'night';
    return '';
  }

  function radioNote(freq, when, dur, level, type) {
    if (!sleepCtx || !radioNodes) return;
    const osc = sleepCtx.createOscillator();
    const gain = sleepCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(radioNodes.master);
    osc.start(when);
    osc.stop(when + dur + 0.08);
  }

  function buildRadioSound(station) {
    const ctx = ensureSleepCtx();
    if (!ctx) return false;
    stopRadioSound();
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.6);
    radioMaster = master;
    radioNodes = { master: master, sources: [], timers: [] };

    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(station === 'night' ? 'brown' : 'white');
    bed.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const bedGain = ctx.createGain();
    if (station === 'night') {
      filter.frequency.value = 820;
      bedGain.gain.value = 0.16;
    } else {
      filter.frequency.value = 1600;
      bedGain.gain.value = 0.045;
    }
    bed.connect(filter);
    filter.connect(bedGain);
    bedGain.connect(master);
    bed.start();
    radioNodes.sources.push(bed);

    const padFreqs = station === 'night' ? [130.81, 196] : [174.61, 261.63];
    padFreqs.forEach(function (freq, i) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const padGain = ctx.createGain();
      padGain.gain.value = station === 'night' ? 0.05 : 0.03;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = station === 'night' ? 0.022 : 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(padGain.gain);
      lfo.start();
      osc.connect(padGain);
      padGain.connect(master);
      osc.start();
      radioNodes.sources.push(osc, lfo);
    });

    const scale = station === 'night'
      ? [523.25, 587.33, 659.25, 783.99, 880]
      : [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    let step = 0;
    const melody = function () {
      if (!radioNodes || !sleepCtx || radioPaused) return;
      const freq = scale[step % scale.length];
      step += 1;
      radioNote(freq, sleepCtx.currentTime + 0.02, station === 'night' ? 2.6 : 1.4,
        station === 'night' ? 0.07 : 0.055, station === 'night' ? 'sine' : 'triangle');
      if (station === 'night' && step % 2 === 0) {
        radioNote(freq / 2, sleepCtx.currentTime + 0.05, 3.4, 0.045, 'sine');
      }
    };
    melody();
    radioNodes.timers.push(setInterval(melody, station === 'night' ? 2600 : 1700));

    if (station === 'morning') {
      const birds = function () {
        if (!radioNodes || !sleepCtx || radioPaused) return;
        const base = 1800 + Math.random() * 1200;
        for (let i = 0; i < 3; i++) {
          const t = sleepCtx.currentTime + i * 0.09;
          const osc = sleepCtx.createOscillator();
          const gain = sleepCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base + i * 120, t);
          osc.frequency.exponentialRampToValueAtTime(base + i * 120 + 420, t + 0.08);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          osc.connect(gain);
          gain.connect(radioNodes.master);
          osc.start(t);
          osc.stop(t + 0.15);
        }
      };
      radioNodes.timers.push(setInterval(birds, 9000));
    }
    return true;
  }

  function stopRadioSound() {
    const nodes = radioNodes;
    radioNodes = null;
    radioMaster = null;
    if (!nodes) return;
    nodes.timers.forEach(function (timer) { clearInterval(timer); });
    nodes.sources.forEach(function (node) {
      try { node.stop(); } catch (e) {}
    });
    if (sleepCtx) {
      try {
        nodes.master.gain.cancelScheduledValues(sleepCtx.currentTime);
        nodes.master.gain.setTargetAtTime(0.0001, sleepCtx.currentTime, 0.2);
      } catch (e) {}
    }
    setTimeout(function () {
      try { nodes.master.disconnect(); } catch (e) {}
    }, 800);
  }

  function fadeRadioOut(seconds) {
    if (!radioNodes || !sleepCtx) {
      stopRadioSound();
      return;
    }
    const nodes = radioNodes;
    const now = sleepCtx.currentTime;
    try {
      nodes.master.gain.cancelScheduledValues(now);
      nodes.master.gain.setValueAtTime(Math.max(0.0001, nodes.master.gain.value), now);
      nodes.master.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    } catch (e) {}
    nodes.timers.forEach(function (timer) { clearInterval(timer); });
    setTimeout(function () {
      if (radioNodes !== nodes) return;
      stopRadioSound();
      radioStation = '';
      radioPaused = false;
      radioTimerMin = 0;
      radioCountdown = 0;
      renderRadio();
    }, seconds * 1000 + 150);
  }

  function startRadio(station) {
    if (!RADIO_META[station]) return;
    radioStation = station;
    radioPaused = false;
    radioTimerMin = 0;
    radioCountdown = 0;
    clearInterval(radioTick);
    if (!buildRadioSound(station)) {
      radioStation = '';
      App.toast('这个浏览器不支持音频合成');
      return;
    }
    updateRadioClock();
    renderRadio();
    App.toast(RADIO_META[station].quote);
  }

  function pauseRadio(paused) {
    radioPaused = !!paused;
    if (radioNodes && sleepCtx) {
      try {
        radioNodes.master.gain.setTargetAtTime(paused ? 0.0001 : 0.5, sleepCtx.currentTime, 0.15);
      } catch (e) {}
    }
    renderRadio();
  }

  function stopRadio() {
    clearInterval(radioTick);
    radioTick = 0;
    radioStation = '';
    radioPaused = false;
    radioTimerMin = 0;
    radioCountdown = 0;
    stopRadioSound();
    renderRadio();
  }

  function setRadioTimer(min) {
    clearInterval(radioTick);
    radioTimerMin = Math.max(0, Number(min) || 0);
    radioCountdown = radioTimerMin * 60;
    if (radioTimerMin) {
      radioTick = setInterval(function () {
        if (!radioStation) { clearInterval(radioTick); return; }
        radioCountdown -= 1;
        updateRadioClock();
        if (radioCountdown <= 0) {
          clearInterval(radioTick);
          radioTick = 0;
          const quote = '晚安，做个好梦。';
          App.toast(quote);
          pushChat('ta', quote);
          const nowQuote = el('#radio-now-quote');
          if (nowQuote) nowQuote.textContent = quote;
          const miniQuote = el('#radio-mini-quote');
          if (miniQuote) miniQuote.textContent = quote;
          fadeRadioOut(4);
        }
      }, 1000);
    }
    updateRadioClock();
    renderRadio();
  }

  function updateRadioClock() {
    const cd = el('#radio-countdown');
    const miniTime = el('#radio-mini-time');
    let text = '';
    if (radioTimerMin && radioStation) {
      const mm = Math.floor(Math.max(0, radioCountdown) / 60);
      const ss = Math.max(0, radioCountdown) % 60;
      text = '还剩 ' + mm + ':' + String(ss).padStart(2, '0');
    }
    if (cd) cd.textContent = text;
    if (miniTime) miniTime.textContent = text;
  }

  function renderRadio() {
    const cards = el('#radio-cards');
    if (!cards) return;
    const win = radioWindow(new Date());
    const windowLabel = el('#radio-window');
    if (windowLabel) {
      windowLabel.textContent = win === 'morning'
        ? '现在是清晨时段'
        : win === 'night'
          ? '现在是深夜时段'
          : '电台在清晨 05–10 和深夜 21–02 露出';
    }
    cards.innerHTML = ['morning', 'night'].map(function (id) {
      const meta = RADIO_META[id];
      const active = radioStation === id;
      const avail = win === id;
      return '<button type="button" class="radio-card' + (id === 'night' ? ' is-night' : '') +
        (active ? ' is-active' : '') + (avail ? ' is-now' : '') + '" data-radio-station="' + id + '">' +
        '<span class="radio-card-top"><span class="radio-card-icon">' + meta.icon + '</span>' +
        '<span class="radio-card-name">' + meta.name + '</span>' +
        (avail ? '<em class="radio-card-tag">当前时段</em>' : '') + '</span>' +
        '<span class="radio-card-sub">' + meta.sub + '</span>' +
        '<span class="radio-card-quote">「' + meta.quote + '」</span>' +
        '<span class="radio-card-foot">' +
          (active ? (radioPaused ? '已暂停 · 点一下继续' : '正在播放 · 点一下暂停') : '点一下开始听') +
        '</span>' +
      '</button>';
    }).join('');

    const now = el('#radio-now');
    const panel = el('#radio-panel');
    if (now) now.hidden = !radioStation;
    if (panel) panel.classList.toggle('is-night-playing', radioStation === 'night');
    if (radioStation) {
      const meta = RADIO_META[radioStation];
      const title = el('#radio-now-title');
      const quote = el('#radio-now-quote');
      const disc = el('#radio-now-disc');
      const toggle = el('#radio-toggle');
      if (title) title.textContent = meta.name;
      if (quote) quote.textContent = meta.quote;
      if (disc) disc.textContent = meta.icon;
      if (toggle) toggle.textContent = radioPaused ? '▶' : '❚❚';
      document.querySelectorAll('#radio-timer [data-radio-min]').forEach(function (btn) {
        btn.classList.toggle('is-on', Number(btn.dataset.radioMin) === radioTimerMin);
      });
      updateRadioClock();
    }
    renderRadioHome();
  }

  function renderRadioHome() {
    const card = el('#home-radio');
    const mini = el('#radio-mini');
    const win = radioWindow(new Date());
    if (card) {
      const station = win || radioStation;
      if (!station) {
        card.hidden = true;
      } else {
        const meta = RADIO_META[station];
        card.hidden = false;
        const label = el('#home-radio-label');
        const quote = el('#home-radio-quote');
        const foot = el('#home-radio-foot');
        if (label) label.textContent = meta.name;
        if (quote) quote.textContent = radioStation === station ? meta.quote : meta.quote;
        if (foot) {
          foot.textContent = radioStation === station
            ? (radioPaused ? '已暂停 · 点开继续' : '正在播放 · 点开看看')
            : (win === 'morning' ? '清晨时段，听一会儿再出门' : '夜深了，让它陪你入睡');
        }
      }
    }
    if (mini) {
      mini.hidden = !radioStation;
      if (radioStation) {
        const meta = RADIO_META[radioStation];
        const title = el('#radio-mini-title');
        const quote = el('#radio-mini-quote');
        const disc = el('#radio-mini-disc');
        const play = el('#radio-mini-play');
        if (title) title.textContent = meta.name + (radioPaused ? ' · 已暂停' : '');
        if (quote) quote.textContent = meta.quote;
        if (disc) disc.textContent = meta.icon;
        if (play) play.textContent = radioPaused ? '▶' : '❚❚';
        updateRadioClock();
      }
    }
  }

  function toggleRadioStation(station) {
    if (radioStation === station) {
      pauseRadio(!radioPaused);
      return;
    }
    startRadio(station);
  }

  function initExtraFeatures() {
    migrateLocationMessages();
    const letterDialog = el('#anniv-letter-dialog');
    if (letterDialog) {
      document.querySelectorAll('#anniv-letter-dialog [data-close]').forEach(function (btn) {
        btn.addEventListener('click', function () { letterDialog.close(); });
      });
      const save = el('#anniv-letter-save');
      if (save) save.addEventListener('click', function () {
        App.state.mail = App.state.mail || [];
        App.state.mail.unshift({
          id: App.uid('mail'),
          from: 'ta',
          contactId: App.state.currentContactId || null,
          text: App._annivLetterText || '',
          ts: Date.now(),
          read: false,
          fav: false,
        });
        App.save();
        if (App.updateMailBadge) App.updateMailBadge();
        letterDialog.close();
        App.toast('纪念日信已收进信箱');
      });
    }

    document.addEventListener('click', function (e) {
      const widget = e.target.closest('.days-widget, .anniversary-widget');
      if (!widget) return;
      if (!milestoneInfo(new Date())) return;
      e.preventDefault();
      e.stopPropagation();
      openAnnivLetter();
    }, true);

    const radioCards = el('#radio-cards');
    if (radioCards) radioCards.addEventListener('click', function (e) {
      const card = e.target.closest('[data-radio-station]');
      if (card) toggleRadioStation(card.dataset.radioStation);
    });
    const radioToggle = el('#radio-toggle');
    if (radioToggle) radioToggle.addEventListener('click', function () {
      if (radioStation) pauseRadio(!radioPaused);
    });
    const radioTimer = el('#radio-timer');
    if (radioTimer) radioTimer.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-radio-min]');
      if (btn) setRadioTimer(Number(btn.dataset.radioMin));
    });
    const miniPlay = el('#radio-mini-play');
    if (miniPlay) miniPlay.addEventListener('click', function () {
      if (radioStation) pauseRadio(!radioPaused);
    });
    const miniClose = el('#radio-mini-close');
    if (miniClose) miniClose.addEventListener('click', function () { stopRadio(); });

    setInterval(function () {
      const key = todayKey();
      if (App._extraDayKey === key) return;
      App._extraDayKey = key;
      refreshTaMood(true);
      if (currentView('desktop') && App.renderDesktop) App.renderDesktop();
      else applyFestivalTheme();
    }, 60000);
  }

  App.renderMemoryWidget = renderMemoryWidget;
  App.renderMemoryWall = renderMemoryWall;
  App.renderLocation = renderLocation;
  App.renderMood = renderMood;
  App.applyFestivalTheme = applyFestivalTheme;
  App.renderRadio = renderRadio;
  App.renderRadioHome = renderRadioHome;
  App.refreshTaMood = refreshTaMood;

  /* 页面首次加载时把新视图的默认数据补上 */
  setTimeout(function () {
    if (!App.state) return;
    quizState();
    moodState();
    memoryState();
    locationState();
    songState();
    renderMemoryWidget();
  }, 0);
})();
