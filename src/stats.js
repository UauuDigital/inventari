import { state, INVENTARI_URL, MASIA_LABELS, MASIA_COLORS, STORAGE_PENDING_INV, STORAGE_MASIA_ADULTS, CAT_COLORS, saveItems, saveOrders } from './config.js';
import { t } from './i18n.js';
import { esc, fmtNum, fmtQtyDisplay, parseTotalQty, uid, toast, parseCSV, findCol, sendToSheet, sendComandaToSheet, getGasUrl } from './helpers.js';
import { loadCatalog } from './catalog.js';
import { ensureCategory } from './items.js';
import { ensureCasamentsLoaded, getCasamentsData } from './casaments.js';

// Placeholder mostrat quan un producte no s'ha comptat en un inventari enviat.
const NOT_COUNTED = '—';

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
  pending.forEach(entry => sendToSheet(getGasUrl(), entry.params));
  _savePendingInv([]);
  _historialRows = _historialRows.filter(r => !r[7]);
  _renderHistorialCards();
}

function _resendPendingHistorial(id) {
  const pending = _loadPendingInv();
  const idx = pending.findIndex(p => p.id === id);
  if (idx < 0) return;
  if (!navigator.onLine) {
    toast(t('Encara sense connexió. S\'enviarà automàticament quan tornis a tenir WiFi.'));
    return;
  }
  sendToSheet(getGasUrl(), pending[idx].params);
  pending.splice(idx, 1);
  _savePendingInv(pending);
  _historialRows = _historialRows.filter(r => r[0] !== id);
  _renderHistorialCards();
  toast(t('Inventari enviat.'));
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
    delBtn.textContent = t('Confirmar?');
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
    toast(t('Eliminant… (id: {id})', { id: id.slice(-6) }));
    sendToSheet(getGasUrl(), new URLSearchParams({ action: 'delete-historial', id }).toString());
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
  const name = input.dataset.product;
  if (!name) return;
  const item = state.items.find(i => i.name.toLowerCase() === name.toLowerCase());

  if (input.value === '') {
    if (item) { state.items = state.items.filter(i => i !== item); saveItems(); renderStats(); }
  } else {
    const val = parseFloat(input.value) || 0;
    if (item) {
      item.boxes     = val;
      item.quantity  = val;
      item.updatedAt = new Date().toISOString();
    } else {
      const product = state.catalog.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!product) return;
      const catId = ensureCategory(product.category);
      state.items.unshift({
        id: uid(), createdAt: new Date().toISOString(),
        name: product.name, category: catId,
        minStock: product.minStock || 0, notes: '',
        quantity: val, boxes: val, unit: product.unit || '',
        updatedAt: new Date().toISOString(),
      });
      renderStats();
    }
    saveItems();
  }

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
         <span class="stat-label">${t('Estoc baix')}</span>
       </div>`
    : '';

  strip.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${total}</span>
      <span class="stat-label">${t('Articles')}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${state.categories.length}</span>
      <span class="stat-label">${t('Categories')}</span>
    </div>
    ${card3}
  `;
}

// ── STATS VIEW ───────────────────────────────────────────────────────

