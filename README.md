# Syncspace
 
팀 협업과 일정 관리를 한 화면에서 처리하는 팀 프로젝트 협업 플랫폼입니다. 4인 팀(Team Plus)이 졸업 작품으로 기획부터 개발까지 함께 진행했습니다.
 
🔗 **Live Demo**: https://syncspace1-b39f5.web.app/
👀 로그인 없이 **"게스트로 둘러보기"** 버튼으로 예시 데이터를 바로 확인할 수 있습니다. (읽기 전용, 서버에 아무것도 저장되지 않습니다)
 
---
 
## 📌 개요
 
팀 프로젝트를 진행할 때 작업 현황과 일정이 여러 곳에 흩어지는 문제를 자주 겪었습니다. Syncspace는 할 일 목록(칸반), 캘린더, 팀 채팅, 파트별 진행률을 한 곳에 모아, 팀의 하루 업무 흐름을 한 화면에서 파악할 수 있도록 설계했습니다.
 
## 🛠 기술 스택
 
- **Frontend**: HTML5, JavaScript (Vanilla JS), Tailwind CSS, Lucide 아이콘
- **Backend / Infra**: Firebase (Authentication, Firestore, Storage, Hosting)
- **PWA**: Service Worker + manifest (모바일 홈 화면 설치 지원)
- **디자인**: Figma Make로 만든 UI/UX를 실제 앱에 적용
## ✨ 주요 기능
 
- **대시보드** — 내 작업, 오늘의 일정 타임라인, 진행 중인 프로젝트 카드
- **내 작업** — 전체 · 오늘 마감 · 중요 · 완료 탭, 검색, 보드/리스트 전환
- **할 일 목록(칸반)** — 드래그 앤 드롭으로 작업 상태 이동
- **캘린더** — 날짜 격자 월간 보기, 일정 추가, 오늘로 이동
- **파트별 진행률** — 기획 · 디자인 · 프론트엔드 · 백엔드 · QA 중 파트를 선택해 본인이 직접 진행률(%)을 조절하는 방식
- **팀 멤버 / 팀 채팅** — 멤버 카드와 역할 관리, 프로젝트 전체 채널, @멘션
- **프로필** — 왼쪽 탭(계정 · 화면 · 알림 · 내 프로젝트 · 계정 삭제) 구조의 설정 화면
- **프로젝트 생성/수정/삭제**, 작업 담당자 지정, 작업 댓글, 다크모드, 반응형 디자인(모바일 지원)
- **게스트 모드** — 가입 없이 예시 프로젝트를 둘러보는 읽기 전용 모드
- **예시 프로젝트** — 프로젝트 생성 창의 "예시 프로젝트로 시작" 버튼으로 작업 · 일정 · 채팅이 채워진 프로젝트 생성
## 🧭 기술적 의사결정
 
- 초기에는 문서/Wiki, 간트차트, 타임트래커, 통계 리포트(번다운 · PDF)까지 기능을 폭넓게 넣었지만, 실제 사용 흐름에서 불필요하다고 판단한 것들을 과감히 제거해 메뉴를 **12개 → 8개**로 정리했습니다. 이후 사이드바 알림 메뉴와 언어 전환 기능도 정리했습니다.
- 진행률 계산 방식을 작업 개수 기반 자동 계산에서, 팀원이 **자신의 파트를 선택하고 진행률(%)을 직접 조절**하는 방식으로 바꿔, 체감 진행률과 실제 지표가 일치하도록 개선했습니다.
- 발표 전 교수님 피드백을 반영해 로그인 전 서비스 소개 화면을 추가했습니다.
- Figma에 없던 화면(할 일 목록, 파트별 진행률, 프로필)도 같은 카드 · 아이콘 · 색상 규칙으로 맞춰 화면 간 일관성을 유지했습니다.
- 게스트 모드는 Firebase에 접속하지 않고 브라우저 안의 예시 데이터만 사용하도록 만들어, 방문자가 실제 데이터나 사용량에 영향을 주지 않게 했습니다.
## 📁 파일 구성
 
```
index.html               # 메인 HTML (스타일 포함)
app-v3.js                # 메인 로직 (화면 렌더링, 라우팅)
guest-mode.js            # 게스트(읽기 전용) 모드
firebase-config.js       # Firebase 설정
firebase-auth.js         # 인증 함수
firebase-projects.js     # 프로젝트 · 멤버 관리
firebase-tasks.js        # 작업(칸반) · 채팅 관리
firebase-calendar.js     # 캘린더 관리
firebase-storage.js      # 파일 저장
firebase-extras.js       # 부가 기능
firebase-templates.js    # 작업 템플릿
firestore.rules          # Firestore 보안 규칙
storage.rules            # Storage 보안 규칙
tailwind.css             # 빌드된 Tailwind 스타일
service-worker.js        # PWA 캐시
```
 
## 🚀 실행 방법
 
1. 이 저장소를 clone 합니다.
2. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트를 생성하고, `firebase-config.js`에 본인의 Firebase 자격증명을 입력합니다.
3. Authentication(이메일/비밀번호)과 Firestore Database를 활성화합니다.
4. `index.html`을 로컬 서버로 실행하거나 `firebase deploy --only hosting`으로 배포합니다.
## 🙌 Claude와의 협업
 
역할별 진행률 데이터 구조 설계, 불필요한 기능을 정리하는 제품 의사결정, Firebase 연동 로직을 다듬는 과정, 그리고 Figma 디자인을 실제 앱에 적용하는 UI 작업에서 Claude와 협업했습니다.
 
