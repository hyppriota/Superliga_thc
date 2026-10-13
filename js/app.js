/* ===== APP: estado, navegación, acciones del editor y arranque ===== */
let db={temporadas:[],teams:[],players:[],matches:[],cup:[],cupPlayers:[]};
let edit=false,loaded=false;
const S={view:'tablas',div:'thc',round:null,team:null,q:'',formDir:'prev',copaView:'lista',bracketSel:null,h2h:null,evOpen:null};
const VIEWS=['tablas','fixture','copa','jugadores','equipos','disciplina','h2h','buscar','editor'];
const app=document.getElementById('app');

/* ---- Navegación con la URL (#/vista?parametros) ----
   Permite usar el botón Atrás del navegador/celular y compartir links
   directos a un equipo, una fecha del fixture o una llave de copa. */
function stateToHash(){
 const p=new URLSearchParams();
 switch(S.view){
  case'tablas':case'jugadores':p.set('div',S.div);break;
  case'fixture':p.set('div',S.div);if(S.round!=null)p.set('round',S.round);break;
  case'copa':if(S.copaView==='bracket')p.set('ver','bracket');if(S.bracketSel)p.set('llave',S.bracketSel);break;
  case'equipos':if(S.team){p.set('team',S.team);if(S.formDir==='next')p.set('forma','next')}break;
  case'h2h':if(S.h2h){p.set('a',S.h2h.a);p.set('b',S.h2h.b)}break;
  case'buscar':if(S.q)p.set('q',S.q);break;
 }
 const qs=p.toString();
 return'#/'+S.view+(qs?'?'+qs:'');
}
function hashToState(){
 const[v,qs]=curHash.replace(/^#\/?/,'').split('?');
 const p=new URLSearchParams(qs||'');
 S.view=VIEWS.includes(v)?v:'tablas';
 if(DIVS[p.get('div')])S.div=p.get('div');
 S.round=p.has('round')?+p.get('round'):null;
 S.copaView=p.get('ver')==='bracket'?'bracket':'lista';
 S.bracketSel=p.get('llave');
 S.team=p.get('team');
 S.formDir=p.get('forma')==='next'?'next':'prev';
 S.h2h=p.get('a')&&p.get('b')?{a:p.get('a'),b:p.get('b')}:null;
 if(S.view==='buscar')S.q=p.get('q')||'';
 S.evOpen=null;
}
/* La URL guarda la vista. Si el navegador no deja tocar el historial (por ejemplo,
   dentro de una vista previa incrustada), se navega igual con una pila propia. */
let curHash=location.hash;const ownStack=[];let historyOK=true;
try{history.scrollRestoration='manual'}catch(e){historyOK=false}
function navigate(hash,{replace=false,keepScroll=false}={}){
 const cur=(historyOK&&history.state)||{d:0};
 try{
  if(replace)history.replaceState({...cur,y:keepScroll?scrollY:0},'',hash);
  else{history.replaceState({...cur,y:scrollY},'');history.pushState({d:(cur.d||0)+1,y:0},'',hash)}
 }catch(e){historyOK=false}
 if(!historyOK&&!replace)ownStack.push({hash:curHash,y:scrollY});
 curHash=hash;hashToState();render();
 if(!keepScroll)scrollTo(0,0);
}
function go(v,extra,opts={}){if(extra)Object.assign(S,extra);S.view=v;navigate(stateToHash(),opts)}
function goBack(){
 if(historyOK&&(history.state?.d||0)>0)return history.back();
 const prev=ownStack.pop();
 if(prev){curHash=prev.hash;hashToState();render();scrollTo(0,prev.y)}else go('equipos',{team:null},{replace:true});
}
function goH2H(a,b){go('h2h',{h2h:{a,b}})}
addEventListener('popstate',e=>{if(!loaded)return;curHash=location.hash;hashToState();render();scrollTo(0,e.state?.y||0)});
document.addEventListener('click',e=>{
 const a=e.target.closest('a[href^="#/"]');
 if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 e.preventDefault();navigate(a.getAttribute('href'));
});

/* ---- Búsqueda (espera a que termines de escribir) ---- */
let searchT;
function onSearch(v){
 clearTimeout(searchT);
 searchT=setTimeout(()=>{
  if(v.trim())go('buscar',{q:v},{replace:S.view==='buscar'});
  else if(S.view==='buscar')go('tablas',null,{replace:true});
 },200);
}
function clearSearch(){const q=document.getElementById('q');if(q.value){q.value='';S.q=''}}

/* ---- Render ---- */
const TABS=[['tablas','Posiciones'],['fixture','Fixture'],['copa','Copa'],['jugadores','Estadísticas'],['equipos','Equipos'],['disciplina','Disciplina']];
function render(){
 if(!loaded)return;
 if(S.view==='editor'&&!edit)S.view='tablas';
 const tabs=edit?[...TABS,['editor','Editor']]:TABS;
 document.getElementById('nav').innerHTML=tabs.map(([k,l])=>`<button class="${S.view===k||(S.view==='h2h'&&k==='equipos')?'on':''}" onclick="clearSearch();go('${k}')">${l}</button>`).join('');
 const eb=document.getElementById('eb');eb.className='eb'+(edit?' on':'');eb.textContent=edit?'Editando':'Editor';
 app.innerHTML=(V[S.view]||V.tablas)();
 const tt=S.view==='equipos'&&T(S.team)?T(S.team).name:(TABS.find(x=>x[0]===S.view)||[])[1];
 document.title=(tt?tt+' · ':'')+'SuperLiga THC';
}

/* ---- Acciones del editor ----
   Cada cambio: se aplican las reglas automáticas (copa, estadísticas),
   se redibuja al instante y se guarda en segundo plano solo lo que cambió. */
let lastDecided={}; // llaves definidas en el último estado ya procesado
/* Deshacer: se guarda cómo estaba todo después del último cambio; el siguiente cambio
   ofrece volver a ese estado durante unos segundos. Solo el último cambio. */
let lastState=null;
const snapshot=()=>JSON.stringify({teams:db.teams,players:db.players,matches:db.matches,cup:db.cup,cupPlayers:db.cupPlayers});
function commit(label){
 const prev=lastState;
 applyRules();render();if(edit)Data.save(db);
 announceCup(lastDecided);
 lastDecided=decidedLlaves();
 lastState=snapshot();
 if(edit&&label!==false&&prev)toast(label||'Cambio guardado','info',6000,{label:'Deshacer',fn:()=>undo(prev)});
}
function undo(prev){
 Object.assign(db,JSON.parse(prev));
 S.evOpen=S.evOpen&&findM(S.evOpen)?S.evOpen:null;
 commit(false);
 toast('Cambio deshecho','ok',2500);
}
/* Avisos de copa: cuando un cambio define una llave, avisa quién pasa y a qué ronda. */
function decidedLlaves(){const s={};[...new Set(db.cup.map(c=>c.llave))].forEach(ll=>{const a=llaveAgg(ll);if(a?.decided)s[ll]=a.winner});return s}
function announceCup(before){
 if(!edit)return;
 const now=decidedLlaves();
 Object.entries(now).forEach(([ll,w])=>{
  if(before[ll]===w)return;
  const fase=ll.split('-')[0],name=T(w)?.name||'?';
  if(fase==='FINAL')toast(`🏆 ${name} es campeón de la Copa THC`,'ok',8000);
  else{
   const next=CUP_FASES[CUP_FASES.indexOf(fase)+1];if(!next)return;
   const nl=`${next}-${String(Math.ceil(parseInt(ll.split('-')[1],10)/2)).padStart(2,'0')}`,ida=cupLeg(nl,1);
   const created=ida&&(ida.home===w||ida.away===w);
   toast(`${name} pasa a ${next==='FINAL'?'la final':next.toLowerCase()} · ${created?`el partido vs ${T(ida.home===w?ida.away:ida.home)?.name} ya quedó creado`:'espera rival'}`,'ok',6000);
  }
 });
}
const findM=id=>db.matches.find(x=>x.id===id)||db.cup.find(x=>x.id===id);

function upd(id,k,v){
 const m=findM(id);if(!m)return;
 const kickoff=k==='status'&&v==='vivo'&&m.status!=='vivo';
 const finish=k==='status'&&v==='fin'&&m.status!=='fin';
 if(k==='hg'||k==='ag')m[k]=v===''?0:Math.max(0,+v||0);
 else if(k==='pl'||k==='pv')m[k]=v===''?null:Math.max(0,+v||0);
 else m[k]=v===''?null:v;
 const ST={prox:'Próximo',vivo:'En juego',fin:'Finalizado'};
 commit(k==='status'?`Estado: ${ST[v]||v}`:(k==='hg'||k==='ag')?'Marcador cambiado':(k==='pl'||k==='pv')?'Penales cambiados':(k==='home'||k==='away')?'Equipo cambiado':'Cambio guardado');
 if(kickoff)setTimeout(()=>suspensionAlert(m),0); // al pasar a "En juego": avisa quién no puede jugar
 if(finish)setTimeout(()=>finishReview(m),0);    // al finalizar: revisa la carga y las suspensiones cumplidas
}
async function del(kind,id){
 const list=db[kind];const item=list&&list.find(x=>x.id===id);if(!item)return;
 let msg='¿Eliminar?';
 if(kind==='teams'){
  const np=db.players.filter(p=>p.team===id).length,nm=[...db.matches,...db.cup].filter(m=>m.home===id||m.away===id).length;
  if(np||nm){toast(`No se puede eliminar ${item.name}: tiene ${np} jugador${np===1?'':'es'} y ${nm} partido${nm===1?'':'s'}. Borralos o reasignalos primero.`,'error',6000);return}
  msg=`¿Eliminar el equipo ${item.name}?`;
 }else if(kind==='players'){
  const nev=[...db.matches,...db.cup].reduce((s,m)=>s+(m.ev||[]).filter(e=>e.p===id).length,0);
  msg=`¿Eliminar a ${item.name}?`+(nev?` Tiene ${nev} evento${nev===1?'':'s'} cargado${nev===1?'':'s'} (goles, tarjetas o MVP) que se perderían de las estadísticas.`:'');
 }else{
  msg=`¿Eliminar el partido ${T(item.home)?.name||'?'} vs ${T(item.away)?.name||'?'}?`;
 }
 if(!await confirmDialog(msg))return;
 db[kind]=list.filter(x=>x.id!==id);
 commit(kind==='teams'||kind==='players'?`${item.name} eliminado`:'Partido eliminado');
}
function setCaptain(id){const p=db.players.find(x=>x.id===id);if(!p)return;const was=p.captain;db.players.filter(x=>x.team===p.team).forEach(x=>x.captain=false);p.captain=!was;commit(p.captain?`${p.name} es capitán`:'Capitán quitado')}
function setPos(id,v){const p=db.players.find(x=>x.id===id);if(!p)return;p.position=v||null;commit('Posición cambiada')}
function setTF(id,k,v){const t=T(id);if(!t)return;t[k]=v.trim()||null;commit(k==='dt'?'DT cambiado':k==='stadium'?'Estadio cambiado':'Cambio guardado')}
function bumpDone(id,isCup,delta){const p=(isCup?db.cupPlayers:db.players).find(x=>x.id===id);if(!p)return;p.suspDone=Math.max(0,(p.suspDone||0)+delta);commit(delta>0?`Suspensión de ${p.name} cumplida`:`Suspensión de ${p.name} restaurada`)}

function toggleEv(id){S.evOpen=S.evOpen===id?null:id;render()}
/* El marcador sigue a los goles cargados mientras estén "en sintonía": si el marcador
   coincidía con los goles antes del cambio, se actualiza solo. Si lo escribiste a mano
   distinto, no se toca (y el editor muestra el aviso de diferencia). */
function syncScore(m,wasInSync){
 if(!wasInSync)return;
 const g=evGoals(m);
 if(g.h!==m.hg||g.a!==m.ag){m.hg=g.h;m.ag=g.a;toast(`Marcador: ${T(m.home)?.name} ${m.hg}-${m.ag} ${T(m.away)?.name}`,'info',2500)}
}
const inSync=m=>{const g=evGoals(m);return g.h===m.hg&&g.a===m.ag};
function addEv(id){
 const m=findM(id),t=document.getElementById('et').value;
 m.ev=m.ev||[];
 const was=inSync(m);
 if(t==='OG'){m.ev.push({t:'OG',team:document.getElementById('eteam').value});syncScore(m,was);commit('Autogol agregado');return}
 const p=document.getElementById('ep').value;
 if(!p)return toast('Elegí un jugador','error');
 const susp=suspendedFor(m).find(r=>r.p.id===p); // ¿estaba suspendido para este partido?
 if(t==='M')m.ev=m.ev.filter(e=>e.t!=='M'); // un solo MVP por partido
 m.ev.push({p,t});LASTP[id]=p;
 if(t==='G')syncScore(m,was);
 commit({G:'Gol',Y:'Amarilla',R:'Roja',M:'MVP'}[t]+` de ${anyP(p)?.name} `+(t==='Y'||t==='R'?'agregada':'agregado'));
 if(susp)toast(`⚠ ${susp.p.name} estaba suspendido para este partido (${[susp.genY?'amarillas':'',susp.genR?'roja':''].filter(Boolean).join(' y ')}). Revisá si hubo alineación indebida.`,'error',8000);
 // Tarjeta que genera una suspensión nueva en esta competición
 if(t==='Y'||t==='R'){
  const isCup=!!m.llave,c=cardsOf(p,isCup),prev={y:c.y-(t==='Y'),r:c.r-(t==='R')};
  if(suspGen(c,isCup)>suspGen(prev,isCup))toast(`🚫 ${anyP(p)?.name} queda suspendido para el próximo partido de ${isCup?'copa':'liga'} (${t==='R'?'roja':`${c.y} amarillas`}).`,'error',7000);
 }
}
function delEv(id,i){
 const m=findM(id),was=inSync(m),e=m.ev[i];
 m.ev.splice(i,1);
 if(e&&(e.t==='G'||e.t==='OG'))syncScore(m,was);
 commit('Evento quitado');
}

const val=id=>document.getElementById(id).value;
function addTeam(){
 const n=val('tnm').trim();if(!n)return toast('Escribí un nombre','error');
 if(db.teams.some(t=>t.name.toLowerCase()===n.toLowerCase()))return toast('Ya existe un equipo con ese nombre','error');
 db.teams.push({id:uid('t'),name:n,div:val('td'),fed:val('tf')||null});commit(`Equipo ${n} agregado`);
}
function addPlayer(){
 const n=val('pn').trim(),team=val('pt');if(!n||!team)return toast('Completá el nombre y el equipo','error');
 db.players.push({id:uid('p'),name:n,team,position:val('pp')||null,goals:0,mvp:0,yc:0,rc:0,seasonId:SEASON_ID});
 document.getElementById('pn').value='';commit(`${n} agregado a ${T(team)?.name}`);
}
function addMatch(){
 const r=+val('mr'),h=val('mh'),a=val('ma');
 if(!r||h===a)return toast('Indicá la fecha y dos equipos distintos','error');
 db.matches.push({id:uid('m'),div:val('md'),round:r,home:h,away:a,hg:0,ag:0,status:'prox',ev:[],season_id:SEASON_ID});
 commit('Partido agregado');go('fixture',{div:val('md'),round:r});
}
function addCup(){
 const l=val('cl').trim(),h=val('ch'),a=val('cw'),leg=+val('cg');
 if(!l||!h||!a||h===a)return toast('Indicá la llave y dos equipos distintos','error');
 if(cupLeg(l,leg))return toast(`Ya existe el partido ${leg} de la llave ${l}`,'error');
 db.cup.push({id:uid('c'),fase:val('cf'),llave:l,leg,home:h,away:a,hg:0,ag:0,pl:null,pv:null,status:'prox',ev:[],season_id:SEASON_ID});
 commit('Partido de copa agregado');go('copa');
}
function exportBackup(){
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,1)],{type:'application/json'}));
 a.download=`superliga-thc-respaldo-${new Date().toISOString().slice(0,10)}.json`;a.click();
}
function importBackup(el){
 const f=el.files[0];el.value='';if(!f)return;
 const r=new FileReader();
 r.onload=async()=>{
  let d;try{d=JSON.parse(r.result);if(!d.teams||!d.matches)throw 0}catch(e){return toast('El archivo no tiene el formato esperado (teams, players, matches, cup).','error',6000)}
  if(!await confirmDialog(`Esto reemplaza TODOS los datos en Supabase por los del archivo (${d.teams.length} equipos, ${(d.players||[]).length} jugadores, ${d.matches.length} partidos). ¿Seguir?`,'Reemplazar'))return;
  d.players=d.players||[];d.cup=d.cup||[];d.cupPlayers=d.cupPlayers||[];d.temporadas=db.temporadas;
  db=d;applyRules();lastDecided=decidedLlaves();lastState=snapshot();render();
  await Data.save(db,{allowMass:true});
  if(Data.status!=='error')toast('Datos importados','ok');
 };
 r.readAsText(f);
}

