/* ===== CAPA DE DATOS (Supabase) =====
   La interfaz solo usa Data.load() y Data.save(db).
   - load(): trae todo y guarda una "foto" de lo que hay en la base.
   - save(): compara el estado actual contra esa foto y envía SOLO las filas
     que cambiaron (y borra las que ya no están). Los guardados se encolan:
     nunca hay dos en vuelo a la vez, así uno viejo no pisa a uno nuevo. */
const SB_URL='https://thdwohtkvhbynodrnewr.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZHdvaHRrdmhieW5vZHJuZXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Njk4NzQsImV4cCI6MjEwNjA0NTg3NH0.VgExV9nwcyuVFPfTRhydbnE92D-nwzvgeKXKHa1gnKk';
// Si la librería de Supabase no llegó a cargar (sin internet, red bloqueada), la app muestra
// un aviso con "Reintentar" en vez de quedar en blanco.
const SB_LIB_OK=!!(window.supabase&&window.supabase.createClient);
const sb=SB_LIB_OK?window.supabase.createClient(SB_URL,SB_KEY):{
 from(){throw new Error('No se pudo cargar la conexión con la base de datos. Revisá tu internet.')},
 auth:{async getSession(){return{data:{session:null}}},onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},
  async signInWithPassword(){return{error:{message:'Sin conexión con la base de datos.'}}},async signOut(){return{error:null}}}
};

// Temporada activa: se resuelve en Data.load() desde la fila is_current de "temporadas".
let SEASON_ID=null;

const TEAM_COLS=['id','name','div','fed','dt','stadium','logo_url'];
const toDbTeam=t=>Object.fromEntries(TEAM_COLS.map(c=>[c,t[c]??null]));
const toDbMatch=m=>({id:m.id,div:m.div,round:m.round,home_id:m.home,away_id:m.away,hg:m.hg,ag:m.ag,status:m.status,time:m.time||null,ev:m.ev||[],season_id:m.season_id||SEASON_ID});
const fromDbMatch=r=>({id:r.id,div:r.div,round:r.round,home:r.home_id,away:r.away_id,hg:r.hg,ag:r.ag,status:r.status,time:r.time,ev:r.ev||[],season_id:r.season_id});
const toDbCup=c=>({id:c.id,fase:c.fase,llave:c.llave,leg:c.leg,home_id:c.home,away_id:c.away,hg:c.hg,ag:c.ag,pl:c.pl??null,pv:c.pv??null,status:c.status,ev:c.ev||[],season_id:c.season_id||SEASON_ID});
const fromDbCup=r=>({id:r.id,fase:r.fase,llave:r.llave,leg:r.leg,home:r.home_id,away:r.away_id,hg:r.hg,ag:r.ag,pl:r.pl,pv:r.pv,status:r.status,ev:r.ev||[],season_id:r.season_id});
const toDbPlayer=p=>({id:p.id,name:p.name,team_id:p.team,goals:p.goals||0,mvp:p.mvp||0,yc:p.yc||0,rc:p.rc||0,susp_done:p.suspDone||0,position:p.position||null,captain:!!p.captain,season_id:p.seasonId||SEASON_ID});
const fromDbPlayer=r=>({id:r.id,name:r.name,team:r.team_id,goals:r.goals,mvp:r.mvp,yc:r.yc,rc:r.rc,suspDone:r.susp_done||0,position:r.position||null,captain:!!r.captain,seasonId:r.season_id});

/* Colecciones del estado local ↔ tablas de Supabase.
   scoped: los borrados se limitan a la temporada activa.
   derived: la colección se recalcula sola (no la edita una persona), así que
   puede vaciarse sin que eso sea un error. */
const COLLECTIONS=[
 {key:'teams',table:'teams',toDb:toDbTeam},
 {key:'players',table:'players',toDb:toDbPlayer},
 {key:'matches',table:'matches',toDb:toDbMatch},
 {key:'cupPlayers',table:'cup_players',toDb:toDbPlayer,scoped:true,derived:true},
 {key:'cup',table:'cup_matches',toDb:toDbCup}
];
const MASS_DELETE_LIMIT=10;

