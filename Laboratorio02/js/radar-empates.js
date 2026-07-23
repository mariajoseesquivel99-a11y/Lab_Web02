"use strict";

/* ═══ radar-empates.js ═══ */

const empRetryBanner    = document.getElementById('emp-retryBanner');
const empRetryMsg       = document.getElementById('emp-retryMsg');
const empRetryCountdown = document.getElementById('emp-retryCountdown');
const empOfflineBadge   = document.getElementById('emp-offlineBadge');
const empEyebrowCount   = document.getElementById('emp-eyebrowCount');
const empGroupMatrix    = document.getElementById('emp-groupMatrix');

function mostrarCountdownEmp(info) {
  empRetryBanner.classList.add('visible');
  empRetryMsg.textContent = info.status === 429
    ? 'Límite de peticiones alcanzado. Reintentando en'
    : 'Error del servidor. Reintentando en';

  let restante = Math.ceil(info.esperaMs / 1000);
  empRetryCountdown.textContent = restante;

  const intervalo = setInterval(() => {
    restante--;
    empRetryCountdown.textContent = restante > 0 ? restante : 0;
    if (restante <= 0) clearInterval(intervalo);
  }, 1000);
}

function ocultarRetryBannerEmp() {
  empRetryBanner.classList.remove('visible');
}

/* ──────────────────────────────────────────────────────
   Filtra empates y los agrupa por "group" (A a L)
────────────────────────────────────────────────────── */
function calcularEmpates(allGames) {
  const empates = allGames.filter(g =>
    g.finished === "TRUE" && g.home_score === g.away_score
  );

  // Agrupamos usando un objeto: { A: [...], B: [...], ... }
  const porGrupo = {};
  empates.forEach(game => {
    const grupo = game.group;
    if (!porGrupo[grupo]) {
      porGrupo[grupo] = [];
    }
    porGrupo[grupo].push(game);
  });

  return { empates, porGrupo };
}

/* ──────────────────────────────────────────────────────
   Dibuja la matriz de grupos con sus empates
────────────────────────────────────────────────────── */
function renderMatrizEmpates(porGrupo, teams) {
  empGroupMatrix.innerHTML = '';

  const gruposOrdenados = Object.keys(porGrupo).sort();

  gruposOrdenados.forEach(grupo => {
    const juegosDelGrupo = porGrupo[grupo];

    const bloque = document.createElement('div');
    bloque.className = 'group-block';

    const filas = juegosDelGrupo.map(game => {
      let homeNombre = game.home_team_name_en;
      let awayNombre = game.away_team_name_en;

      if (teams) {
        const homeTeam = teams.find(t => String(t.id) === String(game.home_team_id));
        const awayTeam = teams.find(t => String(t.id) === String(game.away_team_id));
        homeNombre = homeTeam ? homeTeam.name_en : homeNombre;
        awayNombre = awayTeam ? awayTeam.name_en : awayNombre;
      }

      return `<div class="tie-cell"><span>${homeNombre} vs ${awayNombre}</span><span>${game.home_score}-${game.away_score}</span></div>`;
    }).join('');

    bloque.innerHTML = `
      <div class="group-block-header">
        <span class="group-block-title">Grupo ${grupo}</span>
        <span class="group-block-count">${juegosDelGrupo.length} empate(s)</span>
      </div>
      ${filas}
    `;
    empGroupMatrix.appendChild(bloque);
  });
}

/* ──────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────── */
async function initRadarEmpates() {
  let porGrupo, totalEmpates;

  try {
    const respuestaGames = await fetchConBackoff(`${API_BASE}/get/games`, 4, mostrarCountdownEmp);
    ocultarRetryBannerEmp();

    if (respuestaGames.__offline) {
      empOfflineBadge.classList.add('visible');
    }

    const resultado = calcularEmpates(respuestaGames.games);
    porGrupo = resultado.porGrupo;
    totalEmpates = resultado.empates.length;
    empEyebrowCount.textContent = totalEmpates;

  } catch (error) {
    ocultarRetryBannerEmp();
    empGroupMatrix.innerHTML = '<p class="state-msg">No se pudieron cargar los partidos.</p>';
    console.error(error);
    return;
  }

  // Pintamos ya con los nombres de respaldo (vienen incluidos en cada partido)
  renderMatrizEmpates(porGrupo, null);

  try {
    const respuestaTeams = await fetchConBackoff(`${API_BASE}/get/teams`, 4, mostrarCountdownEmp);
    ocultarRetryBannerEmp();
    renderMatrizEmpates(porGrupo, respuestaTeams.teams); // repintamos con nombres reales

  } catch (error) {
    ocultarRetryBannerEmp();
    console.error(error);
    // No hay alert-banner en el HTML de este subtema; los datos de respaldo ya se ven bien
  }
}