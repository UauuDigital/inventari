import { state, SHEET_APPEND_URL, INVENTARI_URL, MASIA_LABELS, MASIA_COLORS, STORAGE_PENDING_INV, saveItems, saveOrders } from './config.js';
import { esc, fmtNum, fmtQtyDisplay, parseTotalQty, uid, toast, parseCSV, findCol, sendToSheet } from './helpers.js';
import { loadCatalog } from './catalog.js';

// ── PENDING (OFFLINE) INVENTORY REPORTS ───────────────────────────────
const _pendingKey = () => state.masia ? `${STORAGE_PENDING_INV}_${state.masia}` : STORAGE_PENDING_INV;

function _loadPendingInv() {
  try { return JSON.parse(localStorage.getItem(_pendingKey())) || []; }
  catch { return []; }
}

function _savePendingInv(list) {
  localStorage.setItem(_pendingKey(), JSON.stringify(list));
}

export function drainPendingInventari() {
  if (!navigator.onLine) return;
  const pending = _loadPendingInv();
  if (!pending.length) return;
  pending.forEach(entry => sendToSheet(SHEET_APPEND_URL, entry.params));
  _savePendingInv([]);
  _historialRows = _historialRows.filter(r => !r[7]);
  _renderHistorialCards();
}

function _resendPendingHistorial(id) {
  const pending = _loadPendingInv();
  const idx = pending.findIndex(p => p.id === id);
  if (idx < 0) return;
  if (!navigator.onLine) {
    toast('Encara sense connexió. S\'enviarà automàticament quan tornis a tenir WiFi.');
    return;
  }
  sendToSheet(SHEET_APPEND_URL, pending[idx].params);
  pending.splice(idx, 1);
  _savePendingInv(pending);
  _historialRows = _historialRows.filter(r => r[0] !== id);
  _renderHistorialCards();
  toast('Inventari enviat.');
}

// ── HISTORIAL EDIT STATE ─────────────────────────────────────────────
let _editingHistorialId    = null;
let _editingHistorialItems = [];
let _historialPage         = 0;
const HIST_PAGE_SIZE       = 20;
import { setView } from './main.js';

// ── HISTORIAL DELETE / EDIT (document-level, attached once) ──────────
document.addEventListener('click', e => {
  // Primer clic: mostra confirmació inline a la targeta
  const delBtn = e.target.closest('[data-delete-historial]');
  if (delBtn && !delBtn.dataset.confirming) {
    delBtn.dataset.confirming = '1';
    delBtn.textContent = 'Confirmar?';
    delBtn.style.cssText = 'color:#c83030;font-size:11px;font-weight:600;padding:0 6px;background:rgba(200,48,48,.12);border-radius:6px;border:1px solid rgba(200,48,48,.35)';
    setTimeout(() => {
      if (delBtn.dataset.confirming) {
        delete delBtn.dataset.confirming;
        delBtn.textContent = '';
        delBtn.style.cssText = '';
        delBtn.innerHTML = _deleteIcon;
      }
    }, 3000);
    return;
  }

  // Segon clic: confirmat, elimina
  if (delBtn && delBtn.dataset.confirming) {
    const id  = delBtn.dataset.deleteHistorial;
    const url = `${SHEET_APPEND_URL}?action=delete-historial&id=${encodeURIComponent(id)}`;
    toast(`Eliminant… (id: ${id.slice(-6)})`);
    fetch(url, { mode: 'no-cors' })
      .then(() => toast('Petició enviada al full'))
      .catch(() => toast('Error de xarxa al eliminar'));
    _historialRows = _historialRows.filter(r => r[0] !== id);
    _renderHistorialCards();
    return;
  }

  const editBtn = e.target.closest('[data-edit-historial]');
  if (editBtn) {
    const id  = editBtn.dataset.editHistorial;
    const row = _historialRows.find(r => r[0] === id);
    if (row) openEditHistorialModal(row);
    return;
  }

  const resendBtn = e.target.closest('[data-resend-historial]');
  if (resendBtn) {
    _resendPendingHistorial(resendBtn.dataset.resendHistorial);
    return;
  }

  const removeBtn = e.target.closest('[data-remove-item]');
  if (removeBtn) {
    state.items = state.items.filter(i => i.id !== removeBtn.dataset.removeItem);
    saveItems();
    renderStats();
    renderStatsStrip();
  }
});

