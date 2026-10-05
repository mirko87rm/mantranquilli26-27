const SUPABASE_URL='https://wwuwmhqylkghdohhgrxo.supabase.co';
const SUPABASE_KEY='sb_publishable_YP7r7R11fwdYYAloEBG5sQ_z8rvZ1RC';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);let teams=[],players=[],marketOpen=false;

let currentUser=null,currentProfile=null;
let currentLeagueId=null;
let currentLeague=null;function authMessage(el,msg,error=false){if(el){el.textContent=msg||'';el.classList.toggle('error',!!error)}}
function openAuth(mode='login'){
  $('authModal').classList.remove('hidden');
  $('loginForm').classList.toggle('hidden',mode!=='login');
  $('registerForm').classList.toggle('hidden',mode!=='register');
  authMessage($('loginFeedback'),'');authMessage($('registerFeedback'),'');
}
function closeAuth(){$('authModal').classList.add('hidden')}
function setAuthUI(){
  const area=$('authArea'); if(!area)return;
  if(currentUser&&currentProfile){
    area.innerHTML=`<div class="auth-user"><span>👤 ${esc(currentProfile.username)} · ${esc(currentProfile.team?.name||'')}</span><button id="logoutBtn">Esci</button></div>`;
    $('logoutBtn').onclick=async()=>{await db.auth.signOut()};
  }else{
    area.innerHTML='<button id="openLogin" class="auth-btn">Accedi</button><button id="openRegister" class="auth-btn secondary">Registrati</button>';
    $('openLogin').onclick=()=>openAuth('login');$('openRegister').onclick=()=>openAuth('register');
  }
}
async function refreshAuth(){
  const r=await db.auth.getSession(); currentUser=r.data.session?.user||null; currentProfile=null;
  if(currentUser){
    const p=await db.from('manager_profiles').select('username,team_id,is_admin,teams:team_id(name)').eq('user_id',currentUser.id).maybeSingle();
    if(!p.error)currentProfile=p.data;
  }
  setAuthUI();
  updateAdminUI();
  renderTradeTeams();
  fill();
  if(currentProfile?.is_admin)loadAdminPanel();
}
function updateAdminUI(){
  const nav=$('adminNav');
  if(!nav)return;
  const ok=!!(currentUser&&currentProfile&&currentProfile.is_admin);
  nav.classList.toggle('hidden',!ok);
  if(!ok && $('section-admin')?.classList.contains('active-section')){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    const home=document.querySelector('.nav-item[data-section=\"home\"]'); if(home)home.classList.add('active');
    document.querySelectorAll('.page-section').forEach(x=>x.classList.remove('active-section'));
    $('section-home').classList.add('active-section');
  }
}
async function initAuth(){
  $('homeLoginBtn').onclick=()=>openAuth('login');
  $('closeAuth').onclick=closeAuth;
  $('switchRegister').onclick=()=>openAuth('register');
  $('switchLogin').onclick=()=>openAuth('login');

  $('loginBtn').onclick=async()=>{
    const email=$('loginEmail').value.trim().toLowerCase();
    const password=$('loginPassword').value;
    if(!email||!password)return authMessage($('loginFeedback'),'Inserisci email e password.',true);
    const r=await db.auth.signInWithPassword({email,password});
    if(r.error)return authMessage($('loginFeedback'),'Email o password non corretti.',true);
closeAuth();
await refreshAuth();

document.body.classList.remove('league-selected');
document.body.classList.add('choosing-league');

$('welcomeHome')?.classList.remove('hidden');
$('leagueChooser')?.classList.remove('hidden');

await loadMyLeagues();
};
async function loadMyLeagues(){
  if(!currentUser)return;

  const r=await db
    .from('fantacalcio_members')
   .select('fantacalcio_id, team_id, is_admin, fantacalci(id,name,season)')
    .eq('user_id',currentUser.id);

  if(r.error){
    console.error(r.error);
    show(r.error.message,true);
    return;
  }
const switcher=$('leagueSwitcher');

if(switcher){
  switcher.innerHTML=r.data.map(m=>{
    const league=m.fantacalci;
    return `<option value="${league.id}">${esc(league.name)}</option>`;
  }).join('');

  if(currentLeagueId){
    switcher.value=currentLeagueId;
  }

  switcher.onchange=async()=>{
    const id=switcher.value;
    const selected=r.data.find(m=>String(m.fantacalcio_id)===String(id));

    if(!selected)return;

    currentLeagueId=selected.fantacalcio_id;
    currentLeague=selected.fantacalci;

    if(currentProfile){
      currentProfile.team_id=selected.team_id;
      currentProfile.is_admin=selected.is_admin;
    }

    localStorage.setItem('currentLeagueId',currentLeagueId);

    await load();
renderCalendarRoundOptions();
    await renderCalendar();
    document.body.classList.remove('choosing-league');
    document.body.classList.add('league-selected');

    show('Entrato in '+currentLeague.name,false);

    console.log('Fantacalcio cambiato:',currentLeague);
  };
}
  const chooser=$('leagueChooser');
  const list=$('myLeagues');

  if(!chooser || !list)return;

  if(!r.data || !r.data.length){
    list.innerHTML='<p>Non sei ancora registrato in nessun Fantacalcio.</p>';
    chooser.classList.remove('hidden');
    return;
  }

  list.innerHTML=r.data.map(m=>{
    const league=m.fantacalci;
    return `
      <button class="league-card" data-league-id="${league.id}">
        <strong>${esc(league.name)}</strong>
        <span>Stagione ${esc(league.season || '')}</span>
      </button>
    `;
  }).join('');

 chooser.classList.remove('hidden');

  list.querySelectorAll('.league-card').forEach(button=>{
  button.onclick=async()=>{      const id=button.dataset.leagueId;
      const selected=r.data.find(m=>String(m.fantacalcio_id)===String(id));

      if(!selected)return;

      currentLeagueId=selected.fantacalcio_id;
      currentLeague=selected.fantacalci;

      localStorage.setItem('currentLeagueId',currentLeagueId);
       if($('leagueSwitcher')){
  $('leagueSwitcher').value=currentLeagueId;
}
      await load();
      
      document.body.classList.remove('choosing-league');
      document.body.classList.add('league-selected');

      chooser.classList.add('hidden');
      $('welcomeHome')?.classList.add('hidden');

      show('Entrato in '+currentLeague.name,false);

      console.log('Fantacalcio selezionato:',currentLeague);
    };
  });
};
  $('registerBtn').onclick=async()=>{
    const username=$('registerUsername').value.trim().toLowerCase();
    const email=$('registerEmail').value.trim().toLowerCase();
    const password=$('registerPassword').value;
    const password2=$('registerPassword2').value;
    const leagueId=$('registerLeague').value;
    const teamId=$('registerTeam').value;
    if(!/^[a-z0-9_-]{3,30}$/.test(username))return authMessage($('registerFeedback'),'Username: 3-30 caratteri, solo lettere, numeri, _ o -.',true);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authMessage($('registerFeedback'),'Inserisci un indirizzo email valido.',true);
    if(password.length<6)return authMessage($('registerFeedback'),'La password deve avere almeno 6 caratteri.',true);
    if(!leagueId)return authMessage($('registerFeedback'),'Seleziona un Fantacalcio.',true);
if(!teamId)return authMessage($('registerFeedback'),'Seleziona una squadra.',true);
    if(!teamId)return authMessage($('registerFeedback'),'Seleziona una squadra.',true);

    const taken=await db.from('manager_profiles').select('team_id').eq('team_id',teamId).maybeSingle();
    if(taken.data)return authMessage($('registerFeedback'),'Questa squadra è già stata assegnata a un altro account.',true);

   const r=await db.auth.signUp({
  email,
  password,
  options:{
    data:{
      username,
      team_id:teamId,
      fantacalcio_id:leagueId
    }
  }
});
    if(r.error){
      const msg=r.error.message||'';
      if(/already registered|already exists/i.test(msg))return authMessage($('registerFeedback'),'Questa email è già registrata.',true);
      if(/username/i.test(msg)&&/unique|duplicate|already/i.test(msg))return authMessage($('registerFeedback'),'Questo username è già utilizzato.',true);
      return authMessage($('registerFeedback'),msg,true);
    }
    const userId = r.data.user?.id;

if(userId && leagueId && teamId){
  const { error: memberError } = await db
    .from('fantacalcio_members')
    .insert({
      fantacalcio_id: leagueId,
      user_id: userId,
      team_id: teamId,
      is_admin: false
    });

  if(memberError){
    console.error(memberError);
    return authMessage(
      $('#registerFeedback'),
      'Account creato, ma non è stato possibile completare l’iscrizione al Fantacalcio.',
      true
    );
  }
}
    if(!r.data.session){
      return authMessage($('registerFeedback'),'Account creato. Controlla la tua email e clicca sul link di conferma, poi torna qui per accedere.',false);
    }
    closeAuth();await refreshAuth();show('Account creato e squadra assegnata.',false);
  };

  // Evita deadlock di Supabase Auth: non eseguire getSession() direttamente
  // dentro onAuthStateChange. Rimandiamo il refresh al ciclo successivo.
  db.auth.onAuthStateChange(()=>{setTimeout(()=>refreshAuth(),0);});
  await refreshAuth();
}
async function loadRegisterLeagues(){
  const leagueSelect=$('registerLeague');
  const teamSelect=$('registerTeam');

  if(!leagueSelect || !teamSelect)return;

  const r=await db
    .from('fantacalci')
    .select('id,name,season')
    .order('name');

  if(r.error){
    console.error(r.error);
    return;
  }

  leagueSelect.innerHTML='<option value="">Seleziona il Fantacalcio...</option>'+
    r.data.map(l=>
      `<option value="${l.id}">${esc(l.name)}${l.season?' - '+esc(l.season):''}</option>`
    ).join('');

  teamSelect.innerHTML='<option value="">Prima scegli il Fantacalcio...</option>';
  teamSelect.disabled=true;

  leagueSelect.onchange=async()=>{
    const leagueId=leagueSelect.value;

    teamSelect.innerHTML='<option value="">Caricamento squadre...</option>';
    teamSelect.disabled=true;

    if(!leagueId){
      teamSelect.innerHTML='<option value="">Prima scegli il Fantacalcio...</option>';
      return;
    }

    const r=await db
      .from('teams')
      .select('id,name')
      .eq('fantacalcio_id',leagueId)
      .order('name');

    if(r.error){
      console.error(r.error);
      teamSelect.innerHTML='<option value="">Errore caricamento squadre</option>';
      return;
    }

    const used=await db
      .from('manager_profiles')
      .select('team_id');

    if(used.error){
      console.error(used.error);
      return;
    }

    const usedIds=new Set((used.data||[]).map(x=>String(x.team_id)));

    teamSelect.innerHTML=
      '<option value="">Seleziona la squadra...</option>'+
      r.data
        .filter(t=>!usedIds.has(String(t.id)))
        .map(t=>`<option value="${t.id}">${esc(t.name)}</option>`)
        .join('');

    teamSelect.disabled=false;
  };
}


