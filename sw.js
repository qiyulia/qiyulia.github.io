/* 拾忆：通知弹窗与后台保活 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

/* 页面通过 postMessage 触发通知，页面切到后台也能留在通知栏 */
self.addEventListener('message', function (event) {
  const data = event.data || {};
  if (data.type !== 'notify') return;
  event.waitUntil(self.registration.showNotification(data.title || '拾忆', {
    body: data.body || '',
    tag: data.tag || 'shiyi-message',
    data: { url: data.url || './' },
  }));
});

/* 安卓 Chrome 周期后台任务：定期留一条提醒，证明后台还在 */
self.addEventListener('periodicsync', function (event) {
  if (event.tag !== 'shiyi-keepalive') return;
  event.waitUntil(self.registration.showNotification('拾忆还在后台', {
    body: '回来看看 TA 吧。',
    tag: 'shiyi-keepalive',
    data: { url: './' },
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (let i = 0; i < list.length; i++) {
      const client = list[i];
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
