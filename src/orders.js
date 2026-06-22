import { state, STATUS_LABELS, STATUS_CSS, saveOrders } from './config.js';
import { uid, esc, fmtDate, toast } from './helpers.js';

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
        <span class="order-status-badge ${STATUS_CSS[o.status] || ''}">
          ${esc(STATUS_LABELS[o.status] || o.status)}
        </span>
      </div>
      ${o.supplier ? `<div class="order-supplier">${esc(o.supplier)}</div>` : ''}
      ${o.desc     ? `<div class="order-desc">${esc(o.desc)}</div>`         : ''}
      <div class="order-card-footer">
        <span class="order-amount">${o.amount ? '€' + parseFloat(o.amount).toFixed(2) : ''}</span>
        <button class="order-edit-btn" data-edit-order="${o.id}" aria-label="Editar comanda">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
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
  document.getElementById('f-order-desc').value     = order?.desc     ?? '';
  document.getElementById('f-order-amount').value   = order?.amount   ?? '';
  document.getElementById('f-order-notes').value    = order?.notes    ?? '';

  document.getElementById('modal-order').classList.add('open');
  setTimeout(() => document.getElementById('f-order-supplier').focus(), 380);
}

export function closeOrderModal() {
  document.getElementById('modal-order').classList.remove('open');
  state.editingOrderId = null;
}

export function saveOrder() {
  const desc = document.getElementById('f-order-desc').value.trim();
  if (!desc) {
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
    amount:    parseFloat(document.getElementById('f-order-amount').value) || 0,
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