function setupNavigation(){
 document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=()=>{
   document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
   document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active-section'));
   btn.classList.add('active');
   const target=$('section-'+btn.dataset.section); if(target)target.classList.add('active-section');
   $('sidebar').classList.remove('open');
   window.scrollTo({top:0,behavior:'smooth'});
 });
 $('menuToggle').onclick=()=>$('sidebar').classList.toggle('open');
}
setupNavigation();

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
  if(!currentLeagueId)return;
const t=await db.from('teams').select('id,name').eq('fantacalcio_id',currentLeagueId).order('name'); const p=await db.from('players').select('id,name,role,team_id').order('name');
 if(t.error||p.error){$('connection').textContent='Errore database';$('feedback').textContent=(t.error||p.error).message;return}
 teams=t.data;players=p.data;$('connection').textContent='Database collegato';await await loadRegisterLeagues();
$('teamB').innerHTML='';
$('rosterTeam').innerHTML='';
  teams.forEach(x=>{ $('teamB').add(new Option(x.name,x.id));$('rosterTeam').add(new Option(x.name,x.id)); });
 renderTradeTeams();
 if(teams.length)$('rosterTeam').selectedIndex=0;
fill();
renderStandings();
await loadMarket();

if($('saleTeamFilter')){
    $('saleTeamFilter').innerHTML='<option value="">Tutte</option>';
 
    teams.forEach(t=>{
        $('saleTeamFilter').add(new Option(t.name,t.id));
    });
}

