'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────

const STORAGE_ITEMS = 'uauu_inv_items';
const STORAGE_CATS  = 'uauu_inv_cats';

const CAT_COLORS = [
  '#B8A99A', '#A4B5A8', '#B0B4C8', '#C8B0B0',
  '#C8C4B0', '#A8C4B8', '#CEB08C', '#B0B8A4',
];

const DEFAULT_CATS = [
  { id: 'cat_general', name: 'General', color: '#B8A99A' },
];

// ── STATE ──────────────────────────────────────────────────────────

const state = {
  items:       [],
  categories:  [],
  view:        'list',
  search:      '',
  filter:      null,
  editingId:   null,
  searchOpen:  false,
  selColor:    CAT_COLORS[0],
};

// ── STORAGE ────────────────────────────────────────────────────────

function loadData() {
  try {
    state.items      = JSON.parse(localStorage.getItem(STORAGE_ITEMS)) || [];
    state.categories = JSON.parse(localStorage.getItem(STORAGE_CATS))  || [...DEFAULT_CATS];
  } catch {
    state.items      = [];
    state.categories = [...DEFAULT_CATS];
  }
}

function saveItems() { localStorage.setItem(STORAGE_ITEMS, JSON.stringify(state.items)); }
function saveCats()  { localStorage.setItem(STORAGE_CATS,  JSON.stringify(state.categories)); }

// ── HELPERS ────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getCat(id) {
  return state.categories.find(c => c.id === id);
}

function filteredItems() {
  let list = state.items;
  if (state.filter) list = list.filter(i => i.category === state.filter);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q)
    );
  }
  return list;
}

function fmtNum(n) {
  if (n === 0) return '0';
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── TOAST ──────────────────────────────────────────────────────────

let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── RENDER ─────────────────────────────────────────────────────────

function render() {
  renderNav();
  renderStatsStrip();
  renderFilterPills();
  renderItems();
  if (state.view === 'stats') renderStats();
  if (state.view === 'cats')  renderCats();
}

function renderNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.hidden = panel.id !== `view-${state.view}`;
  });
  const fab = document.getElementById('btn-add');
  fab.hidden = (state.view !== 'list');
}

function renderStatsStrip() {
  const strip = document.getElementById('stats-strip');
  const total = state.items.length;
  const lowCount = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock && i.quantity > 0).length;
  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const totalVal = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);

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

function renderFilterPills() {
  const wrap = document.getElementById('filter-pills');
  const pills = [{ id: null, name: 'Tots' }, ...state.categories];
  wrap.innerHTML = pills.map(p => `
    <button class="filter-pill${state.filter === p.id ? ' active' : ''}"
            data-cat="${p.id ?? ''}">
      ${esc(p.name)}
    </button>
  `).join('');
}

