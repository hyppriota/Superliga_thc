/* ===== PIEZAS DE INTERFAZ (HTML reutilizable, avisos, ventanas) ===== */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tn=id=>T(id)?esc(T(id).name):'Por definir';
const ICON={G:'⚽',Y:'🟨',R:'🟥',M:'🏅'};
const PN=id=>{const p=anyP(id);return p?esc(p.name):'?'};
const POSC={POR:'#8b5e34',DEF:'#2f6fe4',MED:'#0f9d58',DEL:'#e5484d'};
const POSN={POR:'Arquero',DEF:'Defensa',MED:'Mediocampo',DEL:'Delantero'};
const POSL={POR:'GK',DEF:'DEF',MED:'MED',DEL:'DEL'};
const posChip=pos=>pos?`<span class="pchip" style="background:${POSC[pos]}" title="${POSN[pos]}">${POSL[pos]}</span>`:'';

/* Escudo: imagen de Supabase Storage; si falla o no hay, círculo con iniciales. */
function crestFallback(id){
 const t=T(id);if(!t)return'<span class="cr">?</span>';
 const init=t.name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
 let hue=0;for(const c of t.name)hue+=c.charCodeAt(0);hue%=360;
 return `<span class="cr" style="background:hsl(${hue},55%,42%)">${esc(init)}</span>`;
}
function crest(id){
 const t=T(id);if(!t)return'<span class="cr">?</span>';
 if(t.logo_url)return `<img class="cr" alt="" loading="lazy" src="${esc(t.logo_url)}" onerror="this.outerHTML=crestFallback('${esc(id)}')">`;
 return crestFallback(id);
}
const divHeader=dv=>`<span style="display:flex;align-items:center">${DLOGO[dv]?`<img class="dl" alt="" src="${DLOGO[dv]}">`:''}${DIVS[dv]}</span>`;
const seg=()=>`<div class="seg">${Object.entries(DIVS).map(([k,v])=>`<button class="${S.div===k?'on':''}" onclick="go('${S.view}',{div:'${k}',round:null})">${DLOGO[k]?`<img class="sl" alt="" src="${DLOGO[k]}">`:''}${v}</button>`).join('')}</div>`;
function toggleList(id){const el=document.getElementById(id);if(!el)return;el.classList.toggle('hide');const b=document.getElementById(id+'b');if(b)b.textContent=el.classList.contains('hide')?'Ver más':'Ver menos'}

function formGuide(teamId,dv){
 const ms=db.matches.filter(m=>m.div===dv&&m.status==='fin'&&(m.home===teamId||m.away===teamId)).sort((a,b)=>a.round-b.round).slice(-4);
 return ms.map(m=>{const gf=m.home===teamId?m.hg:m.ag,gc=m.home===teamId?m.ag:m.hg;const r=gf>gc?'W':gf<gc?'L':'D';const l=r==='W'?'V':r==='D'?'E':'D';return `<span class="fl ${r}" title="${r==='W'?'Ganó':r==='D'?'Empató':'Perdió'} · fecha ${m.round}">${l}</span>`}).join('')||'<span class="mu">—</span>';
}
function nextOpp(id,dv){
 const m=db.matches.filter(x=>x.div===dv&&x.status!=='fin'&&(x.home===id||x.away===id)).sort((a,b)=>a.round-b.round)[0];
 if(!m)return'<span class="mu">—</span>';
 const o=m.home===id?m.away:m.home;
 return `<span class="nx" title="${m.home===id?'Local':'Visita'} vs ${esc(T(o)?.name||'')} · fecha ${m.round}" onclick="go('equipos',{team:'${o}'})" style="cursor:pointer">${crest(o)}</span>`;
}

function evline(m){
 if(!m.ev||!m.ev.length)return'';
 const side=t=>m.ev.filter(e=>e.t==='OG'?e.team===t:anyP(e.p)?.team===t);
 const fmt=list=>list.map(e=>e.t==='OG'?`<span class="og">⚽ Autogol</span>`:`<span>${ICON[e.t]||e.t}${PN(e.p)}</span>`).join(', ');
 const h=fmt(side(m.home)),a=fmt(side(m.away));
 if(!h&&!a)return'';
 return `<div class="evr"><span>${h}</span><span class="r">${a}</span></div>`;
}