// ── STATS QTY INPUTS (document-level, attached once) ─────────────────
let _pendingQtyChange = false;

function _updatePendingBanner() {
  const banner = document.getElementById('pending-changes-banner');
  if (banner) banner.hidden = !_pendingQtyChange;
}

document.addEventListener('change', e => {
  const input = e.target.closest('.stats-qty-input');
  if (!input) return;
  const item = state.items.find(i => i.id === input.dataset.itemId);
  if (!item) return;
  const val = parseFloat(input.value) || 0;
  if (input.dataset.field === 'loose') item.looseUnits = val;
  else item.boxes = val;
  const upb   = item.unitsPerBox || 0;
  const loose = item.looseUnits != null ? item.looseUnits : 0;
  const boxes = item.boxes || 0;
  item.quantity  = upb > 0 ? boxes * upb + loose : loose || boxes;
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderStatsStrip();
  _pendingQtyChange = true;
  _updatePendingBanner();
});

// ── COMANDA COORDINADOR (document-level, attached once) ───────────────
let _coordOrderData = null;

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-gencomanda]');
  if (!btn) return;
  const row = _historialRows.find(r => r[0] === btn.dataset.gencomanda);
  if (row) _openCoordOrderEdit(row);
});

// ── STATS STRIP ──────────────────────────────────────────────────────

