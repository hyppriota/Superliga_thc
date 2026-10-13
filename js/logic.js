/* ===== LÓGICA DE LA LIGA (sin HTML) ===== */
const DIVS={thc:'SuperLiga THC',sl2:'SuperLiga 2'};
const STORAGE_PUBLIC=SB_URL+'/storage/v1/object/public/team-logos';
const DLOGO={thc:STORAGE_PUBLIC+'/div-thc.webp',sl2:STORAGE_PUBLIC+'/div-sl2.webp'};
const SEEDS=['Valle Alegre','Vxhoco'];
const CUP_FASES=['16AVOS','OCTAVOS','CUARTOS','SEMIFINAL','FINAL'];
const CUP_N={'16AVOS':16,OCTAVOS:8,CUARTOS:4,SEMIFINAL:2,FINAL:1};
const FASE_ORD={'16AVOS':1,OCTAVOS:2,CUARTOS:3,SEMIFINAL:4,FINAL:5};
const STATUS_ORD={fin:0,vivo:1,prox:2};
const POSORD={DEL:0,MED:1,DEF:2,POR:3};
const EV_KEY={G:'goals',M:'mvp',Y:'yc',R:'rc'};

const T=id=>db.teams.find(t=>t.id===id);
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const anyP=id=>db.players.find(x=>x.id===id)||(db.cupPlayers||[]).find(x=>x.id===id);

function standings(dv,upto){
 const r={};db.teams.filter(t=>t.div===dv).forEach(t=>r[t.id]={id:t.id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0});
 db.matches.filter(m=>m.div===dv&&m.status==='fin'&&(upto==null||m.round<=upto)&&r[m.home]&&r[m.away]).forEach(m=>{
  const h=r[m.home],a=r[m.away];h.pj++;a.pj++;h.gf+=m.hg;h.gc+=m.ag;a.gf+=m.ag;a.gc+=m.hg;
  if(m.hg>m.ag){h.g++;a.p++;h.pts+=3}else if(m.hg<m.ag){a.g++;h.p++;a.pts+=3}else{h.e++;a.e++;h.pts++;a.pts++}
 });
 const name=id=>T(id)?.name||'';
 return Object.values(r).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf||name(a.id).localeCompare(name(b.id)));
}
function posMoves(dv){
 const last=db.matches.filter(m=>m.div===dv&&m.status==='fin').reduce((a,m)=>Math.max(a,m.round),0);
 const mv={};if(last<2)return mv;
 standings(dv,last-1).forEach((r,i)=>mv[r.id]=i+1);return mv;
}

/* Estadísticas: se recalculan siempre desde los eventos de cada partido.
   CUPMAP guarda las de copa por jugador; db.cupPlayers se reconstruye desde ahí
   conservando las suspensiones ya cumplidas que marcó el editor. */
let CUPMAP={};
const tot=(p,k)=>(p[k]||0)+((CUPMAP[p.id]||{})[k]||0);
/* RECENT guarda, por jugador y estadística, qué tan reciente fue su último evento
   (fecha/fase del partido y orden dentro del partido). Sirve para desempatar rankings:
   con la misma cifra, va primero quien la sumó más recientemente. */
let RECENT={liga:{},copa:{}};
function lastOf(p,k,scope){
 const l=RECENT.liga[p.id]?.[k]??-1,c=RECENT.copa[p.id]?.[k]??-1;
 return scope==='liga'?l:scope==='copa'?c:Math.max(l,c);
}
function rankPlayers(list,valueOf,key,scope){
 return list.filter(p=>valueOf(p)>0).sort((a,b)=>valueOf(b)-valueOf(a)||lastOf(b,key,scope)-lastOf(a,key,scope)||a.name.localeCompare(b.name));
}
function recompute(){
 const prevDone={};(db.cupPlayers||[]).forEach(c=>{if(c.suspDone)prevDone[c.id]=c.suspDone});
 const P={};db.players.forEach(p=>{p.goals=p.mvp=p.yc=p.rc=0;P[p.id]=p});
 CUPMAP={};RECENT={liga:{},copa:{}};
 const mark=(scope,id,k,v)=>{const r=RECENT[scope][id]||(RECENT[scope][id]={});if(!(r[k]>=v))r[k]=v};
 db.matches.forEach(m=>(m.ev||[]).forEach((e,i)=>{const p=P[e.p],k=EV_KEY[e.t];if(!p||!k)return;
  p[k]++;mark('liga',p.id,k,matchRank(m)*1000+i)}));
 db.cup.forEach(m=>(m.ev||[]).forEach((e,i)=>{const p=P[e.p],k=EV_KEY[e.t];if(!p||!k)return;
  const c=CUPMAP[p.id]||(CUPMAP[p.id]={id:p.id,name:p.name,team:p.team,goals:0,mvp:0,yc:0,rc:0});c[k]++;
  mark('copa',p.id,k,matchRank({...m,cup:true})*1000+i)}));
 db.cupPlayers=Object.values(CUPMAP).map(c=>({...c,suspDone:prevDone[c.id]||0}));
}
/* Red de seguridad: si un evento de copa apunta a un jugador que no existe,
   se crea un jugador visible en vez de que el evento desaparezca en silencio. */