const LASTP={};
function evEditor(m){
 const last=LASTP[m.id];
 const opt=t=>db.players.filter(p=>p.team===t).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}" ${p.id===last?'selected':''}>${esc(p.name)}</option>`).join('');
 const gf=t=>(m.ev||[]).filter(e=>(e.t==='G'&&anyP(e.p)?.team===t)||(e.t==='OG'&&e.team===t)).length,gh=gf(m.home),ga=gf(m.away);
 const warn=(m.status==='fin'&&(gh!==m.hg||ga!==m.ag))?`<div class="wn">⚠ Goles cargados ${gh}-${ga} · Marcador ${m.hg}-${m.ag}</div>`:'';
 const mvps=(m.ev||[]).filter(e=>e.t==='M').length;
 const warnM=mvps>1?`<div class="wn">⚠ Este partido tiene ${mvps} MVP cargados; debería haber uno solo.</div>`:'';
 const list=(m.ev||[]).map((e,i)=>e.t==='OG'
   ?`<div class="rw" style="padding:4px 0"><span class="og">⚽ Autogol <span class="mu">(a favor de ${tn(e.team)})</span></span><a class="x" onclick="delEv('${m.id}',${i})">Quitar</a></div>`
   :`<div class="rw" style="padding:4px 0"><span>${ICON[e.t]} ${PN(e.p)} <span class="mu">${tn(anyP(e.p)?.team)}</span></span><a class="x" onclick="delEv('${m.id}',${i})">Quitar</a></div>`
  ).join('')||'<div class="mu">Sin eventos cargados.</div>';
 const hint='<div class="mu" style="font-size:11.5px;padding-top:6px">El marcador se arma solo con los goles que cargues. Si lo escribís a mano distinto, se respeta tu número.</div>';
 return `<div class="evp">${list}${warn}${warnM}${hint}<div class="f" style="padding:8px 0 0"><select id="et" onchange="toggleEvType()"><option value="G">⚽ Gol</option><option value="OG">⚽ Autogol</option><option value="Y">🟨 Amarilla</option><option value="R">🟥 Roja</option><option value="M">🏅 MVP</option></select><select id="ep"><optgroup label="${esc(T(m.home)?.name||'Local')}">${opt(m.home)}</optgroup><optgroup label="${esc(T(m.away)?.name||'Visita')}">${opt(m.away)}</optgroup></select><select id="eteam" style="display:none"><option value="${m.home}">A favor de ${tn(m.home)}</option><option value="${m.away}">A favor de ${tn(m.away)}</option></select><button class="pri" onclick="addEv('${m.id}')">Agregar</button></div></div>`;
}
function toggleEvType(){const og=document.getElementById('et').value==='OG';document.getElementById('ep').style.display=og?'none':'';document.getElementById('eteam').style.display=og?'':'none'}