function renderItems() {
  const grid  = document.getElementById('items-grid');
  const empty = document.getElementById('empty-state');
  const items = filteredItems();

  if (items.length === 0) {
    grid.innerHTML  = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = items.map(item => {
    const cat   = getCat(item.category);
    const isLow = item.minStock > 0 && item.quantity <= item.minStock;
    const isZero = item.quantity === 0;

    const catBadge = cat
      ? `<span class="item-cat-badge"
              style="color:${cat.color};border-color:${cat.color}55">
           ${esc(cat.name)}
         </span>`
      : '';

    return `
      <div class="item-card${isLow ? ' is-low' : ''}${isZero ? ' is-zero' : ''}"
           data-id="${item.id}">
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
                  ${item.quantity === 0 ? 'disabled' : ''}
                  aria-label="Reduir quantitat">−</button>
          <div class="qty-display">
            <span class="qty-value">${fmtNum(item.quantity)}</span>
            ${item.unit ? `<span class="qty-unit">${esc(item.unit)}</span>` : ''}
          </div>
          <button class="qty-btn" data-qty="${item.id}" data-delta="1"
                  aria-label="Augmentar quantitat">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  const totalVal = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);
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
      const totalQty = catItems.reduce((s, i) => s + i.quantity, 0);
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

function renderCats() {
  const wrap = document.getElementById('cat-manage-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="cat-view-header">
      <span class="cat-view-title">Categories</span>
      <button class="cat-new-btn" id="btn-new-cat">+ Nova</button>
    </div>
    ${state.categories.map(cat => {
      const count = state.items.filter(i => i.category === cat.id).length;
      return `
        <div class="cat-row">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="cat-name-text">${esc(cat.name)}</span>
          <span class="cat-count-badge">${count} ${count === 1 ? 'article' : 'articles'}</span>
          ${cat.id !== 'cat_general' ? `
            <button class="cat-delete-btn" data-del-cat="${cat.id}"
                    aria-label="Eliminar ${esc(cat.name)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
    }).join('')}
  `;

  document.getElementById('btn-new-cat')?.addEventListener('click', openCatModal);
}

// ── COLOR PICKER ───────────────────────────────────────────────────

function renderColorPicker() {
  const wrap = document.getElementById('color-picker');
  wrap.innerHTML = CAT_COLORS.map(c => `
    <button class="color-swatch${state.selColor === c ? ' active' : ''}"
            data-color="${c}"
            style="background:${c}"
            aria-label="Color ${c}"
            type="button"></button>
  `).join('');
}

// ── ITEM MODAL ─────────────────────────────────────────────────────

function openItemModal(item = null) {
  state.editingId = item?.id || null;

  document.getElementById('modal-item-title').textContent = item ? 'Editar article' : 'Nou article';
  document.getElementById('btn-delete-item').hidden = !item;

  const catSel = document.getElementById('f-category');
  catSel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join('');

  document.getElementById('f-name').value      = item?.name       ?? '';
  document.getElementById('f-quantity').value  = item != null     ? item.quantity  : '';
  document.getElementById('f-unit').value      = item?.unit       ?? '';
  document.getElementById('f-min-stock').value = item?.minStock   ? item.minStock  : '';
  document.getElementById('f-price').value     = item?.price      ? item.price     : '';
  document.getElementById('f-category').value  = item?.category   ?? state.categories[0]?.id ?? '';
  document.getElementById('f-notes').value     = item?.notes      ?? '';

  document.getElementById('modal-item').classList.add('open');
  requestAnimationFrame(() => {
    setTimeout(() => document.getElementById('f-name').focus(), 380);
  });
}

function closeItemModal() {
  document.getElementById('modal-item').classList.remove('open');
  state.editingId = null;
}

function saveItem() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) {
    document.getElementById('f-name').focus();
    document.getElementById('f-name').style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { document.getElementById('f-name').style.borderColor = ''; }, 1200);
    return;
  }

  const qty   = parseFloat(document.getElementById('f-quantity').value);
  const min   = parseFloat(document.getElementById('f-min-stock').value);
  const price = parseFloat(document.getElementById('f-price').value);

  const data = {
    name,
    quantity:  isNaN(qty)   ? 0 : Math.max(0, qty),
    unit:      document.getElementById('f-unit').value.trim(),
    minStock:  isNaN(min)   ? 0 : Math.max(0, min),
    price:     isNaN(price) ? 0 : Math.max(0, price),
    category:  document.getElementById('f-category').value,
    notes:     document.getElementById('f-notes').value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (state.editingId) {
    const idx = state.items.findIndex(i => i.id === state.editingId);
    if (idx >= 0) state.items[idx] = { ...state.items[idx], ...data };
    toast('Article actualitzat');
  } else {
    state.items.unshift({ id: uid(), createdAt: new Date().toISOString(), ...data });
    toast('Article afegit');
  }

  saveItems();
  closeItemModal();
  render();
}

function deleteItem() {
  if (!state.editingId) return;
  const item = state.items.find(i => i.id === state.editingId);
  if (!confirm(`Eliminar "${item?.name}"?`)) return;
  state.items = state.items.filter(i => i.id !== state.editingId);
  saveItems();
  closeItemModal();
  render();
  toast('Article eliminat');
}

// ── CATEGORY MODAL ─────────────────────────────────────────────────

function openCatModal() {
  state.selColor = CAT_COLORS[0];
  document.getElementById('f-cat-name').value = '';
  renderColorPicker();
  document.getElementById('modal-cat').classList.add('open');
  requestAnimationFrame(() => {
    setTimeout(() => document.getElementById('f-cat-name').focus(), 380);
  });
}

function closeCatModal() {
  document.getElementById('modal-cat').classList.remove('open');
}

function saveCat() {
  const name = document.getElementById('f-cat-name').value.trim();
  if (!name) {
    document.getElementById('f-cat-name').focus();
    document.getElementById('f-cat-name').style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { document.getElementById('f-cat-name').style.borderColor = ''; }, 1200);
    return;
  }
  state.categories.push({ id: 'cat_' + uid(), name, color: state.selColor });
  saveCats();
  closeCatModal();
  render();
  toast('Categoria creada');
}

function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!confirm(`Eliminar la categoria "${cat?.name}"?\nEls articles passaran a "General".`)) return;
  state.categories = state.categories.filter(c => c.id !== id);
  state.items.forEach(item => { if (item.category === id) item.category = 'cat_general'; });
  if (state.filter === id) state.filter = null;
  saveCats();
  saveItems();
  render();
  toast('Categoria eliminada');
}

