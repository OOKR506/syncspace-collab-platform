/* Syncspace - Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyC37x0rvRq_UAoHlGHRi9sgqNaWS5DiBsA",
  authDomain: "syncspace1-b39f5.firebaseapp.com",
  projectId: "syncspace1-b39f5",
  storageBucket: "syncspace1-b39f5.firebasestorage.app",
  messagingSenderId: "208059593618",
  appId: "1:208059593618:web:66e51aa5ca38278216c74b",
  measurementId: "G-N26PGJBXST"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
// 파일 업로드 기능(#7)용 Storage — firebase-storage-compat SDK가 로드된 경우에만 사용
var storage = (firebase.storage) ? firebase.storage() : null;
// 오프라인 읽기 캐시 — Firestore SDK 내장 퍼시스턴스 (기존 ss함수 전부 무수정으로 오프라인 자동 지원)
try{
  db.enablePersistence({synchronizeTabs:true}).catch(function(err){
    console.warn('오프라인 캐시 비활성:', err.code); // failed-precondition(다중 탭) / unimplemented(미지원 브라우저)
  });
}catch(e){}
console.log('🚀 Syncspace Firebase 연결!');