const Data={
 snap:{},          // {coleccion: Map(id → JSON de la fila tal como está en la base)}
 autoIds:new Set(),// filas que crea la app sola (tercer partido, siguiente ronda): se insertan sin pisar
 status:'idle',
 lastError:null,
 _listeners:[],
 _running:null,
 _pending:null,

 onStatus(fn){this._listeners.push(fn)},
 _emit(s,info){this.status=s;this.lastError=s==='error'?info:null;this._listeners.forEach(fn=>fn(s,info))},
 hasUnsaved(){return this._running!==null||this._pending!==null||this.status==='error'},

 async load(){
  const[se,t,p,m,cp,cm]=await Promise.all([
   sb.from('temporadas').select('*'),sb.from('teams').select('*'),sb.from('players').select('*'),
   sb.from('matches').select('*'),sb.from('cup_players').select('*'),sb.from('cup_matches').select('*')]);
  const err=se.error||t.error||p.error||m.error||cp.error||cm.error;
  if(err)throw err;
  if(!t.data.length)throw new Error('La base de datos no tiene equipos cargados.');
  const cur=se.data.find(s=>s.is_current)||se.data[0];
  SEASON_ID=cur?cur.id:null;
  const d={temporadas:se.data,teams:t.data,players:p.data.map(fromDbPlayer),matches:m.data.map(fromDbMatch),
   cup:cm.data.map(fromDbCup),cupPlayers:cp.data.map(fromDbPlayer)};
  this.takeSnapshot(d);
  return d;
 },

 takeSnapshot(d){
  this.snap={};
  COLLECTIONS.forEach(c=>{this.snap[c.key]=new Map((d[c.key]||[]).map(x=>{const r=c.toDb(x);return[r.id,JSON.stringify(r)]}))});
 },

 /* Encola un guardado. Si ya hay uno en curso, se vuelve a ejecutar al terminar
    con el estado más reciente (los cambios intermedios se juntan en uno solo). */
 save(d,opts={}){
  this._pending={d,opts:{...(this._pending?.opts||{}),...opts}};
  if(!this._running)this._running=this._drain();
  return this._running;
 },

 async _drain(){
  try{
   while(this._pending){
    const{d,opts}=this._pending;this._pending=null;
    await this._saveOnce(d,opts);
   }
  }finally{this._running=null}
 },

 _diff(d){
  const plan=[];
  for(const c of COLLECTIONS){
   const snap=this.snap[c.key]||new Map();
   const rows=(d[c.key]||[]).map(c.toDb);
   const seen=new Set(),upserts=[],inserts=[];
   for(const r of rows){
    seen.add(r.id);
    const js=JSON.stringify(r);
    if(snap.get(r.id)===js)continue;
    if(!snap.has(r.id)&&this.autoIds.has(r.id))inserts.push(r);else upserts.push(r);
   }
   const deletes=[...snap.keys()].filter(id=>!seen.has(id));
   if(upserts.length||inserts.length||deletes.length)plan.push({c,upserts,inserts,deletes});
  }
  return plan;
 },

 async _saveOnce(d,opts){
  const plan=this._diff(d);
  if(!plan.length){if(this.status==='error')this._emit('saved');return}
  // Protección: un guardado normal nunca debería borrar muchas filas de golpe.
  if(!opts.allowMass){
   const big=plan.find(x=>!x.c.derived&&x.deletes.length>MASS_DELETE_LIMIT);
   if(big){this._emit('error',`Se canceló el guardado: iba a borrar ${big.deletes.length} filas de "${big.c.table}" de una vez.`);return}
  }
  this._emit('saving');
  try{
   for(const{c,upserts,inserts,deletes}of plan){
    if(upserts.length){const{error}=await sb.from(c.table).upsert(upserts);if(error)throw error}
    if(inserts.length){const{error}=await sb.from(c.table).upsert(inserts,{onConflict:'id',ignoreDuplicates:true});if(error)throw error}
    if(deletes.length){
     let q=sb.from(c.table).delete().in('id',deletes);
     if(c.scoped&&SEASON_ID!=null)q=q.eq('season_id',SEASON_ID);
     const{error}=await q;if(error)throw error;
    }
    // Solo se actualiza la foto de lo que efectivamente quedó guardado.
    const snap=this.snap[c.key];
    [...upserts,...inserts].forEach(r=>snap.set(r.id,JSON.stringify(r)));
    deletes.forEach(id=>snap.delete(id));
   }
   this._emit('saved');
  }catch(e){
   console.error('Supabase save error',e);
   this._emit('error',friendlyError(e));
  }
 },

 retry(d){return this.save(d)}
};

function friendlyError(e){
 const msg=(e&&(e.message||e.error_description))||String(e);
 if(/JWT|token|not authenticated|permission denied|row-level security/i.test(msg))return'Tu sesión de editor expiró o no tiene permiso. Volvé a iniciar sesión.';
 if(/Failed to fetch|NetworkError|network/i.test(msg))return'Sin conexión con la base de datos. Revisá tu internet.';
 if(/foreign key/i.test(msg))return'No se puede borrar: hay datos que dependen de esa fila.';
 return msg;
}
