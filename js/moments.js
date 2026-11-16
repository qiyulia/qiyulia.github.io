/* 本机朋友圈：我和 TA 都能发动态、点赞、评论 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  /* 朋友圈角标：TA 在上次查看之后新发的动态数 */
  App.momentsUnreadCount = function () {
    const seen = Number(App.state.momentsSeenTs) || 0;
    return (App.state.moments || []).filter(function (m) {
      return m && m.role !== 'me' && Number(m.ts) > seen;
    }).length;
  };

  App.updateMomentsBadge = function () {
    const badge = document.getElementById('d-badge-moments');
    if (!badge) return;
    const unread = App.momentsUnreadCount();
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  };

  /* 进入朋友圈即视为看过当前所有动态，退出后角标重新从 0 开始算 */
  App.markMomentsSeen = function () {
    App.state.momentsSeenTs = Date.now();
    App.save();
    App.updateMomentsBadge();
  };

  // TA 取当前角色
  function taContact() {
    const contacts = App.state.contacts || [];
    const current = contacts.find(function (c) { return c.id === App.state.currentContactId; });
    const found = current || contacts[0];
    return found || { name: 'TA', avatar: App.DEFAULT_AVATAR };
  }

  function contactOf(id) {
    const found = (App.state.contacts || []).find(function (c) { return c.id === id; });
    return found || null;
  }

  function isMine(moment) {
    return !moment.role || moment.role === 'me';
  }

  // 抽一张字卡用作 TA 的评论/动态文案
  function pickCardForMoment(categories) {
    const cats = categories || ['聊天'];
    const enabled = (App.state.cards || []).filter(function (c) {
      return c.enabled && c.text && cats.indexOf(c.category) !== -1;
    });
    if (!enabled.length) return null;
    return enabled[Math.floor(Math.random() * enabled.length)];
  }

  /* TA 发朋友圈时可以用的颜文字 */
  const EMOTICONS = [
    '(｡･ω･｡)ﾉ♡', '(๑•́ ₃ •̀๑)', '( ´ ▽ ` )ﾉ', '(>_<)', '(￣▽￣)~*',
    '(๑´ㅂ`๑)', '(*/ω＼*)', '(·•᷄ࡇ•᷅ )', 'ヽ(✿ﾟ▽ﾟ)ノ', '(っ˘ω˘ς )',
  ];

  function pickMomentSticker() {
    const st = App.state.stickers || {};
    const pool = (st.ta || []).concat(st.public || []);
    if (!pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* 一条 TA 朋友圈：字卡 + 颜文字，偶尔配一张表情包 */
  function taMomentContent(contact, cs) {
    const min = Math.max(1, Math.min(9, Number(cs.taMomentCardMin) || 1));
    const max = Math.max(min, Math.min(9, Number(cs.taMomentCardMax) || min));
    const n = min + Math.floor(Math.random() * (max - min + 1));
    const parts = [];
    const used = {};
    for (let i = 0; i < n; i++) {
      const card = pickCardForMoment(['聊天', '情绪']);
      if (!card) break;
      if (used[card.id]) continue;
      used[card.id] = true;
      parts.push(card.text);
    }
    /* 偶尔用颜文字收尾，让动态更像随手发的 */
    if (Math.random() < 0.45 || !parts.length) {
      parts.push(EMOTICONS[Math.floor(Math.random() * EMOTICONS.length)]);
    }
    const sticker = Math.random() < 0.3 ? pickMomentSticker() : '';
    return { text: parts.join('\n'), sticker: sticker };
  }

  App.renderMoments = function () {
    if (!Array.isArray(App.state.moments)) App.state.moments = [];
    const profile = App.state.profile;
    const ta = taContact();
    el('#m-avatar').innerHTML = App.avatarHtml(profile.userAvatar);

    /* 顶部封面：选了相册图片就用图片，没有就保持默认渐变 */
    const hero = el('#moments-hero');
    if (hero) {
      const cover = App.state.momentsCover || '';
      hero.classList.toggle('has-cover', !!cover);
      hero.style.backgroundImage = cover ? 'url("' + cover + '")' : '';
    }

    const moments = App.state.moments.slice().sort(function (a, b) { return b.ts - a.ts; });
    el('#moment-empty').hidden = moments.length > 0;
    el('#moment-list').innerHTML = moments.map(function (moment) {
      const id = App.esc(moment.id);
      const mine = isMine(moment);
      const owner = mine ? null : (contactOf(moment.contactId) || ta);
      const name = mine ? (profile.userName || '我') : owner.name;
      const avatar = mine ? (profile.userAvatar || App.DEFAULT_AVATAR) : (owner.avatar || App.DEFAULT_AVATAR);

      // 点赞行：用户点赞 + 联系人点赞（联系人只在意我发的动态）
      const likeParts = [];
      if (moment.liked) likeParts.push('我');
      const taLikNames = [];
      if (isMine(moment)) {
        if (moment.likedByTa) taLikNames.push(moment.likedByTaName || ta.name);
        if (Array.isArray(moment.likedByTaList)) {
          moment.likedByTaList.forEach(function (item) {
            if (!item) return;
            const liker = contactOf(item.contactId) || ta;
            const likName = item.name || liker.name;
            if (taLikNames.indexOf(likName) === -1) taLikNames.push(likName);
          });
        }
      }
      if (taLikNames.length) likeParts.push(taLikNames.map(function (n) { return App.esc(n); }).join('、'));
      const likeLine = likeParts.length
        ? '<div class="moment-likes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg><span>' + likeParts.join('、') + ' 觉得很赞</span></div>'
        : '';

      // 评论列表
      const comments = Array.isArray(moment.comments) ? moment.comments : [];
      const commentHtml = comments.map(function (cm) {
        const cName = cm.role === 'me'
          ? (profile.userName || '我')
          : (contactOf(cm.contactId) || ta).name;
        return '<div class="moment-comment">' +
          '<span class="moment-comment-text"><strong>' + App.esc(cName) + '</strong>：' + App.esc(cm.text) + '</span>' +
          '<button type="button" class="comment-like' + (cm.likedByMe ? ' is-active' : '') + '" data-comment-like="' + id + ':' + App.esc(cm.id) + '" aria-label="点赞评论">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
          '</button>' +
        '</div>';
      }).join('');

      // 操作栏
      const actions = [];
      actions.push('<button type="button" class="moment-action moment-like' + (moment.liked ? ' is-active' : '') + '" data-moment-like="' + id + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
        '<span>' + (moment.liked ? '已喜欢' : '喜欢') + '</span>' +
      '</button>');
      actions.push('<button type="button" class="moment-action moment-fav' + (moment.fav ? ' is-active' : '') + '" data-moment-fav="' + id + '">' +
        '<span>' + (moment.fav ? '★ 已收藏' : '☆ 收藏') + '</span>' +
      '</button>');
      actions.push('<button type="button" class="moment-action" data-moment-comment="' + id + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span>评论</span>' +
      '</button>');
      if (mine) {
        actions.push('<button type="button" class="moment-action moment-delete" data-moment-delete="' + id + '">删除</button>');
      }

      const commentForm = '<form class="moment-comment-form" data-comment-form="' + id + '" hidden>' +
        '<input type="text" maxlength="120" placeholder="说点什么…" aria-label="评论内容">' +
        '<button type="submit" class="btn primary">发送</button>' +
      '</form>';

      return '<article class="moment-card' + (mine ? '' : ' moment-ta') + '">' +
        '<div class="moment-card-head">' +
          '<span class="avatar">' + App.avatarHtml(avatar) + '</span>' +
          '<strong>' + App.esc(name) + '</strong>' +
        '</div>' +
        (moment.text ? '<p class="moment-card-text">' + App.esc(moment.text) + '</p>' : '') +
        (moment.sticker ? '<div class="moment-sticker"><img loading="lazy" decoding="async" src="' + App.esc(moment.sticker) + '" alt="表情包"></div>' : '') +
        likeLine +
        (commentHtml ? '<div class="moment-comments">' + commentHtml + '</div>' : '') +
        commentForm +
        '<div class="moment-card-foot">' +
          '<time class="moment-time">' + App.fmtDate(new Date(moment.ts)) + ' · ' + App.fmtTime(moment.ts) + '</time>' +
          actions.join('') +
        '</div>' +
      '</article>';
    }).join('');
  };

  // 用户发动态后，每个联系人都可能点赞 + 评论
  function scheduleTaReact(momentId) {
    const contacts = (App.state.contacts || []).slice();
    contacts.forEach(function (contact, index) {
      const cs = App.contactSettings(contact);
      const likeProb = Math.max(0, Math.min(100, Number(cs.taLikeProb) || 0));
      const commentProb = Math.max(0, Math.min(100, Number(cs.taCommentProb) || 0));
      const likeDelay = 3000 + index * 1200 + Math.random() * 5000;

      setTimeout(function () {
        const moment = App.state.moments.find(function (m) { return m.id === momentId; });
        if (!moment || !isMine(moment)) return;
        if (Math.random() * 100 >= likeProb) return;
        if (!Array.isArray(moment.likedByTaList)) moment.likedByTaList = [];
        const already = moment.likedByTaList.some(function (item) { return item && item.contactId === contact.id; });
        if (already) return;
        moment.likedByTaList.push({ contactId: contact.id, name: contact.name });
        App.save();
        App.renderMoments();
      }, likeDelay);

      if (commentProb > 0) {
        const commentDelay = likeDelay + 2500 + Math.random() * 5000;
        setTimeout(function () {
          const moment = App.state.moments.find(function (m) { return m.id === momentId; });
          if (!moment || !isMine(moment)) return;
          if (Math.random() * 100 >= commentProb) return;
          const card = pickCardForMoment();
          if (!card) return;
          if (!Array.isArray(moment.comments)) moment.comments = [];
          moment.comments.push({
            id: App.uid('mc'),
            role: 'ta',
            contactId: contact.id,
            text: card.text,
            ts: Date.now(),
          });
          App.save();
          App.renderMoments();
        }, commentDelay);
      }
    });
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* 单个联系人按概率、每日上限和间隔决定要不要发一条朋友圈 */
  function maybeContactPosts(contact, now) {
    const cs = App.contactSettings(contact);
    const own = App.state.moments.filter(function (m) {
      return !isMine(m) && m.contactId === contact.id;
    });

    const dailyMax = Math.max(1, Math.min(20, Number(cs.taMomentDailyMax) || 1));
    const today = dayKey(now);
    const todayCount = own.filter(function (m) { return dayKey(m.ts) === today; }).length;
    if (todayCount >= dailyMax) return false;

    const gapMin = Math.max(0, Number(cs.taMomentGapMin) || 0) * 60000;
    const gapMax = Math.max(gapMin, (Number(cs.taMomentGapMax) || 0) * 60000);
    /* 冷却时间：同一个联系人两次朋友圈之间至少要隔这么久 */
    const cooldown = Math.max(gapMin, (Number(cs.taMomentCooldownMin) || 0) * 60000);
    const last = own.length ? own.reduce(function (a, b) { return a.ts > b.ts ? a : b; }) : null;
    const elapsed = last ? now - last.ts : gapMin;

    if (last && elapsed < cooldown) return false;
    const mustPost = !!last && elapsed >= gapMax;
    if (!mustPost && Math.random() * 100 >= Math.max(0, Math.min(100, Number(cs.taMomentProb) || 0))) return false;

    const content = taMomentContent(contact, cs);
    if (!content.text && !content.sticker) return false;

    App.state.moments.unshift({
      id: App.uid('m'),
      role: 'ta',
      contactId: contact.id,
      text: content.text,
      sticker: content.sticker,
      ts: now,
      liked: false,
      likedByTa: false,
      likedByTaList: [],
      comments: [],
    });
    return true;
  }

  /* 所有联系人都可能发朋友圈，各按自己的设置走 */
  App.maybeTaPosts = function () {
    const now = Date.now();
    let posted = false;
    (App.state.contacts || []).forEach(function (contact) {
      if (maybeContactPosts(contact, now)) posted = true;
    });
    if (!posted) return false;
    /* 正在看朋友圈时新动态当场就看到了，不算未读 */
    const viewing = el('#view-moments').classList.contains('is-active');
    if (viewing) App.state.momentsSeenTs = now;
    App.save();
    if (App.updateMomentsBadge) App.updateMomentsBadge();
    if (viewing) App.renderMoments();
    return true;
  };

  App.initMoments = function () {
    const form = el('#moment-form');
    const input = el('#moment-input');
    const dialog = el('#moment-dialog');

    input.addEventListener('input', function () {
      el('#moment-count').textContent = input.value.length + ' / 300';
    });

    el('#moment-open').addEventListener('click', function () {
      if (!dialog) return;
      dialog.showModal();
      setTimeout(function () { input.focus(); }, 60);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      const moment = {
        id: App.uid('m'),
        role: 'me',
        text: text,
        ts: Date.now(),
        liked: false,
        likedByTa: false,
        comments: [],
      };
      App.state.moments.unshift(moment);
      App.save();
      form.reset();
      el('#moment-count').textContent = '0 / 300';
      if (dialog && dialog.open) dialog.close();
      App.renderMoments();
      App.toast('动态已发布');
      scheduleTaReact(moment.id);
    });

    /* 顶部封面可以换成相册里的图 */
    const coverBtn = el('#moments-cover-btn');
    const coverInput = el('#moments-cover-input');
    if (coverBtn && coverInput) {
      coverBtn.addEventListener('click', function () { coverInput.click(); });
      coverInput.addEventListener('change', function () {
        const file = coverInput.files && coverInput.files[0];
        coverInput.value = '';
        if (!file) return;
        if (!App.compressImage) return;
        App.toast('正在处理封面…');
        App.compressImage(file, 1200, { quality: 0.82, maxLength: 420000 }).then(function (url) {
          App.state.momentsCover = url;
          App.save();
          App.renderMoments();
          App.toast('封面已更换，点「换封面」可以再改');
        }).catch(function () {
          App.toast('这张图读取失败了');
        });
      });
    }

    el('#moment-list').addEventListener('click', function (e) {
      const commentLike = e.target.closest('[data-comment-like]');
      if (commentLike) {
        const parts = commentLike.dataset.commentLike.split(':');
        const moment = App.state.moments.find(function (item) { return item.id === parts[0]; });
        const cm = moment && (moment.comments || []).find(function (c) { return c.id === parts[1]; });
        if (cm) {
          cm.likedByMe = !cm.likedByMe;
          App.save();
          App.renderMoments();
        }
        return;
      }

      const commentToggle = e.target.closest('[data-moment-comment]');
      if (commentToggle) {
        const form = el('[data-comment-form="' + commentToggle.dataset.momentComment + '"]');
        if (form) {
          form.hidden = !form.hidden;
          if (!form.hidden) form.querySelector('input').focus();
        }
        return;
      }

      const fav = e.target.closest('[data-moment-fav]');
      if (fav) {
        const moment = App.state.moments.find(function (item) { return item.id === fav.dataset.momentFav; });
        if (moment) {
          moment.fav = !moment.fav;
          App.save();
          App.renderMoments();
          App.toast(moment.fav ? '已收藏这条朋友圈' : '已取消收藏');
        }
        return;
      }

      const like = e.target.closest('[data-moment-like]');
      if (like) {
        const moment = App.state.moments.find(function (item) { return item.id === like.dataset.momentLike; });
        if (moment) {
          moment.liked = !moment.liked;
          App.save();
          App.renderMoments();
        }
        return;
      }

      const remove = e.target.closest('[data-moment-delete]');
      if (remove) {
        const momentId = remove.dataset.momentDelete;
        App.confirmDialog('删除这条动态？删除后无法恢复。', { title: '删除动态', okText: '删除' }).then(function (ok) {
          if (!ok) return;
          App.state.moments = App.state.moments.filter(function (item) { return item.id !== momentId; });
          App.save();
          App.renderMoments();
          App.toast('动态已删除');
        });
      }
    });

    // 我评论任意一条动态（含 TA 的）
    el('#moment-list').addEventListener('submit', function (e) {
      const commentForm = e.target.closest('[data-comment-form]');
      if (!commentForm) return;
      e.preventDefault();
      const field = commentForm.querySelector('input');
      const text = field.value.trim();
      if (!text) return;
      const moment = App.state.moments.find(function (item) { return item.id === commentForm.dataset.commentForm; });
      if (!moment) return;
      if (!Array.isArray(moment.comments)) moment.comments = [];
      moment.comments.push({
        id: App.uid('mc'),
        role: 'me',
        text: text,
        ts: Date.now(),
        likedByMe: false,
      });
      App.save();
      App.renderMoments();
      const reopened = el('[data-comment-form="' + moment.id + '"]');
      if (reopened) reopened.hidden = false;
    });

    /* 每分钟检查一次 TA 是否要发朋友圈 */
    setInterval(function () {
      if (!document.hidden) App.maybeTaPosts();
    }, 60000);
  };
})();