await loadPlayerSales();
await renderMyPlayerSales();
}
function renderTradeTeams(){
 const a=$('teamA'), b=$('teamB'); if(!a||!b)return;
 const myTeamId=currentProfile?.team_id||'';
 a.innerHTML=''; b.innerHTML='';
 if(myTeamId){
   const mine=teams.find(t=>String(t.id)===String(myTeamId));
   if(mine)a.add(new Option(mine.name,mine.id));
   a.disabled=true;
   const opponents=teams.filter(t=>String(t.id)!==String(myTeamId));
   b.innerHTML='<option value="">Seleziona la squadra con cui scambiare…</option>'+opponents.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
   b.disabled=false;
   if(opponents.length)b.selectedIndex=0;
 }else{
   a.innerHTML='<option value="">Accedi per vedere la tua squadra</option>';
   b.innerHTML='<option value="">Accedi per scegliere la squadra</option>';
   a.disabled=true;b.disabled=true;
 }
}
function fill(){
 for(const id of ['playersA','playersB'])$(id).innerHTML='';
 const a=$('teamA').value,b=$('teamB').value;
 players.filter(p=>String(p.team_id)===String(a)).forEach(p=>$('playersA').add(new Option(`${p.name} — ${p.role||''}`,p.id)));
players.filter(p=>String(p.team_id)===String(b)).forEach(p=>$('playersB').add(new Option(`${p.name} — ${p.role||''}`,p.id)));
}
async function loadPlayerSales(){
    const box=$('salePlayers');
    if(!box)return;

    const r=await db
        .from('player_sales')
        .select(`
            id,
            player_id,
            owner_team_id,
            status,
            players:player_id(id,name,role,team_id),
            teams:owner_team_id(id,name)
        `)
        .eq('status','active');

    if(r.error){
        box.innerHTML=`<p class="error">${r.error.message}</p>`;
        return;
    }

    const teamFilter=$('saleTeamFilter')?.value||'';
    const roleFilter=$('saleRoleFilter')?.value||'';

    let rows=r.data||[];

    if(teamFilter){
        rows=rows.filter(x=>String(x.owner_team_id)===String(teamFilter));
    }

    if(roleFilter){
        rows=rows.filter(x=>{
            const role=String(x.players?.role||'');
            return role.split(';').includes(roleFilter);
        });
    }

    if(!rows.length){
        box.innerHTML='<p class="hint">Nessun giocatore in vendita.</p>';
        return;
    }

    const myTeamId=currentProfile?.team_id;

box.innerHTML=rows.map(x=>{
    const isMine=String(x.owner_team_id)===String(myTeamId);

    return `
        <div class="sale-player card">
            <strong>${x.players?.name||'Giocatore'}</strong>
            <span>${x.players?.role||''}</span>
            <span>${x.teams?.name||''}</span>

            ${!isMine ? `
                <button class="sale-propose" data-player-id="${x.player_id}">
                    🔄 Proponi scambio
                </button>
            ` : ''}
        </div>
    `;
}).join('');
  box.querySelectorAll('.sale-propose').forEach(btn=>{
    btn.onclick=()=>{
        const playerId=btn.dataset.playerId;
        const player=rows.find(x=>String(x.player_id)===String(playerId));

        if(!player)return;
saleProposalTargetPlayerId=playerId;
        $('saleProposalBox').classList.remove('hidden');

        $('saleProposalInfo').textContent=
            `Vuoi proporre uno scambio per ${player.players?.name||'questo giocatore'} a ${player.teams?.name||'questa squadra'}.`;

        $('saleProposalPlayers').innerHTML='';

        players
            .filter(p=>String(p.team_id)===String(myTeamId))
            .forEach(p=>{
                $('saleProposalPlayers').add(
                    new Option(
                        `${p.name} — ${p.role||''}`,
                        p.id
                    )
                );
            });

        $('saleProposalFeedback').textContent='';
    };
});
}
$('saleProposalSend').onclick=async()=>{
  if(!currentUser)return openAuth('login');

  const targetPlayer=players.find(p=>String(p.id)===String(saleProposalTargetPlayerId));
  if(!targetPlayer)return show('Giocatore destinatario non trovato.',true);

  const selectedPlayers=[...$('saleProposalPlayers').selectedOptions].map(o=>({
    id:o.value,
    name:o.textContent
  }));

  if(selectedPlayers.length<1||selectedPlayers.length>5){
    $('saleProposalFeedback').textContent='Seleziona da 1 a 5 giocatori da offrire.';
    return;
  }

  const myTeamId=currentProfile?.team_id;
  const targetTeamId=targetPlayer.team_id;

  if(!myTeamId||!targetTeamId){
    $('saleProposalFeedback').textContent='Impossibile determinare le squadre.';
    return;
  }

  if(String(myTeamId)===String(targetTeamId)){
    $('saleProposalFeedback').textContent='Non puoi proporre uno scambio con la tua stessa squadra.';
    return;
  }

  $('saleProposalSend').disabled=true;
  $('saleProposalFeedback').textContent='Invio proposta...';

const session=await db
    .from('market_sessions')
    .select('id')
    .eq('is_open',true)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

if(session.error || !session.data){
    $('saleProposalSend').disabled=false;
    $('saleProposalFeedback').textContent='Nessun mercato aperto.';
    return;
}

const r=await db.from('trades').insert({
    session_id:session.data.id,
    from_team_id:myTeamId,
    to_team_id:targetTeamId,
    status:'pending'
}).select('id').single();
  if(r.error){
    $('saleProposalSend').disabled=false;
    $('saleProposalFeedback').textContent=r.error.message;
    return;
  }

  const rows=[
    ...selectedPlayers.map(p=>({
      trade_id:r.data.id,
      player_id:p.id,
      direction:'ceded'
    })),
    {
      trade_id:r.data.id,
      player_id:targetPlayer.id,
      direction:'acquired'
    }
  ];

  const q=await db.from('trade_players').insert(rows);

  if(q.error){
    $('saleProposalSend').disabled=false;
    $('saleProposalFeedback').textContent=q.error.message;
    return;
  }

  $('saleProposalFeedback').textContent='✅ Proposta inviata correttamente!';
  $('saleProposalSend').disabled=false;

  await loadTrades();
};
async function renderMyPlayerSales(){
    const select=$('saleMyPlayerSelect');
    const button=$('saleMyPlayerButton');

    if(!select || !button)return;

    const myTeamId=currentProfile?.team_id;

    if(!myTeamId){
        select.innerHTML='<option value="">Accedi per visualizzare i tuoi giocatori</option>';
        button.disabled=true;
        return;
    }

    const r=await db
        .from('players')
        .select('id,name,role,team_id')
        .eq('team_id',myTeamId)
        .order('name');

    if(r.error){
        select.innerHTML='<option value="">Errore caricamento giocatori</option>';
        button.disabled=true;
        return;
    }

    const sales=await db
        .from('player_sales')
        .select('player_id,status')
        .eq('owner_team_id',myTeamId)
        .eq('status','active');

    if(sales.error){
        select.innerHTML='<option value="">Errore caricamento vendita</option>';
        button.disabled=true;
        return;
    }

    const listed=new Set(
        (sales.data||[]).map(x=>String(x.player_id))
    );

    select.innerHTML='<option value="">Seleziona un giocatore</option>';

    (r.data||[]).forEach(p=>{
        const active=listed.has(String(p.id));

        select.add(
            new Option(
                `${p.name} — ${p.role||''}${active?' — IN VENDITA':''}`,
                p.id
            )
        );
    });

    button.disabled=true;

    select.onchange=()=>{
        const playerId=select.value;

        if(!playerId){
            button.disabled=true;
            button.textContent='🏷️ Metti in vendita';
            return;
        }

        const active=listed.has(String(playerId));

        button.disabled=false;
        button.textContent=active
            ? '❌ Togli dalla vendita'
            : '🏷️ Metti in vendita';
    };

    button.onclick=async()=>{
        const playerId=select.value;
        if(!playerId)return;

        const active=listed.has(String(playerId));

        if(active){
            const r=await db
                .from('player_sales')
                .update({status:'inactive'})
                .eq('player_id',playerId)
                .eq('owner_team_id',myTeamId);

            if(r.error){
                alert(r.error.message);
                return;
            }
        }else{
            const r=await db
                .from('player_sales')
                .insert({
                    player_id:playerId,
                    owner_team_id:myTeamId,
                    status:'active'
                });

            if(r.error){
                alert(r.error.message);
                return;
            }
        }

        await renderMyPlayerSales();
        await loadPlayerSales();
    };
}

