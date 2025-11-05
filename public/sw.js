// 서비스 워커 - PWA 지원
const CACHE_NAME = 'forum-v1';
const STATIC_CACHE_URLS = [
    '/',
    '/css/style.css',
    '/js/main.js',
    'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css',
    'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// 설치 이벤트
self.addEventListener('install', event => {
    console.log('Service Worker 설치 중...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('캐시 열기 성공');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .catch(error => {
                console.error('캐시 추가 실패:', error);
            })
    );
});

// 활성화 이벤트
self.addEventListener('activate', event => {
    console.log('Service Worker 활성화 중...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('오래된 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
    // GET 요청만 캐시 처리
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 캐시에 있으면 캐시된 버전 반환
                if (response) {
                    return response;
                }

                // 캐시에 없으면 네트워크에서 가져오기
                return fetch(event.request)
                    .then(response => {
                        // 유효한 응답인지 확인
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 응답 복사 (스트림은 한 번만 사용 가능)
                        const responseToCache = response.clone();

                        // 정적 리소스만 캐시에 추가
                        if (shouldCache(event.request.url)) {
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return response;
                    })
                    .catch(error => {
                        console.error('네트워크 요청 실패:', error);

                        // 오프라인 상태에서 기본 페이지 반환
                        if (event.request.destination === 'document') {
                            return caches.match('/');
                        }
                    });
            })
    );
});

// 캐시할 리소스인지 판단
function shouldCache(url) {
    // 정적 리소스 (CSS, JS, 이미지) 캐시
    return url.includes('/css/') ||
           url.includes('/js/') ||
           url.includes('/images/') ||
           url.includes('cdn.jsdelivr.net');
}

// 백그라운드 동기화 (향후 구현)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('백그라운드 동기화 실행');
        // 오프라인 상태에서 작성된 게시글/댓글 동기화
    }
});

// 푸시 알림 (향후 구현)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        console.log('푸시 알림 수신:', data);

        const options = {
            body: data.body,
            icon: '/images/icon-192x192.png',
            badge: '/images/badge-72x72.png',
            tag: data.tag || 'forum-notification',
            requireInteraction: false,
            actions: [
                {
                    action: 'view',
                    title: '보기'
                },
                {
                    action: 'dismiss',
                    title: '닫기'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'view') {
        // 알림 클릭 시 해당 페이지로 이동
        event.waitUntil(
            clients.openWindow(event.notification.data?.url || '/')
        );
    }
});