function ensureEventPlayers(){
 let changed=false;
 db.cup.forEach(m=>(m.ev||[]).forEach(e=>{
  if(!e.p||e.t==='OG'||db.players.find(p=>p.id===e.p))return;
  db.players.push({id:e.p,name:'Jugador sin identificar',team:m.home,goals:0,mvp:0,yc:0,rc:0});
  changed=true;
 }));
 return changed;
}

/* Copa: si por algún motivo hay dos filas para la misma llave y partido,
   se usa la que tiene resultado (fin > en juego > próximo). */
function cupLeg(ll,leg){
 return db.cup.filter(c=>c.llave===ll&&c.leg===leg).sort((a,b)=>STATUS_ORD[a.status]-STATUS_ORD[b.status])[0];
}
function cupLegs(ll){return[1,2,3].map(n=>cupLeg(ll,n)).filter(Boolean)}
const goalsFor=(team,m)=>m.home===team?m.hg:(m.away===team?m.ag:null);

/* Resultado de una llave: ida + vuelta (+ tercer partido si hubo empate global) */
function llaveAgg(ll){
 const ida=cupLeg(ll,1);if(!ida)return null;
 const vta=cupLeg(ll,2),ter=cupLeg(ll,3),A=ida.home,B=ida.away;
 let gA=null,gB=null;
 if(ida.status==='fin'){gA=goalsFor(A,ida);gB=goalsFor(B,ida)}
 if(vta&&vta.status==='fin'){gA=(gA||0)+goalsFor(A,vta);gB=(gB||0)+goalsFor(B,vta)}
 const bothPlayed=ida.status==='fin'&&(!vta||vta.status==='fin');
 let winner=null;
 if(bothPlayed&&gA!=null){
  if(gA>gB)winner=A;else if(gB>gA)winner=B;
  else if(ter&&ter.status==='fin'){if(ter.hg>ter.ag)winner=ter.home;else if(ter.ag>ter.hg)winner=ter.away;else if(ter.pl!=null&&ter.pv!=null)winner=ter.pl>ter.pv?ter.home:ter.away}
  else if(!vta&&ida.pl!=null&&ida.pv!=null)winner=ida.pl>ida.pv?A:B; // final a partido único, definición a penales
 }
 const sc=(leg,team)=>leg&&leg.status==='fin'?goalsFor(team,leg):null;
 const legArr=[{a:sc(ida,A),b:sc(ida,B)}];
 if(vta)legArr.push({a:sc(vta,A),b:sc(vta,B)});
 if(ter)legArr.push({a:sc(ter,A),b:sc(ter,B)});
 const pens=(ter&&ter.status==='fin'&&ter.pl!=null&&ter.pv!=null)?{a:ter.pl,b:ter.pv}:null;
 return{ll,A,B,ida,vta,ter,gA,gB,winner,decided:!!winner,legs:legArr,pens};
}

/* Partidos que la app crea sola. El id es fijo por llave y partido (ej. "CUARTOS-01-L2"):
   si dos editores lo generan a la vez, terminan apuntando a la misma fila en vez de duplicarla. */
