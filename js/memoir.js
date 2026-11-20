/* 回忆录：把认识天数、TA 的档案、精选聊天、日记和回忆墙整理成一份长图 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function esc(value) { return App.esc(String(value == null ? '' : value)); }

  /* 汇总回忆录要用的数据 */
  function collectMemoirData() {
    const st = App.state;
    const profile = st.profile || {};
    const contacts = st.contacts || [];
    const contact = contacts.find(function (c) { return c.id === st.currentContactId; }) || contacts[0] || null;

    /* 认识天数：取所有能翻到的时间里最早的那个（纪念日 / 第一条聊天 / 第一条动态 / 第一张照片） */
    let startTs = 0;
    const consider = function (ts) {
      const t = Number(ts);
      if (isFinite(t) && t > 0 && (!startTs || t < startTs)) startTs = t;
    };
    (st.anniversaries || []).forEach(function (a) { consider(Date.parse(a.date)); });
    Object.keys(st.chats || {}).forEach(function (id) {
      (st.chats[id] || []).forEach(function (m) { consider(m.ts); });
    });
    (st.moments || []).forEach(function (m) { consider(m.ts); });
    ((st.memory && st.memory.photos) || []).forEach(function (p) {
      consider(p.ts);
      consider(Date.parse(p.date));
    });
    const days = startTs ? Math.max(1, Math.floor((Date.now() - startTs) / 86400000) + 1) : 1;
    const startDate = startTs ? new Date(startTs) : null;

    /* 精选聊天：TA 说过的话里挑几句认真的 */
    let chatLines = [];
    if (contact) {
      (st.chats[contact.id] || []).forEach(function (m) {
        if (m.role === 'ta' && (m.type === 'text' || !m.type) && m.text && m.text.length >= 6 && m.text.length <= 60) {
          chatLines.push(m.text);
        }
      });
    }
    /* 洗牌后取 5 句 */
    for (let i = chatLines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = chatLines[i]; chatLines[i] = chatLines[j]; chatLines[j] = tmp;
    }
    chatLines = chatLines.slice(0, 5);

    /* 日记：最近写了内容的几天 */
    const entries = (st.mood && st.mood.entries) || {};
    const diary = Object.keys(entries).sort().reverse().map(function (key) {
      return { date: key, note: String(entries[key].note || '').trim() };
    }).filter(function (d) { return d.note; }).slice(0, 4);

    /* 回忆墙照片：最近的几张（不含私密） */
    const photos = ((st.memory && st.memory.photos) || []).filter(function (p) {
      return p && p.src && !p.secret;
    }).slice(-6);

    /* 统计数字 */
    let chatCount = 0;
    if (contact) chatCount = (st.chats[contact.id] || []).length;
    const stats = {
      chats: chatCount,
      moments: (st.moments || []).length,
      photos: ((st.memory && st.memory.photos) || []).length,
      cards: contact && App.visibleCards ? App.visibleCards(contact.id).length : (st.cards || []).length,
    };

    return {
      userName: profile.userName || '我',
      contact: contact,
      days: days,
      startDate: startDate,
      chatLines: chatLines,
      diary: diary,
      photos: photos,
      stats: stats,
      generatedAt: new Date(),
    };
  }

  function fmtDate(d) {
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  /* 用内联样式搭一份适合转图片的排版（宽 720px） */
  function buildMemoirDom(data) {
    const stage = document.createElement('div');
    stage.className = 'memoir-stage';

    const contact = data.contact;
    const taName = contact ? contact.name : 'TA';
    const avatarHtml = contact ? App.avatarHtml(contact.avatar) : '';

    let html = '';
    html += '<div class="memoir-hero">';
    html += '<p class="memoir-eyebrow">OUR MEMOIR · 拾忆回忆录</p>';
    html += '<h1>' + esc(data.userName) + ' & ' + esc(taName) + '</h1>';
    html += '<p class="memoir-days"><strong>' + data.days + '</strong> 天</p>';
    html += '<p class="memoir-since">' + (data.startDate ? '从 ' + fmtDate(data.startDate) + ' 开始，到今天 ' + fmtDate(data.generatedAt) : '我们的故事才刚刚开始') + '</p>';
    html += '</div>';

    if (contact) {
      html += '<div class="memoir-section"><h2>TA 的档案</h2><div class="memoir-profile">';
      html += '<span class="memoir-avatar">' + avatarHtml + '</span>';
      html += '<div class="memoir-profile-info"><strong>' + esc(taName) + '</strong>';
      html += '<span>陪我聊了 ' + data.stats.chats + ' 条消息</span>';
      html += '<span>字卡库里为 TA 准备了 ' + data.stats.cards + ' 张字卡</span>';
      if (contact.relation) html += '<span>' + esc(contact.relation) + '</span>';
      html += '</div></div></div>';
    }

    if (data.chatLines.length) {
      html += '<div class="memoir-section"><h2>TA 说过的话</h2>';
      data.chatLines.forEach(function (line) {
        html += '<p class="memoir-quote">“' + esc(line) + '”</p>';
      });
      html += '</div>';
    }

    if (data.diary.length) {
      html += '<div class="memoir-section"><h2>我写下的日记</h2>';
      data.diary.forEach(function (d) {
        html += '<div class="memoir-diary"><time>' + esc(d.date) + '</time><p>' + esc(d.note) + '</p></div>';
      });
      html += '</div>';
    }

    if (data.photos.length) {
      html += '<div class="memoir-section"><h2>回忆墙</h2><div class="memoir-grid">';
      data.photos.forEach(function (p) {
        html += '<figure><img src="' + esc(p.src) + '" alt="' + esc(p.caption || '回忆照片') + '">' +
          (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>';
      });
      html += '</div></div>';
    }

    html += '<div class="memoir-stats">';
    html += '<span><strong>' + data.stats.chats + '</strong>条聊天</span>';
    html += '<span><strong>' + data.stats.moments + '</strong>条朋友圈</span>';
    html += '<span><strong>' + data.stats.photos + '</strong>张回忆照片</span>';
    html += '<span><strong>' + data.stats.cards + '</strong>张字卡</span>';
    html += '</div>';
    html += '<p class="memoir-foot">生成于 ' + fmtDate(data.generatedAt) + ' · 拾忆</p>';

    stage.innerHTML = html;
    return stage;
  }

  let lastCanvas = null;

  function setStatus(text) {
    const node = el('#memoir-status');
    if (node) node.textContent = text || '';
  }

  function setLoading(on) {
    const box = el('#memoir-loading');
    if (box) box.hidden = !on;
  }

  function generate() {
    if (typeof html2canvas !== 'function') {
      App.toast('回忆录组件还没加载好，刷新后再试一次');
      return;
    }
    const preview = el('#memoir-preview');
    const downloadBtn = el('#btn-memoir-download');
    setLoading(true);
    setStatus('');
    if (preview) { preview.hidden = true; preview.innerHTML = ''; }
    if (downloadBtn) downloadBtn.hidden = true;
    lastCanvas = null;

    /* 等一拍让 Loading 动画先渲染出来 */
    setTimeout(function () {
      let stage = null;
      try {
        const data = collectMemoirData();
        stage = buildMemoirDom(data);
        document.body.appendChild(stage);
        html2canvas(stage, {
          scale: 2,
          backgroundColor: '#fff7f2',
          useCORS: true,
          logging: false,
        }).then(function (canvas) {
          lastCanvas = canvas;
          if (stage && stage.parentNode) stage.parentNode.removeChild(stage);
          stage = null;
          const url = canvas.toDataURL('image/png');
          if (preview) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = '回忆录预览';
            preview.appendChild(img);
            preview.hidden = false;
          }
          if (downloadBtn) downloadBtn.hidden = false;
          setLoading(false);
          setStatus('回忆录整理好了，点「保存为长图」下载。');
          App.toast('回忆录已生成');
        }).catch(function () {
          if (stage && stage.parentNode) stage.parentNode.removeChild(stage);
          setLoading(false);
          setStatus('生成失败了，刷新页面后再试一次。');
          App.toast('回忆录生成失败');
        });
      } catch (err) {
        if (stage && stage.parentNode) stage.parentNode.removeChild(stage);
        setLoading(false);
        setStatus('生成失败了，刷新页面后再试一次。');
      }
    }, 120);
  }

  function downloadPng() {
    if (!lastCanvas) return;
    const link = document.createElement('a');
    link.download = '我们的回忆录-' + App.stamp() + '.png';
    link.href = lastCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
    App.toast('回忆录长图已开始下载');
  }

  App.initMemoir = function () {
    const genBtn = el('#btn-memoir-generate');
    if (genBtn) genBtn.addEventListener('click', function () {
      /* 回忆录汇总聊天、动态、字卡等，先把尚未点开的模块补齐 */
      App.loadAllLazy().then(generate);
    });
    const downloadBtn = el('#btn-memoir-download');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPng);

    /* 一键导出全部数据：勾上所有备份范围后走原有导出流程 */
    const fullBtn = el('#btn-export-full');
    if (fullBtn) {
      fullBtn.addEventListener('click', function () {
        document.querySelectorAll('[data-backup-scope]').forEach(function (input) {
          input.checked = true;
        });
        const exportBtn = el('#btn-export-all');
        if (exportBtn) exportBtn.click();
      });
    }
  };
})();
