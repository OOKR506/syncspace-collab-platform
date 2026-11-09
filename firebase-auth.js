/* Syncspace - Auth */

// Firebase 인증 에러 코드를 사용자 친화적인 한글 메시지로 변환.
// 인증 방식 자체는 변경하지 않고, 에러 문구만 다듬는다.
// 예전엔 map에 없는 에러 코드를 만나면 Firebase가 주는 원문 영어 메시지(e.message)를
// 그대로 보여줬다 — 비밀번호 오류 등에서 영어 문구가 보였던 원인이 이것이다.
// 이제는 map에 없더라도 항상 한국어 기본 문구로 대체한다.
function ssAuthErrorMessage(e){
  var map={
    'auth/email-already-in-use':'이미 사용 중인 이메일입니다.',
    'auth/invalid-email':'올바른 이메일 형식이 아닙니다.',
    'auth/weak-password':'비밀번호가 너무 약합니다. 6자 이상 입력해주세요.',
    'auth/user-not-found':'등록되지 않은 이메일입니다.',
    'auth/wrong-password':'비밀번호가 올바르지 않습니다.',
    'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-login-credentials':'이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/missing-password':'비밀번호를 입력해주세요.',
    'auth/user-disabled':'사용이 제한된 계정입니다. 관리자에게 문의해주세요.',
    'auth/user-token-expired':'로그인이 만료되었습니다. 다시 로그인해주세요.',
    'auth/user-mismatch':'현재 로그인한 계정과 일치하지 않습니다.',
    'auth/too-many-requests':'너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed':'네트워크 연결을 확인해주세요.',
    'auth/requires-recent-login':'보안을 위해 비밀번호를 다시 확인해주세요.',
    'auth/missing-email':'이메일을 입력해주세요.',
    'auth/operation-not-allowed':'현재 사용할 수 없는 로그인 방식입니다.',
    'auth/internal-error':'일시적인 오류가 발생했습니다. 다시 시도해주세요.',
    'auth/popup-closed-by-user':'창이 닫혀 취소되었습니다.',
    'auth/timeout':'요청 시간이 초과되었습니다. 다시 시도해주세요.'
  };
  if(e && e.code && map[e.code]) return map[e.code];
  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

async function ssSignUp(email, password, name) {
  try {
    var cred = await auth.createUserWithEmailAndPassword(email, password);
    // merge:true — 동시에 진행될 수 있는 인증 상태 처리 로직과 겹치더라도
    // 서로의 데이터를 덮어쓰지 않고 보존한다.
    await db.collection('users').doc(cred.user.uid).set({
      name: name, email: email, avatar: '😀',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (e) { return { success: false, error: ssAuthErrorMessage(e) }; }
}
async function ssLogin(email, password) {
  try { await auth.signInWithEmailAndPassword(email, password); return { success: true }; }
  catch (e) { return { success: false, error: ssAuthErrorMessage(e) }; }
}
async function ssLogout() {
  // 예전엔 signOut()이 실패하면(네트워크 오류 등) 예외가 그대로 위로 던져져서
  // doLogout()의 hideLoading()/showAuthScreen()이 실행되지 못하고 로딩 화면에
  // 멈춘 것처럼 보이는 문제가 있었다. 다른 ss* 함수들과 같은 형태로 통일.
  try { await auth.signOut(); return { success: true }; }
  catch (e) { return { success: false, error: ssAuthErrorMessage(e) }; }
}

// ===== 비밀번호 찾기 (재설정 메일 발송) =====
// 인증 방식 자체(이메일/비밀번호)는 그대로 두고, Firebase가 제공하는
// 표준 비밀번호 재설정 메일 발송 기능만 추가한다.
async function ssSendPasswordReset(email) {
  try { await auth.sendPasswordResetEmail(email); return { success: true }; }
  catch (e) { return { success: false, error: ssAuthErrorMessage(e) }; }
}

// ===== 로그인 중 비밀번호 변경 =====
async function ssChangePassword(currentPassword, newPassword) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 상태가 아닙니다.' };
  try {
    var cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(cred);
  } catch (e) {
    return { success: false, error: ssAuthErrorMessage(e) };
  }
  try {
    await user.updatePassword(newPassword);
    return { success: true };
  } catch (e) {
    return { success: false, error: ssAuthErrorMessage(e) };
  }
}

// ===== 계정(로그인) 삭제 =====
// 보안 정책상 민감한 작업(계정 삭제)은 최근 로그인 상태를 요구하므로,
// 비밀번호를 다시 입력받아 재인증한 뒤 삭제를 진행한다.
// 주의: 이 함수는 로그인 자격(Firebase Auth 계정)과 개인 프로필 문서(users/{uid})만
// 삭제한다. 이 사용자가 만든 프로젝트/작업/댓글 등 팀과 공유된 데이터는
// 다른 팀원에게 영향을 줄 수 있으므로 자동으로 연쇄 삭제하지 않는다.
async function ssDeleteAccount(password) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 상태가 아닙니다.' };
  try {
    var cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(cred);
  } catch (e) {
    return { success: false, error: ssAuthErrorMessage(e) };
  }
  try {
    await db.collection('users').doc(user.uid).delete();
  } catch (e) { /* 프로필 문서 삭제 실패는 계정 삭제 자체를 막지 않는다 */ }
  try {
    await user.delete();
    return { success: true };
  } catch (e) {
    return { success: false, error: ssAuthErrorMessage(e) };
  }
}

console.log('🔐 Auth 모듈 로드!');
