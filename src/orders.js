import { state, STATUS_LABELS, STATUS_CSS, MASIA_COLORS, MASIA_LABELS, CAT_COLORS, saveOrders } from './config.js';
import { t } from './i18n.js';
import { uid, esc, fmtDate, toast, sendComandaToSheet, deleteComandaFromSheet, getGasUrl, sendToSheet, sortByCategoryName, unitSuffix, evalQtyExpr } from './helpers.js';
import { revertOrderMitja } from './stats.js';

// Si la comanda prové d'un inventari rebut, elimina també aquell registre del Sheets.
function _deleteSourceHistorial(order) {
  if (!order?.sourceHistorialId) return;
  sendToSheet(getGasUrl(), new URLSearchParams({ action: 'delete-historial', id: order.sourceHistorialId }).toString());
}

function _parseStructuredDesc(desc) {
  if (!desc || !desc.includes(': ')) return null;
  const parts = desc.split(' | ');
  const items = parts.map(p => {
    // format "nom: 3 c"
    const m = p.match(/^(.+):\s*(\d+(?:\.\d+)?)\s*c$/);
    if (m) return { name: m[1].trim(), qty: parseFloat(m[2]) };
    return null;
  });
  return items.every(Boolean) && items.length > 0 ? items : null;
}

function _buildDescTable(items) {
  return items.map(item => `
    <div class="order-desc-row">
      <span class="order-desc-name">${esc(item.name)}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <label class="order-desc-qty-wrap">
          <input class="order-desc-qty order-desc-main" type="number" min="0" step="1"
                 value="${item.qty}" data-name="${esc(item.name)}">
          <span class="order-desc-qty-unit">c</span>
        </label>
      </div>
    </div>`).join('');
}

function _readDescFromTable() {
  const rows = document.querySelectorAll('#order-desc-table .order-desc-row');
  return Array.from(rows).map(row => {
    const main = row.querySelector('.order-desc-main');
    const name = main.dataset.name;
    const qty  = Math.max(0, parseFloat(main.value) || 0);
    return `${name}: ${qty} c`;
  }).join(' | ');
}

export function filteredOrders() {
  if (!state.orderFilter) return state.orders;
  return state.orders.filter(o => o.status === state.orderFilter);
}

