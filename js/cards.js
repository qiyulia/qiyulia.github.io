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
    return '<div class="card-item" data-id="' + c.id + '">' +
      '<div class="card-main">' +
        '<p class="card-text">' + App.esc(c.text) + '</p>' +
        '<div class="card-meta">' +
          '<span class="tag">' + App.esc(c.category || '未分类') + '</span>' +
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

  function openCardDialog(card) {
    editingCard = card || null;
    el('#card-dialog-title').textContent = card ? '编辑字卡' : '新建字卡';
    el('#card-text').value = card ? card.text : '';
    el('#card-cat').value = card ? card.category : '日常';
    el('#card-trigger').value = card ? (card.trigger || '') : '';
    dialog.showModal();
    setTimeout(function () { el('#card-text').focus(); }, 60);
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

      const existing = {};
      App.state.cards.forEach(function (c) { existing[c.text.trim()] = true; });

      let added = 0;
      incoming.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        const text = String(item.text || '').trim();
        if (!text || existing[text]) return;
        const category = App.CATEGORIES.indexOf(item.category) !== -1 ? item.category : '日常';
        App.state.cards.unshift({
          id: App.uid('card'),
          text: text,
          category: category,
          trigger: String(item.trigger || '').slice(0, 10),
          enabled: item.enabled !== false,
          builtin: false,
        });
        existing[text] = true;
        added++;
      });

      App.save();
      App.renderCards();
      App.renderDesktop();
      App.toast(added ? '已导入 ' + added + ' 张字卡' : '没有新的字卡可导入');
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

    el('#btn-add-card').addEventListener('click', function () { openCardDialog(null); });

    el('#card-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const text = el('#card-text').value.trim();
      if (!text) {
        el('#card-text').focus();
        return;
      }
      const category = el('#card-cat').value;
      const trigger = el('#card-trigger').value.trim().slice(0, 10);

      if (editingCard) {
        editingCard.text = text;
        editingCard.category = category;
        editingCard.trigger = trigger;
      } else {
        App.state.cards.unshift({
          id: App.uid('card'),
          text: text,
          category: category,
          trigger: trigger,
          enabled: true,
          builtin: false,
        });
      }

      App.save();
      dialog.close();
      App.renderCards();
      App.renderDesktop();
      App.toast(editingCard ? '已更新字卡' : '已添加字卡');
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

    el('#btn-import-cards').addEventListener('click', function () {
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
