import { state, STATUS_LABELS, STATUS_CSS, MASIA_COLORS, saveOrders } from './config.js';
import { uid, esc, fmtDate, toast } from './helpers.js';

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
        <button class="order-status-badge ${STATUS_CSS[o.status] || ''}" data-cycle-status="${o.id}" title="Clic per canviar estat">
          ${esc(STATUS_LABELS[o.status] || o.status)}
        </button>
      </div>
      ${o.supplier ? `<div class="order-supplier">${esc(o.supplier)}</div>` : ''}
      ${o.desc     ? `<div class="order-desc">${esc(o.desc)}</div>`         : ''}
      <div class="order-card-footer">
        <div class="order-card-actions">
          <button class="order-icon-btn" data-print-order="${o.id}" aria-label="Imprimir comanda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
          <button class="order-icon-btn" data-edit-order="${o.id}" aria-label="Editar comanda">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="order-icon-btn order-icon-btn--danger" data-delete-order-direct="${o.id}" aria-label="Eliminar comanda">
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

// ── PRODUCT PICKER (nova comanda) ────────────────────────────────────

let _orderItems = [];

function _updateOrderRowLow(row, item) {
  row.classList.toggle('is-low', item.minStock > 0 && item.boxes < item.minStock);
}

function _renderOrderProductList() {
  const el = document.getElementById('order-product-list');
  if (!el) return;
  if (!_orderItems.length) {
    el.innerHTML = `<p class="order-product-empty">Cap producte afegit</p>`;
    return;
  }
  el.innerHTML = _orderItems.map((item, i) => {
    const isLow  = item.minStock > 0 && item.boxes < item.minStock;
    const lowCls = isLow ? ' is-low' : '';
    return `
    <div class="order-product-row${lowCls}" data-idx="${i}">
      <span class="order-product-name">${esc(item.name)}</span>
      <div class="order-product-qty-group">
        <label class="order-product-qty-wrap">
          <input class="order-product-qty" type="number" min="0" step="1"
                 value="${item.boxes}" data-idx="${i}" data-field="boxes" placeholder="0">
          <span class="order-product-unit">c</span>
        </label>
      </div>
      <button class="order-product-remove" data-remove="${i}" aria-label="Treure">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  }).join('');

  el.querySelectorAll('.order-product-qty').forEach(inp => {
    inp.addEventListener('input', () => {
      const item = _orderItems[parseInt(inp.dataset.idx)];
      item.boxes = Math.max(0, parseFloat(inp.value) || 0);
      _updateOrderRowLow(inp.closest('.order-product-row'), item);
    });
  });
  el.querySelectorAll('.order-product-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _orderItems.splice(parseInt(btn.dataset.remove), 1);
      _renderOrderProductList();
    });
  });
}

function _initProductSearch() {
  const old = document.getElementById('f-order-product-search');
  if (!old) return;
  const input = old.cloneNode(true);
  old.replaceWith(input);
  const dropdown = document.getElementById('order-product-dropdown');
  if (!dropdown) return;

  input.value = '';
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.hidden = true; dropdown.innerHTML = ''; return; }
    const matches = state.catalog
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 8);
    if (!matches.length) { dropdown.hidden = true; return; }
    dropdown.hidden = false;
    dropdown.innerHTML = matches.map(p => {
      const minStock = p.minStock || 0;
      return `<div class="order-product-option"
          data-name="${esc(p.name)}"
          data-minstock="${minStock}">
          ${esc(p.name)}
        </div>`;
    }).join('');
    dropdown.querySelectorAll('.order-product-option').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const name     = opt.dataset.name;
        const minStock = parseFloat(opt.dataset.minstock) || 0;
        if (!_orderItems.find(i => i.name === name)) {
          _orderItems.push({ name, minStock, boxes: 1 });
          _renderOrderProductList();
        }
        input.value     = '';
        dropdown.hidden = true;
      });
    });
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });
}

export function openOrderModal(order = null) {
  state.editingOrderId = order?.id || null;
  document.getElementById('modal-order-title').textContent = order ? 'Editar comanda' : 'Nova comanda';
  document.getElementById('btn-delete-order').hidden = !order;

  document.getElementById('f-order-ref').value      = order?.ref      ?? '';
  document.getElementById('f-order-date').value     = order?.date     ?? new Date().toISOString().slice(0, 10);
  document.getElementById('f-order-supplier').value = order?.supplier ?? '';
  document.getElementById('f-order-status').value   = order?.status   ?? 'pendent';
  document.getElementById('f-order-notes').value    = order?.notes    ?? '';

  const picker   = document.getElementById('order-product-picker');
  const descField = document.getElementById('order-desc-field');

  if (!order) {
    // Nova comanda — mostra el selector de productes
    _orderItems = [];
    picker.hidden   = false;
    descField.hidden = true;
    _renderOrderProductList();
    _initProductSearch();
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
      label.textContent = 'Articles';
      label.removeAttribute('for');
    } else {
      textarea.hidden   = false;
      textarea.value    = order?.desc ?? '';
      table.hidden      = true;
      table.innerHTML   = '';
      label.textContent = 'Articles / Descripció *';
      label.setAttribute('for', 'f-order-desc');
    }
  }

  document.getElementById('modal-order').classList.add('open');
  setTimeout(() => document.getElementById('f-order-supplier').focus(), 380);
}

export function closeOrderModal() {
  document.getElementById('modal-order').classList.remove('open');
  state.editingOrderId = null;
}

export function saveOrder() {
  const pickerVisible = !document.getElementById('order-product-picker').hidden;
  let desc;
  if (pickerVisible) {
    const items = _orderItems.filter(i => (i.boxes || 0) > 0);
    if (!items.length) {
      const inp = document.getElementById('f-order-product-search');
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
  const data = {
    ref:       document.getElementById('f-order-ref').value.trim(),
    date:      document.getElementById('f-order-date').value,
    supplier:  document.getElementById('f-order-supplier').value.trim(),
    status:    document.getElementById('f-order-status').value,
    desc,
    notes:     document.getElementById('f-order-notes').value.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (state.editingOrderId) {
    const idx = state.orders.findIndex(o => o.id === state.editingOrderId);
    if (idx >= 0) state.orders[idx] = { ...state.orders[idx], ...data };
    toast('Comanda actualitzada');
  } else {
    const createdBy = state.authProfile?.nom || state.user || '';
    state.orders.unshift({ id: uid(), createdAt: new Date().toISOString(), createdBy, ...data });
    toast('Comanda afegida');
  }
  saveOrders();
  closeOrderModal();
  renderOrders();
}

export function deleteOrder() {
  if (!state.editingOrderId) return;
  const o = state.orders.find(x => x.id === state.editingOrderId);
  if (!confirm(`Eliminar la comanda${o?.ref ? ' ' + o.ref : ''}?`)) return;
  state.orders = state.orders.filter(x => x.id !== state.editingOrderId);
  saveOrders();
  closeOrderModal();
  renderOrders();
  toast('Comanda eliminada');
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
  toast(`Estat: ${STATUS_LABELS[o.status]}`);
}

export function deleteOrderDirect(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`Eliminar la comanda${o.ref ? ' ' + o.ref : ''}?`)) return;
  state.orders = state.orders.filter(x => x.id !== id);
  saveOrders();
  renderOrders();
  toast('Comanda eliminada');
}

export function printOrder(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;

  const today   = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const structured = _parseStructuredDesc(o.desc ?? '');

  const bodyHtml = structured
    ? `<table class="print-comanda-table">
        <thead><tr><th>Producte</th><th>Quantitat</th><th>Notes</th></tr></thead>
        <tbody>
          ${structured.map(item => `
            <tr>
              <td>${esc(item.name)}</td>
              <td class="tc">${item.qty} c</td>
              <td></td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td class="tr" colspan="1"><strong>Total caixes:</strong></td>
            <td class="tc"><strong>${structured.reduce((s, i) => s + i.qty, 0)} c</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>`
    : `<p style="font-size:11pt;line-height:1.7;margin:8mm 0">${esc(o.desc ?? '')}</p>`;

  document.getElementById('print-area').innerHTML = `
    <div class="print-comanda">
      <div class="print-comanda-header">
        <div>
          <h1 class="print-comanda-title">Comanda</h1>
          <p class="print-comanda-org">UAUU Wedding &amp; Events</p>
        </div>
        <div class="print-comanda-info">
          ${o.ref  ? `<p><strong>Referència:</strong> ${esc(o.ref)}</p>`        : ''}
          ${o.date ? `<p><strong>Data comanda:</strong> ${fmtDate(o.date)}</p>` : ''}
          <p><strong>Data impressió:</strong> ${today}</p>
          ${o.createdBy ? `<p><strong>Coordinador:</strong> ${esc(o.createdBy)}</p>` : ''}
        </div>
      </div>
      ${bodyHtml}
      ${o.notes ? `<p style="font-size:10pt;color:#555;margin-top:6mm"><em>Notes: ${esc(o.notes)}</em></p>` : ''}
      <div class="print-comanda-sigs">
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>Responsable</p></div>
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>Proveïdor</p></div>
        <div class="print-comanda-sig"><div class="print-comanda-sig-line"></div><p>Data lliurament</p></div>
      </div>
    </div>`;

  window.print();
  setTimeout(() => { document.getElementById('print-area').innerHTML = ''; }, 1500);
}
