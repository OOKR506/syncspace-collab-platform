/* ============================================================
   Syncspace v4.0 — UI/UX 전면 개선판
   ※ Firebase 연동 로직/함수명은 기존과 100% 동일하게 유지
   ============================================================ */

var currentUser=null,isLoggedIn=false,currentView='dashboard',currentProject=null,currentProjectId=null,allProjects=[],draggedTask=null,darkMode=localStorage.getItem('syncspace-darkmode')==='true',filterTags=[],searchQuery='',notificationCount=0;
var todoPriorityFilter='all', todoStarredOnly=false, myTasksStarredOnly=false, todoSortBy='order';
var bulkMode=false, selectedTaskIds=[];
var currentLang=localStorage.getItem('syncspace-lang')||'ko';
const AVATARS=['😀','😎','🤩','😍','🥳','🤓','😤','🦸','🧑‍💼','🧑‍🎨','🧑‍💻','🧑‍🔬'];

/* ================= 기본 유틸 ================= */
function escHtml(t){var d=document.createElement('div');d.textContent=t==null?'':t;return d.innerHTML;}
function fmtDate(d){if(!d)return'';var dt=d instanceof Date?d:new Date(d);return dt.getFullYear()+'-'+(dt.getMonth()+1).toString().padStart(2,'0')+'-'+dt.getDate().toString().padStart(2,'0');}
function relDate(d){if(!d)return'';var dt=d instanceof Date?d:new Date(d);var diff=Date.now()-dt;if(diff<60000)return'방금';if(diff<3600000)return Math.floor(diff/60000)+'분 전';if(diff<86400000)return Math.floor(diff/3600000)+'시간 전';return Math.floor(diff/86400000)+'일 전';}
function refreshIcons(){ if(window.lucide){ try{ lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); }catch(e){} } }
function setAuthLayout(on){
  var m=document.querySelector('main'); if(m) m.style.marginLeft=on?'0':'';
  // 로그인 전(소개/로그인 화면)에는 모바일 상단바와 하단 탭바도 숨긴다
  var bars=document.querySelectorAll('.app-topbar,.app-tabbar');
  for(var i=0;i<bars.length;i++) bars[i].style.display=on?'none':'';
  var c=document.getElementById('content'); if(c) c.style.paddingBottom=on?'0':'';
}
function setContent(html){ document.getElementById('content').innerHTML=html; refreshIcons(); window.scrollTo(0,0); }
function icon(name,cls){ return '<i data-lucide="'+name+'" class="'+(cls||'w-4 h-4')+'"></i>'; }

/* ================= 검색창 디바운스 =================
   검색 입력마다 화면 전체를 다시 그리면(setContent가 input을 통째로 새로 만듦):
   1) 타이핑할 때마다 화면이 깜빡이고, 2) 한글 등 조합형 입력(IME) 중간에 입력창이
   사라졌다 생기면서 조합이 끊겨 한 글자씩만 입력되는 것처럼 보인다.
   그래서 입력이 잠시 멈췄을 때만 다시 그리고, 다시 그린 뒤에는 포커스와 커서
   위치를 그대로 복원해 이어서 타이핑할 수 있게 한다. */
var searchDebounceTimer=null;
function debouncedSearch(renderFn, inputId){
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer=setTimeout(async function(){
    // renderKanban/renderTodos는 async 함수라서 렌더링이 끝나기 전에(스켈레톤 화면일 때)
    // 포커스를 복원하려 하면 검색창이 아직 DOM에 없어서 복원이 조용히 실패했다.
    // (이게 "한 글자만 입력된다"/"화면이 깜빡인다" 버그의 진짜 원인 — 렌더가 끝나길
    // 기다리지 않고 바로 포커스를 찾으려 했던 것. 한글/영문 모두 동일하게 깨졌던 이유이기도 함)
    // silent=true를 넘겨서 검색으로 인한 재렌더링에서는 스켈레톤 깜빡임도 건너뛴다.
    var el=document.getElementById(inputId);
    var pos=el?el.selectionStart:null;
    await renderFn(true);
    var el2=document.getElementById(inputId);
    if(el2){ el2.focus(); if(pos!=null){ try{ el2.setSelectionRange(pos,pos); }catch(e){} } }
  }, 300);
}

/* ================= Toast ================= */
/* 사용자가 직접 입력한 값(제목·이름 등)은 영어 모드에서 번역하지 않도록 표시한다. */
function escUser(v){ return '<span translate="no">'+escHtml(v)+'</span>'; }
/* 서버(Firebase)가 돌려주는 영문 오류 문구를 사용자가 이해할 수 있는 한글로 바꾼다. */
function ssKoErrorText(m){
  m=(m==null?'':String(m));
  var hasKo=/[가-힣]/.test(m);
  var tail=m, head='';
  if(hasKo){ var i=m.indexOf(': '); if(i<0 || /[가-힣]/.test(m.slice(i+2))) return m; head=m.slice(0,i+2); tail=m.slice(i+2); }
  var ko;
  if(/permission|PERMISSION_DENIED|insufficient/i.test(tail)) ko='권한이 없습니다. 프로젝트 멤버인지 확인해 주세요';
  else if(/network|unavailable|offline|failed to fetch|timeout|deadline/i.test(tail)) ko='네트워크 연결을 확인한 뒤 다시 시도해 주세요';
  else if(/not.?found/i.test(tail)) ko='요청한 항목을 찾을 수 없습니다';
  else if(/quota|resource.?exhausted|too.?many/i.test(tail)) ko='요청이 너무 많습니다. 잠시 후 다시 시도해 주세요';
  else if(/already.?exists/i.test(tail)) ko='이미 존재하는 항목입니다';
  else if(/unauthenticated|requires-recent-login/i.test(tail)) ko='다시 로그인한 뒤 시도해 주세요';
  else if(/[A-Za-z]{4,}/.test(tail)) ko='문제가 발생했습니다. 잠시 후 다시 시도해 주세요';
  else return m;
  return head+ko;
}
function showToast(msg,type){
  if(type==='error') msg=ssKoErrorText(msg);
  var cfg={
    success:{bg:'var(--success)',ic:'check-circle-2'},
    error:{bg:'var(--danger)',ic:'alert-circle'},
    info:{bg:'var(--text)',ic:'info'}
  }[type||'info'];
  var t=document.createElement('div');
  t.className='toast'; t.style.background=cfg.bg; t.style.color='#fff';
  t.innerHTML=icon(cfg.ic,'w-4 h-4 shrink-0')+'<span>'+escHtml(msg)+'</span>';
  document.getElementById('toast-root').appendChild(t);
  refreshIcons();
  setTimeout(()=>{ t.style.transition='opacity .2s'; t.style.opacity='0'; setTimeout(()=>t.remove(),200); },2600);
}
/* 모달 안 한 줄 입력칸에서 Enter를 누르면 모달의 주 버튼(저장/추가/삭제 등)을 누른 것과 같게 동작.
   한글 입력 중(조합 상태)의 Enter, 자체 Enter 처리가 있는 입력칸, textarea/select는 제외한다. */