/* ---- Sesión de editor ---- */
async function toggleEdit(){
 if(!edit){
  if(!await loginDialog())return;
  edit=true;render();toast('Modo editor activado','ok');
  Data.save(db); // guarda lo que las reglas automáticas hayan completado
  pendingReview();
 }else{
  if(Data.hasUnsaved()&&!await confirmDialog('Hay cambios que todavía no se guardaron. ¿Salir del modo editor igual?','Salir'))return;
  await sb.auth.signOut();edit=false;render();toast('Saliste del modo editor');
 }
}
sb.auth.onAuthStateChange((event,session)=>{
 if(!loaded)return;
 if(event==='SIGNED_OUT'&&edit){edit=false;render();toast('Tu sesión de editor se cerró.','info',5000)}
});
addEventListener('beforeunload',e=>{if(edit&&Data.hasUnsaved()){e.preventDefault();e.returnValue=''}});
Data.onStatus(showSaveStatus);

/* ---- Arranque ---- */
async function boot(){
 app.innerHTML='<div class="boot"><div class="spin"></div>Cargando la liga…</div>';
 try{
  const{data:{session}}=await sb.auth.getSession();
  edit=!!session;
  db=await Data.load();
 }catch(e){
  console.error('Supabase load error',e);
  app.innerHTML=`<div class="box bootErr"><h3>No se pudieron cargar los datos</h3><p>${esc(friendlyError(e))}</p><p class="mu">No se muestra información vieja para no confundir resultados. Probá de nuevo en un momento.</p><button class="btn pri" onclick="${SB_LIB_OK?'boot()':'location.reload()'}">Reintentar</button></div>`;
  return;
 }
 loaded=true;
 applyRules();
 lastDecided=decidedLlaves();lastState=snapshot();
 if(!curHash)curHash='#/tablas';
 try{history.replaceState({d:0,y:0},'',curHash)}catch(e){historyOK=false}
 hashToState();
 if(S.view==='buscar'&&S.q)document.getElementById('q').value=S.q;
 render();
 if(edit){Data.save(db);pendingReview()}
}
boot();