export function renderStatsStrip() {
  const strip     = document.getElementById('stats-strip');
  const total     = state.items.length;
  const lowCount  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock && i.quantity > 0).length;
  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const card3 = (lowCount + zeroCount) > 0
    ? `<div class="stat-card is-warn">
         <span class="stat-value">${lowCount + zeroCount}</span>
         <span class="stat-label">Estoc baix</span>
       </div>`
    : '';

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
        const looseVal  = item.looseUnits != null ? item.looseUnits : item.quantity;
        const boxesVal  = item.boxes || '';
        const unitLbl   = item.unit || 'u';
        const boxesHtml = `
            <div class="stats-qty-field">
              <input type="number" min="0" class="stats-qty-input"
                     data-item-id="${esc(item.id)}" data-field="boxes"
                     value="${boxesVal}" placeholder="0">
              <span class="stats-qty-unit">c</span>
            </div>`;
        html += `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <div class="stats-qty-inputs">
            <div class="stats-qty-field">
              <input type="number" min="0" class="stats-qty-input"
                     data-item-id="${esc(item.id)}" data-field="loose"
                     value="${looseVal}" placeholder="0">
              <span class="stats-qty-unit">${esc(unitLbl)}</span>
            </div>
            ${boxesHtml}
            <button class="stats-remove-btn" data-remove-item="${esc(item.id)}" aria-label="Desmarcar ${esc(item.name)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>`;
      });
    });
    html += `<div id="pending-changes-banner" class="pending-changes-banner"${_pendingQtyChange ? '' : ' hidden'}>
      <span>Canvis pendents d'enviar</span>
    </div>`;
    html += `<textarea class="inv-comment-input" id="inv-comment" placeholder="Comentari opcional…" rows="3"></textarea>`;
    html += `<button class="btn-send-report" data-action="send-report">Enviar inventari al coordinador</button>`;
    el.innerHTML = html;
    return;
  }

  const lowItems  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
  const zeroItems = state.items.filter(i => i.quantity === 0);
  const alertN    = lowItems.length + zeroItems.length;

  el.innerHTML = `
    ${alertN > 0 ? `
    <div class="low-stock-alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${alertN} producte${alertN !== 1 ? 's' : ''} per sota del mínim</span>
    </div>` : ''}
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
            ${fmtQtyDisplay(item)} / mín ${fmtNum(item.minStock)}
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
  const inventariStr = state.items.map(i => `${i.name}: ${fmtQtyDisplay(i)}`).join(' | ');
  const comensal     = state.authProfile?.nom || state.user || '';
  const id           = String(now.getTime());

  const params = new URLSearchParams({
    action:    'inventari',
    id,
    data:      dateStr,
    hora:      timeStr,
    comensal,
    masia:     state.masia || '',
    inventari: inventariStr,
    comentari: comment,
  });

  const wasOffline = !navigator.onLine;
  if (wasOffline) {
    const pending = _loadPendingInv();
    pending.push({
      id, date: dateStr, hora: timeStr, comensal,
      masia: state.masia || '', inventari: inventariStr, comentari: comment,
      params: params.toString(),
    });
    _savePendingInv(pending);
  } else {
    sendToSheet(SHEET_APPEND_URL, params.toString());
  }
  _pendingQtyChange = false;

  state.items = [];
  saveItems();
  renderStats();
  toast(wasOffline
    ? 'Sense connexió: l\'inventari s\'ha desat i s\'enviarà quan tinguis WiFi.'
    : 'Inventari enviat. Comprova\'l a l\'historial.');
  setView('reports');
  renderStatsStrip();
}

// ── REPORTS / HISTORIAL VIEW (tots els rols) ─────────────────────────

let _historialRows   = [];
let _historialFilter = new Set(['tot']);
let _historialSearch = '';

const _deleteIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
const _editIcon   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

function _deleteBtn(id) {
  return `<button class="cat-delete-btn" data-delete-historial="${esc(id)}" title="Eliminar permanentment" style="margin-left:6px;flex-shrink:0">${_deleteIcon}</button>`;
}
function _editBtn(id) {
  return `<button class="cat-delete-btn" data-edit-historial="${esc(id)}" title="Editar" style="margin-left:6px;flex-shrink:0;opacity:.7">${_editIcon}</button>`;
}

function _cardHtml(r, role) {
  const [id, date, hora, comensal, masiaVal, inventari, comentari, isPending] = r;
  const masiaLabel = masiaVal ? (MASIA_LABELS[masiaVal] || masiaVal) : '';
  const authorLine = [comensal, role !== 'comensal' ? masiaLabel : ''].filter(Boolean).join(' · ');
  const masiaColor = role !== 'comensal' ? (MASIA_COLORS[masiaVal] || '') : '';
  const authorHtml = authorLine
    ? `<span class="report-count-badge" style="font-size:10px;color:var(--text-dim)">${esc(authorLine)}</span>`
    : '';
  const isProducte    = (inventari || '').startsWith('[PRODUCTE]: ');
  const delBtn        = role === 'admin' && !isPending ? _deleteBtn(id) : '';
  const genComandaBtn = (role === 'coordinador' || role === 'admin') && !isProducte && !isPending
    ? `<button class="btn-gen-comanda" data-gencomanda="${esc(id)}" type="button">Genera comanda</button>`
    : '';
  const canEdit = (role === 'admin' || role === 'coordinador') && !isPending;
  const resendBtn = isPending
    ? `<button class="btn-resend-historial" data-resend-historial="${esc(id)}" type="button">Enviar ara</button>`
    : '';

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

  const editBtn   = canEdit ? _editBtn(id) : '';
  const cardStyle = masiaColor ? `border-left:3px solid ${masiaColor};` : '';
  const items     = (inventari || '').split(' | ').filter(Boolean);
  const itemsHtml = items.map(item => {
    const sep      = item.indexOf(': ');
    const name     = sep > -1 ? item.slice(0, sep) : item;
    const qty      = sep > -1 ? item.slice(sep + 2) : '';
    const catEntry = state.catalog.find(p => p.name.toLowerCase() === name.toLowerCase());
    const minStock = catEntry?.minStock || 0;
    const isLow    = minStock > 0 && parseTotalQty(qty, catEntry?.unitsPerBox || 0) < minStock;
    const lowStyle = isLow ? ` style="color:var(--danger)"` : '';
    return `<div class="stats-cat-row">
      <span class="stats-cat-name"${lowStyle}>${esc(name)}</span>
      <span class="stats-cat-count"${lowStyle}>${esc(qty)}</span>
    </div>`;
  }).join('');
  const comentariHtml = comentari ? `<div class="report-comment">${esc(comentari)}</div>` : '';
  const statusBadge = isPending
    ? `<span class="report-pending-badge">No enviat</span>`
    : (role === 'comensal' ? `<span class="report-received-badge">Rebut</span>` : `<span class="report-count-badge">${items.length} productes</span>`);
  return `
    <div class="report-card${isPending ? ' report-card--pending' : ''}" style="${cardStyle}">
      <div class="report-card-header">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="report-date-time">${esc(date)} · ${esc(hora)}</span>
          ${authorHtml}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${statusBadge}
          ${resendBtn}
          ${editBtn}
          ${genComandaBtn}
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

  const visible  = data.slice(0, (_historialPage + 1) * HIST_PAGE_SIZE);
  const hasMore  = data.length > visible.length;
  cardsEl.innerHTML = visible.map(r => _cardHtml(r, role)).join('') +
    (hasMore
      ? `<button class="load-more-btn" data-load-more>Carregar més (${data.length - visible.length} restants)</button>`
      : '');
}

