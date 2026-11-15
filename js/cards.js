/* 字卡库 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  let editingCard = null;
  let batchMode = false;
  let selected = {};
  const dialog = el('#card-dialog');

  function fillCategories() {
    const select = el('#card-cat');
    select.innerHTML = App.CATEGORIES.map(function (c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join('');
  }

  let listToken = 0;
  const LIST_CHUNK = 80;

  App.renderCards = function () {
    const filter = App.cardFilter;
    const cards = App.state.cards;
    const cats = ['全部'].concat(App.CATEGORIES);

    /* 分类数量和启用数量一次遍历算完，避免每个分类都扫一遍全部字卡 */
    const counts = {};
    let enabled = 0;
    cards.forEach(function (c) {
      counts[c.category || ''] = (counts[c.category || ''] || 0) + 1;
      if (c.enabled) enabled += 1;
    });

    el('#card-cats').innerHTML = cats.map(function (c) {
      const count = c === '全部' ? cards.length : (counts[c] || 0);
      return '<button type="button" class="chip' + (c === filter.cat ? ' is-on' : '') +
        '" data-cat="' + c + '">' + c + ' ' + count + '</button>';
    }).join('');

    const q = filter.q.trim().toLowerCase();
    const list = [];
    cards.forEach(function (c) {
      if (filter.cat !== '全部' && c.category !== filter.cat) return;
      if (q) {
        const haystack = (c.text + ' ' + (c.trigger || '') + ' ' + (c.category || '')).toLowerCase();
        if (haystack.indexOf(q) === -1) return;
      }
      list.push(c);
    });

    const importTile = filter.cat === '语音'
      ? '<button type="button" class="card-voice-import" data-import-voice>' +
          '<span class="card-voice-icon">＋</span>' +
          '<span class="card-voice-copy"><strong>导入语音</strong><em>选择一段 mp3，写下它说的话</em></span>' +
        '</button>'
      : '';
    const empty = filter.cat === '语音'
      ? '<p class="empty-note">还没有语音卡，点上面的卡片导入一段 mp3。</p>'
      : '<p class="empty-note">没有符合条件的字卡。</p>';

    /* 先渲染一批，剩下的分帧补上，字卡很多时点进字卡库也不会卡住 */
    const box = el('#card-list');
    const token = ++listToken;
    box.innerHTML = importTile + (list.length
      ? list.slice(0, LIST_CHUNK).map(cardRow).join('')
      : empty);
    if (list.length > LIST_CHUNK) {
      box.insertAdjacentHTML('beforeend', '<p class="card-more" id="card-more">正在加载…</p>');
      let index = LIST_CHUNK;
      const step = function () {
        if (token !== listToken) return;
        const more = el('#card-more');
        if (!more) return;
        more.insertAdjacentHTML('beforebegin', list.slice(index, index + LIST_CHUNK).map(cardRow).join(''));
        index += LIST_CHUNK;
        if (index < list.length) setTimeout(step, 16);
        else more.remove();
      };
      setTimeout(step, 16);
    }

    const bar = el('#card-batch-bar');
    if (bar) {
      bar.hidden = !batchMode;
      if (batchMode) {
        el('#card-batch-count').textContent = '已选 ' + Object.keys(selected).length + ' 张，点字卡可多选';
      }
    }
    const batchBtn = el('#btn-batch-trigger');
    if (batchBtn) batchBtn.classList.toggle('is-on', batchMode);

    el('#card-count').textContent = '共 ' + cards.length + ' 张，已启用 ' + enabled + ' 张';
  };

  function cardRow(c) {
    const extra =
      (c.category === '情绪'
        ? '<span class="tag">情绪：' + App.esc(App.emotionLabel(c)) + '</span>'
        : '') +
      (c.category === '语音'
        ? '<span class="tag">语音' + (c.audio ? ' · mp3' : ' · 未添加') + '</span>'
        : '');
    const picked = !!selected[c.id];
    const check = batchMode
      ? '<span class="card-check">' + (picked ? '✓' : '') + '</span>'
      : '';
    const side = batchMode ? '' :
      '<div class="card-side">' +
        '<label class="switch" title="启用 / 停用">' +
          '<input type="checkbox" data-toggle="' + c.id + '"' + (c.enabled ? ' checked' : '') + '>' +
          '<span class="slider"></span>' +
        '</label>' +
        '<button type="button" class="mini-btn" data-edit-card="' + c.id + '" aria-label="编辑字卡">✎</button>' +
        '<button type="button" class="mini-btn" data-del-card="' + c.id + '" aria-label="删除字卡">✕</button>' +
      '</div>';
    return '<div class="card-item' + (batchMode ? ' is-batch' : '') + (picked ? ' is-selected' : '') +
      '" data-id="' + c.id + '"' + (batchMode ? ' data-batch-toggle="' + c.id + '"' : '') + '>' +
      check +
      '<div class="card-main">' +
        '<p class="card-text">' + App.esc(c.text) + '</p>' +
        '<div class="card-meta">' +
          '<span class="tag">' + App.esc(c.category || '未分类') + '</span>' +
          extra +
          (c.trigger ? '<span class="tag ghost">触发：' + App.esc(c.trigger) + '</span>' : '') +
          (c.builtin ? '<span class="tag ghost">内置</span>' : '') +
        '</div>' +
      '</div>' +
      side +
      '</div>';
  }

  function findCard(id) {
    return App.state.cards.find(function (c) { return c.id === id; });
  }

  function cardKey(category, text, audio) {
    const value = String(text || '').trim();
    if (!value) return '';
    const cat = category || '';
    if (cat !== '语音') return value;
    const src = String(audio || '');
    return cat + '\u0001' + value + '\u0001' + src.length + ':' + src.slice(-48);
  }

  function cardTextKey(card) {
    return cardKey(card.category, card.text, card.audio);
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
    /* 先按「内置优先」清掉和内置卡内容重复的导入卡，再清余下的重复项 */
    let removed = App.dedupeBuiltinCards ? App.dedupeBuiltinCards(App.state) : 0;
    const seen = {};
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
    const isVoice = category === '语音';
    emotionBox.style.display = category === '情绪' ? '' : 'none';
    voiceBox.style.display = isVoice ? '' : 'none';
    el('#card-emotion').value = card && card.emotion ? card.emotion : '';

    const textLabel = el('#card-text-label');
    if (textLabel) textLabel.textContent = isVoice ? '语音文字（显示在语音下方）' : '内容';
    const textHint = el('#card-text-hint');
    if (textHint) {
      textHint.textContent = isVoice
        ? '自己写下这段语音的内容，会显示在语音下方。'
        : '一行一张字卡，可一次粘贴多行批量添加。';
    }
    const textArea = el('#card-text');
    if (textArea) {
      textArea.placeholder = isVoice
        ? '写下这段语音说的话，TA 发语音时会显示在下方…'
        : '写一句想被随机说出口的话…';
    }

    const fileInput = el('#card-audio-file');
    if (fileInput) fileInput.value = '';
    const preview = el('#card-audio-preview');
    if (preview) {
      preview.pause();
      preview.hidden = true;
      preview.removeAttribute('src');
      if (isVoice && card && card.audio) {
        preview.hidden = false;
        App.voiceSrc(card.audio).then(function (src) {
          if (!src) return;
          preview.src = src;
          preview.load();
        }).catch(function () {});
      } else {
        preview.load();
      }
    }
    el('#card-audio-hint').textContent = card && card.audio
      ? '已保存一段语音（重新选择可替换），下面是试听。'
      : '还没有语音，请选择一段 mp3 文件';
  }

  function openCardDialog(card, presetCategory) {
    editingCard = card || null;
    el('#card-dialog-title').textContent = card ? '编辑字卡' : (presetCategory === '语音' ? '导入语音' : '新建字卡');
    el('#card-text').value = card ? card.text : '';
    el('#card-cat').value = card ? card.category : (presetCategory || '聊天');
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

  function importCards(file, fallbackCategory) {
    const pickedCat = App.CATEGORIES.indexOf(fallbackCategory) !== -1 && fallbackCategory !== '语音'
      ? fallbackCategory
      : '';
    const filterCat = pickedCat || (App.cardFilter && App.cardFilter.cat !== '全部' && App.cardFilter.cat !== '语音'
      ? App.cardFilter.cat
      : '');
    App.readJSONFile(file).then(async function (data) {
      const incoming = Array.isArray(data) ? data : (data && data.cards);
      if (!Array.isArray(incoming)) throw new Error('文件里没有找到字卡');

      const existing = existingTextKeys();
      const normalized = [];
      for (let i = 0; i < incoming.length; i++) {
        const item = incoming[i];
        if (!item || typeof item !== 'object') continue;
        const text = String(item.text || '').trim();
        if (!text) continue;
        const category = App.CATEGORIES.indexOf(item.category) !== -1 ? item.category : (filterCat || '聊天');
        let audio = '';
        if (category === '语音' && typeof item.audio === 'string' && item.audio.indexOf('data:audio') === 0) {
          audio = await App.saveVoiceDataUrl(item.audio);
        }
        normalized.push({ item: item, text: text, category: category, audio: audio });
      }

      let added = 0;
      let duplicated = 0;
      normalized.forEach(function (entry) {
        const key = cardKey(entry.category, entry.text, entry.audio);
        if (existing[key]) {
          duplicated++;
          return;
        }
        const card = {
          id: App.uid('card'),
          text: entry.text,
          category: entry.category,
          trigger: String(entry.item.trigger || '').slice(0, 40),
          enabled: entry.item.enabled !== false,
          builtin: false,
        };
        if (entry.category === '情绪') {
          card.emotion = String(entry.item.emotion || '平常').slice(0, 12);
        }
        if (entry.audio) card.audio = entry.audio;
        App.state.cards.unshift(card);
        existing[key] = true;
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

  function exitBatch() {
    batchMode = false;
    selected = {};
    const input = el('#card-batch-trigger');
    if (input) input.value = '';
    App.renderCards();
  }

  function mergeTriggers(existing, incoming) {
    const parts = [];
    function push(value) {
      const text = String(value || '').trim();
      if (text && parts.indexOf(text) === -1) parts.push(text);
    }
    String(existing || '').split(/[/／]/).forEach(push);
    String(incoming || '').split(/[/／]/).forEach(push);
    return parts.join('/').slice(0, 40);
  }

  function applyBatchTrigger() {
    const input = el('#card-batch-trigger');
    const value = input ? input.value.trim().slice(0, 40) : '';
    const ids = Object.keys(selected);
    if (!ids.length) {
      App.toast('先点选要修改的字卡');
      return;
    }
    if (!value) {
      App.toast('先写触发词');
      if (input) input.focus();
      return;
    }
    let count = 0;
    ids.forEach(function (id) {
      const card = findCard(id);
      if (!card) return;
      card.trigger = mergeTriggers(card.trigger, value);
      count++;
    });
    App.save();
    App.renderDesktop();
    exitBatch();
    App.toast('已为 ' + count + ' 张字卡追加触发词');
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
    /* 恢复内置卡时顺手清掉内容和内置卡重复的导入卡 */
    if (App.dedupeBuiltinCards) App.dedupeBuiltinCards(App.state);
    App.save();
    App.renderCards();
    App.renderDesktop();
    App.toast(added ? '已恢复 ' + added + ' 张内置字卡' : '内置字卡都在');
  }

  App.initCards = function () {
    fillCategories();

    dialog.addEventListener('close', function () {
      const preview = el('#card-audio-preview');
      if (preview) {
        preview.pause();
        preview.removeAttribute('src');
        preview.hidden = true;
        preview.load();
      }
    });

    let searchTimer = 0;
    el('#card-search').addEventListener('input', function (e) {
      const value = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        App.cardFilter.q = value;
        App.renderCards();
      }, 120);
    });

    el('#card-cat').addEventListener('change', function (e) {
      toggleExtraFields(e.target.value, editingCard);
    });

    el('#card-audio-file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      const preview = el('#card-audio-preview');
      if (!preview) return;
      if (!file) {
        preview.hidden = true;
        preview.removeAttribute('src');
        preview.load();
        return;
      }
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      el('#card-audio-hint').textContent = '已选择 ' + file.name + '，可以试听。';
    });

    el('#card-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const category = el('#card-cat').value;
      const rawText = el('#card-text').value;
      /* 新建时一行一张字卡，一次可粘贴多行批量添加；编辑或语音卡只处理当前这一张。 */
      const texts = (editingCard || category === '语音' ? [rawText] : rawText.split(/\r?\n/))
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
      if (!texts.length) {
        el('#card-text').focus();
        return;
      }
      const trigger = el('#card-trigger').value.trim().slice(0, 40);
      const emotion = el('#card-emotion').value.trim().slice(0, 12) || '平常';

      let audio = '';
      if (category === '语音') {
        const file = el('#card-audio-file').files && el('#card-audio-file').files[0];
        if (file) {
          try {
            audio = await App.saveVoiceDataUrl(await fileToDataURL(file));
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
        } else {
          delete card.emotion;
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
          const key = cardKey(category, text, audio);
          if (existing[key]) {
            duplicated++;
            return false;
          }
          existing[key] = true;
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
      const cards = JSON.parse(JSON.stringify(App.state.cards));
      App.inlineVoice(cards).catch(function () { return cards; }).then(function (list) {
        App.downloadJSON({
          app: 'xuyu',
          type: 'cards',
          exportedAt: new Date().toISOString(),
          cards: list,
        }, 'xuyu-cards-' + App.stamp() + '.json');
      });
    });

    el('#btn-dedupe-cards').addEventListener('click', function () {
      const removed = dedupeCards();
      App.toast(removed ? '已删除 ' + removed + ' 张重复字卡' : '没有重复的字卡');
    });

    el('#btn-batch-trigger').addEventListener('click', function () {
      if (batchMode) {
        exitBatch();
        return;
      }
      batchMode = true;
      selected = {};
      const input = el('#card-batch-trigger');
      if (input) input.value = '';
      App.renderCards();
      setTimeout(function () { if (input) input.focus(); }, 60);
    });

    el('#card-batch-cancel').addEventListener('click', exitBatch);
    el('#card-batch-apply').addEventListener('click', applyBatchTrigger);
    el('#card-batch-trigger').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBatchTrigger();
      }
    });

    el('#btn-import-cards').addEventListener('click', function () {
      const cat = App.cardFilter && App.cardFilter.cat !== '全部' ? App.cardFilter.cat : '';
      openCardDialog(null, cat || undefined);
    });

    el('#card-import-file-btn').addEventListener('click', function () {
      el('#file-import-cards').click();
    });

    el('#file-import-cards').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      const dialog = el('#card-dialog');
      if (file) importCards(file, el('#card-cat') ? el('#card-cat').value : '');
      e.target.value = '';
      if (dialog && dialog.open) dialog.close();
    });

    el('#btn-restore-cards').addEventListener('click', restoreBuiltins);

    document.addEventListener('click', function (e) {
      const chip = e.target.closest('[data-cat]');
      if (chip) {
        App.cardFilter.cat = chip.dataset.cat;
        App.renderCards();
        return;
      }
      if (e.target.closest('[data-import-voice]')) {
        openCardDialog(null, '语音');
        return;
      }
      const batchCard = e.target.closest('[data-batch-toggle]');
      if (batchCard) {
        const id = batchCard.dataset.batchToggle;
        if (selected[id]) delete selected[id];
        else selected[id] = true;
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
