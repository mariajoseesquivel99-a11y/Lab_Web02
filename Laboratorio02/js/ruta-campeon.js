"use strict";

/* ═══ ruta-campeon.js ═══ */



const teamSelect     = document.getElementById('rc-teamSelect');
const retryBanner    = document.getElementById('rc-retryBanner');
const retryMsg       = document.getElementById('rc-retryMsg');
const retryCountdown = document.getElementById('rc-retryCountdown');
const alertBanner    = document.getElementById('rc-alertBanner');
const offlineBadge   = document.getElementById('rc-offlineBadge');
const teamInfo       = document.getElementById('rc-teamInfo');
const teamFlagImg    = document.getElementById('rc-teamFlagImg');
const teamNameEl     = document.getElementById('rc-teamName');
const statsBar       = document.getElementById('rc-statsBar');
const statGames      = document.getElementById('rc-statGames');
const statCities     = document.getElementById('rc-statCities');
const statHome       = document.getElementById('rc-statHome');
const statAway       = document.getElementById('rc-statAway');
const citiesSection  = document.getElementById('rc-citiesSection');
const citiesChips    = document.getElementById('rc-citiesChips');
const sectionEyebrow = document.getElementById('rc-sectionEyebrow');
const eyebrowCount   = document.getElementById('rc-eyebrowCount');
const cardsGrid      = document.getElementById('rc-cardsGrid');

let allTeams = []; // guardamos los equipos ya cargados para no volver a pedirlos

/* ──────────────────────────────────────────────────────
   Muestra el countdown visible en el banner cuando hay
   un reintento (429 o 500) en cualquiera de los fetch
────────────────────────────────────────────────────── */
function mostrarCountdown(info) {
  retryBanner.classList.add('visible');
  retryMsg.textContent = info.status === 429
    ? 'Límite de peticiones alcanzado. Reintentando en'
    : 'Error del servidor. Reintentando en';

  let restante = Math.ceil(info.esperaMs / 1000);
  retryCountdown.textContent = restante;

  const intervalo = setInterval(() => {
    restante--;
    retryCountdown.textContent = restante > 0 ? restante : 0;
    if (restante <= 0) clearInterval(intervalo);
  }, 1000);
}

function ocultarRetryBanner() {
  retryBanner.classList.remove('visible');
}

/* ──────────────────────────────────────────────────────
   Paso 1: cargar los 48 equipos y llenar el <select>
────────────────────────────────────────────────────── */
async function cargarEquipos() {
  try {
    const respuesta = await fetchConBackoff(`${API_BASE}/get/teams`, 4, mostrarCountdown);
    ocultarRetryBanner();

    if (respuesta.__offline) {
      offlineBadge.classList.add('visible');
    }

    const teams = respuesta.teams; // el array real está adentro del objeto
    allTeams = teams;

    teamSelect.innerHTML = '<option value="">— Selecciona un equipo —</option>';
    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name_en;
      teamSelect.appendChild(option);
    });

    teamSelect.disabled = false;

  } catch (error) {
    ocultarRetryBanner();
    teamSelect.innerHTML = '<option value="">Error al cargar equipos</option>';
    console.error(error);
  }
}

/* ──────────────────────────────────────────────────────
   Paso 2: al elegir un equipo, buscar sus partidos y
   cruzar estadios
────────────────────────────────────────────────────── */
async function onTeamSelected() {
  const teamId = teamSelect.value;
  if (!teamId) return;

  cardsGrid.innerHTML = '<p>Cargando itinerario…</p>';
  alertBanner.classList.remove('visible');

  const team = allTeams.find(t => String(t.id) === String(teamId));
  teamNameEl.textContent = team.name_en;
  teamFlagImg.src = team.flag || '';
  teamInfo.classList.add('visible');

  // Traemos TODOS los partidos y filtramos los de este equipo
  let games;
  try {
    const respuestaGames = await fetchConBackoff(`${API_BASE}/get/games`, 4, mostrarCountdown);
    ocultarRetryBanner();

    const allGames = respuestaGames.games; // el array real está adentro del objeto

    games = allGames.filter(g =>
      String(g.home_team_id) === String(teamId) || String(g.away_team_id) === String(teamId)
    );
    games.sort((a, b) => new Date(a.local_date) - new Date(b.local_date));

  } catch (error) {
    ocultarRetryBanner();
    cardsGrid.innerHTML = '<p class="state-msg">No se pudieron cargar los partidos.</p>';
    console.error(error);
    return; // sin partidos no hay nada más que hacer aquí
  }

  // Pintamos las tarjetas de una vez con lo que sí tenemos (partidos)
  renderCards(games, null); // null = todavía no tenemos estadios

  // Ahora intentamos traer los estadios, PERO si falla, las tarjetas ya están dibujadas
  try {
    const respuestaStadiums = await fetchConBackoff(`${API_BASE}/get/stadiums`, 4, mostrarCountdown);
    ocultarRetryBanner();

    const stadiums = respuestaStadiums.stadiums; // el array real está adentro del objeto

    renderCards(games, stadiums); // repintamos, ahora con datos de estadio
    actualizarStats(games, stadiums);

  } catch (error) {
    ocultarRetryBanner();
    alertBanner.classList.add('visible'); // avisamos, pero NO borramos las tarjetas
    actualizarStats(games, null);
    console.error(error);
  }
}