function mrow(m){
 const st=m.status,lab=st==='fin'?'Final':st==='vivo'?'En juego':(m.time||'—');
 let h=`<div class="m ${st}"><span class="st">${esc(lab)}</span><a class="r" href="#/equipos?team=${m.home}">${tn(m.home)}${crest(m.home)}</a><span class="sc" style="cursor:pointer" title="Historial entre estos equipos" onclick="goH2H('${m.home}','${m.away}')">${st==='prox'?'vs':m.hg+' - '+m.ag}</span><a href="#/equipos?team=${m.away}">${crest(m.away)}${tn(m.away)}</a></div><div class="ven">🏟 ${esc(T(m.home)?.stadium||'Estadio por confirmar')}</div>${evline(m)}`;
 if(edit){
  const opts=sel=>'<option value="">Por definir</option>'+db.teams.map(t=>`<option value="${t.id}" ${t.id===sel?'selected':''}>${esc(t.name)}</option>`).join('');
  h+=(m.status==='vivo'?suspLine(m):'')+`<div class="ed">
  ${m.llave?`<select onchange="upd('${m.id}','home',this.value)">${opts(m.home)}</select><select onchange="upd('${m.id}','away',this.value)">${opts(m.away)}</select>`:''}
  <input type="number" min="0" inputmode="numeric" aria-label="Goles local" value="${m.hg}" onchange="upd('${m.id}','hg',this.value)"><input type="number" min="0" inputmode="numeric" aria-label="Goles visita" value="${m.ag}" onchange="upd('${m.id}','ag',this.value)">
  ${(m.llave&&(m.leg===3||m.fase==='FINAL'))?`<span class="mu" style="font-size:11px">Penales (si empató):</span><input type="number" min="0" placeholder="Local" style="width:52px" value="${m.pl??''}" onchange="upd('${m.id}','pl',this.value)"><input type="number" min="0" placeholder="Visita" style="width:52px" value="${m.pv??''}" onchange="upd('${m.id}','pv',this.value)">`:''}
  <select onchange="upd('${m.id}','status',this.value)">${[['prox','Próximo'],['vivo','En juego'],['fin','Finalizado']].map(([v,l])=>`<option value="${v}" ${m.status===v?'selected':''}>${l}</option>`).join('')}</select>
  <input placeholder="Hora" size="8" value="${esc(m.time||'')}" onchange="upd('${m.id}','time',this.value)">
  <button onclick="toggleEv('${m.id}')">Eventos</button><button class="x" onclick="del('${m.llave?'cup':'matches'}','${m.id}')">Eliminar</button></div>`+(S.evOpen===m.id?evEditor(m):'');
 }
 return h;
}

function llaveBox(fase,ll){
 const a=llaveAgg(ll);if(!a)return'';
 const{A,B,ida,vta,ter,gA,gB}=a;
 const glob=(ida.status==='fin'&&(!vta||vta.status==='fin'))?`<div class="gl">Global: ${tn(A)} ${gA} - ${gB} ${tn(B)}${ter?' · definió el tercer partido':''}</div>`:'';
 const seedTag=t=>(SEEDS.includes(T(t)?.name)?` <span class="seed">Cabeza de serie</span>`:'');
 return `<div class="box"><h3>${esc(fase)} · ${esc(ll)}${seedTag(A)}${seedTag(B)}</h3>
  <div class="leg">Ida</div>${mrow(ida)}
  ${vta?`<div class="leg">Vuelta</div>${mrow(vta)}`:''}
  ${glob}
  ${ter?`<div class="leg">Tercer partido (definición a penales)</div>${mrow(ter)}${ter.status==='fin'&&ter.pl!=null?`<div class="gl">Penales: ${tn(A)} ${ter.pl} - ${ter.pv} ${tn(B)}</div>`:''}`:''}
 </div>`;
}

/* ---- Suspendidos de un partido (modo editor) ---- */
const suspMotivo=r=>[r.genY?`<span class="pill y">🟨 amarillas</span>`:'',r.genR?`<span class="pill r">🟥 roja${r.genR>1?'s':''}</span>`:''].join('');
const suspPend=r=>`<span class="pill pend">⛔ ${r.pend} partido${r.pend>1?'s':''}</span>`;
function suspLine(m){
 const rows=suspendedFor(m);if(!rows.length)return'';
 return `<div class="susp-line" role="note">⛔ No pueden jugar: ${rows.map(r=>`<b>${esc(r.p.name)}</b> <span class="mu">(${tn(r.p.team)})</span>`).join(', ')}</div>`;
}
function suspensionAlert(m){
 const rows=suspendedFor(m);if(!rows.length)return;
 const comp=m.llave?`Copa THC · ${esc(m.fase)}`:`Liga · Fecha ${m.round}`;
 openModal(`<h3 class="mtit">⛔ Suspendidos en este partido</h3>
  <p class="mu" style="margin:-6px 0 12px;font-size:12.5px">${comp} · ${tn(m.home)} vs ${tn(m.away)}</p>
  <div class="susp-list">${rows.map((r,i)=>`<div class="susp-row">
   <div><b>${esc(r.p.name)}</b> <span class="mu">${tn(r.p.team)}</span></div>
   <div class="susp-tags">${suspMotivo(r)}${suspPend(r)}<button class="btn sm" id="sd${i}" title="Se baja de este partido: descuenta una fecha de su suspensión">Marcar cumplida</button></div>
  </div>`).join('')}</div>
  <div class="mact" style="margin-top:14px"><button class="btn pri" id="sok">Entendido</button></div>`,root=>{
  root.querySelector('#sok').onclick=()=>closeModal();
  rows.forEach((r,i)=>{const b=root.querySelector('#sd'+i);b.onclick=()=>{bumpDone(r.p.id,r.isCup,1);b.disabled=true;b.textContent='✓ Cumplida'}});
 });
}