export function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  if (document.body.dataset.role === 'comensal') {
    if (!state.catalog.length) {
      el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.4"><span class="stats-cat-name" style="flex:none;font-size:13px">${t('Carregant catàleg…')}</span></div>`;
      return;
    }
    const groups = new Map();
    state.catalog.forEach(product => {
      const catName = product.category || t('Sense categoria');
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName).push(product);
    });
    let html = `<div class="stats-total-row"><span class="stats-total-label">${t('Total comptat')}</span><span class="stats-total-val">${t('{n} productes', { n: state.items.length })}</span></div>`;
    groups.forEach((products, catName) => {
      html += `<div class="stats-section-title">${esc(catName)}</div>`;
      products.forEach(product => {
        const item      = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());
        const boxesVal  = item ? (item.boxes != null ? item.boxes : (item.quantity || '')) : '';
        html += `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(product.name)}</span>
          <div class="stats-qty-inputs">
            <div class="stats-qty-field">
              <input type="number" min="0" class="stats-qty-input"
                     data-product="${esc(product.name)}" data-field="boxes"
                     value="${boxesVal}" placeholder="—">
              <span class="stats-qty-unit">c</span>
            </div>
            ${item ? `<button class="stats-remove-btn" data-remove-item="${esc(item.id)}" aria-label="${t('Desmarcar')} ${esc(product.name)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>` : ''}
          </div>
        </div>`;
      });
    });
    html += `<div id="pending-changes-banner" class="pending-changes-banner"${_pendingQtyChange ? '' : ' hidden'}>
      <span>${t("Canvis pendents d'enviar")}</span>
    </div>`;
    html += `<textarea class="inv-comment-input" id="inv-comment" placeholder="${t('Comentari opcional…')}" rows="3"></textarea>`;
    html += `<button class="btn-send-report" data-action="send-report">${t('Enviar inventari al coordinador')}</button>`;
    el.innerHTML = html;
    _initScrollFab('btn-stats-scrolltop', 'btn-stats-scrollbottom');
    return;
  }

  const lowItems  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
  const zeroItems = state.items.filter(i => i.quantity === 0);
  const alertN    = lowItems.length + zeroItems.length;

  el.innerHTML = `
    ${alertN > 0 ? `
    <div class="low-stock-alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${t('{n} producte{s} per sota del mínim', { n: alertN, s: alertN !== 1 ? 's' : '' })}</span>
    </div>` : ''}
    <div class="stats-section-title">${t('Per categoria')}</div>

    ${state.categories.map(cat => {
      const catItems = state.items.filter(i => i.category === cat.id);
      return `
        <div class="stats-cat-row">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="stats-cat-name">${esc(cat.name)}</span>
          <div class="stats-cat-meta">
            <span class="stats-cat-count">${t('{n} art.', { n: catItems.length })}</span>
          </div>
        </div>
      `;
    }).join('')}

    ${lowItems.length > 0 ? `
      <div class="stats-section-title" style="color:var(--low)">${t('Estoc baix')}</div>
      ${lowItems.map(item => `
        <div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count" style="color:var(--low)">
            ${fmtQtyDisplay(item)} / ${t('mín')} ${fmtNum(item.minStock)}
          </span>
        </div>
      `).join('')}
    ` : ''}

    ${zeroItems.length > 0 ? `
      <div class="stats-section-title" style="color:rgba(255,255,255,0.28)">${t('Sense estoc')}</div>
      ${zeroItems.map(item => `
        <div class="stats-cat-row" style="opacity:.45">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">0 ${esc(item.unit || '')}</span>
        </div>
      `).join('')}
    ` : ''}

    ${lowItems.length === 0 && zeroItems.length === 0 && state.items.length > 0 ? `
      <div class="stats-cat-row" style="justify-content:center;opacity:.4">
        <span class="stats-cat-name" style="flex:none;font-size:13px">${t("Tot l'estoc està en ordre ✓")}</span>
      </div>
    ` : ''}
  `;
  _initScrollFab('btn-stats-scrolltop', 'btn-stats-scrollbottom');
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
  // Envia tot el catàleg al coordinador, no només els productes comptats:
  // els no comptats es marquen amb el placeholder NOT_COUNTED.
  const inventariStr = state.catalog.map(p => {
    const item = state.items.find(i => i.name.toLowerCase() === p.name.toLowerCase());
    return `${p.name}: ${item ? fmtQtyDisplay(item) : NOT_COUNTED}`;
  }).join(' | ');
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
    sendToSheet(getGasUrl(), params.toString());
  }
  _pendingQtyChange = false;

  state.items = [];
  saveItems();
  renderStats();
  toast(wasOffline
    ? t('Sense connexió: l\'inventari s\'ha desat i s\'enviarà quan tinguis WiFi.')
    : t('Inventari enviat. Comprova\'l a l\'historial.'));
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
  return `<button class="cat-delete-btn" data-delete-historial="${esc(id)}" title="${t('Eliminar permanentment')}" style="margin-left:6px;flex-shrink:0">${_deleteIcon}</button>`;
}
function _editBtn(id) {
  return `<button class="cat-delete-btn" data-edit-historial="${esc(id)}" title="${t('Editar')}" style="margin-left:6px;flex-shrink:0;opacity:.7">${_editIcon}</button>`;
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
  const delBtn        = role === 'admin' ? _deleteBtn(id) : '';
  const hasOrder      = state.orders.some(o => o.sourceHistorialId === id);
  const orderBadge    = hasOrder
    ? `<span class="report-order-badge" title="${t("Ja s'ha generat una comanda a partir d'aquest inventari")}">${t('Comanda generada')}</span>`
    : '';
  const genComandaBtn = (role === 'coordinador' || role === 'admin') && !isProducte
    ? `<button class="btn-gen-comanda" data-gencomanda="${esc(id)}" type="button">${hasOrder ? t('Torna a generar') : t('Genera comanda')}</button>`
    : '';
  const canEdit = (role === 'admin' || role === 'coordinador') && !isPending;
  const resendBtn = isPending
    ? `<button class="btn-resend-historial" data-resend-historial="${esc(id)}" type="button">${t('Enviar ara')}</button>`
    : '';

  if (isProducte) {
    const nomProducte = inventari.slice('[PRODUCTE]: '.length);
    const accentColor = masiaColor || 'rgba(242,239,238,0.55)';
    return `
      <div class="report-card" style="border:1px solid ${accentColor}33;border-left:4px solid ${accentColor};background:rgba(242,239,238,0.05);">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 16px 0">
          <span style="font-size:9px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:${accentColor};opacity:0.85">+ ${t('Producte nou')}</span>
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
    const isLow    = qty !== NOT_COUNTED && minStock > 0 && parseTotalQty(qty) < minStock;
    const lowStyle = isLow ? ` style="color:var(--danger)"` : '';
    return `<div class="stats-cat-row">
      <span class="stats-cat-name"${lowStyle}>${esc(name)}</span>
      <span class="stats-cat-count"${lowStyle}>${esc(qty)}</span>
    </div>`;
  }).join('');
  const comentariHtml = comentari ? `<div class="report-comment">${esc(comentari)}</div>` : '';
  const statusBadge = isPending
    ? `<span class="report-pending-badge">${t('No enviat')}</span>`
    : (role === 'comensal' ? `<span class="report-received-badge">${t('Rebut')}</span>` : `<span class="report-count-badge">${t('{n} productes', { n: items.length })}</span>`);
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
          ${orderBadge}
          ${editBtn}
          ${genComandaBtn}
          ${delBtn}
        </div>
      </div>
      ${comentariHtml}
      ${(role === 'comensal' || role === 'coordinador')
        ? `<details class="report-items-details">
             <summary class="report-items-summary">${t('{n} productes', { n: items.length })}</summary>
             <div class="report-items-list">${itemsHtml}</div>
           </details>`
        : `<div class="report-items-list">${itemsHtml}</div>`}
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
    cardsEl.innerHTML = `<div class="reports-loading" style="padding:40px 16px 20px">${t('Sense resultats.')}</div>`;
    return;
  }

  const visible  = data.slice(0, (_historialPage + 1) * HIST_PAGE_SIZE);
  const hasMore  = data.length > visible.length;
  cardsEl.innerHTML = visible.map(r => _cardHtml(r, role)).join('') +
    (hasMore
      ? `<button class="load-more-btn" data-load-more>${t('Carregar més ({n} restants)', { n: data.length - visible.length })}</button>`
      : '');
}

