import { CASAMENTS_URL, MASIA_COLORS, MASIA_LABELS } from './config.js';
import { t, getLang } from './i18n.js';
import { esc, parseCSV, findCol } from './helpers.js';

const MASIES = ['ca-nalzina', 'can-macia', 'castell-de-tous', 'mas-vivencs'];

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

function _fmtTime(str) {
  const ts = _parseDate(str);
  if (!ts) return str;
  const d = new Date(ts);
  return d.toLocaleString(getLang() === 'es' ? 'es-ES' : 'ca-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

let _casaments     = [];
let _selectedMasia = null;
let _lastUpdated   = null;
let _detallFilter  = 'tots';
let _detallSearch  = '';

function _parseRows(rows) {
  if (rows.length < 2) return [];
  const rawHeaders = rows[0];
  _lastUpdated = rawHeaders[8] ? rawHeaders[8].trim() : null;
  const headers = rawHeaders.map(h => h.toLowerCase().trim());
  const iAdults = findCol(headers, ['adults']);
  const iFinca  = findCol(headers, ['finca']);
  const iData   = findCol(headers, ['hora', 'cerim']);
  const iIntol  = findCol(headers, ['intol', 'al·l', 'al.l', 'observ']);
  const iNom    = findCol(headers, ['nombre', 'nom']);
  if (iFinca < 0 || iNom < 0) return [];

  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => {
      const finca   = (r[iFinca]  || '').trim();
      const dataStr = iData >= 0 ? (r[iData] || '').trim() : '';
      const nomRaw = iNom >= 0 ? (r[iNom] || '').trim() : '';
      const nomNet = nomRaw.replace(/^B\d+\s+[A-Z]{2,3}\s+/i, '').trim();
      return {
        nom:    nomNet || nomRaw,
        adults: iAdults >= 0 ? parseInt(r[iAdults] || '0') || 0 : 0,
        finca,
        masiaId: _masiaKey(finca),
        data:    dataStr,
        sortTs:  _parseDate(dataStr),
        intol:   iIntol >= 0 ? (r[iIntol] || '').trim() : '',
      };
    })
    .filter(c => c.finca || c.nom)
    .sort((a, b) => a.sortTs - b.sortTs);
}

// ── UPDATED BANNER ───────────────────────────────────────────────────────

function _buildUpdatedBanner() {
  if (!_lastUpdated) {
    return `<div class="cas-update-banner cas-update--old">
      <span class="cas-update-icon">⚠</span>
      <span class="cas-update-text">${t("Sense data d'actualització")}</span>
    </div>`;
  }

  // Google Sheets escriu DD/MM/YYYY HH:MM:SS — cal parsejar manualment
  function _parseSheetDate(s) {
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0)).getTime();
    return Date.parse(s);
  }
  const ts   = _parseSheetDate(_lastUpdated);
  if (!ts) return `<div class="cas-update-banner cas-update--ok">
    <span class="cas-update-text">${t('Actualitzat:')} ${esc(_lastUpdated)}</span>
  </div>`;

  const days = Math.floor((Date.now() - ts) / 86400000);
  const fmt  = new Date(ts).toLocaleDateString(getLang() === 'es' ? 'es-ES' : 'ca-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  if (days > 30) {
    return `<div class="cas-update-banner cas-update--old">
      <span class="cas-update-icon">⚠</span>
      <div>
        <span class="cas-update-label">${t('Dades desactualitzades')}</span>
        <span class="cas-update-text">${t('Última actualització fa {days} dies — {date}', { days, date: esc(fmt) })}</span>
      </div>
    </div>`;
  }
  if (days > 7) {
    return `<div class="cas-update-banner cas-update--warn">
      <span class="cas-update-icon">●</span>
      <div>
        <span class="cas-update-label">${t('Actualització fa {days} dies', { days })}</span>
        <span class="cas-update-text">${esc(fmt)}</span>
      </div>
    </div>`;
  }
  return `<div class="cas-update-banner cas-update--ok">
    <span class="cas-update-icon">●</span>
    <div>
      <span class="cas-update-label">${t('Al dia')}</span>
      <span class="cas-update-text">${esc(fmt)}</span>
    </div>
  </div>`;
}

// ── LEVEL 1: masia cards ──────────────────────────────────────────────────

function _renderMasies() {
  const el = document.getElementById('casaments-content');
  if (!el) return;

  const totals = {};
  const counts = {};
  for (const id of MASIES) { totals[id] = 0; counts[id] = 0; }

  for (const c of _casaments) {
    if (c.masiaId && totals[c.masiaId] !== undefined) {
      totals[c.masiaId] += c.adults;
      counts[c.masiaId]++;
    }
  }

  const updatedBanner = _buildUpdatedBanner();
  el.innerHTML = `
    ${updatedBanner}
    <div class="cas-masies-grid">
      ${MASIES.map(id => {
        const color = MASIA_COLORS[id] || '#ccc';
        const label = MASIA_LABELS[id] || id;
        return `
        <button class="cas-masia-card" data-masia="${id}">
          <span class="cas-masia-dot" style="background:${esc(color)}"></span>
          <span class="cas-masia-name">${esc(label)}</span>
          <span class="cas-masia-adults">${t('{n} adults', { n: totals[id] })}</span>
          <span class="cas-masia-count">${t('{n} casament{s}', { n: counts[id], s: counts[id] !== 1 ? 's' : '' })}</span>
        </button>`;
      }).join('')}
    </div>`;

  el.querySelectorAll('[data-masia]').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedMasia = btn.dataset.masia;
      _renderDetall();
    });
  });
}