/* 로그인 전 화면(가입·비밀번호 재설정): Enter로 다음 칸 이동, 마지막 칸에서 Enter로 실행 */
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter' || ev.isComposing || ev.keyCode===229 || ev.defaultPrevented) return;
  var el=ev.target; if(!el || el.tagName!=='INPUT' || el.hasAttribute('onkeydown')) return;
  var form=el.closest && el.closest('#auth-form'); if(!form) return;
  var inputs=Array.prototype.slice.call(form.querySelectorAll('input')); var i=inputs.indexOf(el);
  ev.preventDefault();
  if(i>=0 && i<inputs.length-1){ inputs[i+1].focus(); return; }
  var b=form.querySelector('.btn-primary'); if(b) b.click();
});
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter' || ev.isComposing || ev.keyCode===229 || ev.defaultPrevented || ev.shiftKey) return;
  var el=ev.target; if(!el) return;
  var mod=ev.ctrlKey||ev.metaKey; // Ctrl/⌘+Enter는 설명칸(textarea)에서도 저장
  if(el.tagName==='INPUT'){
    if(/^(checkbox|radio|file|button|submit|range|color)$/.test(el.type)) return;
    if(el.hasAttribute('onkeydown') && !mod) return;
  } else if(!(el.tagName==='TEXTAREA' && (mod || el.hasAttribute('data-enter-submit')))) return;
  var modal=el.closest && el.closest('#modal'); if(!modal) return;
  var btns=modal.querySelectorAll('.btn-primary,.btn-danger'); var b=btns[btns.length-1];
  if(b && !b.disabled){ ev.preventDefault(); b.click(); }
});
/* ================= 입력 편의: 비밀번호 보기 · 임시 저장 ================= */
function ssPwHost(el){ var p=el.parentNode; return (p && p.getAttribute && p.getAttribute('data-pwwrap'))?p:el; }
function ssAttachPwToggle(inp){
  if(inp.getAttribute('data-pwt')) return; inp.setAttribute('data-pwt','1');
  var wrap=document.createElement('div'); wrap.setAttribute('data-pwwrap','1'); wrap.style.position='relative';
  inp.parentNode.insertBefore(wrap,inp); wrap.appendChild(inp);
  inp.style.paddingRight='3.5rem';
  var b=document.createElement('button'); b.type='button'; b.tabIndex=-1; b.textContent='보기';
  b.setAttribute('aria-label','비밀번호 보기'); b.setAttribute('aria-pressed','false');
  b.style.cssText='position:absolute;right:8px;top:0;height:40px;font-size:12.5px;font-weight:600;color:var(--text-3);background:none;border:0;cursor:pointer;padding:0 4px';
  b.addEventListener('click',function(){ var show=inp.type==='password'; inp.type=show?'text':'password'; b.textContent=show?'숨기기':'보기'; b.setAttribute('aria-pressed',String(show)); b.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 보기'); inp.focus(); });
  wrap.insertBefore(b,inp);
}
/* 작성 중인 내용 임시 저장 (같은 프로젝트·같은 입력칸, 24시간 이내). 보내기/추가에 성공하면 지운다. */
var DRAFT_IDS=['chat-input','task-title','task-desc','event-title','proj-name','proj-desc'];
function ssDraftKey(id){ return 'ss-draft:'+(currentUser?currentUser.uid:'')+':'+(currentProjectId||'-')+':'+id; }
function ssClearDraft(){ try{ for(var i=0;i<arguments.length;i++) localStorage.removeItem(ssDraftKey(arguments[i])); }catch(e){} }
function ssRestoreDraft(el){
  if(el.getAttribute('data-drafted')) return; el.setAttribute('data-drafted','1');
  try{
    var raw=localStorage.getItem(ssDraftKey(el.id)); if(!raw||el.value) return;
    var d=JSON.parse(raw); if(!d||!d.v||Date.now()-d.t>864e5){ localStorage.removeItem(ssDraftKey(el.id)); return; }
    el.value=d.v; if(el.id==='task-title'||el.id==='proj-name'||el.id==='event-title'){ try{ el.select(); }catch(e){} }
    if(el.id!=='chat-input') showToast('작성 중이던 내용을 불러왔어요','info');
  }catch(e){}
}
document.addEventListener('input',function(ev){
  var el=ev.target; if(!el || DRAFT_IDS.indexOf(el.id)===-1) return;
  try{ if(el.value) localStorage.setItem(ssDraftKey(el.id),JSON.stringify({v:el.value,t:Date.now()})); else localStorage.removeItem(ssDraftKey(el.id)); }catch(e){}
});
(function(){
  var scheduled=false;
  function scan(){
    scheduled=false;
    document.querySelectorAll('input[type=password]:not([data-pwt])').forEach(ssAttachPwToggle);
    DRAFT_IDS.forEach(function(id){ var el=document.getElementById(id); if(el && !el.getAttribute('data-drafted') && currentUser) ssRestoreDraft(el); });
  }
  new MutationObserver(function(){ if(!scheduled){ scheduled=true; setTimeout(scan,0); } }).observe(document.documentElement,{childList:true,subtree:true});
})();
/* ---- 입력칸 아래 인라인 오류 표시 (토스트 대신 해당 칸 가까이에 안내) ---- */
function ssClearFieldError(id){
  var el=document.getElementById(id); if(!el) return;
  el.style.borderColor=''; el.removeAttribute('aria-invalid');
  var h=ssPwHost(el); var n=h.nextElementSibling; if(n && n.classList.contains('ss-field-err')) n.remove();
}
function ssFieldError(id,msg){
  var el=document.getElementById(id); if(!el) return false;
  ssClearFieldError(id);
  el.style.borderColor='var(--danger)'; el.setAttribute('aria-invalid','true');
  var d=document.createElement('div'); d.className='ss-field-err'; d.setAttribute('role','alert');
  d.style.cssText='color:var(--danger);font-size:12px;margin-top:4px'; d.textContent=msg;
  ssPwHost(el).insertAdjacentElement('afterend',d);
  var f=function(){ ssClearFieldError(id); el.removeEventListener('input',f); };
  el.addEventListener('input',f);
  return true;
}
function ssSetDate(id,days){ var el=document.getElementById(id); if(!el) return; var d=new Date(); d.setDate(d.getDate()+days); el.value=fmtDate(d); el.dispatchEvent(new Event('input',{bubbles:true})); }
function ssDateChips(id){ return '<div class="flex gap-1 mt-1.5">'+[['오늘',0],['내일',1],['다음 주',7]].map(function(c){return '<button type="button" onclick="ssSetDate(\''+id+'\','+c[1]+')" class="btn-ghost" style="padding:2px 8px;font-size:12px;min-height:0">'+c[0]+'</button>';}).join('')+'</div>'; }
function ssIsEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
/* ---- #1 실행 취소(Undo) 토스트 ---- */
function showUndoToast(msg,undoFn){
  var t=document.createElement('div');
  // #8 다크모드 점검: var(--text)/var(--surface)를 쓰면 다크모드에서 밝은 배경으로 반전되어
  // 고정 버튼색(#93c5fd)의 대비가 깨짐 → 테마와 무관하게 항상 짙은 배경의 스낵바로 고정
  t.className='toast'; t.style.background='#1F2937'; t.style.color='#F9FAFB';
  t.innerHTML=icon('trash-2','w-4 h-4 shrink-0')+'<span class="flex-1">'+escHtml(msg)+'</span>'
    +'<button style="color:#93c5fd;font-weight:700;margin-left:6px">실행취소</button>';
  var btn=t.querySelector('button');
  btn.addEventListener('click', function(){ t.remove(); undoFn(); });
  document.getElementById('toast-root').appendChild(t);
  refreshIcons();
  setTimeout(()=>{ if(t.parentNode){ t.style.transition='opacity .2s'; t.style.opacity='0'; setTimeout(()=>t.remove(),200); } },5000);
}

/* ================= Modal shell ================= */
function modalWrap(title,bodyHtml,footerHtml,widthClass){
  return '<div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 animate-fade-fast" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal-panel w-full '+(widthClass||'max-w-md')+' max-h-[88vh] flex flex-col animate-modal" role="dialog" aria-modal="true" aria-label="'+title+'" onclick="event.stopPropagation()">'
      +'<div class="modal-header shrink-0"><h3 class="text-section-title">'+title+'</h3>'
        +'<button onclick="closeModal()" class="icon-btn" aria-label="닫기">'+icon('x')+'</button></div>'
      +'<div class="modal-body overflow-y-auto">'+bodyHtml+'</div>'
      +(footerHtml?'<div class="modal-footer shrink-0">'+footerHtml+'</div>':'')
    +'</div></div>';
}
var modalLastFocusedEl=null;
function showModal(html){
  modalLastFocusedEl=document.activeElement;
  document.getElementById('modal').innerHTML=html;
  document.getElementById('modal').classList.remove('hidden');
  refreshIcons();
  // #9 접근성: 모달이 열리면 포커스를 모달 안으로 이동하고, Tab 이동을 모달 내부로 가둔다(focus trap)
  setTimeout(function(){
    var panel=document.querySelector('#modal .modal-panel');
    if(!panel) return;
    var focusable=panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(focusable.length) focusable[0].focus(); else panel.setAttribute('tabindex','-1'), panel.focus();
  },30);
}
function trapModalFocus(ev){
  if(ev.key!=='Tab') return;
  var panel=document.querySelector('#modal .modal-panel'); if(!panel) return;
  var focusable=Array.prototype.slice.call(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled && el.offsetParent!==null);
  if(!focusable.length) return;
  var first=focusable[0], last=focusable[focusable.length-1];
  if(ev.shiftKey && document.activeElement===first){ ev.preventDefault(); last.focus(); }
  else if(!ev.shiftKey && document.activeElement===last){ ev.preventDefault(); first.focus(); }
}
function closeModal(){
  document.getElementById('modal').innerHTML='';
  document.getElementById('modal').classList.add('hidden');
  // showTaskDetail()이 남겨둔 data-task-id가 모달을 완전히 닫은 뒤에도 그대로 남아있으면,
  // 나중에 전혀 다른(작업과 무관한) 모달이 열렸을 때 그 값을 엉뚱하게 참조할 수 있다
  // (예: 단축키 T/E가 예전 작업 id로 오작동). 모달이 완전히 닫힐 때 지운다.
  document.getElementById('modal').removeAttribute('data-task-id');
  if(modalLastFocusedEl && typeof modalLastFocusedEl.focus==='function') modalLastFocusedEl.focus();
  modalLastFocusedEl=null;
}
document.addEventListener('keydown', function(ev){
  if(!document.getElementById('modal').classList.contains('hidden')) trapModalFocus(ev);
});
function showLoading(){ var l=document.getElementById('loading'); if(l)l.style.display='flex'; }
function hideLoading(){ var l=document.getElementById('loading'); if(l)l.style.display='none'; }

/* ================= 공통 컴포넌트 빌더 ================= */
function emptyState(iconName,title,desc,actionHtml){
  return '<div class="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade">'
    +'<div class="relative w-20 h-20 mb-5 flex items-center justify-center">'
      +'<div class="absolute inset-0 rounded-full" style="background:radial-gradient(circle, var(--primary-soft) 0%, transparent 72%)"></div>'
      +'<div class="relative w-14 h-14 rounded-2xl flex items-center justify-center icon-tile-soft">'+icon(iconName,'w-6 h-6').replace('class="','style="color:var(--primary-soft-text)" class="')+'</div>'
    +'</div>'
    +'<h3 class="text-card-title mb-1">'+title+'</h3>'
    +'<p class="text-body max-w-sm mb-4">'+desc+'</p>'
    +(actionHtml||'')
  +'</div>';
}
function skeletonBlock(h,w){ return '<div class="skeleton" style="height:'+(h||'16px')+';width:'+(w||'100%')+'"></div>'; }
function skeletonCard(){
  return '<div class="card card-pad space-y-3">'+skeletonBlock('14px','40%')+skeletonBlock('10px','90%')+skeletonBlock('10px','70%')+'</div>';
}
function skeletonGrid(n,cols){
  var items=''; for(var i=0;i<(n||6);i++) items+=skeletonCard();
  return '<div class="grid grid-cols-1 '+(cols||'md:grid-cols-3')+' gap-4 p-6">'+items+'</div>';
}
function priorityBadge(p){
  if(p==='high') return '<span class="badge-danger">'+icon('flame','w-3 h-3')+'높음</span>';
  if(p==='low') return '<span class="badge-success">'+icon('arrow-down','w-3 h-3')+'낮음</span>';
  return '<span class="badge-warning">'+icon('minus','w-3 h-3')+'보통</span>';
}
function statusBadge(status){
  if(status==='done') return '<span class="badge-success">'+icon('check','w-3 h-3')+'완료</span>';
  if(status==='inprogress') return '<span class="badge-warning">'+icon('loader','w-3 h-3')+'진행 중</span>';
  return '<span class="badge-neutral">'+icon('circle-dashed','w-3 h-3')+'할 일</span>';
}
function avatarCircle(emoji,size){
  size=size||'w-8 h-8 text-base';
  // 업로드한 사진(URL/데이터 URI)과 이모지 아바타를 함께 지원한다.
  if(emoji && /^(https?:|data:)/.test(emoji)){
    return '<div class="avatar '+size+'" style="overflow:hidden;padding:0"><img src="'+escHtml(emoji)+'" alt="" style="width:100%;height:100%;object-fit:cover"></div>';
  }
  return '<div class="avatar '+size+'">'+(emoji||'😀')+'</div>';
}

/* ================= 인증 상태 → 앱 진입 공통 처리 =================
   onAuthStateChanged와 doLogin()이 이 함수를 함께 재사용한다.
   - "로그인 여부"는 오직 Firebase Auth의 user 존재 여부로만 판단한다.
   - Firestore users 문서는 프로필 데이터 소스일 뿐, 로그인 판단 기준이 아니다.
   - 동일 uid에 대한 동시 호출은 하나의 진행 중 Promise로 합쳐 중복 실행(대시보드 중복
     렌더링, Firestore 문서 중복 생성)을 방지한다. */
var authFlowUid=null, authFlowPromise=null;

async function handleAuthenticatedUser(user){
  if(!user) return;

  // 이미 동일 사용자에 대한 처리가 진행 중이면 그 결과를 그대로 공유한다.
  if(authFlowPromise && authFlowUid===user.uid) return authFlowPromise;

  authFlowUid=user.uid;
  authFlowPromise=(async()=>{
    // Firebase Auth 인증 여부만으로 로그인 상태를 즉시 확정한다.
    isLoggedIn=true;

    // Firestore 프로필은 조회 → 없으면(회원가입 직후 race condition 포함) 보정 생성.
    // merge:true로 기존 데이터(예: 회원가입 시 작성된 name, createdAt)를 보존한다.
    var uDoc=await db.collection('users').doc(user.uid).get();
    if(!uDoc.exists){
      await db.collection('users').doc(user.uid).set({
        name: user.displayName || (user.email? user.email.split('@')[0] : '사용자'),
        email: user.email || '',
        avatar: '😀',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });
      uDoc=await db.collection('users').doc(user.uid).get();
    }
    currentUser={ uid:user.uid, ...uDoc.data() };

    updateAuthUI();
    await loadProjects();
    updateProjectChrome();
    loadNotifications();
    setupNotificationListener();
    document.getElementById('sidebar').style.display=''; setAuthLayout(false);
    applyStartView();
    checkDueSoonNotifications();
    setTimeout(maybeAutoShowDigest, 1200);
  })();

  try{ await authFlowPromise; }
  finally{ authFlowUid=null; authFlowPromise=null; }
}

/* ================= 앱 초기화 ================= */
document.addEventListener('DOMContentLoaded',()=>{
  applyDarkMode();
  refreshIcons();
  applyI18n();
  // #13 읽기 전용 공유 링크: ?share=projectId:shareId 파라미터가 있으면 로그인 없이 공개 뷰만 렌더링
  var shareParam = new URLSearchParams(location.search).get('share');
  if(shareParam){ renderPublicShareView(shareParam); return; }
  // #11 QR/링크 참여: ?join=projectId:joinToken — 로그인은 정상적으로 거친 뒤 로그인 완료 시점에 처리
  var joinParam = new URLSearchParams(location.search).get('join');
  auth.onAuthStateChanged(async user=>{
    if(user){
      await handleAuthenticatedUser(user);
      if(joinParam) await processPendingJoin(joinParam);
    } else {
      currentUser=null; isLoggedIn=false;
      authFlowUid=null; authFlowPromise=null;
      if(notifUnsubscribe){ try{ notifUnsubscribe(); }catch(e){} notifUnsubscribe=null; }
      stopChatListener();
      updateAuthUI();
      document.getElementById('sidebar').style.display='none'; setAuthLayout(true);
      if(!landingShown && !joinParam){ landingShown=true; showLandingScreen(); }
      else showAuthScreen();
    }
  });
});

/* 다크 모드는 제거되었다: 항상 라이트 테마. (예전에 저장된 다크/시스템 설정은 무시하고 지운다) */
var themeMode='light';
try{ localStorage.removeItem('syncspace-theme'); localStorage.removeItem('syncspace-darkmode'); }catch(e){}
function resolveDarkMode(){ return false; }
function setThemeMode(){ applyDarkMode(); }
function toggleDarkMode(){ applyDarkMode(); }
function applyDarkMode(){
  darkMode=resolveDarkMode();
  var root=document.documentElement;
  if(darkMode) root.classList.add('dark'); else root.classList.remove('dark');
  refreshIcons();
}
function openDrawer(){ var s=document.getElementById('sidebar'); s.style.display=''; s.classList.remove('hidden'); s.classList.add('flex'); document.getElementById('drawer-backdrop').classList.remove('hidden'); }
function closeDrawer(){ var s=document.getElementById('sidebar'); s.classList.add('hidden'); s.classList.remove('flex'); document.getElementById('drawer-backdrop').classList.add('hidden'); }

async function loadProjects(){ var r=await ssGetProjects(); allProjects=r.projects||[]; if(r.success!==false) markSynced(); }
function updateAuthUI(){
  var el=document.getElementById('user-area'); if(!el)return;
  el.textContent = isLoggedIn ? (currentUser.name||'사용자') : '';
}
async function loadNotifications(){ var r=await ssGetNotifications(); var notifs=(r.notifications||[]).filter(n=>notifTypeAllowed(n.type)); notificationCount=isDndActive()?0:notifs.filter(n=>!n.read).length; updateNotificationBadge(); }
function updateNotificationBadge(){
  var badge=document.getElementById('notif-badge'); var dot=document.getElementById('notif-badge-mobile');
  if(badge){ if(notificationCount>0){ badge.textContent=notificationCount>99?'99+':notificationCount; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
  if(dot){ if(notificationCount>0) dot.classList.remove('hidden'); else dot.classList.add('hidden'); }
  document.querySelectorAll('.tabbar-bell-badge').forEach(function(b){ b.textContent=notificationCount>99?'99+':notificationCount; b.style.display=notificationCount>0?'flex':'none'; });
}
var notifUnsubscribe=null, notifSnapFirst=true;
function setupNotificationListener(){
  if(!currentUser)return;
  // 로그아웃 후 다시 로그인해도 구독이 중복으로 쌓이지 않도록 이전 구독을 해제한다.
  if(notifUnsubscribe){ try{ notifUnsubscribe(); }catch(e){} notifUnsubscribe=null; }
  notifSnapFirst=true;
  // orderBy를 빼서 별도의 Firestore 복합 색인 없이도 동작하도록 함.
  // (userId만으로 필터링 — 여기선 "새 미확인 알림이 추가됐는지"만 감지하면 되므로 정렬은 필요 없음)
  try{ notifUnsubscribe=db.collection('notifications').where('userId','==',currentUser.uid).limit(20)
    .onSnapshot(function(snapshot){
      var fresh=[];
      snapshot.docChanges().forEach(c=>{ if(c.type==='added'&&!c.doc.data().read) fresh.push({id:c.doc.id,...c.doc.data()}); });
      var isFirst=notifSnapFirst; notifSnapFirst=false;
      if(!fresh.length) return;
      // 지금 그 프로젝트의 채팅 화면을 보고 있다면 채팅 알림은 바로 읽음 처리한다(이미 화면에서 보고 있으므로)
      if(!isFirst){
        var seen=fresh.filter(n=>n.type==='chat_message' && currentView==='chat' && n.projectId===currentProjectId);
        seen.forEach(n=>{ ssMarkNotificationRead(n.id).then(function(){ loadNotifications(); }); });
        fresh=fresh.filter(n=>seen.indexOf(n)===-1);
        if(!fresh.length) return;
      }
      loadNotifications();
      // 첫 스냅샷은 '원래 있던 안 읽은 알림'이라 토스트를 띄우지 않는다. 이후 새로 도착한 알림만 바로 알려준다.
      if(isFirst) return;
      var shown=fresh.filter(n=>notifTypeAllowed(n.type));
      if(!shown.length || isDndActive()) return;
      var n=shown[0];
      showToast('🔔 '+notifMeta(n.type).label+': '+(n.taskTitle||n.message||'새 알림')+(shown.length>1?' 외 '+(shown.length-1)+'건':''),'info');
      if(currentView==='dashboard') renderDashboard();
      else if(currentView==='notifications') renderNotifications();
      renderNotifPopoverContent();
    },
    function(err){ console.error('setupNotificationListener 실패:', err); });
  }catch(e){ console.error('setupNotificationListener 실패:', e); }
}
// 알림 종류별 아이콘/이름 (홈 화면 알림 카드와 실시간 토스트에서 공통 사용)
function notifMeta(type){
  var map={
    task_assigned:{icon:'user-plus',label:'작업 할당'}, comment_added:{icon:'message-circle',label:'새 댓글'},
    mention:{icon:'at-sign',label:'멘션'}, review_request:{icon:'eye',label:'리뷰 요청'},
    ownership_transferred:{icon:'crown',label:'소유권 이전'}, project_invite:{icon:'mail-plus',label:'프로젝트 초대'},
    part_assigned:{icon:'layers',label:'파트 지정'}, chat_message:{icon:'message-square',label:'새 채팅'}
  };
  return map[type]||{icon:'bell',label:'알림'};
}
// 알림을 처리한 뒤: 지금 보고 있는 화면(홈/알림 화면)과 열려 있는 알림 벨 팝오버를 갱신한다
function refreshNotificationViews(){
  if(currentView==='dashboard') renderDashboard();
  else if(currentView==='notifications') renderNotifications();
  renderNotifPopoverContent();
}
// 홈 알림 카드와 상단 알림 벨 팝오버가 함께 쓰는 알림 한 줄
function notifRowHtml(n){
  var meta=notifMeta(n.type); var unread=!n.read;
  var action='';
  if(n.type==='project_invite'){
    action = n.resolution
      ? '<div class="text-meta mt-1">'+(n.resolution==='accepted'?'수락함':n.resolution==='declined'?'거절함':'취소된 초대')+'</div>'
      : '<div class="flex gap-2 mt-1.5"><button onclick="event.stopPropagation();doAcceptInvite(\''+n.id+'\',\''+n.inviteId+'\')" class="btn-sm btn-primary">'+icon('check','w-3.5 h-3.5')+'수락</button><button onclick="event.stopPropagation();doDeclineInvite(\''+n.id+'\',\''+n.inviteId+'\')" class="btn-sm btn-secondary">거절</button></div>';
  }
  var clickable = n.type!=='project_invite' && (n.taskId || n.type==='chat_message' || unread);
  return '<div class="flex items-start gap-2.5 px-1 py-2.5'+(clickable?' cursor-pointer hover:opacity-80':'')+'" style="'+(unread?'':'opacity:.6')+'"'
    + (clickable?' onclick="doOpenNotification(\''+n.id+'\','+(n.taskId?'\''+n.taskId+'\'':'null')+','+(n.projectId?'\''+n.projectId+'\'':'null')+','+(unread?'true':'false')+',\''+n.type+'\')"':'')+'>'
    + '<div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 icon-tile-soft">'+icon(meta.icon,'w-3.5 h-3.5 text-[color:var(--primary-soft-text)]')+'</div>'
    + '<div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="text-meta font-semibold" style="color:var(--text-2)">'+meta.label+'</span><span class="text-meta">'+relDate(n.createdAt)+'</span></div>'
      + '<div class="text-body">'+escHtml(n.taskTitle||n.message||'새 알림')+'</div>'+action+'</div>'
    + (unread?'<div class="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style="background:var(--primary)"></div>':'')
  +'</div>';
}
// 상단 탭바의 알림 벨 — 알림 메뉴로 이동하지 않고 그 자리에서 확인/수락/읽음 처리
async function openNotifPopover(ev){
  toggleTabbarPopover(ev,'<div class="px-3 py-8 text-meta text-center">불러오는 중...</div>');
  var pop=document.getElementById('tabbar-popover'); if(!pop) return;   // 이미 열려 있어서 이번 클릭으로 닫힌 경우
  pop.setAttribute('data-kind','notif');
  await renderNotifPopoverContent();
}
async function renderNotifPopoverContent(){
  var pop=document.getElementById('tabbar-popover');
  if(!pop || pop.getAttribute('data-kind')!=='notif') return;
  var r=await ssGetNotifications();
  pop=document.getElementById('tabbar-popover');
  if(!pop || pop.getAttribute('data-kind')!=='notif') return;   // 불러오는 사이 닫힘
  var all=(r.notifications||[]).filter(n=>notifTypeAllowed(n.type));
  var unread=all.filter(n=>!n.read), read=all.filter(n=>n.read);
  var list=unread.concat(read).slice(0,8);
  pop.style.width='min(360px, calc(100vw - 16px))';
  pop.style.maxHeight='70vh'; pop.style.overflowY='auto'; pop.style.padding='6px 10px 8px';
  pop.innerHTML=
    '<div class="flex items-center justify-between py-2" style="border-bottom:1px solid var(--border)">'
      +'<span class="text-section-title">알림'+(unread.length?' <span class="badge-primary ml-1">'+unread.length+'</span>':'')+'</span>'
      +'<span class="flex items-center gap-3">'
        +(unread.length?'<button onclick="doMarkAllRead()" class="text-[12px] font-semibold" style="color:var(--primary)">모두 읽음</button>':'')
        +'<button onclick="closeTabbarPopover();showView(\'notifications\')" class="text-[12px] font-semibold" style="color:var(--text-2)">전체 보기</button>'
      +'</span></div>'
    +(list.length?'<div class="divide-hair">'+list.map(notifRowHtml).join('')+'</div>'
      :'<div class="py-8 text-center text-meta">새 알림이 없어요</div>');
  refreshIcons();
  // 오른쪽 화면 밖으로 나가지 않게 위치 보정
  var pr=pop.getBoundingClientRect();
  if(pr.right>window.innerWidth-8) pop.style.left=Math.max(8,window.innerWidth-pr.width-8)+'px';
}

/* ================= 서비스 소개(랜딩) 화면 =================
   로그인 전, 처음 접속했을 때 한 번 보여주는 소개 화면. 인증 로직과 무관하다. */
var landingShown=false;
function showLandingScreen(){
  document.getElementById('sidebar').style.display='none'; setAuthLayout(true);
  setContent('<style>.ld{font-family:inherit;color:var(--text)}.ld *{box-sizing:border-box}.ld-hero{background:linear-gradient(160deg,#4F46E5,#7C3AED);color:#fff;padding:max(56px,env(safe-area-inset-top)) 20px 64px;text-align:center}.ld-in{max-width:960px;margin:0 auto}.ld-logo{width:56px;height:56px;border-radius:18px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;margin:0 auto 14px}.ld-brand{font-size:15px;font-weight:700;letter-spacing:.02em;opacity:.9}.ld-hero h1{font-size:clamp(30px,6vw,46px);line-height:1.2;font-weight:800;margin:18px 0 14px}.ld-hero p{max-width:560px;margin:0 auto;font-size:16px;line-height:1.65;opacity:.92;word-break:keep-all}.ld-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:28px}.ld-b1{background:#fff;color:#4F46E5;font-weight:700;border:0;border-radius:12px;padding:13px 26px;font-size:16px;cursor:pointer;min-height:48px}.ld-b2{background:rgba(255,255,255,.14);color:#fff;font-weight:600;border:1px solid rgba(255,255,255,.4);border-radius:12px;padding:13px 22px;font-size:16px;cursor:pointer;min-height:48px}.ld-sec{padding:48px 20px}.ld-sec h2{font-size:24px;font-weight:800;text-align:center;margin:0 0 24px}.ld-alt{background:var(--surface-2)}.ld-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.ld-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;min-width:0}.ld-card h3{font-size:16px;font-weight:700;margin:12px 0 6px}.ld-card p{font-size:14px;line-height:1.6;color:var(--text-2);margin:0;word-break:keep-all}.ld-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(79,70,229,.12);color:#4F46E5}.ld-pain{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;font-size:15px;font-weight:600}.ld-num{width:34px;height:34px;border-radius:50%;background:linear-gradient(160deg,#4F46E5,#7C3AED);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}.ld-end{text-align:center;padding:48px 20px calc(48px + env(safe-area-inset-bottom))}.ld-end h2{font-size:24px;font-weight:800;margin:0 0 20px}.ld-end .ld-b1{background:linear-gradient(160deg,#4F46E5,#7C3AED);color:#fff}.ld-lk{display:block;margin:14px auto 0;background:none;border:0;color:var(--text-2);font-size:14px;text-decoration:underline;cursor:pointer;padding:8px}.ld-foot{font-size:12px;color:var(--text-3);margin-top:28px}</style><div class="ld"><section class="ld-hero"><div class="ld-in"><div class="ld-logo">'+icon('zap','w-7 h-7')+'</div><div class="ld-brand">Syncspace</div><h1>팀 프로젝트,<br>한 곳에서 끝내세요</h1><p>Syncspace는 할 일, 일정, 역할, 소통을 한 곳에 모아 팀원 모두가 같은 화면을 보며 일할 수 있게 해주는 팀 프로젝트 협업 플랫폼입니다.</p><div class="ld-btns"><button class="ld-b1" onclick="enterAuthFromLanding()">시작하기</button><button class="ld-b2" onclick="document.getElementById(\'ld-feat\').scrollIntoView({behavior:\'smooth\'})">서비스 알아보기</button></div></div></section><section class="ld-sec"><div class="ld-in" style="max-width:640px"><h2>이런 불편, 겪어보셨나요?</h2><div style="display:grid;gap:10px"><div class="ld-pain">'+icon('help-circle','w-5 h-5')+'<span>누가 무엇을 맡았는지 헷갈려요</span></div><div class="ld-pain">'+icon('calendar-x','w-5 h-5')+'<span>일정과 마감이 여기저기 흩어져 있어요</span></div><div class="ld-pain">'+icon('eye-off','w-5 h-5')+'<span>전체 진행 상황을 한눈에 보기 어려워요</span></div></div></div></section><section class="ld-sec ld-alt" id="ld-feat"><div class="ld-in"><h2>Syncspace가 해결해요</h2><div class="ld-grid"><div class="ld-card"><div class="ld-ic">'+icon('columns-3','w-5 h-5')+'</div><h3>할 일 목록</h3><p>할 일을 만들고 담당자를 정해 “할 일 · 진행 중 · 완료”로 관리해요.</p></div><div class="ld-card"><div class="ld-ic">'+icon('calendar','w-5 h-5')+'</div><h3>캘린더</h3><p>마감일과 팀 일정을 달력에서 한눈에 확인해요.</p></div><div class="ld-card"><div class="ld-ic">'+icon('gauge','w-5 h-5')+'</div><h3>파트별 진행률</h3><p>맡은 파트별로 어디까지 진행됐는지 비교해 볼 수 있어요.</p></div><div class="ld-card"><div class="ld-ic">'+icon('message-square','w-5 h-5')+'</div><h3>팀 채팅</h3><p>프로젝트 안에서 바로 대화하고 알림도 받아요.</p></div><div class="ld-card"><div class="ld-ic">'+icon('user-plus','w-5 h-5')+'</div><h3>팀원 초대</h3><p>링크나 QR 코드로 팀원을 간편하게 초대해요.</p></div><div class="ld-card"><div class="ld-ic">'+icon('smartphone','w-5 h-5')+'</div><h3>모바일 지원</h3><p>스마트폰에서도 같은 화면으로 편하게 사용해요.</p></div></div></div></section><section class="ld-sec"><div class="ld-in"><h2>이렇게 사용해요</h2><div class="ld-grid"><div class="ld-card"><div class="ld-num">1</div><h3>가입하고 로그인</h3><p>이메일로 간단히 계정을 만들어요.</p></div><div class="ld-card"><div class="ld-num">2</div><h3>프로젝트 만들고 초대</h3><p>프로젝트를 만들고 팀원을 초대해요.</p></div><div class="ld-card"><div class="ld-num">3</div><h3>나누고, 함께 진행</h3><p>할 일을 나누고 진행 상황을 함께 확인해요.</p></div></div></div></section><section class="ld-end ld-alt"><h2>지금 바로 시작해 보세요</h2><button class="ld-b1" onclick="enterAuthFromLanding()">시작하기</button><button class="ld-lk" onclick="enterAuthFromLanding()">이미 계정이 있어요</button><div class="ld-foot">Team Plus · 졸업 프로젝트 · <a href="#" onclick="showHelpModal();return false" style="color:inherit;text-decoration:underline">도움말</a> · <a href="#" onclick="showHelpModal(\'privacy\');return false" style="color:inherit;text-decoration:underline">개인정보·이용 안내</a></div></section></div>');
}
function enterAuthFromLanding(){ landingShown=true; showAuthScreen(); }

/* ================= 인증 화면 ================= */
function showAuthScreen(){
  document.getElementById('sidebar').style.display='none'; setAuthLayout(true);
  setContent(
  '<div class="min-h-screen flex items-center justify-center p-4" style="background:linear-gradient(160deg,#4F46E5,#7C3AED)">'
    +'<div class="w-full max-w-[400px] card card-pad" style="background:var(--surface)">'
      +'<div class="text-center mb-7">'
        +'<div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white icon-tile-brand">'+icon('zap','w-6 h-6')+'</div>'
        +'<h1 class="text-[22px] font-bold" style="color:var(--text)">Syncspace</h1>'
        +'<p class="text-body mt-1">팀 프로젝트 협업 플랫폼</p>'
      +'</div>'
      +'<div id="auth-form" class="space-y-3">'
        +'<div><label class="field-label">이메일</label><input type="email" id="auth-email" placeholder="you@example.com" class="input" onkeydown="if(event.key===\'Enter\'){var pw=document.getElementById(\'auth-pw\');if(pw.value)doLogin();else pw.focus();}"></div>'
        +'<div><label class="field-label">비밀번호</label><input type="password" id="auth-pw" placeholder="••••••••" class="input" onkeydown="if(event.key===\'Enter\')doLogin()"></div>'
        +'<button onclick="doLogin()" class="btn-primary w-full mt-1">'+icon('log-in','w-4 h-4')+t('login')+'</button>'
        +'<button onclick="showForgotPasswordForm()" class="w-full text-center text-meta mt-2 hover:underline" style="background:none;border:none;cursor:pointer">비밀번호를 잊으셨나요?</button>'
        +'<div class="relative py-3 text-center"><div class="absolute inset-0 flex items-center"><div class="w-full border-t" style="border-color:var(--border)"></div></div><span class="relative px-3 text-meta" style="background:var(--surface)">또는</span></div>'
        +'<button onclick="showSignUpForm()" class="btn-secondary w-full">'+icon('user-plus','w-4 h-4')+t('signup')+'</button>'
      +'</div>'
      +'<button onclick="showLandingScreen()" class="w-full text-center text-meta mt-4 hover:underline" style="background:none;border:none;cursor:pointer">서비스 소개 보기</button>'
      +'<div class="text-center text-meta mt-1"><button onclick="showHelpModal()" class="hover:underline" style="background:none;border:none;cursor:pointer">도움말</button> · <button onclick="showHelpModal(\'privacy\')" class="hover:underline" style="background:none;border:none;cursor:pointer">개인정보·이용 안내</button></div>'
    +'</div></div>'
  );
}
function showSignUpForm(){
  document.getElementById('auth-form').innerHTML=
    '<div class="space-y-3">'
    +'<div><label class="field-label">이름 <span style="color:var(--danger)">*</span></label><input type="text" id="auth-name" placeholder="홍길동" class="input"></div>'
    +'<div><label class="field-label">이메일 <span style="color:var(--danger)">*</span></label><input type="email" id="auth-email" placeholder="you@example.com" class="input"></div>'
    +'<div><label class="field-label">비밀번호 (6자 이상) <span style="color:var(--danger)">*</span></label><input type="password" id="auth-pw" placeholder="6자 이상" class="input"></div>'
    +'<button onclick="doSignUp()" class="btn-primary w-full mt-1">'+icon('sparkles','w-4 h-4')+'가입하기</button>'
    +'<button onclick="showAuthScreen()" class="btn-ghost w-full">'+icon('arrow-left','w-4 h-4')+'로그인으로</button>'
    +'</div>';
  refreshIcons();
}
function showForgotPasswordForm(){
  document.getElementById('auth-form').innerHTML=
    '<div class="space-y-3">'
    +'<p class="text-body">가입할 때 사용한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.</p>'
    +'<div><label class="field-label">이메일</label><input type="email" id="auth-reset-email" placeholder="you@example.com" class="input"></div>'
    +'<button onclick="doSendPasswordReset()" class="btn-primary w-full mt-1">'+icon('mail','w-4 h-4')+'재설정 링크 보내기</button>'
    +'<button onclick="showAuthScreen()" class="btn-ghost w-full">'+icon('arrow-left','w-4 h-4')+'로그인으로</button>'
    +'</div>';
  refreshIcons();
}
async function doSendPasswordReset(){
  var e=document.getElementById('auth-reset-email').value.trim();
  if(!e){ showToast('이메일을 입력하세요','error'); return; }
  showLoading();
  var r=await ssSendPasswordReset(e);
  hideLoading();
  if(r.success){
    showToast('재설정 메일을 보냈습니다. 받은편지함을 확인해주세요.','success');
    showAuthScreen();
  } else {
    showToast(r.error,'error');
  }
}
async function doLogin(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-pw').value;
  ssClearFieldError('auth-email'); ssClearFieldError('auth-pw');
  if(!e){ ssFieldError('auth-email','이메일을 입력해 주세요'); document.getElementById('auth-email').focus(); return; }
  if(!p){ ssFieldError('auth-pw','비밀번호를 입력해 주세요'); document.getElementById('auth-pw').focus(); return; }
  showLoading();
  var r=await ssLogin(e,p);
  hideLoading();
  if(!r.success){ ssFieldError('auth-pw',ssKoErrorText(r.error)); return; }
  // 안전망: 이미 인증되어 있던 동일 사용자로 재로그인하면 onAuthStateChanged가
  // 재발화되지 않는 경우가 있으므로, 로그인 성공 시 Firebase의 현재 사용자 기준으로
  // 직접 동일한 인증 처리 함수를 호출해 화면 상태를 확실히 동기화한다.
  // (onAuthStateChanged와 동시에 걸려도 handleAuthenticatedUser의 잠금 로직이
  //  중복 실행을 막아준다.)
  if(auth.currentUser){ await handleAuthenticatedUser(auth.currentUser); }
}
async function doSignUp(){
  var n=document.getElementById('auth-name').value.trim(), e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-pw').value;
  ['auth-name','auth-email','auth-pw'].forEach(ssClearFieldError);
  var bad=null;
  if(!n){ ssFieldError('auth-name','이름을 입력해 주세요'); bad=bad||'auth-name'; }
  if(!e){ ssFieldError('auth-email','이메일을 입력해 주세요'); bad=bad||'auth-email'; }
  else if(!ssIsEmail(e)){ ssFieldError('auth-email','이메일 형식이 올바르지 않습니다 (예: you@example.com)'); bad=bad||'auth-email'; }
  if(!p){ ssFieldError('auth-pw','비밀번호를 입력해 주세요'); bad=bad||'auth-pw'; }
  else if(p.length<6){ ssFieldError('auth-pw','비밀번호는 6자 이상이어야 합니다'); bad=bad||'auth-pw'; }
  if(bad){ document.getElementById(bad).focus(); return; }
  showLoading();
  var r=await ssSignUp(e,p,n);
  hideLoading();
  if(r.success){
    showToast('가입 완료!','success');
    // 회원가입 성공 시 Firebase가 이미 자동 로그인시킨 상태이므로
    // 화면 전환은 onAuthStateChanged(인증 상태 관리 로직)가 전담한다.
    // 여기서 로그인 화면으로 강제 이동시키지 않는다.
  } else {
    if(/이메일/.test(r.error||'') && !/비밀번호/.test(r.error||'')) ssFieldError('auth-email',ssKoErrorText(r.error)); else showToast(r.error,'error');
  }
}

/* ================= 라우팅 ================= */
var PROJECT_SCOPED_VIEWS=['kanban','calendar','roles','team','chat'];

/* 브라우저 뒤로가기/앞으로가기: 화면 이동을 history에 남겨 예측 가능하게 동작시킨다. (인증 로직과 무관) */
var _popNav=false;
function ssPushViewState(view){
  if(_popNav) return;
  try{
    var cur=history.state;
    if(cur && cur.ss && cur.v===view) return;
    var st={ss:1,v:view};
    if(cur && cur.ss) history.pushState(st,'','#'+view); else history.replaceState(st,'','#'+view);
  }catch(e){}
}
window.addEventListener('popstate',function(ev){
  var st=ev.state;
  if(!isLoggedIn || !st || !st.ss) return;
  try{ closeModal(); closeCommandPalette(); }catch(e){}
  _popNav=true;
  try{ showView(st.v); } finally { _popNav=false; }
});
function showView(view){
  if(view!=='chat') stopChatListener();   // 채팅 화면을 벗어나면 실시간 수신 해제
  if(view==='todos') view='kanban'; // 예전에 저장된 설정/링크에 남아 있을 수 있는 목록 화면 → 할 일 목록(칸반)으로 연결
  // 프로젝트 종속 화면인데 아직 프로젝트를 선택하지 않았다면, 빈 화면 대신 프로젝트 스위처를 바로 연다.
  if(PROJECT_SCOPED_VIEWS.indexOf(view)!==-1 && !currentProjectId){
    openProjectSwitcher({forView:view});
    return;
  }
  currentView=view;
  ssPushViewState(view);
  closeDrawer();
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  var nb=document.getElementById('nav-'+view); if(nb) nb.classList.add('active');
  switch(view){
    case 'dashboard': renderDashboard(); break;
    case 'mytasks': renderMyTasks(); break;
    case 'archive': renderArchive(); break;
    case 'kanban': renderKanban(); break;
    case 'calendar': renderCalendar(); break;
    case 'roles': renderRoles(); break;
    case 'team': renderTeam(); break;
    case 'chat': renderChat(); break;
    case 'notifications': renderNotifications(); break;
    case 'profile': renderProfile(); break;
    case 'templates': renderTemplates(); break;
    default: renderDashboard();
  }
}
async function selectProject(projectId){
  currentProjectId=projectId; var p=allProjects.find(x=>x.id===projectId); if(p)currentProject=p;
  updateProjectChrome();
  recordRecent('project',projectId,p.name);
  closeProjectSwitcher(); closeCommandPalette();
  showToast(p.name+(currentLang==='en'?' selected':' 선택됨'),'success');
  // 보던 화면을 유지한 채 새 프로젝트 데이터로 갱신. 처음 여는 경우(대시보드에서 진입)엔
  // 프로필 설정의 "기본 프로젝트 화면" 값으로 바로 이동한다.
  showView(currentView && currentView!=='dashboard' ? currentView : getDefaultProjectView());
}
function updateProjectChrome(){
  var name = currentProject ? currentProject.name : 'Syncspace';
  var el=document.getElementById('current-project-name'); if(el) el.textContent=name;
  var mEl=document.getElementById('mobile-project-name'); if(mEl) mEl.textContent=name;
  var sEl=document.getElementById('scope-project-name'); if(sEl) sEl.textContent = currentProject ? (' · '+currentProject.name) : '';
  document.querySelectorAll('.scoped-nav').forEach(b=>{ if(currentProjectId) b.classList.remove('nav-disabled'); else b.classList.add('nav-disabled'); });
}

/* ================= 프로젝트 스위처 ================= */
function openProjectSwitcher(opts){
  opts=opts||{};
  document.getElementById('pswitch').classList.remove('hidden');
  var favIds=(()=>{ try{ return JSON.parse(localStorage.getItem('syncspace-fav-projects')||'[]'); }catch(e){ return []; } })();
  var favs=allProjects.filter(p=>favIds.indexOf(p.id)!==-1);
  var others=allProjects.filter(p=>favIds.indexOf(p.id)===-1);
  var recentProjects=getRecents().filter(r=>r.type==='project').slice(0,3);

  function projRow(p){
    var active=currentProjectId===p.id;
    return '<div onclick="selectProject(\''+p.id+'\')" class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer" style="'+(active?'background:var(--primary-soft)':'')+'" onmouseover="if(!'+active+')this.style.background=\'var(--surface-2)\'" onmouseout="if(!'+active+')this.style.background=\'\'">'
      +'<div class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style="background:#'+p.color+'1F;border:1px solid var(--border)">'+p.icon+'</div>'
      +'<span class="text-body flex-1 truncate" style="'+(active?'color:var(--primary-soft-text);font-weight:600':'')+'">'+escUser(p.name)+'</span>'
      + (active? icon('check','w-4 h-4 shrink-0').replace('class="','style="color:var(--primary)" class="') : '')
    +'</div>';
  }

  var reasonBanner = opts.forView ? '<div class="px-4 pt-3 text-meta">'+icon('info','w-3 h-3 inline mr-1 -mt-0.5')+'이 화면은 프로젝트를 선택해야 볼 수 있어요</div>' : '';

  document.getElementById('pswitch').innerHTML =
    '<div class="fixed inset-0 modal-backdrop flex items-start justify-center pt-[10vh] p-4 animate-fade-fast" onclick="if(event.target===this)closeProjectSwitcher()">'
    +'<div class="modal-panel w-full max-w-sm animate-modal" onclick="event.stopPropagation()">'
      +'<div class="modal-header"><h3 class="text-section-title">프로젝트 전환</h3><button onclick="closeProjectSwitcher()" class="icon-btn" aria-label="닫기">'+icon('x','w-4 h-4')+'</button></div>'
      + reasonBanner
      +'<div class="modal-body max-h-[50vh] overflow-y-auto">'
        + (favs.length? '<div class="text-meta font-semibold px-1 pb-1">즐겨찾기</div><div class="space-y-0.5 mb-3">'+favs.map(projRow).join('')+'</div>' : '')
        + (recentProjects.length? '<div class="text-meta font-semibold px-1 pb-1">최근</div><div class="space-y-0.5 mb-3">'+recentProjects.map(r=>{var p=allProjects.find(x=>x.id===r.id); return p?projRow(p):'';}).join('')+'</div>' : '')
        +'<div class="text-meta font-semibold px-1 pb-1">전체 프로젝트</div>'
        + (others.length||favs.length ? '<div class="space-y-0.5">'+others.map(projRow).join('')+'</div>' : emptyState('folder-plus','프로젝트가 없어요','새 프로젝트를 만들어보세요',''))
      +'</div>'
      +'<div class="modal-footer"><button onclick="closeProjectSwitcher();showCreateProjectModal()" class="btn-primary w-full">'+icon('plus','w-4 h-4')+'새 프로젝트 만들기</button></div>'
    +'</div></div>';
  refreshIcons();
}
function closeProjectSwitcher(){ document.getElementById('pswitch').classList.add('hidden'); document.getElementById('pswitch').innerHTML=''; }
function quickAddTask(){
  if(!currentProjectId){ openProjectSwitcher({forView:'kanban'}); return; }
  if(isViewer()){ showToast('뷰어 권한에서는 작업을 추가할 수 없어요','error'); return; }
  showAddTaskModal();
}

/* ================= 프로젝트 권한 ================= */
function getMyRole(project){
  if(!project || !currentUser) return 'editor';
  if(project.ownerId===currentUser.uid) return 'owner';
  if(project.memberRoles && project.memberRoles[currentUser.uid]) return project.memberRoles[currentUser.uid];
  return 'editor'; // 기존 프로젝트(역할 필드 없음) 하위호환: 기본 편집 가능
}
function isViewer(){ return currentProject && getMyRole(currentProject)==='viewer'; }
function roleBadge(role){
  if(role==='owner') return '<span class="badge-primary">'+icon('crown','w-3 h-3')+'오너</span>';
  if(role==='viewer') return '<span class="badge-neutral">'+icon('eye','w-3 h-3')+'뷰어</span>';
  return '<span class="badge-success">'+icon('pencil','w-3 h-3')+'편집자</span>';
}
function pageHeader(title,subtitle,actionsHtml){
  return '<div class="px-6 pt-6 pb-5 flex items-start justify-between gap-4 flex-wrap">'
    +'<div><h1 class="text-page-title">'+title+'</h1>'+(subtitle?'<p class="text-body mt-1">'+subtitle+'</p>':'')+'</div>'
    +(actionsHtml?'<div class="flex items-center gap-2 flex-wrap">'+actionsHtml+'</div>':'')
  +'</div>';
}
function noProjectState(){
  return emptyState('folder-kanban','프로젝트를 선택하세요','상단에서 프로젝트를 선택하면 이 화면의 데이터를 볼 수 있어요.',
    '<button onclick="openProjectSwitcher()" class="btn-primary">'+icon('chevrons-up-down','w-4 h-4')+'프로젝트 선택</button>');
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function greetingText(){
  var h=new Date().getHours();
  if(h<6) return '늦은 밤이네요';
  if(h<12) return '좋은 아침입니다';
  if(h<18) return '좋은 오후입니다';
  return '좋은 저녁입니다';
}
function todayLabel(){
  var d=new Date();
  if(currentLang==='en') return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  var days=['일','월','화','수','목','금','토'];
  return (d.getMonth()+1)+'월 '+d.getDate()+'일 '+days[d.getDay()]+'요일';
}

async function renderDashboard(){
  setContent(
    pageHeader(greetingText()+', '+(currentUser.name||'')+'님 👋', todayLabel())
    + skeletonGrid(4,'md:grid-cols-4')
  );
  if(allProjects.length===0) await loadProjects();

  var kpiHtml='', bodyHtml='', projectPickerHtml='';

  if(currentProjectId){
    var tasksR=await ssGetTasks(currentProjectId);
    var tasks=tasksR.tasks||[];
    var todo=tasks.filter(t=>t.status==='todo').length;
    var inprogress=tasks.filter(t=>t.status==='inprogress').length;
    var done=tasks.filter(t=>t.status==='done').length;
    var total=tasks.length||0;
    var pct=total?Math.round(done/total*100):0;

    var today=new Date(); today.setHours(0,0,0,0);
    var in7=new Date(today); in7.setDate(in7.getDate()+7);
    var dueSoon=tasks.filter(t=>{ if(!t.dueDate||t.status==='done')return false; var d=new Date(t.dueDate); return d>=today&&d<=in7; });
    var overdue=tasks.filter(t=>{ if(!t.dueDate||t.status==='done')return false; return new Date(t.dueDate)<today; });

    kpiHtml = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 px-6">'
      + kpiCard('list-todo','전체 작업',total,'프로젝트 내 총 작업 수','var(--primary)','var(--primary-soft)')
      + kpiCard('loader','진행 중',inprogress,'현재 작업 중인 항목','var(--warning)','var(--warning-soft)')
      + kpiCard('check-circle-2','완료',done,pct+'% 완료율','var(--success)','var(--success-soft)')
      + kpiCard('alarm-clock','마감 임박',dueSoon.length, overdue.length>0?(overdue.length+'개 지연됨'):'7일 이내 마감', overdue.length>0?'var(--danger)':'var(--info)', overdue.length>0?'var(--danger-soft)':'var(--info-soft)')
      + '</div>';

    var progressCard = '<div class="card card-pad">'
      + '<div class="flex items-center justify-between mb-4"><h3 class="text-section-title">프로젝트 진행률</h3><span class="badge-primary">'+escUser(currentProject.name)+'</span></div>'
      + '<div class="flex items-end gap-3 mb-2"><span class="text-[32px] font-extrabold leading-none" style="color:var(--text)">'+pct+'%</span><span class="text-meta mb-1">완료됨</span></div>'
      + '<div class="progress-track h-2.5 mb-5"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
      + '<div class="grid grid-cols-3 gap-2 text-center">'
        + '<div class="surface-2 rounded-xl py-3"><div class="text-[18px] font-bold" style="color:var(--text)">'+done+'</div><div class="text-meta mt-0.5">완료</div></div>'
        + '<div class="surface-2 rounded-xl py-3"><div class="text-[18px] font-bold" style="color:var(--text)">'+inprogress+'</div><div class="text-meta mt-0.5">진행 중</div></div>'
        + '<div class="surface-2 rounded-xl py-3"><div class="text-[18px] font-bold" style="color:var(--text)">'+todo+'</div><div class="text-meta mt-0.5">할 일</div></div>'
      + '</div></div>';

    // 파트별(역할별) 진행률 — 멤버가 직접 입력한 값 요약. 상세/입력은 '파트별 진행률' 화면
    var dMembersR=await ssGetProjectMembers(currentProjectId);
    var dProgR=await ssGetMemberProgress(currentProjectId);
    var roleCalc=calcRoleProgress(dMembersR.members||[],dProgR.items||[]);
    var rolesCard = '<div class="card card-pad lg:col-span-2">'
      + '<div class="flex items-center justify-between mb-4"><h3 class="text-section-title">파트별 진행률'
        + (roleCalc.activeCount?' <span class="text-meta font-normal ml-1">전체 '+roleCalc.overall+'%</span>':'')+'</h3>'
        + '<button onclick="showView(\'roles\')" class="text-[12px] font-semibold" style="color:var(--primary)">내 진행률 입력</button></div>'
      + (roleCalc.activeCount
        ? '<div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">'+roleCalc.roles.map(function(r){
            return '<div>'
              +'<div class="flex items-center justify-between mb-1.5">'
                +'<span class="flex items-center gap-2 text-body font-semibold" style="color:var(--text)"><span style="width:8px;height:8px;border-radius:50%;background:'+r.color+'"></span>'+r.label
                  +(r.total?' <span class="text-meta font-normal">'+r.members.map(m=>escHtml(m.name)).join(', ')+'</span>':'')+'</span>'
                +'<span class="text-meta"><b style="color:'+(r.total?r.color:'var(--text-3)')+';font-size:13px">'+r.percent+'%</b>'+(r.total?' · 완료 '+r.doneCount+'/'+r.total+'명':'')+'</span>'
              +'</div>'
              +'<div class="progress-track h-2"><div class="progress-fill" style="width:'+r.percent+'%;background:'+r.color+'"></div></div>'
            +'</div>';
          }).join('')+'</div>'
        : '<p class="text-body">각자 맡은 파트를 선택하고 진행률을 입력하면 여기에 표시돼요. 오른쪽 위 "내 진행률 입력"에서 시작하세요.</p>')
      + '</div>';

    // 프로젝트 설명 카드 — 높이를 2줄로 고정하고 넘치면 '전체 보기'로 확인(설명이 길어도 아래 카드가 밀리지 않음)
    var projDesc=(currentProject.description||'').trim();
    var isOwnerHere=getMyRole(currentProject)==='owner';
    var descCard = (projDesc || isOwnerHere) ? '<div class="card card-pad lg:col-span-2">'
      + '<div class="flex items-center justify-between gap-3 mb-1.5"><h3 class="text-section-title">프로젝트 설명</h3>'
        + '<div class="flex items-center gap-3">'
          + ((projDesc.length>110||projDesc.indexOf('\n')!==-1)?'<button onclick="showProjectDescModal()" class="text-[12px] font-semibold" style="color:var(--primary)">전체 보기</button>':'')
          + (isOwnerHere?'<button onclick="showEditProjectModal(\''+currentProject.id+'\')" class="text-[12px] font-semibold" style="color:var(--text-2)">'+(projDesc?'수정':'설명 추가')+'</button>':'')
          + (isOwnerHere?'<button onclick="showDeleteProjectConfirmModal(\''+currentProject.id+'\')" class="text-[12px] font-semibold" style="color:var(--danger)">프로젝트 삭제</button>':'')
        + '</div></div>'
      + (projDesc
          ? '<p class="text-body" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55;max-height:3.1em;white-space:pre-line">'+escHtml(projDesc)+'</p>'
          : '<p class="text-meta">아직 프로젝트 설명이 없어요. 팀원들이 프로젝트를 이해할 수 있게 간단히 적어보세요.</p>')
      + '</div>' : '';

    var upcoming = tasks.filter(t=>t.dueDate&&t.status!=='done').sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||'')).slice(0,5);
    var upcomingCard = '<div class="card card-pad">'
      + '<div class="flex items-center justify-between mb-3"><h3 class="text-section-title">마감 임박 작업</h3><button onclick="showView(\'kanban\')" class="text-[12px] font-semibold" style="color:var(--primary)">전체 보기</button></div>'
      + (upcoming.length? '<div class="divide-hair -mx-1">'+upcoming.map(t=>{
          var isOverdue = new Date(t.dueDate)<today;
          return '<div class="flex items-center gap-3 px-1 py-2.5 cursor-pointer hover:opacity-80" onclick="showTaskDetail(\''+t.id+'\')">'
            +'<div class="w-1.5 h-1.5 rounded-full shrink-0" style="background:'+(isOverdue?'var(--danger)':'var(--primary)')+'"></div>'
            +'<div class="min-w-0 flex-1"><div class="text-card-title truncate">'+escUser(t.title)+'</div>'
            +'<div class="text-meta mt-0.5">'+(t.assigneeName?t.assigneeName+' · ':'')+t.dueDate+'</div></div>'
            + priorityBadge(t.priority)
          +'</div>';
        }).join('')+'</div>'
        : emptyState('calendar-check','마감 임박 작업 없음','마감일이 설정된 작업이 없습니다.','<button onclick="showAddTaskModal()" class="btn-secondary">'+icon('plus','w-4 h-4')+'마감일 있는 작업 추가</button>'))
      + '</div>';

    var eventsR = await ssGetEvents(currentProjectId);
    var todayStr = fmtDate(new Date());
    var todayEvents = (eventsR.events||[]).filter(e=>e.date===todayStr);
    var scheduleCard = '<div class="card card-pad">'
      + '<div class="flex items-center justify-between mb-3"><h3 class="text-section-title">오늘 일정</h3><button onclick="showView(\'calendar\')" class="text-[12px] font-semibold" style="color:var(--primary)">캘린더 보기</button></div>'
      + (todayEvents.length? '<div class="space-y-2">'+todayEvents.map(e=>
          '<div class="flex items-center gap-2.5 p-2.5 rounded-xl surface-2">'
          + '<div class="w-2 h-2 rounded-full shrink-0" style="background:#'+(e.color||'6366F1')+'"></div>'
          + '<span class="text-card-title flex-1 truncate">'+escUser(e.title)+'</span>'
          + '<span class="text-meta">'+(e.type==='milestone'?'마일스톤':e.type==='deadline'?'마감':'일정')+'</span>'
        +'</div>').join('')+'</div>'
        : emptyState('coffee','오늘은 일정이 없어요','여유로운 하루 보내세요.','<button onclick="showAddEventModal(fmtDate(new Date()))" class="btn-secondary">'+icon('calendar-plus','w-4 h-4')+'일정 추가</button>'))
      + '</div>';

    var notifR = await ssGetNotifications();
    var allNotifs = (notifR.notifications||[]).filter(n=>notifTypeAllowed(n.type));
    var unreadList = allNotifs.filter(n=>!n.read), readList = allNotifs.filter(n=>n.read);
    var recent = unreadList.concat(readList).slice(0,5);   // 안 읽은 알림을 먼저
    var activityCard = '<div class="card card-pad">'
      + '<div class="flex items-center justify-between mb-3 gap-2"><h3 class="text-section-title">알림'
        + (unreadList.length?' <span class="badge-primary ml-1">'+unreadList.length+'</span>':'')+'</h3>'
        + '<div class="flex items-center gap-3">'
          + (unreadList.length?'<button onclick="doMarkAllRead()" class="text-[12px] font-semibold" style="color:var(--primary)">모두 읽음</button>':'')
          + '<button onclick="showView(\'notifications\')" class="text-[12px] font-semibold" style="color:var(--text-2)">전체 보기</button>'
        + '</div></div>'
      + (recent.length? '<div class="divide-hair -mx-1">'+recent.map(notifRowHtml).join('')+'</div>'
        : emptyState('inbox','새 알림이 없어요','새 소식이 도착하면 여기에 바로 표시됩니다.',''))
      + '</div>';

    bodyHtml = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 mt-4">'
      + descCard + progressCard + upcomingCard + rolesCard + scheduleCard + activityCard
      + '</div>';
  } else {
    kpiHtml = '<div class="px-6">'+emptyState('folder-kanban','프로젝트를 선택하세요','아래에서 프로젝트를 선택하거나 새로 만들어 시작하세요.','')+'</div>';
  }

  var sortedProjects = allProjects.slice().sort((a,b)=> (isFavoriteProject(b.id)?1:0) - (isFavoriteProject(a.id)?1:0));
  function projectCardHtml(p){
    var active = currentProjectId===p.id;
    var fav = isFavoriteProject(p.id);
    return '<div onclick="selectProject(\''+p.id+'\')" class="card card-pad cursor-pointer transition-all hover:shadow-md" style="'+(active?'border-color:var(--primary);box-shadow:0 0 0 3px rgb(var(--ring)/.12)':'')+'">'
      +'<div class="flex items-start justify-between mb-3">'
        +'<div class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:#'+p.color+'1F;border:1px solid var(--border)">'+p.icon+'</div>'
          +'<div class="min-w-0"><div class="text-card-title truncate">'+escUser(p.name)+'</div><div class="text-meta mt-0.5">'+((p.memberEmails||[]).length)+'명 참여</div></div></div>'
        +'<div class="flex items-center gap-0.5 shrink-0">'
        +'<button onclick="event.stopPropagation();toggleFavoriteProject(\''+p.id+'\');renderDashboard()" class="icon-btn" title="즐겨찾기" aria-label="즐겨찾기 토글">'+icon(fav?'star':'star-off','w-4 h-4').replace('class="','style="color:'+(fav?'var(--warning)':'var(--text-3)')+'" class="')+'</button>'
        + (getMyRole(p)==='owner' ? '<button onclick="event.stopPropagation();showEditProjectModal(\''+p.id+'\')" class="icon-btn" aria-label="프로젝트 설정">'+icon('settings','w-4 h-4')+'</button>' : '')
        + (getMyRole(p)==='owner' ? '<button onclick="event.stopPropagation();showDeleteProjectConfirmModal(\''+p.id+'\')" class="icon-btn" title="프로젝트 삭제" aria-label="프로젝트 삭제" style="color:var(--danger)">'+icon('trash-2','w-4 h-4')+'</button>' : '')
        +'</div>'
      +'</div>'
      +'<p class="text-body line-clamp-2 mb-3" style="min-height:18px">'+escHtml(p.description||'설명이 없습니다')+'</p>'
      +'<div class="progress-track h-1.5"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div>'
      +'<div class="text-meta mt-1.5 text-right">'+(p.progress||0)+'%</div>'
    +'</div>';
  }
  var projCards = sortedProjects.map(projectCardHtml).join('');
  var otherProjCards = sortedProjects.filter(p=>p.id!==currentProjectId).map(projectCardHtml).join('');

  if(currentProjectId){
    // 개요 탭에서는 프로젝트 전환이 이미 상단 스위처로 가능하므로, 전체 그리드 대신 접힌 요약만 보여준다
    var otherCount=Math.max(0, allProjects.length-1);
    projectPickerHtml = '<div class="px-6 pb-10 mt-2">'
      +'<button onclick="document.getElementById(\'other-projects-grid\').classList.toggle(\'hidden\');document.getElementById(\'other-projects-chevron\').classList.toggle(\'rotate-180\')" class="flex items-center gap-1.5 text-meta font-medium mb-2">'
        +'다른 프로젝트'+(otherCount?' ('+otherCount+')':'')
        +'<span id="other-projects-chevron" class="transition-transform">'+icon('chevron-down','w-3.5 h-3.5')+'</span>'
      +'</button>'
      +'<div id="other-projects-grid" class="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">'+otherProjCards+'</div>'
    +'</div>';
  } else {
    projectPickerHtml = '<div class="px-6 pb-10 mt-2">'
      + '<div class="flex items-center justify-between flex-wrap gap-2 mb-3"><h3 class="text-section-title whitespace-nowrap">내 프로젝트</h3>'
        + '<div class="flex items-center gap-2"><button onclick="showView(\'archive\')" class="btn-ghost btn-sm">'+icon('archive','w-3.5 h-3.5')+'보관함</button>'
        + '<button onclick="showView(\'templates\')" class="btn-secondary btn-sm">'+icon('layout-template','w-3.5 h-3.5')+'템플릿</button>'
        + '<button onclick="showCreateProjectModal()" class="btn-primary btn-sm">'+icon('plus','w-3.5 h-3.5')+'새 프로젝트</button></div></div>'
      + (allProjects.length? '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">'+projCards+'</div>'
         : emptyState('folder-plus','아직 프로젝트가 없어요','첫 프로젝트를 만들거나 템플릿으로 빠르게 시작해보세요.',
            '<button onclick="showCreateProjectModal()" class="btn-primary">'+icon('plus','w-4 h-4')+'새 프로젝트 만들기</button>'))
      + '</div>';
  }

  var headerActions = currentProjectId
    ? ('<button onclick="showAddEventModal(\''+fmtDate(new Date())+'\')" class="btn-secondary">'+icon('calendar-plus','w-4 h-4')+'일정 추가</button>'
      +'<button onclick="showAddTaskModal()" class="btn-primary">'+icon('plus','w-4 h-4')+'새 작업</button>')
    : '';

  var onboardingHtml = renderOnboardingCard() + renderNextStepsCard();

  setContent(
    projectTabBar('dashboard')
    + pageHeader(greetingText()+', '+(currentUser.name||'')+'님 👋', todayLabel()+' · 오늘 해야 할 작업을 확인해보세요.', headerActions)
    + kpiHtml + onboardingHtml + bodyHtml + projectPickerHtml
  );
}

function kpiCard(iconName,label,value,sub,color,soft){
  return '<div class="card card-pad">'
    +'<div class="flex items-center justify-between mb-3"><div class="kpi-icon" style="background:linear-gradient(160deg, var(--surface) -30%, '+soft+' 130%)">'+icon(iconName,'w-[18px] h-[18px]').replace('<i ','<i style="color:'+color+'" ')+'</div></div>'
    +'<div class="text-[24px] font-extrabold leading-none" style="color:var(--text)">'+value+'</div>'
    +'<div class="text-card-title mt-1.5">'+label+'</div>'
    +'<div class="text-meta mt-0.5">'+sub+'</div>'
  +'</div>';
}

/* ================= 프로젝트 생성/수정 모달 ================= */
function showCreateProjectModal(){
  showModal(modalWrap('새 프로젝트',
    '<div class="space-y-3">'
    +'<div><label class="field-label">프로젝트 이름 <span style="color:var(--danger)">*</span></label><input type="text" id="proj-name" placeholder="예: 졸업작품 웹앱" class="input"></div>'
    +'<div><label class="field-label">설명</label><textarea id="proj-desc" data-enter-submit="1" placeholder="프로젝트에 대한 간단한 설명 (Enter: 생성 · Shift+Enter: 줄바꿈)" class="input" rows="3"></textarea></div>'
    +'<div><label class="field-label">색상</label><input type="color" id="proj-color" value="#6366F1" class="w-full h-10 rounded-lg border cursor-pointer" style="border-color:var(--border-strong)"></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doCreateProject()" class="btn-primary">'+icon('plus','w-4 h-4')+'생성</button>'
  ));
}
async function doCreateProject(){var name=document.getElementById('proj-name').value.trim(),desc=document.getElementById('proj-desc').value.trim(),color=document.getElementById('proj-color').value.substring(1);ssClearFieldError('proj-name');if(!name){ssFieldError('proj-name','프로젝트 이름을 입력해 주세요');document.getElementById('proj-name').focus();return;}showLoading();var r=await ssCreateProject({name,description:desc,icon:'📁',color});hideLoading();if(r.success){ssClearDraft('proj-name','proj-desc');closeModal();showToast('프로젝트가 생성되었습니다','success');localStorage.setItem('syncspace-onb-project','1');ssLogActivity(r.id,'project_create',(currentUser.name||'사용자')+'님이 프로젝트를 생성했습니다');await loadProjects();renderDashboard();}else showToast(r.error,'error');}

function showProjectDescModal(){
  if(!currentProject) return;
  showModal(modalWrap('프로젝트 설명',
    '<div class="text-card-title mb-2">'+escUser(currentProject.name)+'</div>'
    +'<div class="text-body" style="white-space:pre-line;max-height:60vh;overflow-y:auto">'+escHtml(currentProject.description||'')+'</div>',
    '<button onclick="closeModal()" class="btn-secondary">닫기</button>'));
}
function showEditProjectModal(projectId){
  var proj=allProjects.find(p=>p.id===projectId); if(!proj)return;
  showModal(modalWrap('프로젝트 설정',
    '<div class="space-y-3">'
    +'<div><label class="field-label">프로젝트 이름</label><input type="text" id="proj-name" value="'+escHtml(proj.name)+'" class="input"></div>'
    +'<div><label class="field-label">설명</label><textarea id="proj-desc" data-enter-submit="1" class="input" rows="3">'+escHtml(proj.description||'')+'</textarea></div>'
    +'<div><label class="field-label">진행률 <span id="progress-val" class="font-semibold" style="color:var(--primary)">'+(proj.progress||0)+'%</span></label>'
      +'<input type="range" id="proj-progress" min="0" max="100" value="'+(proj.progress||0)+'" class="w-full accent-[var(--primary)]"></div>'
    +'<button onclick="doSaveAsTemplate(\''+projectId+'\')" class="btn-secondary w-full">'+icon('layout-template','w-4 h-4')+'템플릿으로 저장</button>'
    +'<button onclick="showShareModal(\''+projectId+'\')" class="btn-secondary w-full">'+icon('link','w-4 h-4')+'읽기 전용 공유 링크</button>'
    +'<button onclick="doArchiveProject(\''+projectId+'\')" class="btn-secondary w-full">'+icon('archive','w-4 h-4')+'보관하기</button>'
    +'</div>',
    '<button onclick="showDeleteProjectConfirmModal(\''+projectId+'\')" class="btn-danger mr-auto">'+icon('trash-2','w-4 h-4')+'삭제</button>'
    +'<button onclick="closeModal()" class="btn-secondary">취소</button>'
    +'<button onclick="doUpdateProject(\''+projectId+'\')" class="btn-primary">'+icon('check','w-4 h-4')+'저장</button>'
  ));
  document.getElementById('proj-progress').addEventListener('input',function(){document.getElementById('progress-val').textContent=this.value+'%';});
}
async function doArchiveProject(projectId){
  if(!confirm('이 프로젝트를 보관하시겠습니까? 목록에서 숨겨지며 보관함에서 언제든 복원할 수 있어요.'))return;
  showLoading(); var r=await ssUpdateProject(projectId,{status:'archived'}); hideLoading();
  if(r.success){ closeModal(); showToast('보관되었습니다','success'); if(currentProjectId===projectId){ currentProjectId=null; updateProjectChrome(); } await loadProjects(); renderDashboard(); }
  else showToast('실패했습니다','error');
}
async function renderArchive(){
  showLoading(); var r=await ssGetArchivedProjects(); hideLoading();
  var projects=r.projects||[];
  var list=projects.length? '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'+projects.map(p=>
    '<div class="card card-pad"><div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:#'+p.color+'1F;border:1px solid var(--border)">'+p.icon+'</div><div class="min-w-0"><div class="text-card-title truncate">'+escUser(p.name)+'</div><div class="text-meta">보관됨</div></div></div>'
    +'<button onclick="doUnarchiveProject(\''+p.id+'\')" class="btn-secondary w-full">'+icon('archive-restore','w-4 h-4')+'복원하기</button></div>'
  ).join('')+'</div>' : emptyState('archive','보관된 프로젝트가 없어요','완료된 프로젝트를 삭제 대신 보관해보세요','');
  setContent(pageHeader('보관함','완료되었거나 잠시 쉬는 프로젝트','<button onclick="showView(\'dashboard\')" class="btn-secondary">'+icon('arrow-left','w-4 h-4')+'대시보드</button>')
    +'<div class="px-6 pb-8">'+list+'</div>');
}
async function doUnarchiveProject(projectId){
  showLoading(); var r=await ssUpdateProject(projectId,{status:'active'}); hideLoading();
  if(r.success){ showToast('복원되었습니다','success'); await loadProjects(); renderArchive(); }
  else showToast('실패했습니다','error');
}
async function doUpdateProject(projectId){var name=document.getElementById('proj-name').value.trim(),descEl=document.getElementById('proj-desc'),desc=descEl?descEl.value.trim():'',progress=parseInt(document.getElementById('proj-progress').value);showLoading();var r=await ssUpdateProject(projectId,{name,description:desc,progress});hideLoading();if(r.success){closeModal();showToast('저장되었습니다','success');await loadProjects();renderDashboard();}else showToast('실패했습니다','error');}
// 삭제는 되돌리기 번거로운(완전 숨김) 작업이라, confirm() 한 번보다 확실한 확인이 필요해서
// 깃허브 스타일로 프로젝트 이름을 직접 입력해야 삭제 버튼이 눌리도록 바꿨다.
function showDeleteProjectConfirmModal(projectId){
  var proj=allProjects.find(p=>p.id===projectId); if(!proj)return;
  showModal(modalWrap('프로젝트 삭제',
    '<div class="space-y-3">'
    +'<p class="text-body">삭제하면 목록과 팀원 접근이 즉시 사라집니다. 계속하려면 프로젝트 이름 <b>'+escUser(proj.name)+'</b>을 아래에 정확히 입력하세요.</p>'
    +'<input type="text" id="delete-project-confirm-input" placeholder="'+escHtml(proj.name)+'" class="input">'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button>'
    +'<button onclick="doDeleteProject(\''+projectId+'\')" class="btn-danger">'+icon('trash-2','w-4 h-4')+'영구 삭제</button>'
  ));
}
async function doDeleteProject(projectId){
  var confirmInput=document.getElementById('delete-project-confirm-input');
  if(confirmInput){
    var proj=allProjects.find(p=>p.id===projectId);
    if(!proj || confirmInput.value.trim()!==proj.name){ showToast('프로젝트 이름이 일치하지 않습니다','error'); return; }
  } else if(!confirm('정말 삭제하시겠습니까?')) return;
  showLoading();var r=await ssDeleteProject(projectId);hideLoading();
  if(r.success){
    closeModal();
    currentProjectId=null; updateProjectChrome();
    await loadProjects(); renderDashboard();
    showUndoToast('프로젝트가 삭제되었습니다', async function(){
      await ssUpdateProject(projectId,{status:'active'});
      showToast('복구되었습니다','success');
      await loadProjects(); renderDashboard();
    });
  } else showToast('실패했습니다','error');
}
async function doSaveAsTemplate(projectId){showLoading();var r=await ssSaveAsTemplate(projectId);hideLoading();if(r.success)showToast('템플릿으로 저장되었습니다','success');else showToast('실패: '+r.error,'error');}

/* ================================================================
   칸반보드
   ================================================================ */
var kanbanMobileCol='todo'; // 폰에서는 한 번에 한 상태(할 일/진행 중/완료)만 보여준다
var KANBAN_COLS=[
  {key:'todo',label:'할 일',icon:'circle-dashed',color:'var(--text-2)'},
  {key:'inprogress',label:'진행 중',icon:'loader',color:'var(--warning)'},
  {key:'done',label:'완료',icon:'check-circle-2',color:'var(--success)'}
];

async function renderKanban(silent){
  if(!currentProjectId){ setContent(pageHeader(t('kanban'))+noProjectState()); return; }
  if(!silent) setContent(pageHeader(t('kanban'),'드래그하여 작업 상태를 변경하세요')+skeletonGrid(6,'md:grid-cols-3'));
  var tasksR=await ssGetTasks(currentProjectId);
  var tasks=(tasksR.tasks||[]).filter(t=>!searchQuery||t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  if(todoPriorityFilter!=='all') tasks=tasks.filter(t=>t.priority===todoPriorityFilter);
  if(todoStarredOnly) tasks=tasks.filter(t=>(t.starredBy||[]).indexOf(currentUser.uid)!==-1);

  var colsHtml = KANBAN_COLS.map(col=>{
    var colTasks=sortTasksBy(tasks.filter(t=>t.status===col.key), todoSortBy);
    var cards = colTasks.map(t=>kanbanCard(t)).join('');
    return '<div class="kanban-col'+(col.key===kanbanMobileCol?'':' max-lg:hidden')+'">'
      +'<div class="flex items-center justify-between px-1 pb-3">'
        +'<div class="flex items-center gap-2">'+icon(col.icon,'w-4 h-4').replace('<i ','<i style="color:'+col.color+'" ')+'<span class="text-section-title">'+col.label+'</span>'
        +'<span class="badge-neutral">'+colTasks.length+'</span></div>'
      +'</div>'
      +'<div class="kanban-dropzone" ondrop="dropOnColumn(event,\''+col.key+'\')" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')">'
        + (colTasks.length?'':'<div class="text-center text-meta py-6 px-2">'+({todo:'아직 할 일이 없어요',inprogress:'진행 중인 작업이 없어요',done:'완료한 작업이 여기에 모여요'})[col.key]+'</div>')
        + cards
        + '<button onclick="showAddTaskModal(\''+col.key+'\')" class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-medium mt-1 transition-colors" style="color:var(--text-3)" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'transparent\'">'+icon('plus','w-3.5 h-3.5')+'작업 추가</button>'
      +'</div>'
    +'</div>';
  }).join('');

  var actions = '<div class="relative shrink-0">'+icon('search','w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2').replace('class="','style="color:var(--text-3)" class="')
    +'<input type="text" id="kanban-search-input" placeholder="작업 검색..." value="'+escHtml(searchQuery)+'" oninput="searchQuery=this.value;debouncedSearch(renderKanban,\'kanban-search-input\')" class="input w-52 h-9 shrink-0" style="padding-left:2.25rem"></div>'
    +'<select onchange="todoPriorityFilter=this.value;renderKanban()" class="input h-9" style="width:auto">'
      +'<option value="all" '+(todoPriorityFilter==='all'?'selected':'')+'>모든 우선순위</option>'
      +'<option value="high" '+(todoPriorityFilter==='high'?'selected':'')+'>높음</option>'
      +'<option value="medium" '+(todoPriorityFilter==='medium'?'selected':'')+'>보통</option>'
      +'<option value="low" '+(todoPriorityFilter==='low'?'selected':'')+'>낮음</option>'
    +'</select>'
    +'<select onchange="todoSortBy=this.value;renderKanban()" class="input h-9" style="width:auto" title="정렬 기준">'
      +'<option value="order" '+(todoSortBy==='order'?'selected':'')+'>기본 순서</option>'
      +'<option value="dueDate" '+(todoSortBy==='dueDate'?'selected':'')+'>마감일순</option>'
      +'<option value="assignee" '+(todoSortBy==='assignee'?'selected':'')+'>담당자순</option>'
      +'<option value="created" '+(todoSortBy==='created'?'selected':'')+'>최신 생성순</option>'
    +'</select>'
    +'<button onclick="todoStarredOnly=!todoStarredOnly;renderKanban()" class="'+(todoStarredOnly?'btn-primary':'btn-secondary')+'" title="즐겨찾기만">'+icon('star','w-4 h-4')+'</button>'
    +'<button onclick="toggleBulkMode()" class="'+(bulkMode?'btn-primary':'btn-secondary')+'" title="여러 개 선택">'+icon('list-checks','w-4 h-4')+'</button>'
    +'<button onclick="showImportModal()" class="btn-secondary" title="CSV/Trello 가져오기">'+icon('upload','w-4 h-4')+'</button>'
    +'<button onclick="doExportTasksCSV()" class="btn-secondary" title="CSV 내보내기">'+icon('download','w-4 h-4')+'</button>'
    +'<button onclick="showAddTaskModal()" class="btn-primary">'+icon('plus','w-4 h-4')+'추가</button>';

  var bulkBarHtml = (bulkMode && selectedTaskIds.length) ?
    '<div class="bulk-bar fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-[90] card card-pad flex items-center flex-wrap justify-center gap-3 shadow-lg" style="background:var(--text);color:var(--surface)">'
      +'<span class="text-body font-semibold" style="color:var(--surface)">'+selectedTaskIds.length+'개 선택됨</span>'
      +'<select onchange="doBulkStatusChange(this.value)" class="input h-8 text-[12px]" style="width:auto"><option value="">상태 변경...</option><option value="todo">할 일</option><option value="inprogress">진행 중</option><option value="done">완료</option></select>'
      +'<button onclick="doBulkDelete()" class="btn-danger btn-sm">'+icon('trash-2','w-3.5 h-3.5')+'삭제</button>'
      +'<button onclick="clearBulkSelection()" class="icon-btn" style="color:var(--surface)" aria-label="선택 해제">'+icon('x','w-4 h-4')+'</button>'
    +'</div>' : '';

  setContent(
    projectTabBar('kanban')
    + pageHeader(t('kanban'),bulkMode?'카드를 눌러 여러 작업을 선택하세요':'카드를 끌어 옮기거나 ⋮ 버튼으로 상태를 바꾸세요', actions)
    + renderSavedFilterChips()
    + '<div class="lg:hidden px-4 pb-3"><div class="flex gap-1 p-1 rounded-xl" style="background:var(--surface-2)">'+KANBAN_COLS.map(function(col){
        var n=tasks.filter(function(t){return t.status===col.key;}).length, on=col.key===kanbanMobileCol;
        return '<button onclick="kanbanMobileCol=\''+col.key+'\';renderKanban(true)" class="flex-1 h-10 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5" style="'+(on?'background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(16,24,40,.12)':'color:var(--text-3)')+'">'+col.label+'<span class="badge-neutral">'+n+'</span></button>';
      }).join('')+'</div></div>'
    + '<div class="px-6 pb-8"><div class="kanban-scroll flex gap-4 overflow-x-auto pb-2" style="scrollbar-width:thin">'+colsHtml+'</div></div>'
    + bulkBarHtml
  );
}
function kanbanCard(t){
  var starred=(t.starredBy||[]).indexOf(currentUser.uid)!==-1;
  var checklist=t.checklist||[]; var checkedCount=checklist.filter(c=>c.done).length;
  var fileCount=(t.files||[]).length; var commentCount=t.comments||0;
  var metaBits=[];
  if(checklist.length) metaBits.push('<span class="flex items-center gap-0.5">'+icon('list-checks','w-3 h-3')+checkedCount+'/'+checklist.length+'</span>');
  if(commentCount) metaBits.push('<span class="flex items-center gap-0.5">'+icon('message-circle','w-3 h-3')+commentCount+'</span>');
  if(fileCount) metaBits.push('<span class="flex items-center gap-0.5">'+icon('paperclip','w-3 h-3')+fileCount+'</span>');
  return '<div draggable="true" data-task-id="'+t.id+'" ondragstart="onDragStart(event,\''+t.id+'\')" ondragend="onDragEnd(event)"'
    +' ondragover="event.preventDefault();event.stopPropagation();this.style.borderTop=\'2px solid var(--primary)\'"'
    +' ondragleave="this.style.borderTop=\'\'"'
    +' ondrop="onCardDrop(event,\''+t.id+'\',\''+t.status+'\')"'
    +' onclick="'+(bulkMode?'toggleBulkSelect(\''+t.id+'\','+(selectedTaskIds.indexOf(t.id)===-1)+')':'showTaskDetail(\''+t.id+'\')')+'" class="task-card mb-2.5" style="'+(bulkMode&&selectedTaskIds.indexOf(t.id)!==-1?'outline:2px solid var(--primary)':'')+'">'
    +'<div class="flex items-start justify-between gap-2 mb-2">'+(bulkMode?'<input type="checkbox" '+(selectedTaskIds.indexOf(t.id)!==-1?'checked':'')+' tabindex="-1" class="w-[16px] h-[16px] rounded shrink-0 mt-0.5 accent-[var(--primary)]" style="pointer-events:none" aria-hidden="true">':'')+''+(bulkMode?'':'<button onclick="event.stopPropagation();doToggleTaskDone(\''+t.id+'\',\''+t.status+'\')" class="shrink-0 mt-0.5" style="color:'+(t.status==='done'?'var(--success)':'var(--text-3)')+'" title="'+(t.status==='done'?'다시 할 일로 되돌리기':'완료 처리')+'" aria-label="'+(t.status==='done'?'완료 취소':'완료 처리')+'">'+icon(t.status==='done'?'check-circle-2':'circle','w-[18px] h-[18px]')+'</button>')+'<h4 class="text-card-title leading-snug flex-1" translate="no"'+(bulkMode?'':' title="더블클릭하면 제목을 바로 수정할 수 있어요" onclick="ssTitleClick(event,\''+t.id+'\')" ondblclick="ssTitleEdit(event,\''+t.id+'\')"')+'>'+highlightMatch(escHtml(t.title),searchQuery)+'</h4>'
      +'<div class="flex items-center gap-0.5 shrink-0">'
      +(starred?icon('star','w-3.5 h-3.5').replace('class="','style="color:var(--warning)" class="'):'')
      +'<button onclick="event.stopPropagation();showQuickStatusMenu(\''+t.id+'\',\''+t.status+'\')" class="icon-btn w-6 h-6" title="상태 빠르게 변경 (모바일에서 드래그 대신 사용)" aria-label="상태 빠르게 변경">'+icon('more-vertical','w-3.5 h-3.5')+'</button>'
      +'</div>'
    +'</div>'
    +(t.description?'<p class="text-meta line-clamp-2 mb-2.5">'+escHtml(t.description)+'</p>':'')
    +'<div class="flex items-center flex-wrap gap-1.5 mb-1">'+priorityBadge(t.priority)+(t.dueDate?'<span class="badge-neutral">'+icon('calendar','w-3 h-3')+t.dueDate+'</span>':'')+'</div>'
    +(metaBits.length? '<div class="flex items-center gap-2.5 text-meta mt-1.5">'+metaBits.join('')+'</div>' : '')
    +(t.assigneeName?'<div class="flex items-center gap-1.5 mt-2 pt-2" style="border-top:1px solid var(--border)"><div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style="background:var(--primary)">'+escHtml(t.assigneeName.charAt(0))+'</div><span class="text-meta">'+escHtml(t.assigneeName)+'</span></div>':'')
  +'</div>';
}
/* 제목 한 번 클릭 = 상세 열기(더블클릭과 구분하려고 짧게 기다림), 더블클릭 = 제목 바로 수정 */
var _titleClickTimer=null;
function ssTitleClick(ev,taskId){
  ev.stopPropagation(); clearTimeout(_titleClickTimer);
  _titleClickTimer=setTimeout(function(){ showTaskDetail(taskId); },230);
}
function ssTitleEdit(ev,taskId){
  ev.stopPropagation(); clearTimeout(_titleClickTimer);
  if(isViewer()){ showToast('뷰어 권한에서는 수정할 수 없어요','error'); return; }
  var h=ev.currentTarget, old=h.textContent;
  var inp=document.createElement('input'); inp.type='text'; inp.className='input h-8 flex-1'; inp.value=old; inp.setAttribute('aria-label','작업 제목 수정');
  var done=false;
  function finish(save){
    if(done) return; done=true;
    var v=inp.value.trim();
    if(save && v && v!==old){ ssUpdateTask(taskId,{title:v}).then(function(r){ if(r.success) showToast('제목을 수정했어요','success'); else showToast(r.error||'제목을 수정하지 못했습니다','error'); refreshCurrentTaskViews(currentProjectId); }); }
    else refreshCurrentTaskViews(currentProjectId);
  }
  inp.addEventListener('keydown',function(e){ e.stopPropagation(); if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); finish(true); } else if(e.key==='Escape'){ e.preventDefault(); finish(false); } });
  inp.addEventListener('click',function(e){ e.stopPropagation(); });
  inp.addEventListener('blur',function(){ finish(true); });
  h.replaceWith(inp); inp.focus(); inp.select();
}
/* 카드의 동그라미를 누르면 한 번에 완료(다시 누르면 할 일로 되돌림) */
async function doToggleTaskDone(taskId,status){
  if(isViewer()){ showToast('뷰어 권한에서는 상태를 바꿀 수 없어요','error'); return; }
  var next=status==='done'?'todo':'done';
  var r=await ssMoveTask(taskId,next);
  if(!r.success){ showToast(r.error||'상태를 바꾸지 못했습니다','error'); return; }
  ssLogActivity(currentProjectId,'task_status',(currentUser.name||'사용자')+'님이 작업 상태를 변경했습니다: '+next, taskId);
  showToast(next==='done'?'완료 처리했어요 🎉':'다시 할 일로 되돌렸어요','success');
  refreshCurrentTaskViews(currentProjectId);
}
/* ---- #3 칸반 컬럼 내 순서 변경 ---- */
async function onCardDrop(ev,targetTaskId,status){
  ev.preventDefault(); ev.stopPropagation();
  ev.currentTarget.style.borderTop='';
  if(!draggedTask || draggedTask===targetTaskId){ draggedTask=null; return; }
  showLoading();
  var tasksR=await ssGetTasks(currentProjectId);
  var allTasks=tasksR.tasks||[];
  var draggedObj=allTasks.find(t=>t.id===draggedTask);
  if(!draggedObj){ hideLoading(); return; }
  var colTasks=allTasks.filter(t=>t.status===status && t.id!==draggedTask).sort((a,b)=>(a.order||0)-(b.order||0));
  var targetIdx=colTasks.findIndex(t=>t.id===targetTaskId);
  if(targetIdx===-1) targetIdx=colTasks.length;
  colTasks.splice(targetIdx,0,draggedObj);
  try{
    var batch=db.batch();
    colTasks.forEach((t,i)=>{
      batch.update(db.collection('tasks').doc(t.id), { order:i*10, status:status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    showToast(draggedObj.status===status?'순서가 변경되었습니다':'상태가 변경되었습니다','success');
    if(draggedObj.status!==status) ssLogActivity(currentProjectId,'task_status',(currentUser.name||'사용자')+'님이 작업 상태를 변경했습니다: '+status, draggedTask);
  }catch(e){ showToast('실패했습니다','error'); }
  hideLoading(); draggedTask=null;
  renderKanban();
}
function onDragStart(ev,taskId){ draggedTask=taskId; ev.target.classList.add('dragging'); ev.dataTransfer.effectAllowed='move'; }
function onDragEnd(ev){ ev.target.classList.remove('dragging'); document.querySelectorAll('.kanban-dropzone').forEach(z=>z.classList.remove('drag-over')); }
async function dropOnColumn(ev,status){ ev.preventDefault(); ev.currentTarget.classList.remove('drag-over'); if(!draggedTask)return; showLoading(); var r=await ssMoveTask(draggedTask,status); hideLoading(); draggedTask=null; if(r.success){ showToast('상태가 변경되었습니다','success'); renderKanban(); } }
async function moveTaskTo(status){ if(!draggedTask)return; showLoading(); var r=await ssMoveTask(draggedTask,status); hideLoading(); if(r.success){ showToast('상태가 변경되었습니다','success'); renderKanban(); } }

function assigneeOptionsHtml(members,selectedUid){
  return '<option value="">미지정</option>'+(members||[]).map(m=>'<option value="'+escHtml(m.uid)+'" '+(m.uid===selectedUid?'selected':'')+'>'+escHtml(m.name||m.email||'멤버')+(m.uid===currentUser.uid?' (나)':'')+'</option>').join('');
}
function assigneeNameOf(uid,members){ if(!uid)return ''; var m=(members||[]).find(x=>x.uid===uid); return m?(m.name||m.email||''):''; }
async function showAddTaskModal(status){
  var mR=await ssGetProjectMembers(currentProjectId); var members=mR.members||[];
  showModal(modalWrap('새 작업',
    '<div class="space-y-3">'
    +'<div><label class="field-label">제목 <span style="color:var(--danger)">*</span></label><input type="text" id="task-title" placeholder="작업 제목을 입력하세요" class="input"></div>'
    +'<div><label class="field-label">설명 (선택)</label><textarea id="task-desc" placeholder="상세 설명" class="input" rows="2"></textarea></div>'
    +'<div class="grid grid-cols-2 gap-3">'
      +'<div><label class="field-label">마감일</label><input type="date" id="task-dueDate" class="input">'+ssDateChips('task-dueDate')+'</div>'
      +'<div><label class="field-label">우선순위</label><select id="task-priority" class="input"><option value="low">낮음</option><option value="medium" selected>보통</option><option value="high">높음</option></select></div>'
    +'</div>'
    +'<div><label class="field-label">담당자</label><select id="task-assignee" class="input">'+assigneeOptionsHtml(members,currentUser.uid)+'</select></div>'
    +'<div><label class="field-label">반복</label><select id="task-repeat" class="input"><option value="none">반복 없음</option><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매달</option></select></div>'
    +'</div>',
    '<label class="text-meta flex items-center gap-1.5 mr-auto" style="cursor:pointer"><input type="checkbox" id="task-keep-adding" '+(window._keepAddingTask?'checked':'')+'> 계속 추가</label><button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doAddTask(\''+(status||'todo')+'\')" class="btn-primary">'+icon('plus','w-4 h-4')+'추가</button>'
  ));
  setTimeout(()=>document.getElementById('task-title').focus(),50);
}
async function doAddTask(status){
  if(isViewer()){ showToast('뷰어 권한에서는 작업을 추가할 수 없어요','error'); return; }
  var title=document.getElementById('task-title').value.trim();
  ssClearFieldError('task-title');
  if(!title){ssFieldError('task-title','작업 제목을 입력해 주세요');document.getElementById('task-title').focus();return;}
  var desc=document.getElementById('task-desc')?document.getElementById('task-desc').value.trim():'';
  var repeatEl=document.getElementById('task-repeat');
  var asgEl=document.getElementById('task-assignee'); var asgUid=asgEl?asgEl.value:''; var asgName='';
  if(asgUid){ var asgSel=asgEl.options[asgEl.selectedIndex]; asgName=(asgSel?asgSel.text:'').replace(/ \(나\)$/,''); }
  showLoading();
  var r=await ssCreateTask(currentProjectId,{title,description:desc,assigneeId:asgUid||null,assigneeName:asgName,priority:document.getElementById('task-priority').value,status:status||'todo',dueDate:document.getElementById('task-dueDate').value||null,repeatType:repeatEl?repeatEl.value:'none'});
  hideLoading();
  if(r.success){
    ssClearDraft('task-title','task-desc');
    var keepEl=document.getElementById('task-keep-adding'), keep=!!(keepEl&&keepEl.checked); window._keepAddingTask=keep;
    var keepVals=keep?{pr:document.getElementById('task-priority').value,asg:asgUid,due:(document.getElementById('task-dueDate')||{}).value||''}:null;
    closeModal();showToast('작업이 추가되었습니다','success');localStorage.setItem('syncspace-onb-task','1');
    ssLogActivity(currentProjectId,'task_create',(currentUser.name||'사용자')+'님이 작업을 추가했습니다: '+title, r.id);
    refreshCurrentTaskViews(currentProjectId);
    if(keep){ // 연속 입력: 같은 담당자·우선순위·마감일을 유지한 채 빈 입력창을 다시 연다
      await showAddTaskModal(status);
      var e1=document.getElementById('task-priority'),e2=document.getElementById('task-assignee'),e3=document.getElementById('task-dueDate');
      if(e1) e1.value=keepVals.pr; if(e2) e2.value=keepVals.asg; if(e3) e3.value=keepVals.due;
    }
  } else showToast(r.error,'error');
}

// 지금까지는 작업 제목/설명/마감일/우선순위를 생성한 뒤에는 고칠 방법이 전혀 없었다
// (상태 변경, 담당자 지정 등만 가능). showAddTaskModal과 같은 필드 구성으로 수정 모달을 추가.
async function showEditTaskModal(taskId){
  var tasksR=await ssGetTasks(currentProjectId); var task=(tasksR.tasks||[]).find(t=>t.id===taskId); if(!task)return;
  var mR=await ssGetProjectMembers(currentProjectId); var members=mR.members||[];
  showModal(modalWrap('작업 수정',
    '<div class="space-y-3">'
    +'<div><label class="field-label">제목 <span style="color:var(--danger)">*</span></label><input type="text" id="edit-task-title" value="'+escHtml(task.title)+'" class="input"></div>'
    +'<div><label class="field-label">설명 (선택)</label><textarea id="edit-task-desc" placeholder="상세 설명" class="input" rows="2">'+escHtml(task.description||'')+'</textarea></div>'
    +'<div class="grid grid-cols-2 gap-3">'
      +'<div><label class="field-label">마감일</label><input type="date" id="edit-task-dueDate" value="'+(task.dueDate||'')+'" class="input">'+ssDateChips('edit-task-dueDate')+'</div>'
      +'<div><label class="field-label">우선순위</label><select id="edit-task-priority" class="input"><option value="low" '+(task.priority==='low'?'selected':'')+'>낮음</option><option value="medium" '+(task.priority==='medium'?'selected':'')+'>보통</option><option value="high" '+(task.priority==='high'?'selected':'')+'>높음</option></select></div>'
    +'</div>'
    +'<div><label class="field-label">담당자</label><select id="edit-task-assignee" class="input">'+assigneeOptionsHtml(members,task.assigneeId)+'</select></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doSaveEditTask(\''+taskId+'\')" class="btn-primary">'+icon('check','w-4 h-4')+'저장</button>'
  ));
  setTimeout(()=>{ var el=document.getElementById('edit-task-title'); if(el)el.focus(); },50);
}
async function doSaveEditTask(taskId){
  if(isViewer()){ showToast('뷰어 권한에서는 작업을 수정할 수 없어요','error'); return; }
  var title=document.getElementById('edit-task-title').value.trim();
  ssClearFieldError('edit-task-title');
  if(!title){ ssFieldError('edit-task-title','작업 제목을 입력해 주세요'); document.getElementById('edit-task-title').focus(); return; }
  var desc=document.getElementById('edit-task-desc').value.trim();
  var dueDate=document.getElementById('edit-task-dueDate').value||null;
  var priority=document.getElementById('edit-task-priority').value;
  var asgEl=document.getElementById('edit-task-assignee'); var asgUid=asgEl?asgEl.value:''; var asgName='';
  if(asgUid){ var asgSel=asgEl.options[asgEl.selectedIndex]; asgName=(asgSel?asgSel.text:'').replace(/ \(나\)$/,''); }
  var prevR=await ssGetTasks(currentProjectId); var prev=(prevR.tasks||[]).find(x=>x.id===taskId); var prevAsg=prev?(prev.assigneeId||''):'';
  showLoading();
  var r=await ssUpdateTask(taskId,{title:title,description:desc,dueDate:dueDate,priority:priority,assigneeId:asgUid||null,assigneeName:asgName});
  hideLoading();
  if(r.success && asgUid && asgUid!==prevAsg && asgUid!==currentUser.uid){
    ssCreateNotification(asgUid,{type:'task_assigned',taskId:taskId,taskTitle:title,projectId:currentProjectId,fromUser:currentUser.uid});
  }
  if(r.success){
    showToast('작업이 수정되었습니다','success');
    loadTaskDetail(taskId);
    refreshCurrentTaskViews(currentProjectId);
  } else showToast(r.error||'실패했습니다','error');
}

/* ================= 작업 상세 모달 ================= */
function showTaskDetail(taskId){
  showModal(modalWrap('작업 상세','<div class="py-10 flex justify-center">'+icon('loader-circle','w-6 h-6 animate-spin').replace('class="','style="color:var(--text-3)" class="')+'</div>','',
    'max-w-xl'));
  document.getElementById('modal').setAttribute('data-task-id',taskId);
  loadTaskDetail(taskId);
}
async function loadTaskDetail(taskId){
  var tasksR=await ssGetTasks(currentProjectId); var task=tasksR.tasks.find(t=>t.id===taskId); if(!task)return;
  recordRecent('task',taskId,task.title);
  if(typeof taskHistoryLoaded!=='undefined') taskHistoryLoaded[taskId]=false;
  var commentsR=await ssGetComments(taskId); var comments=commentsR.comments||[];
  var myRole=getMyRole(currentProject);
  var starred = (task.starredBy||[]).indexOf(currentUser.uid)!==-1;
  var reviewerNames = task.reviewerNames||[];
  var checklist = task.checklist||[];
  var checkedCount = checklist.filter(c=>c.done).length;
  var files = task.files||[];
  var dependsOnTask = task.dependsOn ? tasksR.tasks.find(x=>x.id===task.dependsOn) : null;
  var blocked = dependsOnTask && dependsOnTask.status!=='done';

  var body = ''
    +'<div class="flex items-start justify-between gap-2 mb-1">'
      +'<h2 class="text-[17px] font-bold" style="color:var(--text)">'+escUser(task.title)+'</h2>'
      +'<div class="flex items-center gap-1 shrink-0">'
        +'<button onclick="showEditTaskModal(\''+taskId+'\')" class="icon-btn" title="수정 (E)" aria-label="작업 수정">'+icon('pencil','w-4 h-4')+'</button>'
        +'<button onclick="doToggleTaskStar(\''+taskId+'\','+(!starred)+')" class="icon-btn" title="즐겨찾기" aria-label="즐겨찾기 토글">'+icon(starred?'star':'star-off','w-4 h-4').replace('class="','style="color:'+(starred?'var(--warning)':'var(--text-3)')+'" class="')+'</button>'
      +'</div>'
    +'</div>'
    + (blocked? '<div class="mb-3 px-3 py-2 rounded-lg text-[12.5px] flex items-center gap-1.5" style="background:var(--warning-soft);color:var(--warning)">'+icon('lock','w-3.5 h-3.5')+'"'+escHtml(dependsOnTask.title)+'" 작업이 끝나야 시작할 수 있어요</div>' : '')
    +'<p class="text-body mb-4">'+(escHtml(task.description)||'설명이 없습니다.')+'</p>'
    +'<div class="grid grid-cols-2 gap-3 mb-4 p-3.5 rounded-xl surface-2">'
      +metaRow('상태',statusBadge(task.status))
      +metaRow('우선순위',priorityBadge(task.priority))
      +metaRow('마감일', task.dueDate? '<span class="text-body">'+task.dueDate+'</span>':'<span class="text-meta">없음</span>')
      +metaRow('담당자', task.assigneeName? '<span class="text-body">'+escHtml(task.assigneeName)+'</span>':'<span class="text-meta">미지정</span>')
    +'</div>'

    // ---- 탭바 (#2 작업 상세 재구성) ----
    +'<div class="flex items-center gap-1 mb-4" style="border-bottom:1px solid var(--border)">'
      + ['overview','subtasks','files','activity'].map(function(tb){
          var labels={overview:'개요',subtasks:'서브태스크 ('+checkedCount+'/'+checklist.length+')',files:'파일 ('+files.length+')',activity:'활동'};
          return '<button id="task-tabbtn-'+tb+'-'+taskId+'" onclick="switchTaskDetailTab(\''+taskId+'\',\''+tb+'\')" class="px-3 h-9 text-[12.5px] font-medium" style="'+(tb==='overview'?'color:var(--primary);border-bottom:2px solid var(--primary)':'color:var(--text-3);border-bottom:2px solid transparent')+'">'+labels[tb]+'</button>';
        }).join('')
    +'</div>'

    // ---- 개요 탭 ----
    +'<div id="task-tab-overview-'+taskId+'" class="task-tab-panel">'
      +'<div class="flex items-center justify-between mb-2 px-1">'
        +'<div class="flex items-center gap-1.5 flex-wrap"><span class="text-meta">'+icon('eye','w-3 h-3 inline mr-0.5 -mt-0.5')+'리뷰어</span>'
        + (reviewerNames.length? reviewerNames.map(n=>'<span class="badge-neutral">'+escHtml(n)+'</span>').join('') : '<span class="text-meta">없음</span>')
        +'</div>'
        +'<button onclick="showReviewerModal(\''+taskId+'\')" class="text-[12px] font-semibold" style="color:var(--primary)">편집</button>'
      +'</div>'
      +'<div class="flex items-center justify-between mb-5 px-1">'
        +'<div class="flex items-center gap-1.5 flex-wrap"><span class="text-meta">'+icon('link-2','w-3 h-3 inline mr-0.5 -mt-0.5')+'선행 작업</span>'
        + (dependsOnTask? '<span class="badge-neutral">'+escHtml(dependsOnTask.title)+' · '+(dependsOnTask.status==='done'?'완료':'미완료')+'</span>' : '<span class="text-meta">없음</span>')
        +'</div>'
        +'<button onclick="showDependencyModal(\''+taskId+'\')" class="text-[12px] font-semibold" style="color:var(--primary)">편집</button>'
      +'</div>'
      +'<div class="flex items-center justify-between mb-3">'
        +'<h4 class="text-card-title">'+icon('message-circle','w-4 h-4 inline mr-1 -mt-0.5')+'댓글 ('+comments.length+')</h4>'
      +'</div>'
      +'<div class="max-h-[220px] overflow-y-auto space-y-2 mb-3">'
        +(comments.length? comments.map(c=>{
          var reactions=c.reactions||{}; var reactBtns=['👍','✅','🎉'].map(em=>{
            var arr=reactions[em]||[]; var mine=arr.indexOf(currentUser.uid)!==-1;
            return '<button onclick="doToggleReaction(\''+taskId+'\',\''+c.id+'\',\''+em+'\','+(!mine)+')" class="text-[11px] px-1.5 py-0.5 rounded-full" style="'+(mine?'background:var(--primary-soft);color:var(--primary-soft-text)':'background:var(--surface);color:var(--text-3);border:1px solid var(--border)')+'">'+em+(arr.length?' '+arr.length:'')+'</button>';
          }).join(' ');
          var canDelete=c.authorId===currentUser.uid||myRole==='owner';
          return '<div class="p-2.5 rounded-xl surface-2"><div class="flex items-center justify-between mb-0.5"><span class="text-card-title">'+escHtml(c.authorName)+'</span><span class="text-meta">'+relDate(c.createdAt)+'</span></div><p class="text-body mb-1.5">'+escHtml(c.content)+'</p><div class="flex items-center justify-between"><div class="flex gap-1">'+reactBtns+'</div>'+(canDelete?'<button onclick="doDeleteComment(\''+taskId+'\',\''+c.id+'\')" class="text-meta" style="color:var(--danger);background:none;border:none;cursor:pointer;padding:0" title="삭제">삭제</button>':'')+'</div></div>';
        }).join('') : '<p class="text-meta text-center py-3">첫 댓글을 남겨보세요</p>')
      +'</div>'
      +'<p class="text-meta mb-1.5">'+icon('at-sign','w-3 h-3 inline mr-0.5 -mt-0.5')+'@이름 을 입력하면 해당 멤버에게 알림이 갑니다</p>'
      +'<div class="flex gap-2 mb-1">'
        +'<input type="text" id="comment-text" placeholder="댓글을 입력하세요 (@이름으로 멘션)" class="input flex-1" onkeypress="if(event.key===\'Enter\'&&!mentionIsActive())doAddComment(\''+taskId+'\')">'
        +'<button onclick="doAddComment(\''+taskId+'\')" class="icon-btn" style="background:var(--primary-soft);color:var(--primary-soft-text)" aria-label="댓글 등록">'+icon('send','w-4 h-4')+'</button>'
      +'</div>'
    +'</div>'

    // ---- 서브태스크 탭 ----
    +'<div id="task-tab-subtasks-'+taskId+'" class="task-tab-panel hidden">'
      +'<div class="space-y-1.5 mb-2">'
        +(checklist.length? checklist.map((c,i)=>
          '<div class="flex items-center gap-2 px-1"><input type="checkbox" '+(c.done?'checked':'')+' onchange="doToggleChecklistUI(\''+taskId+'\','+i+',this.checked)" class="w-4 h-4 rounded accent-[var(--primary)] shrink-0">'
          +'<span class="text-body flex-1 '+(c.done?'line-through':'')+'" style="'+(c.done?'color:var(--text-3)':'')+'">'+escHtml(c.text)+'</span>'
          +'<button onclick="doRemoveChecklistItemUI(\''+taskId+'\','+i+')" class="icon-btn w-6 h-6" aria-label="서브태스크 삭제">'+icon('x','w-3 h-3')+'</button></div>'
        ).join('') : '<p class="text-meta px-1 py-4 text-center">서브태스크가 없습니다</p>')
      +'</div>'
      +'<div class="flex gap-2"><input type="text" id="checklist-input" placeholder="서브태스크 추가" class="input flex-1 h-9" onkeypress="if(event.key===\'Enter\')doAddChecklistItemUI(\''+taskId+'\')">'
      +'<button onclick="doAddChecklistItemUI(\''+taskId+'\')" class="btn-secondary btn-sm" title="항목 추가" aria-label="항목 추가">'+icon('plus','w-3.5 h-3.5')+'</button></div>'
    +'</div>'

    // ---- 파일 탭 ----
    +'<div id="task-tab-files-'+taskId+'" class="task-tab-panel hidden">'
      +(files.length? '<div class="space-y-1.5 mb-3">'+files.map(f=>
        '<div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg surface-2"><a href="'+(f.url||'#')+'" target="_blank" class="text-body flex-1 truncate hover:underline">'+icon('file','w-3.5 h-3.5 inline mr-1 -mt-0.5')+escHtml(f.name)+'</a><button onclick="doDeleteTaskFileUI(\''+taskId+'\',\''+f.id+'\')" class="icon-btn w-6 h-6" aria-label="파일 삭제">'+icon('trash-2','w-3 h-3')+'</button></div>'
      ).join('')+'</div>' : '')
      +'<div id="dropzone-'+taskId+'" ondragover="event.preventDefault();this.style.borderColor=\'var(--primary)\'" ondragleave="this.style.borderColor=\'var(--border-strong)\'" ondrop="doDropTaskFile(event,\''+taskId+'\')" class="rounded-xl border-2 border-dashed p-4 text-center cursor-pointer" style="border-color:var(--border-strong)" onclick="document.getElementById(\'file-input-\'+\''+taskId+'\').click()">'
        +icon('upload-cloud','w-5 h-5 mx-auto mb-1').replace('class="','style="color:var(--text-3)" class="')
        +'<div class="text-meta">클릭하거나 파일을 끌어다 놓으세요</div>'
        +'<input type="file" id="file-input-'+taskId+'" class="hidden" onchange="doUploadTaskFileUI(event,\''+taskId+'\')">'
      +'</div>'
    +'</div>'

    // ---- 활동 탭 (#8) ----
    +'<div id="task-tab-activity-'+taskId+'" class="task-tab-panel hidden">'
      +'<div id="task-history-'+taskId+'" class="space-y-2 py-2">'+icon('loader-circle','w-4 h-4 animate-spin mx-auto').replace('class="','style="color:var(--text-3)" class="')+'</div>'
    +'</div>';

  var footer = '<select onchange="doChangeTaskStatus(\''+taskId+'\',this.value)" class="input h-9" style="width:auto">'
      +'<option value="todo" '+(task.status==='todo'?'selected':'')+'>할 일</option>'
      +'<option value="inprogress" '+(task.status==='inprogress'?'selected':'')+'>진행 중</option>'
      +'<option value="done" '+(task.status==='done'?'selected':'')+'>완료</option>'
    +'</select>'
    +'<button onclick="doDuplicateTask(\''+taskId+'\')" class="btn-secondary" title="복제">'+icon('copy','w-4 h-4')+'</button>'
    +'<button onclick="doDeleteTask(\''+taskId+'\')" class="btn-danger ml-auto">'+icon('trash-2','w-4 h-4')+'삭제</button>';

  showModal(modalWrap('작업 상세', body, footer, 'max-w-xl'));
  attachMentionAutocomplete('comment-text');
}
function metaRow(label,valueHtml){ return '<div><div class="text-meta mb-1">'+label+'</div>'+valueHtml+'</div>'; }
async function doAddComment(taskId){
  var text=document.getElementById('comment-text').value.trim(); if(!text)return;
  showLoading(); var r=await ssAddComment(taskId,text); hideLoading();
  if(r.success){
    loadTaskDetail(taskId);
    // @멘션 알림 (#5)
    var tasksR=await ssGetTasks(currentProjectId); var task=(tasksR.tasks||[]).find(x=>x.id===taskId);
    var mR=await ssGetProjectMembers(currentProjectId);
    ssNotifyMentions(text, mR.members||[], {taskId:taskId, taskTitle:task?task.title:'', projectId:currentProjectId});
    // 담당자에게 댓글 알림 (댓글 작성자 본인이 담당자면 알림 생략)
    if(task && task.assigneeId && task.assigneeId!==currentUser.uid){
      ssCreateNotification(task.assigneeId, {
        type:'comment_added', taskId:taskId, taskTitle:task.title, projectId:currentProjectId,
        fromUser:currentUser.uid, message:(currentUser.name||'사용자')+'님이 댓글을 남겼습니다'
      });
    }
  }
}
async function doDeleteComment(taskId,commentId){
  if(!confirm('댓글을 삭제하시겠습니까?'))return;
  var r=await ssDeleteComment(taskId,commentId);
  if(r.success) loadTaskDetail(taskId);
  else showToast('삭제에 실패했습니다','error');
}
/* ---- #7(댓글 리액션) ---- */
async function doToggleReaction(taskId,commentId,emoji,add){ var r=await ssToggleCommentReaction(taskId,commentId,emoji,currentUser.uid,add); if(r.success) loadTaskDetail(taskId); }
/* ---- #3 작업 복제 ---- */
async function doDuplicateTask(taskId){
  showLoading();
  var tasksR=await ssGetTasks(currentProjectId); var task=(tasksR.tasks||[]).find(t=>t.id===taskId);
  if(!task){hideLoading();return;}
  var r=await ssCreateTask(currentProjectId,{title:task.title+' (복제)',description:task.description,priority:task.priority,status:'todo',dueDate:task.dueDate,assigneeId:task.assigneeId,assigneeName:task.assigneeName,repeatType:task.repeatType||'none'});
  hideLoading();
  if(r.success){ showToast('작업이 복제되었습니다','success'); closeModal(); refreshCurrentTaskViews(currentProjectId); } else showToast('실패했습니다','error');
}
/* ---- #5 선행 작업(의존성) ---- */
async function showDependencyModal(taskId){
  showLoading(); var tasksR=await ssGetTasks(currentProjectId); hideLoading();
  var others=(tasksR.tasks||[]).filter(t=>t.id!==taskId);
  var current=(tasksR.tasks.find(t=>t.id===taskId)||{}).dependsOn||'';
  showModal(modalWrap('선행 작업 지정',
    '<p class="text-meta mb-2">이 작업을 시작하기 전에 먼저 끝나야 하는 작업을 선택하세요</p>'
    +'<select id="dependency-select" class="input"><option value="">없음</option>'
    + others.map(t=>'<option value="'+t.id+'" '+(t.id===current?'selected':'')+'>'+escHtml(t.title)+' ('+(t.status==='done'?'완료':'미완료')+')</option>').join('')
    +'</select>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doSaveDependency(\''+taskId+'\')" class="btn-primary">'+icon('check','w-4 h-4')+'저장</button>'
  ));
}
async function doSaveDependency(taskId){
  var val=document.getElementById('dependency-select').value;
  showLoading(); var r=await ssUpdateTask(taskId,{dependsOn: val||null}); hideLoading();
  if(r.success){ closeModal(); showToast('저장되었습니다','success'); loadTaskDetail(taskId); } else showToast('실패했습니다','error');
}
/* ---- #4 반복 작업 자동 생성 ---- */
function addInterval(dateStr, type){
  var d = dateStr? new Date(dateStr) : new Date();
  if(type==='daily') d.setDate(d.getDate()+1);
  else if(type==='weekly') d.setDate(d.getDate()+7);
  else if(type==='monthly') d.setMonth(d.getMonth()+1);
  return fmtDate(d);
}
async function maybeCreateNextRecurrence(task){
  if(!task || !task.repeatType || task.repeatType==='none') return;
  if(task.repeatEndDate && task.dueDate && task.dueDate>=task.repeatEndDate) return;
  var nextDue = addInterval(task.dueDate, task.repeatType);
  if(task.repeatEndDate && nextDue>task.repeatEndDate) return;
  await ssCreateTask(currentProjectId,{
    title:task.title, description:task.description, priority:task.priority, status:'todo',
    dueDate:nextDue, assigneeId:task.assigneeId, assigneeName:task.assigneeName,
    repeatType:task.repeatType, repeatEndDate:task.repeatEndDate||null
  });
  showToast('다음 반복 작업이 생성되었습니다 ('+nextDue+')','info');
}
async function doChangeTaskStatus(taskId,status){
  showLoading();
  var tasksR=await ssGetTasks(currentProjectId); var task=(tasksR.tasks||[]).find(t=>t.id===taskId);
  var r=await ssMoveTask(taskId,status);
  if(status==='done') await ssUpdateTask(taskId,{completedAt: firebase.firestore.FieldValue.serverTimestamp()});
  hideLoading();
  if(r.success){
    showToast('상태가 변경되었습니다','success');
    ssLogActivity(currentProjectId,'task_status',(currentUser.name||'사용자')+'님이 작업 상태를 변경했습니다: '+status, taskId);
    if(status==='done' && task) maybeCreateNextRecurrence(task);
    loadTaskDetail(taskId);
  }
}
async function doDeleteTask(taskId){
  if(!confirm('이 작업을 삭제하시겠습니까?'))return;
  showLoading();
  var tasksR=await ssGetTasks(currentProjectId); var snapshot=(tasksR.tasks||[]).find(t=>t.id===taskId);
  var r=await ssDeleteTask(taskId);hideLoading();
  if(r.success){
    closeModal();
    ssLogActivity(currentProjectId,'task_delete',(currentUser.name||'사용자')+'님이 작업을 삭제했습니다', taskId);
    var pid=currentProjectId;
    showUndoToast('작업이 삭제되었습니다', async function(){
      if(!snapshot)return;
      var restore={...snapshot}; delete restore.id; delete restore.projectName; delete restore.projectColor; delete restore.projectId;
      if(restore.createdAt) restore.createdAt=firebase.firestore.Timestamp.fromDate(new Date(restore.createdAt));
      await db.collection('tasks').doc(taskId).set(restore);
      showToast('복구되었습니다','success');
      refreshCurrentTaskViews(pid);
    });
    refreshCurrentTaskViews(pid);
  }
}
function refreshCurrentTaskViews(pid){
  if(currentView==='kanban')renderKanban();else if(currentView==='dashboard')renderDashboard();else if(currentView==='mytasks')renderMyTasks();else if(currentView==='roles')renderRoles();
}
/* ---- #6 작업 북마크 ---- */
async function doToggleTaskStar(taskId,starred){ var r=await ssToggleTaskStar(taskId,currentUser.uid,starred); if(r.success) loadTaskDetail(taskId); }
/* ---- #9 서브태스크 ---- */
async function doAddChecklistItemUI(taskId){ var inp=document.getElementById('checklist-input'); var text=inp.value.trim(); if(!text)return; showLoading(); var r=await ssAddChecklistItem(taskId,text); hideLoading(); if(r.success) loadTaskDetail(taskId); }
async function doToggleChecklistUI(taskId,index,checked){ var r=await ssToggleChecklist(taskId,index,checked); if(r.success) loadTaskDetail(taskId); }
async function doRemoveChecklistItemUI(taskId,index){ var r=await ssRemoveChecklistItem(taskId,index); if(r.success) loadTaskDetail(taskId); }
/* ---- #7 파일 업로드 ---- */
async function doUploadTaskFileUI(ev,taskId){ var file=ev.target.files[0]; if(!file)return; showLoading(); var r=await ssUploadTaskFile(taskId,file); hideLoading(); if(r.success){ showToast('파일이 업로드되었습니다','success'); loadTaskDetail(taskId); } else showToast(r.error||'업로드 실패 (Storage 설정을 확인하세요)','error'); }
async function doDropTaskFile(ev,taskId){ ev.preventDefault(); document.getElementById('dropzone-'+taskId).style.borderColor='var(--border-strong)'; var file=ev.dataTransfer.files[0]; if(!file)return; showLoading(); var r=await ssUploadTaskFile(taskId,file); hideLoading(); if(r.success){ showToast('파일이 업로드되었습니다','success'); loadTaskDetail(taskId); } else showToast(r.error||'업로드 실패 (Storage 설정을 확인하세요)','error'); }
async function doDeleteTaskFileUI(taskId,fileId){ showLoading(); var r=await ssDeleteTaskFile(taskId,fileId); hideLoading(); if(r.success) loadTaskDetail(taskId); }
/* ---- #8 리뷰어 ---- */
async function showReviewerModal(taskId){
  showLoading(); var mR=await ssGetProjectMembers(currentProjectId); var tasksR=await ssGetTasks(currentProjectId); hideLoading();
  var members=mR.members||[]; var task=(tasksR.tasks||[]).find(t=>t.id===taskId); var current=(task&&task.reviewerIds)||[];
  showModal(modalWrap('리뷰어 지정',
    '<div class="space-y-1.5">'+members.map(m=>
      '<label class="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer" style="background:var(--surface-2)"><input type="checkbox" value="'+m.uid+'" data-name="'+escHtml(m.name)+'" '+(current.indexOf(m.uid)!==-1?'checked':'')+' class="reviewer-check w-4 h-4 accent-[var(--primary)]">'+avatarCircle(m.avatar,'w-6 h-6 text-sm')+'<span class="text-body">'+escUser(m.name)+'</span></label>'
    ).join('')+'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doSaveReviewers(\''+taskId+'\')" class="btn-primary">'+icon('check','w-4 h-4')+'저장</button>'
  ));
}
async function doSaveReviewers(taskId){
  var checks=Array.from(document.querySelectorAll('.reviewer-check:checked'));
  var ids=checks.map(c=>c.value), names=checks.map(c=>c.dataset.name);
  showLoading();
  var prevR=await ssGetTasks(currentProjectId); var prevTask=(prevR.tasks||[]).find(x=>x.id===taskId);
  var prevIds=(prevTask&&prevTask.reviewerIds)||[];
  var r=await ssSetReviewers(taskId,ids,names); hideLoading();
  if(r.success){
    closeModal(); showToast('리뷰어가 저장되었습니다','success');
    ssLogActivity(currentProjectId,'task_reviewer',(currentUser.name||'사용자')+'님이 리뷰어를 변경했습니다: '+(names.join(', ')||'없음'), taskId);
    // 새로 지정된 리뷰어에게만 알림 (기존에 이미 리뷰어였던 사람은 제외, 본인 제외)
    ids.filter(uid=>uid!==currentUser.uid && prevIds.indexOf(uid)===-1).forEach(function(uid){
      ssCreateNotification(uid, {
        type:'review_request', taskId:taskId, taskTitle:prevTask?prevTask.title:'', projectId:currentProjectId,
        fromUser:currentUser.uid, message:(currentUser.name||'사용자')+'님이 리뷰를 요청했습니다'
      });
    });
    loadTaskDetail(taskId);
  } else showToast('실패했습니다','error');
}

/* ================================================================
   캘린더
   ================================================================ */
var calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
const monthNamesKo=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const dayNamesKo=['일','월','화','수','목','금','토'];
const monthNamesEn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNamesEn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// 버튼 클릭과 키보드 단축키(←/→)가 같은 로직을 쓰도록 분리
var calMode='month', calWeekStart=(function(){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; })();
function calSetMode(m){ calMode=m; if(m==='week'){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); calWeekStart=d; } renderCalendar(); }
function calPrevMonth(){ if(calMode==='week'){ calWeekStart=new Date(calWeekStart.getFullYear(),calWeekStart.getMonth(),calWeekStart.getDate()-7); renderCalendar(); return; } calMonth--; if(calMonth<0){ calMonth=11; calYear--; } renderCalendar(); }
function calNextMonth(){ if(calMode==='week'){ calWeekStart=new Date(calWeekStart.getFullYear(),calWeekStart.getMonth(),calWeekStart.getDate()+7); renderCalendar(); return; } calMonth++; if(calMonth>11){ calMonth=0; calYear++; } renderCalendar(); }

async function renderCalendar(){
  if(!currentProjectId){ setContent(pageHeader(t('calendar'))+noProjectState()); return; }
  setContent(pageHeader(t('calendar'))+skeletonBlockWrap());
  var eventsR=await ssGetEvents(currentProjectId); var events=eventsR.events||[];
  var tasksR=await ssGetTasks(currentProjectId); var tasks=tasksR.tasks||[];
  var dateMap={};
  calEventsCache=events;
  events.forEach(e=>{ (dateMap[e.date]=dateMap[e.date]||[]).push({id:e.id,title:e.title,color:e.color||'6366F1',kind:'event',type:e.type}); });
  tasks.forEach(t=>{ if(t.dueDate) (dateMap[t.dueDate]=dateMap[t.dueDate]||[]).push({id:t.id,title:t.title,color:t.status==='done'?'059669':'E11D48',kind:'task'}); });

  var weeks=ssGenerateCalendar(calYear,calMonth); var today=fmtDate(new Date());
  var headRow = (currentLang==='en'?dayNamesEn:dayNamesKo).map((d,i)=>'<th class="py-2 text-meta font-semibold" style="'+(i===0?'color:var(--danger)':i===6?'color:var(--info)':'')+'">'+d+'</th>').join('');
  var rows = weeks.map(week=>'<tr>'+week.map(day=>{
    if(!day) return '<td class="p-1"></td>';
    var dateStr=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    var isToday=dateStr===today; var items=dateMap[dateStr]||[];
    return '<td class="p-1 align-top">'
      +'<div onclick="showAddEventModal(\''+dateStr+'\')" class="min-h-[86px] rounded-xl p-1.5 cursor-pointer transition-colors" style="'+(isToday?'background:var(--primary-soft)':'')+'" onmouseover="if(!'+isToday+')this.style.background=\'var(--surface-2)\'" onmouseout="if(!'+isToday+')this.style.background=\'\'">'
        +'<div class="w-5 h-5 flex items-center justify-center text-[11.5px] font-semibold rounded-full mb-1" style="'+(isToday?'background:var(--primary);color:#fff':'color:var(--text-2)')+'">'+day+'</div>'
        + items.slice(0,2).map(it=>'<div onclick="event.stopPropagation();showDayModal(\''+dateStr+'\')" title="클릭: 보기/삭제" class="text-[10.5px] px-1.5 py-0.5 mb-0.5 rounded-md truncate" style="background:#'+it.color+'1C;color:#'+it.color+'">'+(it.kind==='task'?icon('bookmark','w-2.5 h-2.5 inline mr-0.5 -mt-0.5'):'')+escHtml(it.title)+'</div>').join('')
        + (items.length>2? '<div onclick="event.stopPropagation();showDayModal(\''+dateStr+'\')" class="text-[10px] px-1" style="color:var(--text-3)">+'+(items.length-2)+'개</div>':'')
      +'</div>'
    +'</td>';
  }).join('')+'</tr>').join('');

  var legend = '<div class="flex items-center gap-4 text-meta mt-3">'
    +'<span class="flex items-center gap-1.5">'+icon('bookmark','w-3 h-3')+'작업 마감일</span>'
    +'<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full inline-block" style="background:#6366F1"></span>일정</span>'
    +'<span class="ml-auto">빈 날짜를 누르면 일정 추가, 일정을 누르면 수정·삭제</span>'
  +'</div>';

  var actions = '<div class="flex items-center gap-1">'
    +'<button onclick="calPrevMonth()" class="icon-btn" aria-label="이전 달">'+icon('chevron-left')+'</button>'
    +'<span class="text-card-title text-center '+(calMode==='week'?'w-40':'w-28')+'">'+(calMode==='week'?(function(){ var e=new Date(calWeekStart.getFullYear(),calWeekStart.getMonth(),calWeekStart.getDate()+6); return (calWeekStart.getMonth()+1)+'/'+calWeekStart.getDate()+' – '+(e.getMonth()+1)+'/'+e.getDate(); })():(currentLang==='en'?monthNamesEn[calMonth]+' '+calYear:calYear+'년 '+monthNamesKo[calMonth]))+'</span>'
    +'<button onclick="calNextMonth()" class="icon-btn" aria-label="다음 달">'+icon('chevron-right')+'</button>'
    +'</div><div class="flex gap-0.5 p-0.5 rounded-lg" style="background:var(--surface-2)" role="group" aria-label="보기 방식">'
    +'<button onclick="calSetMode(\'month\')" class="px-2.5 h-8 rounded-md text-[12.5px] font-semibold" style="'+(calMode==='month'?'background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.12)':'color:var(--text-3)')+'">월간</button>'
    +'<button onclick="calSetMode(\'week\')" class="px-2.5 h-8 rounded-md text-[12.5px] font-semibold" style="'+(calMode==='week'?'background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.12)':'color:var(--text-3)')+'">주간 목록</button></div>'
    +'<button onclick="doExportCalendarICS()" class="btn-secondary" title="캘린더 앱으로 내보내기">'+icon('calendar-days','w-4 h-4')+'</button>'
    +'<button onclick="showAddEventModal(\''+today+'\')" class="btn-primary">'+icon('plus','w-4 h-4')+'일정 추가</button>';

  if(calMode==='week'){
    var dn=['일','월','화','수','목','금','토'];
    var weekHtml=[0,1,2,3,4,5,6].map(function(i){
      var d=new Date(calWeekStart.getFullYear(),calWeekStart.getMonth(),calWeekStart.getDate()+i), ds=fmtDate(d), its=dateMap[ds]||[], isT=ds===today;
      return '<div class="card card-pad" style="'+(isT?'border-color:var(--primary)':'')+'"><div class="flex items-center justify-between mb-2"><div class="text-card-title">'+(d.getMonth()+1)+'/'+d.getDate()+' ('+dn[i]+')'+(isT?' <span class="badge-primary">오늘</span>':'')+'</div>'
        +'<button onclick="showAddEventModal(\''+ds+'\')" class="icon-btn" title="이 날 일정 추가" aria-label="이 날 일정 추가">'+icon('plus','w-4 h-4')+'</button></div>'
        +(its.length?its.map(function(it){ return '<div onclick="'+(it.kind==='task'?'showTaskDetail(\''+it.id+'\')':'showDayModal(\''+ds+'\')')+'" class="flex items-center gap-2 py-1.5 cursor-pointer"><span class="w-2 h-2 rounded-full shrink-0" style="background:#'+it.color+'"></span><span class="text-body truncate flex-1">'+escUser(it.title)+'</span><span class="text-meta shrink-0">'+(it.kind==='task'?'작업 마감':(EVENT_TYPE_LABEL[it.type]||'일정'))+'</span></div>'; }).join(''):'<div class="text-meta">일정 없음</div>')+'</div>';
    }).join('');
    setContent(projectTabBar('calendar')+pageHeader(t('calendar'),'이번 주 일정과 작업 마감을 목록으로', actions)+'<div class="px-6 pb-8 grid gap-3 md:grid-cols-2">'+weekHtml+'</div>');
    return;
  }
  setContent(projectTabBar('calendar')+pageHeader(t('calendar'),'작업 마감일과 팀 일정을 한눈에', actions)
    +'<div class="px-6 pb-8"><div class="card card-pad overflow-x-auto"><table class="w-full min-w-[560px] border-collapse"><thead><tr>'+headRow+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+legend+'</div>');
}
/* 날짜를 눌렀을 때: 그날의 일정·작업 마감 목록. 일정은 여기서 삭제할 수 있다(삭제 후 실행취소 가능). */
var calEventsCache=[];
var EVENT_TYPE_LABEL={event:'일반 이벤트',milestone:'마일스톤',deadline:'마감'};
async function showDayModal(dateStr){
  var evs=calEventsCache.filter(e=>e.date===dateStr);
  var tr=await ssGetTasks(currentProjectId); var tks=(tr.tasks||[]).filter(t=>t.dueDate===dateStr);
  var canEdit=!isViewer();
  var rows=evs.map(e=>'<div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--border)"><span class="w-2 h-2 rounded-full shrink-0" style="background:#'+(e.color||'6366F1')+'"></span>'
      +'<div class="flex-1 min-w-0"><div class="text-card-title truncate">'+escUser(e.title)+'</div><div class="text-meta">'+(EVENT_TYPE_LABEL[e.type]||'일정')+'</div></div>'
      +(canEdit?'<button onclick="showEditEventModal(\''+e.id+'\')" class="icon-btn" title="일정 수정" aria-label="일정 수정">'+icon('pencil','w-4 h-4')+'</button>':'')
      +(canEdit?'<button onclick="doDeleteEvent(\''+e.id+'\')" class="icon-btn" title="일정 삭제" aria-label="일정 삭제" style="color:var(--danger)">'+icon('trash-2','w-4 h-4')+'</button>':'')+'</div>').join('')
    +tks.map(t=>'<div class="flex items-center gap-2 py-2 cursor-pointer" style="border-bottom:1px solid var(--border)" onclick="closeModal();showTaskDetail(\''+t.id+'\')">'+icon('bookmark','w-3.5 h-3.5 shrink-0')+'<div class="flex-1 min-w-0"><div class="text-card-title truncate">'+escUser(t.title)+'</div><div class="text-meta">작업 마감일</div></div></div>').join('');
  if(!rows) rows='<p class="text-body py-2">이 날짜에는 일정이 없어요.</p>';
  showModal(modalWrap(dateStr.replace(/-/g,'.')+' 일정','<div>'+rows+'</div>',
    '<button onclick="closeModal()" class="btn-secondary">닫기</button>'+(canEdit?'<button onclick="closeModal();showAddEventModal(\''+dateStr+'\')" class="btn-primary">'+icon('plus','w-4 h-4')+'일정 추가</button>':'')));
}
function showEditEventModal(eventId){
  var ev=calEventsCache.find(e=>e.id===eventId); if(!ev) return;
  var opts=['event','milestone','deadline'].map(k=>'<option value="'+k+'" '+((ev.type||'event')===k?'selected':'')+'>'+EVENT_TYPE_LABEL[k]+'</option>').join('');
  showModal(modalWrap('일정 수정',
    '<div class="space-y-3">'
    +'<div><label class="field-label">제목 <span style="color:var(--danger)">*</span></label><input type="text" id="event-edit-title" value="'+escHtml(ev.title||'')+'" class="input"></div>'
    +'<div><label class="field-label">날짜</label><input type="date" id="event-edit-date" value="'+escHtml(ev.date||'')+'" class="input">'+ssDateChips('event-edit-date')+'</div>'
    +'<div><label class="field-label">유형</label><select id="event-edit-type" class="input">'+opts+'</select></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doEditEvent(\''+eventId+'\')" class="btn-primary">'+icon('check','w-4 h-4')+'저장</button>'
  ));
}
async function doEditEvent(eventId){
  var title=document.getElementById('event-edit-title').value.trim(), date=document.getElementById('event-edit-date').value, type=document.getElementById('event-edit-type').value;
  ssClearFieldError('event-edit-title');
  if(!title){ ssFieldError('event-edit-title','일정 제목을 입력해 주세요'); document.getElementById('event-edit-title').focus(); return; }
  if(!date){ ssFieldError('event-edit-date','날짜를 선택해 주세요'); return; }
  showLoading(); var r=await ssUpdateEvent(eventId,{title:title,date:date,endDate:date,type:type}); hideLoading();
  if(!r.success){ showToast(r.error||'일정을 수정하지 못했습니다','error'); return; }
  closeModal(); showToast('일정을 수정했습니다','success'); renderCalendar();
}
async function doDeleteEvent(eventId){
  var ev=calEventsCache.find(e=>e.id===eventId); if(!ev) return;
  showLoading(); var r=await ssDeleteEvent(eventId); hideLoading();
  if(!r.success){ showToast(r.error||'일정을 삭제하지 못했습니다','error'); return; }
  closeModal();
  showUndoToast('일정을 삭제했습니다',async function(){
    var rr=await ssCreateEvent(currentProjectId,{title:ev.title,date:ev.date,endDate:ev.endDate,time:ev.time,color:ev.color,type:ev.type,description:ev.description});
    if(rr.success){ showToast('일정을 복구했습니다','success'); renderCalendar(); } else showToast(rr.error||'복구하지 못했습니다','error');
  });
  renderCalendar();
}
function skeletonBlockWrap(){ return '<div class="px-6 pb-8">'+skeletonBlock('420px','100%')+'</div>'; }

function showAddEventModal(date){
  showModal(modalWrap('일정 추가',
    '<div class="space-y-3">'
    +'<div><label class="field-label">제목 <span style="color:var(--danger)">*</span></label><input type="text" id="event-title" placeholder="일정 제목" class="input"></div>'
    +'<div><label class="field-label">날짜</label><input type="date" id="event-date" value="'+date+'" class="input">'+ssDateChips('event-date')+'</div>'
    +'<div><label class="field-label">유형</label><select id="event-type" class="input"><option value="event">일반 이벤트</option><option value="milestone">마일스톤</option><option value="deadline">마감</option></select></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doAddEvent()" class="btn-primary">'+icon('plus','w-4 h-4')+'추가</button>'
  ));
}
async function doAddEvent(){var title=document.getElementById('event-title').value.trim();ssClearFieldError('event-title');if(!title){ssFieldError('event-title','일정 제목을 입력해 주세요');document.getElementById('event-title').focus();return;}showLoading();var r=await ssCreateEvent(currentProjectId,{title,date:document.getElementById('event-date').value,type:document.getElementById('event-type').value});hideLoading();if(r.success){ssClearDraft('event-title');closeModal();showToast('일정이 추가되었습니다','success');renderCalendar();}else showToast(r.error,'error');}

/* ================================================================
   파트별(역할별) 진행률
   - 각 멤버가 자기 파트(기획/디자인/프론트엔드/백엔드/QA)를 고르고,
     진행률(%)을 직접 조절한다. 100%면 '완료'.
   - 파트 진행률 = 그 파트 멤버들의 진행률 평균, 전체 진행률 = 멤버가 있는 파트들의 평균.
   - 저장: memberProgress/{projectId_uid} (본인 것만 수정 가능)
   ================================================================ */
var TASK_ROLES=[
  {key:'planning', label:'기획',       color:'#f59e0b'},
  {key:'design',   label:'디자인',     color:'#ec4899'},
  {key:'frontend', label:'프론트엔드', color:'#3b82f6'},
  {key:'backend',  label:'백엔드',     color:'#10b981'},
  {key:'qa',       label:'QA',         color:'#8b5cf6'}
];
var PART_COLORS=['#f59e0b','#ec4899','#3b82f6','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#6366f1','#64748b'];
var MAX_PARTS=12;
var newPartColor=PART_COLORS[0];
// 프로젝트에 직접 정의한 파트(project.parts)가 있으면 그것을, 없으면 기본 5개 파트를 쓴다.
// 빈 배열도 '모두 삭제한 상태'로 존중한다(필드가 아예 없을 때만 기본값).
// 파트 추가/삭제는 프로젝트 오너(관리자)만 할 수 있다
function canManageParts(){ return !!(currentProject && getMyRole(currentProject)==='owner'); }
function getProjectParts(){
  return (currentProject && Array.isArray(currentProject.parts)) ? currentProject.parts : TASK_ROLES;
}
function roleOptionsHtml(selected,noneLabel,parts){
  return '<option value="">'+(noneLabel||'역할 선택')+'</option>'
    +(parts||getProjectParts()).map(r=>'<option value="'+r.key+'" '+(r.key===selected?'selected':'')+'>'+r.label+'</option>').join('');
}
// members: ssGetProjectMembers 결과, items: ssGetMemberProgress 결과
// (프로젝트에서 나간 멤버의 예전 기록은 members에 없으므로 자동으로 제외된다)
function calcRoleProgress(members,items,parts){
  var byUid={}; (items||[]).forEach(function(i){ byUid[i.uid]=i; });
  var roles=(parts||getProjectParts()).map(function(r){ return {key:r.key,label:r.label,color:r.color,members:[],percent:0,doneCount:0,total:0}; });
  var unassigned=[];
  (members||[]).forEach(function(m){
    var p=byUid[m.uid]; var role=p&&roles.find(r=>r.key===p.role);
    if(!role){ unassigned.push(m); return; }
    var pct=Math.max(0,Math.min(100,Math.round(p.percent||0)));
    role.members.push({uid:m.uid,name:m.name||'멤버',avatar:m.avatar,percent:pct});
  });
  roles.forEach(function(r){
    r.total=r.members.length;
    r.doneCount=r.members.filter(m=>m.percent>=100).length;
    r.percent=r.total?Math.round(r.members.reduce((a,m)=>a+m.percent,0)/r.total):0;
  });
  var active=roles.filter(r=>r.total>0);
  var overall=active.length?Math.round(active.reduce((a,r)=>a+r.percent,0)/active.length):0;
  return {roles:roles,unassigned:unassigned,overall:overall,activeCount:active.length};
}
function myProgressOf(items){ return (items||[]).find(i=>i.uid===currentUser.uid)||null; }

async function renderRoles(){
  if(!currentProjectId){ setContent(pageHeader(t('roles'))+noProjectState()); return; }
  setContent(pageHeader(t('roles'))+skeletonGrid(4,'md:grid-cols-2'));
  var membersR=await ssGetProjectMembers(currentProjectId);
  var progR=await ssGetMemberProgress(currentProjectId);
  var members=membersR.members||[]; var items=progR.items||[];
  var parts=getProjectParts();
  var calc=calcRoleProgress(members,items,parts);
  var mine=myProgressOf(items);
  var myRoleKey=mine&&parts.some(r=>r.key===mine.role)?mine.role:'';
  var myPct=mine?Math.max(0,Math.min(100,Math.round(mine.percent||0))):0;
  var myRole=parts.find(r=>r.key===myRoleKey);
  var myColor=myRole?myRole.color:'var(--primary)';

  var R=54, C=2*Math.PI*R;
  var hero='<div class="rounded-2xl p-6 md:p-7 flex items-center gap-6 flex-wrap" style="background:linear-gradient(135deg,var(--primary),#7c3aed);color:#fff">'
    +'<div class="relative shrink-0" style="width:128px;height:128px">'
      +'<svg viewBox="0 0 132 132" style="width:100%;height:100%;transform:rotate(-90deg)" aria-hidden="true">'
        +'<circle cx="66" cy="66" r="'+R+'" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="12"/>'
        +'<circle class="role-ring" cx="66" cy="66" r="'+R+'" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C+'" data-target="'+(C*(1-calc.overall/100))+'" style="transition:stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)"/>'
      +'</svg>'
      +'<div class="absolute inset-0 flex items-center justify-center font-extrabold" style="font-size:30px">'+calc.overall+'<span style="font-size:15px;margin-left:1px;opacity:.9">%</span></div>'
    +'</div>'
    +'<div class="flex-1" style="min-width:200px">'
      +'<div style="font-size:13px;opacity:.85;font-weight:600">전체 프로젝트 진행률</div>'
      +'<div style="font-size:22px;font-weight:800;margin:2px 0 12px">'+escHtml(currentProject?currentProject.name:'')+'</div>'
      +'<div class="flex gap-6 flex-wrap">'
        +'<div><div style="font-size:12px;opacity:.8">참여 파트</div><b style="font-size:18px">'+calc.activeCount+' / '+parts.length+'</b></div>'
        +'<div><div style="font-size:12px;opacity:.8">진행률 입력한 멤버</div><b style="font-size:18px">'+(members.length-calc.unassigned.length)+' / '+members.length+'명</b></div>'
        +'<div><div style="font-size:12px;opacity:.8">계산 방식</div><b style="font-size:18px">파트별 평균</b></div>'
      +'</div>'
    +'</div>'
  +'</div>';

  // 내 파트 / 내 진행률 조절
  var mineCard='<div class="card card-pad">'
    +'<div class="flex items-center justify-between mb-1"><h3 class="text-section-title">내 진행률</h3>'
      +'<div class="flex items-center gap-2">'
        +(myPct>=100&&myRoleKey?'<span class="badge-success">'+icon('check','w-3 h-3')+'완료</span>':'')
        +(!canManageParts()?'':'<button onclick="showManagePartsModal()" class="btn-secondary btn-sm">'+icon('settings-2','w-3.5 h-3.5')+'파트 추가·삭제</button>')
      +'</div></div>'
    +'<p class="text-meta mb-4">내가 맡은 파트를 고르고, 진행된 만큼 직접 조절하세요. 팀원 모두에게 보여요.</p>'
    +'<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">'
      +'<div><label class="field-label">내 파트</label><select id="my-role" class="input" onchange="doSaveMyProgress()">'+roleOptionsHtml(myRoleKey,'파트를 선택하세요')+'</select></div>'
      +'<div class="md:col-span-2"><div class="flex items-center justify-between mb-1.5"><label class="field-label" style="margin:0">진행률</label>'
        +'<b id="my-pct-label" class="text-[18px]" style="color:'+myColor+'">'+myPct+'%</b></div>'
        +'<input type="range" id="my-pct" min="0" max="100" step="5" value="'+myPct+'" class="w-full" style="accent-color:'+myColor+'" oninput="document.getElementById(\'my-pct-label\').textContent=this.value+\'%\'" onchange="doSaveMyProgress()" aria-label="내 진행률">'
      +'</div>'
    +'</div>'
    +'<div class="flex items-center gap-2 mt-4 flex-wrap">'
      +'<button onclick="doSetMyProgressQuick(100)" class="btn-primary">'+icon('check-circle-2','w-4 h-4')+'완료로 표시</button>'
      +(myPct>0?'<button onclick="doSetMyProgressQuick(0)" class="btn-secondary">처음부터 다시</button>':'')
    +'</div>'
  +'</div>';

  // 오너 전용: 팀원에게 파트 지정
  var isOwnerMe=(typeof getMyRole==='function' && currentProject && getMyRole(currentProject)==='owner');
  var byUidItems={}; items.forEach(function(i){ byUidItems[i.uid]=i; });
  var assignCard=(isOwnerMe && members.length)
    ? '<div class="card card-pad">'
      +'<div class="flex items-center gap-2 mb-1"><h3 class="text-section-title">팀원 파트 지정</h3><span class="badge-primary">'+icon('crown','w-3 h-3')+'오너 전용</span></div>'
      +'<p class="text-meta mb-4">팀원에게 파트를 정해주세요. 지정하면 해당 팀원에게 알림이 가고, 진행률은 본인이 직접 입력해요.</p>'
      +'<div class="space-y-2">'+members.map(function(m){
        var cur=byUidItems[m.uid]; var curRole=cur&&parts.some(p=>p.key===cur.role)?cur.role:'';
        return '<div class="flex items-center justify-between gap-3 p-2.5 rounded-xl surface-2">'
          +'<div class="min-w-0 flex items-center gap-2.5">'+avatarCircle(m.avatar,'w-7 h-7 text-sm shrink-0')
            +'<span class="text-body font-semibold truncate" style="color:var(--text)">'+escHtml(m.name||'멤버')+(m.uid===currentUser.uid?' <span class="text-meta font-normal">(나)</span>':'')+'</span></div>'
          +'<select class="input shrink-0" style="width:150px;height:34px;padding:0 8px" onchange="doAssignMemberRole(\''+m.uid+'\',this.value)" aria-label="'+escHtml(m.name||'멤버')+' 파트 지정"'+(parts.length?'':' disabled')+'>'+roleOptionsHtml(curRole,'파트 없음',parts)+'</select>'
        +'</div>';
      }).join('')+'</div>'
      +(parts.length?'':'<p class="text-meta mt-3">먼저 "파트 추가·삭제"에서 파트를 만들어주세요.</p>')
    +'</div>'
    : '';

  // 파트별 카드 + 소속 멤버
  var cards=!parts.length
    ? '<div class="card card-pad">'+emptyState('layers','파트가 없어요',canManageParts()?'"파트 추가·삭제"에서 우리 팀에 맞는 파트를 만들어보세요.':'오너(관리자)가 파트를 만들면 여기에 표시돼요.',!canManageParts()?'':'<button onclick="showManagePartsModal()" class="btn-primary">'+icon('plus','w-4 h-4')+'파트 추가</button>')+'</div>'
    : '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'+calc.roles.map(function(r){
    var memberRows=r.members.length
      ? '<div class="mt-4 space-y-2.5 pt-3" style="border-top:1px solid var(--border)">'+r.members.map(function(m){
          return '<div class="flex items-center gap-2.5">'
            +avatarCircle(m.avatar,'w-6 h-6 text-xs shrink-0')
            +'<span class="text-body truncate" style="width:84px;color:var(--text)">'+escHtml(m.name)+(m.uid===currentUser.uid?' <span class="text-meta">(나)</span>':'')+'</span>'
            +'<div class="flex-1 progress-track h-1.5"><div class="progress-fill role-bar" data-width="'+m.percent+'" style="width:0;background:'+r.color+'"></div></div>'
            +'<span class="text-meta shrink-0" style="width:52px;text-align:right">'+(m.percent>=100?'<b style="color:var(--success)">완료</b>':m.percent+'%')+'</span>'
          +'</div>';
        }).join('')+'</div>'
      : '<p class="text-meta mt-4 pt-3" style="border-top:1px solid var(--border)">아직 이 파트를 맡은 멤버가 없어요.</p>';
    return '<div class="card card-pad">'
      +'<div class="flex items-center justify-between mb-4">'
        +'<div class="flex items-center gap-2.5 font-bold text-[15px]" style="color:var(--text)"><span style="width:10px;height:10px;border-radius:50%;background:'+r.color+'"></span>'+r.label+'</div>'
        +'<div class="text-[21px] font-extrabold" style="color:'+(r.total?r.color:'var(--text-3)')+'">'+r.percent+'%</div>'
      +'</div>'
      +'<div role="progressbar" aria-label="'+r.label+' 진행률" aria-valuenow="'+r.percent+'" aria-valuemin="0" aria-valuemax="100" style="height:10px;border-radius:999px;background:var(--surface-2);overflow:hidden">'
        +'<i class="role-bar" data-width="'+r.percent+'" style="display:block;height:100%;width:0;border-radius:999px;background:'+r.color+';transition:width 1s cubic-bezier(.22,1,.36,1)"></i>'
      +'</div>'
      +'<div class="flex justify-between mt-3 text-meta">'
        +'<span>완료 <b style="color:var(--text)">'+r.doneCount+'</b> / 전체 <b style="color:var(--text)">'+r.total+'</b>명</span>'
        +'<span>'+(r.total?(r.total-r.doneCount)+'명 진행 중':'담당자 없음')+'</span>'
      +'</div>'
      +memberRows
    +'</div>';
  }).join('')+'</div>';

  var unassignedHtml=calc.unassigned.length
    ? '<div class="card card-pad"><h3 class="text-section-title mb-1">아직 파트를 고르지 않은 멤버</h3>'
      +'<p class="text-meta mb-3">본인이 위의 "내 진행률"에서 파트를 선택하면 반영돼요.</p>'
      +'<div class="flex flex-wrap gap-2">'+calc.unassigned.map(m=>'<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full surface-2 text-body">'+avatarCircle(m.avatar,'w-5 h-5 text-[11px]')+escHtml(m.name||'멤버')+'</span>').join('')+'</div></div>'
    : '';

  setContent(projectTabBar('roles')+pageHeader(t('roles'),'각자 맡은 파트의 진행 상황을 직접 기록하고 한눈에 확인하세요')
    +'<div class="px-6 pb-8 space-y-4">'+hero+mineCard+assignCard+cards+unassignedHtml+'</div>');

  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.querySelectorAll('.role-bar').forEach(function(el){ el.style.width=el.getAttribute('data-width')+'%'; });
    document.querySelectorAll('.role-ring').forEach(function(el){ el.style.strokeDashoffset=el.getAttribute('data-target'); });
  }); });
}
/* ---- 파트 추가 / 삭제 (project.parts 에 저장, 편집자 이상) ---- */
function showManagePartsModal(){
  if(!canManageParts()){ showToast('파트 추가·삭제는 오너(관리자)만 할 수 있어요','error'); return; }
  var parts=getProjectParts();
  var list=parts.length
    ? '<div class="space-y-2">'+parts.map(function(p){
        return '<div class="flex items-center justify-between gap-3 p-2.5 rounded-xl surface-2">'
          +'<span class="flex items-center gap-2.5 text-body font-semibold" style="color:var(--text)"><span style="width:10px;height:10px;border-radius:50%;background:'+escHtml(p.color)+'"></span>'+escHtml(p.label)+'</span>'
          +'<button onclick="doDeletePart(\''+p.key+'\')" class="icon-btn" title="파트 삭제" aria-label="'+escHtml(p.label)+' 파트 삭제">'+icon('trash-2','w-4 h-4')+'</button>'
        +'</div>';
      }).join('')+'</div>'
    : '<p class="text-meta">파트가 없어요. 아래에서 추가해보세요.</p>';
  newPartColor=PART_COLORS[parts.length%PART_COLORS.length];
  var swatches=PART_COLORS.map(function(c){
    return '<button type="button" onclick="selectNewPartColor(\''+c+'\')" data-part-color="'+c+'" aria-label="색상 선택" style="width:26px;height:26px;border-radius:50%;background:'+c+';border:2px solid '+(c===newPartColor?'var(--text)':'transparent')+'"></button>';
  }).join('');
  showModal(modalWrap('파트 추가·삭제',
    '<div class="space-y-5">'
      +'<div><div class="text-meta mb-2">현재 파트 ('+parts.length+'/'+MAX_PARTS+')</div>'+list+'</div>'
      +'<div style="border-top:1px solid var(--border)" class="pt-4"><label class="field-label">새 파트 추가</label>'
        +'<input type="text" id="new-part-name" maxlength="12" placeholder="예: 발표, 데이터, 문서" class="input mb-3" onkeydown="if(event.key===\'Enter\')doAddPart()">'
        +'<div class="flex items-center gap-2 flex-wrap mb-3">'+swatches+'</div>'
        +'<button onclick="doAddPart()" class="btn-primary">'+icon('plus','w-4 h-4')+'파트 추가</button>'
      +'</div>'
      +'<p class="text-meta">파트를 삭제해도 멤버가 입력한 진행률 기록은 남아 있고, 해당 멤버는 "파트 미선택" 상태가 돼요. 모든 팀원에게 적용됩니다.</p>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">닫기</button>'
  ));
}
function selectNewPartColor(c){
  newPartColor=c;
  document.querySelectorAll('[data-part-color]').forEach(function(b){ b.style.borderColor=(b.getAttribute('data-part-color')===c)?'var(--text)':'transparent'; });
}
async function savePartsAndRefresh(newParts){
  showLoading();
  var r=await ssUpdateProject(currentProjectId,{parts:newParts});
  if(r.success){ await loadProjects(); currentProject=allProjects.find(p=>p.id===currentProjectId)||currentProject; }
  hideLoading();
  return r;
}
async function doAddPart(){
  if(!canManageParts()){ showToast('파트 추가·삭제는 오너(관리자)만 할 수 있어요','error'); return; }
  var input=document.getElementById('new-part-name'); var name=(input?input.value:'').trim();
  var parts=getProjectParts();
  if(!name){ showToast('파트 이름을 입력하세요','error'); return; }
  if(parts.length>=MAX_PARTS){ showToast('파트는 최대 '+MAX_PARTS+'개까지 만들 수 있어요','error'); return; }
  if(parts.some(p=>p.label.toLowerCase()===name.toLowerCase())){ showToast('이미 같은 이름의 파트가 있어요','error'); return; }
  var newParts=parts.concat([{key:'p'+Date.now().toString(36),label:name,color:newPartColor}]);
  var r=await savePartsAndRefresh(newParts);
  if(r.success){ showToast('파트를 추가했어요','success'); renderRoles(); showManagePartsModal(); }
  else showToast(r.error||'파트 추가에 실패했습니다','error');
}
async function doDeletePart(key){
  if(!canManageParts()){ showToast('파트 추가·삭제는 오너(관리자)만 할 수 있어요','error'); return; }
  var parts=getProjectParts(); var part=parts.find(p=>p.key===key); if(!part) return;
  if(!confirm("'"+part.label+"' 파트를 삭제할까요?\n이 파트를 맡은 멤버는 '파트 미선택' 상태가 됩니다.")) return;
  var r=await savePartsAndRefresh(parts.filter(p=>p.key!==key));
  if(r.success){ showToast('파트를 삭제했어요','success'); renderRoles(); showManagePartsModal(); }
  else showToast(r.error||'파트 삭제에 실패했습니다','error');
}
// 오너가 팀원에게 파트 지정/해제
async function doAssignMemberRole(uid,role){
  var me=getMyRole(currentProject);
  if(me!=='owner'){ showToast('오너만 팀원에게 파트를 지정할 수 있어요','error'); return; }
  var parts=getProjectParts(); var part=parts.find(p=>p.key===role);
  var r=await ssAssignMemberRole(currentProjectId,uid,role||'');
  if(!r.success){ showToast(r.error||'파트 지정에 실패했습니다','error'); renderRoles(); return; }
  showToast(role?'파트를 지정했어요':'파트를 해제했어요','success');
  if(role && part && uid!==currentUser.uid){
    ssCreateNotification(uid,{type:'part_assigned',projectId:currentProjectId,
      message:(currentUser.name||'오너')+'님이 회원님을 \''+part.label+'\' 파트로 지정했어요 ('+(currentProject?currentProject.name:'')+')'});
  }
  renderRoles();
}
// 슬라이더/파트 선택 변경 시 저장
async function doSaveMyProgress(){
  var role=document.getElementById('my-role').value;
  var pct=parseInt(document.getElementById('my-pct').value,10)||0;
  if(!role){ showToast('먼저 내 파트를 선택하세요','error'); return; }
  var r=await ssSetMyProgress(currentProjectId,{role:role,percent:pct});
  if(r.success){ showToast(pct>=100?'완료로 저장되었어요 🎉':'진행률이 저장되었어요','success'); renderRoles(); }
  else showToast(r.error||'저장에 실패했습니다','error');
}
// 완료로 표시(100) / 처음부터 다시(0) 버튼
async function doSetMyProgressQuick(pct){
  var role=document.getElementById('my-role').value;
  if(!role){ showToast('먼저 내 파트를 선택하세요','error'); return; }
  var r=await ssSetMyProgress(currentProjectId,{role:role,percent:pct});
  if(r.success){ showToast(pct>=100?'완료로 저장되었어요 🎉':'진행률을 0%로 되돌렸어요','success'); renderRoles(); }
  else showToast(r.error||'저장에 실패했습니다','error');
}

