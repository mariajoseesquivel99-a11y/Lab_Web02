"use strict";


/* ═══ goleadas.js ═══ */

const golRetryBanner    = document.getElementById('gol-retryBanner');
const golRetryMsg       = document.getElementById('gol-retryMsg');
const golRetryCountdown = document.getElementById('gol-retryCountdown');
const golAlertBanner    = document.getElementById('gol-alertBanner');
const golOfflineBadge   = document.getElementById('gol-offlineBadge');
const golEyebrowCount   = document.getElementById('gol-eyebrowCount');
const golCardsGrid      = document.getElementById('gol-cardsGrid');

function mostrarCountdownGol(info) {
  golRetryBanner.classList.add('visible');
  golRetryMsg.textContent = info.status === 429
    ? 'Límite de peticiones alcanzado. Reintentando en'
    : 'Error del servidor. Reintentando en';

  let restante = Math.ceil(info.esperaMs / 1000);
  golRetryCountdown.textContent = restante;

  const intervalo = setInterval(() => {
    restante--;
    golRetryCountdown.textContent = restante > 0 ? restante : 0;
    if (restante <= 0) clearInterval(intervalo);
  }, 1000);
}

function ocultarRetryBannerGol() {
  golRetryBanner.classList.remove('visible');
}

/* ──────────────────────────────────────────────────────
   Calcula las goleadas: partidos terminados con diferencia
   de gol >= 3, ordenados de mayor a menor diferencia
────────────────────────────────────────────────────── */
function calcularGoleadas(allGames) {
  return allGames
    .filter(g => g.finished === "TRUE")               // solo partidos terminados
    .map(g => ({
      ...g,
      diff: Math.abs(Number(g.home_score) - Number(g.away_score))
    }))
    .filter(g => g.diff >= 3)                          // solo goleadas (diff >= 3)
    .sort((a, b) => b.diff - a.diff);                  // de mayor a menor diferencia
}

/* ──────────────────────────────────────────────────────
   Dibuja las tarjetas. "teams" puede ser null (aún no
   llegó /get/teams o falló) — en ese caso usamos los ids.
────────────────────────────────────────────────────── */
function renderGoleadas(goleadas, teams) {
  golEyebrowCount.textContent = goleadas.length;
  golCardsGrid.innerHTML = '';

  goleadas.forEach(game => {
    let homeNombre = game.home_team_id;
    let awayNombre = game.away_team_id;

    if (teams) {
      const homeTeam = teams.find(t => String(t.id) === String(game.home_team_id));
      const awayTeam = teams.find(t => String(t.id) === String(game.away_team_id));
      homeNombre = homeTeam ? homeTeam.name_en : game.home_team_name_en;
      awayNombre = awayTeam ? awayTeam.name_en : game.away_team_name_en;
    } else {
      // Sin teams cargados aún, usamos el nombre que YA viene incluido en el partido
      homeNombre = game.home_team_name_en || game.home_team_id;
      awayNombre = game.away_team_name_en || game.away_team_id;
    }

    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <div class="card-round">${game.group || ''}</div>
          <div class="card-teams">${homeNombre} ${game.home_score} - ${game.away_score} ${awayNombre}</div>
        </div>
        <span class="card-role-badge role-home">Dif. ${game.diff}</span>
      </div>
      <div class="card-body">
        <div class="card-row">
          <div class="card-icon">📅</div>
          <div class="card-row-content">
            <div class="card-row-label">Fecha</div>
            <div class="card-row-value">${new Date(game.local_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </div>
    `;
    golCardsGrid.appendChild(card);
  });
}

/* ──────────────────────────────────────────────────────
   Init: carga games primero (obligatorio para la vista),
   y teams por separado (si falla, no bloquea nada)
────────────────────────────────────────────────────── */
async function initGoleadas() {
  let goleadas;

  try {
    const respuestaGames = await fetchConBackoff(`${API_BASE}/get/games`, 4, mostrarCountdownGol);
    ocultarRetryBannerGol();

    if (respuestaGames.__offline) {
      golOfflineBadge.classList.add('visible');
    }

    goleadas = calcularGoleadas(respuestaGames.games);

  } catch (error) {
    ocultarRetryBannerGol();
    golCardsGrid.innerHTML = '<p class="state-msg">No se pudieron cargar los partidos.</p>';
    console.error(error);
    return;
  }

  // Pintamos YA con los ids/nombres de respaldo, sin esperar a /get/teams
  renderGoleadas(goleadas, null);

  try {
    const respuestaTeams = await fetchConBackoff(`${API_BASE}/get/teams`, 4, mostrarCountdownGol);
    ocultarRetryBannerGol();
    renderGoleadas(goleadas, respuestaTeams.teams); // repintamos con nombres reales

  } catch (error) {
    ocultarRetryBannerGol();
    golAlertBanner.classList.add('visible'); // avisamos, pero la lista ya está visible
    console.error(error);
  }
 
}
