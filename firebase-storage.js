/* Syncspace - Storage (파일 업로드) */

async function ssUploadTaskFile(taskId, file) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (!window.storage) return { success: false, error: 'Storage를 사용할 수 없습니다' };
  try {
    var path = 'tasks/' + taskId + '/' + Date.now() + '_' + file.name;
    var ref = storage.ref().child(path);
    var snap = await ref.put(file);
    var url = await snap.ref.getDownloadURL();
    // 기존 ssAddTaskFile()을 그대로 재사용해 files 배열에 기록
    return await ssAddTaskFile(taskId, { name: file.name, type: file.type, size: file.size, url: url, path: path });
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssUploadAvatar(file) {
  var user = auth.currentUser;
  if (!user) return { success: false, error: '로그인 필요' };
  if (!window.storage) return { success: false, error: 'Storage를 사용할 수 없습니다' };
  try {
    var path = 'avatars/' + user.uid + '/' + Date.now() + '_' + file.name;
    var ref = storage.ref().child(path);
    var snap = await ref.put(file);
    var url = await snap.ref.getDownloadURL();
    return { success: true, url: url, path: path };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssDeleteStorageFile(path) {
  if (!window.storage || !path) return { success: false };
  try { await storage.ref().child(path).delete(); return { success: true }; }
  catch (e) { return { success: false }; }
}

console.log('📎 Storage 모듈 로드!');
