/* Syncspace v3.0 - Project Templates */

// 기본 내장 템플릿
var SS_TEMPLATES = [
  {
    id: 'tpl-software',
    name: '🖥️ 소프트웨어 개발',
    description: '스프린트 기반 소프트웨어 개발 프로젝트',
    color: '6366F1',
    icon: '🖥️',
    tasks: [
      { title: '요구사항 분석', status: 'todo', priority: 'high' },
      { title: 'UI/UX 디자인', status: 'todo', priority: 'high' },
      { title: '데이터베이스 설계', status: 'todo', priority: 'medium' },
      { title: '프론트엔드 개발', status: 'todo', priority: 'high' },
      { title: '백엔드 API 개발', status: 'todo', priority: 'high' },
      { title: '테스트 및 QA', status: 'todo', priority: 'medium' },
      { title: '배포 및 런칭', status: 'todo', priority: 'high' },
      { title: '문서 작성', status: 'todo', priority: 'low' }
    ],
    events: [
      { title: '📋 킥오프 미팅', dayOffset: 0, type: 'milestone' },
      { title: '🎨 디자인 리뷰', dayOffset: 7, type: 'milestone' },
      { title: '🧪 QA 시작', dayOffset: 21, type: 'deadline' },
      { title: '🚀 릴리즈', dayOffset: 30, type: 'milestone' }
    ]
  },
  {
    id: 'tpl-marketing',
    name: '📢 마케팅 캠페인',
    description: '마케팅 캠페인 기획 및 실행',
    color: 'EC4899',
    icon: '📢',
    tasks: [
      { title: '타겟 시장 조사', status: 'todo', priority: 'high' },
      { title: '캠페인 전략 수립', status: 'todo', priority: 'high' },
      { title: '콘텐츠 제작', status: 'todo', priority: 'medium' },
      { title: 'SNS 채널 운영', status: 'todo', priority: 'medium' },
      { title: '광고 집행', status: 'todo', priority: 'high' },
      { title: '성과 분석 리포트', status: 'todo', priority: 'medium' }
    ],
    events: [
      { title: '📊 전략 회의', dayOffset: 0, type: 'milestone' },
      { title: '🎬 콘텐츠 마감', dayOffset: 14, type: 'deadline' },
      { title: '🚀 캠페인 런칭', dayOffset: 21, type: 'milestone' }
    ]
  },
  {
    id: 'tpl-school',
    name: '🎓 학교 팀 프로젝트',
    description: '대학교 팀 과제 및 프로젝트 관리',
    color: '10B981',
    icon: '🎓',
    tasks: [
      { title: '주제 선정 및 역할 분담', status: 'todo', priority: 'high' },
      { title: '자료 조사', status: 'todo', priority: 'medium' },
      { title: '개별 파트 작업', status: 'todo', priority: 'high' },
      { title: '중간 점검 회의', status: 'todo', priority: 'medium' },
      { title: '통합 및 검토', status: 'todo', priority: 'high' },
      { title: '발표 자료 제작', status: 'todo', priority: 'high' },
      { title: '발표 리허설', status: 'todo', priority: 'medium' },
      { title: '최종 제출', status: 'todo', priority: 'high' }
    ],
    events: [
      { title: '📋 역할 분담 완료', dayOffset: 3, type: 'milestone' },
      { title: '📝 중간 점검', dayOffset: 14, type: 'milestone' },
      { title: '📅 제출 마감', dayOffset: 28, type: 'deadline' }
    ]
  },
  {
    id: 'tpl-event',
    name: '🎉 이벤트 기획',
    description: '행사 및 이벤트 기획 관리',
    color: 'F59E0B',
    icon: '🎉',
    tasks: [
      { title: '이벤트 컨셉 기획', status: 'todo', priority: 'high' },
      { title: '장소 섭외', status: 'todo', priority: 'high' },
      { title: '예산 편성', status: 'todo', priority: 'medium' },
      { title: '참가자 모집', status: 'todo', priority: 'medium' },
      { title: '프로그램 구성', status: 'todo', priority: 'high' },
      { title: '홍보물 제작', status: 'todo', priority: 'medium' },
      { title: '리허설', status: 'todo', priority: 'low' },
      { title: '행사 당일 운영', status: 'todo', priority: 'high' }
    ],
    events: [
      { title: '📋 기획안 확정', dayOffset: 7, type: 'milestone' },
      { title: '📢 홍보 시작', dayOffset: 14, type: 'milestone' },
      { title: '🎉 이벤트 당일', dayOffset: 30, type: 'deadline' }
    ]
  },
  {
    id: 'tpl-startup',
    name: '🚀 스타트업 MVP',
    description: 'MVP 개발부터 런칭까지',
    color: '8B5CF6',
    icon: '🚀',
    tasks: [
      { title: '시장 조사 및 경쟁 분석', status: 'todo', priority: 'high' },
      { title: '핵심 기능 정의', status: 'todo', priority: 'high' },
      { title: '와이어프레임 설계', status: 'todo', priority: 'medium' },
      { title: 'MVP 프로토타입 개발', status: 'todo', priority: 'high' },
      { title: '사용자 테스트', status: 'todo', priority: 'high' },
      { title: '피드백 반영 및 개선', status: 'todo', priority: 'medium' },
      { title: '랜딩페이지 제작', status: 'todo', priority: 'medium' },
      { title: '베타 런칭', status: 'todo', priority: 'high' }
    ],
    events: [
      { title: '💡 아이디어 검증', dayOffset: 7, type: 'milestone' },
      { title: '🧪 MVP 완성', dayOffset: 30, type: 'milestone' },
      { title: '🚀 베타 런칭', dayOffset: 45, type: 'deadline' }
    ]
  }
];

