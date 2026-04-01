const CACHE_NAME = 'fiden-agency-v1.0.0';
const OFFLINE_URL = '/offline.html';
const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

// Assets para cache imediato (App Shell)
const STATIC_CACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Rotas públicas que funcionam offline
const PUBLIC_ROUTES = [
  '/',
  '/barbershops',
  '/client-login',
  '/register',
  '/forgot-password'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(STATIC_CACHE_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Assets estáticos em cache');
        // REMOVIDO: skipWaiting automático para melhor UX
        // return self.skipWaiting();
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativando...');
  
  event.waitUntil(
    Promise.all([
      // Remove caches antigos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Limpa entradas de cache expiradas
      caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests.map((request) => {
              return cache.match(request).then((response) => {
                if (response) {
                  const dateHeader = response.headers.get('date');
                  const cacheDate = dateHeader ? new Date(dateHeader).getTime() : 0;
                  const now = Date.now();
                  
                  if (now - cacheDate > CACHE_EXPIRY_TIME) {
                    console.log('Service Worker: Removendo cache expirado:', request.url);
                    return cache.delete(request);
                  }
                }
              });
            })
          );
        });
      })
    ]).then(() => {
      // REMOVIDO: claim imediato que causava refresh automático
      // return self.clients.claim();
      console.log('Service Worker: Ativado sem claim imediato');
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorar requisições que não são do mesmo origin
  if (url.origin !== location.origin) {
    return;
  }
  
  // Estratégia para páginas HTML
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Se a requisição foi bem-sucedida, cache e retorna
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Se offline, tenta buscar no cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Se não está em cache e é uma rota pública, mostra página offline
              const pathname = url.pathname;
              const isPublicRoute = PUBLIC_ROUTES.some(route => 
                pathname === route || pathname.startsWith(route + '/')
              );
              
              if (isPublicRoute) {
                return caches.match(OFFLINE_URL);
              }
              
              // Para rotas privadas offline, retorna erro
              return new Response('Você precisa estar online para acessar esta página.', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }
  
  // Estratégia para assets estáticos (CSS, JS, imagens)
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' || 
      event.request.destination === 'image') {
    
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
              return response;
            });
        })
    );
    return;
  }
  
  // Para API calls e outras requisições, sempre tenta online primeiro
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Se API falhar offline, retorna resposta de erro estruturada
          return new Response(JSON.stringify({
            error: 'Offline',
            message: 'Esta funcionalidade requer conexão com a internet.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
});

// Listener para mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Sync em background (quando voltar online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aqui você pode implementar sincronização de dados quando voltar online
      console.log('Service Worker: Sincronização em background')
    );
  }
});

// Notificações push (para futuras implementações)
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'explore',
          title: 'Ver detalhes',
          icon: '/icons/checkmark.png'
        },
        {
          action: 'close',
          title: 'Fechar',
          icon: '/icons/xmark.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('Fiden Agency', options)
    );
  }
});

// Clique em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});