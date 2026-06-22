import { state, SHEET_APPEND_URL, INVENTARI_URL, MASIA_LABELS, MASIA_COLORS, saveItems } from './config.js';
import { esc, fmtNum, toast, parseCSV, findCol, sendToSheet } from './helpers.js';
import { setView } from './main.js';

// ── HISTORIAL DELETE (document-level, attached once) ─────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-delete-historial]');
  if (!btn) return;
  const id = btn.dataset.deleteHistorial;
  if (!confirm('Eliminar aquesta entrada permanentment?\nAquesta acció no es pot desfer.')) return;
  const params = new URLSearchParams({ action: 'delete-historial', id });
  sendToSheet(SHEET_APPEND_URL, params.toString());
  _historialRows = _historialRows.filter(r => r[0] !== id);
  _renderHistorialCards();
  toast('Entrada eliminada');
});

// ── STATS STRIP ──────────────────────────────────────────────────────

export function renderStatsStrip() {
  const strip     = document.getElementById('stats-strip');
  const total     = state.items.length;
  const lowCount  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock && i.quantity > 0).length;
  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const totalVal  = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);

  const card3 = (lowCount + zeroCount) > 0
    ? `<div class="stat-card is-warn">
         <span class="stat-value">${lowCount + zeroCount}</span>
         <span class="stat-label">Estoc baix</span>
       </div>`
    : `<div class="stat-card">
         <span class="stat-value">${totalVal > 0 ? '€' + Math.round(totalVal) : '—'}</span>
         <span class="stat-label">Valor est.</span>
       </div>`;

  strip.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Articles</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${state.categories.length}</span>
      <span class="stat-label">Categories</span>
    </div>
    ${card3}
  `;
}

// ── STATS VIEW ───────────────────────────────────────────────────────

export function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  if (document.body.dataset.role === 'comensal') {
    if (state.items.length === 0) {
      el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.4"><span class="stats-cat-name" style="flex:none;font-size:13px">Encara no s'ha comptat cap producte</span></div>`;
      return;
    }
    const groups = new Map();
    state.items.forEach(item => {
      const cat     = state.categories.find(c => c.id === item.category);
      const catName = cat ? cat.name : 'Sense categoria';
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName).push(item);
    });
    let html = `<div class="stats-total-row"><span class="stats-total-label">Total comptat</span><span class="stats-total-val">${state.items.length} productes</span></div>`;
    groups.forEach((items, catName) => {
      html += `<div class="stats-section-title">${esc(catName)}</div>`;
      items.forEach(item => {
        html += `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">${fmtNum(item.quantity)} ${esc(item.unit || 'u')}</span>
        </div>`;
      });
    });
    html += `<textarea class="inv-comment-input" id="inv-comment" placeholder="Comentari opcional…" rows="3"></textarea>`;
    html += `<button class="btn-send-report" data-action="send-report">Enviar inventari al coordinador</button>`;
    el.innerHTML = html;
    return;
  }

  const totalVal  = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);
  const lowItems  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
  const zeroItems = state.items.filter(i => i.quantity === 0);

  el.innerHTML = `
    ${totalVal > 0 ? `
      <div class="stats-total-row">
        <span class="stats-total-label">Valor total estoc</span>
        <span class="stats-total-val">€${totalVal.toLocaleString('ca', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
      </div>
    ` : ''}

    <div class="stats-section-title">Per categoria</div>

    ${state.categories.map(cat => {
      const catItems = state.items.filter(i => i.category === cat.id);
      return `
        <div class="stats-cat-row">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="stats-cat-name">${esc(cat.name)}</span>
          <div class="stats-cat-meta">
            <span class="stats-cat-count">${catItems.length} art.</span>
          </div>
        </div>
      `;
    }).join('')}

    ${lowItems.length > 0 ? `
      <div class="stats-section-title" style="color:var(--low)">Estoc baix</div>
      ${lowItems.map(item => `
        <div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count" style="color:var(--low)">
            ${fmtNum(item.quantity)} / mín ${fmtNum(item.minStock)} ${esc(item.unit || '')}
          </span>
        </div>
      `).join('')}
    ` : ''}

    ${zeroItems.length > 0 ? `
      <div class="stats-section-title" style="color:rgba(255,255,255,0.28)">Sense estoc</div>
      ${zeroItems.map(item => `
        <div class="stats-cat-row" style="opacity:.45">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">0 ${esc(item.unit || '')}</span>
        </div>
      `).join('')}
    ` : ''}

    ${lowItems.length === 0 && zeroItems.length === 0 && state.items.length > 0 ? `
      <div class="stats-cat-row" style="justify-content:center;opacity:.4">
        <span class="stats-cat-name" style="flex:none;font-size:13px">Tot l'estoc està en ordre ✓</span>
      </div>
    ` : ''}
  `;
}

// ── INVENTORY REPORT ─────────────────────────────────────────────────

export function sendInventoryReport() {
  if (!state.items.length) return;

  const now     = new Date();
  const pad     = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const commentEl  = document.getElementById('inv-comment');
  const comment    = commentEl ? commentEl.value.trim() : '';
  const inventariStr = state.items.map(i => `${i.name}: ${fmtNum(i.quantity)} ${i.unit || 'u'}`).join(' | ');

  const params = new URLSearchParams({
    action:    'inventari',
    id:        String(now.getTime()),
    data:      dateStr,
    hora:      timeStr,
    comensal:  state.authProfile?.nom || state.user || '',
    masia:     state.masia || '',
    inventari: inventariStr,
    comentari: comment,
  });
  sendToSheet(SHEET_APPEND_URL, params.toString());

  state.items = [];
  saveItems();
  renderStats();
  toast('Inventari enviat al coordinador');
  setView('catalog');
  renderStatsStrip();
}

// ── REPORTS / HISTORIAL VIEW (tots els rols) ─────────────────────────

let _historialRows   = [];
let _historialFilter = new Set(['tot']);
let _historialSearch = '';

const _deleteIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;

function _deleteBtn(id) {
  return `<button class="cat-delete-btn" data-delete-historial="${esc(id)}" title="Eliminar permanentment" style="margin-left:6px;flex-shrink:0">${_deleteIcon}</button>`;
}

function _cardHtml(r, role) {
  const [id, date, hora, comensal, masiaVal, inventari, comentari] = r;
  const masiaLabel = masiaVal ? (MASIA_LABELS[masiaVal] || masiaVal) : '';
  const authorLine = [comensal, role !== 'comensal' ? masiaLabel : ''].filter(Boolean).join(' · ');
  const masiaColor = role !== 'comensal' ? (MASIA_COLORS[masiaVal] || '') : '';
  const authorHtml = authorLine
    ? `<span class="report-count-badge" style="font-size:10px;color:var(--text-dim)">${esc(authorLine)}</span>`
    : '';
  const delBtn = role === 'admin' ? _deleteBtn(id) : '';

  const isProducte = (inventari || '').startsWith('[PRODUCTE]: ');

  if (isProducte) {
    const nomProducte = inventari.slice('[PRODUCTE]: '.length);
    const accentColor = masiaColor || 'rgba(242,239,238,0.55)';
    return `
      <div class="report-card" style="border:1px solid ${accentColor}33;border-left:4px solid ${accentColor};background:rgba(242,239,238,0.05);">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 16px 0">
          <span style="font-size:9px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:${accentColor};opacity:0.85">+ Producte nou</span>
          <span style="flex:1;height:1px;background:${accentColor};opacity:0.18"></span>
          <span style="font-size:9px;color:var(--text-dimmer)">${esc(date)} · ${esc(hora)}</span>
          ${delBtn}
        </div>
        <div style="padding:10px 16px 4px">
          <span style="font-family:var(--font-serif);font-size:20px;letter-spacing:-0.02em;color:var(--white)">${esc(nomProducte)}</span>
        </div>
        ${comentari ? `<div style="padding:0 16px 10px;font-size:12px;color:var(--text-dim)">${esc(comentari)}</div>` : ''}
        ${authorHtml ? `<div style="padding:0 16px 12px">${authorHtml}</div>` : '<div style="padding-bottom:4px"></div>'}
      </div>`;
  }

  const cardStyle = masiaColor ? `border-left:3px solid ${masiaColor};` : '';
  const items     = (inventari || '').split(' | ').filter(Boolean);
  const itemsHtml = items.map(item => {
    const sep  = item.indexOf(': ');
    const name = sep > -1 ? item.slice(0, sep) : item;
    const qty  = sep > -1 ? item.slice(sep + 2) : '';
    return `<div class="stats-cat-row">
      <span class="stats-cat-name">${esc(name)}</span>
      <span class="stats-cat-count">${esc(qty)}</span>
    </div>`;
  }).join('');
  const comentariHtml = comentari ? `<div class="report-comment">${esc(comentari)}</div>` : '';
  return `
    <div class="report-card" style="${cardStyle}">
      <div class="report-card-header">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="report-date-time">${esc(date)} · ${esc(hora)}</span>
          ${authorHtml}
        </div>
        <div style="display:flex;align-items:center">
          <span class="report-count-badge">${items.length} productes</span>
          ${delBtn}
        </div>
      </div>
      ${comentariHtml}
      <div class="report-items-list">${itemsHtml}</div>
    </div>`;
}

function _renderHistorialCards() {
  const cardsEl = document.getElementById('reports-cards');
  if (!cardsEl) return;
  const role = document.body.dataset.role || 'comensal';

  let data = _historialRows;

  if (!_historialFilter.has('tot')) {
    const hasInv   = _historialFilter.has('inventari');
    const hasProd  = _historialFilter.has('producte');
    const masiaIds = [..._historialFilter].filter(f => f !== 'inventari' && f !== 'producte');

    if (hasInv && !hasProd)  data = data.filter(r => !(r[5] || '').startsWith('[PRODUCTE]: '));
    if (hasProd && !hasInv)  data = data.filter(r =>  (r[5] || '').startsWith('[PRODUCTE]: '));
    if (masiaIds.length)     data = data.filter(r => masiaIds.includes(r[4]));
  }

  if (_historialSearch) {
    const q = _historialSearch.toLowerCase();
    data = data.filter(r =>
      (r[3] || '').toLowerCase().includes(q) ||
      (r[5] || '').toLowerCase().includes(q) ||
      (r[6] || '').toLowerCase().includes(q)
    );
  }

  if (!data.length) {
    cardsEl.innerHTML = `<div class="reports-loading" style="padding:40px 16px 20px">Sense resultats.</div>`;
    return;
  }
  cardsEl.innerHTML = data.map(r => _cardHtml(r, role)).join('');
}

export async function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">Carregant historial…</div>`;

  const role = document.body.dataset.role || 'comensal';
  _historialFilter = new Set(['tot']);
  _historialSearch = '';

  try {
    const res     = await fetch(INVENTARI_URL);
    const text    = await res.text();
    const rows    = parseCSV(text);
    const headers = (rows[0] || []).map(h => h.toLowerCase().trim());

    const isCorrectSheet = headers.some(h => h === 'inventari' || h === 'data' || h === 'hora');
    if (!isCorrectSheet) {
      el.innerHTML = `<div class="stats-cat-row" style="flex-direction:column;gap:6px;padding:20px 16px">
        <span class="stats-cat-name" style="flex:none;font-size:13px;color:var(--low)">Error: s'està llegint el full incorrecte.</span>
        <span class="stats-cat-count">Capçaleres trobades: ${esc((rows[0] || []).join(', '))}</span>
      </div>`;
      return;
    }

    const masiaIdx = findCol(headers, 'masia');
    let data = rows.slice(1).filter(r => r.length > 1 && r[0]);

    if (role === 'comensal' && state.masia && masiaIdx >= 0) {
      data = data.filter(r => r[masiaIdx] === state.masia);
    }

    _historialRows = [...data].reverse();

    if (!_historialRows.length) {
      el.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
            <rect x="10" y="8" width="44" height="50" rx="4"/>
            <path d="M10 22h44"/><path d="M20 36h24M20 44h16"/>
          </svg>
          <p class="empty-title">Sense historial</p>
          <p class="empty-text">${role === 'comensal'
            ? 'Els teus inventaris enviats i productes creats apareixeran aquí.'
            : 'Els comensals enviaran informes quan acabin l\'inventari.'}</p>
        </div>`;
      return;
    }

    const masiaPills = role !== 'comensal'
      ? Object.entries(MASIA_LABELS).map(([id, label]) => {
          const color = MASIA_COLORS[id] || '';
          const dot   = color
            ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;flex-shrink:0"></span>`
            : '';
          return `<button class="filter-pill" data-hfilter="${esc(id)}">${dot}${esc(label)}</button>`;
        }).join('')
      : '';

    el.innerHTML = `
      <div style="padding:14px 16px 0">
        <input class="search-input" id="historial-search" placeholder="Cerca producte, usuari…" autocomplete="off" style="height:40px">
      </div>
      <div class="filter-pills" id="historial-filters" style="padding-top:10px">
        <button class="filter-pill active" data-hfilter="tot">Tot</button>
        <button class="filter-pill" data-hfilter="inventari">Inventaris</button>
        <button class="filter-pill" data-hfilter="producte">Productes nous</button>
        ${masiaPills}
      </div>
      <div class="reports-list" id="reports-cards"></div>`;

    _renderHistorialCards();

    document.getElementById('historial-search').addEventListener('input', e => {
      _historialSearch = e.target.value.trim();
      _renderHistorialCards();
    });

    document.getElementById('historial-filters').addEventListener('click', e => {
      const pill = e.target.closest('[data-hfilter]');
      if (!pill) return;
      const val = pill.dataset.hfilter;

      if (val === 'tot') {
        _historialFilter = new Set(['tot']);
      } else {
        _historialFilter.delete('tot');
        if (_historialFilter.has(val)) {
          _historialFilter.delete(val);
        } else {
          _historialFilter.add(val);
        }
        if (_historialFilter.size === 0) _historialFilter.add('tot');
      }

      document.querySelectorAll('#historial-filters .filter-pill').forEach(p =>
        p.classList.toggle('active', _historialFilter.has(p.dataset.hfilter))
      );
      _renderHistorialCards();
    });

  } catch {
    el.innerHTML = `<div class="reports-loading" style="color:var(--text-dim)">Error carregant historial. Comprova la connexió.</div>`;
  }
}
