import { state, loadData } from './config.js';
import { getCat, filteredItems, fmtNum, esc, drainOfflineQueue } from './helpers.js';
import { initUserScreen, showUserScreen, handleLoginSubmit } from './auth.js';
import {
  openItemModal, closeItemModal, saveItem, deleteItem,
  openCatModal,  closeCatModal,  saveCat,  deleteCategory,
  renderCats, renderColorPicker, updateQty,
} from './items.js';
import {
  loadCatalog, initCatalogSearch, renderCatalogView,
  openScanModal, closeScanModal,
  openQtyModal,  closeQtyModal,  saveQty,
  openGasModal,  closeGasModal,  saveGasUrl, testGasUrl,
  openNewProductModal, closeNewProductModal, saveNewProduct,
} from './catalog.js';
import { renderOrders, openOrderModal, closeOrderModal, saveOrder, deleteOrder } from './orders.js';
import { processImportFile, confirmImport, openImportModal, closeImportModal } from './import.js';
import {
  openUserModal, closeUserModal, saveUser, deleteUser,
  renderUsers, updateUserMasiaVisibility,
} from './users.js';
import { renderStats, renderStatsStrip, renderReports, sendInventoryReport } from './stats.js';

// ── RENDER ───────────────────────────────────────────────────────────

export function renderNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.hidden = panel.id !== `view-${state.view}`;
  });

  const fab      = document.getElementById('btn-add');
  const fabLabel = fab.querySelector('span:last-child');
  if (state.view === 'orders')  { fab.hidden = false; fabLabel.textContent = 'Nova comanda'; }
  else if (state.view === 'list')    { fab.hidden = false; fabLabel.textContent = 'Nou article'; }
  else if (state.view === 'catalog') { fab.hidden = false; fabLabel.textContent = 'Nou producte'; }
  else if (state.view === 'users')   { fab.hidden = false; fabLabel.textContent = 'Nou usuari'; }
  else { fab.hidden = true; }
}

export function renderFilterPills() {
  const wrap  = document.getElementById('filter-pills');
  const pills = [{ id: null, name: 'Tots' }, ...state.categories];
  wrap.innerHTML = pills.map(p => `
    <button class="filter-pill${state.filter === p.id ? ' active' : ''}"
            data-cat="${p.id ?? ''}">
      ${esc(p.name)}
    </button>
  `).join('');
}

export function renderItems() {
  const grid  = document.getElementById('items-grid');
  const empty = document.getElementById('empty-state');
  const items = filteredItems();

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.hidden   = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = items.map(item => {
    const cat    = getCat(item.category);
    const isLow  = item.minStock > 0 && item.quantity <= item.minStock;
    const isZero = item.quantity === 0;

    const catBadge = cat
      ? `<span class="item-cat-badge" style="color:${cat.color};border-color:${cat.color}55">${esc(cat.name)}</span>`
      : '';

    return `
      <div class="item-card${isLow ? ' is-low' : ''}${isZero ? ' is-zero' : ''}" data-id="${item.id}">
        <div class="item-card-top">
          <span class="item-name">${esc(item.name)}</span>
          <button class="item-edit-btn" data-edit="${item.id}" aria-label="Editar ${esc(item.name)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        ${catBadge}
        <div class="item-card-qty">
          <button class="qty-btn" data-qty="${item.id}" data-delta="-1"
                  ${item.quantity === 0 ? 'disabled' : ''} aria-label="Reduir quantitat">−</button>
          <div class="qty-display">
            <span class="qty-value">${fmtNum(item.quantity)}</span>
            ${item.unit ? `<span class="qty-unit">${esc(item.unit)}</span>` : ''}
          </div>
          <button class="qty-btn" data-qty="${item.id}" data-delta="1" aria-label="Augmentar quantitat">+</button>
        </div>
      </div>
    `;
  }).join('');
}

export function render() {
  renderNav();
  renderStatsStrip();
  renderFilterPills();
  renderItems();
  if (state.view === 'stats') renderStats();
  if (state.view === 'cats')  renderCats();
}

// ── NAVIGATION ───────────────────────────────────────────────────────

export function setView(view) {
  state.view = view;
  renderNav();
  if (view === 'stats')   renderStats();
  if (view === 'cats')    renderCats();
  if (view === 'orders')  renderOrders();
  if (view === 'catalog') renderCatalogView();
  if (view === 'reports') renderReports();
  if (view === 'users')   renderUsers();
}

