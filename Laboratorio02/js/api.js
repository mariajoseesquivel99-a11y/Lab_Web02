"use strict";

/* ═══ api.js ═══ */

const API_BASE = "https://worldcup26.ir";

/* ──────────────────────────────────────────────────────
   SIMULADOR DE ERRORES (solo para fines de defensa técnica)
   Uso: agregar ?simular=429  o  ?simular=500  a la URL
   Sin este parámetro, la app funciona 100% normal.
────────────────────────────────────────────────────── */
function obtenerStatusSimulado() {
  const params = new URLSearchParams(window.location.search);
  const valor = params.get('simular');

  if (valor === '429' || valor === '500') {
    return Number(valor);
  }
  return null; // no hay simulación activa
}

/* ──────────────────────────────────────────────────────
   sleep: pausa "ms" milisegundos sin bloquear el navegador
────────────────────────────────────────────────────── */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ──────────────────────────────────────────────────────
   Caché en localStorage
────────────────────────────────────────────────────── */
function guardarCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

function leerCache(key) {
  const guardado = localStorage.getItem(key);
  if (!guardado) return null;
  return JSON.parse(guardado); // { data, timestamp }
}

/* ──────────────────────────────────────────────────────
   fetchConBackoff: fetch + reintentos con espera exponencial
   + countdown (onReintento) + caché offline como respaldo
   + simulador de errores 429/500 vía parámetro de URL
────────────────────────────────────────────────────── */
async function fetchConBackoff(url, intentos = 4, onReintento = null) {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const statusSimulado = obtenerStatusSimulado();

      let response;
      if (statusSimulado) {
        // No hacemos fetch real: simulamos que el servidor respondió con error
        response = { ok: false, status: statusSimulado };
      } else {
        response = await fetch(url);
      }

      if (!response.ok) {
        const error = new Error(`Error HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      guardarCache(url, data);
      return data;

    } catch (error) {
      const esUltimoIntento = intento === intentos;

      if (esUltimoIntento) {
        // Se agotaron los intentos: intentamos devolver el caché como respaldo
        const cache = leerCache(url);
        if (cache) {
          console.warn(`Usando caché offline para ${url}`);
          return { ...cache.data, __offline: true, __cacheTimestamp: cache.timestamp };
        }
        throw new Error(`No se pudo obtener ${url} tras ${intentos} intentos: ${error.message}`);
      }

      const espera = 1000 * (2 ** (intento - 1));

      if (onReintento) {
        onReintento({ status: error.status, esperaMs: espera, intento, totalIntentos: intentos });
      }

      await sleep(espera);
    }
  }
}