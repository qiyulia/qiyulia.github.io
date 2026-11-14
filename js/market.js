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

  function postGift(product, side) {
    const contact = currentContact();
    if (!contact) {
      App.toast('先在联系人里添加一个角色');
      return false;
    }
    const chat = App.state.chats[contact.id] || (App.state.chats[contact.id] = []);
    chat.push({
      id: App.uid('m'),
      role: side,
      type: 'gift',
      productName: product.name,
      price: product.price,
      status: 'pending',
      ts: Date.now(),
    });
    App.save();
    const open = App.chatContactId === contact.id && el('#view-chat').classList.contains('is-active');
    if (open) App.renderChat();
    else {
      App.unread[contact.id] = (App.unread[contact.id] || 0) + 1;
      App.updateBadges();
      App.renderContacts();
    }
    return true;
  }

  function subsidy(side) {
    const amount = 20 + Math.floor(Math.random() * 181);
    App.state.wallet[side] += amount;
    App.save();
    App.renderMarket();
    postSystem('次元银行为' + (side === 'me' ? '你' : '他') + '补贴 ' + amount + ' 同心币');
    App.toast('次元银行补贴 ' + amount + ' 同心币');
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
    list.innerHTML = items.length
      ? items.map(function (p) {
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
              '<button type="button" class="market-remove" data-market-del="' + p.id + '" aria-label="下架商品">×</button>' +
            '</div>' +
          '</article>';
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
      if (!name || !(price > 0)) {
        App.toast('先写好商品名和价格');
        return;
      }
      products().unshift({
        id: App.uid('p'),
        name: name,
        price: price,
        icon: icon,
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

      if (App.state.wallet[side] < product.price) {
        App.toast('同心币不够，先领点补贴吧');
        return;
      }

      if (buyBtn) {
        App.state.wallet[side] -= product.price;
        App.save();
        App.renderMarket();
        postSystem(who(side) + '买下了「' + product.name + '」，花掉 ' + product.price + ' 同心币');
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
  };
})();
