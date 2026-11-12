/* EFC service worker: önce internet, yoksa son kopya. Güncellemeler gecikmez. */
var SURUM = "efc-v3";

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

/* PUSH: yönetici duyuru yayınlayınca bildirim sunucusu cihaza boş bir "push" yollar; burada son duyuruyu Firebase'ten okuyup
   yönetici imzasını doğrular ve bildirim olarak gösteririz (imza tutmazsa genel bir bildirim gösterilir). */
var FB_URL = "https://efcgures-default-rtdb.europe-west1.firebasedatabase.app";
var DK_PUB = {"key_ops":["verify"],"ext":true,"kty":"EC","x":"_KVAbShgYeDfI9oFymDrkOw-f_betKDw5pXMOwnyMeY","y":"XvUx1TgLiw0OotBN_BjGTiOqCwZSGU5lrHZTWBcZa9E","crv":"P-256"};
function ub64(t) { var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

async function pushGoster() {
  var metin = "Duyurular sayfasından okuyabilirsin.", tag = "duy-yeni";
  try {
    var r = await fetch(FB_URL + '/duyuru.json?orderBy="$key"&limitToLast=10', { cache: "no-store" });
    var o = await r.json();
    var k = await crypto.subtle.importKey("jwk", DK_PUB, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    var en = null;
    for (var id in (o || {})) {
      var x = o[id];
      try {
        var ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, ub64(x.s), new TextEncoder().encode(JSON.stringify([x.m, x.z, x.y])));
        if (ok && (!en || x.z > en.z)) en = { id: id, m: String(x.m), z: x.z };
      } catch (e) {}
    }
    if (en) { metin = en.m.length > 140 ? en.m.slice(0, 137) + "…" : en.m; tag = "duy-" + en.id; }
  } catch (e) {}
  await self.registration.showNotification("📢 Yeni duyuru", { body: metin, tag: tag, icon: "icon.svg", badge: "icon.svg", data: { url: "./#duyurular" } });
}
self.addEventListener("push", function (e) { e.waitUntil(pushGoster()); });

/* Bildirime dokununca siteyi aç / öne getir */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (l) {
      for (var i = 0; i < l.length; i++) { if ("focus" in l[i]) return l[i].focus(); }
      return self.clients.openWindow(url);
    })
  );
});
