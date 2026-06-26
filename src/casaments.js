import { CASAMENTS_URL, MASIA_COLORS, MASIA_LABELS } from './config.js';
import { esc, parseCSV, findCol } from './helpers.js';

function _masiaKey(finca) {
  const f = finca.toLowerCase();
  if (f.includes('alzina') || f.includes('nalzina')) return 'ca-nalzina';
  if (f.includes('maci'))                             return 'can-macia';
  if (f.includes('tous'))                             return 'castell-de-tous';
  if (f.includes('vivenc'))                           return 'mas-vivencs';
  return null;
}

function _parseDate(str) {
  if (!str) return 0;
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    let [, d, mo, y, h, min, ap] = m;
    h = parseInt(h);
    if (ap && ap.toLowerCase() === 'pm' && h < 12) h += 12;
    if (ap && ap.toLowerCase() === 'am' && h === 12) h = 0;
    return new Date(+y, +mo - 1, +d, h, +min).getTime();
  }
  return 0;
}

function _fmtDate(str) {
  const ts = _parseDate(str);
  if (!ts) return str;
  return new Date(ts).toLocaleDateString('ca-ES', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

let _casaments = [];
let _filter    = 'totes';
let _search    = '';

function _parseRows(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const iAdults = findCol(headers, ['adults']);
  const iFinca  = findCol(headers, ['finca']);
  const iData   = findCol(headers, ['hora', 'cerim']);
  const iIntol  = findCol(headers, ['intol', 'al·l', 'observ']);
  const iNom    = findCol(headers, ['nombre', 'nom']);
  if (iFinca < 0 || iNom < 0) return [];

  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => {
      const finca   = (r[iFinca]  || '').trim();
      const dataStr = iData >= 0 ? (r[iData] || '').trim() : '';
      return {
        nom:     iNom    >= 0 ? (r[iNom]    || '').trim() : '',
        adults:  iAdults >= 0 ? (r[iAdults] || '').trim() : '',
        finca,
        masiaId: _masiaKey(finca),
        data:    dataStr,
        sortTs:  _parseDate(dataStr),
        intol:   iIntol  >= 0 ? (r[iIntol]  || '').trim() : '',
      };
    })
    .filter(c => c.finca || c.nom)
    .sort((a, b) => a.sortTs - b.sortTs);
}

function _renderCards() {
  const list = document.getElementById('casaments-list');
  if (!list) return;
  const now = Date.now();
  let data  = _casaments;

  if (_filter !== 'totes') data = data.filter(c => c.masiaId === _filter);
  if (_search) {
    const q = _search.toLowerCase();
    data = data.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      c.intol.toLowerCase().includes(q) ||
      c.finca.toLowerCase().includes(q)
    );
  }

  if (!data.length) {
    list.innerHTML = `<div class="casaments-empty">Sense casaments</div>`;
    return;
  }

  list.innerHTML = data.map(c => {
    const past  = c.sortTs && c.sortTs < now;
    const color = c.masiaId ? (MASIA_COLORS[c.masiaId] || '#ccc') : '#ccc';
    const label = c.masiaId ? (MASIA_LABELS[c.masiaId] || c.finca) : c.finca;
    return `<div class="casament-card${past ? ' is-past' : ''}">
      <div class="casament-card-header">
        <span class="casament-nom">${esc(c.nom)}</span>
        <span class="casament-finca">
          <span class="masia-dot" style="background:${esc(color)}"></span>${esc(label)}
        </span>
      </div>
      <div class="casament-card-meta">
        ${c.data   ? `<span class="casament-date">${esc(_fmtDate(c.data))}</span>` : ''}
        ${c.adults ? `<span class="casament-adults">${esc(c.adults)} adults</span>` : ''}
      </div>
      ${c.intol ? `<div class="casament-intol">${esc(c.intol)}</div>` : ''}
    </div>`;
  }).join('');
}

export async function renderCasamentsView() {
  const el = document.getElementById('casaments-content');
  if (!el) return;

  el.innerHTML = `<div class="reports-loading">Carregant casaments…</div>`;

  try {
    const res  = await fetch(CASAMENTS_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    _casaments = _parseRows(rows);
  } catch {
    el.innerHTML = `<div class="reports-loading" style="color:var(--text-dim)">Error carregant casaments. Comprova la connexió.</div>`;
    return;
  }

  _filter = 'totes';
  _search = '';

  const masiesPresents = [...new Set(_casaments.map(c => c.masiaId).filter(Boolean))];

  el.innerHTML = `
    <div class="casaments-toolbar">
      <div class="casaments-filters" id="casaments-filters">
        <button class="filter-pill active" data-casaments-filter="totes">Totes</button>
        ${masiesPresents.map(id =>
          `<button class="filter-pill" data-casaments-filter="${esc(id)}">${esc(MASIA_LABELS[id] || id)}</button>`
        ).join('')}
      </div>
      <input id="casaments-search" class="casaments-search-input" type="search"
             placeholder="Cercar per nom, intol·lerància…" autocomplete="off">
    </div>
    <div class="casaments-list" id="casaments-list"></div>`;

  _renderCards();

  document.getElementById('casaments-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-casaments-filter]');
    if (!btn) return;
    _filter = btn.dataset.casamentsFilter;
    document.querySelectorAll('[data-casaments-filter]').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    _renderCards();
  });

  document.getElementById('casaments-search').addEventListener('input', e => {
    _search = e.target.value.trim();
    _renderCards();
  });
}