/* ──────────────────────────────────────────────────────
   Cruza partidos + estadios y dibuja las tarjetas
────────────────────────────────────────────────────── */
function renderCards(games, stadiums) {
  const team = allTeams.find(t => String(t.id) === String(teamSelect.value));

  eyebrowCount.textContent = games.length;
  sectionEyebrow.classList.add('visible');

  cardsGrid.innerHTML = '';

  games.forEach(game => {
    const esLocal = String(game.home_team_id) === String(teamSelect.value);
    const rivalId = esLocal ? game.away_team_id : game.home_team_id;
    const rival = allTeams.find(t => String(t.id) === String(rivalId));
    // Respaldo: si no encontramos al rival en allTeams, usamos el nombre
    // que ya viene incluido directo en el propio partido.
    const rivalNombre = rival
      ? rival.name_en
      : (esLocal ? game.away_team_name_en : game.home_team_name_en);

    let stadiumHtml = '<span class="card-row-value">Estadio no disponible</span>';
    if (stadiums) {
      const stadium = stadiums.find(s => String(s.id) === String(game.stadium_id));
      if (stadium) {
        stadiumHtml = `<span class="card-row-value">${stadium.name_en}</span>
                       <div class="card-row-sub">${stadium.city_en}, ${stadium.country_en} · Aforo: ${stadium.capacity.toLocaleString()}</div>`;
      }
    }

    const card = document.createElement('div');
    card.className = `match-card ${esLocal ? 'home' : ''}`;
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <div class="card-round">${game.group || 'Fase de grupos'}</div>
          <div class="card-teams">
            <span class="${esLocal ? 'team-highlight' : ''}">${esLocal ? team.name_en : rivalNombre}</span>
            vs
            <span class="${!esLocal ? 'team-highlight' : ''}">${!esLocal ? team.name_en : rivalNombre}</span>
          </div>
        </div>
        <span class="card-role-badge ${esLocal ? 'role-home' : 'role-away'}">${esLocal ? 'Local' : 'Visitante'}</span>
      </div>
      <div class="card-body">
        <div class="card-row">
          <div class="card-icon">📅</div>
          <div class="card-row-content">
            <div class="card-row-label">Fecha</div>
            <div class="card-row-value">${new Date(game.local_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div class="card-row">
          <div class="card-icon">🏟️</div>
          <div class="card-row-content">
            <div class="card-row-label">Estadio</div>
            ${stadiumHtml}
          </div>
        </div>
      </div>
    `;
    cardsGrid.appendChild(card);
  });
}

/* ──────────────────────────────────────────────────────
   Calcula y muestra la barra de estadísticas
────────────────────────────────────────────────────── */
function actualizarStats(games, stadiums) {
  const teamId = teamSelect.value;
  const homeGames = games.filter(g => String(g.home_team_id) === String(teamId)).length;
  const awayGames = games.length - homeGames;

  let ciudadesUnicas = 0;
  if (stadiums) {
    const ciudades = new Set();
    games.forEach(g => {
      const stadium = stadiums.find(s => String(s.id) === String(g.stadium_id));
      if (stadium) ciudades.add(stadium.city_en);
    });
    ciudadesUnicas = ciudades.size;
    citiesSection.classList.add('visible');
    citiesChips.innerHTML = [...ciudades].map(c => `<span class="city-chip">${c}</span>`).join('');
  }

  statGames.textContent = games.length;
  statCities.textContent = stadiums ? ciudadesUnicas : '—';
  statHome.textContent = homeGames;
  statAway.textContent = awayGames;
  statsBar.classList.add('visible');
}

/* ──────────────────────────────────────────────────────
   Inicialización de esta pestaña (llamada desde app.js)
────────────────────────────────────────────────────── */
function initRutaCampeon() {
  teamSelect.addEventListener('change', onTeamSelected);
  cargarEquipos();
}