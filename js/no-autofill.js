/* 抑制浏览器（尤其 Edge / Android）自带的自动填充 / 密码 / 地址 / 卡片快捷栏。
   键盘上方那一行「钥匙、卡片、头像」图标是浏览器系统 UI，网页不能直接删除，
   但可以给全站所有输入框显式声明「不自动填充」，让浏览器不再把它当作可填充表单。
   这里集中处理静态输入框，并用 MutationObserver + focusin 覆盖 JS 运行时动态生成的输入框。 */
(function () {
  var SEL = 'input, textarea, form, [contenteditable="true"]';

  function applyOne(node) {
    if (!node || node.nodeType !== 1) return;
    var tag = (node.tagName || '').toLowerCase();
    var editable = tag === 'input' || tag === 'textarea' || tag === 'form' ||
      node.getAttribute('contenteditable') === 'true';
    if (!editable) return;

    /* 文件选择框一律不参与防自动填充，而且这里要完全静默、连属性都不碰。
       原因：点击 file input 时 focusin 会先触发，如果此刻去改它的属性，
       部分浏览器（Edge、若干移动端 WebView）会认为元素被改动，
       直接把刚要打开的文件选择器取消掉——表现就是「点了没有任何反应」。
       文件框也不需要防自动填充，所以直接原样放过。 */
    if (tag === 'input' && String(node.type || '').toLowerCase() === 'file') return;

    node.setAttribute('autocomplete', 'off');
    if (tag === 'form') {
      node.setAttribute('data-lpignore', 'true');
      node.setAttribute('data-form-type', 'other');
      node.setAttribute('spellcheck', 'false');
      return;
    }
    node.setAttribute('autocorrect', 'off');
    node.setAttribute('autocapitalize', 'off');
    node.setAttribute('spellcheck', 'false');
    node.setAttribute('aria-autocomplete', 'none');
    node.setAttribute('data-lpignore', 'true');    /* LastPass */
    node.setAttribute('data-1p-ignore', 'true');   /* 1Password */
    node.setAttribute('data-bwignore', 'true');    /* Bitwarden */
    node.setAttribute('data-form-type', 'other');  /* 其它填充器 */

    /* 明确声明输入用途：普通文本 / 纯数字。
       不写的话，浏览器会按 id、placeholder 去猜「姓名、电话、地址」，
       猜中就把这个框当成可填充表单字段，弹出钥匙/卡片那一栏。 */
    if (tag === 'input' && !node.hasAttribute('inputmode')) {
      var t = String(node.type || '').toLowerCase();
      if (t === 'number') {
        node.setAttribute('inputmode', 'numeric');
      } else if (t !== 'search' && t !== 'url' && t !== 'tel' && t !== 'email' &&
                 t !== 'date' && t !== 'time' && t !== 'range' && t !== 'color' &&
                 t !== 'checkbox' && t !== 'hidden' && t !== 'button' &&
                 t !== 'submit' && t !== 'reset') {
        node.setAttribute('inputmode', 'text');
      }
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    applyOne(root);
    if (!root.querySelectorAll) return;
    var list = root.querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) applyOne(list[i]);
  }

  function start() {
    scan(document.documentElement || document.body);
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes;
          for (var j = 0; j < added.length; j++) scan(added[j]);
        }
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }
    /* 捕获阶段兜底：聚焦前再补一次，确保任何后插的输入框都已带上属性 */
    document.addEventListener('focusin', function (e) { applyOne(e.target); }, true);
  }

  /* 立即扫一次（此时 <body> 可能尚未解析完），DOM 就绪后再全量扫一次 */
  scan(document.documentElement);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
