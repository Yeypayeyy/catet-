// Service worker seadanya. Tujuannya cuma satu: app shell tetap terbuka saat
// koneksi hilang. Bukan menyimpan data.
//
// ATURAN YANG TIDAK BOLEH DILANGGAR: /api tidak pernah disentuh cache.
// Ini app keuangan — menampilkan saldo basi dari cache lebih berbahaya
// daripada menampilkan pesan gagal.

const CACHE = "catet-shell-v1";

self.addEventListener("install", (event) => {
  // Langsung ambil alih, jangan menunggu tab lama ditutup.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nama) => Promise.all(nama.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Data, autentikasi, dan ikon dinamis: selalu ke jaringan.
  if (url.pathname.startsWith("/api/")) return;

  // Berkas Next punya hash di namanya, jadi isinya tidak pernah berubah.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (tersimpan) =>
          tersimpan ??
          fetch(request).then((jawaban) => {
            if (jawaban.ok) {
              const salinan = jawaban.clone();
              caches.open(CACHE).then((c) => c.put(request, salinan));
            }
            return jawaban;
          }),
      ),
    );
    return;
  }

  // Halaman: jaringan dulu, cache cuma dipakai kalau jaringannya mati.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((jawaban) => {
          if (jawaban.ok) {
            const salinan = jawaban.clone();
            caches.open(CACHE).then((c) => c.put(request, salinan));
          }
          return jawaban;
        })
        .catch(() => caches.match(request).then((tersimpan) => tersimpan ?? caches.match("/review"))),
    );
  }
});
