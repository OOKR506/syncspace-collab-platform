/* Syncspace - Extras (체크리스트/북마크/활동로그) */

// ===== 서브태스크(체크리스트) 추가/삭제 =====
// ssToggleChecklist(index,checked)는 firebase-tasks.js에 이미 존재 — 재사용.
async function ssAddChecklistItem(taskId, text) {
  try {
    var doc = await db.collection('tasks').doc(taskId).get();
    var checklist = doc.data().checklist || [];
    checklist.push({ text: text, done: false });
    await db.collection('tasks').doc(taskId).update({ checklist: checklist });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
async function ssRemoveChecklistItem(taskId, index) {
  try {
    var doc = await db.collection('tasks').doc(taskId).get();
    var checklist = doc.data().checklist || [];
    checklist.splice(index, 1);
    await db.collection('tasks').doc(taskId).update({ checklist: checklist });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 작업 북마크(즐겨찾기) =====
async function ssToggleTaskStar(taskId, uid, starred) {
  try {
    var op = starred ? firebase.firestore.FieldValue.arrayUnion(uid) : firebase.firestore.FieldValue.arrayRemove(uid);
    await db.collection('tasks').doc(taskId).update({ starredBy: op });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 다중 담당자 / 리뷰어 =====
async function ssSetReviewers(taskId, reviewerIds, reviewerNames) {
  try {
    await db.collection('tasks').doc(taskId).update({ reviewerIds: reviewerIds, reviewerNames: reviewerNames });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 활동 로그 =====
// taskId는 선택 인자(기존 호출부는 그대로 동작) — #8 작업별 변경 이력에서 같은 컬렉션을 taskId로 필터링해 재사용
async function ssLogActivity(projectId, type, message, taskId) {
  var user = auth.currentUser;
  if (!user || !projectId) return { success: false };
  try {
    var entry = {
      projectId: projectId,
      type: type,
      message: message,
      actorId: user.uid,
      actorName: (currentUser && currentUser.name) || '사용자',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (taskId) entry.taskId = taskId;
    await db.collection('activity').add(entry);
    return { success: true };
  } catch (e) { return { success: false }; }
}
async function ssGetActivity(projectId, limitCount) {
  try {
    var snap = await db.collection('activity')
      .where('projectId', '==', projectId)
      .limit(limitCount || 50)
      .get();
    var items = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      items.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    items.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return { success: true, items: items };
  } catch (e) { return { success: false, items: [] }; }
}

// ===== @멘션 파싱 (클라이언트 로직, Firestore 접근은 알림 생성만) =====
// text 안의 "@이름" 토큰을 members 배열과 매칭해 알림을 보낸다.
async function ssNotifyMentions(text, members, ctx) {
  if (!text || !members || !members.length) return;
  var user = auth.currentUser; if (!user) return;
  members.forEach(function(m) {
    if (!m.name || m.uid === user.uid) return;
    if (text.indexOf('@' + m.name) !== -1) {
      ssCreateNotification(m.uid, {
        type: 'mention',
        taskId: ctx.taskId || null,
        taskTitle: ctx.taskTitle || null,
        projectId: ctx.projectId || null,
        message: (currentUser && currentUser.name ? currentUser.name : '누군가') + '님이 회원님을 언급했습니다: ' + text.substring(0, 60),
        fromUser: user.uid
      });
    }
  });
}

console.log('✨ Extras 모듈 로드!');