export async function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">Carregant historial…</div>`;

  const role = document.body.dataset.role || 'comensal';
  _historialFilter = new Set(['tot']);
  _historialSearch = '';
  _historialPage   = 0;

  let sheetRows   = [];
  let fetchFailed = false;

  try {
    const res     = await fetch(INVENTARI_URL);
    const text    = await res.text();
    const rows    = parseCSV(text);

    const sheetEmpty = rows.length === 0 || (rows.length === 1 && rows[0].every(c => !c.trim()));

    if (!sheetEmpty) {
      const headers = (rows[0] || []).map(h => h.toLowerCase().trim());

      const isCorrectSheet = headers.some(h => h === 'inventari' || h === 'data' || h === 'hora');
      if (!isCorrectSheet) {
        el.innerHTML = `<div class="stats-cat-row" style="flex-direction:column;gap:6px;padding:20px 16px">
          <span class="stats-cat-name" style="flex:none;font-size:13px;color:var(--low)">Error: s'està llegint el full incorrecte.</span>
          <span class="stats-cat-count">Capçaleres trobades: ${esc((rows[0] || []).join(', '))}</span>
        </div>`;
        return;
      }

      const masiaIdx = findCol(headers, [['masia']]);
      let data = rows.slice(1).filter(r => r.length > 1 && r[0]);

      if (role === 'comensal' && state.masia && masiaIdx >= 0) {
        data = data.filter(r => r[masiaIdx] === state.masia);
      }

      // Normalitza l'ID (columna 0) de notació científica a enter string
      const normId = v => {
        const n = Number(v);
        return (!isNaN(n) && isFinite(n) && String(n) !== v) ? String(Math.round(n)) : String(v);
      };
      sheetRows = [...data].reverse().map(r => { const c = [...r]; c[0] = normId(c[0]); return c; });
    }
  } catch {
    fetchFailed = true;
  }

  const pendingRows = _loadPendingInv().map(p =>
    [p.id, p.date, p.hora, p.comensal, p.masia, p.inventari, p.comentari, true]);
  _historialRows = [...pendingRows, ...sheetRows];
  await loadCatalog();

  if (!_historialRows.length) {
    if (fetchFailed) {
      el.innerHTML = `<div class="reports-loading" style="color:var(--text-dim)">Error carregant historial. Comprova la connexió.</div>`;
    } else {
      el.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
            <rect x="10" y="8" width="44" height="50" rx="4"/>
            <path d="M10 22h44"/><path d="M20 36h24M20 44h16"/>
          </svg>
          <p class="empty-title">Sense historial</p>
          <p class="empty-text">${role === 'comensal'
            ? 'Els teus inventaris enviats i productes creats apareixeran aquí.'
            : 'Els encarregats enviaran informes quan acabin l\'inventari.'}</p>
        </div>`;
    }
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
    ${fetchFailed ? `<div class="reports-offline-notice" style="margin:14px 16px 0">Sense connexió — mostrant només els inventaris pendents d'enviar.</div>` : ''}
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
    _historialPage   = 0;
    _renderHistorialCards();
  });

  document.getElementById('reports-cards').addEventListener('click', e => {
    if (e.target.closest('[data-load-more]')) { _historialPage++; _renderHistorialCards(); }
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
    _historialPage = 0;
    _renderHistorialCards();
  });
}

