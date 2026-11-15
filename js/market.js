/* 集市：同心币钱包、次元银行补贴与商品互动 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function products() {
    return App.state.market.products;
  }

  function currentContact() {
    return App.state.contacts.find(function (c) {
      return c.id === App.state.currentContactId;
    }) || App.state.contacts[0] || null;
  }

  function taName() {
    const contact = currentContact();
    return contact ? contact.name : 'TA';
  }

  function who(side) {
    return side === 'me' ? '你' : taName();
  }

  function postSystem(text) {
    const contact = currentContact();
    if (!contact) {
      App.toast('先在联系人里添加一个角色');
      return false;
    }
    App.addChatSystemMessage(contact.id, text);
    return true;
  }

  /* 往聊天里塞一条消息；聊天开着就直接刷新，否则累计未读 */
  function pushChatMessage(contact, message) {
    const chat = App.state.chats[contact.id] || (App.state.chats[contact.id] = []);
    chat.push(message);
    App.save();
    if (App.chatContactId === contact.id && el('#view-chat').classList.contains('is-active')) {
      App.renderChat();
    } else {
      App.unread[contact.id] = (App.unread[contact.id] || 0) + 1;
      App.updateBadges();
      App.renderContacts();
    }
  }

  function postGift(product, side) {
    const contact = currentContact();
    if (!contact) {
      App.toast('先在联系人里添加一个角色');
      return false;
    }
    pushChatMessage(contact, {
      id: App.uid('m'),
      role: side,
      type: 'gift',
      productName: product.name,
      price: product.price,
      status: 'pending',
      ts: Date.now(),
    });
    return true;
  }

  /* 许愿卡：想要集市里的某件商品，等对方买下来 */
  function postWish(product, side) {
    const contact = currentContact();
    if (!contact) {
      App.toast('先在联系人里添加一个角色');
      return false;
    }
    pushChatMessage(contact, {
      id: App.uid('m'),
      role: side,
      type: 'wish',
      productName: product.name,
      price: product.price,
      icon: product.icon || '🛍️',
      status: 'pending',
      ts: Date.now(),
    });
    return true;
  }

  /* 买下商品后放到聊天里的卡片 */
  function postPurchase(product, side) {
    const contact = currentContact();
    if (!contact) return false;
    pushChatMessage(contact, {
      id: App.uid('m'),
      role: side,
      type: 'marketBuy',
      productName: product.name,
      price: product.price,
      icon: product.icon || '🛍️',
      status: 'done',
      ts: Date.now(),
    });
    return true;
  }

  function marketProb(key, fallback) {
    const settings = App.state.settings || {};
    return settings[key] == null ? fallback : Math.max(0, Math.min(100, Number(settings[key]) || 0));
  }

  const TA_MARKET_TICK = 60000;
  const TA_MARKET_COOLDOWN = 6 * 60000;

  /* TA 在集市里的自发行为：送礼物、买下、许愿、收藏、替我买单 */
  function taMarketTick() {
    if (!Array.isArray(App.state.market.products) || !products().length) return;
    const contact = currentContact();
    if (!contact) return;
    const now = Date.now();
    if (now - (Number(App.state.settings.taMarketLastAt) || 0) < TA_MARKET_COOLDOWN) return;

    const wallet = App.state.wallet;
    const affordable = products().filter(function (p) { return Number(p.price) <= wallet.ta; });
    const favPool = products().filter(function (p) { return !(p.fav && p.fav.ta); });

    const actions = [
      { key: 'gift', prob: marketProb('taMarketGiftProb', 6) },
      { key: 'buy', prob: marketProb('taMarketBuyProb', 6) },
      { key: 'wish', prob: marketProb('taMarketWishProb', 8) },
      { key: 'fav', prob: marketProb('taMarketFavProb', 4) },
      { key: 'buyForMe', prob: marketProb('taMarketBuyForMeProb', 4) },
    ];
    const total = actions.reduce(function (sum, a) { return sum + a.prob; }, 0);
    if (total <= 0) return;
    let roll = Math.random() * total;
    let picked = actions[actions.length - 1];
    for (let i = 0; i < actions.length; i++) {
      roll -= actions[i].prob;
      if (roll <= 0) { picked = actions[i]; break; }
    }

    function randomOf(list) { return list[Math.floor(Math.random() * list.length)]; }
    let done = true;

    if (picked.key === 'gift') {
      if (!affordable.length) done = false;
      else {
        const product = randomOf(affordable);
        wallet.ta -= product.price;
        postGift(product, 'ta');
      }
    } else if (picked.key === 'buy') {
      if (!affordable.length) done = false;
      else {
        const product = randomOf(affordable);
        wallet.ta -= product.price;
        postPurchase(product, 'ta');
      }
    } else if (picked.key === 'wish') {
      postWish(randomOf(products()), 'ta');
    } else if (picked.key === 'fav') {
      const product = favPool.length ? randomOf(favPool) : randomOf(products());
      product.fav = product.fav && typeof product.fav === 'object' ? product.fav : { me: false, ta: false };
      product.fav.ta = true;
      App.save();
      postSystem(taName() + '收藏了「' + product.name + '」');
    } else if (picked.key === 'buyForMe') {
      const chat = App.state.chats[contact.id] || [];
      const wish = chat.slice().reverse().find(function (m) {
        return m.type === 'wish' && m.role === 'me' && m.status === 'pending';
      });
      if (!wish) done = false;
      else if (wallet.ta < Number(wish.price || 0)) done = false;
      else {
        wallet.ta -= Number(wish.price || 0);
        wish.status = 'fulfilled';
        postSystem(taName() + '给你买下了「' + (wish.productName || '礼物') + '」，花掉 ' + wish.price + ' 同心币');
      }
    }

    if (!done) return;
    App.state.settings.taMarketLastAt = now;
    App.save();
    if (el('#view-market').classList.contains('is-active')) App.renderMarket();
  }

  App.maybeTaMarket = taMarketTick;


  const SUBSIDY_MAX = 1000000000;

  function subsidy(side) {
    const input = el('#market-subsidy-amount');
    const raw = input ? String(input.value || '').trim() : '';
    const parsed = Math.round(Number(raw));
    if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
      App.toast('先输入补贴金额');
      if (input) input.focus();
      return;
    }
    const amount = Math.min(SUBSIDY_MAX, parsed);
    App.state.wallet[side] += amount;
    App.save();
    if (input) input.value = '';
    App.renderMarket();
    postSystem('次元银行为' + who(side) + '补贴 ' + amount + ' 同心币');
    App.toast('次元银行补贴 ' + amount + ' 同心币');
  }

  function categoryOf(product) {
    if (product.cat) return product.cat;
    const groups = App.MARKET_CATEGORIES || [];
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].ids.indexOf(product.id) !== -1) return groups[i].name;
    }
    return '其他';
  }

  function itemHtml(p) {
    const favMine = !!(p.fav && p.fav.me);
    const favTa = !!(p.fav && p.fav.ta);
    const favOn = App.marketAs === 'me' ? favMine : favTa;
    return '<article class="market-item">' +
      '<span class="market-item-icon">' + App.esc(p.icon || '🎁') + '</span>' +
      '<div class="market-item-main">' +
        '<strong>' + App.esc(p.name) + '</strong>' +
        '<span class="market-item-price">' + p.price + ' 同心币</span>' +
        '<div class="market-item-favs">' +
          '<span class="market-fav' + (favMine ? ' is-on' : '') + '">我 ♡</span>' +
          '<span class="market-fav' + (favTa ? ' is-on' : '') + '">' + App.esc(taName()) + ' ♡</span>' +
        '</div>' +
      '</div>' +
      '<div class="market-item-actions">' +
        '<button type="button" data-market-fav="' + p.id + '">' + (favOn ? '取消收藏' : '收藏') + '</button>' +
        '<button type="button" data-market-buy="' + p.id + '">买下</button>' +
        '<button type="button" data-market-gift="' + p.id + '">赠送</button>' +
        '<button type="button" data-market-wish="' + p.id + '">许愿</button>' +
        '<button type="button" class="market-remove" data-market-del="' + p.id + '" aria-label="下架商品">×</button>' +
      '</div>' +
    '</article>';
  }

  App.renderMarket = function () {
    if (!App.state.market || !el('#market-list')) return;
    el('#market-balance-me').textContent = App.state.wallet.me;
    el('#market-balance-ta').textContent = App.state.wallet.ta;
    el('#market-balance-ta-label').textContent = taName() + ' 的同心币';
    document.querySelectorAll('[data-market-as]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.marketAs === App.marketAs);
    });

    const list = el('#market-list');
    const items = products();
    const order = (App.MARKET_CATEGORIES || []).map(function (g) { return g.name; }).concat('其他');
    const groups = {};
    items.forEach(function (p) {
      const cat = categoryOf(p);
      (groups[cat] || (groups[cat] = [])).push(p);
    });
    list.innerHTML = items.length
      ? order.filter(function (cat) { return groups[cat] && groups[cat].length; }).map(function (cat) {
          return '<h3 class="market-group-title">' + App.esc(cat) + '</h3>' +
            groups[cat].map(itemHtml).join('');
        }).join('')
      : '<p class="market-empty">集市还是空的，上架一件商品吧。</p>';
  };

  function findProduct(id) {
    return products().find(function (p) { return p.id === id; });
  }

  App.initMarket = function () {
    if (App.marketAs == null) App.marketAs = 'me';

    el('#market-identity').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-market-as]');
      if (!btn) return;
      App.marketAs = btn.dataset.marketAs;
      App.renderMarket();
    });

    el('#market-subsidy-me').addEventListener('click', function () { subsidy('me'); });
    el('#market-subsidy-ta').addEventListener('click', function () { subsidy('ta'); });

    el('#market-add-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = el('#market-name').value.trim().slice(0, 20);
      const price = Math.round(Number(el('#market-price').value));
      const icon = el('#market-icon').value.trim().slice(0, 4) || '🎁';
      const catSelect = el('#market-cat');
      const cat = catSelect && catSelect.value ? catSelect.value : '其他';
      if (!name || !(price > 0)) {
        App.toast('先写好商品名和价格');
        return;
      }
      products().unshift({
        id: App.uid('p'),
        name: name,
        price: price,
        icon: icon,
        cat: cat,
        fav: { me: false, ta: false },
      });
      App.save();
      el('#market-add-form').reset();
      App.renderMarket();
      App.toast('已上架「' + name + '」');
    });

    el('#market-list').addEventListener('click', function (e) {
      const side = App.marketAs;
      const favBtn = e.target.closest('[data-market-fav]');
      const buyBtn = e.target.closest('[data-market-buy]');
      const giftBtn = e.target.closest('[data-market-gift]');
      const wishBtn = e.target.closest('[data-market-wish]');
      const delBtn = e.target.closest('[data-market-del]');

      if (delBtn) {
        const product = findProduct(delBtn.dataset.marketDel);
        if (!product) return;
        if (!confirm('把「' + product.name + '」下架？')) return;
        App.state.market.products = products().filter(function (p) { return p !== product; });
        App.save();
        App.renderMarket();
        App.toast('已下架「' + product.name + '」');
        return;
      }

      const product = favBtn ? findProduct(favBtn.dataset.marketFav)
        : buyBtn ? findProduct(buyBtn.dataset.marketBuy)
        : giftBtn ? findProduct(giftBtn.dataset.marketGift)
        : wishBtn ? findProduct(wishBtn.dataset.marketWish)
        : null;
      if (!product) return;

      if (favBtn) {
        product.fav = product.fav && typeof product.fav === 'object' ? product.fav : { me: false, ta: false };
        product.fav[side] = !product.fav[side];
        App.save();
        App.renderMarket();
        if (product.fav[side]) postSystem(who(side) + '收藏了「' + product.name + '」');
        else App.toast('已取消收藏');
        return;
      }

      if (wishBtn) {
        if (postWish(product, side)) {
          App.toast(side === 'me' ? '已把想要的发到聊天，等 TA 看见' : 'TA 在聊天里说想要「' + product.name + '」');
        }
        return;
      }

      if (App.state.wallet[side] < product.price) {
        App.toast('同心币不够，先领点补贴吧');
        return;
      }

      if (buyBtn) {
        App.state.wallet[side] -= product.price;
        App.save();
        postPurchase(product, side);
        App.renderMarket();
        App.toast('已买下「' + product.name + '」');
        return;
      }

      if (giftBtn) {
        App.state.wallet[side] -= product.price;
        App.save();
        if (postGift(product, side)) {
          App.renderMarket();
          App.toast(side === 'me' ? '礼物已送出，等 TA 领取' : 'TA 送了你一份礼物，去聊天里领取');
        }
      }
    });

    if (!App._marketTimer) App._marketTimer = setInterval(App.maybeTaMarket, TA_MARKET_TICK);
  };
})();
