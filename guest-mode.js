/* 게스트 모드: 로그인 없이 예시 데이터로 둘러보기 (서버/DB에는 아무것도 읽거나 쓰지 않는다) */
(function(){
  function d(n){var x=new Date();x.setDate(x.getDate()+n);return fmtDate(x)}
  window.__T=[
   {id:'t1',title:'사용자 인터뷰 인사이트 정리',status:'inprogress',priority:'high',dueDate:d(0),assigneeId:'u1',assigneeName:'게스트',tags:[]},
   {id:'t2',title:'홈 화면 와이어프레임 검토',status:'todo',priority:'medium',dueDate:d(1),assigneeId:'u1',assigneeName:'게스트',tags:[]},
   {id:'t3',title:'브랜드 가이드 최종본 공유',status:'todo',priority:'low',dueDate:d(4),assigneeId:'u2',assigneeName:'박서연',tags:[]},
   {id:'t4',title:'주간 스프린트 회고 작성',status:'done',priority:'medium',dueDate:d(-1),assigneeId:'u1',assigneeName:'게스트',tags:[]},
   {id:'t5',title:'칸반 드래그 앤 드롭 버그 수정',status:'inprogress',priority:'high',dueDate:d(-2),assigneeId:'u3',assigneeName:'최도윤',tags:[]},
   {id:'t6',title:'Firebase 규칙 점검',status:'done',priority:'low',dueDate:d(-3),assigneeId:'u1',assigneeName:'게스트',tags:[]},
   {id:'t7',title:'캘린더 월간 화면 QA',status:'todo',priority:'medium',dueDate:d(3),assigneeId:'u1',assigneeName:'게스트',tags:[]}];
  var M=[{uid:'u1',name:'게스트',email:'guest@example.com',avatar:'게',role:'owner'},{uid:'u2',name:'박서연',email:'seoyeon@example.com',avatar:'박',role:'editor'},{uid:'u3',name:'최도윤',email:'doyun@example.com',avatar:'최',role:'editor'},{uid:'u4',name:'이지안',email:'jian@example.com',avatar:'이',role:'editor'},{uid:'u5',name:'정하늘',email:'haneul@example.com',avatar:'정',role:'viewer'}];
  var MSG=[{id:'m1',authorId:'u2',authorName:'박서연',authorAvatar:'박',content:'오늘 디자인 리뷰 전에 사용자 인터뷰 인사이트를 먼저 공유해 주실 수 있을까요?',createdAt:new Date(Date.now()-3600000).toISOString()},{id:'m2',authorId:'u1',authorName:'게스트',authorAvatar:'게',content:'네, 주요 발견점과 개선 제안을 정리해서 11시 전까지 올려둘게요.',createdAt:new Date(Date.now()-3000000).toISOString()},{id:'m3',authorId:'u3',authorName:'최도윤',authorAvatar:'최',content:'API 명세 관련 변경 사항은 개발 채널에 정리해 두었습니다.',createdAt:new Date(Date.now()-600000).toISOString()}];
  function boot(){
    currentUser={uid:'u1',name:'게스트',email:'guest@example.com',avatar:'😀'}; isLoggedIn=true;
    currentProject={id:'p1',name:'Syncspace 협업앱',color:'6C5CE7',icon:'🚀',description:'팀 협업과 일정 관리를 한곳에서 — 졸업 프로젝트',progress:64,ownerId:'u1',memberRoles:{},memberEmails:M.map(function(m){return m.email}),members:[]};
    currentProjectId='p1'; allProjects=[currentProject];
    window.loadProjects=async function(){return allProjects};
    window.ssGetTasks=async function(){return {success:true,tasks:__T}};
    window.ssMoveTask=async function(id,st){var t=__T.find(function(x){return x.id===id}); if(t)t.status=st; return {success:true}};
    window.ssGetProjectMembers=async function(){return {success:true,members:M}};
    window.ssGetPendingInvites=async function(){return {success:true,invites:[]}};
    window.ssGetMemberProgress=async function(){return {success:true,items:[{uid:'u1',part:'frontend',percent:70,done:false},{uid:'u2',part:'design',percent:100,done:true},{uid:'u3',part:'backend',percent:45,done:false}]}};
    window.ssGetEvents=async function(){return {success:true,events:[{id:'e1',title:'제품팀 데일리 스탠드업',date:fmtDate(new Date()),time:'10:00',type:'event',color:'6C5CE7'},{id:'e2',title:'디자인 리뷰',date:fmtDate(new Date()),time:'14:00',type:'event',color:'60A5FA'},{id:'e3',title:'개발팀 핸드오프',date:fmtDate(new Date()),time:'16:30',type:'deadline',color:'F59E0B'},{id:'e4',title:'스프린트 회고',date:d(2),time:'11:00',type:'event',color:'6C5CE7'}]}};
    window.ssGetNotifications=async function(){return {success:true,notifications:[{id:'n1',type:'task_assigned',message:'홈 화면 와이어프레임 검토',read:false,createdAt:new Date().toISOString()},{id:'n2',type:'mention',message:'박서연님이 회원님을 언급했어요',read:false,createdAt:new Date(Date.now()-1800000).toISOString()},{id:'n3',type:'project_invite',message:'최도윤님이 프로젝트에 참여했어요',read:true,createdAt:new Date(Date.now()-86400000).toISOString()}]}};
    window.ssGetChatMessages=async function(){return {success:true,messages:MSG}};
    window.ssGetRecentChatMessages=async function(){return {success:true,messages:MSG}};
    window.ssSendChatMessage=async function(pid,c){MSG.push({id:'m'+Date.now(),authorId:'u1',authorName:'게스트',authorAvatar:'게',content:c,createdAt:new Date().toISOString()});return {success:true}};
    window.startChatListener=function(){}; window.stopChatListener=function(){};
    window.ssNotifyMentions=function(){}; window.ssCreateNotification=function(){}; window.ssLogActivity=function(){};
    window.ssMarkChatRead=function(){};
    window.doCreateDemoProject=function(){ closeModal(); showToast('게스트 모드에서는 예시 데이터가 이미 채워져 있어요','info'); };
    var RO='게스트 모드에서는 둘러보기만 가능해요. 가입하면 직접 만들 수 있어요'; var lastToast=0; function roToast(){ var n=Date.now(); if(n-lastToast>3000){ lastToast=n; showToast(RO,'info'); } }
    Object.keys(window).filter(function(k){return /^ss(Create|Update|Delete|Remove|Add|Set|Invite|Enable|Disable|Assign|Transfer|Change|Join|Save|Toggle|Upload|Archive|Restore|Leave|Accept|Decline|Duplicate|Reorder|Rename)/.test(k) && typeof window[k]==='function' && ['ssSetMyProgress'].indexOf(k)<0 || /^ss(CreateTask|CreateEvent|UpdateTask|DeleteTask)/.test(k)}).forEach(function(k){
      window[k]=async function(){ roToast(); return {success:false,error:RO}; };
    });
    ['ssCreateNotification','ssLogActivity','ssNotifyMentions','ssMarkChatRead','ssMarkNotificationRead','ssMarkAllNotificationsRead'].forEach(function(k){ window[k]=function(){ return Promise.resolve({success:true}); }; });
    window.ssSetMyProgress=async function(){ roToast(); return {success:false,error:RO}; };
    window.ssSendChatMessage=async function(){ roToast(); return {success:false,error:RO}; };
    window.ssMoveTask=async function(){ roToast(); return {success:false,error:RO}; };
    window.doLogout=function(){ location.href=location.pathname; };
    window.syncChatUnreadListener=function(){}; window.isGuestMode=true;
    var sb=document.getElementById('sidebar'); if(sb) sb.style.display='';
    document.querySelectorAll('.app-topbar,.app-tabbar').forEach(function(e){e.style.display=''});
    var mn=document.querySelector('main'); if(mn) mn.style.marginLeft='';
    var nm=document.getElementById('user-area'); if(nm) nm.textContent='게스트';
    var av=document.getElementById('side-user-avatar'); if(av) av.textContent='게';
    try{updateProjectChrome()}catch(e){}
    var b=document.createElement('div'); b.innerHTML='게스트 모드 · 예시 데이터로 둘러보는 중이에요 &nbsp;<a href="'+location.pathname+'" style="color:#C9C2FF;text-decoration:underline;pointer-events:auto">가입/로그인</a>';
    b.style.cssText='position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:90;background:#292B38;color:#fff;font-size:12px;padding:6px 12px;border-radius:999px;opacity:.88;pointer-events:none;white-space:nowrap';
    document.body.appendChild(b);
    showView('dashboard');
  }
  window.startGuestMode=boot;
})();