// ── MODAL COMANDA COORDINADOR ─────────────────────────────────────────

function _parseInventariItems(inventari) {
  return (inventari || '').split(' | ')
    .filter(Boolean)
    .map(seg => {
      const sep = seg.indexOf(': ');
      if (sep < 0) return null;
      const name     = seg.slice(0, sep).trim();
      const qtyStr   = seg.slice(sep + 2).trim();
      const catEntry = state.catalog.find(p => p.name.toLowerCase() === name.toLowerCase());
      const minStock = catEntry?.minStock    || 0;
      const upb      = catEntry?.unitsPerBox || 0;
      const avgQty   = catEntry?.avgQty      || 0;
      const numCom   = catEntry?.numCom      || 0;
      const qty      = parseTotalQty(qtyStr, upb);

      let orderQty, orderSrc;
      if (avgQty > 0) {
        // Recomanació basada en la mitjana histórica
        orderQty  = upb > 0 ? Math.ceil(avgQty / upb) : Math.round(avgQty);
        orderSrc  = 'mitja';
      } else {
        // Fallback: caixes per cobrir dèficit fins al mínim
        const deficit = Math.max(0, minStock - qty);
        orderQty  = upb > 0 ? Math.ceil(deficit / upb) : deficit;
        orderSrc  = 'deficit';
      }

      return { name, qty, qtyStr, minStock, upb, avgQty, numCom, orderQty, orderSrc };
    })
    .filter(Boolean);
}

function _openCoordOrderEdit(row) {
  const [id, date, hora, comensal, masiaVal, inventari] = row;
  const masiaLabel = MASIA_LABELS[masiaVal] || masiaVal || '';
  const items = _parseInventariItems(inventari);
  _coordOrderData = { id, date, hora, masia: masiaVal, masiaLabel, comensal, items };
  _renderCoordOrderEdit();
  setView('comanda-edit');
}

function _updateCoordOrderRowClass(row) {
  const qty      = parseFloat(row.dataset.qty)      || 0;
  const minStock = parseFloat(row.dataset.minstock)  || 0;
  const upb      = parseFloat(row.dataset.upb)       || 0;
  const input    = row.querySelector('.coord-order-qty');
  const orderQty = parseFloat(input?.value)          || 0;
  const orderUnits = upb > 0 ? orderQty * upb : orderQty;
  row.classList.remove('is-ok', 'is-low');
  if (minStock > 0 && qty + orderUnits < minStock) {
    row.classList.add('is-low');
  } else if (orderQty === 0) {
    row.classList.add('is-ok');
  }
}