function autoCup(fase,llave,leg,home,away){
 const id=`${llave}-L${leg}`;
 Data.autoIds.add(id);
 db.cup.push({id,fase,llave,leg,home,away,hg:0,ag:0,pl:null,pv:null,status:'prox',ev:[]});
}
/* Si una llave queda empatada en el global tras ida y vuelta, crea el tercer partido (definición a penales) */
function ensureTercerPartido(){
 let changed=false;
 [...new Set(db.cup.map(c=>c.llave))].forEach(ll=>{
  const ida=cupLeg(ll,1),vta=cupLeg(ll,2);
  if(!ida||!vta||ida.status!=='fin'||vta.status!=='fin'||cupLeg(ll,3))return;
  const gA=goalsFor(ida.home,ida)+goalsFor(ida.home,vta),gB=goalsFor(ida.away,ida)+goalsFor(ida.away,vta);
  if(gA===gB){autoCup(ida.fase,ll,3,ida.home,ida.away);changed=true}
 });
 return changed;
}
/* Pasa a los ganadores de cada llave a la ronda siguiente, creando los partidos que falten */
function advanceCup(){
 let changed=false;
 const pad=n=>String(n).padStart(2,'0');
 for(let fi=0;fi<CUP_FASES.length-1;fi++){
  const fase=CUP_FASES[fi],next=CUP_FASES[fi+1];
  for(let k=1;k<=CUP_N[next];k++){
   const wA=llaveAgg(`${fase}-${pad(2*k-1)}`)?.winner,wB=llaveAgg(`${fase}-${pad(2*k)}`)?.winner;
   if(!wA||!wB)continue;
   const llave=`${next}-${pad(k)}`;
   const ida=cupLeg(llave,1);
   if(!ida){autoCup(next,llave,1,wA,wB);changed=true}
   else if(ida.status==='prox'&&(ida.home!==wA||ida.away!==wB)){ida.home=wA;ida.away=wB;changed=true}
   if(next!=='FINAL'){
    const vta=cupLeg(llave,2);
    if(!vta){autoCup(next,llave,2,wB,wA);changed=true}
    else if(vta.status==='prox'&&(vta.home!==wB||vta.away!==wA)){vta.home=wB;vta.away=wA;changed=true}
   }
  }
 }
 return changed;
}
/* Quita filas de copa duplicadas que estén vacías (próximo, 0-0, sin eventos)
   cuando ya existe otra fila con resultado para la misma llave y partido.
   Al guardar como editor, el borrado llega también a la base. */
function dedupeCup(){
 const keep=new Set(db.cup.map(c=>cupLeg(c.llave,c.leg)?.id));
 const empty=c=>c.status==='prox'&&!c.hg&&!c.ag&&!(c.ev||[]).length;
 const before=db.cup.length;
 db.cup=db.cup.filter(c=>keep.has(c.id)||!empty(c));
 return db.cup.length!==before;
}
/* Todo lo que se recalcula solo después de cada cambio. */
function applyRules(){
 const z=dedupeCup(),a=ensureEventPlayers(),b=ensureTercerPartido(),c=advanceCup();
 recompute();
 return z||a||b||c;
}

/* Disciplina.
   Liga: cada 3 amarillas acumuladas = 1 partido; cada roja = 1 partido.
   Copa: cada 2 amarillas acumuladas = 1 partido; cada roja = 1 partido. */
/* Equipos que ya no juegan la copa: perdieron una llave ya definida, o la copa terminó
   (final definida: el campeón tampoco tiene más partidos). Se calcula siempre desde los
   resultados, así que si se corrige un resultado, el equipo vuelve a estar en carrera. */
function cupOutTeams(){
 const out=new Set();
 [...new Set(db.cup.map(c=>c.llave))].forEach(ll=>{const a=llaveAgg(ll);if(a?.decided)out.add(a.winner===a.A?a.B:a.A)});
 const fin=llaveAgg('FINAL-01');if(fin?.decided)out.add(fin.winner);
 return out;
}
function disciplineRows(list,isCup){
 const Ny=isCup?2:3;
 const out=isCup?cupOutTeams():new Set();
 return list.filter(p=>p.yc>0||p.rc>0).map(p=>{
  const genY=Math.floor(p.yc/Ny),genR=p.rc,gen=genY+genR,done=p.suspDone||0;
  let pend=Math.max(0,gen-done),anul=0;
  // Copa: si su equipo ya no juega, lo pendiente no se puede cumplir → se anula (no se borra nada).
  if(isCup&&pend>0&&out.has(p.team)){anul=pend;pend=0}
  const cerca=!out.has(p.team)&&p.yc%Ny===Ny-1; // a 1 amarilla de la próxima suspensión
  return{p,isCup,genY,genR,gen,done,pend,anul,cerca};
 });
}

