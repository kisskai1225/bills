/* 月度账单合并器 — 离线缓存 */
const CACHE = 'bills-v1';
const ASSETS = ['./manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const c = await caches.open(CACHE);

    // 页面本身走网络优先：改了版本，刷新就能看到新的，不会被旧缓存卡住
    const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    if (isDoc) {
      try {
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await c.match(req, { ignoreSearch: true }) || await c.match('./');
        if (hit) return hit;
        throw err;
      }
    }

    const hit = await c.match(req, { ignoreSearch: true });

    if (hit) {
      // 后台悄悄更新，下次打开就是新版
      fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
      return hit;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      const fallback = await c.match('./');
      if (fallback) return fallback;
      throw err;
    }
  })());
});