export async function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">${t('Carregant historial…')}</div>`;

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
          <span class="stats-cat-name" style="flex:none;font-size:13px;color:var(--low)">${t("Error: s'està llegint el full incorrecte.")}</span>
          <span class="stats-cat-count">${t('Capçaleres trobades:')} ${esc((rows[0] || []).join(', '))}</span>
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
      el.innerHTML = `<div class="reports-loading" style="color:var(--text-dim)">${t('Error carregant historial. Comprova la connexió.')}</div>`;
    } else {
      el.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
            <rect x="10" y="8" width="44" height="50" rx="4"/>
            <path d="M10 22h44"/><path d="M20 36h24M20 44h16"/>
          </svg>
          <p class="empty-title">${t('Sense historial')}</p>
          <p class="empty-text">${role === 'comensal'
            ? t('Els teus inventaris enviats i productes creats apareixeran aquí.')
            : t('Els encarregats enviaran informes quan acabin l\'inventari.')}</p>
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
    ${fetchFailed ? `<div class="reports-offline-notice" style="margin:14px 16px 0">${t("Sense connexió — mostrant només els inventaris pendents d'enviar.")}</div>` : ''}
    <div style="padding:14px 16px 0">
      <input class="search-input" id="historial-search" placeholder="${t('Cerca producte, usuari…')}" autocomplete="off" style="height:40px">
    </div>
    <div class="filter-pills" id="historial-filters" style="padding-top:10px">
      <button class="filter-pill active" data-hfilter="tot">${t('Tot')}</button>
      <button class="filter-pill" data-hfilter="inventari">${t('Inventaris')}</button>
      <button class="filter-pill" data-hfilter="producte">${t('Productes nous')}</button>
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

function _getMasiaAdults(masiaVal) {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_MASIA_ADULTS) || '{}');
    return parseInt(map[masiaVal]) || 0;
  } catch { return 0; }
}

