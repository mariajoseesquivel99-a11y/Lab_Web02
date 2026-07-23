"use strict";

/* ═══ analitica-estadios.js ═══ */

const estRetryBanner    = document.getElementById('est-retryBanner');
const estRetryMsg       = document.getElementById('est-retryMsg');
const estRetryCountdown = document.getElementById('est-retryCountdown');
const estAlertBanner    = document.getElementById('est-alertBanner');
const estOfflineBadge   = document.getElementById('est-offlineBadge');
const estEyebrowCount   = document.getElementById('est-eyebrowCount');
const estBarChart       = document.getElementById('est-barChart');

function mostrarCountdownEst(info) {
  estRetryBanner.classList.add('visible');
  estRetryMsg.textContent = info.status === 429
    ? 'Límite de peticiones alcanzado. Reintentando en'
    : 'Error del servidor. Reintentando en';

  let restante = Math.ceil(info.esperaMs / 1000);
  estRetryCountdown.textContent = restante;

  const intervalo = setInterval(() => {
    restante--;
    estRetryCountdown.textContent = restante > 0 ? restante : 0;
    if (restante <= 0) clearInterval(intervalo);
  }, 1000);
}

function ocultarRetryBannerEst() {
  estRetryBanner.classList.remove('visible');
}

/* ──────────────────────────────────────────────────────
   Por cada estadio: cuenta partidos y calcula asistencia
   potencial (capacity * cantidad de partidos albergados)
────────────────────────────────────────────────────── */
function calcularAsistencia(stadiums, games) {
  return stadiums
    .map(stadium => {
      const partidosAqui = games.filter(g => String(g.stadium_id) === String(stadium.id));
      const asistenciaPotencial = stadium.capacity * partidosAqui.length;
      return {
        ...stadium,
        cantidadPartidos: partidosAqui.length,
        asistenciaPotencial
      };
    })
    .sort((a, b) => b.asistenciaPotencial - a.asistenciaPotencial);
}

/* ──────────────────────────────────────────────────────
   Dibuja la gráfica de barras. "datos" es null mientras
   /get/games no haya llegado (o falló).
────────────────────────────────────────────────────── */
function renderBarChart(datos) {
  estBarChart.innerHTML = '';

  if (!datos) {
    estBarChart.innerHTML = '<p class="state-msg">Esperando datos de partidos…</p>';
    return;
  }

  const maxAsistencia = Math.max(...datos.map(d => d.asistenciaPotencial), 1);

  datos.forEach(stadium => {
    const porcentaje = (stadium.asistenciaPotencial / maxAsistencia) * 100;

    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-label">${stadium.name_en}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${porcentaje}%"></div>
      </div>
      <div class="bar-value">${stadium.cantidadPartidos} partidos</div>
    `;
    estBarChart.appendChild(row);
  });
}

/* ──────────────────────────────────────────────────────
   Init: pintamos los 16 estadios primero (solo capacidad,
   sin partidos), y si /get/games falla después, los
   estadios ya dibujados NO desaparecen.
────────────────────────────────────────────────────── */
async function initAnaliticaEstadios() {
  let stadiums;

  try {
    const respuestaStadiums = await fetchConBackoff(`${API_BASE}/get/stadiums`, 4, mostrarCountdownEst);
    ocultarRetryBannerEst();

    if (respuestaStadiums.__offline) {
      estOfflineBadge.classList.add('visible');
    }

    stadiums = respuestaStadiums.stadiums;
    estEyebrowCount.textContent = stadiums.length;

  } catch (error) {
    ocultarRetryBannerEst();
    estBarChart.innerHTML = '<p class="state-msg">No se pudieron cargar los estadios.</p>';
    console.error(error);
    return;
  }

  // Sin partidos todavía: mostramos "esperando datos de partidos"
  renderBarChart(null);

  try {
    const respuestaGames = await fetchConBackoff(`${API_BASE}/get/games`, 4, mostrarCountdownEst);
    ocultarRetryBannerEst();

    const datos = calcularAsistencia(stadiums, respuestaGames.games);
    renderBarChart(datos);

  } catch (error) {
    ocultarRetryBannerEst();
    estAlertBanner.classList.add('visible'); // avisamos, sin destruir nada (ya estaba en "esperando")
    console.error(error);
  }
}