if($('saleTeamFilter')){
    $('saleTeamFilter').onchange=loadPlayerSales;
}

if($('saleRoleFilter')){
    $('saleRoleFilter').onchange=loadPlayerSales;
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
function renderMarket(){$('marketStatus').textContent=marketOpen?'APERTO':'CHIUSO';$('toggleMarket').textContent=marketOpen?'Chiudi mercato':'Apri mercato';if($('homeMarket'))$('homeMarket').textContent=marketOpen?'APERTO':'CHIUSO'}
$('toggleMarket').onclick=async()=>{if(!currentUser)return openAuth('login');if(!currentProfile?.is_admin)return show('Solo un ADMIN può aprire o chiudere il mercato.',true);marketOpen=!marketOpen;renderMarket();const r=await db.from('market_sessions').insert({name:'Mercato 1',is_open:marketOpen,max_players_per_team:5});if(r.error){marketOpen=!marketOpen;renderMarket();show(r.error.message,true)}};
function selected(id){return [...$(id).selectedOptions].map(o=>({id:o.value,name:o.textContent}))}
function validate(){const a=$('teamA').value,b=$('teamB').value,x=selected('playersA'),y=selected('playersB');if(!marketOpen)return 'Il mercato è chiuso.';if(a===b)return 'Scegli due squadre diverse.';if(!x.length||x.length!==y.length||x.length>5)return 'Seleziona da 1 a 5 giocatori per parte, con lo stesso numero.';return null}
function buildMessage(){const x=selected('playersA'),y=selected('playersB');return `🔄 MANTRANQUILLI26/27\n${$('teamA').selectedOptions[0].text} cede: ${x.map(v=>v.name).join(', ')}\n${$('teamB').selectedOptions[0].text} cede: ${y.map(v=>v.name).join(', ')}`}
$('prepare').onclick=()=>{const e=validate();if(e)return show(e,true);const text=buildMessage();$('message').textContent=text;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');show('Messaggio pronto per WhatsApp.',false)};
$('saveTrade').onclick=async()=>{if(!currentUser)return openAuth('login');const e=validate();if(e)return show(e,true);const x=selected('playersA'),y=selected('playersB');const r=await db.from('trades').insert({team_a_id:$('teamA').value,team_b_id:$('teamB').value,status:'pending'}).select('id').single();if(r.error)return show(r.error.message,true);const rows=[...x.map(v=>({trade_id:r.data.id,player_id:v.id,direction:'ceded'})),...y.map(v=>({trade_id:r.data.id,player_id:v.id,direction:'acquired'}))];const q=await db.from('trade_players').insert(rows);if(q.error)return show(q.error.message,true);show('Proposta registrata.',false);await loadTrades()};

async function confirmTrade(id){
 if(!currentProfile?.is_admin)return show('Solo un ADMIN può confermare gli scambi.',true);
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
 const html='<table><tr><th>Data</th><th>Scambio</th><th>Stato</th><th>Azione</th></tr>'+r.data.map(t=>`<tr><td>${new Date(t.created_at).toLocaleString('it-IT')}</td><td>${esc(t.teams_a?.name||'')} ↔ ${esc(t.teams_b?.name||'')}</td><td>${esc(t.status)}</td><td>${t.status==='pending'&&currentProfile?.is_admin?`<button class="small" onclick="confirmTrade('${t.id}')">Conferma</button>`:'—'}</td></tr>`).join('')+'</table>';
 $('trades').innerHTML=html; if($('homeTrades'))$('homeTrades').innerHTML=html;
}

async function loadAdminPanel(){
  if(!currentProfile?.is_admin)return;
  const m=await db.from('manager_profiles').select('user_id,username,team_id,is_admin,created_at,teams:team_id(name)').order('created_at');
  if(m.error){$('adminManagers').textContent=m.error.message;return}
if($('adminManagerCount')) $('adminManagerCount').textContent = String(m.data?.length || 0);  $('adminManagers').innerHTML=m.data?.length?'<div class="table-wrap"><table class="admin-table"><tr><th>Username</th><th>Squadra</th><th>Ruolo</th><th>Registrato</th></tr>'+m.data.map(x=>`<tr><td>${esc(x.username)}</td><td>${esc(x.teams?.name||'—')}</td><td>${x.is_admin?'<span class="admin-badge ok">ADMIN</span>':'<span class="admin-badge">Manager</span>'}</td><td>${x.created_at?new Date(x.created_at).toLocaleDateString('it-IT'):'—'}</td></tr>`).join('')+'</table></div>':'<p class="hint">Nessun manager registrato.</p>';
  const tr=await db.from('trades').select('id,status,created_at,team_a_id,team_b_id,teams_a:team_a_id(name),teams_b:team_b_id(name)').eq('status','pending').order('created_at',{ascending:false});
  if(tr.error){$('adminTrades').textContent=tr.error.message}else{$('adminPendingCount').textContent=String(tr.data?.length||0);$('adminTrades').innerHTML=tr.data?.length?'<div class="table-wrap"><table class="admin-table"><tr><th>Data</th><th>Scambio</th><th>Azione</th></tr>'+tr.data.map(t=>`<tr><td>${new Date(t.created_at).toLocaleString('it-IT')}</td><td>${esc(t.teams_a?.name||'')} ↔ ${esc(t.teams_b?.name||'')}</td><td><div class="admin-actions"><button class="small" onclick="confirmTrade('${t.id}')">Conferma</button><button class="small secondary" onclick="rejectTrade('${t.id}')">Rifiuta</button></div></td></tr>`).join('')+'</table></div>':'<p class="hint">Nessuno scambio in attesa.</p>'}
  $('adminMarketStatus').textContent=marketOpen?'APERTO':'CHIUSO';
  $('adminMarketLabel').textContent=marketOpen?'MERCATO APERTO':'MERCATO CHIUSO';
}
async function rejectTrade(id){
  if(!currentProfile?.is_admin)return show('Solo un ADMIN può rifiutare gli scambi.',true);
  const r=await db.from('trades').update({status:'cancelled'}).eq('id',id).eq('status','pending');
  if(r.error)return show(r.error.message,true);
  show('Scambio rifiutato.',false); await loadTrades(); await loadAdminPanel();
}
if($('adminToggleMarket')) $('adminToggleMarket').onclick=async()=>{
  if(!currentProfile?.is_admin)return;
  marketOpen=!marketOpen; renderMarket();
  const r=await db.from('market_sessions').insert({name:'Mercato 1',is_open:marketOpen,max_players_per_team:5});
  if(r.error){marketOpen=!marketOpen;renderMarket();$('adminFeedback').textContent=r.error.message;$('adminFeedback').classList.add('error');return}
  $('adminFeedback').textContent='Stato mercato aggiornato.';$('adminFeedback').classList.remove('error'); await loadAdminPanel();
};
window.rejectTrade=rejectTrade;
const CALENDARS={"serie":[{"round":1,"serie":"1ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":78,"away_pts":69,"away":"floky","score":"3-1"},{"home":"TIRAGGIRO","home_pts":68.5,"away_pts":82.5,"away":"FC ETTANERA","score":"1-4"},{"home":"ATLETICO MA NON TROPPO","home_pts":66,"away_pts":75,"away":"SPORTING GOL","score":"1-2"},{"home":"JOGA BENITO","home_pts":94.5,"away_pts":71.5,"away":"WEST HAMILTON","score":"6-2"},{"home":"XXSPACERANGER","home_pts":58,"away_pts":72,"away":"FCM CALCIO","score":"0-2"}]},{"round":2,"serie":"2ª Giornata serie a","matches":[{"home":"FC ETTANERA","home_pts":80.5,"away_pts":69,"away":"ACA-POCCHIA","score":"3-1"},{"home":"WEST HAMILTON","home_pts":65.5,"away_pts":60.5,"away":"XXSPACERANGER","score":"0-0"},{"home":"SPORTING GOL","home_pts":80,"away_pts":79.5,"away":"JOGA BENITO","score":"3-3"},{"home":"floky","home_pts":75,"away_pts":71,"away":"ATLETICO MA NON TROPPO","score":"2-2"},{"home":"FCM CALCIO","home_pts":67.5,"away_pts":66,"away":"TIRAGGIRO","score":"1-1"}]},{"round":3,"serie":"3ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":71,"away_pts":64.5,"away":"FCM CALCIO","score":"2-0"},{"home":"TIRAGGIRO","home_pts":78.5,"away_pts":77,"away":"WEST HAMILTON","score":"3-3"},{"home":"ATLETICO MA NON TROPPO","home_pts":92,"away_pts":75,"away":"FC ETTANERA","score":"6-2"},{"home":"floky","home_pts":69,"away_pts":78.5,"away":"SPORTING GOL","score":"1-3"},{"home":"XXSPACERANGER","home_pts":72,"away_pts":74.5,"away":"JOGA BENITO","score":"2-2"}]},{"round":4,"serie":"4ª Giornata serie a","matches":[{"home":"FC ETTANERA","home_pts":84.5,"away_pts":62,"away":"floky","score":"4-0"},{"home":"JOGA BENITO","home_pts":75.5,"away_pts":81,"away":"TIRAGGIRO","score":"2-4"},{"home":"WEST HAMILTON","home_pts":86,"away_pts":67,"away":"ACA-POCCHIA","score":"5-1"},{"home":"SPORTING GOL","home_pts":67.5,"away_pts":67,"away":"XXSPACERANGER","score":"1-1"},{"home":"FCM CALCIO","home_pts":79,"away_pts":79,"away":"ATLETICO MA NON TROPPO","score":"3-3"}]},{"round":5,"serie":"5ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"}]},{"round":6,"serie":"6ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"}]},{"round":7,"serie":"7ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"}]},{"round":8,"serie":"8ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"floky","score":"-"}]},{"round":9,"serie":"9ª Giornata serie a","matches":[{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"}]},{"round":10,"serie":"10ª Giornata serie a","matches":[{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"}]},{"round":11,"serie":"11ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"}]},{"round":12,"serie":"12ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"}]},{"round":13,"serie":"13ª Giornata serie a","matches":[{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"}]},{"round":14,"serie":"14ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"floky","score":"-"}]},{"round":15,"serie":"15ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"}]},{"round":16,"serie":"16ª Giornata serie a","matches":[{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"}]},{"round":17,"serie":"17ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"}]},{"round":18,"serie":"18ª Giornata serie a","matches":[{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"}]},{"round":19,"serie":"19ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"}]},{"round":20,"serie":"20ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"}]},{"round":21,"serie":"21ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"}]},{"round":22,"serie":"22ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"}]},{"round":23,"serie":"23ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"}]},{"round":24,"serie":"24ª Giornata serie a","matches":[{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"}]},{"round":25,"serie":"25ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"}]},{"round":26,"serie":"26ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"}]},{"round":27,"serie":"27ª Giornata serie a","matches":[{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"}]},{"round":28,"serie":"28ª Giornata serie a","matches":[{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"}]},{"round":29,"serie":"29ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"floky","score":"-"}]},{"round":30,"serie":"30ª Giornata serie a","matches":[{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"}]},{"round":31,"serie":"31ª Giornata serie a","matches":[{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"}]},{"round":32,"serie":"32ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"}]},{"round":33,"serie":"33ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"}]},{"round":34,"serie":"34ª Giornata serie a","matches":[{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"}]},{"round":35,"serie":"35ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"}]},{"round":36,"serie":"36ª Giornata serie a","matches":[{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"floky","score":"-"}]},{"round":37,"serie":"37ª Giornata serie a","matches":[{"home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"home":"floky","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"}]},{"round":38,"serie":"38ª Giornata serie a","matches":[{"home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"}]}],"champions":[{"round":1,"serie":"1ª Giornata serie a","matches":[{"group":"A","home":"FCM CALCIO","home_pts":72,"away_pts":69,"away":"floky","score":"2-1"},{"group":"A","home":"ATLETICO MA NON TROPPO","home_pts":66,"away_pts":75,"away":"SPORTING GOL","score":"1-2"},{"group":"A","bye":"WEST HAMILTON"},{"group":"B","home":"ACA-POCCHIA","home_pts":74.5,"away_pts":94.5,"away":"JOGA BENITO","score":"2-6"},{"group":"B","home":"XXSPACERANGER","home_pts":58,"away_pts":82.5,"away":"FC ETTANERA","score":"0-4"},{"group":"B","bye":"TIRAGGIRO"}]},{"round":2,"serie":"4ª Giornata serie a","matches":[{"group":"A","home":"WEST HAMILTON","home_pts":86,"away_pts":79,"away":"ATLETICO MA NON TROPPO","score":"5-3"},{"group":"A","home":"SPORTING GOL","home_pts":67.5,"away_pts":79,"away":"FCM CALCIO","score":"1-3"},{"group":"A","bye":"floky"},{"group":"B","home":"FC ETTANERA","home_pts":84.5,"away_pts":58,"away":"ACA-POCCHIA","score":"4-0"},{"group":"B","home":"TIRAGGIRO","home_pts":81,"away_pts":67,"away":"XXSPACERANGER","score":"4-1"},{"group":"B","bye":"JOGA BENITO"}]},{"round":3,"serie":"7ª Giornata serie a","matches":[{"group":"A","home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"group":"A","home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"group":"A","bye":"ATLETICO MA NON TROPPO"},{"group":"B","home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"group":"B","home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"group":"B","bye":"FC ETTANERA"}]},{"round":4,"serie":"10ª Giornata serie a","matches":[{"group":"A","home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"group":"A","home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"group":"A","bye":"FCM CALCIO"},{"group":"B","home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"group":"B","home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"group":"B","bye":"XXSPACERANGER"}]},{"round":5,"serie":"13ª Giornata serie a","matches":[{"group":"A","home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"group":"A","home":"floky","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"group":"A","bye":"SPORTING GOL"},{"group":"B","home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"group":"B","home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"group":"B","bye":"ACA-POCCHIA"}]},{"round":6,"serie":"16ª Giornata serie a","matches":[{"group":"A","home":"floky","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"group":"A","home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"group":"A","bye":"WEST HAMILTON"},{"group":"B","home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"group":"B","home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"XXSPACERANGER","score":"-"},{"group":"B","bye":"TIRAGGIRO"}]},{"round":7,"serie":"19ª Giornata serie a","matches":[{"group":"A","home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"group":"A","home":"FCM CALCIO","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"group":"A","bye":"floky"},{"group":"B","home":"ACA-POCCHIA","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"group":"B","home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"group":"B","bye":"JOGA BENITO"}]},{"round":8,"serie":"22ª Giornata serie a","matches":[{"group":"A","home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"group":"A","home":"floky","home_pts":0,"away_pts":0,"away":"SPORTING GOL","score":"-"},{"group":"A","bye":"ATLETICO MA NON TROPPO"},{"group":"B","home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"group":"B","home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"group":"B","bye":"FC ETTANERA"}]},{"round":9,"serie":"25ª Giornata serie a","matches":[{"group":"A","home":"SPORTING GOL","home_pts":0,"away_pts":0,"away":"WEST HAMILTON","score":"-"},{"group":"A","home":"floky","home_pts":0,"away_pts":0,"away":"ATLETICO MA NON TROPPO","score":"-"},{"group":"A","bye":"FCM CALCIO"},{"group":"B","home":"JOGA BENITO","home_pts":0,"away_pts":0,"away":"FC ETTANERA","score":"-"},{"group":"B","home":"TIRAGGIRO","home_pts":0,"away_pts":0,"away":"ACA-POCCHIA","score":"-"},{"group":"B","bye":"XXSPACERANGER"}]},{"round":10,"serie":"28ª Giornata serie a","matches":[{"group":"A","home":"ATLETICO MA NON TROPPO","home_pts":0,"away_pts":0,"away":"FCM CALCIO","score":"-"},{"group":"A","home":"WEST HAMILTON","home_pts":0,"away_pts":0,"away":"floky","score":"-"},{"group":"A","bye":"SPORTING GOL"},{"group":"B","home":"FC ETTANERA","home_pts":0,"away_pts":0,"away":"TIRAGGIRO","score":"-"},{"group":"B","home":"XXSPACERANGER","home_pts":0,"away_pts":0,"away":"JOGA BENITO","score":"-"},{"group":"B","bye":"ACA-POCCHIA"}]}]};
function loadAdminResultRounds(){
  const sel=$('adminResultRound');
  if(!sel)return;

const competition=$('adminResultCompetition')?.value||'serie';
const rounds=CALENDARS[competition]||[];
  
  sel.innerHTML=rounds.map(r=>
    `<option value="${r.round}">Giornata ${r.round}</option>`
  ).join('');

  renderAdminResultMatches();
}