// Casaments registrats d'aquesta masia (passats i futurs, sense filtrar per data).
function _masiaCasaments(masiaVal) {
  return getCasamentsData().filter(c => c.masiaId === masiaVal && c.adults > 0);
}

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
      const avgQty   = catEntry?.avgQty      || 0; // mitjana de caixes per adult (inventari + comanda)
      const numCom   = catEntry?.numCom      || 0;
      const category = catEntry?.category    || '';
      const notCounted = qtyStr === NOT_COUNTED;
      const qty      = parseTotalQty(qtyStr, upb);
      const currentBoxes = upb > 0 ? qty / upb : qty;

      return { name, qty, qtyStr, minStock, upb, avgQty, numCom, category, currentBoxes, notCounted, orderQty: 0, orderSrc: '' };
    })
    .filter(Boolean);
}

// Calcula la quantitat recomanada per a cada producte a partir de la mitjana
// de caixes/adult i el nombre d'adults de la masia (no altera avgQty/numCom).
function _applyOrderRecommendations(items, adults) {
  items.forEach(item => {
    // Un producte no comptat a l'inventari no vol dir que no n'hi hagi — vol dir
    // que n'hi ha prou i per això no s'ha comptat. No es calcula cap comanda per a ell.
    if (item.notCounted) {
      item.targetBoxes = null;
      item.rawDeficit  = null;
      item.orderQty = 0;
      item.orderSrc = 'not-counted';
      return;
    }
    if (item.avgQty > 0 && adults > 0) {
      // Objectiu: caixes totals (inventari + comanda) segons la mitjana per adult
      const targetBoxes = item.avgQty * adults;
      const rawDeficit   = targetBoxes - item.currentBoxes;
      const deficit      = Math.max(0, rawDeficit);
      item.targetBoxes = targetBoxes;
      item.rawDeficit  = rawDeficit;
      item.orderQty = Math.ceil(deficit - 1e-9);
      item.orderSrc = 'mitja';
    } else {
      // Fallback: caixes per cobrir dèficit fins al mínim
      const deficit = Math.max(0, item.minStock - item.qty);
      item.targetBoxes = null;
      item.rawDeficit  = null;
      item.orderQty = item.upb > 0 ? Math.ceil(deficit / item.upb) : deficit;
      item.orderSrc = 'deficit';
    }
  });
}

async function _openCoordOrderEdit(row) {
  const [id, date, hora, comensal, masiaVal, inventari] = row;
  const masiaLabel = MASIA_LABELS[masiaVal] || masiaVal || '';
  const items = _parseInventariItems(inventari);

  await ensureCasamentsLoaded();
  const casaments = _masiaCasaments(masiaVal);
  const sumAdults = casaments.reduce((sum, c) => sum + c.adults, 0);
  const adults    = sumAdults > 0 ? sumAdults : _getMasiaAdults(masiaVal);

  _applyOrderRecommendations(items, adults);
  _coordOrderSearchText = '';
  _coordOrderData = {
    id, date, hora, masia: masiaVal, masiaLabel, comensal, items, adults,
    adultsFromCasaments: sumAdults > 0,
    adultsBreakdown: casaments,
  };
  _renderCoordOrderEdit();
  setView('comanda-edit');
}

