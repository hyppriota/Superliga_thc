/* ===== VISTAS (una función por pestaña; devuelven HTML) ===== */
// Los rankings muestran los primeros y, con "Ver más", hasta este puesto.
const TOP_MAX=15;
const V={
 tablas(){
  const ms=db.matches.filter(m=>m.div===S.div);
  const t=standings(S.div),n=t.length,z=i=>i===0?'z0':(S.div==='thc'?(i>=n-3?'z3':''):(i<3?'z2':(i>=n-3?'z3':'')));
  const champ=ms.length>0&&ms.every(m=>m.status==='fin');
  const rounds=[...new Set(ms.map(m=>m.round))].sort((a,b)=>a-b);
  const prev=posMoves(S.div);
  const mv=(id,i)=>{const p=prev[id];if(!p)return'';const d=p-(i+1);return d>0?`<span class="mv up" title="Subió ${d}">▲</span>`:d<0?`<span class="mv dn" title="Bajó ${-d}">▼</span>`:'<span class="mv eq">–</span>'};
  const cur=ms.filter(m=>m.status!=='fin').sort((a,b)=>a.round-b.round)[0];
  const curR=cur?cur.round:rounds[rounds.length-1];
  const curMs=ms.filter(m=>m.round===curR);
  const resumen=curMs.length?`<div class="box"><h3>${divHeader(S.div)}<span>Fecha ${curR}</span></h3>${curMs.map(mrow).join('')}</div>`:'';
  return seg()+resumen+`<div class="box"><h3>${divHeader(S.div)}<span>Posiciones</span></h3><div style="overflow-x:auto"><table class="postab"><tr><th>#</th><th style="text-align:left">Equipo</th><th>PTS</th><th title="Partidos jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Goles a favor : en contra">GF:GC</th><th title="Diferencia de gol" style="border-left:1px solid var(--ln)">+/-</th><th style="border-left:1px solid var(--ln)">Forma</th><th>Próximo</th></tr>`+
   t.map((r,i)=>{const dg=r.gf-r.gc;return`<tr class="${z(i)}"><td><span class="pos">${i+1}</span>${mv(r.id,i)}</td><td class="n"><a href="#/equipos?team=${r.id}">${crest(r.id)}${tn(r.id)}</a></td><td><span class="ptsb">${r.pts}</span></td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td class="mu">${r.gf}:${r.gc}</td><td style="border-left:1px solid var(--ln)">${dg>0?'+'+dg:dg}</td><td style="border-left:1px solid var(--ln)"><div class="frm">${formGuide(r.id,S.div)}</div></td><td>${nextOpp(r.id,S.div)}</td></tr>`}).join('')+
   `</table></div><div class="lg"><i style="background:var(--gd)"></i>${champ?'Campeón':'Líder'}${S.div==='thc'?'<i style="background:var(--lv)"></i>Descenso a Ligas Regionales (3)':'<i style="background:var(--bl)"></i>Ascenso a SuperLiga THC (3)<i style="background:var(--lv)"></i>Descenso a Ligas Regionales (3)'} · ▲▼ posición vs. la fecha anterior · Forma: de más antiguo (izq.) a más reciente (der.), luego el próximo rival</div></div>
   <div class="box"><h3>Fixture</h3><div class="f">${rounds.map(r=>`<button onclick="go('fixture',{round:${r}})">Fecha ${r}</button>`).join('')}</div></div>`;
 },

 fixture(){
  const ms=db.matches.filter(m=>m.div===S.div),rounds=[...new Set(ms.map(m=>m.round))].sort((a,b)=>a-b);
  if(S.round==null||!rounds.includes(S.round)){const cur=ms.filter(m=>m.status!=='fin').sort((a,b)=>a.round-b.round)[0];S.round=cur?cur.round:rounds[rounds.length-1]}
  const list=ms.filter(m=>m.round===S.round);
  return seg()+`<div class="seg">${rounds.map(r=>`<button class="${r===S.round?'on':''}" onclick="go('fixture',{round:${r}})">Fecha ${r}</button>`).join('')}</div>`+
   `<div class="box"><h3>${divHeader(S.div)}<span>Fecha ${S.round??'—'} de ${rounds.length}</span></h3>${list.map(mrow).join('')||'<div class="empty">Sin partidos en esta fecha.</div>'}</div>`;
 },

 copa(){
  return `<div class="seg"><button class="${S.copaView!=='bracket'?'on':''}" onclick="go('copa',{copaView:'lista'})">Lista</button><button class="${S.copaView==='bracket'?'on':''}" onclick="go('copa',{copaView:'bracket'})">Bracket</button></div>`
   +(S.copaView==='bracket'?V.copaBracket():V.copaLista());
 },

 copaBracket(){
  const titles=['Dieciseisavos','Octavos','Cuartos','Semifinales','Final'];
  const prevWinnerLabel=(prevRound,idx)=>{const r=prevRound&&prevRound[idx];if(!r)return'—';return r.decided?T(r.winner)?.name||'—':'Pendiente'};
  const cache=[];
  const rounds=CUP_FASES.map((fase,fi)=>{
   const items=[];
   for(let k=1;k<=CUP_N[fase];k++){
    const agg=llaveAgg(`${fase}-${String(k).padStart(2,'0')}`);
    if(agg)items.push({...agg,real:true});
    else{const prev=fi>0?cache[fi-1]:null;items.push({real:false,labelA:prevWinnerLabel(prev,2*k-2),labelB:prevWinnerLabel(prev,2*k-1)})}
   }
   cache[fi]=items;return items;
  });
  const H=820,BW=206,BH=40,GAP=34;
  const centerY=(k,n)=>((2*k+1)/(2*n))*H;
  const col=items=>`<div style="position:relative;width:${BW}px;height:${H}px;flex:none">${items.map((it,k)=>{
   const top=centerY(k,items.length)-BH/2;
   if(it.real){const bA=it.winner===it.A,bB=it.winner===it.B;
    // Todos los partidos en chico (ida | vuelta | tercero); en grande el global,
    // o el resultado del tercer partido si lo hubo (ese define la llave).
    const sc=(side,glob)=>{const legs=it.legs||[];const pen=it.pens?`<span class="bsc">(${it.pens[side]})p</span>`:'';
     if(legs.length<=1)return `<b>${legs[0]?.[side]??'–'}</b>${pen}`;
     const big=it.ter?legs[2]?.[side]:glob;
     return `<span class="bsc">${legs.map(l=>l[side]??'–').join(' | ')}</span><b${it.ter?' title="Tercer partido"':''}>${big??'–'}</b>${pen}`};
    return `<div class="bmatch" style="top:${top}px" onclick="go('copa',{copaView:'bracket',bracketSel:'${esc(it.ll)}'})">
     <div class="brow ${bA?'bw':''}">${crest(it.A)}<span>${tn(it.A)}</span>${sc('a',it.gA)}</div>
     <div class="brow ${bB?'bw':''}">${crest(it.B)}<span>${tn(it.B)}</span>${sc('b',it.gB)}</div></div>`;
   }
   return `<div class="bmatch" style="top:${top}px"><div class="brow"><span class="mu">${esc(it.labelA)}</span></div><div class="brow"><span class="mu">${esc(it.labelB)}</span></div></div>`;
  }).join('')}</div>`;
  const svg=n=>{let s='';for(let k=0;k<n;k+=2){const cA=centerY(k,n),cB=centerY(k+1,n),mid=(cA+cB)/2;
    s+=`<path d="M0,${cA} H${GAP/2} M0,${cB} H${GAP/2} M${GAP/2},${cA} V${cB} M${GAP/2},${mid} H${GAP}" fill="none" stroke="currentColor" stroke-width="1"/>`}
   return `<svg width="${GAP}" height="${H}" style="color:var(--ln);flex:none">${s}</svg>`};
  let out=`<div style="display:flex;overflow-x:auto;padding-bottom:8px;align-items:stretch">`;
  rounds.forEach((r,i)=>{out+=col(r);if(i<rounds.length-1)out+=svg(r.length)});
  out+='</div>';
  out=`<div class="lg" style="padding:0 0 8px">${titles.join(' · ')} — tocá cualquier cruce ya jugado para ver el detalle del partido. Los ganadores avanzan solos a la siguiente ronda.</div>`+out;
  if(S.bracketSel)out+=llaveBox(S.bracketSel.split('-')[0],S.bracketSel);
  return out;
 },

 copaLista(){
  // De la fase más reciente a la más antigua
  const fases=[...new Set(db.cup.map(c=>c.fase))].sort((a,b)=>(FASE_ORD[b]||0)-(FASE_ORD[a]||0));
  return fases.map(fase=>[...new Set(db.cup.filter(c=>c.fase===fase).map(c=>c.llave))].reverse().map(ll=>llaveBox(fase,ll)).join('')).join('')
   ||'<div class="empty">Aún no hay partidos de copa.</div>';
 },

 h2h(){
  const{a,b}=S.h2h||{};if(!T(a)||!T(b))return'<div class="empty">Elegí un enfrentamiento desde un partido.</div>';
  const isPair=m=>(m.home===a&&m.away===b)||(m.home===b&&m.away===a);
  const all=teamMatches(a).filter(m=>isPair(m)&&m.status==='fin')
   .map(m=>({...m,comp:m.cup?'Copa':'Liga',tag:m.cup?m.fase+' · '+m.llave:'Fecha '+m.round}))
   .sort((x,y)=>matchRank(y)-matchRank(x));
  let wa=0,wb=0,e=0;all.forEach(m=>{const ga=m.home===a?m.hg:m.ag,gb=m.home===b?m.hg:m.ag;if(ga>gb)wa++;else if(gb>ga)wb++;else e++});
  return `<div class="seg"><button onclick="goBack()">← Volver</button></div>
  <div class="box"><h3 style="justify-content:center">Enfrentamientos anteriores<span>Jugaron ${all.length} ${all.length===1?'vez':'veces'}</span></h3>
   <div class="h2hstat">
    <div>${crest(a)}<span>${tn(a)}</span><b>${wa}</b><span class="mu" style="font-size:11px">Victorias</span></div>
    <div><b>${e}</b><span class="mu" style="font-size:11px">Empates</span></div>
    <div>${crest(b)}<span>${tn(b)}</span><b>${wb}</b><span class="mu" style="font-size:11px">Victorias</span></div>
   </div>
  </div>
  <div class="box"><h3>Historial de partidos</h3>${all.map(m=>`<div class="h2hrow"><span>${crest(m.home)}${tn(m.home)}</span><b>${m.hg} - ${m.ag}</b><span class="r">${tn(m.away)}${crest(m.away)}</span></div><div class="ven" style="text-align:left;padding:0 12px 8px"><span class="badge">${m.comp}</span> ${esc(m.tag)} · 🏟 ${esc(T(m.home)?.stadium||'Estadio por confirmar')}</div>`).join('')||'<div class="empty">Todavía no se enfrentaron.</div>'}</div>`;
 },

 equipos(){
  if(S.team&&T(S.team))return V.equipo(T(S.team));
  if(S.team)return '<div class="empty">Ese equipo no existe.</div>';
  return Object.entries(DIVS).map(([k])=>`<div class="box"><h3>${divHeader(k)}</h3>${db.teams.filter(t=>t.div===k).sort((x,y)=>x.name.localeCompare(y.name)).map(t=>`<div class="rw"><a href="#/equipos?team=${t.id}">${crest(t.id)}${esc(t.name)}</a>${edit?`<a class="x" onclick="del('teams','${t.id}')">Eliminar</a>`:''}</div>`).join('')}</div>`).join('');
 },

 equipo(t){
  const pl=db.players.filter(p=>p.team===t.id).sort((a,b)=>(POSORD[a.position]??4)-(POSORD[b.position]??4)||a.name.localeCompare(b.name));
  const all=teamMatches(t.id);
  const next=all.filter(m=>m.status!=='fin').sort((a,b)=>matchRank(a)-matchRank(b));
  const last=all.filter(m=>m.status==='fin').sort((a,b)=>matchRank(b)-matchRank(a));
  const st=standings(t.div),pos=st.findIndex(r=>r.id===t.id)+1;
  const rez=m=>{const gf=m.home===t.id?m.hg:m.ag,gc=m.home===t.id?m.ag:m.hg;return gf>gc?'W':gf<gc?'L':'D'};
  const pills=p=>{const a=[],G=tot(p,'goals'),M=tot(p,'mvp'),Y=tot(p,'yc'),R=tot(p,'rc');if(G)a.push(`⚽ ${G}`);if(M)a.push(`🏅 ${M}`);if(Y)a.push(`🟨 ${Y}`);if(R)a.push(`🟥 ${R}`);return a.length?`<span class="pst">${a.join('  ')}</span>`:'<span class="mu">Sin registros</span>'};
  const fd=S.formDir==='next'?'next':'prev';
  const formList=fd==='prev'?last.slice(0,5).reverse():next.slice(0,5);
  const fmw=m=>{const riv=m.home===t.id?m.away:m.home,loc=m.home===t.id,lab=m.cup?'Copa':('F'+(m.round||''));
   const bottom=fd==='prev'?(()=>{const r=rez(m),l=r==='W'?'G':r==='D'?'E':'P';return `<div class="rez ${r}" style="margin-top:4px">${l} ${m.hg}-${m.ag}</div>`})()
    :`<div class="mu" style="font-size:10px;margin-top:4px">${loc?'L':'V'} · ${esc(m.time||(m.round?'F'+m.round:''))}</div>`;
   return `<div class="fmw"><div class="mu" style="font-size:9px">${esc(lab)}</div>${crest(riv)}<div class="mu" style="font-size:10px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tn(riv)}</div>${bottom}</div>`};
  const stTable=(()=>{const n=st.length,i=st.findIndex(r=>r.id===t.id);
   let lo=Math.max(0,i-2),hi=Math.min(n,lo+5);lo=Math.max(0,hi-5);
   return `<table><tr><th>#</th><th style="text-align:left">Equipo</th><th>PTS</th><th>PJ</th></tr>${st.slice(lo,hi).map((r,k)=>`<tr${r.id===t.id?' style="font-weight:800;background:var(--bg)"':''}><td>${lo+k+1}</td><td class="n">${crest(r.id)}${tn(r.id)}</td><td><span class="ptsb">${r.pts}</span></td><td>${r.pj}</td></tr>`).join('')}</table>`})();
  const t3=(key,label,icon)=>{const ranked=rankPlayers(pl,p=>tot(p,key),key,'tot');
   const g=ranked.slice(0,3),rest=ranked.slice(3,TOP_MAX),rid='t3-'+key+t.id,row=(p,i)=>`<div class="t3r">${i<3?`<span class="t3n m${i+1}">${i+1}</span>`:'<span class="t3n" style="background:none"></span>'}<span>${esc(p.name)}</span><b>${tot(p,key)}</b></div>`;
   return `<div class="t3c"><h3 style="border:0;padding:0 0 6px">${icon} ${label}</h3>${g.map(row).join('')||'<div class="mu" style="font-size:12px">Sin datos.</div>'}${rest.length?`<div id="${rid}" class="hide">${rest.map((p,i)=>row(p,i+3)).join('')}</div><span class="vm" id="${rid}b" style="text-align:left;padding:4px 0" onclick="toggleList('${rid}')">Ver más</span>`:''}</div>`};
  const nm=next[0],lm=last[0];
  const playerRow=p=>`<div class="rw"><span>${edit?`<select class="posel" aria-label="Posición" onchange="setPos('${p.id}',this.value)">${['','POR','DEF','MED','DEL'].map(v=>`<option value="${v}" ${p.position===v||(!p.position&&!v)?'selected':''}>${v||'—'}</option>`).join('')}</select>`:posChip(p.position)}${esc(p.name)}${p.captain?' <span class="cbadge" title="Capitán">C</span>':''}${edit?` <button class="cbtn ${p.captain?'on':''}" title="Marcar como capitán" onclick="setCaptain('${p.id}')">C</button> <a class="x" onclick="del('players','${p.id}')">✕</a>`:''}</span>${pills(p)}</div>`;
  return `<div class="seg"><button onclick="goBack()">← Volver</button></div>
  <div class="g2">
   <div class="box tcard"><div>${crest(t.id)}</div><div><h3 style="border:0;padding:0">${esc(t.name)}</h3><div class="mu" style="font-size:12px;display:flex;align-items:center">${DLOGO[t.div]?`<img class="tl" alt="" src="${DLOGO[t.div]}">`:''}${DIVS[t.div]} · ${pos}º</div><div class="mu" style="font-size:12px">${esc(t.stadium||'Estadio por cargar')}</div></div></div>
   <div class="box"><h3>Próximo partido</h3>${nm?`<div class="npm" style="cursor:pointer" title="Ver historial entre estos equipos" onclick="goH2H('${nm.home}','${nm.away}')"><div>${crest(t.id)}<span>${tn(t.id)}</span></div><b>${esc(nm.time||(nm.round?'F'+nm.round:''))}</b><div>${crest(nm.home===t.id?nm.away:nm.home)}<span>${tn(nm.home===t.id?nm.away:nm.home)}</span></div></div><div class="ven">🏟 ${esc(T(nm.home)?.stadium||'Estadio por confirmar')}</div><div class="mu" style="text-align:center;font-size:11px">${nm.cup?'Copa THC · '+esc(nm.fase):'Liga · Fecha '+nm.round}</div>`:'<div class="empty">Sin partidos programados.</div>'}</div>
  </div>
  <div class="g2">
   <div class="box"><h3>Forma del equipo<span><button class="chip ${fd==='prev'?'on':''}" onclick="go('equipos',{team:'${t.id}',formDir:'prev'},{replace:true,keepScroll:true})">Anterior</button><button class="chip ${fd==='next'?'on':''}" onclick="go('equipos',{team:'${t.id}',formDir:'next'},{replace:true,keepScroll:true})">Próximamente</button></span></h3><div style="display:flex;gap:6px;overflow-x:auto;padding:10px 12px">${formList.map(fmw).join('')||'<div class="empty">Sin partidos.</div>'}</div></div>
   <div class="box"><h3>${divHeader(t.div)}<span>Tabla</span></h3>${stTable}</div>
  </div>
  <div class="box"><h3>Último partido</h3>${lm?`${mrow(lm)}<div class="wn" style="padding:0 12px 10px">Alineación titular: próximamente.</div>`:'<div class="empty">Todavía no jugó.</div>'}</div>
  <div class="box"><h3>Plantel<span>${pl.length} jugador${pl.length===1?'':'es'}</span></h3><div class="rw"><span class="mu">DT</span>${edit?`<input value="${esc(t.dt||'')}" placeholder="DT" onchange="setTF('${t.id}','dt',this.value)">`:`<span>${esc(t.dt||'Por cargar')}</span>`}</div>${edit?`<div class="rw"><span class="mu">Estadio</span><input value="${esc(t.stadium||'')}" placeholder="Estadio" onchange="setTF('${t.id}','stadium',this.value)"></div>`:''}${pl.map(playerRow).join('')||'<div class="empty">Sin jugadores cargados.</div>'}
  <div class="lg">${Object.entries(POSN).map(([k,v])=>`${posChip(k)}${v} `).join('')}</div></div>
  <div class="box"><h3>Estadísticas del plantel</h3><div class="t3g">${t3('goals','Goles','⚽')}${t3('mvp','MVP','🏅')}${t3('yc','Amarillas','🟨')}${t3('rc','Rojas','🟥')}</div></div>`;
 },

 jugadores(){
  const byDiv=dv=>db.players.filter(p=>T(p.team)?.div===dv);
  const rid=s=>'rk-'+s.replace(/[^a-z0-9]/gi,'')+'-'+S.div;
  const rank=(list,key,label,icon,scope)=>{const g=rankPlayers(list,p=>p[key],key,scope);
   const top=g.slice(0,6),rest=g.slice(6,TOP_MAX),id=rid(label+key);
   const row=(p,i)=>`<div class="rw"><span>${i+1}. <a href="#/equipos?team=${p.team}">${esc(p.name)}</a> <span class="mu">${tn(p.team)}</span></span><b>${p[key]}</b></div>`;
   return `<div class="box"><h3>${icon} ${label}</h3>${top.map(row).join('')||'<div class="empty">Sin datos registrados.</div>'}${rest.length?`<div id="${id}" class="hide">${rest.map((p,i)=>row(p,i+6)).join('')}</div><span class="vm" id="${id}b" onclick="toggleList('${id}')">Ver más</span>`:''}</div>`};
  const teamCards=(dv,key,label)=>{const rows=db.teams.filter(t=>t.div===dv).map(t=>({t,n:db.players.filter(p=>p.team===t.id).reduce((s,p)=>s+p[key],0)})).sort((a,b)=>b.n-a.n).filter(r=>r.n>0);
   const top=rows.slice(0,6),rest=rows.slice(6,TOP_MAX),id=rid(label+key+dv);
   const row=(r,i)=>`<div class="rw"><span>${i+1}. <a href="#/equipos?team=${r.t.id}">${crest(r.t.id)}${esc(r.t.name)}</a></span><b>${r.n}</b></div>`;
   return `<div class="box"><h3>${label} · ${DIVS[dv]}</h3>${top.map(row).join('')||'<div class="empty">Sin datos.</div>'}${rest.length?`<div id="${id}" class="hide">${rest.map((r,i)=>row(r,i+6)).join('')}</div><span class="vm" id="${id}b" onclick="toggleList('${id}')">Ver más</span>`:''}</div>`};
  const cup=db.cupPlayers||[],cl=`<img class="tl" alt="" src="${DLOGO.thc}">`;
  const L=byDiv(S.div);
  return seg()+rank(L,'goals','Goleadores','⚽','liga')+rank(L,'mvp','Ranking MVP','🏅','liga')+rank(L,'yc','Más amarillas','🟨','liga')+rank(L,'rc','Más rojas','🟥','liga')
   +teamCards(S.div,'yc','Equipos con más amarillas')+teamCards(S.div,'rc','Equipos con más rojas')
   +rank(cup,'goals',cl+'Goleadores · Copa THC','⚽','copa')+rank(cup,'mvp',cl+'Ranking MVP · Copa THC','🏅','copa')+rank(cup,'yc',cl+'Más amarillas · Copa THC','🟨','copa')+rank(cup,'rc',cl+'Más rojas · Copa THC','🟥','copa');
 },

 disciplina(){
  const ligaRows=disciplineRows(db.players,false).sort((a,b)=>b.pend-a.pend||(b.cerca?1:0)-(a.cerca?1:0)||b.gen-a.gen);
  const copaRows=disciplineRows(db.cupPlayers||[],true).sort((a,b)=>b.pend-a.pend||b.gen-a.gen);
  const susp=[...ligaRows,...copaRows].filter(r=>r.pend>0).sort((a,b)=>b.pend-a.pend);
  const motivo=r=>{const a=[];if(r.genY>0)a.push('<span class="pill y">🟨 amarillas</span>');if(r.genR>0)a.push('<span class="pill r">🟥 rojas</span>');return a.join('')};
  const alerta=`<div class="box"><h3>🚫 Suspendidos ahora</h3>${susp.map(r=>`<div class="discrow"><div class="discname"><a href="#/equipos?team=${r.p.team}">${esc(r.p.name)}</a><span class="mu">${tn(r.p.team)}</span></div><div class="discsanc"><span class="badge">${r.isCup?'Copa':'Liga'}</span>${motivo(r)}<span class="pill pend">⛔ ${r.pend} partido${r.pend>1?'s':''}</span></div></div>`).join('')||'<div class="empty">Nadie está suspendido por ahora.</div>'}</div>`;
  const tabla=(rows,isCup,reglaTxt)=>{
   const cut=rows.filter(r=>r.pend>0||(r.cerca&&!isCup)).length;
   const top=rows.slice(0,cut),rest=rows.slice(cut),rid=isCup?'disc-copa':'disc-liga';
   const row=r=>`<div class="discrow">
     <div class="discname"><a href="#/equipos?team=${r.p.team}">${esc(r.p.name)}</a><span class="mu">${tn(r.p.team)}</span>${(r.cerca&&!isCup)?'<span title="A una amarilla de la próxima suspensión">⚠️</span>':''}</div>
     <div class="dischist"><span class="mu">Histórico</span><span class="pill y">🟨${r.p.yc}</span><span class="pill r">🟥${r.p.rc}</span></div>
     <div class="discsanc">${r.pend?`<span class="pill pend">⛔ ${r.pend} pendiente${r.pend>1?'s':''}</span>`:`<span class="pill ok">✓ Al día</span>`}${edit?`<span class="donec">(${r.done} cumplida${r.done!=1?'s':''}${r.pend?`<button class="pri" title="Marcar un partido cumplido" onclick="bumpDone('${r.p.id}',${isCup},1)">✓ Cumplió</button>`:''}${r.done>0?`<button title="Deshacer" onclick="bumpDone('${r.p.id}',${isCup},-1)">↺</button>`:''})</span>`:''}</div>
    </div>`;
   const vacio=rows.length?'<div class="empty">Nadie en alerta por ahora.</div>':'<div class="empty">Sin tarjetas registradas.</div>';
   return`<div class="box"><h3>Historial${isCup?' · Copa THC':' · Liga'}</h3>${top.map(row).join('')||vacio}${rest.length?`<div id="${rid}" class="hide">${rest.map(row).join('')}</div><span class="vm" id="${rid}b" onclick="toggleList('${rid}')">Ver más</span>`:''}
   <div class="lg">${reglaTxt}${!isCup?' ⚠️ = a una amarilla de la próxima suspensión.':''}</div></div>`;};
  return alerta
   +tabla(ligaRows,false,'Liga: cada 3 amarillas acumuladas = 1 partido (3, 6, 9…). Cada roja = 1 partido directo y acumulativo (1, 2, 3…).')
   +tabla(copaRows,true,'Copa THC: cada 2 amarillas acumuladas = 1 partido (2, 4, 6…). Cada roja = 1 partido directo y acumulativo (1, 2, 3…). Más estricta por tener menos partidos.')
   +`<div class="lg">"Generadas" se calcula solo, a partir de las tarjetas, y nunca se resetea. "Cumplidas" la marca el editor a mano cada vez que un jugador se baja esa suspensión en un partido real; "Pendientes" es la resta de ambas.</div>`;
 },

 buscar(){
  const q=(S.q||'').trim().toLowerCase();if(!q)return V.tablas();
  const ts=db.teams.filter(t=>t.name.toLowerCase().includes(q)),ps=db.players.filter(p=>p.name.toLowerCase().includes(q));
  return `<div class="box"><h3>Equipos<span>${ts.length}</span></h3>${ts.map(t=>`<div class="rw"><a href="#/equipos?team=${t.id}">${crest(t.id)}${esc(t.name)}</a><span class="mu">${DIVS[t.div]}</span></div>`).join('')||'<div class="empty">Sin resultados.</div>'}</div>
  <div class="box"><h3>Jugadores<span>${ps.length}</span></h3>${ps.slice(0,100).map(p=>`<div class="rw"><a href="#/equipos?team=${p.team}">${esc(p.name)}</a><span class="mu">${tn(p.team)}</span></div>`).join('')||'<div class="empty">Sin resultados.</div>'}</div>`;
 },

 editor(){
  const to=()=>db.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const divOpts=Object.entries(DIVS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  return `<div class="box"><h3>Nuevo equipo</h3><div class="f"><input id="tnm" placeholder="Nombre"><select id="td">${divOpts}</select><select id="tf"><option value="">Federación (opcional)</option><option>Tucapelandia (TFA)</option><option>Islas Hyppia (HYFF)</option><option>Carling (histórico)</option></select><button class="pri" onclick="addTeam()">Agregar equipo</button></div></div>
  <div class="box"><h3>Nuevo jugador</h3><div class="f"><input id="pn" placeholder="Nombre"><select id="pt">${to()}</select><select id="pp"><option value="">Posición (opcional)</option><option value="POR">Arquero</option><option value="DEF">Defensa</option><option value="MED">Mediocampo</option><option value="DEL">Delantero</option></select><button class="pri" onclick="addPlayer()">Agregar jugador</button></div></div>
  <div class="box"><h3>Nuevo partido de liga</h3><div class="f"><select id="md">${divOpts}</select><input id="mr" type="number" min="1" placeholder="Fecha" style="width:80px"><select id="mh">${to()}</select><select id="ma">${to()}</select><button class="pri" onclick="addMatch()">Agregar partido</button></div></div>
  <div class="box"><h3>Nuevo partido de copa</h3><div class="f"><select id="cf">${CUP_FASES.map(f=>`<option>${f}</option>`).join('')}</select><input id="cl" placeholder="Llave (ej: OCTAVOS-01)" size="16"><select id="cg"><option value="1">Ida / único</option><option value="2">Vuelta</option><option value="3">Tercer partido</option></select><select id="ch">${to()}</select><select id="cw">${to()}</select><button class="pri" onclick="addCup()">Agregar partido de copa</button></div><div class="lg">Después de crearlo, los resultados y eventos se cargan desde la pestaña Copa con el botón Eventos de cada partido.</div></div>
  <div class="box"><h3>Datos</h3><div class="f"><button onclick="exportBackup()">Exportar respaldo JSON</button><button onclick="document.getElementById('imp').click()">Importar JSON</button><input id="imp" type="file" accept=".json" hidden onchange="importBackup(this)"></div>
  <div class="lg">Los cambios se guardan solos en Supabase (mirá el indicador arriba). Exportá un respaldo de vez en cuando. "Importar JSON" reemplaza los datos en Supabase: usalo solo si estás seguro.</div></div>`;
 }
};
