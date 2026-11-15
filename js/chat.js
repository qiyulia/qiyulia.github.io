/* 聊天与字卡触发回复 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  if (App.sendAs == null) App.sendAs = 'me';
  if (App.stickerTab == null) App.stickerTab = 'me';
  if (App.panelKind == null) App.panelKind = 'sticker';

  let quoteDraft = null;
  let actionMsgId = null;
  let callState = null;
  let callDrag = null;
  let suppressCallClick = false;
  const readTimers = {};
  const decisionTimers = {};
  let chatImageDraft = '';

  function sendRole() {
    return App.stickerTab === 'ta' ? 'ta' : 'me';
  }

  function currentContact() {
    return App.state.contacts.find(function (c) { return c.id === App.chatContactId; });
  }

  /* 聊天视图真正处于前台时，收到的消息才算已读 */
  App.chatOpen = function (contactId) {
    const view = document.getElementById('view-chat');
    return App.chatContactId === contactId && !!view && view.classList.contains('is-active');
  };

  App.openChat = function (contactId) {
    const exists = App.state.contacts.some(function (c) { return c.id === contactId; });
    if (!exists) return;
    if (App.chatContactId !== contactId) {
      quoteDraft = null;
      closeMsgActions();
      stopVoice();
    }
    App.chatContactId = contactId;
    App.state.currentContactId = contactId;
    App.unread[contactId] = 0;
    /* 点进聊天，TA 发来的消息立即全部标为已读 */
    (App.state.chats[contactId] || []).forEach(function (m) {
      if (m.role === 'ta') m.read = true;
    });
    App.save();
    closeStickerPanel();
    App.renderChat();
    App.renderContacts();
    App.updateBadges();
    App.go('chat');
  };

  App.renderChat = function () {
    const id = App.chatContactId;
    const contact = currentContact();
    if (!contact) return;

    el('#c-avatar').innerHTML = App.avatarHtml(contact.avatar);
    el('#c-name').textContent = contact.name;
    el('#c-note').textContent = contact.note || '字卡传讯';

    const chat = App.state.chats[id] || [];
    const now = Date.now();
    const open = App.chatOpen(id);
    chat.forEach(function (m) {
      if (m.read === undefined) {
        /* 我发出的消息由 TA 稍后已读；TA 的消息只有聊天开着时才算已读 */
        m.read = m.role === 'me' ? now - m.ts > 2400 : open;
      }
      /* 只有我的消息需要模拟「TA 两秒后已读」 */
      if (m.role === 'me' && !m.read) scheduleRead(id, m);
      if ((m.type === 'redpacket' || m.type === 'gift') && m.role === 'me' && m.status === 'pending') {
        scheduleTaDecision(id, m);
      }
      if (m.type === 'wish' && m.role === 'me' && m.status === 'pending' && !m.decided) {
        scheduleWishDecision(id, m);
      }
    });
    const list = el('#chat-list');
    /* 重绘前记住已经在屏上的消息，重绘后让它们不再播放入场动画，避免整屏闪一下 */
    const seen = {};
    Array.prototype.forEach.call(list.querySelectorAll('[data-msg-id]'), function (node) {
      seen[node.getAttribute('data-msg-id')] = true;
    });
    list.innerHTML = chat.length
      ? chat.map(messageHtml).join('')
      : '<p class="chat-empty">还没有消息，先说一句吧。</p>';
    Array.prototype.forEach.call(list.querySelectorAll('.msg[data-msg-id]'), function (node) {
      if (seen[node.getAttribute('data-msg-id')]) node.classList.add('is-static');
    });
    bindVoiceBubbles(list);
    /* 回到聊天时，如果 TA 还在打字，把三个点补回来 */
    if (typingAllowed(id)) list.appendChild(typingRow());
    updateSideButtons();
    renderStickerPanel();
    renderComposerQuote();
    scrollBottom(true);
    requestAnimationFrame(function () { scrollBottom(true); });
  };

  /* 微信式语音气泡：只用一个播放器，列表重绘、来新消息都不会打断 */
  function voiceBubbleWidth(seconds) {
    return Math.round(74 + Math.min(seconds, 30) * 3.6);
  }

  const voicePlayer = new Audio();
  voicePlayer.preload = 'metadata';
  let voicePlayingId = '';
  const voiceDurations = {};
  const voiceUrls = {};

  function voiceRefKey(ref) {
    const value = String(ref || '');
    return value.length + ':' + value.slice(-40);
  }

  function resolveVoiceUrl(ref) {
    const value = String(ref || '');
    const key = voiceRefKey(value);
    if (voiceUrls[key]) return Promise.resolve(voiceUrls[key]);
    if (!App.voiceSrc || value.indexOf('data:') === 0) return Promise.resolve(value);
    return App.voiceSrc(value).then(function (url) {
      if (url) voiceUrls[key] = url;
      return url || '';
    });
  }

  function paintVoiceBubble(bubble) {
    if (!bubble) return;
    const btn = bubble.querySelector('.voice-bubble');
    const label = bubble.querySelector('.voice-dur');
    if (!btn || !label) return;
    const wrap = bubble.closest('[data-msg-id]');
    const id = wrap ? wrap.dataset.msgId : '';
    btn.classList.toggle('is-playing', !!voicePlayingId && id === voicePlayingId);
    const seconds = voiceDurations[voiceRefKey(bubble.dataset.voiceRef)];
    if (seconds) {
      label.textContent = seconds + '″';
      btn.style.width = voiceBubbleWidth(seconds) + 'px';
    }
  }

  function paintVoiceBubbles() {
    document.querySelectorAll('#chat-list .bubble-audio').forEach(paintVoiceBubble);
  }

  function stopVoice() {
    voicePlayingId = '';
    try { voicePlayer.pause(); } catch (e) {}
    paintVoiceBubbles();
  }

  voicePlayer.addEventListener('play', paintVoiceBubbles);
  voicePlayer.addEventListener('pause', paintVoiceBubbles);
  voicePlayer.addEventListener('ended', function () {
    voicePlayingId = '';
    paintVoiceBubbles();
  });

  function bindVoiceBubbles(root) {
    root.querySelectorAll('.bubble-audio').forEach(function (bubble) {
      const btn = bubble.querySelector('.voice-bubble');
      if (!btn) return;
      paintVoiceBubble(bubble);
      const ref = bubble.dataset.voiceRef || '';
      const key = voiceRefKey(ref);
      if (!bubble.dataset.voiceReady) {
        bubble.dataset.voiceReady = '1';
        resolveVoiceUrl(ref).then(function (url) {
          if (!url || voiceDurations[key]) return;
          const probe = new Audio();
          probe.preload = 'metadata';
          probe.addEventListener('loadedmetadata', function () {
            if (!isFinite(probe.duration) || probe.duration <= 0) return;
            voiceDurations[key] = Math.max(1, Math.round(probe.duration));
            paintVoiceBubbles();
          });
          probe.src = url;
        });
      }
      btn.addEventListener('click', function () {
        const wrap = btn.closest('[data-msg-id]');
        const id = wrap ? wrap.dataset.msgId : '';
        if (!id) return;
        if (voicePlayingId === id) {
          stopVoice();
          return;
        }
        resolveVoiceUrl(ref).then(function (url) {
          if (!url) {
            App.toast('这段语音暂时无法播放');
            return;
          }
          voicePlayingId = id;
          if (voicePlayer.src !== url) voicePlayer.src = url;
          try { voicePlayer.currentTime = 0; } catch (e) {}
          voicePlayer.play().catch(function () {
            voicePlayingId = '';
            paintVoiceBubbles();
          });
          paintVoiceBubbles();
        });
      });
    });
  }

  function readChip(m) {
    const label = m.read ? (m.noReply ? '已读不回' : '已读') : '未读';
    return '<span class="msg-read' + (m.read ? ' is-read' : '') + (m.noReply ? ' is-noreply' : '') + '">' + label + '</span>';
  }

  /* 我发出的消息约两秒后变成已读 */
  function scheduleRead(contactId, message) {
    if (message.noReply) return;
    if (readTimers[message.id]) return;
    readTimers[message.id] = setTimeout(function () {
      delete readTimers[message.id];
      const target = (App.state.chats[contactId] || []).find(function (m) { return m.id === message.id; });
      if (!target || target.read) return;
      target.read = true;
      App.save();
      const node = document.querySelector('.msg[data-msg-id="' + message.id + '"] .msg-read');
      if (node) {
        node.textContent = '已读';
        node.classList.add('is-read');
      }
    }, 1600 + Math.random() * 700);
  }

  /* 我发出的红包 / 礼物由 TA 自行决定收下或退回 */
  function scheduleTaDecision(contactId, message) {
    if (decisionTimers[message.id]) return;
    decisionTimers[message.id] = setTimeout(function () {
      delete decisionTimers[message.id];
      const chat = App.state.chats[contactId] || [];
      const target = chat.find(function (m) { return m.id === message.id; });
      if (!target || target.status !== 'pending') return;
      const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
      const cs = contact ? App.contactSettings(contact) : {};
      const accept = Math.max(0, Math.min(100, Number(cs.redpacketAcceptProb) || 0));
      const back = Math.max(0, Math.min(100, Number(cs.redpacketReturnProb) || 0));
      const roll = Math.random() * 100;
      if (roll < accept) settlePacket(target.type, contactId, target.id, 'accept');
      else if (roll < accept + back) settlePacket(target.type, contactId, target.id, 'return');
    }, 3000 + Math.random() * 3000);
  }

  function packetHtml(m) {
    const pending = m.status === 'pending';
    const waiting = pending && m.role === 'me';
    const statusText = m.status === 'accepted' ? '已领取' : (m.status === 'returned' ? '已退回' : (waiting ? '等待对方领取' : '待领取'));
    const stateClass = pending ? ' is-pending' : (m.status === 'accepted' ? ' is-accepted' : ' is-returned');
    return '<div class="bubble bubble-packet' + (pending ? '' : ' is-done') + stateClass + '">' +
      '<div class="packet-head"><span class="packet-tag">同心币红包</span><em>' + statusText + '</em></div>' +
      '<p class="packet-amount">' + Number(m.amount || 0) + '<small> 同心币</small></p>' +
      (m.note ? '<p class="packet-note">' + App.esc(m.note) + '</p>' : '<p class="packet-note">恭喜发财，大吉大利</p>') +
      (pending && m.role === 'ta'
        ? '<div class="packet-actions"><button type="button" data-rp-accept="' + App.esc(m.id) + '">接受</button><button type="button" data-rp-return="' + App.esc(m.id) + '">退回</button></div>'
        : '') +
      '</div>';
  }

  function giftHtml(m) {
    const pending = m.status === 'pending';
    const waiting = pending && m.role === 'me';
    const statusText = m.status === 'accepted' ? '已收下' : (m.status === 'returned' ? '已退回' : (waiting ? '等待对方领取' : '待领取'));
    return '<div class="bubble bubble-gift' + (pending ? '' : ' is-done') + '">' +
      '<div class="packet-head"><span class="packet-tag">礼物</span><em>' + statusText + '</em></div>' +
      '<p class="gift-title">🎁 ' + App.esc(m.productName || '礼物') + '</p>' +
      '<p class="packet-note">' + Number(m.price || 0) + ' 同心币</p>' +
      (pending && m.role === 'ta'
        ? '<div class="packet-actions"><button type="button" data-gift-accept="' + App.esc(m.id) + '">收下</button><button type="button" data-gift-return="' + App.esc(m.id) + '">退回</button></div>'
        : '') +
      '</div>';
  }

  function wishHtml(m) {
    const pending = m.status === 'pending';
    const mine = m.role === 'me';
    const statusText = pending
      ? (mine ? '等 TA 看见' : '等 TA 回应')
      : (m.status === 'rejected' ? '已被拒绝' : (m.status === 'accepted' ? '已接受' : '已买下'));
    return '<div class="bubble bubble-gift bubble-wish' + (pending ? '' : ' is-done') + (m.status === 'rejected' ? ' is-returned' : '') + '">' +
      '<div class="packet-head"><span class="packet-tag">心愿</span><em>' + statusText + '</em></div>' +
      '<p class="gift-title">' + App.esc(m.icon || '🛍️') + ' ' + App.esc(m.productName || '集市好物') + '</p>' +
      '<p class="packet-note">' + Number(m.price || 0) + ' 同心币' + (pending && !mine ? ' · 想要这个' : '') + '</p>' +
      (pending && !mine
        ? '<div class="packet-actions"><button type="button" data-wish-buy="' + App.esc(m.id) + '">买给他</button></div>'
        : '') +
      '</div>';
  }

  function marketBuyHtml(m) {
    return '<div class="bubble bubble-gift bubble-market">' +
      '<div class="packet-head"><span class="packet-tag">集市订单</span><em>已买下</em></div>' +
      '<p class="gift-title">' + App.esc(m.icon || '🛍️') + ' ' + App.esc(m.productName || '集市好物') + '</p>' +
      '<p class="packet-note">' + Number(m.price || 0) + ' 同心币</p>' +
      '</div>';
  }

  /* 我替 TA 买下他许愿的东西 */
  function buyWish(contactId, messageId) {
    const chat = App.state.chats[contactId] || [];
    const wish = chat.find(function (m) { return m.id === messageId; });
    if (!wish || wish.type !== 'wish' || wish.status !== 'pending' || wish.role !== 'ta') return;
    const price = Number(wish.price || 0);
    if (App.state.wallet.me < price) {
      App.toast('同心币不够，先领点补贴吧');
      return;
    }
    App.state.wallet.me -= price;
    wish.status = 'fulfilled';
    App.save();
    App.addChatSystemMessage(contactId, '你给 TA 买下了「' + (wish.productName || '礼物') + '」，花掉 ' + price + ' 同心币');
    if (App.renderMarket) App.renderMarket();
    App.toast('已买下「' + (wish.productName || '礼物') + '」');
  }

  /* 我许愿后，TA 看到时的三种结果：答应并立马送、拒绝、或者这次不作处理 */
  const wishTimers = {};

  function refreshWishBubble(contactId) {
    App.save();
    if (App.chatOpen(contactId)) {
      App.renderChat();
    } else {
      App.unread[contactId] = (App.unread[contactId] || 0) + 1;
      if (App.renderContacts) App.renderContacts();
      if (App.updateBadges) App.updateBadges();
    }
    if (App.renderMarket) App.renderMarket();
  }

  function acceptWish(contactId, wish) {
    wish.status = 'accepted';
    wish.decided = true;
    const price = Number(wish.price || 0);
    if (App.state.wallet.ta >= price) App.state.wallet.ta -= price;
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    chat.push({
      id: App.uid('m'),
      role: 'ta',
      type: 'gift',
      productName: wish.productName,
      price: wish.price,
      status: 'pending',
      ts: Date.now(),
    });
    refreshWishBubble(contactId);
  }

  function rejectWish(contactId, wish) {
    wish.status = 'rejected';
    wish.decided = true;
    refreshWishBubble(contactId);
  }

  function scheduleWishDecision(contactId, message) {
    if (!message || message.role !== 'me' || message.decided || wishTimers[message.id]) return;
    wishTimers[message.id] = setTimeout(function () {
      delete wishTimers[message.id];
      const chat = App.state.chats[contactId] || [];
      const target = chat.find(function (m) { return m.id === message.id; });
      if (!target || target.type !== 'wish' || target.status !== 'pending' || target.decided) return;
      const settings = App.state.settings || {};
      const accept = Math.max(0, Math.min(100, settings.taWishAcceptProb == null ? 25 : Number(settings.taWishAcceptProb) || 0));
      const reject = Math.max(0, Math.min(100, settings.taWishRejectProb == null ? 20 : Number(settings.taWishRejectProb) || 0));
      const roll = Math.random() * 100;
      if (roll < accept) acceptWish(contactId, target);
      else if (roll < accept + reject) rejectWish(contactId, target);
      else {
        /* 这次不处理：保持「等 TA 看见」，不再重复判定 */
        target.decided = true;
        App.save();
      }
    }, 5000 + Math.random() * 9000);
  }
  App.queueWishDecision = scheduleWishDecision;

  function surveyModeText(mode) {
    if (mode === 'single') return '单选';
    if (mode === 'multi') return '多选';
    if (mode === 'text') return '打字回答';
    return '字卡回答';
  }

  function surveyCardHtml(m, contact) {
    const mine = m.role === 'me';
    const name = contact ? contact.name : 'TA';
    const status = m.answered ? '已回答' : (mine ? '等 TA 回答' : '等你回答');
    const questions = (m.questions || []).map(function (q, index) {
      const options = (q.options && q.options.length)
        ? '<span class="survey-card-options">' + q.options.map(function (opt) { return App.esc(opt); }).join(' / ') + '</span>'
        : '';
      return '<li><span class="survey-card-q">' + (index + 1) + '. ' + App.esc(q.text) + '</span>' +
        '<em class="survey-card-mode">' + surveyModeText(q.mode) + '</em>' + options + '</li>';
    }).join('');
    const clickable = !mine && !m.answered;
    const tag = (m.questions || []).length > 1 ? '多问卷' : '小问卷';
    return '<div class="bubble bubble-survey' + (clickable ? ' is-clickable' : '') + '"' +
      (clickable ? ' data-answer-survey="' + App.esc(m.id) + '" role="button" tabindex="0"' : '') + '>' +
      '<div class="survey-card-head"><span class="survey-card-tag">' + tag + '</span><em>' + status + '</em></div>' +
      '<p class="survey-card-title">' + (mine ? '我发出的问卷' : App.esc(name) + ' 的问卷') + '</p>' +
      '<ol class="survey-card-list">' + questions + '</ol>' +
      (clickable ? '<p class="survey-card-hint">点开这张卡，直接选答案。</p>' : '') +
      '</div>';
  }

  function surveyAnswerCardHtml(m, contact) {
    const name = contact ? contact.name : 'TA';
    const answers = (m.answers || []).map(function (item) {
      return '<li><span class="survey-card-q">' + App.esc(item.text) + '</span>' +
        '<strong class="survey-card-a">' + App.esc(item.answer) + '</strong></li>';
    }).join('');
    return '<div class="bubble bubble-survey-answer">' +
      '<div class="survey-card-head"><span class="survey-card-tag">问卷答案</span><em>已作答</em></div>' +
      '<p class="survey-card-title">' + App.esc(name) + ' 的回答</p>' +
      '<ul class="survey-card-list">' + answers + '</ul>' +
      '</div>';
  }

  function surveyMineAnswerCardHtml(m) {
    const answers = (m.answers || []).map(function (item) {
      return '<li><span class="survey-card-q">' + App.esc(item.text) + '</span>' +
        '<strong class="survey-card-a">' + App.esc(item.answer) + '</strong></li>';
    }).join('');
    return '<div class="bubble bubble-survey-answer">' +
      '<div class="survey-card-head"><span class="survey-card-tag">问卷答案</span><em>已作答</em></div>' +
      '<p class="survey-card-title">我的回答</p>' +
      '<ul class="survey-card-list">' + answers + '</ul>' +
      '</div>';
  }

  function cardOfferHtml(m) {
    const status = m.status || 'pending';
    const label = status === 'accepted' ? '已同意' : (status === 'rejected' ? '已拒绝' : '等你决定');
    const actions = status === 'pending'
      ? '<div class="card-offer-actions">' +
          '<button type="button" class="is-ghost" data-card-offer-act="reject" data-card-offer-msg="' + App.esc(m.id) + '">拒绝</button>' +
          '<button type="button" data-card-offer-act="accept" data-card-offer-msg="' + App.esc(m.id) + '">同意</button>' +
        '</div>'
      : '';
    return '<div class="bubble bubble-card-offer">' +
      '<div class="survey-card-head"><span class="survey-card-tag">字卡征询</span><em>' + label + '</em></div>' +
      '<p class="survey-card-title">TA 想把这句话加入字卡</p>' +
      '<p class="card-offer-text">“' + App.esc(m.text) + '”</p>' +
      actions +
      '</div>';
  }

  function divineCardHtml(m) {
    const cards = (m.cards || []).map(function (card) {
      return '<span class="divine-chat-card">' +
        '<strong>' + App.esc(card.name) + '</strong>' +
        '<em class="' + (card.reversed ? 'is-reversed' : '') + '">' + (card.reversed ? '逆位' : '正位') + '</em>' +
        '</span>';
    }).join('');
    const reply = m.reply
      ? '<div class="divine-chat-reply"><span>TA 的回复</span><p>' + App.esc(m.reply.text) + '</p></div>'
      : '<div class="divine-chat-reply is-waiting">TA 正在看牌…</div>';
    return '<div class="bubble bubble-divine">' +
      '<div class="survey-card-head"><span class="survey-card-tag">' + App.esc(m.system || '占卜') + '牌阵</span><em>占卜</em></div>' +
      '<div class="divine-chat-cards">' + cards + '</div>' +
      reply +
      '</div>';
  }

  function messageCardShell(m, contact, inner) {
    const mine = m.role === 'me';
    const taName = contact ? contact.name : 'TA';
    const avatarSrc = mine ? App.state.profile.userAvatar : (contact && contact.avatar);
    const avatarHtml = mine
      ? '<span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>'
      : '<button type="button" class="msg-avatar msg-avatar-button" data-pat-current="1" aria-label="拍一拍 ' + App.esc(taName) + '" title="拍一拍">' + App.avatarHtml(avatarSrc) + '</button>';
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '" data-msg-id="' + App.esc(m.id) + '">' +
      '<div class="msg-main">' +
        '<div class="msg-content">' +
          '<div class="msg-side">' + avatarHtml +
            '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
          '</div>' +
          '<div class="msg-bubble-hit" data-msg-bubble="1">' + inner + '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  function messageHtml(m) {
    const mine = m.role === 'me';
    const contact = currentContact();
    const taName = contact ? contact.name : 'TA';
    if (m.type === 'call') {
      return '<div class="call-log" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8l3 4.2-2 2c1.2 2.5 3.2 4.5 5.7 5.7l2-2 4.3 3c.5.4.7 1 .4 1.6-.7 1.4-2 2.2-3.6 2.1C10 19.5 4.4 14 3.6 7c-.2-1.6.7-2.9 2.1-3.6.6-.3 1.2-.1 1.5.4z"/></svg><span>' + App.esc(m.text) + '</span></div>';
    }
    if (m.type === 'pat') {
      return '<div class="pat-line" role="status">' + App.esc(m.text) + '</div>';
    }
    if (m.recalled) {
      return '<div class="msg-recall">' + App.esc(mine ? '你' : taName) + '撤回了一条消息</div>';
    }
    if (m.type === 'reminder') {
      const contact = currentContact();
      const avatarSrc = contact && contact.avatar;
      const quote = m.quote && m.quote.text
        ? '<span class="msg-quote"><strong>' + App.esc(m.quote.name || '') + '</strong>' + App.esc(m.quote.text) + '</span>'
        : '';
      const actions = m.reminderDone ? '' :
        '<div class="rem-actions">' +
          '<button type="button" data-rem-cancel="' + App.esc(m.reminderId) + '" data-rem-cancel-msg="' + App.esc(m.id) + '">取消提醒，还没做完</button>' +
          '<button type="button" data-rem-keep="' + App.esc(m.reminderId) + '" data-rem-keep-msg="' + App.esc(m.id) + '">还没做完</button>' +
        '</div>';
      return '<div class="msg ta" data-msg-id="' + App.esc(m.id) + '">' +
        '<div class="msg-main">' +
          '<div class="msg-content">' +
            '<div class="msg-side"><span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>' +
              '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
            '</div>' +
            '<div class="msg-bubble-hit" data-msg-bubble="1">' + quote +
              '<div class="bubble bubble-reminder"><p class="bubble-text">' + App.esc(m.text) + '</p>' + actions + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '</div>';
    }
    if (m.type === 'survey') {
      return messageCardShell(m, contact, surveyCardHtml(m, contact));
    }
    if (m.type === 'surveyAnswer') {
      return messageCardShell(m, contact, surveyAnswerCardHtml(m, contact));
    }
    if (m.type === 'surveyAnswerMine') {
      return messageCardShell(m, contact, surveyMineAnswerCardHtml(m));
    }
    if (m.type === 'cardOffer') {
      return '<div class="msg-center" data-msg-id="' + App.esc(m.id) + '">' + cardOfferHtml(m) + '</div>';
    }
    if (m.type === 'divine') {
      return messageCardShell(m, contact, divineCardHtml(m));
    }
    if (m.type === 'redpacket' || m.type === 'gift' || m.type === 'wish' || m.type === 'marketBuy') {
      const avatarSrc = mine ? App.state.profile.userAvatar : (contact && contact.avatar);
      const avatarHtml = mine
        ? '<span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>'
        : '<button type="button" class="msg-avatar msg-avatar-button" data-pat-current="1" aria-label="拍一拍 ' + App.esc(taName) + '" title="拍一拍">' + App.avatarHtml(avatarSrc) + '</button>';
      const cardHtml = m.type === 'redpacket' ? packetHtml(m)
        : m.type === 'gift' ? giftHtml(m)
        : m.type === 'wish' ? wishHtml(m)
        : marketBuyHtml(m);
      return '<div class="msg ' + (mine ? 'me' : 'ta') + '" data-msg-id="' + App.esc(m.id) + '">' +
        '<div class="msg-main">' +
          '<div class="msg-content">' +
            '<div class="msg-side">' + avatarHtml +
              '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
            '</div>' +
            '<div class="msg-bubble-hit" data-msg-bubble="1">' + cardHtml + '</div>' +
          '</div>' +
        '</div>' +
        '</div>';
    }
    if (m.type === 'avatarNotice') {
      return '<div class="msg-notice">★ ' + App.esc(m.text) + '</div>';
    }
    const hasEmotion = !!m.emotion || m.type === 'emotion';
    const meta = m.surveyAppend
      ? '<span class="emotion-divider"></span>' +
        '<div class="emotion-row survey-append-row"><span class="emotion-chip">问卷追加</span></div>'
      : (hasEmotion
        ? '<span class="emotion-divider"></span>' +
          '<div class="emotion-row"><span class="emotion-chip">情绪</span><span class="emotion-value">' + App.esc(emotionOfMessage(m)) + '</span>' + readChip(m) + '</div>'
        : '');
    let body = '';
    if (m.type === 'image') {
      body = '<div class="bubble sticker"><img class="sticker-img" loading="lazy" decoding="async" src="' + App.esc(m.src) + '" alt="表情包"></div>';
    } else if (m.type === 'audio') {
      const showTranscript = m.text && (!App.state.settings || App.state.settings.voiceTranscript !== false);
      const media = String(m.src || '');
      body = '<div class="bubble bubble-audio' + (hasEmotion ? ' bubble-emotion' : '') + '" data-voice-ref="' + App.esc(media) + '">' +
        '<button type="button" class="voice-bubble" aria-label="播放语音">' +
          '<span class="voice-icon" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span class="voice-dur">···</span>' +
        '</button>' +
        (showTranscript ? '<p class="audio-transcript">' + App.esc(m.text) + '</p>' : '') +
        meta +
        '</div>';
    } else if (m.surveyAppend) {
      body = '<div class="bubble bubble-emotion survey-append-bubble">' +
        '<p class="emotion-text">' + App.esc(m.text) + '</p>' + meta +
        '</div>';
    } else if (hasEmotion) {
      body = '<div class="bubble bubble-emotion">' +
        '<p class="emotion-text">' + App.esc(m.text) + '</p>' + meta +
        '</div>';
    } else {
      body = '<div class="bubble bubble-with-read"><span class="bubble-text">' + App.esc(m.text) + '</span>' + readChip(m) + '</div>';
    }
    const quote = m.quote && m.quote.text
      ? '<span class="msg-quote"><strong>' + App.esc(m.quote.name || '') + '</strong>' + App.esc(m.quote.text) + '</span>'
      : '';
    const marks = [];
    if (m.favMine) marks.push('我收藏了');
    if (m.favTa) marks.push(App.esc(taName) + '收藏了');
    const marksHtml = marks.length
      ? '<div class="msg-marks">' + marks.map(function (t) { return '<span>★ ' + t + '</span>'; }).join('') + '</div>'
      : '';
    const avatarSrc = mine ? App.state.profile.userAvatar : (contact && contact.avatar);
    const avatarHtml = mine
      ? '<span class="msg-avatar">' + App.avatarHtml(avatarSrc) + '</span>'
      : '<button type="button" class="msg-avatar msg-avatar-button" data-pat-current="1" aria-label="拍一拍 ' + App.esc(contact ? contact.name : 'TA') + '" title="拍一拍">' + App.avatarHtml(avatarSrc) + '</button>';
    return '<div class="msg ' + (mine ? 'me' : 'ta') + '" data-msg-id="' + App.esc(m.id) + '">' +
      '<div class="msg-main">' +
        '<div class="msg-content">' +
          '<div class="msg-side">' + avatarHtml +
            '<span class="msg-time">' + App.fmtTime(m.ts) + '</span>' +
          '</div>' +
          '<div class="msg-bubble-hit" data-msg-bubble="1">' + quote + body + '</div>' +
        '</div>' +
        marksHtml +
      '</div>' +
      '</div>';
  }

  /* ---------- 引用草稿 ---------- */
  function renderComposerQuote() {
    const box = el('#composer-quote');
    if (!box) return;
    box.hidden = !quoteDraft;
    if (!quoteDraft) return;
    el('#composer-quote-name').textContent = quoteDraft.name;
    el('#composer-quote-text').textContent = quoteDraft.text;
  }

  function messageAuthor(message, contact) {
    return message.role === 'me'
      ? (App.state.profile.userName || '我')
      : (contact ? contact.name : 'TA');
  }

  /* ---------- 消息操作菜单 ---------- */
  function findChatMessage(id) {
    const chat = App.state.chats[App.chatContactId] || [];
    return chat.find(function (m) { return m.id === id; });
  }

  function closeMsgActions() {
    const menu = el('#msg-actions');
    if (menu) menu.hidden = true;
    actionMsgId = null;
  }
  App.closeMsgActions = closeMsgActions;

  function positionMsgActions(node) {
    const menu = el('#msg-actions');
    if (!menu || menu.hidden || !node) return;
    const row = node.closest ? (node.closest('.msg') || node) : node;
    const bubble = row.querySelector('[data-msg-bubble]') || row;
    const message = findChatMessage(row.dataset.msgId);
    const mine = message ? message.role === 'me' : row.classList.contains('me');
    const rect = bubble.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    const appRect = (document.getElementById('app') || document.body).getBoundingClientRect();

    /* 气泡滑出聊天区或手机框后，操作栏直接收起 */
    const listRect = chatScroller ? chatScroller.getBoundingClientRect() : appRect;
    const visibleTop = Math.max(appRect.top, listRect.top);
    const visibleBottom = Math.min(appRect.bottom, listRect.bottom);
    if (rect.bottom <= visibleTop || rect.top >= visibleBottom) {
      menu.style.visibility = 'hidden';
      return;
    }

    /* 我的消息：操作栏右边缘对齐气泡右边缘；TA 的消息：左边缘对齐气泡左边缘 */
    let left = (mine ? rect.right - box.width : rect.left) - appRect.left;
    left = Math.max(8, Math.min(appRect.width - box.width - 8, left));
    /* 贴着气泡上下移动，不再强行夹在手机框内 */
    let top = rect.top - box.height - 8 - appRect.top;
    if (top < 8) top = rect.bottom + 8 - appRect.top;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    const outOfFrame = top < 0 || top + box.height > appRect.height ||
      rect.top < visibleTop || rect.bottom > visibleBottom;
    menu.style.visibility = outOfFrame ? 'hidden' : '';
  }

  function openMsgActions(msgEl) {
    const menu = el('#msg-actions');
    const row = msgEl.closest ? msgEl.closest('[data-msg-id]') : null;
    if (!menu || !row) return;
    const message = findChatMessage(row.dataset.msgId);
    if (!message) return;
    actionMsgId = message.id;
    const mine = message.role === 'me';
    menu.querySelector('[data-msg-action="recall"]').hidden = !mine;
    const saveSticker = menu.querySelector('[data-msg-action="sticker"]');
    if (saveSticker) saveSticker.hidden = message.type !== 'image' || !!message.recalled;
    menu.querySelector('[data-msg-action="favorite"]').textContent = message.favMine ? '取消收藏' : '收藏';
    menu.hidden = false;
    positionMsgActions(row);
  }

  function trackMsgActions() {
    if (!actionMsgId) return;
    const node = document.querySelector('.msg[data-msg-id="' + actionMsgId + '"]');
    if (!node) {
      closeMsgActions();
      return;
    }
    positionMsgActions(node);
  }

  const chatScroller = el('#chat-scroll');
  if (chatScroller) chatScroller.addEventListener('scroll', trackMsgActions, { passive: true });
  window.addEventListener('resize', trackMsgActions);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', trackMsgActions);

  const chatAvatarInput = el('#chat-avatar-file');
  if (chatAvatarInput) {
    chatAvatarInput.addEventListener('change', function () {
      const file = chatAvatarInput.files && chatAvatarInput.files[0];
      chatAvatarInput.value = '';
      const contact = currentContact();
      if (!file || !contact) return;
      App.compressImage(file, 192).then(function (src) {
        contact.avatar = src;
        App.save();
        App.renderChat();
        App.renderContacts();
        App.toast('头像已更换');
      }).catch(function () {
        App.toast('这张图片换不上，换一张试试');
      });
    });
  }

  function doMsgAction(action) {
    const menu = el('#msg-actions');
    if (menu) menu.hidden = true;
    const id = actionMsgId;
    actionMsgId = null;
    const message = findChatMessage(id);
    if (!message) return;
    const chat = App.state.chats[App.chatContactId] || [];

    if (action === 'recall') {
      if (message.role !== 'me') return;
      message.recalled = true;
      message.recalledBy = 'me';
      App.save();
      App.renderChat();
      App.renderContacts();
      App.toast('已撤回消息');
      return;
    }

    if (action === 'quote') {
      quoteDraft = {
        name: messageAuthor(message, currentContact()),
        text: App.messagePreview(message),
      };
      renderComposerQuote();
      const input = el('#msg-input');
      if (input) input.focus();
      return;
    }

    if (action === 'sticker') {
      if (message.type !== 'image' || !message.src) return;
      if (!Array.isArray(App.state.stickers.mine)) App.state.stickers.mine = [];
      const list = App.state.stickers.mine;
      if (list.indexOf(message.src) === -1) list.unshift(message.src);
      App.save();
      App.toast('已存为表情');
      return;
    }

    if (action === 'favorite') {
      message.favMine = !message.favMine;
      App.save();
      App.renderChat();
      App.toast(message.favMine ? '已收藏这条消息' : '已取消收藏');
      return;
    }

    if (action === 'delete') {
      if (!confirm('删除这条消息？')) return;
      const index = chat.indexOf(message);
      if (index !== -1) chat.splice(index, 1);
      App.save();
      App.renderChat();
      App.renderContacts();
      App.toast('已删除消息');
    }
  }

  function scrollBottom(instant) {
    const box = el('#chat-scroll');
    if (!box) return;
    if (instant) {
      const prev = box.style.scrollBehavior;
      box.style.scrollBehavior = 'auto';
      box.scrollTop = box.scrollHeight;
      box.style.scrollBehavior = prev;
      return;
    }
    box.scrollTop = box.scrollHeight;
  }

  /* 正在输入的状态按联系人记住，离开聊天页再回来不会丢，计时也不会重置。
     同一个人可能有几段回复同时排队，用计数保证一段结束时不会误删另一段的输入状态 */
  const typingContacts = {};
  App.typingContacts = typingContacts;

  function typingRow() {
    const row = document.createElement('div');
    row.className = 'typing-row';
    row.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    return row;
  }

  /* 没有待发消息时不显示正在输入 */
  function typingAllowed(contactId) {
    return typingContacts[contactId] > 0;
  }

  function syncTypingRow(contactId) {
    if (!App.chatOpen(contactId)) return;
    const list = el('#chat-list');
    if (!list) return;
    const row = list.querySelector('.typing-row');
    if (typingAllowed(contactId)) {
      if (!row) {
        list.appendChild(typingRow());
        scrollBottom();
      }
    } else if (row) {
      row.remove();
    }
  }

  function setTyping(contactId, on) {
    if (typeof contactId === 'boolean') {
      on = contactId;
      contactId = App.chatContactId;
    }
    if (!contactId) return;
    const depth = typingContacts[contactId] || 0;
    if (on) typingContacts[contactId] = depth + 1;
    else if (depth > 0) typingContacts[contactId] = depth - 1;
    if (!typingContacts[contactId]) delete typingContacts[contactId];
    syncTypingRow(contactId);
  }

  function pushMessage(message) {
    const id = App.chatContactId;
    if (!id) return;
    const chat = App.state.chats[id] || (App.state.chats[id] = []);
    chat.push(message);
    App.save();
    App.renderChat();
  }

  function sendRedPacket(amount, note) {
    const contact = currentContact();
    if (!contact) return false;
    const role = sendRole();
    const wallet = App.state.wallet;
    if (!(amount >= 1) || amount > 1000000) {
      App.toast('红包金额要在 1 ~ 1000000 之间');
      return false;
    }
    if (wallet[role] < amount) {
      App.toast('同心币不够，去集市领点补贴吧');
      return false;
    }
    wallet[role] -= amount;
    pushMessage({
      id: App.uid('m'),
      role: role,
      type: 'redpacket',
      amount: amount,
      note: note,
      status: 'pending',
      ts: Date.now(),
    });
    closeStickerPanel();
    App.toast('红包已发出');
    return true;
  }

  /* 红包与礼物的接受、退回结算 */
  function settlePacket(kind, contactId, messageId, action) {
    const chat = App.state.chats[contactId] || [];
    const message = chat.find(function (m) { return m.id === messageId; });
    if (!message || message.status !== 'pending') return;
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    const partnerName = contact ? contact.name : 'TA';
    const sender = message.role;
    const receiver = sender === 'me' ? 'ta' : 'me';
    const wallet = App.state.wallet;
    const coin = Number(kind === 'redpacket' ? message.amount : message.price) || 0;

    if (action === 'accept') {
      message.status = 'accepted';
      if (kind === 'redpacket') wallet[receiver] += coin;
    } else {
      message.status = 'returned';
      wallet[sender] += coin;
    }

    let line;
    if (kind === 'redpacket') {
      line = action === 'accept'
        ? (receiver === 'me'
            ? '你领取了' + partnerName + '的红包 ' + coin + ' 同心币'
            : partnerName + '领取了你的红包 ' + coin + ' 同心币')
        : (sender === 'me'
            ? '红包退回了，' + coin + ' 同心币已回到你手里'
            : '红包退回给' + partnerName + '了，' + coin + ' 同心币已退还');
    } else {
      const name = message.productName || '礼物';
      line = action === 'accept'
        ? (receiver === 'me'
            ? '你收下了' + partnerName + '送的「' + name + '」'
            : partnerName + '收下了你送的「' + name + '」')
        : (sender === 'me'
            ? '「' + name + '」被退回了，' + coin + ' 同心币已退回'
            : '你把「' + name + '」退回去了，' + coin + ' 同心币已退给' + partnerName);
    }

    chat.push({ id: App.uid('m'), role: 'ta', type: 'pat', text: line, ts: Date.now() });
    App.save();
    if (App.chatOpen(contactId)) App.renderChat();
    else {
      App.unread[contactId] = (App.unread[contactId] || 0) + 1;
      App.updateBadges();
    }
    App.renderContacts();
    if (typeof App.renderMarket === 'function') App.renderMarket();
  }

  function sendMessage() {
    const input = el('#msg-input');
    const text = input.value.trim();
    if (!App.chatContactId || !text) return;

    const role = 'me';
    const message = { id: App.uid('m'), role: role, type: 'text', text: text, ts: Date.now() };
    if (quoteDraft) message.quote = quoteDraft;
    quoteDraft = null;
    renderComposerQuote();
    pushMessage(message);

    input.value = '';
    input.style.height = 'auto';

    if (role === 'me') {
      scheduleReply(App.chatContactId, text);
      maybeTaSticker(App.chatContactId);
      maybeOfferCard(App.chatContactId, text);
    }
  }

  function sendSticker(src) {
    if (!App.chatContactId || !src) return;
    const role = sendRole();
    pushMessage({ id: App.uid('m'), role: role, type: 'image', src: src, ts: Date.now() });
    closeStickerPanel();
    if (role === 'me') scheduleReply(App.chatContactId, '');
  }

  function openRedPacketDialog() {
    closeStickerPanel();
    const hint = el('#redpacket-side-hint');
    if (hint) {
      const role = sendRole();
      hint.textContent = (role === 'me' ? '以「我」的身份发出' : '以「TA」的身份发出') +
        ' · 余额 ' + App.state.wallet[role] + ' 同心币';
    }
    el('#redpacket-amount').value = '';
    el('#redpacket-note').value = '';
    el('#redpacket-dialog').showModal();
    el('#redpacket-amount').focus();
  }

  App.sendPat = function (card) {
    const contact = currentContact();
    if (!contact) return;
    const picked = card || App.pickPatCard();
    const raw = picked ? picked.text : '拍了拍{name}';
    /* 字卡里写了 {name} 才补上名字，没写就照原样显示 */
    const action = raw.indexOf('{name}') !== -1
      ? raw.split('{name}').join(contact.name)
      : raw;
    pushMessage({
      id: App.uid('m'),
      role: 'me',
      type: 'pat',
      text: '你' + action,
      ts: Date.now(),
      cardId: picked ? picked.id : undefined,
    });
    closeStickerPanel();

    scheduleReply(contact.id, '');
    maybeTaSticker(contact.id);
  };

  App.addChatSystemMessage = function (contactId, text) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact || !text) return;
    const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
    chat.push({ id: App.uid('m'), role: 'ta', type: 'pat', text: text, ts: Date.now() });
    const chatOpen = App.chatContactId === contactId && el('#view-chat').classList.contains('is-active');
    if (chatOpen) App.renderChat();
    else App.unread[contactId] = (App.unread[contactId] || 0) + 1;
    App.save();
    App.renderContacts();
    App.updateBadges();
  };

  /* TA 偶尔主动拍一拍我，不需要我先拍他 */
  function maybeTaPat(contactId, contact) {
    contact = contact || App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    const prob = Math.max(0, Math.min(100, Number(App.contactSettings(contact).taPatProb) || 0));
    if (Math.random() * 100 >= prob) return;

    const card = App.pickPatCard();
    const raw = card ? card.text : '拍了拍{name}';
    const action = raw.indexOf('{name}') !== -1
      ? raw.split('{name}').join('你')
      : raw;

    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({
        id: App.uid('m'),
        role: 'ta',
        type: 'pat',
        text: contact.name + action,
        ts: Date.now(),
        cardId: card ? card.id : undefined,
      });
      App.save();
      if (App.chatOpen(contactId)) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 2000 + Math.random() * 3000);
  }

  /* TA 按概率主动发一张表情包（从 TA 的表情库随机抽） */
  function maybeTaSticker(contactId) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    const prob = Math.max(0, Math.min(100, Number(App.contactSettings(contact).taStickerProb) || 0));
    const pool = (App.state.stickers.ta || []).concat(App.state.stickers.public || []);
    if (!pool.length || Math.random() * 100 >= prob) return;
    const src = pool[Math.floor(Math.random() * pool.length)];

    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({ id: App.uid('m'), role: 'ta', type: 'image', src: src, ts: Date.now() });
      App.save();
      if (App.chatOpen(contactId)) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 1600 + Math.random() * 1800);
  }

  /* TA 主动发来一条消息（不依赖我先开口） */
  function maybeTaStartsChat() {
    if (document.hidden || callState) return;
    const st = App.state;
    if (!st || !st.contacts.length) return;
    const contact = st.contacts.find(function (c) { return c.id === st.currentContactId; }) || st.contacts[0];
    const cs = App.contactSettings(contact);
    const prob = Math.max(0, Math.min(100, Number(cs.taMsgProb) || 0));
    if (Math.random() * 100 >= prob) return;

    const voicePool = (st.cards || []).filter(function (c) {
      return c.enabled !== false && c.text && c.category === '语音' && c.audio;
    });
    const textPool = (st.cards || []).filter(function (c) {
      return c.enabled !== false && c.text && (c.category === '聊天' || c.category === '情绪');
    });
    const voiceProb = Math.max(0, Math.min(100, Number(cs.taVoiceProb) || 0));
    const wantVoice = voicePool.length && Math.random() * 100 < voiceProb;
    const pool = wantVoice ? voicePool : (textPool.length ? textPool : voicePool);
    if (!pool.length) return;
    const card = pool[Math.floor(Math.random() * pool.length)];
    const isVoice = card.category === '语音' && card.audio;

    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contact.id; })) return;
      const chat = App.state.chats[contact.id] || (App.state.chats[contact.id] = []);
      const message = {
        id: App.uid('m'),
        role: 'ta',
        type: isVoice ? 'audio' : 'text',
        text: card.text,
        ts: Date.now(),
        cardId: card.id,
      };
      if (isVoice) message.src = card.audio;
      if (card.category === '情绪') message.emotion = App.emotionLabel(card);
      if (App.chatOpen(contact.id)) message.read = true;
      chat.push(message);
      App.save();
      if (App.chatOpen(contact.id)) App.renderChat();
      else {
        App.unread[contact.id] = (App.unread[contact.id] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 1200 + Math.random() * 2200);
  }

  /* 每分钟按概率检查一次，让 TA 也会主动找我说话 */
  setInterval(function () {
    maybeTaStartsChat();
    if (App.maybeTaSurvey) App.maybeTaSurvey();
    if (App.maybeTaSubsidy) App.maybeTaSubsidy();
    if (document.hidden || callState) return;
    const st = App.state;
    if (!st || !st.contacts.length) return;
    const contact = st.contacts.find(function (c) { return c.id === st.currentContactId; }) || st.contacts[0];
    maybeTaPat(contact.id, contact);
  }, 60000);

  App.openCurrentChat = function () {
    const st = App.state;
    let id = st.currentContactId;
    if (!st.contacts.some(function (c) { return c.id === id; })) {
      id = st.contacts.length ? st.contacts[0].id : null;
    }
    if (!id) {
      App.toast('先添加一个角色吧');
      App.go('contacts');
      return;
    }
    App.openChat(id);
  };

  function pickReplyEmotion(card) {
    if (card.category === '情绪') return App.emotionLabel(card);
    const pool = App.state.cards.filter(function (c) {
      return c.category === '情绪';
    });
    return pool.length ? App.emotionLabel(pool[Math.floor(Math.random() * pool.length)]) : '平常';
  }

  /* 老消息里存的是「平常」时，按卡片内容重新推导情绪 */
  function emotionOfMessage(m) {
    if (m.emotion && m.emotion !== '平常') return m.emotion;
    const card = m.cardId
      ? (App.state.cards || []).find(function (c) { return c.id === m.cardId; })
      : null;
    if (card && card.category === '情绪') return App.emotionLabel(card);
    return m.emotion || '平常';
  }

  /* TA 按概率撤回/收藏自己或对方最近的消息 */
  function scheduleTaMessageExtras(contactId, contact, message, cs) {
    const recallProb = Math.max(0, Math.min(100, Number(cs.taRecallProb) || 0));
    if (Math.random() * 100 < recallProb) {
      setTimeout(function () {
        const target = (App.state.chats[contactId] || []).find(function (m) {
          return m.id === message.id;
        });
        if (!target || target.recalled) return;
        target.recalled = true;
        target.recalledBy = 'ta';
        App.save();
        if (App.chatContactId === contactId) App.renderChat();
        else {
          App.renderContacts();
          App.updateBadges();
        }
      }, 2400 + Math.random() * 3000);
    }

    const favProb = Math.max(0, Math.min(100, Number(cs.taFavProb) || 0));
    if (Math.random() * 100 < favProb) {
      setTimeout(function () {
        const pool = (App.state.chats[contactId] || []).filter(function (m) {
          return !m.recalled && m.type !== 'pat';
        }).slice(-8);
        if (!pool.length) return;
        const target = pool[Math.floor(Math.random() * pool.length)];
        if (target.favTa) return;
        target.favTa = true;
        App.save();
        if (App.chatContactId === contactId) App.renderChat();
      }, 1800 + Math.random() * 3200);
    }
  }

  async function scheduleReply(contactId, userText) {
    const st = App.state;
    const contact = st.contacts.find(function (c) { return c.id === contactId; });
    const cs = App.contactSettings(contact);
    const min = Math.max(0, Math.min(5, Number(cs.replyMin) || 0));
    const max = Math.max(min, Math.min(5, Number(cs.replyMax) || 0));
    const count = min + Math.floor(Math.random() * (max - min + 1));
    if (count <= 0) return;

    /* 按概率已读不回：不接话，把我刚发的那条消息标成「已读不回」 */
    const ignoreProb = Math.max(0, Math.min(100, Number(cs.taIgnoreProb) || 0));
    if (Math.random() * 100 < ignoreProb) {
      const chat = App.state.chats[contactId] || [];
      let target = null;
      for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].role === 'me') { target = chat[i]; break; }
      }
      /* 先占住这条消息的「已读」流程，避免中途闪一下已读 */
      if (target) {
        if (readTimers[target.id]) {
          clearTimeout(readTimers[target.id]);
          delete readTimers[target.id];
        }
        target.noReply = true;
      }
      await sleep(1600 + Math.random() * 2400);
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      if (!target || chat.indexOf(target) === -1) return;
      target.read = true;
      App.save();
      if (App.chatOpen(contactId)) App.renderChat();
      return;
    }

    /* 语音字卡：按概率决定这一轮是否发语音，没命中就避开语音卡 */
    const voiceProb = Math.max(0, Math.min(100, Number(cs.taVoiceProb) || 0));
    const wantVoice = Math.random() * 100 < voiceProb;
    const cats = wantVoice ? ['聊天', '情绪', '语音'] : ['聊天', '情绪'];
    let cards = App.pickCards(userText, count, contactId, cats);
    /* 只有语音卡时，仍然让它回一句，避免 TA 完全不说话 */
    if (!cards.length && !wantVoice) {
      cards = App.pickCards(userText, count, contactId, ['聊天', '情绪', '语音']);
    }
    if (wantVoice && !cards.some(function (c) { return c.category === '语音' && c.audio; })) {
      const voicePool = (App.state.cards || []).filter(function (c) {
        return c.enabled !== false && c.text && c.category === '语音' && c.audio;
      });
      if (voicePool.length) {
        const voiceCard = voicePool[Math.floor(Math.random() * voicePool.length)];
        if (cards.length) cards[cards.length - 1] = voiceCard;
        else cards.push(voiceCard);
      }
    }
    if (!cards.length) {
      App.toast('字卡库是空的，先去添加几张字卡');
      return;
    }
    const emotionProb = Math.max(0, Math.min(100, Number(cs.emotionProb) || 0));

    /* 多字卡拼接：按概率把这一次回复的多张字卡挤进同一个气泡 */
    const mergeProb = Math.max(0, Math.min(100, Number(cs.mergeProb) || 0));
    const mergeMin = Math.max(2, Math.min(6, Number(cs.mergeMin) || 2));
    const mergeMax = Math.max(mergeMin, Math.min(6, Number(cs.mergeMax) || 3));
    let mergeTake = 0;
    if (cards.length >= 2 && Math.random() * 100 < mergeProb) {
      const want = mergeMin + Math.floor(Math.random() * (mergeMax - mergeMin + 1));
      const take = Math.min(want, cards.length);
      if (take >= 2 && cards.slice(0, take).every(function (c) { return c.category !== '语音'; })) {
        mergeTake = take;
      }
    }

    for (let i = 0; i < cards.length; i++) {
      let group = [cards[i]];
      if (mergeTake >= 2 && i === 0) {
        group = cards.slice(0, mergeTake);
        i = mergeTake - 1;
      }
      const card = group[0];
      const mergedText = group.map(function (c) { return c.text; }).join('\n');
      const stillThere = function () {
        return App.state.contacts.some(function (c) { return c.id === contactId; });
      };
      if (!stillThere()) return;

      setTyping(contactId, true);

      const base = Math.max(0, Math.min(5, Number(cs.typingMin) || 0)) * 60000;
      const extra = group.length === 1 && card.category === '语音' ? 900 : 0;
      const wait = Math.min(300000, base + extra + mergedText.length * 22 + Math.random() * 260);
      await sleep(wait);

      setTyping(contactId, false);
      if (!stillThere()) return;

      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      const message = {
        id: App.uid('m'),
        role: 'ta',
        type: group.length === 1 && card.category === '语音' ? 'audio' : 'text',
        text: mergedText,
        ts: Date.now(),
        cardId: card.id,
      };
      if (group.length > 1) message.cardIds = group.map(function (c) { return c.id; });
      if (group.length === 1 && card.category === '语音') message.src = card.audio;
      if (Math.random() * 100 < emotionProb) message.emotion = pickReplyEmotion(card);

      const quoteProb = Math.max(0, Math.min(100, Number(cs.taQuoteProb) || 0));
      if (chat.length && Math.random() * 100 < quoteProb) {
        const pool = chat.filter(function (m) {
          return !m.recalled && m.type !== 'pat' && (m.text || m.type === 'image');
        }).slice(-12);
        const minePool = pool.filter(function (m) { return m.role === 'me'; });
        const taPool = pool.filter(function (m) { return m.role !== 'me'; });
        let candidates = pool;
        /* 大部分引用我发的消息，很少引用他自己发的 */
        if (minePool.length && (Math.random() < 0.85 || !taPool.length)) candidates = minePool;
        else if (taPool.length) candidates = taPool;
        if (candidates.length) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          message.quote = {
            name: messageAuthor(target, contact),
            text: App.messagePreview(target),
          };
        }
      }

      chat.push(message);
      App.save();
      scheduleTaMessageExtras(contactId, contact, message, cs);

      if (App.chatOpen(contactId)) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }

      await sleep(240);
    }
    maybeTaCall(contactId, contact, cs);
    maybeTaPacket(contactId, contact, cs);
    maybeTaPat(contactId, contact);
  }

  /* TA 发红包的金额：37% 是特殊含义数额，其余在 1 ~ 1000000 之间随机 */
  const SPECIAL_PACKET_AMOUNTS = [66, 520, 52, 1314, 13.14, 5200, 99, 999, 888];
  function randomPacketAmount() {
    if (Math.random() < 0.37) {
      return SPECIAL_PACKET_AMOUNTS[Math.floor(Math.random() * SPECIAL_PACKET_AMOUNTS.length)];
    }
    return 1 + Math.floor(Math.random() * 1000000);
  }

  /* TA 偶尔主动发一个红包给我 */
  function maybeTaPacket(contactId, contact, cs) {
    if (!contact) return;
    if (Math.random() * 100 >= clampProb(cs.taRedpacketProb)) return;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const notes = ['拿去花', '请你喝奶茶', '今天也辛苦啦', '一点小心意', '买点好吃的'];
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({
        id: App.uid('m'),
        role: 'ta',
        type: 'redpacket',
        amount: randomPacketAmount(),
        note: notes[Math.floor(Math.random() * notes.length)],
        status: 'pending',
        ts: Date.now(),
      });
      App.save();
      if (App.chatOpen(contactId)) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 2600 + Math.random() * 3200);
  }

  /* TA 偶尔会问：这句话能不能收进字卡库 */
  function maybeOfferCard(contactId, text) {
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    const cs = App.contactSettings(contact);
    const prob = Math.max(0, Math.min(100, Number(cs.cardOfferProb) || 0));
    const value = String(text || '').trim();
    if (value.length < 2 || value.length > 60) return;
    if (Math.random() * 100 >= prob) return;
    const exists = (App.state.cards || []).some(function (c) {
      return String(c.text || '').trim() === value;
    });
    if (exists) return;
    setTimeout(function () {
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      const chat = App.state.chats[contactId] || (App.state.chats[contactId] = []);
      chat.push({
        id: App.uid('m'),
        role: 'ta',
        type: 'cardOffer',
        text: value,
        status: 'pending',
        ts: Date.now(),
      });
      App.save();
      if (App.chatOpen(contactId)) {
        App.renderChat();
      } else {
        App.unread[contactId] = (App.unread[contactId] || 0) + 1;
        App.updateBadges();
        App.renderContacts();
      }
    }, 2600 + Math.random() * 3200);
  }

  function resolveCardOffer(contactId, msgId, action) {
    const chat = App.state.chats[contactId] || [];
    const msg = chat.find(function (m) { return m.id === msgId; });
    if (!msg || msg.type !== 'cardOffer' || (msg.status || 'pending') !== 'pending') return;
    const accept = action === 'accept';
    msg.status = accept ? 'accepted' : 'rejected';
    if (accept) {
      const value = String(msg.text || '').trim();
      const exists = (App.state.cards || []).some(function (c) {
        return String(c.text || '').trim() === value;
      });
      if (!exists) {
        App.state.cards.unshift({
          id: App.uid('card'),
          text: value,
          category: '聊天',
          trigger: '',
          enabled: true,
          builtin: false,
        });
      }
    }
    App.save();
    App.renderChat();
    if (App.renderCards) App.renderCards();
    App.toast(accept ? '已加入字卡库 · 聊天' : '已拒绝加入字卡');
  }

  /* ---------- 表情包 ---------- */
  function stickerKey() {
    if (App.stickerTab === 'public') return 'public';
    return App.stickerTab === 'ta' ? 'ta' : 'mine';
  }

  function stickerList() {
    const key = stickerKey();
    if (!Array.isArray(App.state.stickers[key])) App.state.stickers[key] = [];
    return App.state.stickers[key];
  }

  function updateSideButtons() {
    document.querySelectorAll('[data-sticker-side]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.stickerSide === (App.stickerTab || 'me'));
    });
    const hint = el('#sticker-side-hint');
    if (hint) {
      hint.textContent = App.stickerTab === 'public'
        ? '公共表情包 · 以「' + (sendRole() === 'ta' ? 'TA' : '我') + '」身份发送'
        : '当前：' + (App.stickerTab === 'ta' ? 'TA' : '我') + '的表情包';
    }
  }

  function renderStickerPanel() {
    const kind = App.panelKind || 'sticker';
    document.querySelectorAll('[data-panel-kind]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.dataset.panelKind === kind);
    });

    const imageMode = kind === 'image';
    ['#sticker-side-head', '#sticker-grid', '#btn-add-sticker', '#btn-paste-sticker'].forEach(function (sel) {
      const node = el(sel);
      if (node) node.hidden = imageMode;
    });
    const imageView = el('#sticker-image-view');
    if (imageView) imageView.hidden = !imageMode;

    setStickerStatus('');
    if (imageMode) {
      paintChatImageDraft();
      return;
    }

    const stickers = stickerList();
    el('#sticker-grid').innerHTML = stickers.length
      ? stickers.map(function (src, index) {
          return '<div class="sticker-cell">' +
            '<button type="button" class="sticker-item" data-send-sticker="' + index + '" aria-label="发送表情包">' +
              '<img loading="lazy" decoding="async" src="' + App.esc(src) + '" alt="表情包">' +
            '</button>' +
            '<button type="button" class="sticker-delete" data-del-sticker="' + index + '" aria-label="删除表情包">×</button>' +
          '</div>';
        }).join('')
      : '<p class="sticker-empty">还没有表情包，点下方按钮从本地相册添加。</p>';
  }

  function renderPatGrid() {
    const contact = currentContact();
    const name = contact ? contact.name : '你';
    const grid = el('#pat-grid');
    if (!grid) return;
    let cards = [];
    try {
      cards = (App.state.cards || []).filter(function (c) {
        return c.category === '拍一拍' && c.enabled !== false && c.text;
      });
    } catch (err) {
      cards = [];
    }
    grid.innerHTML = cards.length
      ? cards.map(function (c) {
          return '<button type="button" class="pat-item" data-send-pat="' + c.id + '">' +
            App.esc(String(c.text).split('{name}').join(name)) +
          '</button>';
        }).join('')
      : '<p class="sticker-empty">字卡库里还没有拍一拍字卡，去「字卡」添加。</p>';
  }

  function closePatPicker() {
    const panel = el('#pat-picker-panel');
    if (panel) panel.hidden = true;
  }
  App.closePatPicker = closePatPicker;

  function openPatPicker() {
    if (!currentContact()) return;
    renderPatGrid();
    const panel = el('#pat-picker-panel');
    if (!panel) return;
    panel.hidden = false;
    const grid = el('#pat-grid');
    if (grid) grid.scrollTop = 0;
  }
  App.openPatPicker = openPatPicker;

  document.querySelectorAll('[data-pat-close]').forEach(function (btn) {
    btn.addEventListener('click', closePatPicker);
  });

  function closeStickerPanel() {
    const panel = el('#sticker-panel');
    if (panel) panel.hidden = true;
    resetChatImageDraft();
  }

  App.openStickerPanel = function () {
    const panel = el('#sticker-panel');
    if (!panel) return;
    panel.hidden = false;
    renderStickerPanel();
  };

  function toggleStickerPanel() {
    const panel = el('#sticker-panel');
    const opening = panel.hidden;
    panel.hidden = !panel.hidden;
    if (opening) {
      /* 每次打开表情包面板都从「公共」分类开始 */
      App.stickerTab = 'public';
      App.panelKind = 'sticker';
      renderStickerPanel();
    }
  }

  function compressImage(file) {
    /* 表情包尽量保留画质：400px、JPEG 0.9，超出约 190KB 再逐级压缩 */
    return App.compressImage(file, 400, { quality: 0.9, maxLength: 260000 });
  }

  /* 图片分类：只作为发送工具，选好图后确定就发到聊天，不存进表情库 */
  function paintChatImageDraft() {
    const preview = el('#sticker-image-preview');
    if (!preview) return;
    preview.innerHTML = chatImageDraft
      ? '<img src="' + App.esc(chatImageDraft) + '" alt="待发送的图片">'
      : '点这里从相册选择一张图片';
  }

  function resetChatImageDraft() {
    chatImageDraft = '';
    const input = el('#chat-image-file');
    if (input) input.value = '';
    paintChatImageDraft();
  }

  function pickChatImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      App.toast('只能选择图片');
      return;
    }
    setStickerStatus('正在读取图片…');
    App.compressImage(file, 900, { quality: 0.88, maxLength: 900000 }).then(function (src) {
      if (!src) {
        setStickerStatus('这张图片读取失败，换一张试试', true);
        return;
      }
      chatImageDraft = src;
      setStickerStatus('');
      paintChatImageDraft();
    }).catch(function () {
      setStickerStatus('这张图片读取失败，换一张试试', true);
    });
  }

  function sendChatImageDraft() {
    if (!chatImageDraft) {
      setStickerStatus('先从相册选一张图片', true);
      return;
    }
    if (!App.chatContactId) return;
    pushMessage({ id: App.uid('m'), role: 'me', type: 'image', src: chatImageDraft, ts: Date.now() });
    chatImageDraft = '';
    closeStickerPanel();
    scheduleReply(App.chatContactId, '');
  }

  App.stickerNotice = function (text, isError) { setStickerStatus(text, isError); };

  function setStickerStatus(text, isError) {
    const box = el('#sticker-status');
    if (!box) return;
    box.hidden = !text;
    box.textContent = text || '';
    box.classList.toggle('is-error', !!isError);
  }

  /* 选中的图片先暂存到 IndexedDB：即使压缩时页面被系统重载，下次打开也能恢复 */
  function mediaDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open('xuyu-media', 2);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('voice')) db.createObjectStore('voice', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function stashPending(files, tab, attempts) {
    return mediaDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ files: files, tab: tab, attempts: attempts || 0 }, 'pending');
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  function readPending() {
    return mediaDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('kv', 'readonly');
        const get = tx.objectStore('kv').get('pending');
        let value = null;
        get.onsuccess = function () { value = get.result || null; };
        tx.oncomplete = function () { db.close(); resolve(value); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  function clearPending() {
    return mediaDb().then(function (db) {
      return new Promise(function (resolve) {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete('pending');
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); resolve(); };
      });
    }).catch(function () {});
  }

  App.recoverPendingStickers = function () {
    return readPending().then(function (data) {
      if (!data || !data.files || !data.files.length) return;
      const attempts = Number(data.attempts) || 0;
      if (attempts >= 2) {
        clearPending();
        App.toast('上次选择的图片未能读取，请重新选择');
        return;
      }
      return stashPending(data.files, data.tab, attempts + 1).then(function () {
        if (data.tab) App.stickerTab = data.tab;
        if (App.chatContactId) App.openStickerPanel();
        App.toast('正在恢复上次选择的图片…');
        return addStickers(data.files);
      });
    }).catch(function () {});
  };

  async function addStickers(files) {
    const images = Array.from(files || []).slice(0, 12);
    if (!images.length) return;

    setStickerStatus('正在压缩图片…');
    App.toast('正在处理图片…');
    const list = stickerList();
    let added = 0;
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      try {
        const src = await compressImage(images[i]);
        if (!list.includes(src)) {
          list.push(src);
          added++;
        }
      } catch (e) {
        failed++;
      }
    }

    if (!added) {
      clearPending();
      setStickerStatus(failed ? '这张图片无法读取，换一张试试' : '没有添加新表情', true);
      App.toast(failed ? '图片处理失败' : '没有添加新表情');
      return;
    }
    App.save();
    clearPending();
    renderStickerPanel();
    const grid = el('#sticker-grid');
    if (grid) grid.scrollTop = grid.scrollHeight;
    setStickerStatus('已添加 ' + added + ' 张表情包');
    App.toast('已添加 ' + added + ' 张表情包');
  }

  /* ---------- 本机模拟语音通话 ---------- */
  function formatCallDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function updateCallTimer() {
    if (!callState || !callState.connected) return;
    el('#call-timer').textContent = formatCallDuration((Date.now() - callState.startedAt) / 1000);
  }

  function renderCallToggle(kind) {
    const active = !!(callState && (kind === 'mute' ? callState.muted : callState.speaker));
    const button = el(kind === 'mute' ? '#call-mute' : '#call-speaker');
    const label = el(kind === 'mute' ? '#call-mute-label' : '#call-speaker-label');
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    label.textContent = kind === 'mute' ? (active ? '已静音' : '静音') : (active ? '免提已开' : '免提');
  }

  function setCallMinimized(minimized) {
    if (!callState) return;
    callState.minimized = minimized;
    const overlay = el('#call-overlay');
    const main = el('#call-main');
    overlay.classList.toggle('is-mini', minimized);
    overlay.classList.remove('is-dragging');
    if (minimized && callState.miniPosition) {
      overlay.style.left = callState.miniPosition.left + 'px';
      overlay.style.top = callState.miniPosition.top + 'px';
      overlay.style.bottom = 'auto';
      overlay.style.transform = 'none';
    } else {
      overlay.style.left = '';
      overlay.style.top = '';
      overlay.style.bottom = '';
      overlay.style.transform = '';
    }
    if (minimized) {
      main.setAttribute('role', 'button');
      main.setAttribute('tabindex', '0');
      main.setAttribute('aria-label', '展开通话');
      main.focus();
    } else {
      main.removeAttribute('role');
      main.removeAttribute('tabindex');
      main.removeAttribute('aria-label');
      if (!overlay.hidden) el('#call-minimize').focus();
    }
  }

  function startCallDrag(e) {
    if (!callState || !callState.minimized || !e.isPrimary || e.button !== 0 || e.target.closest('#call-end')) return;
    const overlay = el('#call-overlay');
    const rect = overlay.getBoundingClientRect();
    const appRect = el('#app').getBoundingClientRect();
    callDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left: rect.left - appRect.left,
      top: rect.top - appRect.top,
      maxLeft: appRect.width - rect.width - 8,
      maxTop: appRect.height - rect.height - 8,
      moved: false,
    };
    overlay.classList.add('is-dragging');
    overlay.setPointerCapture(e.pointerId);
  }

  function moveCallDrag(e) {
    if (!callDrag || e.pointerId !== callDrag.pointerId || !callState || !callState.minimized) return;
    const dx = e.clientX - callDrag.startX;
    const dy = e.clientY - callDrag.startY;
    if (!callDrag.moved && Math.hypot(dx, dy) < 5) return;
    callDrag.moved = true;
    e.preventDefault();
    const left = Math.max(8, Math.min(callDrag.maxLeft, callDrag.left + dx));
    const top = Math.max(8, Math.min(callDrag.maxTop, callDrag.top + dy));
    const overlay = el('#call-overlay');
    callState.miniPosition = { left: left, top: top };
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.bottom = 'auto';
    overlay.style.transform = 'none';
  }

  function endCallDrag(e) {
    if (!callDrag || e.pointerId !== callDrag.pointerId) return;
    const overlay = el('#call-overlay');
    const moved = callDrag.moved;
    callDrag = null;
    overlay.classList.remove('is-dragging');
    if (overlay.hasPointerCapture(e.pointerId)) overlay.releasePointerCapture(e.pointerId);
    suppressCallClick = moved;
    if (moved) setTimeout(function () { suppressCallClick = false; }, 0);
  }

  function clampProb(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function callContact(session) {
    return App.state.contacts.find(function (c) { return c.id === session.contactId; });
  }

  function setCallControls(mode) {
    const connected = mode === 'connected';
    const incoming = mode === 'incoming';
    el('#call-accept-item').hidden = !incoming;
    el('#call-mute-item').hidden = !connected;
    el('#call-speaker-item').hidden = !connected;
    el('#call-end-item').hidden = mode === 'ending';
    el('#call-end-label').textContent = mode === 'outgoing' ? '取消' : '挂断';
    el('#call-minimize').hidden = incoming || mode === 'ending';
  }

  function prepareCallUi(contact) {
    el('#call-avatar').innerHTML = App.avatarHtml(contact.avatar);
    el('#call-name').textContent = contact.name;
    renderCallToggle('mute');
    renderCallToggle('speaker');
    setCallMinimized(false);
    el('#call-overlay').hidden = false;
  }

  function clearCallTimers(session) {
    clearTimeout(session.answerTimer);
    clearTimeout(session.hangupTimer);
    clearTimeout(session.endTimer);
    clearInterval(session.ticker);
  }

  function pushCallLog(session, text) {
    const chat = App.state.chats[session.contactId] || (App.state.chats[session.contactId] = []);
    chat.push({ id: App.uid('m'), role: 'me', type: 'call', text: text, ts: Date.now() });
    App.save();
    if (App.chatContactId === session.contactId) App.renderChat();
    App.renderContacts();
  }

  function closeCall(session, text) {
    if (!session || callState !== session) return;
    callState = null;
    clearCallTimers(session);
    el('#call-overlay').hidden = true;
    pushCallLog(session, text);
    el('#btn-call').focus();
  }

  function connectCall(session) {
    if (!session || callState !== session || session.connected) return;
    session.connected = true;
    session.phase = 'connected';
    session.startedAt = Date.now();
    el('#call-avatar-wrap').classList.remove('is-ringing');
    el('#call-status').textContent = '正在通话';
    el('#call-timer').textContent = '00:00';
    setCallControls('connected');
    updateCallTimer();
    session.ticker = setInterval(updateCallTimer, 1000);
    const contact = callContact(session);
    if (contact) scheduleTaHangup(session, contact);
  }

  /* 通话中 TA 按概率挂断，结果随机显示忙音或拒接 */
  function scheduleTaHangup(session, contact) {
    const prob = clampProb(App.contactSettings(contact).callHangupProb);
    session.hangupTimer = setTimeout(function () {
      if (callState !== session || !session.connected) return;
      if (Math.random() * 100 < prob) {
        endCallWithNotice(session, Math.random() < 0.5 ? 'busy' : 'reject');
      } else {
        scheduleTaHangup(session, contact);
      }
    }, 7000 + Math.random() * 5000);
  }

  function endCallWithNotice(session, kind) {
    if (callState !== session || session.phase === 'ending') return;
    session.phase = 'ending';
    clearCallTimers(session);
    el('#call-avatar-wrap').classList.remove('is-ringing');
    el('#call-status').textContent = kind === 'busy' ? '对方忙音…' : '对方已拒接';
    el('#call-timer').textContent = '';
    setCallControls('ending');
    const reason = kind === 'busy' ? '对方忙音' : '对方拒接';
    const duration = session.connected ? Math.max(1, Math.floor((Date.now() - session.startedAt) / 1000)) : 0;
    const text = session.connected
      ? '语音通话 · ' + formatCallDuration(duration) + ' · ' + reason
      : '语音通话 · ' + reason;
    App.toast(reason);
    session.endTimer = setTimeout(function () { closeCall(session, text); }, 1500);
  }

  function startCall() {
    const contact = currentContact();
    if (!contact || callState) return;
    closeStickerPanel();
    closeMsgActions();
    const cs = App.contactSettings(contact);
    callState = {
      contactId: contact.id,
      direction: 'out',
      phase: 'ringing',
      connected: false,
      startedAt: 0,
      muted: false,
      speaker: false,
      minimized: false,
      miniPosition: null,
      answerTimer: null,
      hangupTimer: null,
      endTimer: null,
      ticker: null,
    };
    prepareCallUi(contact);
    el('#call-status').textContent = '正在呼叫…';
    el('#call-timer').textContent = '等待对方接听';
    el('#call-avatar-wrap').classList.add('is-ringing');
    setCallControls('outgoing');
    el('#call-end').focus();

    const session = callState;
    session.answerTimer = setTimeout(function () {
      if (callState !== session) return;
      const roll = Math.random() * 100;
      const answer = clampProb(cs.callAnswerProb);
      const busy = clampProb(cs.callBusyProb);
      const reject = clampProb(cs.callRejectProb);
      if (roll < answer) connectCall(session);
      else if (roll < answer + busy) endCallWithNotice(session, 'busy');
      else if (roll < answer + busy + reject) endCallWithNotice(session, 'reject');
      else connectCall(session);
    }, 1600 + Math.random() * 1600);
  }

  /* TA 主动来电：我这边弹出接通 / 挂断 */
  function startIncomingCall(contactId) {
    if (callState) return;
    const contact = App.state.contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;
    closeStickerPanel();
    closeMsgActions();
    callState = {
      contactId: contactId,
      direction: 'in',
      phase: 'ringing',
      connected: false,
      startedAt: 0,
      muted: false,
      speaker: false,
      minimized: false,
      miniPosition: null,
      answerTimer: null,
      hangupTimer: null,
      endTimer: null,
      ticker: null,
    };
    prepareCallUi(contact);
    el('#call-status').textContent = '邀请你语音通话…';
    el('#call-timer').textContent = '来电';
    el('#call-avatar-wrap').classList.add('is-ringing');
    setCallControls('incoming');
    el('#call-accept').focus();
  }

  /* TA 每次回复后，按概率打来电话 */
  function maybeTaCall(contactId, contact, cs) {
    if (!contact) return;
    if (Math.random() * 100 >= clampProb(cs.callIncomingProb)) return;
    setTimeout(function () {
      if (callState) return;
      if (!App.state.contacts.some(function (c) { return c.id === contactId; })) return;
      startIncomingCall(contactId);
    }, 2200 + Math.random() * 2400);
  }

  function finishCall() {
    if (!callState) return;
    const session = callState;
    if (session.phase === 'ending') return;
    if (session.connected) {
      const duration = Math.max(1, Math.floor((Date.now() - session.startedAt) / 1000));
      closeCall(session, '语音通话 · ' + formatCallDuration(duration));
      return;
    }
    if (session.direction === 'in') closeCall(session, '语音通话 · 已拒绝来电');
    else closeCall(session, '语音通话已取消');
  }

  App.initChat = function () {
    const input = el('#msg-input');
    const form = el('#composer');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(118, input.scrollHeight) + 'px';
    });

    /* 输入法弹出、视口变矮时，消息重新贴到最后一条 */
    const keepBottom = function () {
      if (document.activeElement !== input) return;
      [0, 120, 320].forEach(function (delay) {
        setTimeout(function () { scrollBottom(true); }, delay);
      });
    };
    input.addEventListener('focus', keepBottom);
    window.addEventListener('resize', keepBottom);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', keepBottom);

    document.addEventListener('click', function (e) {
      const surveyOpen = e.target.closest('[data-answer-survey]');
      if (surveyOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeMsgActions();
        if (App.openSurveyAnswer) App.openSurveyAnswer(App.chatContactId, surveyOpen.dataset.answerSurvey);
        return;
      }
      const offerBtn = e.target.closest('[data-card-offer-act]');
      if (offerBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeMsgActions();
        resolveCardOffer(App.chatContactId, offerBtn.dataset.cardOfferMsg, offerBtn.dataset.cardOfferAct);
        return;
      }
      const wishBuyBtn = e.target.closest('[data-wish-buy]');
      if (wishBuyBtn) {
        e.preventDefault();
        e.stopPropagation();
        buyWish(App.chatContactId, wishBuyBtn.dataset.wishBuy);
        return;
      }
      const packetBtn = e.target.closest('[data-rp-accept], [data-rp-return], [data-gift-accept], [data-gift-return]');
      if (packetBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (packetBtn.dataset.rpAccept) settlePacket('redpacket', App.chatContactId, packetBtn.dataset.rpAccept, 'accept');
        else if (packetBtn.dataset.rpReturn) settlePacket('redpacket', App.chatContactId, packetBtn.dataset.rpReturn, 'return');
        else if (packetBtn.dataset.giftAccept) settlePacket('gift', App.chatContactId, packetBtn.dataset.giftAccept, 'accept');
        else if (packetBtn.dataset.giftReturn) settlePacket('gift', App.chatContactId, packetBtn.dataset.giftReturn, 'return');
        return;
      }
      const actionBtn = e.target.closest('[data-msg-action]');
      if (actionBtn) {
        e.preventDefault();
        doMsgAction(actionBtn.dataset.msgAction);
        return;
      }
      if (e.target.closest('#msg-actions')) return;

      const bubbleHit = e.target.closest('[data-msg-id] [data-msg-bubble]');
      if (bubbleHit) {
        if (e.target.closest('audio')) return;
        if (e.target.closest('.rem-actions')) return;
        closeStickerPanel();
        openMsgActions(bubbleHit);
        return;
      }
      closeMsgActions();

      /* 顶部头像：从相册换头像，不触发拍一拍 */
      if (e.target.closest('[data-chat-avatar]')) {
        const input = el('#chat-avatar-file');
        if (input) input.click();
        return;
      }

      /* 顶部名字：点击直接改名字 */
      if (e.target.closest('[data-chat-name]')) {
        const contact = currentContact();
        if (!contact) return;
        const next = window.prompt('修改名字', contact.name);
        if (next == null) return;
        const name = next.trim();
        if (!name) return;
        contact.name = name;
        App.save();
        App.renderChat();
        App.renderContacts();
        return;
      }

      const patAvatar = e.target.closest('[data-pat-current]');
      if (patAvatar) {
        openPatPicker();
        return;
      }

      const kindBtn = e.target.closest('[data-panel-kind]');
      if (kindBtn) {
        if (kindBtn.dataset.panelKind === 'redpacket') {
          openRedPacketDialog();
          return;
        }
        App.panelKind = kindBtn.dataset.panelKind;
        renderStickerPanel();
        return;
      }

      const patItem = e.target.closest('[data-send-pat]');
      if (patItem) {
        const card = (App.state.cards || []).find(function (c) {
          return c.id === patItem.dataset.sendPat;
        });
        closePatPicker();
        if (card) App.sendPat(card);
        return;
      }

      const stickerTab = e.target.closest('[data-sticker-side]');
      if (stickerTab) {
        App.stickerTab = stickerTab.dataset.stickerSide;
        updateSideButtons();
        renderStickerPanel();
        return;
      }

      const stickerItem = e.target.closest('[data-send-sticker]');
      if (stickerItem) {
        const list = stickerList();
        const src = list[Number(stickerItem.dataset.sendSticker)];
        if (src) sendSticker(src);
        return;
      }

      const stickerDel = e.target.closest('[data-del-sticker]');
      if (stickerDel) {
        const list = stickerList();
        const index = Number(stickerDel.dataset.delSticker);
        list.splice(index, 1);
        App.save();
        renderStickerPanel();
        return;
      }

      if (!e.target.closest('#composer, #sticker-panel, #btn-sticker')) closeStickerPanel();
    });

    el('#btn-call').addEventListener('click', startCall);
    el('#call-minimize').addEventListener('click', function () { setCallMinimized(true); });
    el('#call-overlay').addEventListener('pointerdown', startCallDrag);
    el('#call-overlay').addEventListener('pointermove', moveCallDrag);
    el('#call-overlay').addEventListener('pointerup', endCallDrag);
    el('#call-overlay').addEventListener('pointercancel', endCallDrag);
    el('#call-overlay').addEventListener('click', function (e) {
      if (suppressCallClick) {
        suppressCallClick = false;
        return;
      }
      if (callState && callState.minimized && !e.target.closest('#call-end, #call-minimize')) setCallMinimized(false);
    });
    el('#call-main').addEventListener('keydown', function (e) {
      if (callState && callState.minimized && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setCallMinimized(false);
      }
    });
    el('#call-end').addEventListener('click', finishCall);
    el('#call-accept').addEventListener('click', function () {
      if (callState) connectCall(callState);
    });
    el('#call-mute').addEventListener('click', function () {
      if (!callState) return;
      callState.muted = !callState.muted;
      renderCallToggle('mute');
    });
    el('#call-speaker').addEventListener('click', function () {
      if (!callState) return;
      callState.speaker = !callState.speaker;
      renderCallToggle('speaker');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && callState) {
        e.preventDefault();
        finishCall();
      }
    });
    el('#btn-sticker').addEventListener('click', toggleStickerPanel);

    const chatImageFile = el('#chat-image-file');
    if (chatImageFile) {
      chatImageFile.addEventListener('change', function (e) {
        const file = (e.target.files || [])[0];
        pickChatImage(file);
      });
    }
    const chatImageSend = el('#sticker-image-send');
    if (chatImageSend) chatImageSend.addEventListener('click', sendChatImageDraft);
    const chatImageCancel = el('#sticker-image-cancel');
    if (chatImageCancel) chatImageCancel.addEventListener('click', function () { closeStickerPanel(); });
    el('#redpacket-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const amount = Math.round(Number(el('#redpacket-amount').value));
      if (sendRedPacket(amount, el('#redpacket-note').value.trim())) {
        el('#redpacket-dialog').close();
      }
    });
    el('#composer-quote-close').addEventListener('click', function () {
      quoteDraft = null;
      renderComposerQuote();
    });
    el('#chat-scroll').addEventListener('wheel', closeMsgActions, { passive: true });
    window.addEventListener('resize', closeMsgActions);
    let awaitingPick = false;
    el('#btn-add-sticker').addEventListener('click', function () {
      awaitingPick = true;
      setStickerStatus('正在打开相册…');
      try { sessionStorage.setItem('xuyu.stickerPick', String(Date.now())); } catch (err) {}
      try { localStorage.setItem('xuyu.pickView', App.chatContactId || ''); } catch (err) {}
    });
    el('#btn-add-sticker').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el('#sticker-file').click();
      }
    });
    el('#sticker-file').addEventListener('change', function (e) {
      awaitingPick = false;
      const input = e.target;
      const files = Array.from(input.files || []);
      const tab = App.stickerTab || 'me';
      if (!files.length) return;
      stashPending(files, tab, 0).catch(function () {}).then(function () {
        return addStickers(files);
      }).finally(function () {
        /* 压缩完成后再清空，避免 iOS 提前让选中的文件失效 */
        try { input.value = ''; } catch (err) {}
        try { sessionStorage.removeItem('xuyu.stickerPick'); } catch (err) {}
        try { localStorage.removeItem('xuyu.pickView'); } catch (err) {}
      });
    });

    /* 相册选择不可用时，可以从剪贴板粘贴图片 */
    const pasteDialog = el('#paste-sticker-dialog');
    const pasteZone = el('#paste-sticker-zone');
    function setPasteStatus(text, isError) {
      const box = el('#paste-sticker-status');
      if (!box) return;
      box.hidden = !text;
      box.textContent = text || '';
      box.classList.toggle('is-error', !!isError);
    }
    function addPastedFiles(files) {
      const images = Array.from(files || []).filter(function (f) {
        return f && /^image\//.test(f.type || '');
      });
      if (!images.length) {
        setPasteStatus('剪贴板里没有图片，请先在相册里长按图片选「复制」', true);
        return;
      }
      if (pasteDialog && pasteDialog.open) pasteDialog.close();
      const tab = App.stickerTab || 'me';
      stashPending(images, tab, 0).catch(function () {}).then(function () {
        return addStickers(images);
      });
    }
    if (pasteDialog && pasteZone) {
      el('#btn-paste-sticker').addEventListener('click', function () {
        pasteZone.innerHTML = '';
        setPasteStatus('');
        pasteDialog.showModal();
        setTimeout(function () { pasteZone.focus(); }, 80);
      });
      pasteZone.addEventListener('paste', function (e) {
        const data = e.clipboardData;
        if (!data) return;
        const files = [];
        if (data.items) {
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (item.kind === 'file' && /^image\//.test(item.type || '')) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }
        if (!files.length && data.files) {
          for (let i = 0; i < data.files.length; i++) {
            if (/^image\//.test(data.files[i].type || '')) files.push(data.files[i]);
          }
        }
        if (!files.length) {
          setPasteStatus('剪贴板里没有图片，请先在相册里长按图片选「复制」', true);
          return;
        }
        e.preventDefault();
        addPastedFiles(files);
      });
      pasteZone.addEventListener('dragover', function (e) { e.preventDefault(); });
      pasteZone.addEventListener('drop', function (e) {
        if (!e.dataTransfer) return;
        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;
        e.preventDefault();
        addPastedFiles(files);
      });
    }
    /* 从相册返回却没有收到文件时，清掉中断标记并提示；若页面被系统重载，标记会留到下次启动 */
    window.addEventListener('focus', function () {
      setTimeout(function () {
        if (!awaitingPick) return;
        awaitingPick = false;
        try { sessionStorage.removeItem('xuyu.stickerPick'); } catch (err) {}
        try { localStorage.removeItem('xuyu.pickView'); } catch (err) {}
        setStickerStatus('没有收到图片，请重新选择', true);
      }, 3000);
    });

    el('#btn-clear-chat').addEventListener('click', function () {
      const id = App.chatContactId;
      if (!id) return;
      if (!confirm('清空这段对话？此操作不可撤销。')) return;
      App.state.chats[id] = [];
      App.save();
      App.renderChat();
      App.renderContacts();
      App.renderDesktop();
      App.toast('已清空对话');
    });
  };
})();
