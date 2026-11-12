/* EFC service worker: önce internet, yoksa son kopya. Güncellemeler gecikmez. */
var SURUM = "efc-v2";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SURUM).then(function (c) { return c.addAll(["./", "manifest.json", "icon.svg"]); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (l) {
      return Promise.all(l.filter(function (k) { return k.indexOf("efc-v") === 0 && k !== SURUM; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (r.headers.has("range") || r.destination === "audio" || r.destination === "video") return;
  if (/\.(mp3|m4a|ogg|wav)$/i.test(u.pathname)) return;
  e.respondWith(
    fetch(r).then(function (res) {
      if (res && res.ok) { var k = res.clone(); caches.open(SURUM).then(function (c) { c.put(r, k); }); }
      return res;
    }).catch(function () {
      return caches.match(r).then(function (hit) {
        return hit || (r.mode === "navigate" ? caches.match("./") : undefined);
      });
    })
  );
});

/* Bildirime dokununca siteyi aç / öne getir */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (l) {
      for (var i = 0; i < l.length; i++) { if ("focus" in l[i]) return l[i].focus(); }
      return self.clients.openWindow("./");
    })
  );
});
