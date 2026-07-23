"use strict";

/* ═══ el-muro.js ═══ */

const muroRetryBanner    = document.getElementById('muro-retryBanner');
const muroRetryMsg       = document.getElementById('muro-retryMsg');
const muroRetryCountdown = document.getElementById('muro-retryCountdown');
const muroOfflineBadge   = document.getElementById('muro-offlineBadge');
const muroEyebrowCount   = document.getElementById('muro-eyebrowCount');
const muroRankingList    = document.getElementById('muro-rankingList');

function mostrarCountdownMuro(info) {
  muroRetryBanner.classList.add('visible');
  muroRetryMsg.textContent = info.status === 429
    ? 'Límite de peticiones alcanzado. Reintentando en'
    : 'Error del servidor. Reintentando en';

  let restante = Math.ceil(info.esperaMs / 1000);
  muroRetryCountdown.textContent = restante;

  const intervalo = setInterval(() => {
    restante--;
    muroRetryCountdown.textContent = restante > 0 ? restante : 0;
    if (restante <= 0) clearInterval(intervalo);
  }, 1000);
}

function ocultarRetryBannerMuro() {
  muroRetryBanner.classList.remove('visible');
}

/* ──────────────────────────────────────────────────────
   Recorre los 12 grupos, saca {team_id, ga} de cada
   equipo, unifica todo en un solo arreglo de 48 y
   ordena ascendente por goles en contra (mejor defensa)
────────────────────────────────────────────────────── */
function calcularMejoresDefensas(groups) {
  const todos = [];

  groups.forEach(group => {
    group.teams.forEach(t => {
      todos.push({
        team_id: t.team_id,
        ga: Number(t.ga)
      });
    });
  });

  todos.sort((a, b) => a.ga - b.ga); // ascendente: menos goles en contra primero

  return todos.slice(0, 5); // top 5
}

/* ──────────────────────────────────────────────────────
   Busca, para un team_id dado, su próximo partido con
   finished: "FALSE", ordenado por fecha más próxima.
────────────────────────────────────────────────────── */
function buscarProximoRival(teamId, allGames) {
  const pendientes = allGames.filter(g =>
    (String(g.home_team_id) === String(teamId) || String(g.away_team_id) === String(teamId)) &&
    g.finished === "FALSE"
  );

  if (pendientes.length === 0) return null;

  pendientes.sort((a, b) => new Date(a.local_date) - new Date(b.local_date));

  const proximo = pendientes[0];
  const esLocal = String(proximo.home_team_id) === String(teamId);
  return esLocal ? proximo.away_team_id : proximo.home_team_id;
}

/* ──────────────────────────────────────────────────────
   Dibuja el ranking de 5 filas
────────────────────────────────────────────────────── */
function renderRanking(top5, teams, allGames) {
  muroRankingList.innerHTML = '';

  top5.forEach((entry, index) => {
    const team = teams ? teams.find(t => String(t.id) === String(entry.team_id)) : null;
    const nombre = team ? team.name_en : `Equipo ${entry.team_id}`;
    const bandera = team ? team.flag : '';

    let rivalHtml = 'Próximo rival no disponible';
    if (allGames) {
      try {
        const rivalId = buscarProximoRival(entry.team_id, allGames);
        if (rivalId) {
          const rivalTeam = teams ? teams.find(t => String(t.id) === String(rivalId)) : null;
          rivalHtml = rivalTeam ? `vs ${rivalTeam.name_en}` : `vs Equipo ${rivalId}`;
        } else {
          rivalHtml = 'Sin próximo partido registrado';
        }
      } catch (error) {
        rivalHtml = 'Próximo rival no disponible';
      }
    }

    const row = document.createElement('div');
    row.className = 'ranking-row';
    row.innerHTML = `
      <div class="ranking-pos">${index + 1}</div>
      ${bandera ? `<img class="ranking-flag" src="${bandera}" alt="Bandera de ${nombre}">` : ''}
      <div class="ranking-main">
        <div class="ranking-name">${nombre}</div>
        <div class="ranking-sub">${rivalHtml}</div>
      </div>
      <div class="ranking-metric">${entry.ga} GA</div>
    `;
    muroRankingList.appendChild(row);
  });
}

/* ──────────────────────────────────────────────────────
   Init: groups es obligatorio (sin eso no hay ranking).
   teams y games se cargan después; si fallan, cada fila
   cae en su propio respaldo ("Equipo X", "no disponible").
────────────────────────────────────────────────────── */
async function initElMuro() {
  let top5;

  try {
    const respuestaGroups = await fetchConBackoff(`${API_BASE}/get/groups`, 4, mostrarCountdownMuro);
    ocultarRetryBannerMuro();

    if (respuestaGroups.__offline) {
      muroOfflineBadge.classList.add('visible');
    }

    top5 = calcularMejoresDefensas(respuestaGroups.groups);
    muroEyebrowCount.textContent = top5.length;

  } catch (error) {
    ocultarRetryBannerMuro();
    muroRankingList.innerHTML = '<p class="state-msg">No se pudo cargar el ranking.</p>';
    console.error(error);
    return;
  }

  // Pintamos ya con "Equipo X" de respaldo, sin nombres ni próximo rival
  renderRanking(top5, null, null);

  let teams = null;
  let allGames = null;

  try {
    const respuestaTeams = await fetchConBackoff(`${API_BASE}/get/teams`, 4, mostrarCountdownMuro);
    ocultarRetryBannerMuro();
    teams = respuestaTeams.teams;
  } catch (error) {
    console.error('No se pudieron cargar los equipos:', error);
  }

  try {
    const respuestaGames = await fetchConBackoff(`${API_BASE}/get/games`, 4, mostrarCountdownMuro);
    ocultarRetryBannerMuro();
    allGames = respuestaGames.games;
  } catch (error) {
    console.error('No se pudieron cargar los partidos:', error);
  }

  // Repintamos con lo que sí logramos obtener (puede ser solo teams, solo games, o ambos)
  renderRanking(top5, teams, allGames);
}