export function toggleSearch() {
  state.searchOpen = !state.searchOpen;
  document.getElementById('search-bar').classList.toggle('open', state.searchOpen);
  document.getElementById('btn-search').classList.toggle('active', state.searchOpen);
  if (state.searchOpen) {
    setTimeout(() => document.getElementById('search-input').focus(), 280);
  } else {
    state.search = '';
    document.getElementById('search-input').value = '';
    renderItems();
  }
}

// ── EVENT DELEGATION ─────────────────────────────────────────────────

document.addEventListener('click', e => {
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    const item = state.items.find(i => i.id === editBtn.dataset.edit);
    if (item) openItemModal(item);
    return;
  }

  const editOrder = e.target.closest('[data-edit-order]');
  if (editOrder) {
    const o = state.orders.find(x => x.id === editOrder.dataset.editOrder);
    if (o) openOrderModal(o);
    return;
  }

  const editUser = e.target.closest('[data-edit-user]');
  if (editUser) {
    const u = (state.usersCache || []).find(x => x.id === editUser.dataset.editUser);
    if (u) openUserModal(u);
    return;
  }

  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn && qtyBtn.dataset.delta) {
    updateQty(qtyBtn.dataset.qty, Number(qtyBtn.dataset.delta));
    return;
  }

  const pill = e.target.closest('#filter-pills .filter-pill');
  if (pill) {
    state.filter = pill.dataset.cat || null;
    renderFilterPills();
    renderItems();
    return;
  }

  const orderPill = e.target.closest('#orders-filter-strip .filter-pill');
  if (orderPill) {
    state.orderFilter = orderPill.dataset.status;
    renderOrders();
    return;
  }

  const delCat = e.target.closest('[data-del-cat]');
  if (delCat) { deleteCategory(delCat.dataset.delCat); return; }

  const swatch = e.target.closest('.color-swatch[data-color]');
  if (swatch) { state.selColor = swatch.dataset.color; renderColorPicker(); return; }

  if (e.target.closest('[data-action="send-report"]')) { sendInventoryReport(); return; }

  const tab = e.target.closest('.nav-tab[data-view]');
  if (tab) { setView(tab.dataset.view); return; }

  if (e.target.closest('#btn-scan-barcode')) { openScanModal(); return; }

  const catalogBtn = e.target.closest('.catalog-btn[data-catalog]');
  if (catalogBtn) { openQtyModal(parseInt(catalogBtn.dataset.catalog)); return; }

  if (e.target.id === 'modal-item')        { closeItemModal();       return; }
  if (e.target.id === 'modal-cat')         { closeCatModal();        return; }
  if (e.target.id === 'modal-order')       { closeOrderModal();      return; }
  if (e.target.id === 'modal-user')        { closeUserModal();       return; }
  if (e.target.id === 'modal-import')      { closeImportModal();     return; }
  if (e.target.id === 'modal-qty')         { closeQtyModal();        return; }
  if (e.target.id === 'modal-new-product') { closeNewProductModal(); return; }
  if (e.target.id === 'modal-gas')         { closeGasModal();        return; }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modal-item').classList.contains('open'))        { closeItemModal();       return; }
  if (document.getElementById('modal-cat').classList.contains('open'))         { closeCatModal();        return; }
  if (document.getElementById('modal-order').classList.contains('open'))       { closeOrderModal();      return; }
  if (document.getElementById('modal-user').classList.contains('open'))        { closeUserModal();       return; }
  if (document.getElementById('modal-import').classList.contains('open'))      { closeImportModal();     return; }
  if (document.getElementById('modal-qty').classList.contains('open'))         { closeQtyModal();        return; }
  if (document.getElementById('modal-new-product').classList.contains('open')) { closeNewProductModal(); return; }
  if (document.getElementById('modal-gas').classList.contains('open'))         { closeGasModal();        return; }
  if (document.getElementById('modal-scan').classList.contains('open'))        { closeScanModal();       return; }
  if (state.searchOpen) toggleSearch();
});

// ── INIT ─────────────────────────────────────────────────────────────

