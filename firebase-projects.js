/* Syncspace - Projects */
async function ssCreateProject(data) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var ref = await db.collection('projects').add({
      name: data.name, description: data.description || '',
      color: data.color || '6366F1', icon: data.icon || '📁',
      ownerId: user.uid, members: [user.uid], memberEmails: [user.email],
      memberRoles: { [user.uid]: 'owner' },
      status: 'active', progress: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: ref.id };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssGetProjects() {
  var user = auth.currentUser;
  if (!user) return { projects: [] };
  try {
    var snap = await db.collection('projects').where('members', 'array-contains', user.uid).limit(50).get();
    var projects = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.status === 'deleted' || d.status === 'archived') return;
      projects.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    projects.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return { success: true, projects: projects };
  } catch (e) { return { success: false, projects: [] }; }
}
async function ssGetArchivedProjects() {
  var user = auth.currentUser;
  if (!user) return { projects: [] };
  try {
    var snap = await db.collection('projects').where('members', 'array-contains', user.uid).limit(50).get();
    var projects = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.status !== 'archived') return;
      projects.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    return { success: true, projects: projects };
  } catch (e) { return { success: false, projects: [] }; }
}

async function ssGetProject(projectId) {
  try {
    var doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return { success: false };
    return { success: true, project: { id: doc.id, ...doc.data() } };
  } catch (e) { return { success: false }; }
}