// Botons flotants "anar a dalt/a baix" per a vistes amb llistes llargues. El que
// realment fa scroll és sempre #app-main (tota la pàgina), no el contenidor de la
// vista, així que els botons són position:fixed i mesuren el scroll d'#app-main.
function _initScrollFab(btnTopId, btnBottomId) {
  const scrollEl = document.getElementById('app-main');
  const btnTop   = document.getElementById(btnTopId);
  const btnBottom = document.getElementById(btnBottomId);
  if (!scrollEl || !btnTop || !btnBottom) return;
  const update = () => {
    btnBottom.hidden = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 40;
    btnTop.hidden    = scrollEl.scrollTop < 40;
  };
  scrollEl.onscroll  = update;
  btnBottom.onclick  = () => scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  btnTop.onclick     = () => scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  // La vista pot encara estar amagada (hidden) en aquest punt, cosa que fa que
  // scrollHeight/clientHeight donin 0; ajornem el primer càlcul a després que es
  // faci visible.
  requestAnimationFrame(update);
}

function _updateCoordOrderRowClass(row) {
  const notCounted = row.dataset.notcounted === '1';
  const qty      = parseFloat(row.dataset.qty)      || 0;
  const minStock = parseFloat(row.dataset.minstock) || 0;
  const input    = row.querySelector('.coord-order-qty');
  const orderQty = parseFloat(input?.value)         || 0;
  row.classList.remove('is-ok', 'is-low');
  if (!notCounted && minStock > 0 && qty + orderQty < minStock) {
    row.classList.add('is-low');
  } else if (orderQty === 0) {
    row.classList.add('is-ok');
  }
}

let _coordOrderSearchText = '';

// Agrupa els articles per categoria (seguint l'ordre de state.categories; els sense
// categoria coneguda van al final) per facilitar-ne la revisió a l'hora de generar la comanda.
function _coordCatColor(catName) {
  const cat = state.categories.find(c => c.name.toLowerCase() === (catName || '').toLowerCase());
  if (cat) return cat.color;
  let h = 0;
  for (let i = 0; i < (catName || '').length; i++) h = (h * 31 + catName.charCodeAt(i)) & 0xFFFF;
  return CAT_COLORS[h % CAT_COLORS.length];
}

function _sortedCoordOrderCategories(items) {
  const present = new Set(items.map(item => item.category || ''));
  const known   = state.categories.map(c => c.name).filter(name => present.has(name));
  const rest    = [...present].filter(name => !known.includes(name)).sort();
  // Deixa "Sense categoria" (nom buit) sempre al final
  return [...known, ...rest.filter(n => n !== ''), ...(present.has('') ? [''] : [])];
}

function _renderCoordOrderItemsList() {
  const { items } = _coordOrderData;
  const withIdx = items.map((item, i) => ({ item, i }));
  const categories = _sortedCoordOrderCategories(items);

  document.getElementById('coord-order-list').innerHTML = categories.map(catName => {
    const color = _coordCatColor(catName);
    const rowsHtml = withIdx.filter(({ item }) => (item.category || '') === catName).map(({ item, i }) => {
      const orderUnits = item.upb > 0 ? item.orderQty * item.upb : item.orderQty;
      const isLow = !item.notCounted && item.minStock > 0 && item.qty + orderUnits < item.minStock;
      const isOk  = !isLow && item.orderQty === 0;
      const cls   = isOk ? ' is-ok' : isLow ? ' is-low' : '';
      const stock = item.notCounted
        ? '—'
        : item.minStock > 0
          ? `${item.qtyStr || item.qty} / ${t('mín.')} ${item.minStock}`
          : `${item.qtyStr || item.qty}`;
      const orderUnit = item.upb > 0 ? 'c' : 'u';

      return `
      <div class="coord-order-row${cls}" style="border-left:3px solid ${color}" data-qty="${item.qty}" data-minstock="${item.minStock}" data-upb="${item.upb}" data-notcounted="${item.notCounted ? '1' : '0'}" data-search="${esc(item.name.toLowerCase())}">
        <span class="coord-order-name">${esc(item.name)}</span>
        <span class="coord-order-stock">${stock}</span>
        <label class="coord-order-qty-wrap" aria-label="${t('Quantitat a demanar')}">
          <input class="coord-order-qty" type="number" min="0" step="1"
                 value="${item.orderQty}" data-idx="${i}">
          <span class="coord-order-qty-unit">${orderUnit}</span>
        </label>
      </div>`;
    }).join('');

    return `<div class="coord-order-section-title" data-search-section><span class="cat-dot" style="background:${color}"></span>${esc(catName || t('Sense categoria'))}</div>${rowsHtml}`;
  }).join('');
  _filterCoordOrderItemsList();
}

