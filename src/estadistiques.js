import { state, MASIA_LABELS, MASIA_COLORS, STATUS_LABELS } from './config.js';
import { t } from './i18n.js';
import { esc } from './helpers.js';
import { getCasamentsData, ensureCasamentsLoaded } from './casaments.js';

const R    = 70;
const CX   = 100;
const CY   = 100;
const CIRC = 2 * Math.PI * R;

function _donutSvg(data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return `<svg viewBox="0 0 200 200" class="donut-svg" aria-hidden="true">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="28"/>
      <text x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="middle" class="donut-center-val">—</text>
    </svg>`;
  }

  let cumLen = 0;
  const circles = data
    .filter(d => d.value > 0)
    .map(d => {
      const len    = (d.value / total) * CIRC;
      const offset = -cumLen;
      cumLen += len;
      const pct = Math.round((d.value / total) * 100);
      const tip = esc(`${d.label}: ${d.value} (${pct}%)`);
      return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${esc(d.color)}" stroke-width="28"
        stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        pointer-events="visibleStroke" data-tip="${tip}">
        <title>${tip}</title>
      </circle>`;
    }).join('');

  return `<svg viewBox="0 0 200 200" class="donut-svg" aria-hidden="true">
    <g transform="rotate(-90 ${CX} ${CY})">${circles}</g>
    <text x="${CX}" y="${CY - 8}" text-anchor="middle" dominant-baseline="middle" class="donut-center-val">${total}</text>
    <text x="${CX}" y="${CY + 14}" text-anchor="middle" dominant-baseline="middle" class="donut-center-lbl">${t('total')}</text>
  </svg>`;
}

let _tip = null;

function _initTooltips(container) {
  if (!_tip) {
    _tip = document.createElement('div');
    _tip.className = 'est-tooltip';
    _tip.hidden = true;
    document.body.appendChild(_tip);
  }
  container.querySelectorAll('.est-legend-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ul = btn.closest('ul');
      ul.querySelector('.est-legend-more').hidden = false;
      btn.closest('.est-legend-expand-li').hidden = true;
    });
  });

  container.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      _tip.textContent = el.dataset.tip;
      _tip.hidden = false;
    });
    el.addEventListener('mousemove', e => {
      _tip.style.left = (e.clientX + 14) + 'px';
      _tip.style.top  = (e.clientY - 36) + 'px';
    });
    el.addEventListener('mouseleave', () => { _tip.hidden = true; });
  });
}

function _legendItem(d, total) {
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return `<li class="est-legend-item">
    <span class="est-legend-dot" style="background:${esc(d.color)}"></span>
    <span class="est-legend-label">${esc(d.label)}</span>
    <span class="est-legend-meta"><strong>${d.value}</strong> · ${pct}%</span>
  </li>`;
}

function _legend(data, maxItems = Infinity) {
  const total   = data.reduce((s, d) => s + d.value, 0);
  const visible = data.filter(d => d.value > 0);
  if (!visible.length) return `<p class="est-empty">${t('Sense dades')}</p>`;

  const shown  = visible.slice(0, maxItems);
  const rest   = visible.slice(maxItems);

  const moreHtml = rest.length > 0 ? `
    <li class="est-legend-more" hidden>${rest.map(d => _legendItem(d, total)).join('')}</li>
    <li class="est-legend-expand-li">
      <button class="est-legend-expand-btn" type="button">${t('Veure tots ({n} més)', { n: rest.length })}</button>
    </li>` : '';

  return `<ul class="est-legend">
    ${shown.map(d => _legendItem(d, total)).join('')}
    ${moreHtml}
  </ul>`;
}

function _card(title, svgHtml, legendHtml) {
  return `<div class="est-card">
    <h3 class="est-card-title">${title}</h3>
    <div class="est-card-body">
      <div class="est-donut-wrap">${svgHtml}</div>
      ${legendHtml}
    </div>
  </div>`;
}

const CAT_PALETTE = [
  '#B0B8C8','#CEB08C','#A8C4A0','#C8A8B8',
  '#C0C080','#A0B8C8','#C8A090','#90B8A8',
];

function _chartCategories() {
  const byCategory = new Map();
  for (const p of state.catalog) {
    const cat = p.category || t('Sense categoria');
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
  }
  const data = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: CAT_PALETTE[i % CAT_PALETTE.length] }));
  return _card(t('Productes per categoria'), _donutSvg(data), _legend(data, 4));
}

const STATUS_COLORS = {
  pendent:       '#f59e0b',
  en_curs:       '#3b82f6',
  rebuda:        '#22c55e',
  'cancel·lada': '#6b7280',
};

function _chartOrders() {
  const counts = { pendent: 0, en_curs: 0, rebuda: 0, 'cancel·lada': 0 };
  for (const o of state.orders) {
    if (o.status in counts) counts[o.status]++;
  }
  const data = Object.entries(counts).map(([k, v]) => ({
    label: t(STATUS_LABELS[k]) || k, value: v, color: STATUS_COLORS[k],
  }));
  return _card(t('Estat de les comandes'), _donutSvg(data), _legend(data));
}

function _chartAdults() {
  const casaments = getCasamentsData();
  const counts = {};
  for (const id of Object.keys(MASIA_LABELS)) counts[id] = 0;
  for (const c of casaments) {
    if (c.masiaId && c.masiaId in counts) counts[c.masiaId] += c.adults;
  }
  const data = Object.entries(MASIA_LABELS).map(([id, label]) => ({
    label, value: counts[id] || 0, color: MASIA_COLORS[id] || '#ccc',
  }));
  return _card(t('Adults per masia'), _donutSvg(data), _legend(data));
}

export async function renderEstadistiques() {
  const el = document.getElementById('estadistiques-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">${t('Carregant…')}</div>`;
  await ensureCasamentsLoaded();
  el.innerHTML = `<div class="est-grid">
    ${_chartOrders()}
    ${_chartAdults()}
  </div>`;
  _initTooltips(el);
}