/* ================================================================
   팀
   ================================================================ */
async function renderTeam(){
  if(!currentProjectId){ setContent(pageHeader(t('team'))+noProjectState()); return; }
  setContent(pageHeader(t('team'))+skeletonGrid(3,'md:grid-cols-1'));
  var r=await ssGetProjectMembers(currentProjectId); var tasksR=await ssGetTasks(currentProjectId);
  var invitesR=await ssGetPendingInvites(currentProjectId);
  var members=r.members||[]; var tasks=tasksR.tasks||[]; var pendingInvites=invitesR.invites||[];
  var myRole=getMyRole(currentProject);
  var stats=members.map(m=>{ var mt=tasks.filter(t=>t.assigneeId===m.uid); var done=mt.filter(t=>t.status==='done').length; var role=(m.uid===currentProject.ownerId)?'owner':((currentProject.memberRoles&&currentProject.memberRoles[m.uid])||'editor'); return {...m,total:mt.length,done:done,rate:mt.length?Math.round(done/mt.length*100):0,role:role}; });

  var rows = stats.map(m=>
    '<div class="flex items-center flex-wrap gap-x-4 gap-y-2 px-4 py-3.5">'
      +avatarCircle(m.avatar,'w-10 h-10 text-xl')
      +'<div class="min-w-[7rem] flex-1"><div class="text-card-title flex items-center gap-1.5">'+escHtml(m.name)+(currentUser.uid===m.uid?'<span class="badge-neutral">나</span>':'')+'</div>'
      +'<div class="text-meta mt-0.5 truncate">'+escHtml(m.email||'')+'</div></div>'
      +'<div class="hidden sm:flex items-center gap-6 text-center">'
        +'<div><div class="text-card-title">'+m.total+'</div><div class="text-meta">작업</div></div>'
        +'<div><div class="text-card-title" style="color:var(--success)">'+m.done+'</div><div class="text-meta">완료</div></div>'
        +'<div class="w-16"><div class="progress-track h-1.5 mb-1"><div class="progress-fill" style="width:'+m.rate+'%"></div></div><div class="text-meta">'+m.rate+'%</div></div>'
      +'</div>'
      + (myRole==='owner' && m.role!=='owner'
        ? '<div class="flex items-center gap-1.5 shrink-0 ml-auto">'
          +'<select onchange="doChangeMemberRole(\''+m.uid+'\',this.value)" class="input h-8 text-[12px]" style="width:auto"><option value="editor" '+(m.role==='editor'?'selected':'')+'>편집자</option><option value="viewer" '+(m.role==='viewer'?'selected':'')+'>뷰어</option></select>'
          +'<button onclick="doTransferOwnership(\''+m.uid+'\',\''+escHtml(m.name).replace(/'/g,"\\'")+'\')" class="icon-btn w-8 h-8" title="소유자로 지정" aria-label="소유자로 지정">'+icon('crown','w-3.5 h-3.5')+'</button>'
          +'<button onclick="doRemoveMember(\''+m.uid+'\',\''+escHtml(m.name).replace(/'/g,"\\'")+'\')" class="icon-btn w-8 h-8" style="color:var(--danger)" title="프로젝트에서 내보내기" aria-label="프로젝트에서 내보내기">'+icon('user-x','w-3.5 h-3.5')+'</button>'
          +'</div>'
        : roleBadge(m.role))
    +'</div>'
  ).join('');

  var invitesHtml = (myRole!=='viewer' && pendingInvites.length)
    ? '<div class="mt-5"><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">대기 중인 초대</div><div class="card divide-hair">'
      + pendingInvites.map(inv=>
          '<div class="flex items-center gap-3 px-4 py-3">'
          +'<div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:var(--surface-2)">'+icon('mail','w-3.5 h-3.5').replace('class="','style="color:var(--text-3)" class="')+'</div>'
          +'<div class="min-w-0 flex-1"><div class="text-card-title truncate">'+escHtml(inv.invitedEmail)+'</div><div class="text-meta mt-0.5">응답 대기 중 · '+(inv.role==='viewer'?'뷰어':'편집자')+'</div></div>'
          +'<button onclick="doCancelInvite(\''+inv.id+'\')" class="btn-sm shrink-0" style="background:var(--surface-2);color:var(--danger)">취소</button>'
          +'</div>'
        ).join('')
      + '</div></div>'
    : '';

  setContent(projectTabBar('team')+pageHeader(t('team'), members.length+'명이 참여 중', myRole!=='viewer'?'<button onclick="showInviteModal()" class="btn-primary">'+icon('user-plus','w-4 h-4')+'초대</button>':'')
    +'<div class="px-6 pb-8 max-w-2xl mx-auto">'+(members.length?'<div class="card divide-hair">'+rows+'</div>':emptyState('users','아직 멤버가 없어요','이메일로 팀원을 초대해보세요.',''))+invitesHtml+'</div>');
}
async function doCancelInvite(inviteId){
  showLoading(); var r=await ssCancelInvite(inviteId); hideLoading();
  if(r.success){ showToast('초대를 취소했습니다','success'); renderTeam(); }
  else showToast(r.error||'실패했습니다','error');
}
async function doChangeMemberRole(uid,role){
  showLoading(); var r=await ssSetMemberRole(currentProjectId,uid,role); hideLoading();
  if(r.success){ showToast('권한이 변경되었습니다','success'); await loadProjects(); currentProject=allProjects.find(p=>p.id===currentProjectId); renderTeam(); }
  else showToast('실패했습니다','error');
}
async function doTransferOwnership(uid,name){
  if(!confirm('"'+name+'" 님에게 소유권을 넘기시겠습니까?\n소유권을 넘기면 나는 편집자로 바뀌고, 되돌리려면 새 소유자가 다시 넘겨줘야 해요.'))return;
  showLoading(); var r=await ssTransferOwnership(currentProjectId,uid); hideLoading();
  if(r.success){
    showToast('소유권을 넘겼습니다','success');
    ssLogActivity(currentProjectId,'ownership_transfer',(currentUser.name||'사용자')+'님이 '+name+'님에게 소유권을 넘겼습니다');
    ssCreateNotification(uid,{ type:'ownership_transferred', projectId:currentProjectId, fromUser:currentUser.uid, message:(currentProject?currentProject.name:'')+' 프로젝트의 소유자가 되었습니다' });
    await loadProjects(); currentProject=allProjects.find(p=>p.id===currentProjectId); renderTeam();
  }
  else showToast(r.error||'실패했습니다','error');
}
async function doRemoveMember(uid,name){
  if(!confirm('"'+name+'" 님을 이 프로젝트에서 내보내시겠습니까?\n작성한 작업/댓글 등은 그대로 남고, 더 이상 이 프로젝트에 접근할 수 없게 됩니다.'))return;
  showLoading(); var r=await ssRemoveMember(currentProjectId,uid); hideLoading();
  if(r.success){
    showToast('멤버를 내보냈습니다','success');
    ssLogActivity(currentProjectId,'member_remove',(currentUser.name||'사용자')+'님이 '+name+'님을 프로젝트에서 내보냈습니다');
    await loadProjects(); currentProject=allProjects.find(p=>p.id===currentProjectId); renderTeam();
  }
  else showToast(r.error||'실패했습니다','error');
}
function showInviteModal(){
  showModal(modalWrap('멤버 초대',
    '<div class="flex gap-1.5 mb-4 p-1 rounded-lg" style="background:var(--surface-2)">'
      +'<button id="invite-tab-email" onclick="switchInviteTab(\'email\')" class="flex-1 h-8 rounded-md text-[12.5px] font-semibold" style="background:var(--surface);color:var(--text)">'+icon('mail','w-3.5 h-3.5 inline mr-1 -mt-0.5')+'이메일</button>'
      +'<button id="invite-tab-qr" onclick="switchInviteTab(\'qr\')" class="flex-1 h-8 rounded-md text-[12.5px] font-semibold" style="color:var(--text-3)">'+icon('qr-code','w-3.5 h-3.5 inline mr-1 -mt-0.5')+'QR 코드</button>'
    +'</div>'
    +'<div id="invite-tab-content"></div>',
    '<div id="invite-tab-footer" class="flex gap-2 w-full"><button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doInvite()" class="btn-primary">'+icon('send','w-4 h-4')+'초대 보내기</button></div>'
  ));
  switchInviteTab('email');
}
function switchInviteTab(tab){
  var emailBtn=document.getElementById('invite-tab-email'), qrBtn=document.getElementById('invite-tab-qr');
  emailBtn.style.background = tab==='email'?'var(--surface)':'transparent';
  emailBtn.style.color = tab==='email'?'var(--text)':'var(--text-3)';
  qrBtn.style.background = tab==='qr'?'var(--surface)':'transparent';
  qrBtn.style.color = tab==='qr'?'var(--text)':'var(--text-3)';
  var content=document.getElementById('invite-tab-content');
  var footer=document.getElementById('invite-tab-footer');
  if(tab==='email'){
    content.innerHTML =
      '<div><label class="field-label">이메일 주소</label><input type="email" id="invite-email" placeholder="teammate@example.com" class="input"></div>'
      +'<div class="mt-3"><label class="field-label">권한</label><select id="invite-role" class="input"><option value="editor">편집자 — 작업/문서 작성 및 수정 가능</option><option value="viewer">뷰어 — 열람만 가능</option></select></div>'
      +'<p class="text-meta mt-2">'+icon('info','w-3 h-3 inline mr-1 -mt-0.5')+'Syncspace에 가입된 사용자만 초대할 수 있어요.</p>';
    footer.innerHTML='<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doInvite()" class="btn-primary">'+icon('send','w-4 h-4')+'초대 보내기</button>';
  } else {
    footer.innerHTML='<button onclick="closeModal()" class="btn-secondary w-full">닫기</button>';
    renderInviteQR();
  }
}
async function renderInviteQR(){
  var content=document.getElementById('invite-tab-content');
  content.innerHTML='<div class="py-8 flex justify-center">'+icon('loader-circle','w-5 h-5 animate-spin').replace('class="','style="color:var(--text-3)" class="')+'</div>';
  refreshIcons();
  var proj=allProjects.find(p=>p.id===currentProjectId);
  if(proj.joinEnabled && proj.joinToken){
    var url=location.origin+location.pathname+'?join='+currentProjectId+':'+proj.joinToken;
    content.innerHTML =
      '<div class="flex flex-col items-center">'
        +'<div id="qr-canvas" class="p-3 rounded-xl mb-3" style="background:#fff"></div>'
        +'<p class="text-meta mb-3 text-center">QR을 스캔하면 로그인 후 자동으로<br>이 프로젝트에 <b>'+(proj.joinRole==='viewer'?'뷰어':'편집자')+'</b> 권한으로 참여합니다</p>'
        +'<div class="flex gap-2 w-full mb-2"><input type="text" readonly value="'+url+'" class="input flex-1 text-[11px]" onclick="this.select()"><button onclick="navigator.clipboard.writeText(\''+url+'\');showToast(\'복사되었습니다\',\'success\')" class="btn-secondary btn-sm" title="링크 복사" aria-label="링크 복사">'+icon('copy','w-3.5 h-3.5')+'</button></div>'
        +'<button onclick="doDisableJoinLink()" class="btn-danger w-full">'+icon('link-2-off','w-4 h-4')+'참여 링크 끄기</button>'
      +'</div>';
    refreshIcons();
    new QRCode(document.getElementById('qr-canvas'), {text:url, width:176, height:176, colorDark:'#101828', colorLight:'#ffffff'});
  } else {
    content.innerHTML =
      '<p class="text-body mb-3">QR 코드를 스캔해서 참여할 수 있는 링크를 만들어요.</p>'
      +'<div class="mb-3"><label class="field-label">참여 시 부여할 권한</label><select id="join-role" class="input"><option value="editor">편집자</option><option value="viewer">뷰어</option></select></div>'
      +'<button onclick="doEnableJoinLink()" class="btn-primary w-full">'+icon('qr-code','w-4 h-4')+'참여 QR 만들기</button>'
      +'<p class="text-meta mt-3">'+icon('info','w-3 h-3 inline mr-1 -mt-0.5')+'Firestore 보안 규칙이 쓰기를 허용하는 경우에만 실제로 참여됩니다.</p>';
  }
}
async function doEnableJoinLink(){
  var role=document.getElementById('join-role').value;
  var token=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
  showLoading(); var r=await ssEnableJoin(currentProjectId,token,role); hideLoading();
  if(r.success){ await loadProjects(); renderInviteQR(); } else showToast('실패했습니다','error');
}
async function doDisableJoinLink(){
  showLoading(); var r=await ssDisableJoin(currentProjectId); hideLoading();
  if(r.success){ await loadProjects(); renderInviteQR(); showToast('참여 링크가 꺼졌습니다','success'); } else showToast('실패했습니다','error');
}
async function doInvite(){var email=document.getElementById('invite-email').value.trim();var role=document.getElementById('invite-role')?document.getElementById('invite-role').value:'editor';ssClearFieldError('invite-email');if(!email){ssFieldError('invite-email','초대할 이메일을 입력해 주세요');document.getElementById('invite-email').focus();return;}if(!ssIsEmail(email)){ssFieldError('invite-email','이메일 형식이 올바르지 않습니다');return;}showLoading();var r=await ssInviteMember(currentProjectId,email,role);hideLoading();if(r.success){closeModal();showToast('초대를 보냈습니다. 상대가 수락하면 참여해요','success');localStorage.setItem('syncspace-onb-invite','1');renderTeam();}else showToast(r.error,'error');}

/* ================================================================
   채팅
   ================================================================ */

/* ---- 팀 채팅 실시간 수신 ----
   채팅 화면이 열려 있는 동안만 Firestore 구독을 유지하고, 새 메시지/삭제가 생기면
   입력창은 그대로 둔 채(작성 중인 글 보존) 메시지 목록만 갈아끼운다. */
var chatUnsubscribe=null;
function stopChatListener(){
  if(chatUnsubscribe){ try{ chatUnsubscribe(); }catch(e){} }
  chatUnsubscribe=null;
}
function startChatListener(projectId){
  stopChatListener();
  try{
    chatUnsubscribe=db.collection('projects').doc(projectId).collection('chat')
      .orderBy('createdAt','desc').limit(50)
      .onSnapshot(function(snap){
        if(currentView!=='chat' || currentProjectId!==projectId) return;
        var box=document.getElementById('chat-messages'); if(!box) return;
        var messages=[];
        snap.forEach(function(doc){ var d=doc.data(); messages.push({id:doc.id,...d,createdAt:d.createdAt?d.createdAt.toDate():null}); });
        messages.reverse();
        // 이미 맨 아래 근처를 보고 있을 때만 새 메시지로 자동 스크롤(위쪽 대화를 읽는 중이면 위치 유지)
        var nearBottom=(box.scrollHeight-box.scrollTop-box.clientHeight)<80;
        var prevTop=box.scrollTop;
        box.innerHTML=chatMessagesHtml(messages,getMyRole(currentProject));
        box.scrollTop=nearBottom?box.scrollHeight:prevTop;
        refreshIcons();
      },function(err){ console.error('채팅 실시간 수신 실패:', err); stopChatListener(); });
  }catch(e){ console.error('채팅 실시간 수신 실패:', e); }
}
function chatMessagesHtml(messages,myRole){
  return messages.length ? messages.map(m=>{
    var isMe=m.authorId===currentUser.uid;
    var canDelete=isMe||myRole==='owner';
    return '<div class="flex gap-2.5 '+(isMe?'flex-row-reverse':'')+' mb-3">'
      + avatarCircle(m.authorAvatar,'w-8 h-8 text-base shrink-0')
      + '<div class="'+(isMe?'items-end':'items-start')+' flex flex-col max-w-[75%]">'
        + '<span class="text-meta mb-1">'+escHtml(m.authorName)+'</span>'
        + '<div class="px-3.5 py-2 rounded-2xl text-[13.5px]" style="'+(isMe?'background:var(--primary);color:#fff;border-bottom-right-radius:4px':'background:var(--surface-2);color:var(--text);border-bottom-left-radius:4px')+'">'+escHtml(m.content)+'</div>'
        + '<div class="flex items-center gap-2 mt-1">'
          + '<span class="text-meta">'+relDate(m.createdAt)+'</span>'
          + (canDelete? '<button onclick="doDeleteChatMessage(\''+m.id+'\')" class="text-meta" style="color:var(--danger);background:none;border:none;cursor:pointer;padding:0" title="삭제">삭제</button>':'')
        +'</div>'
      +'</div></div>';
  }).join('') : emptyState('message-square','아직 메시지가 없어요','첫 메시지를 보내 대화를 시작해보세요.','');
}
async function renderChat(){
  if(!currentProjectId){ setContent(pageHeader(t('chat'))+noProjectState()); return; }
  setContent(pageHeader(t('chat')));
  var messagesR=await ssGetChatMessages(currentProjectId); var messages=messagesR.messages||[];
  var myRole=getMyRole(currentProject);
  var msgHtml=chatMessagesHtml(messages,myRole);

  setContent('<div class="chat-shell flex flex-col">'
    + projectTabBar('chat')
    + pageHeader(t('chat'))
    + '<div class="flex-1 overflow-y-auto px-6" id="chat-messages">'+msgHtml+'</div>'
    + '<div class="px-6 py-4 mt-2" style="border-top:1px solid var(--border)"><div class="flex gap-2">'
      + '<input type="text" id="chat-input" placeholder="메시지를 입력하세요... (@이름으로 멘션)" class="input flex-1" onkeypress="if(event.key===\'Enter\'&&!mentionIsActive())doSendChatMessage()">'
      + '<button onclick="doSendChatMessage()" class="btn-primary">'+icon('send','w-4 h-4')+'전송</button>'
    + '</div></div></div>');
  var c=document.getElementById('chat-messages'); if(c)c.scrollTop=c.scrollHeight;
  attachMentionAutocomplete('chat-input');
  startChatListener(currentProjectId);
}
async function doSendChatMessage(){
  var input=document.getElementById('chat-input');var content=input.value.trim();if(!content)return;input.value='';ssClearDraft('chat-input');
  var r=await ssSendChatMessage(currentProjectId,content);
  if(r.success){
    if(!chatUnsubscribe) renderChat();   // 실시간 수신이 꺼져 있을 때만 수동 갱신
    var mR=await ssGetProjectMembers(currentProjectId);
    ssNotifyMentions(content, mR.members||[], {projectId:currentProjectId});
    // 팀원들에게 '새 채팅' 알림 (이미 @멘션 알림을 받는 사람은 중복해서 보내지 않는다)
    (mR.members||[]).forEach(function(m){
      if(m.uid===currentUser.uid) return;
      if(m.name && content.indexOf('@'+m.name)!==-1) return;
      ssCreateNotification(m.uid,{type:'chat_message',projectId:currentProjectId,fromUser:currentUser.uid,
        message:'['+(currentProject?currentProject.name:'프로젝트')+'] '+(currentUser.name||'팀원')+': '+content.substring(0,60)});
    });
  }
}
async function doDeleteChatMessage(messageId){
  if(!confirm('메시지를 삭제하시겠습니까?'))return;
  var r=await ssDeleteChatMessage(currentProjectId,messageId);
  if(r.success){ if(!chatUnsubscribe) renderChat(); }
  else showToast('삭제에 실패했습니다','error');
}

/* ================================================================
   알림
   ================================================================ */
async function renderNotifications(){
  setContent(pageHeader(t('notifications'))+skeletonGrid(3,'md:grid-cols-1'));
  var r=await ssGetNotifications(); var notifs=(r.notifications||[]).filter(n=>notifTypeAllowed(n.type));
  var hasUnread=notifs.some(n=>!n.read);
  var list = notifs.length ? '<div class="card divide-hair">'+notifs.map(n=>
    '<div class="flex items-start gap-3 px-4 py-3.5" style="'+(!n.read?'':'opacity:.6')+'">'
      +'<div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 icon-tile-soft">'+icon(notifMeta(n.type).icon,'w-4 h-4').replace('class="','style="color:var(--primary-soft-text)" class="')+'</div>'
      +'<div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-2"><span class="text-card-title">'+notifMeta(n.type).label+'</span><span class="flex items-center gap-1 shrink-0"><span class="text-meta">'+relDate(n.createdAt)+'</span>'+(ssNotifDeletable(n)?'<button onclick="doDeleteNotification(\''+n.id+'\','+(!n.read)+')" class="icon-btn" style="width:28px;height:28px" title="알림 삭제" aria-label="알림 삭제">'+icon('x','w-3.5 h-3.5')+'</button>':'')+'</span></div>'
      +'<p class="text-body mt-0.5">'+escHtml(n.taskTitle||n.message||'새로운 알림')+'</p>'
      + (n.type==='project_invite'
        ? (n.resolution
            ? '<div class="text-meta mt-1.5">'+(n.resolution==='accepted'?'수락함':n.resolution==='declined'?'거절함':'취소된 초대')+'</div>'
            : '<div class="flex gap-2 mt-1.5"><button onclick="doAcceptInvite(\''+n.id+'\',\''+n.inviteId+'\')" class="btn-sm btn-primary">'+icon('check','w-3.5 h-3.5')+'수락</button><button onclick="doDeclineInvite(\''+n.id+'\',\''+n.inviteId+'\')" class="btn-sm" style="background:var(--surface-2);color:var(--text-2)">거절</button></div>')
        : (!n.read? '<button onclick="doMarkRead(\''+n.id+'\')" class="text-[12px] font-semibold mt-1.5" style="color:var(--primary)">읽음으로 표시</button>':''))
      +'</div>'
      +(!n.read?'<div class="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style="background:var(--primary)"></div>':'')
    +'</div>'
  ).join('')+'</div>' : emptyState('bell-off','알림이 없어요','새로운 소식이 있으면 여기에 표시됩니다.','');

  setContent(pageHeader(t('notifications'),null,
      '<button onclick="showWeeklyDigest()" class="btn-secondary" title="주간 요약">'+icon('mail','w-4 h-4')+'주간 요약</button>'
      +(notifs.some(ssNotifDeletable)? '<button onclick="doDeleteNotifications(\'read\')" class="btn-ghost" title="읽은 알림 모두 삭제">'+icon('trash-2','w-4 h-4')+'읽은 알림 삭제</button>':'')
      +(hasUnread? '<button onclick="doMarkAllRead()" class="btn-ghost">'+icon('check-check','w-4 h-4')+'모두 읽음</button>':'')
      +'<button onclick="showView(\'profile\')" class="btn-ghost" title="알림 설정">'+icon('settings','w-4 h-4')+'</button>')
    +'<div class="px-6 pb-8 max-w-2xl mx-auto">'+list+'</div>');
}
/* 알림 삭제: 아직 수락/거절하지 않은 초대 알림은 지울 수 없다(초대를 잃지 않도록) */
function ssNotifDeletable(n){ return !(n.type==='project_invite' && !n.resolution); }
async function doDeleteNotification(id,wasUnread){
  var r=await ssDeleteNotifications([id]);
  if(!r.success){ showToast(r.error||'알림을 삭제하지 못했습니다','error'); return; }
  if(wasUnread){ notificationCount=Math.max(0,notificationCount-1); updateNotificationBadge(); }
  showToast('알림을 삭제했어요','success'); renderNotifications();
}
async function doDeleteNotifications(mode){
  var r0=await ssGetNotifications(); var all=(r0.notifications||[]).filter(n=>notifTypeAllowed(n.type)&&ssNotifDeletable(n));
  var targets=mode==='read'?all.filter(n=>n.read):all;
  if(!targets.length){ showToast('삭제할 읽은 알림이 없어요','info'); return; }
  if(!confirm('읽은 알림 '+targets.length+'개를 삭제할까요? 안 읽은 알림과 답하지 않은 초대는 남아요.')) return;
  showLoading(); var r=await ssDeleteNotifications(targets.map(n=>n.id)); hideLoading();
  if(!r.success){ showToast(r.error||'알림을 삭제하지 못했습니다','error'); return; }
  showToast(targets.length+'개의 알림을 삭제했어요','success'); renderNotifications();
}
async function doMarkRead(notificationId){var r=await ssMarkNotificationRead(notificationId);if(r.success){notificationCount=Math.max(0,notificationCount-1);updateNotificationBadge();refreshNotificationViews();}}
async function doMarkAllRead(){var r=await ssGetNotifications();var notifs=(r.notifications||[]).filter(n=>!n.read);for(var i=0;i<notifs.length;i++){await ssMarkNotificationRead(notifs[i].id);}notificationCount=0;updateNotificationBadge();refreshNotificationViews();showToast('모두 읽음으로 표시했습니다','success');}
// 홈 화면 알림 카드에서 알림을 눌렀을 때: 읽음 처리하고 관련 작업이 있으면 바로 연다
async function doOpenNotification(notifId,taskId,projectId,wasUnread,type){
  if(wasUnread){ var r=await ssMarkNotificationRead(notifId); if(r.success){ notificationCount=Math.max(0,notificationCount-1); updateNotificationBadge(); } }
  if(type==='chat_message'){
    closeTabbarPopover();
    if(projectId && projectId!==currentProjectId && allProjects.some(p=>p.id===projectId)){ await selectProject(projectId); }
    showView('chat');
    return;
  }
  if(taskId){
    closeTabbarPopover();
    if(projectId && projectId!==currentProjectId && allProjects.some(p=>p.id===projectId)){ selectProject(projectId); setTimeout(()=>showTaskDetail(taskId),150); }
    else showTaskDetail(taskId);
  } else if(wasUnread) refreshNotificationViews();
}
async function doAcceptInvite(notifId,inviteId){
  showLoading(); var r=await ssAcceptInvite(inviteId); hideLoading();
  if(r.success){
    showToast('"'+(r.projectName||'프로젝트')+'"에 참여했습니다','success');
    await ssUpdateNotification(notifId,{read:true,resolution:'accepted'});
    notificationCount=Math.max(0,notificationCount-1); updateNotificationBadge();
    await loadProjects(); refreshNotificationViews();
  } else showToast(r.error||'실패했습니다','error');
}
async function doDeclineInvite(notifId,inviteId){
  showLoading(); var r=await ssDeclineInvite(inviteId); hideLoading();
  if(r.success){
    showToast('초대를 거절했습니다','success');
    await ssUpdateNotification(notifId,{read:true,resolution:'declined'});
    notificationCount=Math.max(0,notificationCount-1); updateNotificationBadge();
    refreshNotificationViews();
  } else showToast(r.error||'실패했습니다','error');
}

/* ================================================================
   프로필 설정 — 개인화 환경설정 (localStorage, 사용자별로 분리)
   ================================================================ */
function profPref(key){ return 'syncspace-'+key+'-'+(currentUser?currentUser.uid:'anon'); }

// #7 기본 시작 화면
function getStartView(){ return localStorage.getItem(profPref('startview')) || 'dashboard'; }
function setStartView(v){ localStorage.setItem(profPref('startview'), v); }
function applyStartView(){
  var pref=getStartView();
  if(pref==='mytasks'){ showView('mytasks'); return; }
  if(pref==='lastproject'){
    var recents=getRecents().filter(r=>r.type==='project');
    var p=recents.length? allProjects.find(x=>x.id===recents[0].id) : null;
    if(p){ currentProjectId=p.id; currentProject=p; updateProjectChrome(); showView(getDefaultProjectView()); return; }
  }
  showView('dashboard');
}

// #8 프로젝트를 열 때 기본으로 보여줄 화면
function getDefaultProjectView(){ var v=localStorage.getItem(profPref('defaultprojectview')) || 'kanban'; return v==='todos'?'kanban':v; }
function setDefaultProjectView(v){ localStorage.setItem(profPref('defaultprojectview'), v); }

// #6 알림 일시 정지 (Do Not Disturb)
function getDndUntil(){ var v=localStorage.getItem(profPref('dnduntil')); return v?parseInt(v,10):0; }
function isDndActive(){ return getDndUntil()>Date.now(); }
function setDnd(ms){
  if(ms) localStorage.setItem(profPref('dnduntil'), String(Date.now()+ms));
  else localStorage.removeItem(profPref('dnduntil'));
  renderProfile(); loadNotifications();
}

// #5 주간 요약 자동 표시 빈도
function getDigestAutoPref(){ return localStorage.getItem(profPref('digestauto')) || 'off'; }
function setDigestAutoPref(v){ localStorage.setItem(profPref('digestauto'), v); renderProfile(); }
function maybeAutoShowDigest(){
  var pref=getDigestAutoPref(); if(pref==='off') return;
  var lastKey=profPref('digestlast');
  var last=localStorage.getItem(lastKey);
  var now=new Date();
  var shouldShow=false;
  if(pref==='daily'){ shouldShow = !last || last!==now.toDateString(); }
  else if(pref==='weekly'){ shouldShow = !last || (now-new Date(last))/86400000>=7; }
  if(shouldShow){ localStorage.setItem(lastKey, pref==='daily'?now.toDateString():now.toISOString()); showWeeklyDigest(); }
}

// #11 소속 프로젝트 나가기
async function doLeaveProject(projectId,name){
  if(!confirm('"'+name+'" 프로젝트에서 나가시겠습니까?'))return;
  showLoading();
  var r=await ssLeaveProject(projectId);
  hideLoading();
  if(r.success){
    showToast('프로젝트에서 나갔습니다','success');
    if(currentProjectId===projectId){ currentProjectId=null; currentProject=null; updateProjectChrome(); }
    await loadProjects();
    renderProfile();
  } else showToast(r.error||'실패했습니다','error');
}

/* ================================================================
   프로필
   ================================================================ */
async function renderProfile(){
  setContent(pageHeader(t('profile'))+'<div class="px-6 pb-8 max-w-lg mx-auto space-y-5">'+skeletonGrid(3,'md:grid-cols-1')+'</div>');
  if(!allProjects.length) await loadProjects();
  var joinedDate=currentUser.createdAt ? (currentUser.createdAt.toDate?currentUser.createdAt.toDate():currentUser.createdAt) : null;
  setContent(
    pageHeader(t('profile'))
    +'<div class="px-6 pb-8 max-w-lg mx-auto space-y-5">'

    +'<div><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">계정</div><div class="card card-pad">'
      +'<div class="flex items-center gap-5 mb-5">'
        +'<button onclick="showAvatarPicker()" class="w-16 h-16 shrink-0 transition hover:opacity-80" title="아바타 변경">'+avatarCircle(currentUser.avatar,'w-16 h-16 text-3xl')+'</button>'
        +'<div class="flex-1 min-w-0"><label class="field-label">이름</label><input type="text" id="profile-name" value="'+escHtml(currentUser.name||'')+'" class="input" onkeydown="if(event.key===\'Enter\'&&!event.isComposing)doSaveProfile()"></div>'
      +'</div>'
      +'<div class="mb-4"><label class="field-label">이메일</label><div class="text-body" style="color:var(--text-2)">'+escHtml(currentUser.email||'')+'</div>'
        +(joinedDate?'<div class="text-meta mt-1">가입일 · '+fmtDate(joinedDate)+'</div>':'')
      +'</div>'
      +'<button onclick="doSaveProfile()" class="btn-primary w-full mb-2">'+icon('check','w-4 h-4')+'변경사항 저장</button>'
      +'<button onclick="showChangePasswordModal()" class="btn-secondary w-full">'+icon('key-round','w-4 h-4')+'비밀번호 변경</button>'
    +'</div></div>'

    +'<div><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">화면</div><div class="card card-pad">'
      +'<button onclick="toggleLanguage()" class="w-full flex items-center justify-between py-1.5 mt-2">'
        +'<span class="flex items-center gap-2.5 text-card-title">'+icon('languages','w-4 h-4')+(currentLang==='ko'?'Switch to English':'한국어로 전환')+'</span>'
        +icon('chevron-right','w-4 h-4').replace('class="','style="color:var(--text-3)" class="')
      +'</button>'
      +'<div class="my-2" style="border-top:1px solid var(--border)"></div>'
      +'<div class="py-1"><div class="text-card-title mb-1.5">시작 화면</div>'
        +'<select onchange="setStartView(this.value)" class="input h-9">'
          +'<option value="dashboard" '+(getStartView()==='dashboard'?'selected':'')+'>대시보드</option>'
          +'<option value="lastproject" '+(getStartView()==='lastproject'?'selected':'')+'>마지막에 보던 프로젝트</option>'
          +'<option value="mytasks" '+(getStartView()==='mytasks'?'selected':'')+'>내 작업</option>'
        +'</select>'
      +'</div>'
      +'<div class="py-1 mt-1"><div class="text-card-title mb-1.5">프로젝트를 열 때 기본 화면</div>'
        +'<select onchange="setDefaultProjectView(this.value)" class="input h-9">'
          +'<option value="kanban" '+(getDefaultProjectView()==='kanban'?'selected':'')+'>할 일 목록</option>'
          +'<option value="calendar" '+(getDefaultProjectView()==='calendar'?'selected':'')+'>캘린더</option>'
          +'<option value="roles" '+(getDefaultProjectView()==='roles'?'selected':'')+'>파트별 진행률</option>'
        +'</select>'
      +'</div>'
      +'<button onclick="showShortcutsModal()" class="w-full flex items-center justify-between py-1.5 mt-2">'
        +'<span class="flex items-center gap-2.5 text-card-title">'+icon('keyboard','w-4 h-4')+'키보드 단축키</span>'
        +icon('chevron-right','w-4 h-4').replace('class="','style="color:var(--text-3)" class="')
      +'</button>'
    +'</div></div>'

    +'<div><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">알림</div><div class="card card-pad">'
      +'<button onclick="'+(notificationsEnabled()?'disableDueSoonNotifications()':'requestDueSoonNotifications()')+'" class="w-full flex items-center justify-between py-1.5">'
        +'<span class="flex items-center gap-2.5 text-card-title">'+icon('bell-ring','w-4 h-4')+'마감 임박 브라우저 알림</span>'
        +'<span class="'+(notificationsEnabled()?'badge-success':'badge-neutral')+'">'+(notificationsEnabled()?'켜짐':'꺼짐')+'</span>'
      +'</button>'
      +'<div class="py-1.5"><div class="text-card-title mb-1.5">알림 일시 정지</div>'
        +(isDndActive()? '<div class="flex items-center justify-between"><span class="badge-warning">'+new Date(getDndUntil()).toLocaleString(currentLang==='en'?'en-US':'ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'까지 정지 중</span><button onclick="setDnd(0)" class="btn-sm" style="background:var(--surface-2);color:var(--text-2);border:none;border-radius:8px">해제</button></div>'
          : '<div class="grid grid-cols-3 gap-1.5">'
            +'<button onclick="setDnd(3600000)" class="btn-sm" style="background:var(--surface-2);color:var(--text-2);border:none;border-radius:8px">1시간</button>'
            +'<button onclick="setDnd(28800000)" class="btn-sm" style="background:var(--surface-2);color:var(--text-2);border:none;border-radius:8px">오늘 하루</button>'
            +'<button onclick="setDnd(86400000)" class="btn-sm" style="background:var(--surface-2);color:var(--text-2);border:none;border-radius:8px">내일까지</button>'
          +'</div>')
      +'</div>'
      +'<div class="my-2" style="border-top:1px solid var(--border)"></div>'
      +'<div class="text-meta mb-1 pt-1">알림 종류</div>'
      + (function(){ var prefs=getNotifPrefs(); return [['mention','@멘션'],['comment','댓글'],['assign','작업 할당'],['review','리뷰 요청'],['chat','팀 채팅']].map(function(row){
          return '<label class="w-full flex items-center justify-between py-1.5 cursor-pointer"><span class="text-card-title">'+row[1]+'</span><input type="checkbox" '+(prefs[row[0]]?'checked':'')+' onchange="doToggleNotifPref(\''+row[0]+'\',this.checked)" class="w-[18px] h-[18px] rounded accent-[var(--primary)]"></label>';
        }).join(''); })()
      +'<div class="my-2" style="border-top:1px solid var(--border)"></div>'
      +'<div class="py-1"><div class="text-card-title mb-1.5">주간 요약 자동으로 보기</div>'
        +'<select onchange="setDigestAutoPref(this.value)" class="input h-9">'
          +'<option value="off" '+(getDigestAutoPref()==='off'?'selected':'')+'>사용 안 함</option>'
          +'<option value="daily" '+(getDigestAutoPref()==='daily'?'selected':'')+'>로그인할 때마다(하루 1회)</option>'
          +'<option value="weekly" '+(getDigestAutoPref()==='weekly'?'selected':'')+'>매주 1회</option>'
        +'</select>'
      +'</div>'
    +'</div></div>'

    +'<div><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">내 프로젝트</div><div class="card divide-hair">'
      + (allProjects.length? allProjects.map(p=>
          '<div class="flex items-center gap-3 px-4 py-3">'
          +'<div class="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style="background:#'+p.color+'1F;border:1px solid var(--border)">'+p.icon+'</div>'
          +'<div class="min-w-0 flex-1"><div class="text-card-title truncate">'+escUser(p.name)+'</div><div class="text-meta mt-0.5">'+(p.ownerId===currentUser.uid?'소유자':'멤버')+'</div></div>'
          +(p.ownerId!==currentUser.uid? '<button onclick="doLeaveProject(\''+p.id+'\',\''+escHtml(p.name).replace(/'/g,"\\'")+'\')" class="btn-sm shrink-0" style="background:var(--surface-2);color:var(--danger)" title="나가기">나가기</button>' : '')
          +'</div>'
        ).join('') : '<div class="p-4"><div class="text-meta">아직 참여 중인 프로젝트가 없어요</div></div>')
    +'</div></div>'

    +'<button onclick="doLogout()" class="btn-danger w-full">'+icon('log-out','w-4 h-4')+'로그아웃</button>'

    +'<div><div class="text-meta font-semibold uppercase tracking-wide mb-2 px-1">위험 구역</div><div class="card card-pad">'
      +'<div class="flex items-center justify-between gap-3">'
        +'<div class="min-w-0"><div class="text-card-title">계정 삭제</div><p class="text-meta mt-0.5">로그인 정보와 프로필이 삭제됩니다. 이미 만든 프로젝트/작업 등 팀과 공유된 데이터는 남아있어요.</p></div>'
        +'<button onclick="showDeleteAccountModal()" class="btn-danger btn-sm shrink-0">'+icon('trash-2','w-3.5 h-3.5')+'삭제</button>'
      +'</div>'
    +'</div></div>'
    +'</div>'
  );
  refreshIcons();
}
function showChangePasswordModal(){
  showModal(modalWrap('비밀번호 변경',
    '<div class="space-y-3">'
    +'<div><label class="field-label">현재 비밀번호</label><input type="password" id="cur-pw" placeholder="••••••••" class="input"></div>'
    +'<div><label class="field-label">새 비밀번호</label><input type="password" id="new-pw" placeholder="6자 이상" class="input"></div>'
    +'<div><label class="field-label">새 비밀번호 확인</label><input type="password" id="new-pw2" placeholder="6자 이상" class="input"></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doConfirmChangePassword()" class="btn-primary">'+icon('check','w-4 h-4')+'변경</button>'
  ));
}
async function doConfirmChangePassword(){
  var cur=document.getElementById('cur-pw').value;
  var n1=document.getElementById('new-pw').value;
  var n2=document.getElementById('new-pw2').value;
  if(!cur||!n1){ showToast('모든 항목을 입력하세요','error'); return; }
  if(n1.length<6){ showToast('새 비밀번호는 6자 이상','error'); return; }
  if(n1!==n2){ showToast('새 비밀번호가 서로 달라요','error'); return; }
  showLoading();
  var r=await ssChangePassword(cur,n1);
  hideLoading();
  if(r.success){ closeModal(); showToast('비밀번호가 변경되었습니다','success'); }
  else showToast(r.error,'error');
}
function showDeleteAccountModal(){
  showModal(modalWrap('계정 삭제',
    '<div class="space-y-3">'
    +'<p class="text-body">계정을 삭제하면 로그인 정보와 프로필이 영구적으로 삭제되며, 되돌릴 수 없습니다. 계속하려면 비밀번호를 입력하세요.</p>'
    +'<div><label class="field-label">비밀번호</label><input type="password" id="delete-account-pw" placeholder="••••••••" class="input"></div>'
    +'</div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><button onclick="doConfirmDeleteAccount()" class="btn-danger">'+icon('trash-2','w-4 h-4')+'영구 삭제</button>'
  ));
}
async function doConfirmDeleteAccount(){
  var pw=document.getElementById('delete-account-pw').value;
  if(!pw){ showToast('비밀번호를 입력하세요','error'); return; }
  showLoading();
  var r=await ssDeleteAccount(pw);
  hideLoading();
  if(r.success){
    closeModal();
    showToast('계정이 삭제되었습니다','success');
    showAuthScreen();
  } else {
    showToast(r.error,'error');
  }
}
function showAvatarPicker(){
  showModal(modalWrap('아바타 선택',
    '<div>'
    +'<label class="btn-secondary w-full mb-3 cursor-pointer">'+icon('image-up','w-4 h-4')+'사진 업로드<input type="file" accept="image/*" class="hidden" onchange="doUploadAvatarUI(event)"></label>'
    +'<div class="grid grid-cols-6 gap-2">'+AVATARS.map(a=>'<button onclick="doChangeAvatar(\''+a+'\')" class="text-3xl aspect-square rounded-xl flex items-center justify-center transition hover:scale-105" style="background:var(--surface-2)">'+a+'</button>').join('')+'</div>'
    +'</div>',''
  ));
}
async function doUploadAvatarUI(ev){
  var file=ev.target.files[0]; if(!file)return;
  showLoading();
  var r=await ssUploadAvatar(file);
  hideLoading();
  if(r.success) await doChangeAvatar(r.url);
  else showToast(r.error||'업로드 실패 (Storage 설정을 확인하세요)','error');
}
async function doChangeAvatar(avatar){closeModal();showLoading();await db.collection('users').doc(currentUser.uid).update({avatar});hideLoading();currentUser.avatar=avatar;showToast('아바타가 변경되었습니다','success');renderProfile();}
async function doSaveProfile(){var name=document.getElementById('profile-name').value.trim();if(!name){showToast('이름을 입력하세요','error');return;}showLoading();await db.collection('users').doc(currentUser.uid).update({name});hideLoading();currentUser.name=name;updateAuthUI();showToast('저장되었습니다','success');}
async function doLogout(){
  // 로그아웃은 되돌리기 쉬운(다시 로그인하면 되는) 작업이라 확인창 없이 한 번 클릭으로 바로 처리한다.
  closeDrawer(); showLoading();
  var r=await ssLogout();
  hideLoading();
  // signOut()이 실패해도(네트워크 오류 등) 반드시 여기서 로딩을 내리고 결과를 알려준다 —
  // 예전엔 실패 시 예외가 그대로 던져져서 로딩 화면에 멈춘 것처럼 보였다.
  if(r.success){ showToast('로그아웃되었습니다','success'); showAuthScreen(); }
  else showToast(r.error||'로그아웃에 실패했습니다','error');
}

/* ================================================================
   프로젝트 템플릿
   ================================================================ */
async function renderTemplates(){
  setContent(pageHeader('프로젝트 템플릿')+skeletonGrid(4,'md:grid-cols-2'));
  var customR=await ssGetCustomTemplates(); var customTemplates=customR.templates||[];

  var builtin = SS_TEMPLATES.map(t=>
    '<div onclick="doCreateFromTemplate(\'builtin\',\''+t.id+'\')" class="card card-pad cursor-pointer hover:shadow-md transition">'
      +'<div class="flex items-center gap-3 mb-2"><div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:#'+t.color+'1F;border:1px solid var(--border)">'+t.icon+'</div>'
        +'<div class="min-w-0"><h4 class="text-card-title truncate">'+t.name+'</h4><div class="text-meta">'+t.tasks.length+'개 작업 · '+t.events.length+'개 이벤트</div></div></div>'
      +'<p class="text-body">'+t.description+'</p>'
    +'</div>'
  ).join('');

  var custom = customTemplates.length ? customTemplates.map(t=>
    '<div class="card card-pad">'
      +'<div class="flex items-center justify-between mb-2"><div class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:#'+(t.color||'6366F1')+'1F;border:1px solid var(--border)">'+(t.icon||'📁')+'</div><h4 class="text-card-title truncate">'+escHtml(t.name)+'</h4></div>'
      +'<button onclick="doDeleteCustomTemplate(\''+t.id+'\')" class="icon-btn shrink-0" style="color:var(--danger)" aria-label="템플릿 삭제">'+icon('trash-2','w-4 h-4')+'</button></div>'
      +'<p class="text-body mb-3">'+escHtml(t.description||'')+'</p>'
      +'<button onclick="doCreateFromTemplate(\'custom\',\''+t.id+'\')" class="btn-secondary w-full">'+icon('plus','w-4 h-4')+'이 템플릿으로 생성</button>'
    +'</div>'
  ).join('') : '';

  setContent(pageHeader('프로젝트 템플릿','자주 쓰는 구조로 빠르게 시작하세요','<button onclick="showView(\'dashboard\')" class="btn-secondary">'+icon('arrow-left','w-4 h-4')+'대시보드</button>')
    +'<div class="px-6 pb-8">'
    +'<h3 class="text-section-title mb-3">기본 템플릿</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">'+builtin+'</div>'
    +(customTemplates.length? '<h3 class="text-section-title mb-3">내 템플릿</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4">'+custom+'</div>':'')
    +'</div>');
}
async function doCreateFromTemplate(type,templateId){
  var template;
  if(type==='builtin'){ template=SS_TEMPLATES.find(t=>t.id===templateId); }
  else { var r=await ssGetCustomTemplates(); template=(r.templates||[]).find(t=>t.id===templateId); }
  if(!template){ showToast('템플릿을 찾을 수 없습니다','error'); return; }
  if(!confirm('"'+template.name+'" 템플릿으로 새 프로젝트를 생성하시겠습니까?'))return;
  showLoading(); var r=await ssCreateProjectFromTemplate(template); hideLoading();
  if(r.success){ showToast('프로젝트가 생성되었습니다','success'); await loadProjects(); selectProject(r.id); } else showToast('실패: '+r.error,'error');
}
async function doDeleteCustomTemplate(templateId){ if(!confirm('이 템플릿을 삭제하시겠습니까?'))return; showLoading(); var r=await ssDeleteTemplate(templateId); hideLoading(); if(r.success){ showToast('삭제되었습니다','success'); renderTemplates(); } else showToast('실패했습니다','error'); }

/* ================================================================
   #1 내 작업 (My Tasks) — 모든 프로젝트를 가로질러 나에게 할당된 작업 모음
   ================================================================ */
async function renderMyTasks(){
  setContent(pageHeader(t('mytasks'),'모든 프로젝트에서 나에게 할당된 작업')+skeletonGrid(4,'md:grid-cols-1'));
  if(allProjects.length===0) await loadProjects();
  // #7 성능 개선: 프로젝트별 순차 조회 → 병렬 조회로 전환 (체감 대기시간 대폭 단축)
  var results=await Promise.all(allProjects.map(p=>ssGetTasks(p.id).then(r=>({p,r}))));
  var all=[];
  results.forEach(({p,r})=>{
    (r.tasks||[]).forEach(t=>{ if(t.assigneeId===currentUser.uid) all.push({...t, projectName:p.name, projectColor:p.color, projectId:p.id}); });
  });
  var starredOnly = all.filter(t=>(t.starredBy||[]).indexOf(currentUser.uid)!==-1);
  // #A1 즐겨찾기 전용 보기 — 토글 시 진행중/완료 목록도 즐겨찾기로 한정
  var scope = myTasksStarredOnly ? starredOnly : all;
  var active = scope.filter(t=>t.status!=='done').sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
  var done = scope.filter(t=>t.status==='done');

  function taskRow(t){
    return '<div class="flex items-center gap-3 px-4 py-3 cursor-pointer" onclick="selectProject(\''+t.projectId+'\');showTaskDetail(\''+t.id+'\')">'
      +'<span class="w-2 h-2 rounded-full shrink-0" style="background:#'+t.projectColor+'"></span>'
      +'<div class="min-w-0 flex-1"><div class="text-card-title truncate '+(t.status==='done'?'line-through':'')+'" style="'+(t.status==='done'?'color:var(--text-3)':'')+'">'+escUser(t.title)+'</div>'
      +'<div class="text-meta mt-0.5">'+escHtml(t.projectName)+(t.dueDate?' · '+t.dueDate:'')+'</div></div>'
      + ((t.starredBy||[]).indexOf(currentUser.uid)!==-1? icon('star','w-3.5 h-3.5 shrink-0').replace('class="','style="color:var(--warning)" class="'):'')
      + statusBadge(t.status) + priorityBadge(t.priority)
    +'</div>';
  }

  var actions = '<button onclick="myTasksStarredOnly=!myTasksStarredOnly;renderMyTasks()" class="'+(myTasksStarredOnly?'btn-primary':'btn-secondary')+'" title="즐겨찾기만 보기">'+icon('star','w-4 h-4')+(myTasksStarredOnly?'즐겨찾기만':'전체')+'</button>';

  setContent(pageHeader(t('mytasks'), all.length+'개 작업이 할당되어 있어요'+(myTasksStarredOnly?' · 즐겨찾기 '+starredOnly.length+'개만 표시 중':''), actions)
    +'<div class="px-6 pb-8 max-w-2xl mx-auto space-y-6">'
    + (!myTasksStarredOnly && starredOnly.length? '<div><h3 class="text-section-title mb-2.5 flex items-center gap-1.5">'+icon('star','w-4 h-4')+'즐겨찾기</h3><div class="card divide-hair">'+starredOnly.map(taskRow).join('')+'</div></div>' : '')
    + '<div><h3 class="text-section-title mb-2.5">진행 중 ('+active.length+')</h3>'+(active.length?'<div class="card divide-hair">'+active.map(taskRow).join('')+'</div>':'<div class="card">'+emptyState('user-check', myTasksStarredOnly?'즐겨찾기한 작업이 없어요':'할당된 작업이 없어요', myTasksStarredOnly?'작업 상세에서 ★을 눌러 즐겨찾기에 추가해보세요.':'작업을 추가/수정할 때 "담당자"를 나로 지정하거나, 팀원이 배정하면 여기에 표시됩니다.','')+'</div>')+'</div>'
    + (done.length? '<div><h3 class="text-section-title mb-2.5">완료 ('+done.length+')</h3><div class="card divide-hair">'+done.map(taskRow).join('')+'</div></div>' : '')
    +'</div>');
}

/* ================================================================
   #13 활동 로그 (Activity Log)
   ================================================================ */
var ACTIVITY_LABELS={
  project_create:{icon:'folder-plus',text:'프로젝트 생성'},
  task_create:{icon:'plus-circle',text:'작업 생성'},
  task_status:{icon:'refresh-cw',text:'상태 변경'},
  task_delete:{icon:'trash-2',text:'작업 삭제'},
  task_reviewer:{icon:'eye',text:'리뷰어 변경'},
  doc_create:{icon:'file-plus',text:'문서 작성'},
  doc_update:{icon:'pencil',text:'문서 수정'},
  ownership_transfer:{icon:'crown',text:'소유권 이전'},
  member_remove:{icon:'user-x',text:'멤버 내보내기'}
};
/* ================================================================
   #3 최근 방문 / 즐겨찾기 (localStorage 기반)
   ================================================================ */
function recordRecent(type,id,label,extra){
  try{
    var key='syncspace-recents';
    var list=JSON.parse(localStorage.getItem(key)||'[]');
    list=list.filter(r=>!(r.type===type&&r.id===id));
    list.unshift({type,id,label,extra:extra||null,ts:Date.now()});
    localStorage.setItem(key, JSON.stringify(list.slice(0,8)));
  }catch(e){}
}
function getRecents(){ try{ return JSON.parse(localStorage.getItem('syncspace-recents')||'[]'); }catch(e){ return []; } }
function isFavoriteProject(id){ try{ return (JSON.parse(localStorage.getItem('syncspace-fav-projects')||'[]')).indexOf(id)!==-1; }catch(e){ return false; } }
function toggleFavoriteProject(id){
  try{
    var list=JSON.parse(localStorage.getItem('syncspace-fav-projects')||'[]');
    var idx=list.indexOf(id);
    if(idx===-1) list.push(id); else list.splice(idx,1);
    localStorage.setItem('syncspace-fav-projects', JSON.stringify(list));
  }catch(e){}
}

/* ================================================================
   #4 커맨드 팔레트 (⌘K / Ctrl+K)
   ================================================================ */
var cmdkResults=[], cmdkIndex=0, cmdkQuery='', cmdkRequestId=0;
function openCommandPalette(){
  document.getElementById('cmdk').classList.remove('hidden');
  document.getElementById('cmdk').innerHTML =
    '<div class="fixed inset-0 modal-backdrop flex items-start justify-center pt-[12vh] p-4 animate-fade-fast" onclick="if(event.target===this)closeCommandPalette()">'
    +'<div class="modal-panel w-full max-w-lg animate-modal" onclick="event.stopPropagation()">'
      +'<div class="flex items-center gap-2.5 px-4 h-12 border-b" style="border-color:var(--border)">'
        +icon('search','w-4 h-4').replace('class="','style="color:var(--text-3)" class="')
        +'<input id="cmdk-input" type="text" placeholder="작업, 문서, 프로젝트, 멤버 검색..." class="flex-1 bg-transparent outline-none text-[13.5px]" style="color:var(--text)" oninput="cmdkSearch(this.value)" onkeydown="cmdkKeydown(event)">'
        +'<span class="text-[10px] font-mono px-1.5 py-0.5 rounded" style="background:var(--surface-2);color:var(--text-3)">ESC</span>'
      +'</div>'
      +'<div id="cmdk-results" class="max-h-[360px] overflow-y-auto p-2"></div>'
    +'</div></div>';
  refreshIcons();
  cmdkSearch('');
  setTimeout(()=>document.getElementById('cmdk-input').focus(),30);
}
function closeCommandPalette(){ document.getElementById('cmdk').classList.add('hidden'); document.getElementById('cmdk').innerHTML=''; }
async function cmdkSearch(q){
  q=(q||'').trim().toLowerCase();
  cmdkQuery=q;
  var myRequestId=(cmdkRequestId=(cmdkRequestId||0)+1);
  var results=[];

  // #A2 Quick Actions — 검색뿐 아니라 바로 실행 가능한 명령
  var quickActions=[
    {label:'새 작업 만들기', icon:'plus-circle', keys:['새작업','작업추가','새작업만들기','newtask','task'], action:()=>{closeCommandPalette();quickAddTask();}},
    {label:'새 일정 추가', icon:'calendar-plus', keys:['새일정','일정추가','캘린더','newevent'], action:()=>{closeCommandPalette(); if(!currentProjectId){ openProjectSwitcher({forView:'calendar'}); return; } showAddEventModal(fmtDate(new Date()));}},
    {label:'새 프로젝트 만들기', icon:'folder-plus', keys:['새프로젝트','프로젝트추가','프로젝트만들기','newproject'], action:()=>{closeCommandPalette();showCreateProjectModal();}}
  ];
  var qCompact=q.replace(/\s/g,'');
  quickActions.filter(a=> !q || a.keys.some(k=>k.indexOf(qCompact)!==-1)).forEach(a=>
    results.push({group:'빠른 실행', icon:a.icon, label:a.label, action:a.action})
  );

  if(!q){
    getRecents().filter(r=>r.type!=='doc').forEach(r=>results.push({group:'최근',icon:r.type==='project'?'folder-kanban':'check-square',label:r.label,action:cmdkActionFor(r)}));
    allProjects.forEach(p=>results.push({group:'프로젝트',icon:'folder-kanban',label:p.name,action:()=>{selectProject(p.id);closeCommandPalette();}}));
  } else {
    allProjects.filter(p=>p.name.toLowerCase().includes(q)).forEach(p=>results.push({group:'프로젝트',icon:'folder-kanban',label:p.name,action:()=>{selectProject(p.id);closeCommandPalette();}}));

    // #2 전체 프로젝트 통합 검색 — allProjects는 이미 '내가 접근 가능한 프로젝트'만 포함(ssGetProjects의 members 필터 결과)이므로 권한 밖 데이터는 애초에 대상에 없음
    // #7 성능 개선: 프로젝트별 순차 조회 → 병렬 조회로 전환
    var orderedProjects = allProjects.slice().sort((a,b)=> (b.id===currentProjectId?1:0) - (a.id===currentProjectId?1:0));
    var perProjectResults = await Promise.all(orderedProjects.map(proj=>
      ssGetTasks(proj.id).then(tR=>({proj,tR}))
    ));
    for(var pi=0; pi<perProjectResults.length; pi++){
      var proj=perProjectResults[pi].proj, tR=perProjectResults[pi].tR;
      (tR.tasks||[]).filter(t=>t.title.toLowerCase().includes(q)).slice(0,3).forEach(t=>
        results.push({group:proj.name, icon:'check-square', label:t.title, action:()=>{closeCommandPalette();selectProject(proj.id);setTimeout(()=>showTaskDetail(t.id),150);recordRecent('task',t.id,t.title);}})
      );
      if(results.length>30) break; // 결과 과다 방지
    }
    if(currentProjectId){
      var mR=await ssGetProjectMembers(currentProjectId);
      (mR.members||[]).filter(m=>(m.name||'').toLowerCase().includes(q)).slice(0,5).forEach(m=>results.push({group:'멤버',icon:'user',label:m.name,action:()=>{closeCommandPalette();showView('team');}}));
    }
  }
  var pages=[
    {label:'대시보드',view:'dashboard',icon:'layout-dashboard'},{label:'내 작업',view:'mytasks',icon:'user-check'},
    {label:'할 일 목록',view:'kanban',icon:'columns-3'},{label:'캘린더',view:'calendar',icon:'calendar'},
    {label:'파트별 진행률',view:'roles',icon:'gauge'}
  ].filter(p=>!q||p.label.toLowerCase().includes(q));
  if(!q || '도움말 faq 문의 개인정보 단축키 help'.indexOf(q)!==-1) results.push({group:'도움말',icon:'help-circle',label:'도움말 · 자주 묻는 질문 · 단축키',action:()=>{closeCommandPalette();showHelpModal();}});
  pages.forEach(p=>results.push({group:'이동',icon:p.icon,label:p.label,action:()=>{closeCommandPalette();showView(p.view);}}));

  if(myRequestId!==cmdkRequestId) return; // 더 최신 검색이 이미 진행 중이면 이 결과는 버린다(#7 race-guard)
  if(myRequestId!==cmdkRequestId) return; // 이후 입력으로 더 최신 검색이 시작됐다면 이 결과는 버린다
  cmdkResults=results; cmdkIndex=0; renderCmdkResults();
}
function cmdkActionFor(r){
  if(r.type==='task') return ()=>{ closeCommandPalette(); showTaskDetail(r.id); };
  if(r.type==='project') return ()=>{ selectProject(r.id); closeCommandPalette(); };
  return ()=>closeCommandPalette();
}
function renderCmdkResults(){
  var box=document.getElementById('cmdk-results'); if(!box)return;
  if(!cmdkResults.length){ box.innerHTML=emptyState('search-x','결과가 없어요','다른 검색어를 시도해보세요',''); refreshIcons(); return; }
  var lastGroup=null, html='';
  cmdkResults.forEach((r,i)=>{
    if(r.group!==lastGroup){ html+='<div class="text-meta font-semibold px-2 pt-2 pb-1">'+r.group+'</div>'; lastGroup=r.group; }
    html+='<div class="cmdk-item flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer" data-idx="'+i+'" style="'+(i===cmdkIndex?'background:var(--surface-2)':'')+'" onclick="cmdkResults['+i+'].action()" onmouseenter="cmdkIndex='+i+';renderCmdkResults()">'
      +icon(r.icon,'w-4 h-4 shrink-0').replace('class="','style="color:var(--text-3)" class="')+'<span class="text-body truncate">'+highlightMatch(escHtml(r.label),cmdkQuery)+'</span></div>';
  });
  box.innerHTML=html; refreshIcons();
}
function cmdkKeydown(ev){
  if(ev.key==='ArrowDown'){ ev.preventDefault(); cmdkIndex=Math.min(cmdkIndex+1,cmdkResults.length-1); renderCmdkResults(); }
  else if(ev.key==='ArrowUp'){ ev.preventDefault(); cmdkIndex=Math.max(cmdkIndex-1,0); renderCmdkResults(); }
  else if(ev.key==='Enter'){ ev.preventDefault(); if(cmdkResults[cmdkIndex]) cmdkResults[cmdkIndex].action(); }
  else if(ev.key==='Escape'){ closeCommandPalette(); }
}

/* ================================================================
   #2 키보드 단축키
   ================================================================ */
/* ================= 도움말 · 자주 묻는 질문 · 개인정보 안내 ================= */
function showHelpModal(tab){
  var faq=[
    ['처음 어떻게 시작하나요?','가입·로그인 후 대시보드의 “첫 프로젝트 만들기”로 프로젝트를 만들고, 팀원 초대 → 작업 추가 순서로 진행하세요.'],
    ['팀원은 어떻게 초대하나요?','프로젝트의 “팀 멤버” 화면에서 상대 이메일로 초대하세요. 상대가 같은 이메일로 가입한 뒤 알림에서 수락하면 참여됩니다.'],
    ['할 일에 담당자와 마감일을 정하려면?','“새 작업”에서 담당자·마감일·우선순위를 고르거나, 작업을 눌러 상세 화면에서 수정할 수 있어요.'],
    ['프로젝트를 삭제하고 싶어요','프로젝트 카드의 휴지통 아이콘 또는 개요의 “프로젝트 삭제”를 누르세요. 프로젝트 소유자만 가능하며 삭제 직후 “실행취소”로 되돌릴 수 있어요.'],
    ['비밀번호를 잊어버렸어요','로그인 화면의 “비밀번호를 잊으셨나요?”에서 가입 이메일로 재설정 링크를 받을 수 있어요.'],
    ['초대를 보냈는데 상대에게 안 보여요','상대가 보낸 이메일과 같은 이메일로 가입·로그인했는지 확인하고, 알림 메뉴를 새로고침해 보세요.']
  ];
  var priv=[
    ['수집하는 정보','이름, 이메일, 비밀번호, 그리고 직접 입력한 프로젝트·작업·일정·채팅 내용'],
    ['이용 목적','팀 협업(할 일·일정·진행률·채팅) 기능 제공. 그 외 목적으로 사용하지 않습니다.'],
    ['보관 방식','Google Firebase에 저장됩니다. 비밀번호는 Firebase 인증이 암호화하여 관리하며 서비스가 직접 보관하지 않습니다.'],
    ['삭제','프로필 > 계정 삭제에서 계정을 삭제할 수 있습니다. 단, 팀과 공유된 프로젝트·작업 데이터는 남을 수 있습니다.'],
    ['안내','이 서비스는 졸업 프로젝트(Team Plus)로 제작된 학습용 서비스입니다. 중요한 개인정보나 기밀 자료는 입력하지 마세요.']
  ];
  var tabs=[['faq','자주 묻는 질문'],['privacy','개인정보·이용 안내'],['contact','문의']];
  tab=tab||'faq';
  var body='<div class="flex gap-1.5 mb-3 flex-wrap">'+tabs.map(function(t){return '<button onclick="showHelpModal(\''+t[0]+'\')" class="'+(t[0]===tab?'btn-primary':'btn-secondary')+'" style="padding:6px 12px;font-size:13px">'+t[1]+'</button>';}).join('')+'</div>';
  if(tab==='faq'){
    body+='<div class="space-y-2">'+faq.map(function(f){return '<details class="card card-pad" style="padding:10px 12px"><summary class="text-card-title" style="cursor:pointer">'+f[0]+'</summary><p class="text-body mt-2">'+f[1]+'</p></details>';}).join('')+'</div>'
      +'<button onclick="closeModal();showShortcutsModal()" class="btn-ghost w-full mt-3">'+icon('keyboard','w-4 h-4')+'키보드 단축키 보기 (Ctrl+K, N, ? …)</button>';
  } else if(tab==='privacy'){
    body+='<div class="space-y-3">'+priv.map(function(f){return '<div><div class="text-card-title">'+f[0]+'</div><p class="text-body mt-0.5">'+f[1]+'</p></div>';}).join('')+'</div>';
  } else {
    body+='<p class="text-body">사용 중 문제가 있거나 건의할 내용이 있다면 같은 팀 운영자(프로젝트 소유자)에게 알려 주세요. 화면 캡처와 함께 “어느 화면에서 무엇을 눌렀는지” 알려 주시면 빠르게 확인할 수 있어요.</p>'
      +'<p class="text-meta mt-3">자주 묻는 질문 탭에서 먼저 해결 방법을 찾아보세요.</p>';
  }
  showModal(modalWrap('도움말',body,''));
}
function showShortcutsModal(){
  var rows=[
    ['Ctrl+K (Mac ⌘K)','커맨드 팔레트 열기'],
    ['G 다음 D/T/C/P/M','대시보드/할 일 목록/캘린더/파트별 진행률/팀 멤버로 이동'],
    ['N','새 작업 추가'],
    ['/','현재 화면 검색창에 포커스'],
    ['← / →','캘린더에서 이전/다음 달'],
    ['E','작업 상세에서 수정'],
    ['Ctrl+Enter (Mac ⌘+Enter)','채팅/댓글 입력창에서 바로 전송'],
    ['Esc','모달/팔레트/메뉴 닫기'],
    ['?','단축키 도움말']
  ];
  showModal(modalWrap('키보드 단축키',
    '<div class="space-y-1.5">'+rows.map(r=>'<div class="flex items-center justify-between py-1.5 gap-3"><span class="text-body">'+r[1]+'</span><span class="text-[11px] font-mono px-2 py-0.5 rounded shrink-0" style="background:var(--surface-2);color:var(--text-2)">'+r[0]+'</span></div>').join('')+'</div>',''
  ));
}
// G 다음에 눌리는 글자로 빠른 이동하는 두 단계 단축키(Gmail/Linear 스타일)의 대기 상태
var pendingG=false, pendingGTimer=null;
document.addEventListener('keydown', function(ev){
  var tag=(document.activeElement&&document.activeElement.tagName)||'';
  var typing = tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  var mod = ev.metaKey||ev.ctrlKey;

  if(mod && ev.key.toLowerCase()==='k'){ ev.preventDefault(); openCommandPalette(); return; }

  // Ctrl/⌘+Enter: 채팅·댓글 입력창에 포커스가 있으면 그 자리에서 바로 전송
  if(mod && ev.key==='Enter'){
    var activeId=document.activeElement && document.activeElement.id;
    if(activeId==='chat-input'){ ev.preventDefault(); doSendChatMessage(); return; }
    if(activeId==='comment-text'){
      var cTaskId=document.getElementById('modal').getAttribute('data-task-id');
      if(cTaskId){ ev.preventDefault(); doAddComment(cTaskId); return; }
    }
  }

  if(ev.key==='Escape'){
    if(!document.getElementById('cmdk').classList.contains('hidden')){ closeCommandPalette(); return; }
    if(!document.getElementById('modal').classList.contains('hidden')){ closeModal(); return; }
    var sb=document.getElementById('sidebar');
    if(sb && sb.classList.contains('flex')){ closeDrawer(); return; }
  }

  if(typing || !isLoggedIn) return;

  // G 다음 D/T/K/C/M: 화면 이동
  if(pendingG){
    pendingG=false; clearTimeout(pendingGTimer);
    var navMap={ d:'dashboard', t:'kanban', k:'kanban', c:'calendar', m:'team', p:'roles' };
    var navView=navMap[ev.key.toLowerCase()];
    if(navView){ ev.preventDefault(); showView(navView); }
    return;
  }
  if(ev.key==='g'||ev.key==='G'){ pendingG=true; clearTimeout(pendingGTimer); pendingGTimer=setTimeout(function(){pendingG=false;},900); return; }

  if(ev.key==='n'||ev.key==='N'){ if(currentProjectId){ ev.preventDefault(); showAddTaskModal(); } return; }
  if(ev.key==='?'){ ev.preventDefault(); showShortcutsModal(); return; }

  // / : 할 일 목록 화면의 검색창으로 바로 포커스 이동
  if(ev.key==='/'){
    var searchId = currentView==='kanban' ? 'kanban-search-input' : null;
    var searchEl = searchId && document.getElementById(searchId);
    if(searchEl){ ev.preventDefault(); searchEl.focus(); }
    return;
  }

  // ← / → : 캘린더 화면에서 이전/다음 달
  if(currentView==='calendar' && (ev.key==='ArrowLeft'||ev.key==='ArrowRight')){
    ev.preventDefault();
    if(ev.key==='ArrowLeft') calPrevMonth(); else calNextMonth();
    return;
  }

  // 작업 상세 모달이 열려 있을 때만 의미가 있는 단축키
  var modalEl=document.getElementById('modal');
  var openTaskId = !modalEl.classList.contains('hidden') ? modalEl.getAttribute('data-task-id') : null;
  if(openTaskId){
    // E : 이 작업 수정
    if(ev.key==='e'||ev.key==='E'){ ev.preventDefault(); showEditTaskModal(openTaskId); return; }
  }
});

/* ================================================================
   #14 CSV 내보내기
   ================================================================ */
function downloadCSV(filename, rows){
  var csv = rows.map(row => row.map(cell=>{
    var s = (cell===null||cell===undefined) ? '' : String(cell);
    if(s.indexOf(',')!==-1 || s.indexOf('"')!==-1 || s.indexOf('\n')!==-1) s='"'+s.replace(/"/g,'""')+'"';
    return s;
  }).join(',')).join('\r\n');
  var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
async function doExportTasksCSV(){
  if(!currentProjectId){ showToast('프로젝트를 먼저 선택하세요','error'); return; }
  showLoading(); var r=await ssGetTasks(currentProjectId); hideLoading();
  var tasks=r.tasks||[];
  var rows=[['제목','상태','우선순위','담당자','마감일','생성일']];
  tasks.forEach(t=>rows.push([t.title, t.status, t.priority, t.assigneeName||'', t.dueDate||'', t.createdAt?fmtDate(t.createdAt):'']));
  downloadCSV((currentProject?currentProject.name:'tasks')+'_작업목록.csv', rows);
  showToast('CSV 파일이 다운로드되었습니다','success');
}

/* ================================================================
   #12 마감 임박 브라우저 알림
   ================================================================ */
function notificationsSupported(){ return typeof Notification!=='undefined'; }
function notificationsEnabled(){ return notificationsSupported() && Notification.permission==='granted' && localStorage.getItem('syncspace-notif-opt-in')==='true'; }
async function requestDueSoonNotifications(){
  if(!notificationsSupported()){ showToast('이 브라우저는 알림을 지원하지 않습니다','error'); return; }
  var perm = await Notification.requestPermission();
  if(perm==='granted'){ localStorage.setItem('syncspace-notif-opt-in','true'); showToast('마감 임박 알림이 활성화되었습니다','success'); checkDueSoonNotifications(); }
  else showToast('알림 권한이 거부되었습니다','error');
  renderProfile();
}
function disableDueSoonNotifications(){ localStorage.setItem('syncspace-notif-opt-in','false'); renderProfile(); }
async function checkDueSoonNotifications(){
  if(!notificationsEnabled() || !allProjects.length || isDndActive()) return;
  var today=new Date(); today.setHours(0,0,0,0);
  var tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  var seenKey='syncspace-notif-seen';
  var seen=[]; try{ seen=JSON.parse(localStorage.getItem(seenKey)||'[]'); }catch(e){}
  for(var i=0;i<allProjects.length;i++){
    var p=allProjects[i]; var r=await ssGetTasks(p.id);
    (r.tasks||[]).forEach(t=>{
      if(t.assigneeId!==currentUser.uid || t.status==='done' || !t.dueDate) return;
      var d=new Date(t.dueDate);
      if(d>=today && d<=tomorrow){
        var dedupeKey=t.id+'_'+fmtDate(new Date());
        if(seen.indexOf(dedupeKey)!==-1) return;
        seen.push(dedupeKey);
        try{ new Notification('마감 임박: '+t.title, { body:p.name+' · '+t.dueDate, icon:'' }); }catch(e){}
      }
    });
  }
  localStorage.setItem(seenKey, JSON.stringify(seen.slice(-200)));
}

/* ================================================================
   #11 필터 저장 / 나만의 뷰 (할 일 목록)
   ================================================================ */
function getSavedFilters(){ try{ return JSON.parse(localStorage.getItem('syncspace-saved-filters')||'[]'); }catch(e){ return []; } }
function saveSavedFilters(list){ localStorage.setItem('syncspace-saved-filters', JSON.stringify(list)); }
function renderSavedFilterChips(){
  var views=getSavedFilters();
  var chips=views.map((v,i)=>
    '<button onclick="applySavedFilter('+i+')" class="badge-neutral" style="cursor:pointer">'+escUser(v.name)
    +'<span onclick="event.stopPropagation();deleteSavedFilter('+i+')" class="ml-1" style="opacity:.6">✕</span></button>'
  ).join(' ');
  return '<div class="px-6 -mt-2 mb-2 flex items-center gap-1.5 flex-wrap">'
    + chips
    + '<button onclick="promptSaveFilter()" class="badge-primary" style="cursor:pointer">'+icon('bookmark-plus','w-3 h-3')+'현재 필터 저장</button>'
    + '</div>';
}
function promptSaveFilter(){
  var name=prompt('저장할 필터 이름을 입력하세요 (예: 내 급한 작업)');
  if(!name)return;
  var views=getSavedFilters();
  views.push({name:name, query:searchQuery, priority:todoPriorityFilter, starredOnly:todoStarredOnly});
  saveSavedFilters(views);
  showToast('필터가 저장되었습니다','success');
  renderKanban();
}
function applySavedFilter(i){
  var v=getSavedFilters()[i]; if(!v)return;
  searchQuery=v.query||''; todoPriorityFilter=v.priority||'all'; todoStarredOnly=!!v.starredOnly;
  renderKanban();
}
function deleteSavedFilter(i){
  var views=getSavedFilters(); views.splice(i,1); saveSavedFilters(views);
  renderKanban();
}

/* ================================================================
   #10 다국어 (한/영) 토글 — 사이드바 내비게이션 + 인증 화면에 적용
   ================================================================ */
var I18N = {
  ko:{ dashboard:'대시보드', mytasks:'내 작업', kanban:'할 일 목록', calendar:'캘린더', roles:'파트별 진행률',
       team:'팀 멤버', chat:'팀 채팅', notifications:'알림', profile:'프로필', darkmode:'다크 모드', lang:'한국어',
       login:'로그인', signup:'회원가입', email:'이메일', password:'비밀번호' },
  en:{ dashboard:'Dashboard', mytasks:'My Tasks', kanban:'To-dos', calendar:'Calendar', roles:'Progress by Role',
       team:'Team', chat:'Team Chat', notifications:'Notifications', profile:'Profile', darkmode:'Dark Mode', lang:'English',
       login:'Log in', signup:'Sign up', email:'Email', password:'Password' }
};
function t(key){ return (I18N[currentLang]&&I18N[currentLang][key]) || (I18N.ko[key]||key); }
function toggleLanguage(){
  currentLang = currentLang==='ko' ? 'en' : 'ko';
  localStorage.setItem('syncspace-lang', currentLang);
  applyI18n();
  showView(currentView); // 현재 화면 다시 그려서 페이지 내부 텍스트도 갱신
}
function applyI18n(){
  ['dashboard','mytasks','kanban','calendar','roles','team','chat','notifications','profile']
    .forEach(function(key){
      var btn=document.getElementById('nav-'+key);
      if(btn){ var span=btn.querySelector('span'); if(span) span.textContent=t(key); }
    });
  if(window.ssSetEnglish) ssSetEnglish(currentLang==='en');
  var langLabel=document.getElementById('lang-toggle-label'); if(langLabel) langLabel.textContent = currentLang==='ko'?'한국어':'English';
  var langCode=document.getElementById('lang-toggle-code'); if(langCode) langCode.textContent = currentLang==='ko'?'KO':'EN';
}

/* ================================================================
   #15 온보딩 체크리스트 (신규 사용자 가이드)
   ================================================================ */
function renderOnboardingCard(){
  if(localStorage.getItem('syncspace-onb-dismissed')==='1') return '';
  var steps=[
    { key:'project', label:'첫 프로젝트 만들기', done: allProjects.length>0 || localStorage.getItem('syncspace-onb-project')==='1', action:"showCreateProjectModal()" },
    { key:'task', label:'작업 추가하기', done: localStorage.getItem('syncspace-onb-task')==='1', action: currentProjectId? "showAddTaskModal()" : "showToast('먼저 프로젝트를 선택하세요','error')" },
    { key:'invite', label:'팀원 초대하기', done: localStorage.getItem('syncspace-onb-invite')==='1', action: currentProjectId? "showView('team')" : "showToast('먼저 프로젝트를 선택하세요','error')" }
  ];
  var doneCount=steps.filter(s=>s.done).length;
  if(doneCount===steps.length){ localStorage.setItem('syncspace-onb-dismissed','1'); return ''; }

  var stepsHtml=steps.map(s=>
    '<button onclick="'+s.action+'" class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl flex-1 text-left transition-colors" style="background:'+(s.done?'var(--success-soft)':'var(--surface)')+';border:1px solid var(--border)">'
    + icon(s.done?'check-circle-2':'circle','w-4 h-4 shrink-0').replace('class="','style="color:'+(s.done?'var(--success)':'var(--text-3)')+'" class="')
    + '<span class="text-body '+(s.done?'line-through':'')+'" style="'+(s.done?'color:var(--text-3)':'')+'">'+s.label+'</span>'
    +'</button>'
  ).join('');

  return '<div class="px-6 mb-1"><div class="card card-pad" style="background:var(--primary-soft);border-color:transparent">'
    +'<div class="flex items-center justify-between mb-3">'
      +'<div><h3 class="text-section-title" style="color:var(--primary-soft-text)">'+icon('rocket','w-4 h-4 inline mr-1 -mt-0.5')+'Syncspace 시작하기</h3>'
      +'<p class="text-meta mt-0.5">'+doneCount+'/'+steps.length+' 단계 완료</p></div>'
      +'<button onclick="dismissOnboarding()" class="icon-btn" title="닫기" aria-label="온보딩 카드 닫기">'+icon('x','w-4 h-4')+'</button>'
    +'</div>'
    +'<div class="flex flex-col sm:flex-row gap-2">'+stepsHtml+'</div>'
  +'</div></div>';
}
function dismissOnboarding(){ localStorage.setItem('syncspace-onb-dismissed','1'); renderDashboard(); }

/* ================================================================
   #10 온보딩 완료 후 "다음 추천 기능" 카드
   ================================================================ */
var NEXT_STEP_FEATURES=[
  {icon:'search', title:'무엇이든 빠르게 찾기', desc:'작업·문서·프로젝트를 한 번에 검색해요', action:"openCommandPalette()"},
  {icon:'eye', title:'리뷰어 지정하기', desc:'작업 상세에서 검토자를 지정할 수 있어요', action: "showToast('작업 상세 › 개요 탭에서 지정할 수 있어요','info')"},
  {icon:'bookmark-plus', title:'필터 저장하기', desc:'자주 쓰는 검색 조합을 저장해두세요', action: "showView('kanban')"},
  {icon:'link-2', title:'작업 간 의존성 설정', desc:'선행 작업을 지정해 작업 순서를 관리하세요', action: "showToast('작업 상세 › 개요 탭에서 설정할 수 있어요','info')"}
];
function renderNextStepsCard(){
  if(localStorage.getItem('syncspace-onb-dismissed')!=='1') return '';
  if(localStorage.getItem('syncspace-nextsteps-dismissed')==='1') return '';
  var items=NEXT_STEP_FEATURES.map(f=>
    '<button onclick="'+f.action+'" class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left flex-1" style="background:var(--surface);border:1px solid var(--border)">'
    + '<div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 icon-tile-soft">'+icon(f.icon,'w-4 h-4').replace('class="','style="color:var(--primary-soft-text)" class="')+'</div>'
    + '<div class="min-w-0"><div class="text-card-title">'+f.title+'</div><div class="text-meta mt-0.5">'+f.desc+'</div></div>'
    +'</button>'
  ).join('');
  return '<div class="px-6 mb-1"><div class="card card-pad">'
    +'<div class="flex items-center justify-between mb-3">'
      +'<h3 class="text-section-title">'+icon('sparkles','w-4 h-4 inline mr-1 -mt-0.5')+'이런 기능도 있어요'+'</h3>'
      +'<button onclick="dismissNextSteps()" class="icon-btn" title="닫기" aria-label="추천 카드 닫기">'+icon('x','w-4 h-4')+'</button>'
    +'</div>'
    +'<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">'+items+'</div>'
  +'</div></div>';
}
function dismissNextSteps(){ localStorage.setItem('syncspace-nextsteps-dismissed','1'); renderDashboard(); }

/* ================================================================
   #2 일괄 작업 (Bulk Actions)
   ================================================================ */
function toggleBulkMode(){ bulkMode=!bulkMode; selectedTaskIds=[]; renderKanban(); }
function toggleBulkSelect(taskId,checked){
  if(checked){ if(selectedTaskIds.indexOf(taskId)===-1) selectedTaskIds.push(taskId); }
  else { selectedTaskIds=selectedTaskIds.filter(id=>id!==taskId); }
  renderKanban();
}
function clearBulkSelection(){ selectedTaskIds=[]; renderKanban(); }
async function doBulkStatusChange(status){
  if(!status || !selectedTaskIds.length) return;
  showLoading();
  for(var i=0;i<selectedTaskIds.length;i++){ await ssMoveTask(selectedTaskIds[i], status); }
  hideLoading();
  showToast(selectedTaskIds.length+'개 작업 상태가 변경되었습니다','success');
  ssLogActivity(currentProjectId,'task_status',(currentUser.name||'사용자')+'님이 '+selectedTaskIds.length+'개 작업을 일괄 변경했습니다');
  selectedTaskIds=[]; renderKanban();
}
async function doBulkDelete(){
  if(!selectedTaskIds.length) return;
  if(!confirm(selectedTaskIds.length+'개 작업을 삭제하시겠습니까?'))return;
  showLoading();
  var ids=selectedTaskIds.slice();
  for(var i=0;i<ids.length;i++){ await ssDeleteTask(ids[i]); }
  hideLoading();
  showToast(ids.length+'개 작업이 삭제되었습니다','success');
  selectedTaskIds=[]; renderKanban();
}

/* ================================================================
   #12 검색어 하이라이트
   ================================================================ */
function highlightMatch(escapedText,query){
  if(!query) return escapedText;
  var q=escHtml(query).trim(); if(!q) return escapedText;
  try{
    var re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
    return escapedText.replace(re, '<mark style="background:var(--warning-soft);color:var(--warning);border-radius:3px;padding:0 1px">$1</mark>');
  }catch(e){ return escapedText; }
}

/* ================================================================
   #9 캘린더 내보내기 (.ics)
   ================================================================ */
function icsDate(dateStr){ return (dateStr||fmtDate(new Date())).replace(/-/g,''); }
function icsEscape(s){ return String(s||'').replace(/[\\;,]/g,function(m){return '\\'+m;}).replace(/\n/g,'\\n'); }
async function doExportCalendarICS(){
  if(!currentProjectId){ showToast('프로젝트를 먼저 선택하세요','error'); return; }
  showLoading();
  var eventsR=await ssGetEvents(currentProjectId); var tasksR=await ssGetTasks(currentProjectId);
  hideLoading();
  var lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Syncspace//KO','CALSCALE:GREGORIAN'];
  (eventsR.events||[]).forEach(function(e){
    lines.push('BEGIN:VEVENT');
    lines.push('UID:event-'+e.id+'@syncspace');
    lines.push('DTSTART;VALUE=DATE:'+icsDate(e.date));
    lines.push('SUMMARY:'+icsEscape(e.title));
    lines.push('DESCRIPTION:'+icsEscape((currentProject?currentProject.name:'')+' · '+(e.type||'event')));
    lines.push('END:VEVENT');
  });
  (tasksR.tasks||[]).filter(t=>t.dueDate).forEach(function(t){
    lines.push('BEGIN:VEVENT');
    lines.push('UID:task-'+t.id+'@syncspace');
    lines.push('DTSTART;VALUE=DATE:'+icsDate(t.dueDate));
    lines.push('SUMMARY:[마감] '+icsEscape(t.title));
    lines.push('DESCRIPTION:'+icsEscape((currentProject?currentProject.name:'')+' · 우선순위 '+t.priority));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  var blob=new Blob([lines.join('\r\n')], {type:'text/calendar;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download=(currentProject?currentProject.name:'syncspace')+'.ics'; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('.ics 파일이 다운로드되었습니다. 캘린더 앱으로 열어보세요','success');
}

/* ================================================================
   #13 읽기 전용 공유 링크
   ================================================================ */
function showShareModal(projectId){
  var proj=allProjects.find(p=>p.id===projectId); if(!proj)return;
  var shareUrl = proj.shareEnabled && proj.shareId ? (location.origin+location.pathname+'?share='+projectId+':'+proj.shareId) : '';
  showModal(modalWrap('읽기 전용 공유 링크',
    '<p class="text-body mb-3">로그인 없이 프로젝트 진행 상황(작업 목록·진행률)을 볼 수 있는 링크를 만들 수 있어요. 수정은 불가능합니다.</p>'
    + (shareUrl
      ? '<div class="flex gap-2 mb-3"><input type="text" readonly value="'+shareUrl+'" class="input flex-1 text-[12px]" onclick="this.select()"><button onclick="navigator.clipboard.writeText(\''+shareUrl+'\');showToast(\'복사되었습니다\',\'success\')" class="btn-secondary btn-sm" title="링크 복사" aria-label="링크 복사">'+icon('copy','w-3.5 h-3.5')+'</button></div>'
        +'<button onclick="doDisableShare(\''+projectId+'\')" class="btn-danger w-full">'+icon('link-2-off','w-4 h-4')+'공유 해제</button>'
      : '<button onclick="doEnableShare(\''+projectId+'\')" class="btn-primary w-full">'+icon('link','w-4 h-4')+'공유 링크 만들기</button>')
    +'<p class="text-meta mt-3">'+icon('info','w-3 h-3 inline mr-1 -mt-0.5')+'Firestore 보안 규칙이 읽기를 허용하는 경우에만 외부에서 열람할 수 있어요.</p>',
    ''
  ));
}
async function doEnableShare(projectId){
  var shareId = Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
  showLoading(); var r=await ssEnableShare(projectId,shareId); hideLoading();
  if(r.success){ showToast('공유 링크가 생성되었습니다','success'); await loadProjects(); showShareModal(projectId); }
  else showToast('실패했습니다','error');
}
async function doDisableShare(projectId){
  showLoading(); var r=await ssDisableShare(projectId); hideLoading();
  if(r.success){ showToast('공유가 해제되었습니다','success'); await loadProjects(); closeModal(); }
  else showToast('실패했습니다','error');
}

async function renderPublicShareView(shareParam){
  // 로그인 화면/사이드바/모바일 UI를 모두 숨기고 콘텐츠 영역만 사용
  var sb=document.getElementById('sidebar'); if(sb) sb.style.display='none';
  var mainEl=document.querySelector('main'); if(mainEl) mainEl.style.marginLeft='0';
  document.querySelectorAll('main > header, main > nav').forEach(el=>el.style.display='none');
  applyDarkMode();

  var parts=shareParam.split(':'); var projectId=parts[0], shareId=parts[1];
  var content=document.getElementById('content');
  content.innerHTML='<div class="flex items-center justify-center h-screen">'+icon('loader-circle','w-6 h-6 animate-spin').replace('class="','style="color:var(--text-3)" class="')+'</div>';
  refreshIcons();

  var pr=await ssGetProject(projectId);
  if(!pr.success || !pr.project.shareEnabled || pr.project.shareId!==shareId){
    content.innerHTML='<div class="min-h-screen flex items-center justify-center p-6">'+emptyState('link-2-off','유효하지 않은 링크예요','공유가 해제되었거나 링크가 올바르지 않습니다.','')+'</div>';
    refreshIcons(); return;
  }
  var proj=pr.project;
  var tr=await ssGetTasks(projectId);
  var tasks=tr.tasks||[];
  var todo=tasks.filter(t=>t.status==='todo').length, inprogress=tasks.filter(t=>t.status==='inprogress').length, done=tasks.filter(t=>t.status==='done').length;
  var total=tasks.length||1; var pct=Math.round(done/total*100);

  var rows=tasks.map(t=>'<div class="flex items-center gap-3 px-4 py-2.5" style="border-bottom:1px solid var(--border)">'
    +'<div class="min-w-0 flex-1"><div class="text-card-title">'+escUser(t.title)+'</div>'+(t.dueDate?'<div class="text-meta mt-0.5">'+t.dueDate+'</div>':'')+'</div>'
    + statusBadge(t.status) + priorityBadge(t.priority)
  +'</div>').join('');

  content.innerHTML =
    '<div class="min-h-screen" style="background:var(--bg)">'
    +'<div class="max-w-2xl mx-auto px-6 py-10">'
      +'<div class="flex items-center gap-2 mb-6 text-meta">'+icon('eye','w-3.5 h-3.5')+'읽기 전용 공유 보기 · 로그인 불필요</div>'
      +'<div class="flex items-center gap-3 mb-2"><div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style="background:#'+proj.color+'1F;border:1px solid var(--border)">'+proj.icon+'</div><h1 class="text-page-title">'+escUser(proj.name)+'</h1></div>'
      +(proj.description?'<p class="text-body mb-6">'+escUser(proj.description)+'</p>':'<div class="mb-6"></div>')
      +'<div class="card card-pad mb-6">'
        +'<div class="flex items-end gap-3 mb-2"><span class="text-[28px] font-extrabold" style="color:var(--text)">'+pct+'%</span><span class="text-meta mb-1">완료됨</span></div>'
        +'<div class="progress-track h-2.5 mb-4"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
        +'<div class="grid grid-cols-3 gap-2 text-center">'
          +'<div class="surface-2 rounded-xl py-3"><div class="text-[16px] font-bold" style="color:var(--text)">'+done+'</div><div class="text-meta">완료</div></div>'
          +'<div class="surface-2 rounded-xl py-3"><div class="text-[16px] font-bold" style="color:var(--text)">'+inprogress+'</div><div class="text-meta">진행 중</div></div>'
          +'<div class="surface-2 rounded-xl py-3"><div class="text-[16px] font-bold" style="color:var(--text)">'+todo+'</div><div class="text-meta">할 일</div></div>'
        +'</div>'
      +'</div>'
      +'<h3 class="text-section-title mb-2">작업 목록</h3>'
      + (tasks.length? '<div class="card divide-hair">'+rows+'</div>' : '<div class="card"><div class="py-6 text-center text-meta">작업이 없습니다</div></div>')
      +'<p class="text-meta text-center mt-8">Powered by Syncspace</p>'
    +'</div></div>';
  refreshIcons();
}

/* ================================================================
   #1 @멘션 자동완성
   ================================================================ */
var mentionState = { active:false, members:[], filtered:[], index:0, inputEl:null, atStart:-1 };
function mentionIsActive(){ return mentionState.active; }
function attachMentionAutocomplete(inputId){
  var el=document.getElementById(inputId); if(!el) return;
  mentionState.members=[]; // 모달/화면이 바뀔 때마다 최신 멤버로 재조회
  el.addEventListener('input', onMentionInput);
  el.addEventListener('keydown', onMentionKeydown);
}
async function onMentionInput(ev){
  var el=ev.target; var val=el.value; var pos=el.selectionStart;
  var atIdx=val.lastIndexOf('@', pos-1);
  if(atIdx===-1){ closeMentionDropdown(); return; }
  var query=val.substring(atIdx+1,pos);
  if(/\s/.test(query)){ closeMentionDropdown(); return; }
  if(!currentProjectId){ closeMentionDropdown(); return; }
  if(!mentionState.members.length){
    var r=await ssGetProjectMembers(currentProjectId);
    mentionState.members=r.members||[];
  }
  mentionState.filtered=mentionState.members.filter(m=>(m.name||'').toLowerCase().includes(query.toLowerCase()));
  mentionState.active=mentionState.filtered.length>0;
  mentionState.index=0; mentionState.atStart=atIdx; mentionState.inputEl=el;
  renderMentionDropdown(el);
}
function renderMentionDropdown(el){
  var box=document.getElementById('mention-dropdown');
  if(!mentionState.active){ box.classList.add('hidden'); return; }
  var rect=el.getBoundingClientRect();
  var shown=mentionState.filtered.slice(0,6);
  box.style.left=rect.left+'px';
  box.style.top=Math.max(8, rect.top - shown.length*38 - 8)+'px';
  box.innerHTML=shown.map((m,i)=>
    '<div onclick="selectMention('+i+')" class="flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg" style="'+(i===mentionState.index?'background:var(--surface-2)':'')+'">'+avatarCircle(m.avatar,'w-6 h-6 text-sm')+'<span class="text-body truncate">'+escUser(m.name)+'</span></div>'
  ).join('');
  box.classList.remove('hidden');
}
function onMentionKeydown(ev){
  if(!mentionState.active) return;
  if(ev.key==='ArrowDown'){ ev.preventDefault(); mentionState.index=Math.min(mentionState.index+1,mentionState.filtered.length-1); renderMentionDropdown(mentionState.inputEl); }
  else if(ev.key==='ArrowUp'){ ev.preventDefault(); mentionState.index=Math.max(mentionState.index-1,0); renderMentionDropdown(mentionState.inputEl); }
  else if(ev.key==='Enter'){ ev.preventDefault(); selectMention(mentionState.index); }
  else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeMentionDropdown(); }
}
function selectMention(i){
  var m=mentionState.filtered[i]; if(!m || !mentionState.inputEl) return;
  var el=mentionState.inputEl; var val=el.value; var pos=el.selectionStart;
  var before=val.substring(0, mentionState.atStart);
  var after=val.substring(pos);
  var newVal=before+'@'+m.name+' '+after;
  el.value=newVal;
  var newPos=(before+'@'+m.name+' ').length;
  el.focus(); el.setSelectionRange(newPos,newPos);
  closeMentionDropdown();
}
function closeMentionDropdown(){ mentionState.active=false; var box=document.getElementById('mention-dropdown'); if(box) box.classList.add('hidden'); }
document.addEventListener('click', function(ev){ if(!ev.target.closest || !ev.target.closest('#mention-dropdown')) closeMentionDropdown(); });

/* ================================================================
   #8 작업별 변경 이력 (기존 activity 컬렉션을 taskId로 필터링해 재사용)
   ================================================================ */
var taskHistoryLoaded={};
async function loadTaskHistoryIfNeeded(taskId){
  var box=document.getElementById('task-history-'+taskId); if(!box) return;
  if(taskHistoryLoaded[taskId]) return;
  var r=await ssGetActivity(currentProjectId,300);
  var items=(r.items||[]).filter(a=>a.taskId===taskId);
  box.innerHTML = items.length ? items.map(a=>{
    var meta=ACTIVITY_LABELS[a.type]||{icon:'activity',text:'활동'};
    return '<div class="flex items-start gap-2.5 px-1"><div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style="background:var(--surface-2)">'+icon(meta.icon,'w-3 h-3').replace('class="','style="color:var(--text-2)" class="')+'</div>'
      +'<div class="min-w-0 flex-1"><span class="text-body">'+escHtml(a.actorName)+' · '+escHtml(a.message||meta.text)+'</span><div class="text-meta mt-0.5">'+relDate(a.createdAt)+'</div></div></div>';
  }).join('') : '<p class="text-meta px-1 py-4 text-center">아직 기록이 없습니다</p>';
  taskHistoryLoaded[taskId]=true;
}
/* ---- #2 작업 상세 모달 탭 전환 ---- */
function switchTaskDetailTab(taskId,tab){
  ['overview','subtasks','files','activity'].forEach(function(tb){
    var panel=document.getElementById('task-tab-'+tb+'-'+taskId);
    var btn=document.getElementById('task-tabbtn-'+tb+'-'+taskId);
    if(!panel||!btn) return;
    if(tb===tab){ panel.classList.remove('hidden'); btn.style.color='var(--primary)'; btn.style.borderBottom='2px solid var(--primary)'; }
    else { panel.classList.add('hidden'); btn.style.color='var(--text-3)'; btn.style.borderBottom='2px solid transparent'; }
  });
  if(tab==='activity') loadTaskHistoryIfNeeded(taskId);
}

/* ================================================================
   날짜 변환 헬퍼
   ================================================================ */
function toJsDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  if(typeof v.toDate==='function') return v.toDate();
  var d=new Date(v); return isNaN(d) ? null : d;
}
/* ================================================================
   #11 QR/링크로 프로젝트 참여 처리
   ================================================================ */
async function processPendingJoin(joinParam){
  var parts=joinParam.split(':'); var projectId=parts[0], token=parts[1];
  if(!projectId||!token) return;
  showLoading();
  var r=await ssJoinProjectByToken(projectId, token);
  hideLoading();
  // URL에서 join 파라미터 제거(새로고침 시 재참여 시도 방지)
  var url=new URL(location.href); url.searchParams.delete('join'); history.replaceState({}, '', url);
  if(r.success){
    showToast(r.alreadyMember? (r.projectName+'에 이미 참여 중이에요') : (r.projectName+' 프로젝트에 참여했습니다!'), 'success');
    await loadProjects();
    var proj=allProjects.find(p=>p.id===projectId);
    if(proj) selectProject(projectId);
  } else {
    showToast(r.error||'참여에 실패했습니다','error');
  }
}

/* ================================================================
   #7 CSV / Trello 가져오기
   ================================================================ */
function parseCSV(text){
  var rows=[],row=[],field='',inQuotes=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQuotes=false; }
      else field+=c;
    } else {
      if(c==='"') inQuotes=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c==='\r'){}
      else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  return rows.filter(r=>!(r.length===1 && r[0].trim()===''));
}
var importState={ headers:[], rows:[], mapping:{} };
function guessColumn(headers, patterns){
  for(var i=0;i<headers.length;i++){
    var h=(headers[i]||'').toLowerCase();
    for(var j=0;j<patterns.length;j++){ if(h.indexOf(patterns[j])!==-1) return i; }
  }
  return -1;
}
function showImportModal(){
  if(!currentProjectId){ showToast('프로젝트를 먼저 선택하세요','error'); return; }
  importState={headers:[],rows:[],mapping:{}};
  showModal(modalWrap('CSV / Trello 가져오기',
    '<div id="import-drop" class="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer" style="border-color:var(--border-strong)" onclick="document.getElementById(\'import-file-input\').click()">'
      + icon('upload-cloud','w-6 h-6 mx-auto mb-2').replace('class="','style="color:var(--text-3)" class="')
      + '<div class="text-body">CSV 파일을 선택하세요</div>'
      + '<div class="text-meta mt-1">Trello 내보내기 CSV도 지원해요</div>'
      + '<input type="file" id="import-file-input" accept=".csv" class="hidden" onchange="onImportFileSelected(event)">'
    +'</div>'
    +'<div id="import-preview-area" class="mt-4"></div>',
    '<button onclick="closeModal()" class="btn-secondary">취소</button><div id="import-confirm-slot" class="flex-1"></div>',
    'max-w-2xl'
  ));
}
function onImportFileSelected(ev){
  var file=ev.target.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    var rows=parseCSV(e.target.result);
    if(!rows.length){ showToast('빈 파일이거나 형식을 읽을 수 없어요','error'); return; }
    importState.headers=rows[0];
    importState.rows=rows.slice(1);
    var h=importState.headers;
    importState.mapping={
      title: guessColumn(h,['title','name','제목','card name','작업']),
      description: guessColumn(h,['desc','설명']),
      status: guessColumn(h,['list','status','상태']),
      priority: guessColumn(h,['priority','우선순위']),
      dueDate: guessColumn(h,['due','마감','date'])
    };
    renderImportPreview();
  };
  reader.readAsText(file, 'UTF-8');
}
function mapStatusValue(v){
  v=(v||'').toLowerCase();
  if(/done|완료|closed/.test(v)) return 'done';
  if(/doing|progress|진행/.test(v)) return 'inprogress';
  return 'todo';
}
function mapPriorityValue(v){
  v=(v||'').toLowerCase();
  if(/high|높음|긴급|urgent/.test(v)) return 'high';
  if(/low|낮음/.test(v)) return 'low';
  return 'medium';
}
function renderImportPreview(){
  var area=document.getElementById('import-preview-area');
  var h=importState.headers, m=importState.mapping;
  function fieldSelect(key,label,required){
    var opts='<option value="-1">(사용 안 함)</option>'+h.map((hh,i)=>'<option value="'+i+'" '+(m[key]===i?'selected':'')+'>'+escHtml(hh)+'</option>').join('');
    return '<div><label class="field-label">'+label+(required?' *':'')+'</label><select onchange="importState.mapping[\''+key+'\']=parseInt(this.value);renderImportPreview()" class="input h-9">'+opts+'</select></div>';
  }
  var previewRows=importState.rows.slice(0,5).map(r=>{
    var title=m.title>=0? r[m.title] : '(제목 없음)';
    var status=m.status>=0? mapStatusValue(r[m.status]) : 'todo';
    var priority=m.priority>=0? mapPriorityValue(r[m.priority]) : 'medium';
    var due=m.dueDate>=0? r[m.dueDate] : '';
    return '<tr style="border-bottom:1px solid var(--border)"><td class="py-1.5 pr-2 truncate max-w-[160px]">'+escHtml(title)+'</td><td class="py-1.5 pr-2">'+statusBadge(status)+'</td><td class="py-1.5 pr-2">'+priorityBadge(priority)+'</td><td class="py-1.5 text-meta">'+escHtml(due)+'</td></tr>';
  }).join('');

  area.innerHTML =
    '<div class="grid grid-cols-2 gap-3 mb-4">'
      + fieldSelect('title','제목 컬럼',true) + fieldSelect('description','설명 컬럼')
      + fieldSelect('status','상태 컬럼') + fieldSelect('priority','우선순위 컬럼')
      + fieldSelect('dueDate','마감일 컬럼')
    +'</div>'
    +'<div class="text-meta mb-1.5">미리보기 (상위 5개)</div>'
    +'<div class="card overflow-x-auto"><table class="w-full text-body px-3"><thead><tr class="text-meta" style="border-bottom:1px solid var(--border)"><th class="text-left py-1.5 px-3">제목</th><th class="text-left py-1.5">상태</th><th class="text-left py-1.5">우선순위</th><th class="text-left py-1.5">마감일</th></tr></thead><tbody>'+previewRows+'</tbody></table></div>'
    +'<p class="text-meta mt-3">'+icon('info','w-3 h-3 inline mr-1 -mt-0.5')+'총 <b>'+importState.rows.length+'</b>개 작업을 추가합니다.</p>';

  document.getElementById('import-confirm-slot').innerHTML =
    '<button onclick="doRunImport()" class="btn-primary w-full" '+(m.title<0?'disabled':'')+'>'+icon('upload','w-4 h-4')+'총 '+importState.rows.length+'개 작업 가져오기</button>';
  refreshIcons();
}
async function doRunImport(){
  var m=importState.mapping;
  if(m.title<0){ showToast('제목 컬럼을 선택해주세요','error'); return; }
  showLoading();
  var success=0, failed=0;
  for(var i=0;i<importState.rows.length;i++){
    var r=importState.rows[i];
    var title=(r[m.title]||'').trim();
    if(!title){ failed++; continue; }
    var data={
      title: title,
      description: m.description>=0? (r[m.description]||'') : '',
      status: m.status>=0? mapStatusValue(r[m.status]) : 'todo',
      priority: m.priority>=0? mapPriorityValue(r[m.priority]) : 'medium',
      dueDate: m.dueDate>=0 && r[m.dueDate] ? normalizeImportedDate(r[m.dueDate]) : null
    };
    var res=await ssCreateTask(currentProjectId, data);
    if(res.success) success++; else failed++;
  }
  hideLoading();
  closeModal();
  showToast(success+'개 가져옴'+(failed?', '+failed+'개 실패':''), failed? 'error':'success');
  ssLogActivity(currentProjectId,'task_create',(currentUser.name||'사용자')+'님이 CSV로 작업 '+success+'개를 가져왔습니다');
  refreshCurrentTaskViews(currentProjectId);
}
function normalizeImportedDate(v){
  v=(v||'').trim();
  var d=new Date(v);
  if(isNaN(d)) return null;
  return fmtDate(d);
}

/* ================================================================
   #9 오프라인 모드 표시 (Firestore 오프라인 퍼시스턴스는 firebase-config.js에서 이미 활성화됨)
   ================================================================ */
function markSynced(){ localStorage.setItem('syncspace-last-sync', String(Date.now())); updateOfflineBanner(); }
function updateOfflineBanner(){
  var banner=document.getElementById('offline-banner'); if(!banner) return;
  if(navigator.onLine){ banner.classList.add('hidden'); return; }
  var ts=localStorage.getItem('syncspace-last-sync');
  var label = ts ? new Date(parseInt(ts)).toLocaleTimeString(currentLang==='en'?'en-US':'ko-KR',{hour:'2-digit',minute:'2-digit'}) : '알 수 없음';
  banner.textContent = '오프라인 모드 · 마지막 동기화: '+label+' · 캐시된 데이터만 열람 가능해요';
  banner.classList.remove('hidden');
}
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
document.addEventListener('DOMContentLoaded', updateOfflineBanner);

/* ================================================================
   #10 알림 종류별 설정 (기존 마감 임박 토글은 별도로 유지)
   ================================================================ */
var NOTIF_TYPE_MAP={ mention:'mention', comment_added:'comment', task_assigned:'assign', review_request:'review', chat_message:'chat' };
function getNotifPrefs(){
  var key='syncspace-notifprefs-'+(currentUser?currentUser.uid:'anon');
  var defaults={mention:true,comment:true,assign:true,review:true,chat:true};
  try{ return Object.assign(defaults, JSON.parse(localStorage.getItem(key)||'{}')); }catch(e){ return defaults; }
}
function setNotifPref(type,val){
  var key='syncspace-notifprefs-'+(currentUser?currentUser.uid:'anon');
  var prefs=getNotifPrefs(); prefs[type]=val; localStorage.setItem(key, JSON.stringify(prefs));
}
function notifTypeAllowed(type){
  var prefKey=NOTIF_TYPE_MAP[type]; if(!prefKey) return true;
  return getNotifPrefs()[prefKey]!==false;
}
function doToggleNotifPref(type,checked){ setNotifPref(type,checked); loadNotifications(); }

/* ================================================================
   #1 프로젝트 내부 탭 구조 — 기존 11개 render 함수는 전혀 변경하지 않고
   각 화면 상단에 공통 탭바만 주입한다. 사이드바는 전체/시스템만 남긴다.
   ================================================================ */
var PROJECT_TAB_GROUPS=[
  {key:'overview', label:'대시보드', icon:'layout-dashboard', views:['dashboard']},
  {key:'tasks', label:'작업', icon:'check-square', views:['kanban']},
  {key:'progress', label:'진행률', icon:'gauge', views:['roles']},
  {key:'schedule', label:'일정', icon:'calendar', views:['calendar']},
  {key:'members', label:'멤버', icon:'users', views:['team','chat']}
];
var SUBVIEW_LABELS={kanban:'할 일 목록',calendar:'캘린더',team:'멤버',chat:'채팅'};
// 탭바가 한 줄에 버튼이 너무 많아 복잡해 보인다는 피드백에 따라, 서브탭(칸반/목록 등)과
// 우측 고정 버튼은 알림 종 하나만 남겼다. 이동 가능한 화면(showView)은
// 전부 그대로이며 배치만 정리한 것 — 기능 삭제는 없음.
function projectTabBar(currentViewName){
  if(!currentProjectId) return '';
  var group=PROJECT_TAB_GROUPS.find(g=>g.views.indexOf(currentViewName)!==-1) || PROJECT_TAB_GROUPS[0];
  var tabs=PROJECT_TAB_GROUPS.map(g=>{
    var active=g.key===group.key;
    return '<button onclick="showView(\''+g.views[0]+'\')" class="flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-[13px] font-medium shrink-0 transition-colors" style="'+(active?'background:var(--primary-soft);color:var(--primary-soft-text)':'color:var(--text-2)')+'">'+icon(g.icon,'w-3.5 h-3.5')+g.label+'</button>';
  }).join('');
  var subToggle='';
  if(group.views.length>1){
    subToggle='<button onclick="openSubtabMenu(event,\''+group.key+'\',\''+currentViewName+'\')" class="tabbar-popover-trigger flex items-center gap-1 ml-1 pl-2.5 pr-2 h-7 rounded-md text-[12px] font-medium shrink-0" style="border-left:1px solid var(--border);color:var(--text-2)">'
      +(SUBVIEW_LABELS[currentViewName]||'')+icon('chevron-down','w-3 h-3').replace('class="','style="color:var(--text-3)" class="')+'</button>';
  }
  var bellBtn='<button onclick="openNotifPopover(event)" class="tabbar-popover-trigger icon-btn shrink-0 relative" title="알림" aria-label="알림 열기">'+icon('bell','w-4 h-4')
    +'<span class="tabbar-bell-badge" style="display:'+(notificationCount>0?'flex':'none')+';position:absolute;top:1px;right:1px;min-width:15px;height:15px;padding:0 4px;border-radius:999px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;line-height:1">'+(notificationCount>99?'99+':notificationCount)+'</span></button>';
  return '<div class="px-6 pt-4 -mb-1"><div class="flex items-center gap-1 overflow-x-auto pb-3" style="border-bottom:1px solid var(--border)">'+tabs+subToggle+'<div class="flex-1"></div>'+bellBtn+'</div></div>';
}
function openSubtabMenu(ev,groupKey,currentViewName){
  var group=PROJECT_TAB_GROUPS.find(g=>g.key===groupKey); if(!group) return;
  var itemsHtml=group.views.map(function(v){
    var active=v===currentViewName;
    return '<button onclick="closeTabbarPopover();showView(\''+v+'\')" class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-[13px] font-medium" style="'+(active?'background:var(--primary-soft);color:var(--primary-soft-text)':'color:var(--text)')+'">'
      +'<span>'+(SUBVIEW_LABELS[v]||v)+'</span>'+(active?icon('check','w-3.5 h-3.5'):'')+'</button>';
  }).join('');
  toggleTabbarPopover(ev,itemsHtml);
}
var tabbarPopoverTrigger=null;
function closeTabbarPopover(){
  var el=document.getElementById('tabbar-popover'); if(el) el.remove();
  tabbarPopoverTrigger=null;
}
function toggleTabbarPopover(ev,itemsHtml){
  ev.stopPropagation();
  var triggerEl=ev.currentTarget;
  var wasOpenForThis=(tabbarPopoverTrigger===triggerEl);
  closeTabbarPopover();
  if(wasOpenForThis) return;
  tabbarPopoverTrigger=triggerEl;
  var rect=triggerEl.getBoundingClientRect();
  var pop=document.createElement('div');
  pop.id='tabbar-popover';
  pop.style.cssText='position:fixed;top:'+(rect.bottom+6)+'px;left:'+rect.left+'px;min-width:150px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:4px;z-index:70;';
  pop.innerHTML=itemsHtml;
  document.body.appendChild(pop);
  requestAnimationFrame(function(){
    var pr=pop.getBoundingClientRect();
    if(pr.right>window.innerWidth-8){ pop.style.left=Math.max(8,window.innerWidth-pr.width-8)+'px'; }
  });
  refreshIcons();
}
document.addEventListener('click',function(ev){
  if(!tabbarPopoverTrigger) return;
  if(ev.target.closest('#tabbar-popover') || ev.target===tabbarPopoverTrigger || tabbarPopoverTrigger.contains(ev.target)) return;
  closeTabbarPopover();
});
document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') closeTabbarPopover(); });

/* ================================================================
   #3 모바일 드래그 대체 UI — 칸반 카드의 빠른 상태 변경 메뉴
   (HTML5 드래그 API는 터치 환경에서 기본 동작하지 않으므로 버튼 기반 대안 제공)
   ================================================================ */
function showQuickStatusMenu(taskId,currentStatus){
  var opts=[['todo','할 일','circle-dashed'],['inprogress','진행 중','loader'],['done','완료','check-circle-2']];
  showModal(modalWrap('상태 변경',
    '<div class="space-y-1.5">'+opts.map(o=>
      '<button onclick="closeModal();doQuickChangeStatus(\''+taskId+'\',\''+o[0]+'\')" class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left" style="'+(o[0]===currentStatus?'background:var(--primary-soft);color:var(--primary-soft-text)':'background:var(--surface-2);color:var(--text)')+'">'
      +icon(o[2],'w-4 h-4')+'<span class="text-body font-medium">'+o[1]+'</span>'+(o[0]===currentStatus?'<span class="ml-auto">'+icon('check','w-4 h-4')+'</span>':'')
      +'</button>'
    ).join('')+'</div>',
    ''
  ));
}
async function doQuickChangeStatus(taskId,status){
  showLoading();
  var tasksR=await ssGetTasks(currentProjectId); var task=(tasksR.tasks||[]).find(t=>t.id===taskId);
  var r=await ssMoveTask(taskId,status);
  if(status==='done') await ssUpdateTask(taskId,{completedAt: firebase.firestore.FieldValue.serverTimestamp()});
  hideLoading();
  if(r.success){
    showToast('상태가 변경되었습니다','success');
    ssLogActivity(currentProjectId,'task_status',(currentUser.name||'사용자')+'님이 작업 상태를 변경했습니다: '+status, taskId);
    if(status==='done' && task) maybeCreateNextRecurrence(task);
    refreshCurrentTaskViews(currentProjectId);
  }
}

/* ================================================================
   #A4 작업 정렬 옵션 확장 (기본순/마감일순/담당자순/최신생성순)
   ================================================================ */
function sortTasksBy(items, sortBy){
  if(sortBy==='dueDate') return items.slice().sort((a,b)=>(a.dueDate||'9999-99-99').localeCompare(b.dueDate||'9999-99-99'));
  if(sortBy==='assignee') return items.slice().sort((a,b)=>(a.assigneeName||'zzz').localeCompare(b.assigneeName||'zzz'));
  if(sortBy==='created') return items.slice().sort((a,b)=>{
    var ad=toJsDate(a.createdAt), bd=toJsDate(b.createdAt);
    return (bd?bd.getTime():0) - (ad?ad.getTime():0);
  });
  return items; // 'order' — ssGetTasks가 이미 order 기준으로 정렬해 반환
}

/* ================================================================
   #A3 주간 요약 (이메일 다이제스트 대체 — 서버리스 함수 없이 인앱으로 제공)
   실제 이메일 발송에는 Cloud Functions 등 백엔드가 필요해 이번 범위에서는
   로그인 시 확인할 수 있는 인앱 요약으로 같은 가치를 제공한다.
   ================================================================ */
async function showWeeklyDigest(){
  showModal(modalWrap('주간 요약','<div class="py-10 flex justify-center">'+icon('loader-circle','w-6 h-6 animate-spin').replace('class="','style="color:var(--text-3)" class="')+'</div>',''));
  if(allProjects.length===0) await loadProjects();
  var weekAgo=new Date(); weekAgo.setDate(weekAgo.getDate()-7); weekAgo.setHours(0,0,0,0);
  var today=new Date(); today.setHours(0,0,0,0);
  var in7=new Date(today); in7.setDate(in7.getDate()+7);

  var results=await Promise.all(allProjects.map(p=>ssGetTasks(p.id).then(r=>({p,r}))));
  var completed=[], dueSoon=[], myTaskTotal=0;
  results.forEach(({p,r})=>{
    (r.tasks||[]).forEach(t=>{
      if(t.assigneeId!==currentUser.uid) return;
      myTaskTotal++;
      if(t.status==='done'){
        var c=toJsDate(t.completedAt)||toJsDate(t.updatedAt);
        if(c && c>=weekAgo) completed.push({...t, projectName:p.name});
      } else if(t.dueDate){
        var d=new Date(t.dueDate);
        if(d>=today && d<=in7) dueSoon.push({...t, projectName:p.name});
      }
    });
  });
  var notifR=await ssGetNotifications();
  var unread=(notifR.notifications||[]).filter(n=>!n.read).length;

  function miniList(items,emptyText){
    if(!items.length) return '<p class="text-meta py-2">'+emptyText+'</p>';
    return '<div class="space-y-1.5">'+items.slice(0,6).map(t=>
      '<div class="flex items-center justify-between text-body"><span class="truncate">'+escUser(t.title)+'</span><span class="text-meta shrink-0 ml-2">'+escHtml(t.projectName)+(t.dueDate?' · '+t.dueDate:'')+'</span></div>'
    ).join('')+'</div>';
  }

  var body =
    '<p class="text-meta mb-4">'+fmtDate(weekAgo)+' ~ '+fmtDate(today)+' 기준</p>'
    +'<div class="grid grid-cols-3 gap-2 mb-5">'
      + kpiCard('check-circle-2','완료',completed.length,'최근 7일','var(--success)','var(--success-soft)')
      + kpiCard('alarm-clock','마감 임박',dueSoon.length,'앞으로 7일','var(--warning)','var(--warning-soft)')
      + kpiCard('bell','안 읽은 알림',unread,'전체 프로젝트','var(--primary)','var(--primary-soft)')
    +'</div>'
    +'<h4 class="text-card-title mb-2">'+icon('check-circle-2','w-4 h-4 inline mr-1 -mt-0.5')+'이번 주 완료한 작업</h4>'
    + miniList(completed,'완료한 작업이 없어요')
    +'<div class="my-4" style="border-top:1px solid var(--border)"></div>'
    +'<h4 class="text-card-title mb-2">'+icon('alarm-clock','w-4 h-4 inline mr-1 -mt-0.5')+'다가오는 마감'+'</h4>'
    + miniList(dueSoon,'다가오는 마감이 없어요');

  showModal(modalWrap('주간 요약', body,
    '<button onclick="closeModal();showView(\'mytasks\')" class="btn-secondary">내 작업 전체 보기</button><button onclick="closeModal()" class="btn-primary">확인</button>',
    'max-w-lg'
  ));
}
