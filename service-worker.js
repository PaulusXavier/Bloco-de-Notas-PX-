const CACHE_NAME = 'bloco-notas-shell-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch((err) => console.error('Falha ao preparar cache do app shell:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: cache-first para o shell do app (HTML/CSS/JS/ícones), com
// atualização em segundo plano quando a rede responde (stale-while-revalidate).
// Chamadas ao Firebase (Auth/Firestore) sempre vão direto pra rede: o próprio
// SDK do Firestore cuida do cache/fila de escrita offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isFirebase = url.hostname.includes('firebase') || url.hostname.includes('googleapis');
  if (isFirebase || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Serve do cache na hora; atualiza em segundo plano se houver rede.
        networkFetch.catch(() => {});
        return cached;
      }

      // Sem cache: espera a rede; se falhar e for navegação, cai para a shell.
      return networkFetch.then((response) => {
        if (response) return response;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      });
    })
  );
});