async function renderAdminResultMatches(){
  const box=$('adminResultsMatches');
  const sel=$('adminResultRound');

  if(!box||!sel)return;

  const round=Number(sel.value);
  const competition=$('adminResultCompetition')?.value||'serie';
  const rounds=CALENDARS[competition]||[];
  const current=rounds.find(r=>Number(r.round)===round);

  if(!current){
    box.innerHTML='<p class="hint">Giornata non disponibile.</p>';
    return;
  }

  const {data,error}=await db
    .from('match_results')
    .select('home_team,away_team,score')
.eq('series',competition)
    .eq('round',round);

  if(error){
    box.innerHTML=`<p class="hint">${esc(error.message)}</p>`;
    return;
  }

  const saved={};
  (data||[]).forEach(x=>{
    saved[`${x.home_team}|${x.away_team}`]=x.score||'';
  });

  box.innerHTML=current.matches.map((m,i)=>{
    const key=`${m.home}|${m.away}`;
    const score=saved[key]||m.score||'';

    return `
      <div class="result-row">
        <strong>${esc(m.home)}</strong>
        <input id="adminResult_${i}" type="text" value="${esc(score)}" placeholder="0-0" style="width:70px;text-align:center">
        <strong>${esc(m.away)}</strong>
      </div>
    `;
  }).join('');
}