/* Goles de cada equipo según los eventos cargados (goles + autogoles a favor). */
function evGoals(m){
 const g=t=>(m.ev||[]).filter(e=>(e.t==='G'&&anyP(e.p)?.team===t)||(e.t==='OG'&&e.team===t)).length;
 return{h:g(m.home),a:g(m.away)};
}
/* Tarjetas de un jugador en una competición, y cuántas suspensiones generan. */
function cardsOf(pid,isCup){
 let y=0,r=0;(isCup?db.cup:db.matches).forEach(m=>(m.ev||[]).forEach(e=>{if(e.p===pid){if(e.t==='Y')y++;else if(e.t==='R')r++}}));
 return{y,r};
}
const suspGen=(c,isCup)=>Math.floor(c.y/(isCup?2:3))+c.r;
/* Cosas a revisar en un partido finalizado. */
function matchIssues(m){
 const out=[],g=evGoals(m),mv=(m.ev||[]).filter(e=>e.t==='M').length;
 if(g.h!==m.hg||g.a!==m.ag)out.push(`Los goles cargados (${g.h}-${g.a}) no coinciden con el marcador (${m.hg}-${m.ag}).`);
 if(!mv)out.push('Falta cargar el MVP.');else if(mv>1)out.push(`Hay ${mv} MVP cargados; debería haber uno solo.`);
 return out;
}
/* Partidos con algo pendiente de cargar: quedaron "En juego" o finalizados con algo a revisar. */
function pendingLoads(){
 const all=[...db.matches.map(m=>({m,cup:false})),...db.cup.filter(m=>cupLeg(m.llave,m.leg)?.id===m.id).map(m=>({m,cup:true}))];
 return all.map(({m,cup})=>({m,cup,issues:m.status==='vivo'?['Quedó marcado "En juego".']:m.status==='fin'?matchIssues(m):[]})).filter(x=>x.issues.length);
}

/* Suspendidos que no pueden jugar este partido: jugadores de los dos equipos con
   suspensión pendiente en ESA competencia (liga o copa, cada una con su regla).
   No cuenta las tarjetas recibidas en este mismo partido, que se cumplen en el siguiente. */
function suspendedFor(m){
 const isCup=!!m.llave,Ny=isCup?2:3;
 const out=isCup?cupOutTeams():new Set();
 const list=isCup?(db.cupPlayers||[]):db.players;
 const here=(p,t)=>(m.ev||[]).filter(e=>e.p===p.id&&e.t===t).length;
 return list.filter(p=>(p.team===m.home||p.team===m.away)&&!out.has(p.team)).map(p=>{
  const yc=(p.yc||0)-here(p,'Y'),rc=(p.rc||0)-here(p,'R');
  const genY=Math.floor(yc/Ny),genR=rc,pend=Math.max(0,genY+genR-(p.suspDone||0));
  return{p,isCup,genY,genR,pend};
 }).filter(r=>r.pend>0).sort((a,b)=>(a.p.team===m.home?0:1)-(b.p.team===m.home?0:1)||a.p.name.localeCompare(b.p.name));
}

/* Orden temporal aproximado para mezclar liga y copa (no hay fechas reales):
   la copa se considera posterior a la liga, y dentro de la copa manda la fase y luego el partido. */
const matchRank=m=>m.cup?9000+(FASE_ORD[m.fase]||0)*10+(m.leg||0):(m.round||0);
function teamMatches(id){
 return[...db.matches.filter(m=>m.home===id||m.away===id).map(m=>({...m,cup:false})),
  ...db.cup.filter(m=>m.home===id||m.away===id).map(m=>({...m,cup:true}))]
  // descarta filas de copa duplicadas (misma llave y partido): queda la que tiene resultado
  .filter(m=>!m.cup||cupLeg(m.llave,m.leg)?.id===m.id);
}