function _filterCoordOrderItemsList() {
  let lastSection = null;
  let sectionHasVisible = false;
  document.querySelectorAll('#coord-order-list > *').forEach(el => {
    if (el.hasAttribute('data-search-section')) {
      if (lastSection) lastSection.hidden = !sectionHasVisible;
      lastSection = el;
      sectionHasVisible = false;
      return;
    }
    el.hidden = !!_coordOrderSearchText && !(el.dataset.search || '').includes(_coordOrderSearchText);
    if (!el.hidden) sectionHasVisible = true;
  });
  if (lastSection) lastSection.hidden = !sectionHasVisible;
}

function _renderCoordOrderEdit() {
  const { date, hora, masiaLabel, comensal, adults, adultsFromCasaments } = _coordOrderData;
  document.getElementById('comanda-edit-title').textContent = t('Comanda — {masia}', { masia: masiaLabel });

  const adultsSrcHint = adultsFromCasaments
    ? ''
    : `<span class="coord-order-adults-src coord-order-adults-src--warn">${t('cap casament trobat — valor manual')}</span>`;

  document.getElementById('comanda-edit-body').innerHTML = `
    <p class="coord-order-meta">
      ${t('Inventari del')} <strong>${esc(date)}</strong> ${t('a les')} <strong>${esc(hora)}</strong>
      · <span style="color:var(--text-dim)">${esc(comensal)}</span>
    </p>
    <span class="coord-order-adults-badge">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
      <strong>${adults}</strong> persones a la masia
    </span>
    ${adultsSrcHint}
    <input class="catalog-simple-search" id="coord-order-search" type="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${t('Cerca producte…')}" value="${esc(_coordOrderSearchText)}">
    <div class="coord-order-list" id="coord-order-list"></div>`;

  _renderCoordOrderItemsList();

  document.getElementById('coord-order-list').addEventListener('input', e => {
    const input = e.target.closest('.coord-order-qty');
    if (!input) return;
    _updateCoordOrderRowClass(input.closest('.coord-order-row'));
  });

  document.getElementById('coord-order-search').addEventListener('input', e => {
    _coordOrderSearchText = e.target.value.trim().toLowerCase();
    _filterCoordOrderItemsList();
  });

  _initScrollFab('btn-comanda-scrolltop', 'btn-comanda-scrollbottom');
}

