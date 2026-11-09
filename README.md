# Syncspace

팀 협업과 일정 관리를 한 화면에서 처리하는 올인원 플랫폼입니다. 졸업 작품으로 기획부터 개발까지 직접 진행했습니다.

🔗 **Live Demo**: https://syncspace1-b39f5.web.app/

---

## 📌 개요

팀 프로젝트를 진행할 때 작업 현황과 일정이 여러 곳에 흩어지는 문제를 자주 겪었습니다. Syncspace는 칸반보드, 캘린더, 팀 채팅, 역할별 진행률 통계를 한 곳에 모아, 팀의 하루 업무 흐름을 한 화면에서 파악할 수 있도록 설계했습니다.

## 🛠 기술 스택

- **Frontend**: HTML5, JavaScript (Vanilla JS)
- **Backend / Infra**: Firebase (Authentication, Firestore, Cloud Functions, Hosting)
- **연동**: Slack (Cloud Functions), Gmail SMTP (이메일 알림)

## ✨ 주요 기능

- **칸반보드** — 드래그 앤 드롭으로 작업 상태 이동
- **캘린더** — 팀 일정 관리
- **역할별 진행률 통계** — 기획 · 디자인 · 프론트엔드 · 백엔드 · QA 파트를 선택해 본인이 직접 진행률(%)을 조절하는 방식
- **팀 채팅 & 실시간 알림**
- **프로젝트 생성/수정/삭제**, 팀 멤버 관리, 작업 담당자 지정, 작업 댓글
- **Slack / 이메일 알림 연동**
- **다크모드**, 반응형 디자인(모바일 지원)

## 🧭 기술적 의사결정

- 초기에는 문서/Wiki, 간트차트, 타임트래커, 통계 리포트(번다운 · PDF)까지 기능을 폭넓게 넣었지만, 실제 사용 흐름에서 불필요하다고 판단한 것들을 과감히 제거해 메뉴를 **12개 → 8개**로 정리했습니다.
- 진행률 계산 방식을 작업 개수 기반 자동 계산에서, 팀원이 **기획/디자인/프론트엔드/백엔드/QA 중 자신의 파트를 선택하고 진행률(%)을 직접 조절**하는 방식으로 바꿔, 체감 진행률과 실제 지표가 일치하도록 개선했습니다.
- 발표 전 교수님 피드백을 반영해 로그인 전 서비스 소개 화면을 추가했습니다.

## 📁 파일 구성

```
index.html              # 메인 HTML
app.js                   # 메인 로직
firebase-config.js       # Firebase 설정
firebase-auth.js         # 인증 함수
firebase-projects.js     # 프로젝트 관리
firebase-tasks.js        # 작업(칸반보드) 관리
firebase-calendar.js     # 캘린더 관리
```

## 🚀 실행 방법

1. 이 저장소를 clone 합니다.
2. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트를 생성하고, `firebase-config.js`에 본인의 Firebase 자격증명을 입력합니다.
3. Authentication(이메일/비밀번호)과 Firestore Database를 활성화합니다.
4. `index.html`을 로컬 서버(또는 Firebase Hosting)로 실행합니다.

## 🙌 Claude와의 협업

역할별 진행률 데이터 구조 설계, 불필요한 기능을 정리하는 제품 의사결정, Firebase 연동 로직을 다듬는 과정에서 Claude와 협업했습니다.