async function saveAdminResults(){
  if(!currentProfile?.is_admin){
    return show('Solo un ADMIN può inserire i risultati.',true);
  }

  const sel=$('adminResultRound');
  if(!sel)return;

  const round=Number(sel.value);
  const competition=$('adminResultCompetition')?.value||'serie';
const rounds=CALENDARS[competition]||[];
  const current=rounds.find(r=>Number(r.round)===round);

  if(!current)return;

  const rows=current.matches.map((m,i)=>({
    series:'competion',
    round:round,
    home_team:m.home,
    away_team:m.away,
    score:$(`adminResult_${i}`)?.value.trim()||''
  }));

  const invalid=rows.find(r=>
    r.score && !/^\d+\s*-\s*\d+$/.test(r.score)
  );

  if(invalid){
    return show('Inserisci i risultati nel formato 0-0, 3-1, 2-2 ecc.',true);
  }

  const {error}=await db
    .from('match_results')
    .upsert(rows,{
      onConflict:'series,round,home_team,away_team'
    });

  if(error){
    return show(error.message,true);
  }

  show('Risultati salvati correttamente.',false);
  await renderAdminResultMatches();
  await renderStandings();
}

if($('adminResultCompetition')){
    $('adminResultCompetition').onchange=loadAdminResultRounds;
}