export function renderOrders() {
  const list  = document.getElementById('orders-list');
  const empty = document.getElementById('orders-empty');
  if (!list) return;

  document.querySelectorAll('#orders-filter-strip .filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === state.orderFilter);
  });

  const orders = filteredOrders();

  if (orders.length === 0) {
    list.innerHTML = '';
    empty.hidden   = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = orders.map(o => {
    const masiaColor = MASIA_COLORS[o.masia] || '';
    const cardStyle   = masiaColor ? ` style="border-left:3px solid ${masiaColor}"` : '';
    return `
    <div class="order-card" data-id="${o.id}"${cardStyle}>
      <div class="order-card-top">
        <div class="order-card-meta">
          ${o.ref  ? `<span class="order-ref">${esc(o.ref)}</span>`   : ''}
          ${o.date ? `<span class="order-date">${fmtDate(o.date)}</span>` : ''}
          ${o.createdBy ? `<span class="order-created-by">${esc(o.createdBy)}</span>` : ''}
        </div>
        <button class="order-status-badge ${STATUS_CSS[o.status] || ''}" data-cycle-status="${o.id}" title="${t('Clic per canviar estat')}">
          ${esc(t(STATUS_LABELS[o.status]) || o.status)}
        </button>
      </div>
      ${o.supplier ? `<div class="order-supplier">${esc(o.supplier)}</div>` : ''}
      ${o.desc     ? `<div class="order-desc">${esc(o.desc)}</div>`         : ''}
      <div class="order-card-footer">
        <div class="order-card-actions">
          <button class="order-icon-btn" data-print-order="${o.id}" aria-label="${t('Imprimir comanda')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
          <button class="order-icon-btn" data-edit-order="${o.id}" aria-label="${t('Editar comanda')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="order-icon-btn order-icon-btn--danger" data-delete-order-direct="${o.id}" aria-label="${t('Eliminar comanda')}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// ── PRODUCT PICK, D'UN EN UN (nova comanda / comanda anterior) ────────
// Enlloc de cercar i afegir productes un a un manualment, es recorren TOTS
// els productes del catàleg d'un en un (com el modal de quantitat de
// l'encarregat), i es deixa a 0 els que no es volen demanar.

let _orderItems   = [];
let _orderPickIdx = 0;
let _orderPickField = 'stock'; // 'stock' | 'qty' — camp actiu dins el producte actual

function _orderCatColor(catName) {
  const cat = state.categories.find(c => c.name.toLowerCase() === (catName || '').toLowerCase());
  if (cat) return cat.color;
  let h = 0;
  for (let i = 0; i < (catName || '').length; i++) h = (h * 31 + catName.charCodeAt(i)) & 0xFFFF;
  return CAT_COLORS[h % CAT_COLORS.length];
}

function _initOrderPickItems() {
  _orderItems = sortByCategoryName(state.catalog, p => p.category, p => p.name)
    .map(p => ({ name: p.name, category: p.category || '', minStock: p.minStock || 0, unit: p.unit || '', stock: 0, boxes: 0 }));
  _orderPickIdx = 0;
  _orderPickField = 'stock';
}

function _updateOrderPickNavButtons() {
  const atFirst = _orderPickIdx <= 0 && _orderPickField === 'stock';
  const atLast  = _orderPickIdx >= _orderItems.length - 1 && _orderPickField === 'qty';
  document.getElementById('btn-order-pick-prev').disabled = atFirst;
  document.getElementById('btn-order-pick-next').disabled = atLast;
}

// idx/field: producte i camp que ha de quedar carregat i amb el focus.
function _loadOrderPick(idx, field = 'stock') {
  const item = _orderItems[idx];
  if (!item) return;
  _orderPickIdx   = idx;
  _orderPickField = field;

  document.getElementById('order-pick-name').textContent = item.name;

  const catBadge = document.getElementById('order-pick-cat');
  if (item.category) {
    const color = _orderCatColor(item.category);
    catBadge.textContent = item.category;
    catBadge.style.background  = color;
    catBadge.style.color       = 'rgba(34,31,30,0.8)';
    catBadge.style.borderColor = 'transparent';
    catBadge.hidden = false;
  } else {
    catBadge.hidden = true;
  }

  document.getElementById('f-order-pick-stock').value = item.stock || '';
  document.getElementById('f-order-pick-qty').value   = item.boxes || '';
  const unit = unitSuffix(item.unit);
  document.getElementById('order-pick-stock-unit').textContent = unit;
  document.getElementById('order-pick-qty-unit').textContent   = unit;
  document.getElementById('order-pick-progress').textContent =
    t('{n} de {total}', { n: idx + 1, total: _orderItems.length });

  _updateOrderPickNavButtons();

  const focusEl = document.getElementById(field === 'stock' ? 'f-order-pick-stock' : 'f-order-pick-qty');
  focusEl.focus();
  focusEl.select();
}

function _resolveQtyField(id) {
  const el = document.getElementById(id);
  if (el.value.trim() === '') return 0;
  const result = evalQtyExpr(el.value);
  const val    = result != null ? result : (parseFloat(el.value) || 0);
  return Math.max(0, val);
}

function _persistOrderPick() {
  const item = _orderItems[_orderPickIdx];
  if (!item) return;
  item.stock = _resolveQtyField('f-order-pick-stock');
  item.boxes = _resolveQtyField('f-order-pick-qty');
}

// En sortir del camp (blur), mostra el resultat de l'operació, com una calculadora.
export function resolveOrderPickDisplay(id) {
  const el = document.getElementById(id);
  if (!el || el.value.trim() === '') return;
  el.value = _resolveQtyField(id);
}

// Avança/retrocedeix pel recorregut Estoc → Comanda → Estoc (producte següent) → …
export function navOrderPick(delta) {
  _persistOrderPick();
  if (delta > 0) {
    if (_orderPickField === 'stock') {
      _loadOrderPick(_orderPickIdx, 'qty');
    } else if (_orderPickIdx < _orderItems.length - 1) {
      _loadOrderPick(_orderPickIdx + 1, 'stock');
    }
  } else {
    if (_orderPickField === 'qty') {
      _loadOrderPick(_orderPickIdx, 'stock');
    } else if (_orderPickIdx > 0) {
      _loadOrderPick(_orderPickIdx - 1, 'qty');
    }
  }
}

// Enter: avança Estoc → Comanda → Estoc del següent producte…; a la Comanda de
// l'últim producte, desa directament la comanda (com el modal de l'encarregat).
export function submitOrderPick() {
  const atLast = _orderPickField === 'qty' && _orderPickIdx >= _orderItems.length - 1;
  if (atLast) {
    _persistOrderPick();
    saveOrder();
  } else {
    navOrderPick(1);
  }
}

let _pastOrderMode = false;

export function openOrderModal(order = null, opts = {}) {
  _pastOrderMode = !!opts.past;
  state.editingOrderId = order?.id || null;
  document.getElementById('modal-order-title').textContent = _pastOrderMode
    ? t('Comanda anterior')
    : (order ? t('Editar comanda') : t('Nova comanda'));
  document.getElementById('btn-delete-order').hidden = !order;

  document.getElementById('f-order-ref').value      = order?.ref      ?? '';
  document.getElementById('f-order-date').value     = order?.date     ?? new Date().toISOString().slice(0, 10);
  document.getElementById('f-order-supplier').value = order?.supplier ?? '';
  document.getElementById('f-order-status').value   = order?.status   ?? (_pastOrderMode ? 'rebuda' : 'pendent');
  document.getElementById('f-order-notes').value    = order?.notes    ?? '';

  const pastFields   = document.getElementById('order-past-fields');
  const refField      = document.getElementById('order-ref-field');
  const supplierField = document.getElementById('order-supplier-field');
  pastFields.hidden      = !_pastOrderMode;
  refField.hidden         = _pastOrderMode;
  supplierField.hidden    = _pastOrderMode;
  if (_pastOrderMode) {
    const masiaSel = document.getElementById('f-order-masia');
    masiaSel.innerHTML = `<option value="">${t('Selecciona…')}</option>` +
      Object.entries(MASIA_LABELS).map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
    masiaSel.value = '';
    document.getElementById('f-order-adults').value = '';
  }

  const picker   = document.getElementById('order-product-picker');
  const descField = document.getElementById('order-desc-field');

  if (!order) {
    // Nova comanda (o comanda anterior) — recorre tots els productes d'un en un
    picker.hidden   = false;
    descField.hidden = true;
    _initOrderPickItems();
    _loadOrderPick(0);
  } else {
    // Editar comanda existent — mostra el camp de descripció
    picker.hidden   = true;
    descField.hidden = false;
    const structured = _parseStructuredDesc(order?.desc ?? '');
    const textarea   = document.getElementById('f-order-desc');
    const table      = document.getElementById('order-desc-table');
    const label      = document.getElementById('label-order-desc');
    if (structured) {
      textarea.hidden   = true;
      table.hidden      = false;
      table.innerHTML   = _buildDescTable(structured);
      label.textContent = t('Articles');
      label.removeAttribute('for');
    } else {
      textarea.hidden   = false;
      textarea.value    = order?.desc ?? '';
      table.hidden      = true;
      table.innerHTML   = '';
      label.textContent = t('Articles / Descripció *');
      label.setAttribute('for', 'f-order-desc');
    }
  }

  document.getElementById('modal-order').classList.add('open');
  const focusEl = document.getElementById(_pastOrderMode ? 'f-order-masia' : 'f-order-supplier');
  setTimeout(() => focusEl.focus(), 380);
}

export function openPastOrderModal() {
  openOrderModal(null, { past: true });
}

export function closeOrderModal() {
  document.getElementById('modal-order').classList.remove('open');
  state.editingOrderId = null;
  _pastOrderMode = false;
}

export function saveOrder() {
  const pickerVisible = !document.getElementById('order-product-picker').hidden;
  let desc;
  if (pickerVisible) {
    _persistOrderPick();
    const items = _orderItems.filter(i => (i.boxes || 0) > 0);
    if (!items.length) {
      const inp = document.getElementById('f-order-pick-qty');
      inp.focus();
      inp.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { inp.style.borderColor = ''; }, 1200);
      return;
    }
    desc = items.map(i => `${i.name}: ${i.boxes} c`).join(' | ');
  } else {
    const tableEl  = document.getElementById('order-desc-table');
    const useTable = !tableEl.hidden;
    desc = useTable
      ? _readDescFromTable()
      : document.getElementById('f-order-desc').value.trim();
    if (!useTable && !desc) {
      const el = document.getElementById('f-order-desc');
      el.focus();
      el.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { el.style.borderColor = ''; }, 1200);
      return;
    }
  }
  let masiaVal = '', adults = 0;
  if (_pastOrderMode) {
    masiaVal = document.getElementById('f-order-masia').value;
    adults   = parseInt(document.getElementById('f-order-adults').value) || 0;
    if (!masiaVal) {
      const sel = document.getElementById('f-order-masia');
      sel.focus();
      sel.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { sel.style.borderColor = ''; }, 1200);
      return;
    }
  }

  const data = {
    ref:       document.getElementById('f-order-ref').value.trim(),
    date:      document.getElementById('f-order-date').value,
    supplier:  _pastOrderMode ? (MASIA_LABELS[masiaVal] || '') : document.getElementById('f-order-supplier').value.trim(),
    status:    document.getElementById('f-order-status').value,
    desc,
    notes:     document.getElementById('f-order-notes').value.trim(),
    updatedAt: new Date().toISOString(),
    ...(_pastOrderMode ? { masia: masiaVal, adults } : {}),
  };
  if (state.editingOrderId) {
    const idx = state.orders.findIndex(o => o.id === state.editingOrderId);
    if (idx >= 0) {
      state.orders[idx] = { ...state.orders[idx], ...data };
      sendComandaToSheet(state.orders[idx], 'update-comanda');
    }
    toast(t('Comanda actualitzada'));
  } else {
    const createdBy = state.authProfile?.nom || state.user || '';
    const newOrder  = { id: uid(), createdAt: new Date().toISOString(), createdBy, ...data };
    state.orders.unshift(newOrder);
    sendComandaToSheet(newOrder, 'add-comanda');
    toast(t('Comanda afegida'));
  }
  saveOrders();
  closeOrderModal();
  renderOrders();
}

function _toastDeleteResult(result) {
  if (!result) return toast(t('Comanda eliminada'));
  const { reverted, skipped } = result;
  if (skipped.length) {
    toast(t("Comanda eliminada. No s'ha pogut revertir la mitjana de: {list} (ja s'han tornat a comandar)", { list: skipped.join(', ') }));
  } else if (reverted.length) {
    toast(t('Comanda eliminada i mitjana revertida ({n} producte{s})', { n: reverted.length, s: reverted.length !== 1 ? 's' : '' }));
  } else {
    toast(t('Comanda eliminada'));
  }
}

export function deleteOrder() {
  if (!state.editingOrderId) return;
  const o = state.orders.find(x => x.id === state.editingOrderId);
  if (!confirm(t('Eliminar la comanda{ref}?', { ref: o?.ref ? ' ' + o.ref : '' }))) return;
  const result = revertOrderMitja(o);
  _deleteSourceHistorial(o);
  deleteComandaFromSheet(o.id);
  state.orders = state.orders.filter(x => x.id !== state.editingOrderId);
  saveOrders();
  closeOrderModal();
  renderOrders();
  _toastDeleteResult(result);
}

const _statusCycle = ['pendent', 'en_curs', 'rebuda'];
export function cycleOrderStatus(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  const idx = _statusCycle.indexOf(o.status);
  o.status    = _statusCycle[(idx + 1) % _statusCycle.length];
  o.updatedAt = new Date().toISOString();
  saveOrders();
  renderOrders();
  sendComandaToSheet(o, 'update-comanda');
  toast(t('Estat: {status}', { status: t(STATUS_LABELS[o.status]) }));
}

export function deleteOrderDirect(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  if (!confirm(t('Eliminar la comanda{ref}?', { ref: o.ref ? ' ' + o.ref : '' }))) return;
  const result = revertOrderMitja(o);
  _deleteSourceHistorial(o);
  deleteComandaFromSheet(o.id);
  state.orders = state.orders.filter(x => x.id !== id);
  saveOrders();
  renderOrders();
  _toastDeleteResult(result);
}

// Agrupa els articles estructurats d'una comanda pel proveïdor de cada producte
// al catàleg (no pel camp "supplier" manual de la comanda, que és un sol text lliure).
function _groupItemsBySupplier(items) {
  const groups = new Map();
  items.forEach(item => {
    const product  = state.catalog.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    const supplier = (product?.supplier || '').trim() || t('Sense proveïdor assignat');
    if (!groups.has(supplier)) groups.set(supplier, []);
    groups.get(supplier).push(item);
  });
  return groups;
}

function _printComandaBlockHtml(o, today, supplier, items) {
  const bodyHtml = items
    ? `<table class="print-comanda-table">
        <thead><tr><th>${t('Producte')}</th><th>${t('Quantitat')}</th><th>${t('Notes')}</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${esc(item.name)}</td>
              <td class="tc">${item.qty} c</td>
              <td></td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td class="tr" colspan="1"><strong>${t('Total caixes:')}</strong></td>
            <td class="tc"><strong>${items.reduce((s, i) => s + i.qty, 0)} c</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>`
    : `<p style="font-size:11pt;line-height:1.7;margin:8mm 0">${esc(o.desc ?? '')}</p>`;

  return `
    <div class="print-comanda">
      <div class="print-comanda-header">
        <div>
          <h1 class="print-comanda-title">${t('Comanda')}</h1>
          <p class="print-comanda-org">UAUU Wedding &amp; Events</p>
        </div>
        <div class="print-comanda-info">
          <p><strong>${t('Proveïdor:')}</strong> ${esc(supplier)}</p>
          ${o.ref  ? `<p><strong>${t('Referència:')}</strong> ${esc(o.ref)}</p>`        : ''}
          ${o.date ? `<p><strong>${t('Data comanda:')}</strong> ${fmtDate(o.date)}</p>` : ''}
          <p><strong>${t('Data impressió:')}</strong> ${today}</p>
          ${o.createdBy ? `<p><strong>${t('Coordinador:')}</strong> ${esc(o.createdBy)}</p>` : ''}
        </div>
      </div>
      ${bodyHtml}
      ${o.notes ? `<p style="font-size:10pt;color:#555;margin-top:6mm"><em>${t('Notes:')} ${esc(o.notes)}</em></p>` : ''}
      <div class="print-comanda-sigs">
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>${t('Responsable')}</p></div>
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>${t('Proveïdor')}</p></div>
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>${t('Data lliurament')}</p></div>
      </div>
    </div>`;
}

export function printOrder(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;

  const today       = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const structured  = _parseStructuredDesc(o.desc ?? '');

  // Un document per proveïdor quan es poden distingir els articles; si la comanda
  // té una descripció de text lliure (no estructurada), no es pot separar per
  // proveïdor i s'imprimeix un únic document com fins ara.
  const blocksHtml = structured
    ? [..._groupItemsBySupplier(structured)].map(([supplier, items]) => _printComandaBlockHtml(o, today, supplier, items)).join('')
    : _printComandaBlockHtml(o, today, o.supplier || t('Sense proveïdor assignat'), null);

  document.getElementById('print-area').innerHTML = blocksHtml;

  window.print();
  setTimeout(() => { document.getElementById('print-area').innerHTML = ''; }, 1500);
}