async function ssUpdateProject(projectId, data) {
  try { await db.collection('projects').doc(projectId).update(data); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

async function ssDeleteProject(projectId) {
  try { await db.collection('projects').doc(projectId).update({ status: 'deleted' }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

// ===== 이메일 초대 =====
// 예전에는 이메일이 확인되는 즉시 멤버로 추가됐다(상대 동의 없이 바로 참여 + 취소 불가).
// 지금은 invites 컬렉션에 "대기 중" 상태로 기록해두고, 상대가 알림에서 수락해야만
// 실제로 프로젝트 멤버가 된다. 실제 참여 처리는 ssAcceptInvite()가 담당한다.
// 문서 ID를 projectId_uid로 고정해두면(자동 ID 대신) firestore.rules에서 "이 프로젝트에
// 나에게 온 pending 초대가 있는지"를 get()으로 직접 확인할 수 있어, 초대받은 사람이
// 수락할 때 스스로를 members 배열에 추가하는 것을 규칙 차원에서 안전하게 허용할 수 있다.
function ssInviteDocId(projectId, uid) { return projectId + '_' + uid; }
async function ssInviteMember(projectId, email, role) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) return { success: false, error: '해당 이메일의 사용자가 없습니다' };
    var invitedUid = userSnap.docs[0].id;

    var projDoc = await db.collection('projects').doc(projectId).get();
    if (!projDoc.exists) return { success: false, error: '프로젝트를 찾을 수 없습니다' };
    var proj = projDoc.data();
    if ((proj.members || []).indexOf(invitedUid) !== -1) return { success: false, error: '이미 프로젝트 멤버입니다' };

    var inviteId = ssInviteDocId(projectId, invitedUid);
    var existingDoc = await db.collection('invites').doc(inviteId).get();
    if (existingDoc.exists && existingDoc.data().status === 'pending') {
      return { success: false, error: '이미 초대를 보냈어요. 상대의 응답을 기다려주세요.' };
    }

    var inviterName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '사용자';
    await db.collection('invites').doc(inviteId).set({
      projectId: projectId,
      projectName: proj.name || '',
      invitedUid: invitedUid,
      invitedEmail: email,
      role: role || 'editor',
      invitedByUid: user.uid,
      invitedByName: inviterName,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await ssCreateNotification(invitedUid, {
      type: 'project_invite',
      inviteId: inviteId,
      projectId: projectId,
      fromUser: user.uid,
      message: inviterName + '님이 "' + (proj.name || '') + '" 프로젝트에 초대했습니다'
    });

    return { success: true, pending: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// 프로젝트에 아직 응답하지 않은 초대 목록(팀 페이지에서 "취소" 용도로 표시)
async function ssGetPendingInvites(projectId) {
  try {
    var snap = await db.collection('invites')
      .where('projectId', '==', projectId)
      .where('status', '==', 'pending')
      .limit(50).get();
    var invites = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      invites.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    return { success: true, invites: invites };
  } catch (e) { return { success: false, invites: [] }; }
}

// 초대를 보낸 쪽(오너/에디터)이 아직 대기 중인 초대를 취소
async function ssCancelInvite(inviteId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('invites').doc(inviteId).get();
    if (!doc.exists) return { success: false, error: '초대를 찾을 수 없습니다' };
    var inv = doc.data();
    if (inv.status !== 'pending') return { success: false, error: '이미 처리된 초대입니다' };
    var projDoc = await db.collection('projects').doc(inv.projectId).get();
    var proj = projDoc.exists ? projDoc.data() : {};
    var myRole = proj.ownerId === user.uid ? 'owner' : ((proj.memberRoles && proj.memberRoles[user.uid]) || null);
    if (myRole !== 'owner' && myRole !== 'editor' && inv.invitedByUid !== user.uid) {
      return { success: false, error: '취소할 권한이 없어요' };
    }
    await db.collection('invites').doc(inviteId).update({ status: 'cancelled' });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// 초대받은 사람이 수락 — 이 시점에 비로소 실제 프로젝트 멤버가 된다
async function ssAcceptInvite(inviteId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('invites').doc(inviteId).get();
    if (!doc.exists) return { success: false, error: '초대를 찾을 수 없습니다' };
    var inv = doc.data();
    if (inv.invitedUid !== user.uid) return { success: false, error: '본인에게 온 초대가 아니에요' };
    if (inv.status !== 'pending') return { success: false, error: '이미 처리된 초대입니다' };

    var update = {
      members: firebase.firestore.FieldValue.arrayUnion(user.uid),
      memberEmails: firebase.firestore.FieldValue.arrayUnion(user.email)
    };
    update['memberRoles.' + user.uid] = inv.role || 'editor';
    await db.collection('projects').doc(inv.projectId).update(update);
    await db.collection('invites').doc(inviteId).update({ status: 'accepted' });
    return { success: true, projectId: inv.projectId, projectName: inv.projectName };
  } catch (e) { return { success: false, error: e.message }; }
}

// 초대받은 사람이 거절
async function ssDeclineInvite(inviteId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('invites').doc(inviteId).get();
    if (!doc.exists) return { success: false, error: '초대를 찾을 수 없습니다' };
    var inv = doc.data();
    if (inv.invitedUid !== user.uid) return { success: false, error: '본인에게 온 초대가 아니에요' };
    if (inv.status !== 'pending') return { success: false, error: '이미 처리된 초대입니다' };
    await db.collection('invites').doc(inviteId).update({ status: 'declined' });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
async function ssSetMemberRole(projectId, uid, role) {
  try {
    var update = {}; update['memberRoles.' + uid] = role;
    await db.collection('projects').doc(projectId).update(update);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 소유권 이전 =====
// ssLeaveProject()가 "소유자는 먼저 다른 멤버에게 소유권을 넘긴 뒤 나갈 수 있어요"라고
// 안내하는데 정작 그 기능(소유권 이전)이 없어서 소유자는 프로젝트를 영영 못 나가는
// 막다른 상황이었다. ownerId와 memberRoles[uid]='owner'를 함께 갱신해 실제로
// "소유자"로 취급되는 기준(renderTeam의 role 판정과 동일)을 맞춘다.
async function ssTransferOwnership(projectId, newOwnerUid) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return { success: false, error: '프로젝트를 찾을 수 없습니다' };
    var proj = doc.data();
    if (proj.ownerId !== user.uid) return { success: false, error: '소유자만 소유권을 넘길 수 있어요' };
    if ((proj.members || []).indexOf(newOwnerUid) === -1) return { success: false, error: '프로젝트 멤버가 아닙니다' };
    var update = { ownerId: newOwnerUid };
    update['memberRoles.' + newOwnerUid] = 'owner';
    update['memberRoles.' + user.uid] = 'editor';
    await db.collection('projects').doc(projectId).update(update);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 멤버 강퇴(제거) =====
// 지금까지는 본인이 스스로 나가는 것(ssLeaveProject)만 가능했고, 오너가 다른 멤버를
// 내보내는 기능이 없었다. 오너만 실행 가능하도록 서버에서도 한 번 더 확인한다.
async function ssRemoveMember(projectId, uid) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return { success: false, error: '프로젝트를 찾을 수 없습니다' };
    var proj = doc.data();
    if (proj.ownerId !== user.uid) return { success: false, error: '오너만 멤버를 내보낼 수 있어요' };
    if (uid === user.uid) return { success: false, error: '본인은 이 기능으로 나갈 수 없어요' };
    if ((proj.members || []).indexOf(uid) === -1) return { success: false, error: '프로젝트 멤버가 아닙니다' };
    // memberEmails는 uid와 같은 인덱스로 정렬된다는 보장이 없어(배열 순서 이슈),
    // 대상 유저 문서에서 이메일을 직접 조회해 정확히 그 값만 제거한다.
    var update = {
      members: firebase.firestore.FieldValue.arrayRemove(uid)
    };
    var uDoc = await db.collection('users').doc(uid).get();
    if (uDoc.exists && uDoc.data().email) {
      update.memberEmails = firebase.firestore.FieldValue.arrayRemove(uDoc.data().email);
    }
    update['memberRoles.' + uid] = firebase.firestore.FieldValue.delete();
    await db.collection('projects').doc(projectId).update(update);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssGetProjectMembers(projectId) {
  try {
    var proj = await db.collection('projects').doc(projectId).get();
    var memberIds = proj.data().members || [];
    var members = [];
    for (var i = 0; i < memberIds.length; i++) {
      var u = await db.collection('users').doc(memberIds[i]).get();
      if (u.exists) members.push({ uid: memberIds[i], ...u.data() });
    }
    return { success: true, members: members };
  } catch (e) { return { success: false, members: [] }; }
}

async function ssEnableShare(projectId, shareId) {
  try { await db.collection('projects').doc(projectId).update({ shareEnabled: true, shareId: shareId }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}
async function ssDisableShare(projectId) {
  try { await db.collection('projects').doc(projectId).update({ shareEnabled: false }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

// ===== #11 QR 초대(참여 링크) =====
// 참고: 실제 접근 제어는 Firestore 보안 규칙 몫이며, 이 함수는 현재 프로젝트의 규칙(테스트 모드 등)에서
// 클라이언트 쓰기가 허용된다는 전제하에 동작한다. 프로덕션 전환 시 보안 규칙에서
// joinToken 일치 여부를 검증하도록 별도 설정이 필요하다.
async function ssEnableJoin(projectId, token, role) {
  try { await db.collection('projects').doc(projectId).update({ joinEnabled: true, joinToken: token, joinRole: role || 'editor' }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}
async function ssDisableJoin(projectId) {
  try { await db.collection('projects').doc(projectId).update({ joinEnabled: false }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}
async function ssJoinProjectByToken(projectId, token) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return { success: false, error: '프로젝트를 찾을 수 없습니다' };
    var proj = doc.data();
    if (!proj.joinEnabled || proj.joinToken !== token) return { success: false, error: '유효하지 않거나 만료된 초대 링크입니다' };
    if ((proj.members || []).indexOf(user.uid) !== -1) return { success: true, alreadyMember: true, projectName: proj.name };
    var update = {
      members: firebase.firestore.FieldValue.arrayUnion(user.uid),
      memberEmails: firebase.firestore.FieldValue.arrayUnion(user.email)
    };
    update['memberRoles.' + user.uid] = proj.joinRole || 'editor';
    await db.collection('projects').doc(projectId).update(update);
    return { success: true, projectName: proj.name };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 내가 프로젝트에서 나가기 =====
async function ssLeaveProject(projectId) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  try {
    var doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return { success: false, error: '프로젝트를 찾을 수 없습니다' };
    var proj = doc.data();
    var members = proj.members || [];
    if (members.length <= 1) return { success: false, error: '마지막 남은 멤버는 나갈 수 없어요. 프로젝트를 삭제해주세요.' };
    if (proj.ownerId === user.uid) return { success: false, error: '소유자는 먼저 다른 멤버에게 소유권을 넘긴 뒤 나갈 수 있어요.' };
    var update = {
      members: firebase.firestore.FieldValue.arrayRemove(user.uid),
      memberEmails: firebase.firestore.FieldValue.arrayRemove(user.email)
    };
    update['memberRoles.' + user.uid] = firebase.firestore.FieldValue.delete();
    await db.collection('projects').doc(projectId).update(update);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// ===== 파트(역할)별 진행률 — 멤버가 직접 자기 파트와 진행률(%)을 입력 =====
// 문서 ID를 {projectId}_{uid} 고정 형식으로 두어 멤버당 1개만 존재하고,
// 보안 규칙에서 "본인 문서만 수정"을 간단히 검증할 수 있게 한다.
// percent는 0~100 정수이고, 100이면 '완료'로 본다(별도 completed 필드는 두지 않음).
function ssMemberProgressDocId(projectId, uid) { return projectId + '_' + uid; }

async function ssGetMemberProgress(projectId) {
  try {
    var snap = await db.collection('memberProgress').where('projectId', '==', projectId).get();
    var items = [];
    snap.forEach(function(d){ items.push({ id: d.id, ...d.data() }); });
    return { success: true, items: items };
  } catch (e) { return { success: false, items: [], error: e.message }; }
}

async function ssSetMyProgress(projectId, data) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  var percent = Math.round(Number(data.percent));
  if (isNaN(percent)) percent = 0;
  percent = Math.max(0, Math.min(100, percent));
  try {
    await db.collection('memberProgress').doc(ssMemberProgressDocId(projectId, user.uid)).set({
      projectId: projectId,
      uid: user.uid,
      role: data.role,
      percent: percent,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

// 오너(관리자)가 팀원에게 파트를 지정/해제한다. 팀원이 입력한 진행률(percent)은 건드리지 않는다.
// role 이 빈 문자열이면 '파트 없음'. 문서가 아직 없으면 percent 0 으로 새로 만든다.
async function ssAssignMemberRole(projectId, uid, role) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  var ref = db.collection('memberProgress').doc(ssMemberProgressDocId(projectId, uid));
  try {
    var snap = await ref.get();
    if (snap.exists) {
      await ref.update({ role: role || '', assignedBy: user.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } else {
      await ref.set({
        projectId: projectId, uid: uid, role: role || '', percent: 0, assignedBy: user.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

console.log('📁 Projects 모듈 로드!');
