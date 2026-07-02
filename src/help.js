import { state } from './config.js';
import { esc } from './helpers.js';

const ICONS = {
  inventory:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  uncheck:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  check:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  order:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
  manual:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  status:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  stats:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  product:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
  users:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
};

const FLOWS = {
  comensal: [
    {
      icon: 'inventory',
      title: 'Fer l\'inventari',
      color: '#4e9d7a',
      steps: [
        'Ves a la pestanya <strong>Catàleg</strong>',
        'Clica un producte i introdueix les <strong>caixes</strong> i <strong>unitats</strong> disponibles',
        'Repeteix per tots els productes que tens en estoc',
        'Quan hagis acabat, prem <strong>Enviar inventari</strong> al Resum',
      ],
    },
    {
      icon: 'uncheck',
      title: 'Desmarcar un producte',
      color: '#c87d4a',
      steps: [
        'A <strong>Resum</strong>, clica la <strong>×</strong> al costat del producte',
        'O torna al <strong>Catàleg</strong>, clica el producte i prem <strong>Desmarcar</strong>',
      ],
    },
    {
      icon: 'check',
      title: 'Comprovar si l\'inventari ha arribat',
      color: '#5b8fc9',
      steps: [
        'Ves a la pestanya <strong>Informes</strong>',
        'Les entrades amb la icona verda <strong>Rebut</strong> confirmen que el coordinador l\'ha vist',
      ],
    },
  ],
  coordinador: [
    {
      icon: 'order',
      title: 'Generar comanda des d\'un inventari',
      color: '#4e9d7a',
      steps: [
        'Ves a <strong>Informes</strong> i localitza l\'inventari rebut',
        'Prem <strong>Generar comanda</strong>',
        'Revisa i ajusta les quantitats proposades',
        'Prem <strong>Acceptar comanda</strong> per crear-la',
      ],
    },
    {
      icon: 'manual',
      title: 'Crear una comanda manual',
      color: '#7b5ea7',
      steps: [
        'Ves a <strong>Comandes</strong> i prem <strong>+ Nova comanda</strong>',
        'Cerca productes amb el buscador i afegeix-los',
        'Introdueix caixes i unitats per a cada producte',
        'Omple proveïdor i data i prem <strong>Desar</strong>',
      ],
    },
    {
      icon: 'status',
      title: 'Canviar l\'estat d\'una comanda',
      color: '#c87d4a',
      steps: [
        'A <strong>Comandes</strong>, clica la pastilla d\'estat de la comanda',
        'L\'estat canvia automàticament: Pendent → En curs → Rebuda',
      ],
    },
    {
      icon: 'stats',
      title: 'Veure estadístiques',
      color: '#5b8fc9',
      steps: [
        'Ves a la pestanya <strong>Estadístiques</strong>',
        'Consulta els gràfics d\'estat de comandes i adults per masia',
      ],
    },
  ],
  admin: [
    {
      icon: 'product',
      title: 'Afegir o editar un producte',
      color: '#4e9d7a',
      steps: [
        'Ves a <strong>Catàleg</strong> i prem <strong>+ Nou producte</strong>',
        'Per editar-ne un, mantén premut sobre el producte',
        'Defineix nom, categoria, unitat, unitats per caixa i estoc mínim',
      ],
    },
    {
      icon: 'users',
      title: 'Gestionar usuaris',
      color: '#c87d4a',
      steps: [
        'Ves a la pestanya <strong>Usuaris</strong>',
        'Prem <strong>+ Nou usuari</strong> per afegir un Encarregat, Coordinador o Admin',
        'Per eliminar-ne un, clica l\'usuari i prem <strong>Eliminar</strong>',
      ],
    },
  ],
};

const ROL_LABEL = { comensal: 'Encarregat', coordinador: 'Coordinador', admin: 'Admin' };
const ROL_COLOR = { comensal: '#4e9d7a',   coordinador: '#5b8fc9',      admin: '#c87d4a' };

function _flowHtml(f) {
  const icon = ICONS[f.icon] || '';
  const steps = f.steps.map((s, i) => `
    <div class="help-step">
      <span class="help-step-num" style="background:${f.color}22;color:${f.color}">${i + 1}</span>
      <span class="help-step-text">${s}</span>
    </div>`).join('');
  return `
    <div class="help-flow">
      <div class="help-flow-head" style="color:${f.color}">
        <span class="help-flow-icon" style="background:${f.color}18">${icon}</span>
        <span class="help-flow-title">${esc(f.title)}</span>
      </div>
      <div class="help-flow-steps">${steps}</div>
    </div>`;
}

export function openHelpModal() {
  const rol    = (state.authProfile?.rol || '').toLowerCase() || 'comensal';
  const label  = ROL_LABEL[rol] || 'Usuari';
  const color  = ROL_COLOR[rol] || '#4e9d7a';
  const flows  = rol === 'admin'
    ? [...(FLOWS.admin || []), ...(FLOWS.coordinador || [])]
    : FLOWS[rol] || [];

  document.getElementById('help-modal-body').innerHTML = `
    <div class="help-role-badge" style="background:${color}18;color:${color}">
      ${esc(label)}
    </div>
    ${flows.map(_flowHtml).join('')}`;
  document.getElementById('modal-help').classList.add('open');
}

export function closeHelpModal() {
  document.getElementById('modal-help').classList.remove('open');
}
