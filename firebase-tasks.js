/* Syncspace - Tasks (칸반보드 + 할일) - 개선 버전 */
var TASK_STATUS = ['todo', 'inprogress', 'done'];
var TASK_STATUS_LABELS = { todo: '📋 할 일', inprogress: '🔄 진행 중', done: '✅ 완료' };
var TASK_PRIORITY = { high: '🔴 높음', medium: '🟡 보통', low: '🟢 낮음' };
var TASK_REPEAT = { none: '반복 없음', daily: '매일', weekly: '매주', monthly: '매달' };

async function ssCreateTask(projectId, data) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var ref = await db.collection('tasks').add({
      projectId: projectId, 
      title: data.title, 
      description: data.description || '',
      status: data.status || 'todo', 
      priority: data.priority || 'medium',
      assigneeId: data.assigneeId || null, 
      assigneeName: data.assigneeName || '',
      dueDate: data.dueDate || null, 
      tags: data.tags || [],
      checklist: data.checklist || [], 
      comments: 0,
      // 새로운 필드들
      files: data.files || [],
      repeatType: data.repeatType || 'none',
      repeatEndDate: data.repeatEndDate || null,
      creatorId: user.uid, 
      order: data.order || Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 담당자에게 알림 생성
    if(data.assigneeId && data.assigneeId !== user.uid){
      await ssCreateNotification(data.assigneeId, {
        type: 'task_assigned',
        taskId: ref.id,
        taskTitle: data.title,
        projectId: projectId,
        fromUser: user.uid
      });
    }
    
    return { success: true, id: ref.id };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssGetTasks(projectId) {
  try {
    var snap = await db.collection('tasks').where('projectId', '==', projectId).limit(200).get();
    var tasks = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      tasks.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    tasks.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
    return { success: true, tasks: tasks };
  } catch (e) { return { success: false, tasks: [] }; }
}

async function ssUpdateTask(taskId, data) {
  try { 
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('tasks').doc(taskId).update(data); 
    return { success: true }; 
  }
  catch (e) { return { success: false, error: e.message }; }
}

async function ssDeleteTask(taskId) {
  try { 
    await db.collection('tasks').doc(taskId).delete(); 
    return { success: true }; 
  }
  catch (e) { return { success: false }; }
}

async function ssMoveTask(taskId, newStatus) {
  return await ssUpdateTask(taskId, { status: newStatus });
}

// ===== 댓글 =====
async function ssAddComment(taskId, content) {
  var user = auth.currentUser;
  if (!user) return { success: false };
  try {
    var uDoc = await db.collection('users').doc(user.uid).get();
    var name = uDoc.data().name || '익명';
    await db.collection('tasks').doc(taskId).collection('comments').add({
      content: content, 
      authorId: user.uid, 
      authorName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('tasks').doc(taskId).update({ comments: firebase.firestore.FieldValue.increment(1) });
    return { success: true };
  } catch (e) { return { success: false }; }
}

async function ssGetComments(taskId) {
  try {
    var snap = await db.collection('tasks').doc(taskId).collection('comments').limit(50).get();
    var comments = [];
    snap.forEach(function(doc) { 
      var d = doc.data(); 
      comments.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null }); 
    });
    comments.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    return { success: true, comments: comments };
  } catch (e) { return { success: false, comments: [] }; }
}

async function ssDeleteComment(taskId, commentId) {
  try {
    await db.collection('tasks').doc(taskId).collection('comments').doc(commentId).delete();
    await db.collection('tasks').doc(taskId).update({ comments: firebase.firestore.FieldValue.increment(-1) });
    return { success: true };
  } catch (e) { return { success: false }; }
}

// ===== 체크리스트 =====
async function ssToggleChecklist(taskId, checkIndex, checked) {
  try {
    var doc = await db.collection('tasks').doc(taskId).get();
    var checklist = doc.data().checklist || [];
    if (checklist[checkIndex]) checklist[checkIndex].done = checked;
    await db.collection('tasks').doc(taskId).update({ checklist: checklist });
    return { success: true };
  } catch (e) { return { success: false }; }
}

// ===== 파일 첨부 =====
async function ssAddTaskFile(taskId, fileData) {
  try {
    var user = auth.currentUser;
    var file = {
      id: Date.now().toString(),
      name: fileData.name,
      type: fileData.type,
      size: fileData.size,
      uploadedBy: user.uid,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      url: fileData.url || ''
    };
    
    await db.collection('tasks').doc(taskId).update({
      files: firebase.firestore.FieldValue.arrayUnion(file)
    });
    return { success: true, file: file };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssDeleteTaskFile(taskId, fileId) {
  try {
    var doc = await db.collection('tasks').doc(taskId).get();
    var files = doc.data().files || [];
    var updatedFiles = files.filter(f => f.id !== fileId);
    
    await db.collection('tasks').doc(taskId).update({ files: updatedFiles });
    return { success: true };
  } catch (e) { return { success: false }; }
}

// ===== 담당자 할당 =====
async function ssAssignTask(taskId, assigneeId, assigneeName) {
  try {
    var user = auth.currentUser;
    await db.collection('tasks').doc(taskId).update({
      assigneeId: assigneeId,
      assigneeName: assigneeName
    });
    
    // 담당자에게 알림
    if(assigneeId !== user.uid){
      await ssCreateNotification(assigneeId, {
        type: 'task_assigned',
        taskId: taskId,
        fromUser: user.uid
      });
    }
    
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 알림 =====
async function ssCreateNotification(userId, data) {
  try {
    await db.collection('notifications').add({
      userId: userId,
      type: data.type,
      taskId: data.taskId || null,
      taskTitle: data.taskTitle || null,
      projectId: data.projectId || null,
      inviteId: data.inviteId || null,
      fromUser: data.fromUser || null,
      message: data.message || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e) { console.error('ssCreateNotification 실패:', e); return { success: false }; }
}

async function ssGetNotifications() {
  var user = auth.currentUser;
  if(!user) return { notifications: [] };
  try {
    var snap;
    try {
      // where + orderBy(다른 필드) 조합은 Firestore 복합 색인이 필요하다.
      // 색인이 아직 생성되지 않은 프로젝트에서는 이 쿼리가 조용히 실패해서
      // "알림이 하나도 안 보인다"처럼 보일 수 있으므로, 실패 시 정렬 없이
      // 한 번 더 시도하고 정렬은 클라이언트에서 처리한다.
      snap = await db.collection('notifications')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
    } catch (indexErr) {
      console.error('ssGetNotifications: 정렬 포함 쿼리 실패, 색인 없이 재시도합니다. (Firestore 콘솔에서 notifications 컬렉션에 userId/createdAt 복합 색인을 만들면 이 경고가 사라집니다)', indexErr);
      snap = await db.collection('notifications')
        .where('userId', '==', user.uid)
        .limit(20)
        .get();
    }
    var notifs = [];
    snap.forEach(doc => {
      var d = doc.data();
      notifs.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    notifs.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    return { success: true, notifications: notifs };
  } catch (e) { console.error('ssGetNotifications 실패:', e); return { success: false, notifications: [] }; }
}

async function ssMarkNotificationRead(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({ read: true });
    return { success: true };
  } catch (e) { console.error('ssMarkNotificationRead 실패:', e); return { success: false }; }
}

// 알림 삭제 (본인 알림만, 여러 개는 batch로 묶어서 처리)
async function ssDeleteNotifications(ids) {
  try {
    for (var i = 0; i < ids.length; i += 400) {
      var batch = db.batch();
      ids.slice(i, i + 400).forEach(function(id){ batch.delete(db.collection('notifications').doc(id)); });
      await batch.commit();
    }
    return { success: true };
  } catch (e) { console.error('ssDeleteNotifications 실패:', e); return { success: false, error: e.message }; }
}

// 알림 문서에 임의 필드를 갱신 (예: 초대 알림에 수락/거절 결과를 남길 때 사용)
async function ssUpdateNotification(notificationId, data) {
  try {
    await db.collection('notifications').doc(notificationId).update(data);
    return { success: true };
  } catch (e) { console.error('ssUpdateNotification 실패:', e); return { success: false }; }
}

// ===== 채팅 =====
async function ssSendChatMessage(projectId, content) {
  var user = auth.currentUser;
  if(!user) return { success: false };
  try {
    var uDoc = await db.collection('users').doc(user.uid).get();
    var name = uDoc.data().name || '익명';
    
    await db.collection('projects').doc(projectId).collection('chat').add({
      content: content,
      authorId: user.uid,
      authorName: name,
      authorAvatar: uDoc.data().avatar || '😀',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssGetChatMessages(projectId) {
  try {
    var snap = await db.collection('projects').doc(projectId).collection('chat')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    var messages = [];
    snap.forEach(doc => {
      var d = doc.data();
      messages.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    messages.reverse();
    return { success: true, messages: messages };
  } catch (e) { return { success: false, messages: [] }; }
}

async function ssDeleteChatMessage(projectId, messageId) {
  try {
    await db.collection('projects').doc(projectId).collection('chat').doc(messageId).delete();
    return { success: true };
  } catch (e) { return { success: false }; }
}

// ===== 댓글 리액션 =====
async function ssToggleCommentReaction(taskId, commentId, emoji, uid, add) {
  try {
    var ref = db.collection('tasks').doc(taskId).collection('comments').doc(commentId);
    var field = 'reactions.' + emoji;
    var op = add ? firebase.firestore.FieldValue.arrayUnion(uid) : firebase.firestore.FieldValue.arrayRemove(uid);
    var update = {}; update[field] = op;
    await ref.update(update);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

console.log('✅ Tasks 모듈 로드 (개선 버전)!');
