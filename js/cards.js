/* 字卡库 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  let editingCard = null;
  const dialog = el('#card-dialog');

  function fillCategories() {
    const select = el('#card-cat');
    select.innerHTML = App.CATEGORIES.map(function (c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join('');
  }

  App.renderCards = function () {
    const filter = App.cardFilter;
    const cats = ['全部'].concat(App.CATEGORIES);

    el('#card-cats').innerHTML = cats.map(function (c) {
      const count = c === '全部'
        ? App.state.cards.length
        : App.state.cards.filter(function (x) { return x.category === c; }).length;
      return '<button type="button" class="chip' + (c === filter.cat ? ' is-on' : '') +
        '" data-cat="' + c + '">' + c + ' ' + count + '</button>';
    }).join('');

    const q = filter.q.trim().toLowerCase();
    const list = App.state.cards.filter(function (c) {
      const matchCat = filter.cat === '全部' || c.category === filter.cat;
      const haystack = (c.text + ' ' + (c.trigger || '') + ' ' + (c.category || '')).toLowerCase();
      return matchCat && (!q || haystack.indexOf(q) !== -1);
    });

    el('#card-list').innerHTML = list.length
      ? list.map(cardRow).join('')
      : '<p class="empty-note">没有符合条件的字卡。</p>';

    const enabled = App.state.cards.filter(function (c) { return c.enabled; }).length;
    el('#card-count').textContent = '共 ' + App.state.cards.length + ' 张，已启用 ' + enabled + ' 张';
  };

  function cardRow(c) {
    const extra =
      (c.category === '情绪'
        ? '<span class="tag">情绪：' + App.esc(c.emotion || '平常') + '</span>' +
          '<span class="tag ghost">强度：' + App.esc(c.strength || '中') + '</span>'
        : '') +
      (c.category === '语音'
        ? '<span class="tag">语音' + (c.audio ? ' · mp3' : ' · 未添加') + '</span>'
        : '');
    return '<div class="card-item" data-id="' + c.id + '">' +
      '<div class="card-main">' +
        '<p class="card-text">' + App.esc(c.text) + '</p>' +
        '<div class="card-meta">' +
          '<span class="tag">' + App.esc(c.category || '未分类') + '</span>' +
          extra +
          (c.trigger ? '<span class="tag ghost">触发：' + App.esc(c.trigger) + '</span>' : '') +
          (c.builtin ? '<span class="tag ghost">内置</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card-side">' +
        '<label class="switch" title="启用 / 停用">' +
          '<input type="checkbox" data-toggle="' + c.id + '"' + (c.enabled ? ' checked' : '') + '>' +
          '<span class="slider"></span>' +
        '</label>' +
        '<button type="button" class="mini-btn" data-edit-card="' + c.id + '" aria-label="编辑字卡">✎</button>' +
        '<button type="button" class="mini-btn" data-del-card="' + c.id + '" aria-label="删除字卡">✕</button>' +
      '</div>' +
      '</div>';
  }

  function findCard(id) {
    return App.state.cards.find(function (c) { return c.id === id; });
  }

  function cardTextKey(card) {
    return String(card.text || '').trim();
  }

  function existingTextKeys() {
    const keys = {};
    App.state.cards.forEach(function (c) {
      const key = cardTextKey(c);
      if (key) keys[key] = true;
    });
    return keys;
  }

  function dedupeCards() {
    const seen = {};
    let removed = 0;
    App.state.cards = App.state.cards.filter(function (c) {
      const key = cardTextKey(c);
      if (!key) return true;
      if (seen[key]) {
        removed++;
        return false;
      }
      seen[key] = true;
      return true;
    });
    if (removed) {
      App.save();
      App.renderCards();
      App.renderDesktop();
    }
    return removed;
  }

  function toggleExtraFields(category, card) {
    const emotionBox = el('#card-emotion-fields');
    const voiceBox = el('#card-voice-fields');
    emotionBox.style.display = category === '情绪' ? '' : 'none';
    voiceBox.style.display = category === '语音' ? '' : 'none';
    el('#card-emotion').value = card && card.emotion ? card.emotion : '';
    el('#card-strength').value = card && card.strength ? card.strength : '中';
    el('#card-audio-file').value = '';
    el('#card-audio-hint').textContent = card && card.audio
      ? '已保存一段语音（重新选择可替换）'
      : '还没有语音，请选择一段 mp3 文件';
  }

  function openCardDialog(card) {
    editingCard = card || null;
    el('#card-dialog-title').textContent = card ? '编辑字卡' : '新建字卡';
    el('#card-text').value = card ? card.text : '';
    el('#card-cat').value = card ? card.category : '聊天';
    el('#card-trigger').value = card ? (card.trigger || '') : '';
    toggleExtraFields(el('#card-cat').value, card);
    dialog.showModal();
    setTimeout(function () { el('#card-text').focus(); }, 60);
  }

  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(new Error('读取语音失败')); };
      reader.readAsDataURL(file);
    });
  }

  function deleteCard(card) {
    if (!confirm('删除这张字卡？\n\n“' + card.text + '”')) return;
    App.state.cards = App.state.cards.filter(function (c) { return c.id !== card.id; });
    App.save();
    App.renderCards();
    App.renderDesktop();
    App.toast('已删除字卡');
  }

  function importCards(file) {
    App.readJSONFile(file).then(function (data) {
      const incoming = Array.isArray(data) ? data : (data && data.cards);
      if (!Array.isArray(incoming)) throw new Error('文件里没有找到字卡');

      const existing = existingTextKeys();

      let added = 0;
      let duplicated = 0;
      incoming.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        const text = String(item.text || '').trim();
        if (!text) return;
        if (existing[text]) {
          duplicated++;
          return;
        }
        const category = App.CATEGORIES.indexOf(item.category) !== -1 ? item.category : '聊天';
        const card = {
          id: App.uid('card'),
          text: text,
          category: category,
          trigger: String(item.trigger || '').slice(0, 40),
          enabled: item.enabled !== false,
          builtin: false,
        };
        if (category === '情绪') {
          card.emotion = String(item.emotion || '平常').slice(0, 12);
          card.strength = ['强', '中', '弱'].indexOf(item.strength) !== -1 ? item.strength : '中';
        }
        if (category === '语音' && typeof item.audio === 'string' && item.audio.indexOf('data:audio') === 0) {
          card.audio = item.audio;
        }
        App.state.cards.unshift(card);
        existing[text] = true;
        added++;
      });

      App.save();
      App.renderCards();
      App.renderDesktop();
      App.toast('已导入 ' + added + ' 条，去重 ' + duplicated + ' 条');
    }).catch(function (err) {
      App.toast(err.message || '导入失败');
    });
  }

  function restoreBuiltins() {
    const existing = {};
    App.state.cards.forEach(function (c) { existing[c.id] = true; });
    let added = 0;
    App.BUILTIN_CARDS.forEach(function (c) {
      if (!existing[c.id]) {
        App.state.cards.push(Object.assign({}, c));
        added++;
      }
    });
    App.save();
    App.renderCards();
    App.renderDesktop();
    App.toast(added ? '已恢复 ' + added + ' 张内置字卡' : '内置字卡都在');
  }

  App.initCards = function () {
    fillCategories();

    el('#card-search').addEventListener('input', function (e) {
      App.cardFilter.q = e.target.value;
      App.renderCards();
    });

    el('#card-cat').addEventListener('change', function (e) {
      toggleExtraFields(e.target.value, editingCard);
    });

    el('#card-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const rawText = el('#card-text').value;
      /* 新建时一行一张字卡，一次可粘贴多行批量添加；编辑时只改当前这一张。 */
      const texts = (editingCard ? [rawText] : rawText.split(/\r?\n/))
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
      if (!texts.length) {
        el('#card-text').focus();
        return;
      }
      const category = el('#card-cat').value;
      const trigger = el('#card-trigger').value.trim().slice(0, 40);
      const emotion = el('#card-emotion').value.trim().slice(0, 12) || '平常';
      const strength = el('#card-strength').value;

      let audio = '';
      if (category === '语音') {
        const file = el('#card-audio-file').files && el('#card-audio-file').files[0];
        if (file) {
          try {
            audio = await fileToDataURL(file);
          } catch (err) {
            App.toast(err.message || '语音读取失败');
            return;
          }
        } else if (!editingCard || !editingCard.audio) {
          App.toast('语音字卡需要选择一段 mp3 文件');
          return;
        }
      }

      function fillCard(card, text) {
        card.text = text;
        card.category = category;
        card.trigger = trigger;
        if (category === '情绪') {
          card.emotion = emotion;
          card.strength = strength;
        } else {
          delete card.emotion;
          delete card.strength;
        }
        if (category === '语音' && audio) card.audio = audio;
        if (category !== '语音') delete card.audio;
      }

      let added = 0;
      let duplicated = 0;
      if (editingCard) {
        fillCard(editingCard, texts[0]);
      } else {
        const existing = existingTextKeys();
        const fresh = texts.filter(function (text) {
          if (existing[text]) {
            duplicated++;
            return false;
          }
          existing[text] = true;
          return true;
        });
        if (!fresh.length) {
          App.toast('这些字卡都已经存在了');
          return;
        }
        fresh.slice().reverse().forEach(function (text) {
          const card = { id: App.uid('card'), enabled: true, builtin: false };
          fillCard(card, text);
          App.state.cards.unshift(card);
          added++;
        });
      }

      App.save();
      dialog.close();
      App.renderCards();
      App.renderDesktop();
      App.toast(editingCard ? '已更新字卡' : '已添加 ' + added + ' 张字卡' + (duplicated ? '，去重 ' + duplicated + ' 张' : ''));
      editingCard = null;
    });

    el('#btn-export-cards').addEventListener('click', function () {
      App.downloadJSON({
        app: 'xuyu',
        type: 'cards',
        exportedAt: new Date().toISOString(),
        cards: App.state.cards,
      }, 'xuyu-cards-' + App.stamp() + '.json');
    });

    el('#btn-dedupe-cards').addEventListener('click', function () {
      const removed = dedupeCards();
      App.toast(removed ? '已删除 ' + removed + ' 张重复字卡' : '没有重复的字卡');
    });

    el('#btn-import-cards').addEventListener('click', function () {
      el('#card-import-dialog').showModal();
    });

    el('#card-import-manual').addEventListener('click', function () {
      el('#card-import-dialog').close();
      openCardDialog(null);
    });

    el('#card-import-file').addEventListener('click', function () {
      el('#card-import-dialog').close();
      el('#file-import-cards').click();
    });

    el('#file-import-cards').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) importCards(file);
      e.target.value = '';
    });

    el('#btn-restore-cards').addEventListener('click', restoreBuiltins);

    document.addEventListener('click', function (e) {
      const chip = e.target.closest('[data-cat]');
      if (chip) {
        App.cardFilter.cat = chip.dataset.cat;
        App.renderCards();
        return;
      }
      const edit = e.target.closest('[data-edit-card]');
      if (edit) {
        const card = findCard(edit.dataset.editCard);
        if (card) openCardDialog(card);
        return;
      }
      const del = e.target.closest('[data-del-card]');
      if (del) {
        const card = findCard(del.dataset.delCard);
        if (card) deleteCard(card);
      }
    });

    document.addEventListener('change', function (e) {
      const toggle = e.target.closest('[data-toggle]');
      if (!toggle) return;
      const card = findCard(toggle.dataset.toggle);
      if (!card) return;
      card.enabled = toggle.checked;
      App.save();
      App.renderCards();
      App.renderDesktop();
    });
  };
})();
