import { state, STATUS_LABELS, STATUS_CSS, saveOrders } from './config.js';
import { uid, esc, fmtDate, toast } from './helpers.js';

function _parseStructuredDesc(desc) {
  if (!desc || !desc.includes(': ') || !desc.includes(' u')) return null;
  const parts = desc.split(' | ');
  const items = parts.map(p => {
    const m = p.match(/^(.+):\s*(\d+(?:\.\d+)?)\s*u$/);
    return m ? { name: m[1].trim(), qty: parseFloat(m[2]) } : null;
  });
  return items.every(Boolean) && items.length > 0 ? items : null;
}

function _buildDescTable(items) {
  return items.map(item => `
    <div class="order-desc-row">
      <span class="order-desc-name">${esc(item.name)}</span>
      <label class="order-desc-qty-wrap">
        <input class="order-desc-qty" type="number" min="0" step="1"
               value="${item.qty}" data-name="${esc(item.name)}">
        <span class="order-desc-qty-unit">u</span>
      </label>
    </div>`).join('');
}

function _readDescFromTable() {
  const inputs = document.querySelectorAll('#order-desc-table .order-desc-qty');
  return Array.from(inputs)
    .map(inp => `${inp.dataset.name}: ${Math.max(0, parseFloat(inp.value) || 0)} u`)
    .join(' | ');
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

  list.innerHTML = orders.map(o => `
    <div class="order-card" data-id="${o.id}">
      <div class="order-card-top">
        <div class="order-card-meta">
          ${o.ref  ? `<span class="order-ref">${esc(o.ref)}</span>`   : ''}
          ${o.date ? `<span class="order-date">${fmtDate(o.date)}</span>` : ''}
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
  `).join('');
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

  const structured = _parseStructuredDesc(order?.desc ?? '');
  const textarea   = document.getElementById('f-order-desc');
  const table      = document.getElementById('order-desc-table');
  const label      = document.getElementById('label-order-desc');
  if (structured) {
    textarea.hidden    = true;
    table.hidden       = false;
    table.innerHTML    = _buildDescTable(structured);
    label.textContent  = 'Articles';
    label.removeAttribute('for');
  } else {
    textarea.hidden    = false;
    textarea.value     = order?.desc ?? '';
    table.hidden       = true;
    table.innerHTML    = '';
    label.textContent  = 'Articles / Descripció *';
    label.setAttribute('for', 'f-order-desc');
  }

  document.getElementById('modal-order').classList.add('open');
  setTimeout(() => document.getElementById('f-order-supplier').focus(), 380);
}

export function closeOrderModal() {
  document.getElementById('modal-order').classList.remove('open');
  state.editingOrderId = null;
}

export function saveOrder() {
  const tableEl = document.getElementById('order-desc-table');
  const useTable = !tableEl.hidden;
  const desc = useTable
    ? _readDescFromTable()
    : document.getElementById('f-order-desc').value.trim();
  if (!useTable && !desc) {
    const el = document.getElementById('f-order-desc');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
    return;
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
    state.orders.unshift({ id: uid(), createdAt: new Date().toISOString(), ...data });
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
              <td class="tc">${item.qty} u</td>
              <td></td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td class="tr" colspan="1"><strong>Total unitats:</strong></td>
            <td class="tc"><strong>${structured.reduce((s, i) => s + i.qty, 0)} u</strong></td>
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
          ${state.authProfile?.nom ? `<p><strong>Coordinador:</strong> ${esc(state.authProfile.nom)}</p>` : ''}
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