/* ---- Al finalizar un partido: revisión de la carga + suspensiones cumplidas ---- */
const matchLabel=m=>`${m.llave?`Copa THC · ${esc(m.fase)}`:`Liga · Fecha ${m.round}`} · ${tn(m.home)} ${m.hg}-${m.ag} ${tn(m.away)}`;
function finishReview(m){
 const issues=matchIssues(m);
 // Estaban suspendidos para este partido y no figuran en sus eventos: muy probablemente no jugaron.
 const susp=suspendedFor(m).filter(r=>!(m.ev||[]).some(e=>e.p===r.p.id));
 if(!issues.length&&!susp.length){toast(`Partido finalizado ✓ ${T(m.home)?.name} ${m.hg}-${m.ag} ${T(m.away)?.name}`,'ok');return}
 openModal(`<h3 class="mtit">Partido finalizado</h3>
  <p class="mu" style="margin:-6px 0 12px;font-size:12.5px">${matchLabel(m)}</p>
  ${issues.length?`<div class="rev-sec warn"><b>⚠ Revisá la carga</b>${issues.map(i=>`<div>${esc(i)}</div>`).join('')}</div>`:''}
  ${susp.length?`<div class="rev-sec"><b>¿Cumplieron su suspensión?</b><div class="mu" style="font-size:12px">Estaban suspendidos y no aparecen en este partido. Dejá marcados los que no jugaron:</div>
   ${susp.map((r,i)=>`<label class="rev-check"><input type="checkbox" id="fs${i}" checked><span><b>${esc(r.p.name)}</b> <span class="mu">${tn(r.p.team)}</span></span>${suspMotivo(r)}</label>`).join('')}</div>`:''}
  <div class="mact">${issues.length?'<button class="btn" id="fev">Abrir eventos</button>':''}${susp.length?'<button class="btn" id="fno">Ahora no</button><button class="btn pri" id="fok">Marcar cumplidas</button>':'<button class="btn pri" id="fok">Entendido</button>'}</div>`,root=>{
  const fev=root.querySelector('#fev');if(fev)fev.onclick=()=>{closeModal();S.evOpen=m.id;render()};
  const fno=root.querySelector('#fno');if(fno)fno.onclick=()=>closeModal();
  root.querySelector('#fok').onclick=()=>{
   let n=0;
   susp.forEach((r,i)=>{if(!root.querySelector('#fs'+i)?.checked)return;const p=(r.isCup?db.cupPlayers:db.players).find(x=>x.id===r.p.id);if(p){p.suspDone=(p.suspDone||0)+1;n++}});
   closeModal();
   if(n){commit();toast(`${n} suspensión${n>1?'es':''} marcada${n>1?'s':''} como cumplida${n>1?'s':''}`,'ok')}
  };
 });
}

/* ---- Al entrar como editor: partidos con algo pendiente de cargar (una vez por sesión) ---- */
function pendingReview(){
 let shown=false;try{shown=sessionStorage.getItem('slthc-pend')==='1'}catch(e){}
 if(shown)return;
 const list=pendingLoads();if(!list.length)return;
 try{sessionStorage.setItem('slthc-pend','1')}catch(e){}
 const href=x=>x.cup?`#/copa?ver=bracket&llave=${encodeURIComponent(x.m.llave)}`:`#/fixture?div=${x.m.div}&round=${x.m.round}`;
 const MAX=8;
 openModal(`<h3 class="mtit">Pendientes de carga</h3>
  <div class="susp-list">${list.slice(0,MAX).map(x=>`<a class="rev-link" href="${href(x)}" onclick="closeModal()"><span>${matchLabel(x.m)}</span><span class="mu">${x.issues.map(esc).join(' ')}</span></a>`).join('')}</div>
  ${list.length>MAX?`<div class="mu" style="font-size:12px;margin-top:8px">y ${list.length-MAX} más.</div>`:''}
  <div class="mact" style="margin-top:14px"><button class="btn pri" id="pok">Entendido</button></div>`,root=>{root.querySelector('#pok').onclick=()=>closeModal()});
}