export function coordOrderAccept() {
  if (!_coordOrderData) return;
  document.querySelectorAll('.coord-order-qty').forEach(input => {
    const i = parseInt(input.dataset.idx);
    _coordOrderData.items[i].orderQty = Math.max(0, parseFloat(input.value) || 0);
  });
  const { date, hora, masiaLabel, comensal, adults } = _coordOrderData;
  const orderItems = _coordOrderData.items.filter(i => i.orderQty > 0);

  // Actualitza la mitjana de caixes/adult (inventari + comanda) de cada producte comandat.
  // Els productes no comptats a l'inventari es queden fora encara que se'ls demani
  // manualment: no sabem quantes caixes hi havia realment (currentBoxes seria 0 i
  // falsejaria la mitjana).
  // Es guarda un "snapshot" (valors abans/després) a la comanda perquè, si s'elimina
  // més endavant, es pugui revertir la seva contribució a la mitjana (vegeu revertOrderMitja).
  const mitjaSnapshot = [];
  if (adults > 0) {
    orderItems.filter(item => !item.notCounted).forEach(item => {
      const perAdult = (item.currentBoxes + item.orderQty) / adults;
      const oldNum   = item.numCom || 0;
      const oldAvg   = item.avgQty || 0;
      const newNum   = oldNum + 1;
      const newAvg   = oldNum === 0
        ? perAdult
        : Math.round(((oldAvg * oldNum) + perAdult) / newNum * 1000) / 1000;
      const params = new URLSearchParams({
        action:      'update-mitja',
        productName: item.name,
        avgQty:      newAvg,
        numCom:      newNum,
      });
      sendToSheet(getGasUrl(), params.toString());
      // Actualitza el catàleg local perquè la propera comanda ja tingui el valor nou
      const cat = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (cat) { cat.avgQty = newAvg; cat.numCom = newNum; }
      mitjaSnapshot.push({ productName: item.name, prevAvg: oldAvg, prevNum: oldNum, newAvg, newNum });
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const desc  = orderItems.length === 0
    ? t('Cap producte per demanar')
    : orderItems.map(i => `${i.name}: ${i.orderQty} c`).join(' | ');
  const newOrder = {
    id:        uid(),
    date:      today,
    supplier:  masiaLabel,
    masia:     _coordOrderData.masia,
    status:    'pendent',
    desc,
    notes:     t('Inventari del {date} ({hora}) · {comensal}', { date, hora, comensal }),
    createdBy: state.authProfile?.nom || state.user || comensal || '',
    sourceHistorialId: _coordOrderData.id,
    mitjaSnapshot,
    adults,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.orders.unshift(newOrder);
  sendComandaToSheet(newOrder, 'add-comanda');
  saveOrders();
  _coordOrderData = null;
  setView('orders');
}

export function closeCoordOrderModal() {
  _coordOrderData = null;
  setView('reports');
}

// Reverteix la contribució d'una comanda a la mitjana de cada producte, només si
// ningú ha tornat a comandar aquest producte des de llavors (el catàleg encara té
// exactament els valors que aquesta comanda hi va deixar). Si no, es deixa tal qual
// i es reporta com a "no revertit" perquè desfer-ho trencaria la mitjana d'ordres posteriors.
export function revertOrderMitja(order) {
  const snapshot = order?.mitjaSnapshot;
  if (!snapshot || !snapshot.length) return { reverted: [], skipped: [] };

  const reverted = [];
  const skipped  = [];
  snapshot.forEach(entry => {
    const cat = state.catalog.find(p => p.name.toLowerCase() === entry.productName.toLowerCase());
    if (!cat || cat.avgQty !== entry.newAvg || cat.numCom !== entry.newNum) {
      skipped.push(entry.productName);
      return;
    }
    const params = new URLSearchParams({
      action:      'update-mitja',
      productName: entry.productName,
      avgQty:      entry.prevAvg,
      numCom:      entry.prevNum,
    });
    sendToSheet(getGasUrl(), params.toString());
    cat.avgQty = entry.prevAvg;
    cat.numCom = entry.prevNum;
    reverted.push(entry.productName);
  });
  return { reverted, skipped };
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
    const boxes  = parseTotalQty(qtyStr);
    return { name, boxes, qtyStr };
  });

  document.getElementById('edit-historial-items').innerHTML = items.map((item, i) => {
    const catEntry = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    const minStock = catEntry?.minStock || 0;
    const isLow    = minStock > 0 && item.boxes < minStock;
    return `
    <div class="edit-hist-row${isLow ? ' is-low' : ''}">
      <span class="edit-hist-name">${esc(item.name)}</span>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
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
    const boxesInput = document.querySelector(`[data-hist-idx="${i}"][data-hist-type="boxes"]`);
    const boxes = parseFloat(boxesInput?.value) || 0;
    return `${item.name}: ${boxes}c`;
  }).join(' | ');

  const comentari = document.getElementById('edit-historial-comment').value.trim();

  const params = new URLSearchParams({
    action:    'update-historial',
    id:        _editingHistorialId,
    inventari: newInventari,
    comentari,
  });
  sendToSheet(getGasUrl(), params.toString());

  const rowIdx = _historialRows.findIndex(r => r[0] === _editingHistorialId);
  if (rowIdx >= 0) {
    const updated = [..._historialRows[rowIdx]];
    updated[5] = newInventari;
    updated[6] = comentari;
    _historialRows[rowIdx] = updated;
  }

  closeEditHistorialModal();
  _renderHistorialCards();
  toast(t('Inventari actualitzat'));
}