if($('adminResultRound')){
  $('adminResultRound').onchange=renderAdminResultMatches;
}
if($('adminResultRound')) loadAdminResultRounds();

if($('adminSaveResults')){
  $('adminSaveResults').onclick=saveAdminResults;
}


function scoreParts(score){
 const m=String(score||'').match(/^(\d+)\s*-\s*(\d+)$/);
 return m?[Number(m[1]),Number(m[2])]:null;
}
async function renderStandings(){
    const tbody=document.querySelector('#standingsTable tbody');
    if(!tbody)return;

    const mr=await db
        .from('match_results')
        .select('round,home_team,away_team,score,series')
        .eq('series','serie');

    if(mr.error){
        console.error(mr.error);
        return;
    }

    const stats={};

    teams.forEach(t=>{
        stats[t.name.toUpperCase()]={
            name:t.name,
            pg:0,
            w:0,
            d:0,
            l:0,
            gf:0,
            ga:0,
            pts:0
        };
    });

    let completed=0;

    (mr.data||[]).forEach(m=>{
        if(!m.score)return;

        const sc=scoreParts(m.score);
        if(!sc)return;

        const hn=String(m.home_team||'').toUpperCase();
        const an=String(m.away_team||'').toUpperCase();

        if(!stats[hn] || !stats[an])return;

        const h=stats[hn];
        const a=stats[an];

        h.pg++;
        a.pg++;

        h.gf+=sc[0];
        h.ga+=sc[1];

        a.gf+=sc[1];
        a.ga+=sc[0];

        if(sc[0]>sc[1]){
            h.w++;
            h.pts+=3;
            a.l++;
        }else if(sc[0]<sc[1]){
            a.w++;
            a.pts+=3;
            h.l++;
        }else{
            h.d++;
            a.d++;
            h.pts++;
            a.pts++;
        }

        completed++;
    });

    const rows=Object.values(stats).sort((a,b)=>
        b.pts-a.pts ||
        (b.gf-b.ga)-(a.gf-a.ga) ||
        b.gf-a.gf ||
        a.name.localeCompare(b.name)
    );

    tbody.innerHTML=rows.map((r,i)=>`
        <tr>
            <td><strong>${i+1}</strong></td>
            <td><strong>${r.name}</strong></td>
            <td>${r.pg}</td>
            <td>${r.w}</td>
            <td>${r.d}</td>
            <td>${r.l}</td>
            <td>${r.gf}</td>
            <td>${r.ga}</td>
            <td>${r.gf-r.ga}</td>
            <td><strong>${r.pts}</strong></td>
        </tr>
    `).join('');

    const info=$('standingsInfo');

    if(info){
        info.textContent=completed
            ? `Aggiornata: ${completed} partite disputate.`
            : 'Nessuna partita disputata.';
    }
}
function renderChampionsStandings(){
 const info=$('champStandingsInfo');
 const groups={A:{},B:{}};
 const rounds=CALENDARS.champions||[];
 let completed=0;
 rounds.forEach(r=>r.matches.forEach(m=>{
   const g=String(m.group||'A'); if(!groups[g])groups[g]={};
   if(m.bye)return;
   const sc=scoreParts(m.score); if(!sc)return;
   const hn=String(m.home||'').toUpperCase(), an=String(m.away||'').toUpperCase();
   if(!groups[g][hn])groups[g][hn]={name:m.home,pg:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
   if(!groups[g][an])groups[g][an]={name:m.away,pg:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
   const h=groups[g][hn], a=groups[g][an];
   h.pg++;a.pg++;h.gf+=sc[0];h.ga+=sc[1];a.gf+=sc[1];a.ga+=sc[0];
   if(sc[0]>sc[1]){h.w++;a.l++;h.pts+=3}else if(sc[0]<sc[1]){a.w++;h.l++;a.pts+=3}else{h.d++;a.d++;h.pts++;a.pts++}
   completed++;
 }));
 ['A','B'].forEach(g=>{
   const rows=Object.values(groups[g]).sort((a,b)=>b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.name.localeCompare(b.name,'it'));
   const tbody=$('champStandings'+g)?.querySelector('tbody');
   if(tbody)tbody.innerHTML=rows.map((r,i)=>`<tr><td><strong>${i+1}</strong></td><td><strong>${esc(r.name)}</strong></td><td>${r.pg}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td><strong>${r.pts}</strong></td></tr>`).join('')||'<tr><td colspan="10">Nessun risultato</td></tr>';
 });
 if(info)info.textContent=completed?`Aggiornata con ${completed} partite disputate.`:'Nessun risultato inserito nel calendario Champions League.';
}

let activeStats='serie';

function renderStatistics(){
 const rounds=CALENDARS[activeStats]||[];
 const stats={};
 const ensure=(name)=>{const k=String(name||'').toUpperCase(); if(!stats[k])stats[k]={name,pg:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}; return stats[k]};
 let completed=0;
 rounds.forEach(r=>r.matches.forEach(m=>{
   if(m.bye)return;
   const sc=scoreParts(m.score); if(!sc)return;
   const h=ensure(m.home), a=ensure(m.away);
   h.pg++; a.pg++; h.gf+=sc[0]; h.ga+=sc[1]; a.gf+=sc[1]; a.ga+=sc[0];
   if(sc[0]>sc[1]){h.w++;a.l++;h.pts+=3}
   else if(sc[0]<sc[1]){a.w++;h.l++;a.pts+=3}
   else{h.d++;a.d++;h.pts++;a.pts++}
   completed++;
 }));
 const rows=Object.values(stats).sort((a,b)=>b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.name.localeCompare(b.name,'it'));
 const tbody=$('statsTable')?.querySelector('tbody');
 if(tbody)tbody.innerHTML=rows.map((r,i)=>`<tr><td><strong>${i+1}</strong></td><td><strong>${esc(r.name)}</strong></td><td>${r.pg}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td><strong>${r.pts}</strong></td><td>${r.pg?(r.gf/r.pg).toFixed(2):'0.00'}</td></tr>`).join('')||'<tr><td colspan="11">Nessun risultato disponibile.</td></tr>';
 const hi=$('statsHighlights');
 if(hi){
   if(!rows.length){hi.innerHTML='<div class="stats-highlight"><strong>Nessun dato</strong><span>Inserisci i risultati nel calendario.</span></div>';}
   else{
     const bestAttack=[...rows].sort((a,b)=>b.gf-a.gf)[0];
     const bestDefense=[...rows].sort((a,b)=>a.ga-b.ga)[0];
     const bestWin=[...rows].filter(r=>r.w>0).sort((a,b)=>b.w-a.w || b.pts-a.pts)[0];
     const avg=[...rows].sort((a,b)=>(b.gf/b.pg)-(a.gf/a.pg))[0];
     hi.innerHTML=`<div class="stats-highlight"><strong>⚽ Miglior attacco</strong><span>${esc(bestAttack.name)} · ${bestAttack.gf} gol</span></div><div class="stats-highlight"><strong>🛡️ Miglior difesa</strong><span>${esc(bestDefense.name)} · ${bestDefense.ga} gol subiti</span></div><div class="stats-highlight"><strong>🏆 Più vittorie</strong><span>${esc(bestWin?.name||'—')} · ${bestWin?.w||0}</span></div><div class="stats-highlight"><strong>📈 Media gol più alta</strong><span>${esc(avg.name)} · ${(avg.gf/avg.pg).toFixed(2)} a partita</span></div>`;
   }
 }
 const maxRound=rounds.filter(r=>r.matches.some(m=>scoreParts(m.score))).reduce((x,r)=>Math.max(x,r.round),0);
 if($('statsInfo'))$('statsInfo').textContent=completed?`Aggiornata con ${completed} partite disputate${maxRound?` · ultima giornata completata: ${maxRound}ª`:''}.`:'Nessun risultato inserito nel calendario.';
}

document.querySelectorAll('.stats-tab').forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll('.stats-tab').forEach(b=>b.classList.remove('active'));
 btn.classList.add('active'); activeStats=btn.dataset.stats; renderStatistics();
});

