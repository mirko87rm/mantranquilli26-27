const SUPABASE_URL='https://wwuwmhqylkghdohhgrxo.supabase.co';
const SUPABASE_KEY='sb_publishable_YP7r7R11fwdYYAloEBG5sQ_z8rvZ1RC';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);let teams=[],players=[],marketOpen=false;

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function category(role){
 const r=String(role||'');
 if(r.includes('Por'))return 'Portieri';
 if(/Dc|Dd|Ds|E/.test(r))return 'Difensori';
 if(/M|C|T|W/.test(r))return 'Centrocampisti';
 if(/A|Pc/.test(r))return 'Attaccanti';
 return 'Altri';
}
async function load(){
 const t=await db.from('teams').select('id,name').order('name');
 const p=await db.from('players').select('id,name,role,team_id').order('name');
 if(t.error||p.error){$('connection').textContent='Errore database';$('feedback').textContent=(t.error||p.error).message;return}
 teams=t.data;players=p.data;$('connection').textContent='Database collegato';
 teams.forEach(x=>{ $('teamA').add(new Option(x.name,x.id));$('teamB').add(new Option(x.name,x.id));$('rosterTeam').add(new Option(x.name,x.id)); });
 if(teams.length>1)$('teamB').selectedIndex=1;
 if(teams.length)$('rosterTeam').selectedIndex=0;
 fill();renderRoster();await loadMarket();await loadTrades();
}
function fill(){
 for(const id of ['playersA','playersB'])$(id).innerHTML='';
 const a=$('teamA').value,b=$('teamB').value;
 players.filter(p=>String(p.team_id)===String(a)).forEach(p=>$('playersA').add(new Option(p.name,p.id)));
 players.filter(p=>String(p.team_id)===String(b)).forEach(p=>$('playersB').add(new Option(p.name,p.id)));
}
$('teamA').onchange=fill;$('teamB').onchange=fill;
$('rosterTeam').onchange=renderRoster;$('rosterSearch').oninput=renderRoster;

function renderRoster(){
 if(!$('roster'))return;
 const teamId=$('rosterTeam').value, q=$('rosterSearch').value.trim().toLowerCase();
 const list=players.filter(p=>String(p.team_id)===String(teamId)&&(!q||p.name.toLowerCase().includes(q)));
 $('rosterSummary').textContent=`${list.length} giocatori visualizzati`;
 const groups=['Portieri','Difensori','Centrocampisti','Attaccanti','Altri'];
 $('roster').innerHTML=groups.map(g=>{
   const arr=list.filter(p=>category(p.role)===g);
   if(!arr.length)return '';
   return `<div class="roster-group"><h3>${g} <span>${arr.length}</span></h3><div class="players-list">${arr.map(p=>`<div class="player-row"><strong>${esc(p.name)}</strong><span>${esc(p.role||'—')}</span></div>`).join('')}</div></div>`;
 }).join('')||'<p class="hint">Nessun giocatore trovato.</p>';
}

async function loadMarket(){const r=await db.from('market_sessions').select('*').order('created_at',{ascending:false}).limit(1);if(!r.error&&r.data?.length){marketOpen=!!r.data[0].is_open}renderMarket()}
function renderMarket(){$('marketStatus').textContent=marketOpen?'APERTO':'CHIUSO';$('toggleMarket').textContent=marketOpen?'Chiudi mercato':'Apri mercato'}
$('toggleMarket').onclick=async()=>{marketOpen=!marketOpen;renderMarket();const r=await db.from('market_sessions').insert({name:'Mercato 1',is_open:marketOpen,max_players_per_team:5});if(r.error){marketOpen=!marketOpen;renderMarket();show(r.error.message,true)}};
function selected(id){return [...$(id).selectedOptions].map(o=>({id:o.value,name:o.textContent}))}
function validate(){const a=$('teamA').value,b=$('teamB').value,x=selected('playersA'),y=selected('playersB');if(!marketOpen)return 'Il mercato è chiuso.';if(a===b)return 'Scegli due squadre diverse.';if(!x.length||x.length!==y.length||x.length>5)return 'Seleziona da 1 a 5 giocatori per parte, con lo stesso numero.';return null}
function buildMessage(){const x=selected('playersA'),y=selected('playersB');return `🔄 MANTRANQUILLI26/27\n${$('teamA').selectedOptions[0].text} cede: ${x.map(v=>v.name).join(', ')}\n${$('teamB').selectedOptions[0].text} cede: ${y.map(v=>v.name).join(', ')}`}
$('prepare').onclick=()=>{const e=validate();if(e)return show(e,true);const text=buildMessage();$('message').textContent=text;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');show('Messaggio pronto per WhatsApp.',false)};
$('saveTrade').onclick=async()=>{const e=validate();if(e)return show(e,true);const x=selected('playersA'),y=selected('playersB');const r=await db.from('trades').insert({team_a_id:$('teamA').value,team_b_id:$('teamB').value,status:'pending'}).select('id').single();if(r.error)return show(r.error.message,true);const rows=[...x.map(v=>({trade_id:r.data.id,player_id:v.id,direction:'ceded'})),...y.map(v=>({trade_id:r.data.id,player_id:v.id,direction:'acquired'}))];const q=await db.from('trade_players').insert(rows);if(q.error)return show(q.error.message,true);show('Proposta registrata.',false);await loadTrades()};

async function confirmTrade(id){
 const r=await db.rpc('confirm_trade',{p_trade_id:id});
 if(r.error)return show(r.error.message,true);
 show('Scambio confermato: giocatori trasferiti.',false);
 const p=await db.from('players').select('id,name,role,team_id').order('name');
 if(!p.error){players=p.data;fill();renderRoster();}
 await loadTrades();
}
async function loadTrades(){
 const r=await db.from('trades').select('id,status,created_at,team_a_id,team_b_id,teams_a:team_a_id(name),teams_b:team_b_id(name)').order('created_at',{ascending:false}).limit(20);
 if(r.error){$('trades').textContent='Nessuna proposta visibile.';return}
 if(!r.data.length){$('trades').textContent='Nessuna proposta ancora.';return}
 $('trades').innerHTML='<table><tr><th>Data</th><th>Scambio</th><th>Stato</th><th>Azione</th></tr>'+r.data.map(t=>`<tr><td>${new Date(t.created_at).toLocaleString('it-IT')}</td><td>${esc(t.teams_a?.name||'')} ↔ ${esc(t.teams_b?.name||'')}</td><td>${esc(t.status)}</td><td>${t.status==='pending'?`<button class="small" onclick="confirmTrade('${t.id}')">Conferma</button>`:'—'}</td></tr>`).join('')+'</table>';
}
function show(t,error){$('feedback').textContent=t;$('feedback').className='feedback '+(error?'error':'ok')}
window.confirmTrade=confirmTrade;
load();
