/* 群聊：把多个角色拉进同一个群，模拟多人互动 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  const DEFAULT_SETTINGS = { linkProb: 5, muteCooldownMin: 5, adminMuteMin: 1, adminMuteMax: 10 };
  /* 管理员随机出手的概率（每次有人说话后判定一次） */
  const ADMIN_MUTE_CHANCE = 8;
  const MIN_GROUP_MEMBERS = 2;

  let currentGroupId = null;
  /* 每个群正在输入的成员：{ gid: { cid: count } } */
  const typingMembers = {};

  /* ---------------- 基础数据 ---------------- */
  function groups() { return App.state.groups; }
  function groupChats() { return App.state.groupChats; }
  function groupById(id) { return groups().find(function (g) { return g.id === id; }) || null; }
  function contactById(id) { return App.state.contacts.find(function (c) { return c.id === id; }) || null; }
  function chatOf(gid) { return groupChats()[gid] || (groupChats()[gid] = []); }

  function normalizeGroups() {
    const st = App.state;
    if (!Array.isArray(st.groups)) st.groups = [];
    if (!st.groupChats || typeof st.groupChats !== 'object') st.groupChats = {};
    st.groups.forEach(function (g) {
      if (!g || !g.id) return;
      if (!Array.isArray(g.members)) g.members = [];
      if (!Array.isArray(g.admins)) g.admins = [];
      if (!g.muted || typeof g.muted !== 'object') g.muted = {};
      if (!g.muteCd || typeof g.muteCd !== 'object') g.muteCd = {};
      if (!g.adminMute || typeof g.adminMute !== 'object') g.adminMute = {};
      g.settings = Object.assign({}, DEFAULT_SETTINGS, g.settings || {});
      g.members = g.members.filter(function (id) { return contactById(id); });
      g.admins = g.admins.filter(function (id) { return g.members.indexOf(id) !== -1; });
    });
  }

  function isMuted(g, cid) {
    const until = g.muted[cid];
    if (!until) return false;
    if (Date.now() >= until) {
      delete g.muted[cid];
      return false;
    }
    return true;
  }

  function muteLeftText(g, cid) {
    const until = g.muted[cid];
    if (!until || Date.now() >= until) return '';
    const min = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    return '禁言中 · 剩 ' + min + ' 分钟';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* ---------------- 九宫格群头像 ---------------- */
  function groupAvatarHtml(g, extraClass) {
    if (g.avatar) {
      return '<span class="grp-avatar-img' + (extraClass ? ' ' + extraClass : '') + '">' + App.avatarHtml(g.avatar) + '</span>';
    }
    const faces = g.members.slice(0, 9).map(function (cid) {
      const c = contactById(cid);
      return c ? c.avatar : '';
    });
    while (faces.length < 4) faces.push('');
    const cols = faces.length <= 4 ? 2 : 3;
    return '<span class="grp-avatar9 cols-' + cols + (extraClass ? ' ' + extraClass : '') + '">' +
      faces.map(function (f) { return '<i>' + App.avatarHtml(f) + '</i>'; }).join('') +
      '</span>';
  }

  /* ---------------- 群列表 ---------------- */
  function renderGroups() {
    normalizeGroups();
    const list = el('#groups-list');
    const empty = el('#groups-empty');
    if (!list) return;
    const gs = groups();
    if (empty) empty.hidden = gs.length > 0;
    list.innerHTML = gs.map(function (g) {
      const chat = chatOf(g.id);
      const last = chat[chat.length - 1];
      let preview = '群聊已建立';
      if (last) {
        const who = last.role === 'me' ? '我' : ((contactById(last.senderId) || {}).name || '成员');
        preview = who + '：' + App.messagePreview(last);
      }
      const unread = App.unread[g.id] || 0;
      return '<button type="button" class="groups-row" data-group-open="' + App.esc(g.id) + '">' +
        '<span class="groups-avatar">' + groupAvatarHtml(g) + '</span>' +
        '<span class="groups-copy">' +
          '<strong>' + App.esc(g.name || '未命名群') + '</strong>' +
          '<span>' + App.esc(preview.slice(0, 40)) + '</span>' +
        '</span>' +
        '<span class="groups-side">' +
          '<em>' + (last ? App.fmtTime(last.ts) : App.fmtTime(g.createdAt || Date.now())) + '</em>' +
          '<i>' + g.members.length + ' 人</i>' +
          (unread ? '<b>' + (unread > 99 ? '99+' : unread) + '</b>' : '') +
        '</span>' +
      '</button>';
    }).join('');
  }
  App.renderGroups = renderGroups;

  App.openGroupChat = function (gid) {
    if (!groupById(gid)) return;
    currentGroupId = gid;
    App.groupChatId = gid;
    delete App.unread[gid];
    App.updateBadges();
    App.go('group-chat');
  };

  /* ---------------- 群聊天渲染 ---------------- */
  function groupChatOpen(gid) {
    return currentGroupId === gid && el('#view-group-chat') && el('#view-group-chat').classList.contains('is-active');
  }
  App.groupChatOpen = groupChatOpen;

  function authorName(m) {
    if (m.role === 'me') return (App.state.profile && App.state.profile.userName) || '我';
    const c = contactById(m.senderId);
    return c ? c.name : '成员';
  }

  function systemLine(text) {
    return '<div class="grp-sysline">' + App.esc(text) + '</div>';
  }

  function groupMessageHtml(m) {
    if (m.type === 'sys') return systemLine(m.text);
    const mine = m.role === 'me';
    const c = mine ? null : contactById(m.senderId);
    const avatarSrc = mine ? (App.state.profile && App.state.profile.userAvatar) : (c && c.avatar);
    const author = mine ? '' : '<span class="grp-author">' + App.esc(authorName(m)) + '</span>';
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '" data-msg-id="' + App.esc(m.id) + '">' +
      '<div class="msg-main">' +
        '<div class="msg-content">' +
          '<div class="msg-side"><span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>' +
            '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
          '</div>' +
          '<div class="msg-bubble-hit">' + author +
            '<div class="bubble bubble-with-read"><span class="bubble-text">' + App.esc(m.text) + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function scrollGrpBottom() {
    const box = el('#grp-scroll');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function typingRowOf(cid, name) {
    return '<div class="typing-row grp-typing" data-typing="' + App.esc(cid) + '">' +
      '<span class="grp-typing-name">' + App.esc(name) + ' 正在输入…</span>' +
      '<div class="typing"><span></span><span></span><span></span></div>' +
    '</div>';
  }

  function syncTypingRows(gid) {
    if (!groupChatOpen(gid)) return;
    const list = el('#grp-list');
    if (!list) return;
    const states = typingMembers[gid] || {};
    list.querySelectorAll('.grp-typing').forEach(function (row) { row.remove(); });
    Object.keys(states).forEach(function (cid) {
      if (!states[cid]) return;
      const c = contactById(cid);
      if (c) list.insertAdjacentHTML('beforeend', typingRowOf(cid, c.name));
    });
    scrollGrpBottom();
  }

  function setMemberTyping(gid, cid, on) {
    const states = typingMembers[gid] || (typingMembers[gid] = {});
    const depth = states[cid] || 0;
    if (on) states[cid] = depth + 1;
    else if (depth > 0) states[cid] = depth - 1;
    if (!states[cid]) delete states[cid];
    syncTypingRows(gid);
  }

  function renderGroupChat() {
    normalizeGroups();
    const g = groupById(currentGroupId);
    if (!g) { App.go('groups'); return; }
    const nameEl = el('#grp-name');
    if (nameEl) nameEl.textContent = g.name || '未命名群';
    const note = el('#grp-members-note');
    if (note) note.textContent = g.members.length + ' 位成员' + (g.admins.length ? ' · 管理员 ' + g.admins.length : '');
    const headAvatar = el('#grp-head-avatar');
    if (headAvatar) headAvatar.innerHTML = groupAvatarHtml(g, 'grp-avatar-head');
    const list = el('#grp-list');
    if (list) {
      list.innerHTML = chatOf(g.id).map(groupMessageHtml).join('');
    }
    syncTypingRows(g.id);
    requestAnimationFrame(scrollGrpBottom);
    setTimeout(scrollGrpBottom, 160);
  }
  App.renderGroupChat = renderGroupChat;

  /* ---------------- 群设置 ---------------- */
  function renderGroupSettings() {
    normalizeGroups();
    const g = groupById(currentGroupId);
    if (!g) { App.go('groups'); return; }
    const nameInput = el('#grp-set-name');
    if (nameInput && document.activeElement !== nameInput) nameInput.value = g.name || '';
    const avatarBox = el('#grp-set-avatar');
    if (avatarBox) avatarBox.innerHTML = groupAvatarHtml(g, 'grp-avatar-setting');

    /* 成员列表 */
    const listBox = el('#grp-members-list');
    if (listBox) {
      listBox.innerHTML = g.members.map(function (cid) {
        const c = contactById(cid);
        if (!c) return '';
        const isAdmin = g.admins.indexOf(cid) !== -1;
        const muteText = muteLeftText(g, cid);
        return '<div class="grp-member-row">' +
          '<span class="avatar sm">' + App.avatarHtml(c.avatar) + '</span>' +
          '<span class="grp-member-copy">' +
            '<strong>' + App.esc(c.name) + '</strong>' +
            '<span>' + (isAdmin ? '<em class="grp-tag grp-tag-admin">管理员</em>' : '') +
              (muteText ? '<em class="grp-tag grp-tag-mute">' + App.esc(muteText) + '</em>' : '') +
            '</span>' +
          '</span>' +
          '<span class="grp-member-actions">' +
            '<button type="button" class="mini-btn" data-grp-admin="' + App.esc(cid) + '">' + (isAdmin ? '撤管理员' : '设为管理员') + '</button>' +
            (muteText
              ? '<button type="button" class="mini-btn" data-grp-unmute="' + App.esc(cid) + '">解除禁言</button>'
              : '<button type="button" class="mini-btn" data-grp-mute="' + App.esc(cid) + '">禁言</button>') +
          '</span>' +
        '</div>';
      }).join('');
    }

    /* 互动设置 */
    const linkInput = el('#grp-set-link');
    if (linkInput) linkInput.value = g.settings.linkProb;
    const cdInput = el('#grp-set-cd');
    if (cdInput) cdInput.value = g.settings.muteCooldownMin;

    /* 每位管理员的禁言时长 */
    const adminBox = el('#grp-admin-mute-list');
    if (adminBox) {
      if (!g.admins.length) {
        adminBox.innerHTML = '<p class="panel-note">还没有管理员，去「成员」里设置。</p>';
      } else {
        adminBox.innerHTML = g.admins.map(function (cid) {
          const c = contactById(cid);
          const range = g.adminMute[cid] || {};
          const lo = range.min != null ? range.min : g.settings.adminMuteMin;
          const hi = range.max != null ? range.max : g.settings.adminMuteMax;
          return '<div class="grp-admin-range">' +
            '<span class="grp-admin-range-name">' + App.esc(c ? c.name : '管理员') + '</span>' +
            '<span class="loc-zone-r-wrap">' +
              '<input type="number" min="1" max="1440" step="1" inputmode="numeric" data-grp-admin-mute-min="' + App.esc(cid) + '" value="' + App.esc(String(lo)) + '">~' +
              '<input type="number" min="1" max="1440" step="1" inputmode="numeric" data-grp-admin-mute-max="' + App.esc(cid) + '" value="' + App.esc(String(hi)) + '">分钟' +
            '</span>' +
          '</div>';
        }).join('');
      }
    }
  }
  App.renderGroupSettings = renderGroupSettings;

  /* ---------------- 消息与回复 ---------------- */
  function pushGroupMessage(gid, message) {
    const g = groupById(gid);
    if (!g) return;
    const chat = chatOf(gid);
    chat.push(message);
    App.save();
    if (groupChatOpen(gid)) {
      renderGroupChat();
    } else {
      App.unread[gid] = (App.unread[gid] || 0) + 1;
      App.updateBadges();
      if (el('#view-groups') && el('#view-groups').classList.contains('is-active')) renderGroups();
    }
  }

  function pushGroupSystem(gid, text) {
    pushGroupMessage(gid, {
      id: App.uid('gm'),
      role: 'sys',
      type: 'sys',
      text: text,
      ts: Date.now(),
    });
  }

  /* 管理员禁言群员：时长在各自区间里随机，禁完进入冷却 */
  function maybeAdminMute(g, gid, speakerCid) {
    const now = Date.now();
    const candidates = g.members.filter(function (cid) {
      return g.admins.indexOf(cid) === -1 && !isMuted(g, cid) && cid !== speakerCid;
    });
    if (!candidates.length) return;
    g.admins.slice().forEach(function (adminId) {
      const admin = contactById(adminId);
      if (!admin) return;
      const lastMute = g.muteCd[adminId] || 0;
      const cdMin = Math.max(0, Number(g.settings.muteCooldownMin) || 0);
      if (now - lastMute < cdMin * 60000) return;
      if (Math.random() * 100 >= ADMIN_MUTE_CHANCE) return;
      const range = g.adminMute[adminId] || {};
      const lo = Math.max(1, Number(range.min != null ? range.min : g.settings.adminMuteMin) || 1);
      const hi = Math.max(lo, Number(range.max != null ? range.max : g.settings.adminMuteMax) || lo);
      const minutes = randInt(lo, hi);
      const targetId = candidates[Math.floor(Math.random() * candidates.length)];
      const target = contactById(targetId);
      if (!target) return;
      g.muted[targetId] = now + minutes * 60000;
      g.muteCd[adminId] = now;
      App.save();
      pushGroupSystem(gid, '管理员「' + admin.name + '」将「' + target.name + '」禁言 ' + minutes + ' 分钟');
    });
  }

  /* 按成员自己的设置，从TA的字卡库里挑回复 */
  async function memberReply(gid, cid, userText, opts) {
    const g = groupById(gid);
    if (!g) return;
    const contact = contactById(cid);
    if (!contact || isMuted(g, cid)) return;
    const cs = App.contactSettings(contact);

    setMemberTyping(gid, cid, true);
    const fast = clamp(Number(cs.replyDelayMinSec) || 0, 0, 300);
    const slow = Math.max(fast, clamp(Number(cs.replyDelayMaxSec) || 0, 0, 300));
    await sleep((fast + Math.random() * (slow - fast)) * 1000);
    setMemberTyping(gid, cid, false);

    const gNow = groupById(gid);
    if (!gNow || gNow.members.indexOf(cid) === -1 || isMuted(gNow, cid)) return;

    /* 用TA自己的回复条数（群里收敛到最多 2 条，免得刷屏） */
    const lo = clamp(Number(cs.replyMin) || 1, 1, 2);
    const hi = Math.max(lo, clamp(Number(cs.replyMax) || 1, lo, 2));
    const take = randInt(lo, hi);
    let cards = App.pickCards(userText, take, cid, ['聊天', '语音']);
    cards = cards.filter(function (card) { return card && card.text; });
    if (!cards.length) return; /* 字卡库挑不出来就保持沉默 */

    for (let i = 0; i < cards.length; i++) {
      if (i > 0) {
        setMemberTyping(gid, cid, true);
        await sleep(700 + Math.random() * 900);
        setMemberTyping(gid, cid, false);
        if (!groupById(gid)) return;
      }
      const card = cards[i];
      const isVoice = card.category === '语音' && card.audio;
      pushGroupMessage(gid, {
        id: App.uid('gm'),
        role: 'ta',
        senderId: cid,
        type: isVoice ? 'text' : 'text',
        text: card.text,
        ts: Date.now(),
      });
      if (isVoice) {
        /* 群里发语音会顺手把语音内容当文字发出来，不真播音频 */
      }
    }

    /* 极低概率：另一个成员接着TA的话茬说一句 */
    const gAfter = groupById(gid);
    if (!gAfter) return;
    const linkProb = clamp(Number(gAfter.settings.linkProb) || 0, 0, 100);
    if (Math.random() * 100 < linkProb) {
      scheduleFollowCue(gid, cid);
    }

    /* 管理员可能禁言发言的人（非管理员才可能被禁） */
    if (gAfter.admins.indexOf(cid) === -1) {
      maybeAdminMute(gAfter, gid, cid);
    }
  }

  /* 接话茬：优先用「修罗场」分类（针对别人的话），没有就用普通聊天卡 */
  async function scheduleFollowCue(gid, fromCid) {
    await sleep(1800 + Math.random() * 3200);
    const g = groupById(gid);
    if (!g) return;
    const candidates = g.members.filter(function (cid) {
      return cid !== fromCid && !isMuted(g, cid);
    });
    if (!candidates.length) return;
    const cid = candidates[Math.floor(Math.random() * candidates.length)];
    const contact = contactById(cid);
    if (!contact) return;

    setMemberTyping(gid, cid, true);
    await sleep(1200 + Math.random() * 1800);
    setMemberTyping(gid, cid, false);

    const g2 = groupById(gid);
    if (!g2 || g2.members.indexOf(cid) === -1 || isMuted(g2, cid)) return;

    let cards = App.pickCards('', 1, cid, ['修罗场']);
    if (!cards || !cards.length) cards = App.pickCards('', 1, cid, ['聊天']);
    cards = (cards || []).filter(function (card) { return card && card.text; });
    if (!cards.length) return;
    pushGroupMessage(gid, {
      id: App.uid('gm'),
      role: 'ta',
      senderId: cid,
      type: 'text',
      text: cards[0].text,
      replyTo: fromCid,
      ts: Date.now(),
    });
  }

  /* 用户发消息后的总调度 */
  function scheduleGroupReplies(gid, text) {
    const g = groupById(gid);
    if (!g) return;

    /* @点名：被点到的必须回（被禁言的除外） */
    const mentioned = [];
    g.members.forEach(function (cid) {
      const c = contactById(cid);
      if (c && text.indexOf('@' + c.name) !== -1) mentioned.push(cid);
    });

    mentioned.forEach(function (cid) {
      if (isMuted(g, cid)) {
        const c = contactById(cid);
        pushGroupSystem(gid, '「' + (c ? c.name : '成员') + '」被禁言中，说不了话');
      }
    });

    /* 其他人组成随机池：挑 1~3 个接话，每个再按自己的「已读不回」概率保持沉默 */
    const pool = g.members.filter(function (cid) {
      return mentioned.indexOf(cid) === -1 && !isMuted(g, cid);
    });
    const want = pool.length ? randInt(1, Math.min(3, pool.length)) : 0;
    const shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });
    const chosen = shuffled.slice(0, want).filter(function (cid) {
      const c = contactById(cid);
      if (!c) return false;
      const cs = App.contactSettings(c);
      const ignoreProb = clamp(Number(cs.taIgnoreProb) || 0, 0, 100);
      return Math.random() * 100 >= ignoreProb;
    });

    const responders = mentioned.filter(function (cid) { return !isMuted(g, cid); }).concat(chosen);
    if (!responders.length) return; /* 没人想说话，真实的群也会冷场 */

    responders.forEach(function (cid) {
      memberReply(gid, cid, text);
    });

    /* 有人说话也可能让管理员看谁不顺眼 */
    if (g.admins.length && Math.random() * 100 < ADMIN_MUTE_CHANCE) {
      setTimeout(function () {
        const gNow = groupById(gid);
        if (gNow) maybeAdminMute(gNow, gid, null);
      }, 2500);
    }
  }

  /* ---------------- 发起群聊 ---------------- */
  function openCreateDialog() {
    const box = el('#group-create-members');
    if (!box) return;
    if (App.state.contacts.length < MIN_GROUP_MEMBERS) {
      App.toast('先在「联系人」里添加至少 ' + MIN_GROUP_MEMBERS + ' 个角色');
      return;
    }
    box.innerHTML = App.state.contacts.map(function (c) {
      return '<label class="grp-pick-row">' +
        '<span class="avatar sm">' + App.avatarHtml(c.avatar) + '</span>' +
        '<span class="grp-member-copy"><strong>' + App.esc(c.name) + '</strong></span>' +
        '<input type="checkbox" value="' + App.esc(c.id) + '">' +
      '</label>';
    }).join('');
    const nameInput = el('#group-create-name');
    if (nameInput) nameInput.value = '';
    const dialog = el('#group-create-dialog');
    if (dialog) dialog.showModal();
  }

  function createGroup(e) {
    e.preventDefault();
    const box = el('#group-create-members');
    const nameInput = el('#group-create-name');
    if (!box) return;
    const picked = Array.prototype.map.call(box.querySelectorAll('input:checked'), function (input) { return input.value; });
    if (picked.length < MIN_GROUP_MEMBERS) {
      App.toast('至少选择 ' + MIN_GROUP_MEMBERS + ' 个角色');
      return;
    }
    const name = String((nameInput && nameInput.value) || '').trim().slice(0, 20) || '我们的群';
    const group = {
      id: App.uid('g'),
      name: name,
      avatar: '',
      members: picked,
      admins: [],
      muted: {},
      muteCd: {},
      adminMute: {},
      settings: Object.assign({}, DEFAULT_SETTINGS),
      createdAt: Date.now(),
    };
    groups().unshift(group);
    App.save();
    const dialog = el('#group-create-dialog');
    if (dialog && dialog.open) dialog.close();
    pushGroupSystem(group.id, '你创建了「' + name + '」，' + picked.length + ' 位成员已进群');
    App.toast('群聊已创建');
    renderGroups();
    App.openGroupChat(group.id);
  }

  /* ---------------- 群聊输入 ---------------- */
  function sendGroupMessage(e) {
    e.preventDefault();
    const input = el('#grp-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (!currentGroupId || !groupById(currentGroupId)) return;
    input.value = '';
    input.style.height = '';
    pushGroupMessage(currentGroupId, {
      id: App.uid('gm'),
      role: 'me',
      type: 'text',
      text: text,
      ts: Date.now(),
    });
    scheduleGroupReplies(currentGroupId, text);
  }

  function openMentionSheet() {
    const g = groupById(currentGroupId);
    const box = el('#grp-mention-list');
    if (!g || !box) return;
    box.innerHTML = g.members.map(function (cid) {
      const c = contactById(cid);
      if (!c) return '';
      return '<button type="button" class="grp-pick-row" data-grp-mention="' + App.esc(cid) + '">' +
        '<span class="avatar sm">' + App.avatarHtml(c.avatar) + '</span>' +
        '<span class="grp-member-copy"><strong>' + App.esc(c.name) + '</strong>' +
        '<span>' + (isMuted(g, cid) ? '禁言中' : (g.admins.indexOf(cid) !== -1 ? '管理员' : '')) + '</span></span>' +
      '</button>';
    }).join('');
    const sheet = el('#grp-mention-sheet');
    if (sheet) sheet.hidden = false;
  }

  function insertMention(cid) {
    const c = contactById(cid);
    const input = el('#grp-input');
    const sheet = el('#grp-mention-sheet');
    if (sheet) sheet.hidden = true;
    if (!c || !input) return;
    const at = '@' + c.name + ' ';
    const pos = input.selectionStart != null ? input.selectionStart : input.value.length;
    input.value = input.value.slice(0, pos) + at + input.value.slice(pos);
    input.focus();
    const newPos = pos + at.length;
    try { input.setSelectionRange(newPos, newPos); } catch (err) {}
  }

  /* ---------------- 初始化 ---------------- */
  App.initGroups = function () {
    normalizeGroups();

    /* 列表页 */
    const createBtn = el('#btn-group-create');
    if (createBtn) createBtn.addEventListener('click', openCreateDialog);
    const createForm = el('#group-create-form');
    if (createForm) createForm.addEventListener('submit', createGroup);
    const groupsList = el('#groups-list');
    if (groupsList) groupsList.addEventListener('click', function (e) {
      const row = e.target.closest('[data-group-open]');
      if (row) App.openGroupChat(row.dataset.groupOpen);
    });

    /* 聊天页 */
    const composer = el('#grp-composer');
    if (composer) composer.addEventListener('submit', sendGroupMessage);
    const input = el('#grp-input');
    if (input) {
      input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(96, input.scrollHeight) + 'px';
      });
    }
    const atBtn = el('#grp-at-btn');
    if (atBtn) atBtn.addEventListener('click', openMentionSheet);
    const mentionList = el('#grp-mention-list');
    if (mentionList) mentionList.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-grp-mention]');
      if (btn) insertMention(btn.dataset.grpMention);
    });

    /* 设置页 */
    const nameInput = el('#grp-set-name');
    if (nameInput) nameInput.addEventListener('change', function () {
      const g = groupById(currentGroupId);
      if (!g) return;
      const value = nameInput.value.trim().slice(0, 20);
      if (value) {
        g.name = value;
        App.save();
        App.toast('群名已更新');
      } else {
        nameInput.value = g.name || '';
      }
    });
    const avatarFile = el('#grp-avatar-file');
    if (avatarFile) avatarFile.addEventListener('change', function () {
      const file = avatarFile.files && avatarFile.files[0];
      if (!file) return;
      const g = groupById(currentGroupId);
      if (!g) return;
      App.compressImage(file, 192).then(function (src) {
        g.avatar = src;
        App.save();
        renderGroupSettings();
        App.toast('群头像已更新');
      }).catch(function () {
        App.toast('这张图片读不出来，换一张试试');
      }).finally(function () {
        avatarFile.value = '';
      });
    });
    const avatarReset = el('#grp-avatar-reset');
    if (avatarReset) avatarReset.addEventListener('click', function () {
      const g = groupById(currentGroupId);
      if (!g) return;
      g.avatar = '';
      App.save();
      renderGroupSettings();
      App.toast('已恢复九宫格头像');
    });
    const linkInput = el('#grp-set-link');
    if (linkInput) linkInput.addEventListener('change', function () {
      const g = groupById(currentGroupId);
      if (!g) return;
      g.settings.linkProb = clamp(Math.round(Number(linkInput.value)), 0, 100);
      linkInput.value = g.settings.linkProb;
      App.save();
    });
    if (App.bindStepper) {
      App.bindStepper('#grp-set-link', function (v) {
        const g = groupById(currentGroupId);
        if (!g) return;
        g.settings.linkProb = v;
        App.save();
      }, { min: 0, max: 100 });
      App.bindStepper('#grp-set-cd', function (v) {
        const g = groupById(currentGroupId);
        if (!g) return;
        g.settings.muteCooldownMin = v;
        App.save();
      }, { min: 0, max: 1440 });
    }
    const cdInput = el('#grp-set-cd');
    if (cdInput) cdInput.addEventListener('change', function () {
      const g = groupById(currentGroupId);
      if (!g) return;
      g.settings.muteCooldownMin = clamp(Math.round(Number(cdInput.value) || 0), 0, 1440);
      cdInput.value = g.settings.muteCooldownMin;
      App.save();
    });
    const adminMuteBox = el('#grp-admin-mute-list');
    if (adminMuteBox) adminMuteBox.addEventListener('change', function (e) {
      const minInput = e.target.closest('[data-grp-admin-mute-min]');
      const maxInput = e.target.closest('[data-grp-admin-mute-max]');
      const g = groupById(currentGroupId);
      if (!g) return;
      if (minInput) {
        const cid = minInput.dataset.grpAdminMuteMin;
        const range = g.adminMute[cid] || (g.adminMute[cid] = {});
        const max = Math.max(1, Number(maxInput && maxInput.value) || range.max || g.settings.adminMuteMax || 10);
        range.min = clamp(Math.round(Number(minInput.value) || 1), 1, max);
        minInput.value = range.min;
        App.save();
      }
      if (maxInput) {
        const cid = maxInput.dataset.grpAdminMuteMax;
        const range = g.adminMute[cid] || (g.adminMute[cid] = {});
        const min = Math.max(1, Number(minInput && minInput.value) || range.min || g.settings.adminMuteMin || 1);
        range.max = clamp(Math.round(Number(maxInput.value) || min), min, 1440);
        maxInput.value = range.max;
        App.save();
      }
    });

    const membersBox = el('#grp-members-list');
    if (membersBox) membersBox.addEventListener('click', function (e) {
      const g = groupById(currentGroupId);
      if (!g) return;
      const adminBtn = e.target.closest('[data-grp-admin]');
      if (adminBtn) {
        const cid = adminBtn.dataset.grpAdmin;
        const admin = contactById(cid);
        if (!admin) return;
        const index = g.admins.indexOf(cid);
        if (index === -1) {
          g.admins.push(cid);
          pushGroupSystem(g.id, '「' + admin.name + '」成为管理员');
        } else {
          g.admins.splice(index, 1);
          delete g.adminMute[cid];
          delete g.muteCd[cid];
          pushGroupSystem(g.id, '「' + admin.name + '」的管理员已撤销');
        }
        App.save();
        renderGroupSettings();
        return;
      }
      const muteBtn = e.target.closest('[data-grp-mute]');
      if (muteBtn) {
        const cid = muteBtn.dataset.grpMute;
        const c = contactById(cid);
        if (!c) return;
        const minutes = randInt(
          Math.max(1, Number(g.settings.adminMuteMin) || 1),
          Math.max(1, Number(g.settings.adminMuteMax) || 10)
        );
        g.muted[cid] = Date.now() + minutes * 60000;
        App.save();
        pushGroupSystem(g.id, '群主将「' + c.name + '」禁言 ' + minutes + ' 分钟');
        renderGroupSettings();
        return;
      }
      const unmuteBtn = e.target.closest('[data-grp-unmute]');
      if (unmuteBtn) {
        const cid = unmuteBtn.dataset.grpUnmute;
        const c = contactById(cid);
        if (!c) return;
        delete g.muted[cid];
        App.save();
        pushGroupSystem(g.id, '「' + c.name + '」的禁言已解除');
        renderGroupSettings();
        return;
      }
    });

    const deleteBtn = el('#grp-set-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      const g = groupById(currentGroupId);
      if (!g) return;
      App.confirmDialog('解散「' + (g.name || '这个群') + '」？聊天记录会一起删掉，无法恢复。', {
        title: '解散群聊',
        okText: '解散',
      }).then(function (ok) {
        if (!ok) return;
        const id = g.id;
        App.state.groups = groups().filter(function (item) { return item.id !== id; });
        delete groupChats()[id];
        delete App.unread[id];
        currentGroupId = null;
        App.groupChatId = null;
        App.save();
        App.updateBadges();
        App.toast('群聊已解散');
        App.go('groups');
      });
    });

    /* 资源里的全局路由交给 app.js，这里补一个群消息角标渲染 */
    App.renderGroupsBadge = function () {
      if (el('#view-groups') && el('#view-groups').classList.contains('is-active')) renderGroups();
    };
  };
})();