// ── BUILD LLISTA HTML ─────────────────────────────────────────────────────

function _buildLlista(llista) {
  if (!llista.length) return `<p class="cas-empty">${t('Sense resultats')}</p>`;
  return llista.map(c => {
    const intolHtml = c.intol ? esc(c.intol).replace(/\n/g, '<br>') : '';
    return `
    <div class="cas-item">
      <div class="cas-item-row">
        <span class="cas-item-nom">${esc(c.nom)}</span>
        <span class="cas-item-meta">
          ${c.adults ? `<span class="cas-item-adults">${t('{n} adults', { n: c.adults })}</span>` : ''}
          ${c.data   ? `<span class="cas-item-hora">${esc(_fmtTime(c.data))}</span>` : ''}
        </span>
      </div>
      ${intolHtml ? `
      <details class="cas-intol-details">
        <summary class="cas-intol-summary">${t('Comentaris')}</summary>
        <div class="cas-intol-body">${intolHtml}</div>
      </details>` : `<p class="cas-intol-none">${t('Sense comentaris registrats')}</p>`}
    </div>`;
  }).join('');
}

// ── LEVEL 2: wedding list for one masia ──────────────────────────────────

function _renderDetall() {
  const el = document.getElementById('casaments-content');
  if (!el) return;

  const label   = MASIA_LABELS[_selectedMasia] || _selectedMasia;
  const color   = MASIA_COLORS[_selectedMasia] || '#ccc';
  const all     = _casaments.filter(c => c.masiaId === _selectedMasia);
  const total   = all.reduce((s, c) => s + c.adults, 0);

  let llista = all;
  if (_detallSearch) {
    const q = _detallSearch.toLowerCase();
    llista = llista.filter(c =>
      c.nom.toLowerCase().includes(q) || c.intol.toLowerCase().includes(q)
    );
  }

  el.innerHTML = `
    <div class="cas-detall-header">
      <button class="cas-back-btn" id="cas-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t('Tornar')}
      </button>
      <span class="cas-detall-title">
        <span class="cas-masia-dot" style="background:${esc(color)}"></span>
        ${esc(label)}
      </span>
      <span class="cas-detall-total">${t('{n} adults', { n: total })}</span>
    </div>
    <div class="cas-detall-toolbar">
      <input class="casaments-search-input" id="cas-search" placeholder="${t('Cercar nom, al·lèrgia…')}"
             value="${esc(_detallSearch)}" autocomplete="off">
    </div>
    <div class="cas-detall-list" id="cas-detall-list">
      ${_buildLlista(llista)}
    </div>`;

  document.getElementById('cas-back').addEventListener('click', () => {
    _selectedMasia = null;
    _detallFilter  = 'tots';
    _detallSearch  = '';
    _renderMasies();
  });
  document.getElementById('cas-search').addEventListener('input', e => {
    _detallSearch = e.target.value;
    let filtered = all;
    if (_detallSearch) {
      const q = _detallSearch.toLowerCase();
      filtered = filtered.filter(c =>
        c.nom.toLowerCase().includes(q) || c.intol.toLowerCase().includes(q)
      );
    }
    document.getElementById('cas-detall-list').innerHTML = _buildLlista(filtered);
  });
}

// ── DATA ACCESS (per estadistiques.js) ───────────────────────────────────

export function getCasamentsData() { return _casaments; }

export async function ensureCasamentsLoaded() {
  if (_casaments.length) return;
  try {
    const res  = await fetch(`${CASAMENTS_URL}&t=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    _casaments = _parseRows(parseCSV(text));
  } catch { }
}

// ── ENTRY POINT ──────────────────────────────────────────────────────────

export async function renderCasamentsView() {
  const el = document.getElementById('casaments-content');
  if (!el) return;

  if (_casaments.length) {
    _selectedMasia ? _renderDetall() : _renderMasies();
    return;
  }

  el.innerHTML = `<div class="reports-loading">${t('Carregant casaments…')}</div>`;

  try {
    const res  = await fetch(`${CASAMENTS_URL}&t=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    _casaments = _parseRows(parseCSV(text));
  } catch {
    el.innerHTML = `<div class="reports-loading" style="color:var(--text-dim)">${t('Error carregant casaments. Comprova la connexió.')}</div>`;
    return;
  }

  _selectedMasia = null;
  _renderMasies();
}