function _renderCoordOrderEdit() {
  const { date, hora, masiaLabel, comensal, items } = _coordOrderData;
  document.getElementById('comanda-edit-title').textContent = `Comanda — ${masiaLabel}`;
  document.getElementById('comanda-edit-body').innerHTML = `
    <p class="coord-order-meta">
      Inventari del <strong>${esc(date)}</strong> a les <strong>${esc(hora)}</strong>
      · <span style="color:var(--text-dim)">${esc(comensal)}</span>
    </p>
    <div class="coord-order-list" id="coord-order-list">
      ${items.map((item, i) => {
        const orderUnits = item.upb > 0 ? item.orderQty * item.upb : item.orderQty;
        const isLow = item.minStock > 0 && item.qty + orderUnits < item.minStock;
        const isOk  = !isLow && item.orderQty === 0;
        const cls   = isOk ? ' is-ok' : isLow ? ' is-low' : '';
        const stock = item.minStock > 0
          ? `${item.qtyStr || item.qty} / mín. ${item.minStock}`
          : `${item.qtyStr || item.qty}`;
        const orderUnit = item.upb > 0 ? 'c' : 'u';
        const hint = item.orderSrc === 'mitja'
          ? `<span class="coord-order-hint coord-order-hint--mitja" title="Recomanació basada en la mitjana histórica">~${Math.round(item.avgQty)} u · ${item.numCom} com.</span>`
          : '';
        return `
        <div class="coord-order-row${cls}" data-qty="${item.qty}" data-minstock="${item.minStock}" data-upb="${item.upb}">
          <span class="coord-order-name">${esc(item.name)}</span>
          <span class="coord-order-stock">${stock}</span>
          <label class="coord-order-qty-wrap" aria-label="Quantitat a demanar">
            <input class="coord-order-qty" type="number" min="0" step="1"
                   value="${item.orderQty}" data-idx="${i}">
            <span class="coord-order-qty-unit">${orderUnit}</span>
          </label>
          ${hint}
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('coord-order-list').addEventListener('input', e => {
    const input = e.target.closest('.coord-order-qty');
    if (!input) return;
    _updateCoordOrderRowClass(input.closest('.coord-order-row'));
  });
}

