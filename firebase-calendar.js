/* Syncspace - Calendar & Schedule */
async function ssCreateEvent(projectId, data) {
  var user = auth.currentUser;
  if (!user) return { success: false };
  try {
    await db.collection('events').add({
      projectId: projectId, title: data.title, description: data.description || '',
      date: data.date, endDate: data.endDate || data.date,
      time: data.time || '', color: data.color || '6366F1',
      type: data.type || 'event', // event, milestone, deadline
      creatorId: user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function ssGetEvents(projectId) {
  try {
    var snap = await db.collection('events').where('projectId', '==', projectId).limit(100).get();
    var events = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      events.push({ id: doc.id, ...d, createdAt: d.createdAt ? d.createdAt.toDate() : null });
    });
    events.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    return { success: true, events: events };
  } catch (e) { return { success: false, events: [] }; }
}

async function ssUpdateEvent(eventId, data) {
  try { await db.collection('events').doc(eventId).update(data); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

async function ssDeleteEvent(eventId) {
  try { await db.collection('events').doc(eventId).delete(); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

// 이번 달 캘린더 데이터 생성
function ssGenerateCalendar(year, month) {
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var weeks = [];
  var day = 1;
  for (var w = 0; w < 6; w++) {
    var week = [];
    for (var d = 0; d < 7; d++) {
      if ((w === 0 && d < firstDay) || day > daysInMonth) { week.push(null); }
      else { week.push(day); day++; }
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }
  return weeks;
}

console.log('📅 Calendar 모듈 로드!');