// 사용자 커스텀 템플릿 저장
async function ssSaveAsTemplate(projectId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var projDoc = await db.collection('projects').doc(projectId).get();
    if (!projDoc.exists) return { success: false, error: '프로젝트 없음' };
    var proj = projDoc.data();
    
    var tasksSnap = await db.collection('tasks')
      .where('projectId', '==', projectId).limit(200).get();
    var tasks = [];
    tasksSnap.forEach(function(doc) {
      var d = doc.data();
      tasks.push({ title: d.title, status: 'todo', priority: d.priority || 'medium',
        description: d.description || '' });
    });
    
    var ref = await db.collection('templates').add({
      name: proj.name + ' (템플릿)',
      description: proj.description || '',
      color: proj.color || '6366F1',
      icon: proj.icon || '📁',
      tasks: tasks,
      events: [],
      creatorId: user.uid,
      isCustom: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: ref.id };
  } catch (e) { return { success: false, error: e.message }; }
}

// 사용자 커스텀 템플릿 목록
async function ssGetCustomTemplates() {
  var user = auth.currentUser;
  if (!user) return { success: true, templates: [] };
  try {
    var snap = await db.collection('templates')
      .where('creatorId', '==', user.uid)
      .limit(20).get();
    var templates = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      templates.push({ id: doc.id, ...d,
        createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    return { success: true, templates: templates };
  } catch (e) { return { success: false, templates: [] }; }
}

async function ssDeleteTemplate(templateId) {
  try {
    await db.collection('templates').doc(templateId).delete();
    return { success: true };
  } catch (e) { return { success: false }; }
}

// 템플릿에서 프로젝트 생성
async function ssCreateProjectFromTemplate(template) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var projRef = await db.collection('projects').add({
      name: template.name.replace(' (템플릿)', ''),
      description: template.description || '',
      color: template.color || '6366F1',
      icon: template.icon || '📁',
      ownerId: user.uid,
      members: [user.uid],
      memberEmails: [user.email],
      memberRoles: { [user.uid]: 'owner' },
      status: 'active',
      progress: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 작업 일괄 생성
    var tasks = template.tasks || [];
    for (var i = 0; i < tasks.length; i++) {
      await db.collection('tasks').add({
        projectId: projRef.id,
        title: tasks[i].title,
        description: tasks[i].description || '',
        status: tasks[i].status || 'todo',
        priority: tasks[i].priority || 'medium',
        assigneeId: null,
        assigneeName: '',
        dueDate: null,
        tags: [],
        checklist: [],
        files: [],
        comments: 0,
        repeatType: 'none',
        creatorId: user.uid,
        order: i,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // 이벤트 생성
    var events = template.events || [];
    var today = new Date();
    for (var j = 0; j < events.length; j++) {
      var eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() + (events[j].dayOffset || 0));
      var dateStr = eventDate.getFullYear() + '-' +
        String(eventDate.getMonth()+1).padStart(2,'0') + '-' +
        String(eventDate.getDate()).padStart(2,'0');
      
      await db.collection('events').add({
        projectId: projRef.id,
        title: events[j].title,
        date: dateStr,
        endDate: dateStr,
        type: events[j].type || 'event',
        color: template.color || '6366F1',
        creatorId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    return { success: true, id: projRef.id };
  } catch (e) { return { success: false, error: e.message }; }
}

console.log('📄 Templates 모듈 로드!');
