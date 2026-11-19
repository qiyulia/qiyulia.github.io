/* 文件选择兜底：部分移动浏览器（尤其 Android WebView / 各类定制 ROM）
   从系统相册或文件管理器返回后，只让页面重新获得焦点，却不派发 input 的 change，
   于是业务代码收不到文件，表现为「打开了相册 / 正在打开相册… → 没有收到图片」。
   这是所有 import（表情包、图片、语音、头像、背景、导入备份…）的共性根因。

   统一兜底：页面回到前台时，凡是「已经选中文件、但这批文件还没交付过」的
   file input，补派发一次 change，让原有的处理逻辑照常跑。
   用 File 对象引用做幂等：无论原生 change 与补派发 change 谁先谁后，
   同一批文件都只会被业务代码处理一次，不会重复导入。 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var delivered = typeof WeakSet === 'function' ? new WeakSet() : null;
  var legacy = delivered ? null : [];

  function isFileInput(node) {
    return !!node && node.nodeType === 1 && node.tagName === 'INPUT' &&
      String(node.type || '').toLowerCase() === 'file';
  }
  function firstFile(input) {
    try {
      var f = input && input.files;
      return f && f.length ? f[0] : null;
    } catch (e) { return null; }
  }
  function seen(f) {
    if (!f) return false;
    return delivered ? delivered.has(f) : legacy.indexOf(f) !== -1;
  }
  function mark(f) {
    if (!f) return;
    if (delivered) delivered.add(f);
    else legacy.push(f);
  }

  /* 捕获阶段先于业务监听执行：记录这一批文件；若已交付过就拦掉重复的那次。
     （补派发 change 之后原生 change 又姗姗来迟时，靠这里防重复导入） */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!isFileInput(t)) return;
    var f = firstFile(t);
    if (!f) return;                 /* 用户取消选择，交给业务自己 return */
    if (seen(f)) {
      try { e.stopImmediatePropagation(); } catch (err) {}
      return;
    }
    mark(f);
  }, true);

  /* 页面回到前台：检查有没有「拿到文件却没走 change」的输入框。
     补派发的 change 会经过上面的捕获监听完成 mark + 放行，业务照常处理。 */
  function sweep() {
    var list;
    try { list = document.querySelectorAll('input[type="file"]'); }
    catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      var input = list[i];
      var f = firstFile(input);
      if (!f || seen(f)) continue;
      try {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {}
    }
  }

  /* 相册关闭 / 切回页面的时机在不同浏览器上不一致，多探几次（彼此幂等）。 */
  function schedule() {
    setTimeout(sweep, 80);
    setTimeout(sweep, 450);
    setTimeout(sweep, 1200);
  }

  window.addEventListener('focus', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedule();
  });
})();
