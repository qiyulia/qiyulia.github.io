/* 今日步数：本地计步 + TA 模拟步数 + 同心币兑换 + 聊天反馈
 * 数据全部存在 localStorage，三份：
 *   myStepsData    = { date, count, claimed }
 *   taStepsData    = { date, count, lastTickTime }
 *   stepSettings   = { enabled, interval, probability, cooldown }
 * 另存一份 stepCooldowns = { action: ts } 记录同步/领币冷却起点。 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  const KEY_MY = 'myStepsData';
  const KEY_TA = 'taStepsData';
  const KEY_SET = 'stepSettings';
  const KEY_CD = 'stepCooldowns';

  const GOAL = 8000;       // 我的步数目标
  const CAP = 30000;       // 单日步数上限
  const COIN_RATE = 100;   // 100 步 = 1 同心币

  const COOLDOWN_OPTIONS = [
    { label: '无冷却', value: '无', minutes: 0 },
    { label: '30分钟', value: '30分钟', minutes: 30 },
    { label: '1小时', value: '1小时', minutes: 60 },
    { label: '3小时', value: '3小时', minutes: 180 },
    { label: '6小时', value: '6小时', minutes: 360 },
  ];
  function cooldownMinutes(label) {
    const hit = COOLDOWN_OPTIONS.find(function (o) { return o.value === label; });
    return hit ? hit.minutes : 0;
  }

  const COMPLAINTS = [
    '别一直盯着看啦，我难道还能跑了不成？',
    '刚同步过啦，歇会儿再来看看～',
    '你这么勤快，我都不好意思偷懒了。',
    '别急别急，数据又不会长腿跑掉。',
    '再点我就要装作没看见咯～',
    '你呀，是不是就想看看我有没有在偷偷走路？',
  ];

  /* ---------- 工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function prettyDate() {
    const d = new Date();
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + week;
  }
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- 数据存取（单源权威值，避免多源漂移） ---------- */
  function getMy() {
    let d = lsGet(KEY_MY, null);
    if (!d || typeof d !== 'object') d = {};
    if (d.date !== todayStr()) { d = { date: todayStr(), count: 0, claimed: false }; lsSet(KEY_MY, d); }
    if (typeof d.count !== 'number') d.count = 0;
    return d;
  }
  function saveMy(d) { lsSet(KEY_MY, d); }

  function getTa() {
    let d = lsGet(KEY_TA, null);
    if (!d || typeof d !== 'object') d = {};
    if (d.date !== todayStr()) {
      d = { date: todayStr(), count: 0, lastTickTime: Date.now() };
      lsSet(KEY_TA, d);
    }
    if (typeof d.count !== 'number') d.count = 0;
    if (typeof d.lastTickTime !== 'number' || !d.lastTickTime) d.lastTickTime = Date.now();
    return d;
  }
  function saveTa(d) { lsSet(KEY_TA, d); }

  function getSettings() {
    let s = lsGet(KEY_SET, null);
    if (!s || typeof s !== 'object') s = {};
    if (typeof s.enabled !== 'boolean') s.enabled = true;
    s.interval = clampInterval(s.interval);
    s.probability = clampProb(s.probability);
    if (typeof s.feedbackProb !== 'number') s.feedbackProb = 70;
    s.feedbackProb = clampProb(s.feedbackProb);
    if (typeof s.cooldown !== 'string' || !cooldownMinutes(s.cooldown) && s.cooldown !== '无') {
      /* 不在选项里就归为无冷却；但 '无' 是合法值 */
    }
    if (!COOLDOWN_OPTIONS.some(function (o) { return o.value === s.cooldown; })) s.cooldown = '无';
    return s;
  }
  function saveSettings(s) { lsSet(KEY_SET, s); }

  function clampInterval(v) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 30) return 30;
    return n;
  }
  function clampProb(v) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 100) return 100;
    return n;
  }

  function getCooldowns() {
    let c = lsGet(KEY_CD, null);
    if (!c || typeof c !== 'object') c = {};
    if (typeof c.action !== 'number') c.action = 0;
    return c;
  }
  function saveCooldowns(c) { lsSet(KEY_CD, c); }

  function currentContact() {
    const list = (App.state && App.state.contacts) || [];
    return list.find(function (c) { return c.id === App.state.currentContactId; }) || list[0] || null;
  }
  function taName() { const c = currentContact(); return c ? c.name : 'TA'; }

  /* ---------- TA 步数核心算法：等差数列 + 定时投掷 ---------- */
  function taTick() {
    const s = getSettings();
    const ta = getTa();
    if (!s.enabled) {
      /* 关闭时 TA 步数强制归零，并把计时锚点拉到现在，避免重开时一次性补跳 */
      if (ta.count !== 0) { ta.count = 0; saveTa(ta); }
      ta.lastTickTime = Date.now(); saveTa(ta);
      return false;
    }
    const now = Date.now();
    const intervalMin = s.interval;
    const intervalMs = intervalMin * 60 * 1000;
    const elapsedMin = (now - ta.lastTickTime) / 60000;
    if (elapsedMin < intervalMin) return false;

    const cycles = Math.floor(elapsedMin / intervalMin);
    let changed = false;
    for (let i = 0; i < cycles; i++) {
      if (Math.random() * 100 < s.probability) {
        const X = intervalMin;
        const multiplier = Math.max(1, Math.floor(X / 3));
        const minStep = 10 + (multiplier - 1) * 100;
        const maxStep = 100 + (multiplier - 1) * 200;
        const add = Math.floor(minStep + Math.random() * (maxStep - minStep + 1));
        ta.count = Math.min(CAP, ta.count + add);
        changed = true;
      }
    }
    /* 锚点前进整数个周期，保留余下的零头，避免每次重算都丢时间 */
    ta.lastTickTime += cycles * intervalMs;
    saveTa(ta);
    return changed;
  }

  /* ---------- CountUp 滚动动效 ---------- */
  function countUp(node, target, duration) {
    if (!node) return;
    target = Math.max(0, Math.round(Number(target) || 0));
    const start = Number(node.dataset.val || 0);
    const dur = duration || 900;
    const t0 = performance.now();
    if (node._raf) cancelAnimationFrame(node._raf);
    function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * eased);
      node.textContent = v.toLocaleString('zh-CN');
      if (p < 1) node._raf = requestAnimationFrame(frame);
      else { node.dataset.val = String(target); }
    }
    node._raf = requestAnimationFrame(frame);
  }

  /* ---------- 聊天注入：让 TA 发一条普通文本气泡 ---------- */
  function pushTaText(text) {
    const contact = currentContact();
    if (!contact || !text) return;
    const chat = App.state.chats[contact.id] || (App.state.chats[contact.id] = []);
    chat.push({ id: App.uid('m'), role: 'ta', type: 'text', text: text, ts: Date.now() });
    App.save();
    if (App.chatContactId === contact.id && el('#view-chat') && el('#view-chat').classList.contains('is-active')) {
      App.renderChat();
    } else {
      App.unread[contact.id] = (App.unread[contact.id] || 0) + 1;
      if (App.updateBadges) App.updateBadges();
      if (App.renderContacts) App.renderContacts();
    }
  }

  /* ---------- 反馈文案池 ---------- */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const SINGLE = {
    home: [
      '今天怎么没怎么动？是太累了吗，还是想在家里陪我？',
      '步数这么少，是不是在床上赖了一天呀？小懒虫。',
      '今天一直坐着吗？小心腰酸背痛，快起来伸个懒腰。',
      '不想出门也没关系，今天就在家里陪我吧，我给你讲个故事。',
      '才走了这么几步，是不是光顾着看手机啦？',
      '看来今天是个安静的日子，有没有想我？',
      '步数少得可怜哦。不过没关系，你只要待在我能看见的地方就好。',
    ],
    daily: [
      '今天去散步了吗？走了这么多路，脚酸不酸？',
      '看来今天是正常活动呢。有没有遇到什么有趣的事情？',
      '走了一会儿了吧？记得找个地方坐下喝口水。',
      '这个步数刚刚好，既活动了身体又不会太累。做得好！',
      '你出去逛了吗？有没有顺便买点好吃的？',
      '原来今天出门了呀，我还以为你又要在家里发霉了。',
      '今天的运动量达标啦，接下来该好好休息了。',
    ],
    active: [
      '哇，你今天去了好多地方。晚上记得泡个脚哦！',
      '今天怎么走这么多路，去哪儿野了？也不带上我。',
      '这个步数，今天一定很充实吧？辛苦了，快坐下休息一会。',
      '哇，你今天的运动量可以呀！看来体力不错嘛。',
      '走了这么多步，晚上肯定能睡个好觉。晚安要梦到我哦。',
      '看来你今天跑了不少地方，有没有想我想到走神呀？',
      '厉害呀，今天简直是运动健将。不过别太勉强自己哦。',
    ],
    crazy: [
      '今天怎么走了这么远！辛苦啦，快坐下休息一会，我给你捏捏腿。',
      '天呐，你是去跑马拉松了吗？心疼死我了，快把鞋脱了放松一下。',
      '一万多步！你今天到底去哪儿了？腿还在不在？',
      '这么夸张的步数，肯定累坏了吧？今天什么也别干了，就乖乖躺着。',
      '我看看……你这步子迈得也太大了吧，一定要好好拉伸一下哦！',
      '今天绝对是超级辛苦的一天，晚上想吃什么？我请客（虚拟的）！',
      '感觉你的腿都要走断了，快去泡个热水澡，早点休息！',
    ],
  };
  function singleFeedback(count) {
    if (count >= 10000) return pick(SINGLE.crazy);
    if (count >= 5000) return pick(SINGLE.active);
    if (count >= 1000) return pick(SINGLE.daily);
    return pick(SINGLE.home);
  }

  const DOUBLE = {
    a: [ // 我比 TA 多 5000+
      '你这个小马达今天转得这么快？去哪儿野了也不带上我。',
      '看了你的步数，我怀疑你背着我偷偷去跑马拉松了。',
      '哇，今天你走的步数比我多这么多，是不是把腿都要走断了？',
      '你今天走这么多，我在家里等你等得都快长蘑菇了。',
      '看来今天是我输了，你居然走了这么多路，晚上回去记得泡脚！',
      '你在外面跑了一天，有没有给我带好吃的回来？',
      '不愧是运动健将，今天步数碾压我了，晚上要好好休息哦。',
    ],
    b: [ // TA 比我多 5000+
      '我今天去了好多地方，你这个小宅猫是不是又待了一天？',
      '我替你把今天的路都走完了，你在家里乖乖等我就好。',
      '今天我在外面跑了一天，腿都快断了，你居然在家躺平？',
      '看看我的步数，再看看你的，你呀，是不是又在床上长蘑菇了？',
      '今天外面的风景很好，可惜你这个小懒虫没跟我一起出来。',
      '我走了两万多步，你才这么点，晚上必须给我捏捏腿补偿一下！',
      '你今天是不是光顾着看手机和发呆了？连门都没出。',
    ],
    c: [ // 都 >5000 且差 <2000
      '咦？我们今天的步数差不多诶，是不是在不同的时空里同步散步了？',
      '默契度满分！看来我们今天都在外面努力地生活呢。',
      '你今天也走了这么多步呀！我们在不同的地方看同样的风景，感觉真好。',
      '看来今天我们俩都出门溜达了，要是能在大街上偶遇就好了。',
      '步数这么接近，说明我们的心跳频率今天也在同一个频道上哦。',
      '今天大家都辛苦了，晚上一起好好休息一下吧！',
      '我们居然走了差不多的步数，这算不算是另一种形式的“并肩同行”？',
    ],
    d: [ // 都 <2000 且差 <1000
      '看来今天我们俩都很懒，那就一起在床上躺平吧～',
      '步数都这么少，你这个小宅猫果然还是喜欢和我一起宅在家里。',
      '今天是我们共同的“摆烂日”吗？不过这样陪着你也很开心。',
      '没走几步路，说明你今天一直乖乖待在我身边（或者屏幕前）呢。',
      '既然大家都没怎么动，那今天的主题就是“拥抱和休息”。',
      '步数这么少，是不是因为太想我，连门都不想出了？',
      '看来今天外面一定没有吸引我们的东西，还是呆在家里最好。',
    ],
  };
  function doubleFeedback(myCount, taCount) {
    const diff = myCount - taCount;
    const abs = Math.abs(diff);
    if (myCount > 5000 && taCount > 5000 && abs < 2000) return pick(DOUBLE.c);
    if (myCount < 2000 && taCount < 2000 && abs < 1000) return pick(DOUBLE.d);
    if (diff > 5000) return pick(DOUBLE.a);
    if (diff < -5000) return pick(DOUBLE.b);
    return null;
  }

  /* ---------- 冷却 ---------- */
  function actionCooldownMs() { return cooldownMinutes(getSettings().cooldown) * 60 * 1000; }
  function actionRemaining() {
    const cd = getCooldowns();
    const remain = actionCooldownMs() - (Date.now() - cd.action);
    return remain > 0 ? remain : 0;
  }
  function stampAction() { const c = getCooldowns(); c.action = Date.now(); saveCooldowns(c); }
  function fmtCountdown(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return pad(m) + ':' + pad(r);
  }

  /* ---------- 渲染 ---------- */
  function renderCooldownButtons() {
    const remain = actionRemaining();
    ['steps-sync-btn', 'steps-claim-btn'].forEach(function (id) {
      const btn = el('#' + id);
      if (!btn) return;
      if (remain > 0) {
        btn.disabled = true;
        btn.classList.add('is-cooling');
        const base = btn.dataset.label || btn.textContent;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = '冷却中 ' + fmtCountdown(remain);
      } else {
        btn.disabled = false;
        btn.classList.remove('is-cooling');
        if (btn.dataset.label) btn.textContent = btn.dataset.label;
      }
    });
  }

  function renderLeaderboard(myCount, taCount) {
    const contact = currentContact();
    const me = { name: '我', count: myCount, avatar: (App.state.profile && App.state.profile.userAvatar) || '🙂', key: 'me' };
    const ta = { name: taName(), count: taCount, avatar: contact ? contact.avatar : '🙂', key: 'ta' };
    const rows = [me, ta].sort(function (a, b) { return b.count - a.count; });
    const box = el('#steps-board');
    if (!box) return;
    box.innerHTML = rows.map(function (r, i) {
      const crown = i === 0
        ? '<svg class="steps-crown" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 24 L6 10 L12 17 L16 7 L20 17 L26 10 L28 24 Z" fill="#f4b740" stroke="#c98a17" stroke-width="1.5" stroke-linejoin="round"/><rect x="4" y="24" width="24" height="4" rx="1.5" fill="#f4b740" stroke="#c98a17" stroke-width="1.5"/></svg>'
        : '<span class="steps-rank">' + (i + 1) + '</span>';
      return '<div class="steps-board-row' + (r.key === 'me' ? ' is-me' : '') + '">' +
        crown +
        '<span class="avatar steps-board-avatar">' + App.avatarHtml(r.avatar) + '</span>' +
        '<span class="steps-board-name">' + App.esc(r.name) + '</span>' +
        '<span class="steps-board-count">' + r.count.toLocaleString('zh-CN') + ' 步</span>' +
      '</div>';
    }).join('');
  }

  App.renderSteps = function () {
    getMy(); getTa(); // 触发跨天重置
    taTick();
    const s = getSettings();
    const my = getMy();
    const ta = getTa();
    const taCount = s.enabled ? ta.count : 0;

    const dateNode = el('#steps-date');
    if (dateNode) dateNode.textContent = prettyDate();

    countUp(el('#steps-my-num'), my.count, 900);
    countUp(el('#steps-ta-num'), taCount, 900);

    /* 进度条 */
    const pct = Math.min(100, (my.count / GOAL) * 100);
    const bar = el('#steps-progress-fill');
    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.toggle('is-gold', my.count >= GOAL);
    }
    const progText = el('#steps-progress-text');
    if (progText) progText.textContent = my.count.toLocaleString('zh-CN') + ' / ' + GOAL + ' 步';

    const contact = currentContact();
    const taAvatar = el('#steps-ta-avatar');
    if (taAvatar) taAvatar.innerHTML = App.avatarHtml(contact ? contact.avatar : '🙂');
    const taNameNode = el('#steps-ta-name');
    if (taNameNode) taNameNode.textContent = taName();

    /* 兑换按钮：已领/未领态 */
    const claimBtn = el('#steps-claim-btn');
    if (claimBtn) {
      if (!claimBtn.dataset.label) claimBtn.dataset.label = claimBtn.textContent;
      if (my.claimed) { claimBtn.disabled = true; claimBtn.classList.add('is-claimed'); claimBtn.textContent = '今日已兑换'; }
      else { claimBtn.classList.remove('is-claimed'); if (!actionRemaining()) claimBtn.disabled = false; claimBtn.textContent = claimBtn.dataset.label; }
    }

    renderLeaderboard(my.count, taCount);

    /* 视觉彩蛋：双方都超过 5000 步 */
    const egg = el('#steps-walk');
    if (egg) egg.hidden = !(my.count > 5000 && taCount > 5000);

    renderCooldownButtons();
  };

  /* ---------- 交互 ---------- */
  function openSyncDialog() {
    const dlg = el('#steps-sync-dialog');
    const input = el('#steps-sync-input');
    if (!dlg || !input) return;
    input.value = String(getMy().count);
    try { dlg.showModal(); } catch (e) {}
    setTimeout(function () { input.focus(); input.select(); }, 60);
  }

  function doSync(value) {
    const my = getMy();
    my.count = Math.max(0, Math.min(CAP, Math.round(Number(value) || 0)));
    saveMy(my);
    stampAction();
    App.renderSteps();
    /* 聊天反馈：先 50/50 选「数字限制」或「步数差」，再按反馈概率掷骰子决定是否真发 */
    const s = getSettings();
    const taCount = s.enabled ? getTa().count : 0;
    const useSingle = Math.random() < 0.5;
    const text = useSingle ? singleFeedback(my.count) : doubleFeedback(my.count, taCount);
    if (text && Math.random() * 100 < s.feedbackProb) {
      pushTaText(text);
    }
  }

  function doClaim() {
    const my = getMy();
    if (my.claimed) { App.toast('今天已经兑换过同心币啦'); return; }
    const coins = Math.floor(my.count / COIN_RATE);
    if (coins < 1) { App.toast('步数不足 100，暂时换不了同心币'); return; }
    if (!App.state.wallet) App.state.wallet = { me: 0, ta: 0 };
    App.state.wallet.me = (App.state.wallet.me || 0) + coins;
    my.claimed = true;
    saveMy(my);
    stampAction();
    App.save();
    if (App.renderMarket && el('#view-market') && el('#view-market').classList.contains('is-active')) App.renderMarket();
    App.renderSteps();
    App.toast('兑换成功，+' + coins + ' 同心币');
    pushTaText('你把今天的步数换成了 ' + coins + ' 同心币，真棒～记得明天继续走哦！');
  }

  function onActionClick(handler) {
    if (actionRemaining() > 0) {
      App.toast(pick(COMPLAINTS));
      return;
    }
    handler();
  }

  /* ---------- 设置页绑定与回填 ---------- */
  App.renderStepSettings = function () {
    const s = getSettings();
    const en = el('#set-steps-enabled');
    if (en) en.checked = !!s.enabled;
    const iv = el('#set-steps-interval');
    if (iv) iv.value = s.interval;
    const pb = el('#set-steps-probability');
    if (pb) pb.value = s.probability;
    const pbv = el('#set-steps-probability-val');
    if (pbv) pbv.textContent = s.probability + '%';
    const fpb = el('#set-steps-feedback-prob');
    if (fpb) fpb.value = s.feedbackProb;
    const fpbv = el('#set-steps-feedback-prob-val');
    if (fpbv) fpbv.textContent = s.feedbackProb + '%';
    const cd = el('#set-steps-cooldown');
    if (cd) cd.value = s.cooldown;
    applySettingsDisabled(!!s.enabled);
  };

  function applySettingsDisabled(enabled) {
    ['#set-steps-interval', '#set-steps-probability', '#set-steps-feedback-prob', '#set-steps-cooldown'].forEach(function (sel) {
      const node = el(sel);
      if (node) node.disabled = !enabled;
    });
    const wrap = el('#steps-settings-fields');
    if (wrap) wrap.classList.toggle('is-disabled', !enabled);
  }

  function bindStepSettings() {
    const en = el('#set-steps-enabled');
    if (en) {
      bindOnce(en, 'change', function () {
        const s = getSettings();
        s.enabled = !!en.checked;
        saveSettings(s);
        if (!s.enabled) {
          const ta = getTa(); ta.count = 0; ta.lastTickTime = Date.now(); saveTa(ta);
        } else {
          const ta = getTa(); ta.lastTickTime = Date.now(); saveTa(ta);
        }
        applySettingsDisabled(s.enabled);
        if (el('#view-steps') && el('#view-steps').classList.contains('is-active')) App.renderSteps();
      });
    }
    const iv = el('#set-steps-interval');
    if (iv) {
      /* 强制边界：<1 或空/非数字 -> 1；>30 -> 30 */
      bindOnce(iv, 'change', function () {
        const raw = String(iv.value || '').trim();
        const n = Number(raw);
        let v;
        if (raw === '' || !Number.isFinite(n)) v = 1;
        else v = clampInterval(n);
        iv.value = v;
        const s = getSettings(); s.interval = v; saveSettings(s);
      });
    }
    const pb = el('#set-steps-probability');
    const pbv = el('#set-steps-probability-val');
    if (pb) {
      bindOnce(pb, 'input', function () {
        const v = clampProb(pb.value);
        pb.value = v;
        if (pbv) pbv.textContent = v + '%';
        const s = getSettings(); s.probability = v; saveSettings(s);
      });
    }
    const fpb = el('#set-steps-feedback-prob');
    const fpbv = el('#set-steps-feedback-prob-val');
    if (fpb) {
      bindOnce(fpb, 'input', function () {
        const v = clampProb(fpb.value);
        fpb.value = v;
        if (fpbv) fpbv.textContent = v + '%';
        const s = getSettings(); s.feedbackProb = v; saveSettings(s);
      });
    }
    const cd = el('#set-steps-cooldown');
    if (cd) {
      bindOnce(cd, 'change', function () {
        const s = getSettings(); s.cooldown = cd.value || '无'; saveSettings(s);
      });
    }
  }

  /* ---------- 初始化 ---------- */
  let stepsInited = false;
  let stepsTimer = 0;
  const stepsBound = new WeakSet();
  /* 同一个节点只绑一次：boot 里失败后进入步数页会重试，不能重复绑定 */
  function bindOnce(node, type, fn) {
    if (!node || stepsBound.has(node)) return;
    stepsBound.add(node);
    node.addEventListener(type, fn);
  }
  App.initSteps = function () {
    /* 启动时初始化过一次就够了；但若 boot 里这一步抛错（安装版 WebView 环境更常见），
       进入步数页时 App.go 会再调一次，重试补上没绑成功的按钮 */
    if (stepsInited) return;
    /* 主页图标与设置页控件的事件在静态 HTML 里，直接绑定 */
    bindStepSettings();

    const syncBtn = el('#steps-sync-btn');
    bindOnce(syncBtn, 'click', function () {
      onActionClick(openSyncDialog);
    });
    const claimBtn = el('#steps-claim-btn');
    bindOnce(claimBtn, 'click', function () {
      onActionClick(doClaim);
    });
    const syncForm = el('#steps-sync-form');
    bindOnce(syncForm, 'submit', function (e) {
      e.preventDefault();
      const input = el('#steps-sync-input');
      const dlg = el('#steps-sync-dialog');
      doSync(input ? input.value : 0);
      if (dlg && dlg.open) dlg.close();
    });
    /* 应用内设置入口：打开步数设置底部弹窗 */
    const settingsBtn = el('#steps-settings-btn');
    bindOnce(settingsBtn, 'click', function () {
      if (App.renderStepSettings) App.renderStepSettings();
      const dlg = el('#steps-settings-dialog');
      if (dlg) { try { dlg.showModal(); } catch (e) {} }
    });

    /* 前端定时器：定期推进 TA 步数 + 刷新冷却倒计时 */
    if (!stepsTimer) stepsTimer = setInterval(function () {
      taTick();
      if (el('#view-steps') && el('#view-steps').classList.contains('is-active')) {
        App.renderSteps();
      } else {
        renderCooldownButtons();
      }
    }, 15000);
    stepsInited = true;
  };
})();