let activeCalendar='serie';

function renderCalendarRoundOptions(){
  const rounds=currentLeagueId==='48084771-c8ff-4f93-b842-1e7ae4422560' ? [] : (CALENDARS[activeCalendar]||[]);
  $('calendarRound').innerHTML=rounds.map(r=>`<option value="${r.round}">Giornata ${r.round}</option>`).join('');
  renderCalendar();
}

async function renderCalendar(){
  const rounds=currentLeagueId==='48084771-c8ff-4f93-b842-1e7ae4422560' ? [] : (CALENDARS[activeCalendar]||[]);
 const mr=await db.from('match_results').select('round,home_team,away_team,score').eq('series',activeCalendar);
const saved={};

 if(!rounds.length){
 $('calendarRound').innerHTML='';
$('calendarContent').innerHTML='<p class="hint">Nessun calendario disponibile.</p>';
 return;
 }

  (mr.data||[]).forEach(x=>saved[`${x.home_team}|${x.away_team}`]=x.score);

    const n=Number($('calendarRound').value||rounds[0]?.round);
  const r=rounds.find(x=>x.round===n)||rounds[0];
  const grouped={};
 r.matches.forEach(m=>{const g=m.group||'A';(grouped[g]??=[]).push(m)});
 let html='';
 Object.keys(grouped).sort().forEach(g=>{
   if(activeCalendar==='champions')html+=`<h3 class="calendar-group-title">Girone ${esc(g)}</h3>`;
   grouped[g].forEach(m=>{
     if(m.bye){
       html+=`<div class="calendar-bye">⏸️ Riposa <strong>${esc(m.bye)}</strong></div>`;
       return;
     }
const score=saved[`${m.home}|${m.away}`]||((m.score&&m.score!=='-')?m.score:'-');
     const hasPts=(m.home_pts!==null&&m.home_pts!==undefined&&m.away_pts!==null&&m.away_pts!==undefined&&!(m.home_pts===0&&m.away_pts===0&&score==='—'));
     const points=hasPts?`<div class="fantasy-points">Punti: ${esc(m.home_pts)} — ${esc(m.away_pts)}</div>`:'';
     html+=`<div class="match-card"><div class="team-name">${esc(m.home)}</div><div class="match-score">${esc(score)}</div><div class="team-name team-away">${esc(m.away)}</div>${points}</div>`;
   });
 });
 $('calendarContent').innerHTML=html||'<p class="hint">Nessuna partita.</p>';
}
document.querySelectorAll('.calendar-tab').forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll('.calendar-tab').forEach(b=>b.classList.remove('active'));
 btn.classList.add('active');activeCalendar=btn.dataset.cal;renderCalendarRoundOptions();
});
$('calendarRound').onchange=renderCalendar;
renderCalendarRoundOptions();

window.confirmTrade=confirmTrade;
renderStandings();
renderChampionsStandings();
renderStatistics();
initAuth();
load();
document.addEventListener('DOMContentLoaded',()=>{
  const whatsapp=$('shareWhatsapp');

  if(whatsapp){
    whatsapp.onclick=()=>{
      const url='https://mantranquillisitocorrettogiocatorip-gamma.vercel.app';
      const text='⚽ Entra nel mio Fantacalcio MANTRANQUILLI26/27!\n\n👉 '+url;

      window.open(
        'https://wa.me/?text='+encodeURIComponent(text),
        '_blank'
      );
    };
  }
});