// ── QUANTITY ───────────────────────────────────────────────────────

function updateQty(id, delta) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item.quantity  = Math.max(0, item.quantity + delta);
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderItems();
  renderStatsStrip();
}

// ── NAVIGATION ─────────────────────────────────────────────────────

function setView(view) {
  state.view = view;
  renderNav();
  if (view === 'stats') renderStats();
  if (view === 'cats')  renderCats();
}

// ── EVENT DELEGATION ───────────────────────────────────────────────

document.addEventListener('click', e => {
  // Edit button
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    const item = state.items.find(i => i.id === editBtn.dataset.edit);
    if (item) openItemModal(item);
    return;
  }

  // Quantity +/-
  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn && qtyBtn.dataset.delta) {
    updateQty(qtyBtn.dataset.qty, Number(qtyBtn.dataset.delta));
    return;
  }

  // Filter pill
  const pill = e.target.closest('.filter-pill[data-cat]');
  if (pill) {
    state.filter = pill.dataset.cat || null;
    renderFilterPills();
    renderItems();
    return;
  }

  // Delete category
  const delCat = e.target.closest('[data-del-cat]');
  if (delCat) {
    deleteCategory(delCat.dataset.delCat);
    return;
  }

  // Color swatch
  const swatch = e.target.closest('.color-swatch[data-color]');
  if (swatch) {
    state.selColor = swatch.dataset.color;
    renderColorPicker();
    return;
  }

  // Bottom nav tab
  const tab = e.target.closest('.nav-tab[data-view]');
  if (tab) {
    setView(tab.dataset.view);
    return;
  }

  // Close modals on backdrop click
  if (e.target.id === 'modal-item') { closeItemModal(); return; }
  if (e.target.id === 'modal-cat')  { closeCatModal();  return; }
});

// ── KEYBOARD ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-item').classList.contains('open')) { closeItemModal(); return; }
    if (document.getElementById('modal-cat').classList.contains('open'))  { closeCatModal();  return; }
    if (state.searchOpen) toggleSearch();
  }
});

// ── SEARCH ─────────────────────────────────────────────────────────

function toggleSearch() {
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

// ── INIT ───────────────────────────────────────────────────────────

function init() {
  loadData();
  render();

  document.getElementById('btn-search').addEventListener('click', toggleSearch);

  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    renderItems();
  });

  document.getElementById('btn-add').addEventListener('click', () => openItemModal());

  document.getElementById('btn-modal-close').addEventListener('click', closeItemModal);
  document.getElementById('btn-save-item').addEventListener('click', saveItem);
  document.getElementById('btn-delete-item').addEventListener('click', deleteItem);
  document.getElementById('item-form').addEventListener('submit', e => { e.preventDefault(); saveItem(); });

  document.getElementById('btn-cat-modal-close').addEventListener('click', closeCatModal);
  document.getElementById('btn-save-cat').addEventListener('click', saveCat);
  document.getElementById('cat-form').addEventListener('submit', e => { e.preventDefault(); saveCat(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
