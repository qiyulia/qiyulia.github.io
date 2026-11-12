/* 桌面与联系人 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  function greeting(hour) {
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 23) return '晚上好';
    return '夜深了';
  }

  function pickDailyCard() {
    const enabled = App.state.cards.filter(function (c) { return c.enabled && c.text; });
    if (!enabled.length) return null;
    const now = new Date();
    const key = '' + now.getFullYear() + (now.getMonth() + 1) + now.getDate();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return enabled[hash % enabled.length];
  }

  App.renderDesktop = function () {
    const st = App.state;
    const now = new Date();
    el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    el('#d-date').textContent = App.fmtDate(now);
    el('#d-greeting').textContent = greeting(now.getHours());
    el('#d-days').textContent = App.daysSince(st.profile.since);
    el('#d-since').textContent = st.profile.since ? '自 ' + st.profile.since.replace(/-/g, '.') : '';

    const daily = pickDailyCard();
    el('#d-today-card').textContent = daily ? daily.text : '字卡库空空的，去添几张吧。';

    renderStrip();
    App.renderContacts();
    App.updateBadges();
  };

  function renderStrip() {
    const box = el('#d-contacts');
    const people = App.state.contacts.slice(0, 10);
    let html = people.map(function (c) {
      return '<button type="button" class="strip-person" data-open-chat="' + c.id + '">' +
        '<span class="avatar">' + App.esc(c.avatar || '🙂') + '</span>' +
        '<span class="strip-name">' + App.esc(c.name) + '</span>' +
        '</button>';
    }).join('');
    html += '<button type="button" class="strip-person is-add" data-add-contact>' +
      '<span class="avatar">＋</span><span class="strip-name">添加</span></button>';
    box.innerHTML = html;
  }

  App.renderContacts = function () {
    const list = el('#contact-list');
    const empty = el('#contact-empty');
    const contacts = App.state.contacts;

    if (!contacts.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = contacts.map(function (c) {
      const last = App.lastMessage(c.id);
      const unread = App.unread[c.id] || 0;
      const snippet = last
        ? (last.role === 'me' ? '我：' : '') + last.text
        : (c.note || '还没有聊天记录');
      return '<div class="contact-row">' +
        '<button type="button" class="contact-hit" data-open-chat="' + c.id + '">' +
          '<span class="avatar">' + App.esc(c.avatar || '🙂') + '</span>' +
          '<span class="contact-info">' +
            '<span class="contact-line"><strong>' + App.esc(c.name) + '</strong>' +
            '<span class="contact-time">' + (last ? App.fmtTime(last.ts) : '') + '</span></span>' +
            '<span class="contact-snippet">' + App.esc(snippet) + '</span>' +
          '</span>' +
          (unread ? '<span class="dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
        '</button>' +
        '<button type="button" class="mini-btn contact-edit" data-edit-contact="' + c.id + '" aria-label="编辑联系人">✎</button>' +
        '</div>';
    }).join('');
  };

  /* ---------- 联系人弹窗 ---------- */
  let editingContact = null;
  const dialog = el('#contact-dialog');
  const form = el('#contact-form');

  function openContactDialog(contact) {
    editingContact = contact || null;
    el('#contact-dialog-title').textContent = contact ? '编辑联系人' : '新建联系人';
    el('#contact-name').value = contact ? contact.name : '';
    el('#contact-avatar').value = contact ? (contact.avatar || '') : '🙂';
    el('#contact-note').value = contact ? (contact.note || '') : '';
    el('#contact-delete').hidden = !contact;
    dialog.showModal();
    setTimeout(function () { el('#contact-name').focus(); }, 60);
  }

  function saveContact(e) {
    e.preventDefault();
    const name = el('#contact-name').value.trim();
    if (!name) {
      el('#contact-name').focus();
      return;
    }
    const avatar = el('#contact-avatar').value.trim() || '🙂';
    const note = el('#contact-note').value.trim();

    if (editingContact) {
      editingContact.name = name;
      editingContact.avatar = avatar;
      editingContact.note = note;
    } else {
      const contact = { id: App.uid('c'), name: name, avatar: avatar, note: note };
      App.state.contacts.push(contact);
      App.state.chats[contact.id] = [];
    }

    App.save();
    dialog.close();
    App.renderDesktop();
    App.toast(editingContact ? '已更新联系人' : '已添加联系人');
    editingContact = null;
  }

  function deleteContact() {
    if (!editingContact) return;
    if (!confirm('删除「' + editingContact.name + '」和这段对话？此操作不可撤销。')) return;
    const id = editingContact.id;
    App.state.contacts = App.state.contacts.filter(function (c) { return c.id !== id; });
    delete App.state.chats[id];
    delete App.unread[id];
    if (App.chatContactId === id) App.chatContactId = null;
    App.save();
    dialog.close();
    editingContact = null;
    App.renderDesktop();
    App.toast('已删除联系人');
  }

  App.initDesktop = function () {
    setInterval(function () {
      const now = new Date();
      el('#d-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }, 1000 * 20);

    el('#d-manage').addEventListener('click', function () { App.go('contacts'); });
    el('#btn-add-contact').addEventListener('click', function () { openContactDialog(null); });
    el('#btn-add-contact-2').addEventListener('click', function () { openContactDialog(null); });
    form.addEventListener('submit', saveContact);
    el('#contact-delete').addEventListener('click', deleteContact);

    document.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit-contact]');
      if (edit) {
        const contact = App.state.contacts.find(function (c) { return c.id === edit.dataset.editContact; });
        if (contact) openContactDialog(contact);
        return;
      }
      const person = e.target.closest('[data-open-chat]');
      if (person) {
        App.openChat(person.dataset.openChat);
        return;
      }
      const add = e.target.closest('[data-add-contact]');
      if (add) openContactDialog(null);
    });
  };
})();
