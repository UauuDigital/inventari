import { state } from './config.js';
import { t } from './i18n.js';
import { esc } from './helpers.js';

const ICONS = {
  uncheck:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  check:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  order:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
  status:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  product:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
  users:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  calc:       `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="16" y1="15" x2="16" y2="18"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>`,
  scan:       `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="12" x2="17" y2="12.01"/></svg>`,
  import:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9.5 15.5L12 18l2.5-2.5"/></svg>`,
};

const GENERAL_FLOWS = [
  {
    icon: 'calc',
    title: 'Als camps de quantitat pots escriure una operació',
    color: '#4e9d7a',
    steps: [
      'No cal calcular al cap: en un camp de caixes o unitats pots escriure directament "1+2", "6*4+3", etc.',
      'En sortir del camp (tocant fora), l\'app la resol sola i deixa el resultat ja calculat',
    ],
  },
  {
    icon: 'scan',
    title: 'El codi de barres omple el producte sol',
    color: '#5b8fc9',
    steps: [
      'Amb el botó <strong>Escaneja codi de barres</strong> del Catàleg, si el codi ja correspon a un producte de la llista, l\'obre directament sense haver-lo de buscar',
      'Si el codi no existeix encara, l\'app el cerca en una base de dades de productes oberta a internet i n\'omple el nom i el proveïdor automàticament, per no haver-los d\'escriure a mà',
    ],
  },
];

const FLOWS = {
  comensal: [
    {
      icon: 'uncheck',
      title: 'Es pot desmarcar un producte des del Resum',
      color: '#c87d4a',
      steps: [
        'A <strong>Resum</strong> cada producte marcat té una <strong>×</strong> al costat',
        'Prement-la es treu de l\'inventari a l\'instant, sense haver de tornar-lo a buscar al Catàleg',
      ],
    },
    {
      icon: 'check',
      title: 'La icona verda "Rebut" a Informes',
      color: '#5b8fc9',
      steps: [
        'Apareix quan el coordinador ja ha obert i vist l\'inventari que has enviat — no vol dir només que l\'has enviat, sinó que ja l\'han llegit a l\'altra banda',
      ],
    },
    {
      icon: 'uncheck',
      title: 'Cada masia té el seu propi inventari',
      color: '#7b5ea7',
      steps: [
        'El que es marca (caixes i unitats) queda guardat només per a la masia triada en entrar',
        'Per fer l\'inventari d\'una altra masia cal tornar a la pantalla de selecció, tocant el nom de la masia a dalt, i triar-ne una altra',
      ],
    },
  ],
  coordinador: [
    {
      icon: 'order',
      title: 'Una comanda es pot generar sola des d\'un inventari',
      color: '#4e9d7a',
      steps: [
        'A <strong>Informes</strong>, un inventari rebut té el botó <strong>Generar comanda</strong>, que en crea una automàticament',
        'Les quantitats que proposa no són el total marcat, sinó només el que falta per arribar a l\'estoc mínim configurat de cada producte',
        'Aquestes quantitats es poden retocar abans d\'acceptar la comanda',
      ],
    },
    {
      icon: 'status',
      title: 'L\'estat de la comanda s\'avança clicant la pastilla',
      color: '#c87d4a',
      steps: [
        'La pastilla de color (Pendent, En curs, Rebuda) és un botó: cada clic avança un pas',
        'En arribar a Rebuda, tornar a clicar-la la torna a Pendent — no hi ha manera d\'editar l\'estat d\'una altra manera',
      ],
    },
    {
      icon: 'check',
      title: 'A Informes i Comandes hi surten totes les masies juntes',
      color: '#7b5ea7',
      steps: [
        'Cada entrada porta el nom de la masia corresponent i un color propi per distingir-la sense haver de filtrar',
      ],
    },
  ],
  admin: [
    {
      icon: 'product',
      title: 'Al Catàleg, tocar un producte l\'edita (no marca quantitat)',
      color: '#4e9d7a',
      steps: [
        'Per a Admin i Coordinador, clicar una targeta del Catàleg obre directament el formulari d\'edició del producte (nom, categoria, unitat, estoc mínim...)',
        'Marcar caixes i unitats només ho fa l\'Encarregat: si vols provar com queda un inventari, ho hauràs de fer amb un compte d\'Encarregat',
      ],
    },
    {
      icon: 'users',
      title: 'Per eliminar un usuari cal obrir-lo primer',
      color: '#7b5ea7',
      steps: [
        'A la pestanya Usuaris no hi ha cap icona ràpida d\'eliminar al costat de cada nom',
        'Cal clicar l\'usuari per obrir la seva fitxa i, des d\'allà, prémer <strong>Eliminar</strong>',
      ],
    },
    {
      icon: 'import',
      title: 'Importar un Excel actualitza en comptes de duplicar',
      color: '#c87d4a',
      steps: [
        'Els productes de l\'Excel es reconeixen pel nom: si ja existeixen al catàleg, se n\'actualitzen les dades en lloc de crear-ne un de nou',
        'Abans d\'aplicar-ho, es mostra una previsualització amb quants productes són nous i quants s\'actualitzaran',
      ],
    },
  ],
};

const ROL_LABEL = { comensal: 'Encarregat', coordinador: 'Coordinador', admin: 'Admin' };
const ROL_COLOR = { comensal: '#4e9d7a',   coordinador: '#5b8fc9',      admin: '#c87d4a' };

function _flowHtml(f) {
  const icon = ICONS[f.icon] || '';
  const single = f.steps.length === 1;
  const steps = f.steps.map((s, i) => `
    <div class="help-step">
      ${single ? '' : `<span class="help-step-num" style="background:${f.color}22;color:${f.color}">${i + 1}</span>`}
      <span class="help-step-text">${t(s)}</span>
    </div>`).join('');
  return `
    <div class="help-flow">
      <div class="help-flow-head" style="color:${f.color}">
        <span class="help-flow-icon" style="background:${f.color}18">${icon}</span>
        <span class="help-flow-title">${esc(t(f.title))}</span>
      </div>
      <div class="help-flow-steps">${steps}</div>
    </div>`;
}

export function openHelpModal() {
  const rol    = (state.authProfile?.rol || '').toLowerCase() || 'comensal';
  const label  = t(ROL_LABEL[rol]) || t('Usuari');
  const color  = ROL_COLOR[rol] || '#4e9d7a';
  const roleFlows = rol === 'admin'
    ? [...(FLOWS.admin || []), ...(FLOWS.coordinador || [])]
    : FLOWS[rol] || [];
  const flows = [...GENERAL_FLOWS, ...roleFlows];

  document.getElementById('help-modal-body').innerHTML = `
    <div class="help-intro">
      <div class="help-role-badge" style="background:${color}18;color:${color}">
        ${esc(label)}
      </div>
      <p class="help-intro-text">${esc(t('Detalls que no són evidents a primer cop d\'ull.'))}</p>
    </div>
    ${flows.map(_flowHtml).join('')}`;
  document.getElementById('modal-help').classList.add('open');
}

export function closeHelpModal() {
  document.getElementById('modal-help').classList.remove('open');
}
