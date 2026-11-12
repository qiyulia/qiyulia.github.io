/* 本机朋友圈 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  App.renderMoments = function () {
    if (!Array.isArray(App.state.moments)) App.state.moments = [];
    const profile = App.state.profile;
    el('#m-avatar').textContent = profile.userAvatar || '🍊';

    const moments = App.state.moments.slice().sort(function (a, b) { return b.ts - a.ts; });
    el('#moment-empty').hidden = moments.length > 0;
    el('#moment-list').innerHTML = moments.map(function (moment) {
      const id = App.esc(moment.id);
      return '<article class="moment-card">' +
        '<div class="moment-card-head">' +
          '<span class="avatar">' + App.esc(profile.userAvatar || '🍊') + '</span>' +
          '<strong>' + App.esc(profile.userName || '我') + '</strong>' +
        '</div>' +
        '<p class="moment-card-text">' + App.esc(moment.text) + '</p>' +
        '<div class="moment-card-foot">' +
          '<time class="moment-time">' + App.fmtDate(new Date(moment.ts)) + ' · ' + App.fmtTime(moment.ts) + '</time>' +
          '<button type="button" class="moment-action moment-like' + (moment.liked ? ' is-active' : '') + '" data-moment-like="' + id + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
            '<span>' + (moment.liked ? '已喜欢' : '喜欢') + '</span>' +
          '</button>' +
          '<button type="button" class="moment-action moment-delete" data-moment-delete="' + id + '">删除</button>' +
        '</div>' +
      '</article>';
    }).join('');
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
      App.state.moments.unshift({ id: App.uid('m'), text: text, ts: Date.now(), liked: false });
      App.save();
      form.reset();
      el('#moment-count').textContent = '0 / 300';
      App.renderMoments();
      App.toast('动态已发布');
    });

    el('#moment-focus').addEventListener('click', function () {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    el('#moment-list').addEventListener('click', function (e) {
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
  };
})();
