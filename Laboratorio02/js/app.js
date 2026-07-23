"use strict";

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels  = document.querySelectorAll('.tab-panel');

const yaInicializado = {
  'ruta-campeon': false,
  'goleadas': false,
  'el-muro': false,
  'analitica-estadios': false,
  'radar-empates': false,
};

function cambiarTab(nombreTab) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === nombreTab);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${nombreTab}`);
  });

  if (!yaInicializado[nombreTab]) {
    yaInicializado[nombreTab] = true;

    if (nombreTab === 'ruta-campeon') initRutaCampeon();
    if (nombreTab === 'goleadas') initGoleadas();
    if (nombreTab === 'el-muro') initElMuro();
    if (nombreTab === 'analitica-estadios') initAnaliticaEstadios();
    if (nombreTab === 'radar-empates') initRadarEmpates();
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
});

cambiarTab('ruta-campeon');