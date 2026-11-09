/* Syncspace - 최소 서비스 워커 (설치 가능 요건 충족용) */
// 캐시 이름을 올릴 때마다(v2 -> v3) 예전 캐시는 activate 단계에서 자동 삭제됩니다.
// 사이드바 색상 등 UI 변경이 배포됐는데도 예전 화면이 보인다는 신고가 있어
// v3로 올리고, 오래된 캐시 정리 로직을 추가했습니다.
const CACHE_NAME = 'syncspace-shell-v10';
const SHELL_FILES = [
  './index.html','./app-v3.js','./i18n-en.js','./tailwind.css','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./icon-180.png',
  './firebase-config.js','./firebase-auth.js','./firebase-projects.js','./firebase-tasks.js',
  './firebase-calendar.js','./firebase-templates.js',
  './firebase-extras.js','./firebase-storage.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패 시 캐시 폴백 (오프라인에서도 기본 셸은 열리도록)
// index.html/app-v3.js 등 핵심 파일은 항상 캐시를 무시하고 네트워크에서 최신본을 받도록
// cache:'reload'를 명시해, 브라우저 디스크 캐시 때문에 배포 후에도 옛 화면이 보이는 문제를 줄입니다.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // 같은 도메인(우리 앱 파일)만 처리한다. Firestore/Auth 등 외부 실시간 통신은 가로채지 않는다.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((res) => {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