function init() {
  loadData();
  render();
  initUserScreen();
  drainOfflineQueue();
  window.addEventListener('online', drainOfflineQueue);
  document.getElementById('btn-logout').addEventListener('click', showUserScreen);

  document.getElementById('btn-search').addEventListener('click', toggleSearch);
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    renderItems();
  });

  document.getElementById('btn-add').addEventListener('click', () => {
    if (state.view === 'orders')       openOrderModal();
    else if (state.view === 'catalog') openNewProductModal();
    else if (state.view === 'users')   openUserModal();
    else                               openItemModal();
  });

  // Modal article
  document.getElementById('btn-modal-close').addEventListener('click', closeItemModal);
  document.getElementById('btn-save-item').addEventListener('click', saveItem);
  document.getElementById('btn-delete-item').addEventListener('click', deleteItem);
  document.getElementById('item-form').addEventListener('submit', e => { e.preventDefault(); saveItem(); });

  // Modal categoria
  document.getElementById('btn-cat-modal-close').addEventListener('click', closeCatModal);
  document.getElementById('btn-save-cat').addEventListener('click', saveCat);
  document.getElementById('cat-form').addEventListener('submit', e => { e.preventDefault(); saveCat(); });

  // Modal comanda
  document.getElementById('btn-order-modal-close').addEventListener('click', closeOrderModal);
  document.getElementById('btn-save-order').addEventListener('click', saveOrder);
  document.getElementById('btn-delete-order').addEventListener('click', deleteOrder);
  document.getElementById('order-form').addEventListener('submit', e => { e.preventDefault(); saveOrder(); });

  // Modal usuari (Admin)
  document.getElementById('btn-user-modal-close').addEventListener('click', closeUserModal);
  document.getElementById('btn-save-user').addEventListener('click', saveUser);
  document.getElementById('btn-delete-user').addEventListener('click', deleteUser);
  document.getElementById('f-user-rol').addEventListener('change', updateUserMasiaVisibility);
  document.getElementById('user-form').addEventListener('submit', e => { e.preventDefault(); saveUser(); });

  // Modal escàner
  document.getElementById('btn-scan-close').addEventListener('click', closeScanModal);

  // Modal configuració GAS
  document.getElementById('btn-gas-config').addEventListener('click', openGasModal);
  document.getElementById('btn-gas-close').addEventListener('click', closeGasModal);
  document.getElementById('btn-save-gas').addEventListener('click', saveGasUrl);
  document.getElementById('btn-test-gas').addEventListener('click', testGasUrl);
  document.getElementById('gas-form').addEventListener('submit', e => { e.preventDefault(); saveGasUrl(); });

  // Modal nou producte
  document.getElementById('btn-np-close').addEventListener('click', closeNewProductModal);
  document.getElementById('btn-save-new-product').addEventListener('click', saveNewProduct);
  document.getElementById('new-product-form').addEventListener('submit', e => { e.preventDefault(); saveNewProduct(); });

  // Modal quantitat
  document.getElementById('btn-qty-close').addEventListener('click', closeQtyModal);
  document.getElementById('btn-save-qty').addEventListener('click', saveQty);
  document.getElementById('qty-form').addEventListener('submit', e => { e.preventDefault(); saveQty(); });

  // Modal importació
  document.getElementById('btn-import-excel').addEventListener('click', openImportModal);
  document.getElementById('btn-import-close').addEventListener('click', closeImportModal);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

  const dropZone  = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('f-import-file');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    dropZone.querySelector('.file-drop-label').textContent = file.name;
    try {
      await processImportFile(file);
    } catch (err) {
      document.getElementById('import-preview').innerHTML =
        `<p style="padding:12px;font-size:13px;color:rgba(176,32,32,0.75)">${esc(err.message)}</p>`;
      document.getElementById('import-preview').hidden    = false;
      document.getElementById('btn-confirm-import').hidden = true;
    }
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    dropZone.querySelector('.file-drop-label').textContent = file.name;
    try {
      await processImportFile(file);
    } catch (err) {
      document.getElementById('import-preview').innerHTML =
        `<p style="padding:12px;font-size:13px;color:rgba(176,32,32,0.75)">${esc(err.message)}</p>`;
      document.getElementById('import-preview').hidden    = false;
      document.getElementById('btn-confirm-import').hidden = true;
    }
  });

  loadCatalog();
  initCatalogSearch();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
