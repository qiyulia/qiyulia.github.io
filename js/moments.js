/* 本机朋友圈：我和 TA 都能发动态、点赞、评论 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  // TA 取当前角色
  function taContact() {
    const contacts = App.state.contacts || [];
    const current = contacts.find(function (c) { return c.id === App.state.currentContactId; });
    const found = current || contacts[0];
    return found || { name: 'TA', avatar: '🌙' };
  }

  function contactOf(id) {
    const found = (App.state.contacts || []).find(function (c) { return c.id === id; });
    return found || null;
  }

  function isMine(moment) {
    return !moment.role || moment.role === 'me';
  }

  // 抽一张「聊天」字卡用作 TA 的评论/动态文案
  function pickCardForMoment() {
    const enabled = (App.state.cards || []).filter(function (c) {
      return c.enabled && c.text && c.category === '聊天';
    });
    if (!enabled.length) return null;
    return enabled[Math.floor(Math.random() * enabled.length)];
  }

  function taMomentText(contact) {
    const cs = App.contactSettings(contact);
    const n = Math.max(1, Math.min(3, Number(cs.taMomentCards) || 1));
    const parts = [];
    const used = {};
    for (let i = 0; i < n; i++) {
      const card = pickCardForMoment();
      if (!card) break;
      if (used[card.id]) continue;
      used[card.id] = true;
      parts.push(card.text);
    }
    if (!parts.length) {
      const fallback = pickCardForMoment();
      if (fallback) parts.push(fallback.text);
    }
    return parts.join('\n');
  }

  App.renderMoments = function () {
    if (!Array.isArray(App.state.moments)) App.state.moments = [];
    const profile = App.state.profile;
    const ta = taContact();
    el('#m-avatar').innerHTML = App.avatarHtml(profile.userAvatar);

    const moments = App.state.moments.slice().sort(function (a, b) { return b.ts - a.ts; });
    el('#moment-empty').hidden = moments.length > 0;
    el('#moment-list').innerHTML = moments.map(function (moment) {
      const id = App.esc(moment.id);
      const mine = isMine(moment);
      const owner = mine ? null : (contactOf(moment.contactId) || ta);
      const name = mine ? (profile.userName || '我') : owner.name;
      const avatar = mine ? (profile.userAvatar || '🍊') : (owner.avatar || '🌙');

      // 点赞行：用户点赞 + TA 点赞
      const likeParts = [];
      if (moment.liked) likeParts.push('我');
      if (moment.likedByTa) likeParts.push(App.esc(moment.likedByTaName || ta.name));
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
        '<p class="moment-card-text">' + App.esc(moment.text) + '</p>' +
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

  // 用户发动态后，TA 可能点赞 + 评论
  function scheduleTaReact(momentId) {
    const contact = taContact();
    const cs = App.contactSettings(contact);
    const likeProb = Math.max(0, Math.min(100, Number(cs.taLikeProb) || 0));
    const commentProb = Math.max(0, Math.min(100, Number(cs.taCommentProb) || 0));

    const likeDelay = 3000 + Math.random() * 5000;
    setTimeout(function () {
      const moment = App.state.moments.find(function (m) { return m.id === momentId; });
      if (!moment || !isMine(moment)) return;
      if (Math.random() * 100 < likeProb) {
        moment.likedByTa = true;
        moment.likedByTaName = contact.name;
        App.save();
        App.renderMoments();
      }
    }, likeDelay);

    if (commentProb > 0) {
      const commentDelay = likeDelay + 3000 + Math.random() * 5000;
      setTimeout(function () {
        const moment = App.state.moments.find(function (m) { return m.id === momentId; });
        if (!moment || !isMine(moment)) return;
        if (Math.random() * 100 < commentProb) {
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
        }
      }, commentDelay);
    }
  }

  // 打开朋友圈时，TA 可能新发一条动态
  App.maybeTaPosts = function () {
    const now = Date.now();
    const taMoments = App.state.moments.filter(function (m) { return !isMine(m); });
    const lastTa = taMoments.length ? taMoments.reduce(function (a, b) { return a.ts > b.ts ? a : b; }) : null;
    const minGap = 10 * 60 * 1000; // 至少间隔 10 分钟才可能再发

    if (lastTa && (now - lastTa.ts) < minGap) return;

    // 有 60% 概率发一条
    if (Math.random() > 0.6) return;

    const contact = taContact();
    const text = taMomentText(contact);
    if (!text) return;
    App.state.moments.unshift({
      id: App.uid('m'),
      role: 'ta',
      contactId: contact.id,
      text: text,
      ts: now,
      liked: false,
      likedByTa: false,
      comments: [],
    });
    App.save();
  };

  App.initMoments = function () {
    const form = el('#moment-form');
    const input = el('#moment-input');

    input.addEventListener('input', function () {
      el('#moment-count').textContent = input.value.length + ' / 300';
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
      App.renderMoments();
      App.toast('动态已发布');
      scheduleTaReact(moment.id);
    });

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
      if (remove && confirm('删除这条动态？')) {
        App.state.moments = App.state.moments.filter(function (item) { return item.id !== remove.dataset.momentDelete; });
        App.save();
        App.renderMoments();
        App.toast('动态已删除');
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
  };
})();