/* ---- Avisos no bloqueantes ---- */
function toast(msg,type='info',ms=3500){
 const root=document.getElementById('toasts');if(!root)return;
 while(root.children.length>=3)root.firstElementChild.remove(); // máximo 3 avisos a la vez
 const el=document.createElement('div');el.className='toast '+type;el.setAttribute('role',type==='error'?'alert':'status');
 el.textContent=msg;root.appendChild(el);
 requestAnimationFrame(()=>el.classList.add('in'));
 const close=()=>{el.classList.remove('in');setTimeout(()=>el.remove(),250)};
 el.onclick=close;if(ms)setTimeout(close,ms);
}

/* ---- Indicador de guardado en el encabezado ---- */
function showSaveStatus(s,info){
 const el=document.getElementById('savest');if(!el)return;
 el.className='savest '+s;el.onclick=null;el.title='';
 if(s==='saving'){el.textContent='Guardando…'}
 else if(s==='saved'){el.textContent='Guardado ✓';clearTimeout(showSaveStatus._t);showSaveStatus._t=setTimeout(()=>{if(Data.status==='saved')el.className='savest idle'},2500)}
 else if(s==='error'){el.textContent='⚠ Sin guardar · Reintentar';el.title=info||'';el.onclick=()=>Data.retry(db);toast(info||'No se pudo guardar.','error',6000)}
 else{el.textContent=''}
}

/* ---- Ventanas (login / confirmación) ---- */
function openModal(html,onMount){
 const root=document.getElementById('modal-root');
 root.innerHTML=`<div class="mback" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
 const first=root.querySelector('input,button');if(first)first.focus();
 if(onMount)onMount(root);
}
function closeModal(){const root=document.getElementById('modal-root');root.innerHTML='';if(closeModal._cb){const cb=closeModal._cb;closeModal._cb=null;cb()}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.mback'))closeModal()});
function confirmDialog(msg,okLabel='Eliminar'){
 return new Promise(res=>{
  let done=false;const finish=v=>{if(done)return;done=true;res(v)};
  closeModal._cb=()=>finish(false);
  openModal(`<p class="mmsg">${esc(msg)}</p><div class="mact"><button class="btn" id="mno">Cancelar</button><button class="btn danger" id="mok">${esc(okLabel)}</button></div>`,root=>{
   root.querySelector('#mno').onclick=()=>closeModal();
   root.querySelector('#mok').onclick=()=>{closeModal._cb=null;closeModal();finish(true)};
  });
 });
}
function loginDialog(){
 return new Promise(res=>{
  closeModal._cb=()=>res(false);
  openModal(`<h3 class="mtit">Ingresar como editor</h3>
   <form id="lf"><label>Email<input id="le" type="email" autocomplete="username" required></label>
   <label>Contraseña<input id="lp" type="password" autocomplete="current-password" required></label>
   <div class="merr" id="lerr"></div>
   <div class="mact"><button type="button" class="btn" id="lc">Cancelar</button><button type="submit" class="btn pri" id="ls">Ingresar</button></div></form>`,root=>{
   root.querySelector('#lc').onclick=()=>closeModal();
   root.querySelector('#lf').onsubmit=async ev=>{
    ev.preventDefault();
    const btn=root.querySelector('#ls'),err=root.querySelector('#lerr');
    btn.disabled=true;btn.textContent='Ingresando…';err.textContent='';
    const{error}=await sb.auth.signInWithPassword({email:root.querySelector('#le').value.trim(),password:root.querySelector('#lp').value});
    if(error){err.textContent=/invalid/i.test(error.message)?'Email o contraseña incorrectos.':error.message;btn.disabled=false;btn.textContent='Ingresar';return}
    closeModal._cb=null;closeModal();res(true);
   };
  });
 });
}