export function coordOrderAccept() {
  if (!_coordOrderData) return;
  document.querySelectorAll('.coord-order-qty').forEach(input => {
    const i = parseInt(input.dataset.idx);
    _coordOrderData.items[i].orderQty = Math.max(0, parseFloat(input.value) || 0);
  });
  const { date, hora, masiaLabel, comensal } = _coordOrderData;
  const orderItems = _coordOrderData.items.filter(i => i.orderQty > 0);

  // Actualitza la mitja histórica de cada producte comandat
  orderItems.forEach(item => {
    const orderUnits = item.upb > 0 ? item.orderQty * item.upb : item.orderQty;
    const oldNum     = item.numCom || 0;
    const oldAvg     = item.avgQty || 0;
    const newNum     = oldNum + 1;
    const newAvg     = oldNum === 0
      ? orderUnits
      : Math.round(((oldAvg * oldNum) + orderUnits) / newNum * 10) / 10;
    const params = new URLSearchParams({
      action:      'update-mitja',
      productName: item.name,
      avgQty:      newAvg,
      numCom:      newNum,
    });
    sendToSheet(SHEET_APPEND_URL, params.toString());
    // Actualitza el catàleg local perquè la propera comanda ja tingui el valor nou
    const cat = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (cat) { cat.avgQty = newAvg; cat.numCom = newNum; }
  });

  const today = new Date().toISOString().slice(0, 10);
  const desc  = orderItems.length === 0
    ? 'Cap producte per demanar'
    : orderItems.map(i => {
        const unit = i.upb > 0 ? 'c' : (i.upb === 0 ? 'u' : 'u');
        return `${i.name}: ${i.orderQty} ${i.upb > 0 ? 'c' : 'u'}`;
      }).join(' | ');
  state.orders.unshift({
    id:        uid(),
    ref:       masiaLabel,
    date:      today,
    supplier:  masiaLabel,
    status:    'pendent',
    desc,
    notes:     `Inventari del ${date} (${hora}) · ${comensal}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveOrders();
  _coordOrderData = null;
  setView('orders');
}

export function closeCoordOrderModal() {
  _coordOrderData = null;
  setView('reports');
}

// ── HISTORIAL EDIT MODAL ─────────────────────────────────────────────

function openEditHistorialModal(row) {
  const [id, date, hora, comensal, masiaVal, inventari, comentari] = row;

  const masiaLabel = masiaVal ? (MASIA_LABELS[masiaVal] || masiaVal) : '';
  document.getElementById('edit-historial-meta').textContent =
    [date, hora, comensal, masiaLabel].filter(Boolean).join(' · ');

  const items = (inventari || '').split(' | ').filter(Boolean).map(item => {
    const sep    = item.indexOf(': ');
    const name   = sep > -1 ? item.slice(0, sep) : item;
    const qtyStr = sep > -1 ? item.slice(sep + 2).trim() : '';
    const boxM   = qtyStr.replace(/\s/g, '').match(/^(\d+(?:\.\d+)?)c/);
    const boxes  = boxM ? parseFloat(boxM[1]) : 0;
    const looseM = qtyStr.replace(/\s/g, '').match(/\+(\d+(?:\.\d+)?)[^0-9+]/) ||
                   (!boxM ? qtyStr.match(/^(\d+(?:\.\d+)?)/) : null);
    const loose  = looseM ? parseFloat(looseM[1]) : 0;
    const unitM  = qtyStr.match(/(\d+(?:\.\d+)?)([a-zA-ZàèéíïòóúüçÀ-ž]+)\s*$/);
    const unit   = unitM ? unitM[2] : '';
    return { name, boxes, loose, unit, qtyStr };
  });

  document.getElementById('edit-historial-items').innerHTML = items.map((item, i) => {
    const catEntry  = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    const minStock  = catEntry?.minStock || 0;
    const upb       = catEntry?.unitsPerBox || 0;
    const total     = upb > 0 ? item.boxes * upb + item.loose : item.loose || item.boxes;
    const isLow     = minStock > 0 && total < minStock;
    const unitLabel = item.unit || catEntry?.unit || 'u';
    return `
    <div class="edit-hist-row${isLow ? ' is-low' : ''}">
      <span class="edit-hist-name">${esc(item.name)}</span>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <div class="edit-hist-qty-wrap">
          <input type="number" min="0" step="any" class="edit-hist-input"
                 data-hist-idx="${i}" data-hist-type="loose"
                 placeholder="0" value="${item.loose || ''}">
          <span class="edit-hist-unit">${esc(unitLabel)}</span>
        </div>
        <div class="edit-hist-qty-wrap">
          <input type="number" min="0" step="any" class="edit-hist-input"
                 data-hist-idx="${i}" data-hist-type="boxes"
                 placeholder="0" value="${item.boxes || ''}">
          <span class="edit-hist-unit">c</span>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('edit-historial-comment').value = comentari || '';
  _editingHistorialId    = id;
  _editingHistorialItems = items;

  document.getElementById('modal-edit-historial').classList.add('open');
}

export function closeEditHistorialModal() {
  document.getElementById('modal-edit-historial').classList.remove('open');
  _editingHistorialId    = null;
  _editingHistorialItems = [];
}

export function saveEditHistorial() {
  if (!_editingHistorialId) return;

  const newInventari = _editingHistorialItems.map((item, i) => {
    const looseInput = document.querySelector(`[data-hist-idx="${i}"][data-hist-type="loose"]`);
    const boxesInput = document.querySelector(`[data-hist-idx="${i}"][data-hist-type="boxes"]`);
    const loose = parseFloat(looseInput?.value) || 0;
    const boxes = parseFloat(boxesInput?.value) || 0;
    const catEntry  = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    const unitLabel = item.unit || catEntry?.unit || 'u';
    const parts = [];
    if (loose > 0) parts.push(`${loose}${unitLabel}`);
    if (boxes > 0) parts.push(`${boxes}c`);
    const qtyStr = parts.join(' + ') || '0';
    return `${item.name}: ${qtyStr}`;
  }).join(' | ');

  const comentari = document.getElementById('edit-historial-comment').value.trim();

  const params = new URLSearchParams({
    action:    'update-historial',
    id:        _editingHistorialId,
    inventari: newInventari,
    comentari,
  });
  sendToSheet(SHEET_APPEND_URL, params.toString());

  const rowIdx = _historialRows.findIndex(r => r[0] === _editingHistorialId);
  if (rowIdx >= 0) {
    const updated = [..._historialRows[rowIdx]];
    updated[5] = newInventari;
    updated[6] = comentari;
    _historialRows[rowIdx] = updated;
  }

  closeEditHistorialModal();
  _renderHistorialCards();
  toast('Inventari actualitzat');
}
