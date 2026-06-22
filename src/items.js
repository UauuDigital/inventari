import { state, CAT_COLORS, saveItems, saveCats } from './config.js';
import { uid, esc, fmtNum, toast } from './helpers.js';
import { render, renderItems } from './main.js';
import { renderStatsStrip } from './stats.js';

// ── CATEGORIES ───────────────────────────────────────────────────────

export function ensureCategory(name) {
  if (!name) return state.categories[0]?.id || 'cat_general';
  let cat = state.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) {
    cat = { id: 'cat_' + uid(), name, color: CAT_COLORS[state.categories.length % CAT_COLORS.length] };
    state.categories.push(cat);
    saveCats();
  }
  return cat.id;
}

export function renderCats() {
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

export function renderColorPicker() {
  const wrap = document.getElementById('color-picker');
  wrap.innerHTML = CAT_COLORS.map(c => `
    <button class="color-swatch${state.selColor === c ? ' active' : ''}"
            data-color="${c}"
            style="background:${c}"
            aria-label="Color ${c}"
            type="button"></button>
  `).join('');
}

export function openCatModal() {
  state.selColor = CAT_COLORS[0];
  document.getElementById('f-cat-name').value = '';
  renderColorPicker();
  document.getElementById('modal-cat').classList.add('open');
  requestAnimationFrame(() => {
    setTimeout(() => document.getElementById('f-cat-name').focus(), 380);
  });
}

export function closeCatModal() {
  document.getElementById('modal-cat').classList.remove('open');
}

export function saveCat() {
  const name = document.getElementById('f-cat-name').value.trim();
  if (!name) {
    const el = document.getElementById('f-cat-name');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
    return;
  }
  state.categories.push({ id: 'cat_' + uid(), name, color: state.selColor });
  saveCats();
  closeCatModal();
  render();
  toast('Categoria creada');
}

export function deleteCategory(id) {
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

// ── ITEMS ────────────────────────────────────────────────────────────

export function openItemModal(item = null) {
  state.editingId = item?.id || null;

  document.getElementById('modal-item-title').textContent = item ? 'Editar article' : 'Nou article';
  document.getElementById('btn-delete-item').hidden = !item;

  const catSel = document.getElementById('f-category');
  catSel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join('');

  document.getElementById('f-name').value      = item?.name     ?? '';
  document.getElementById('f-quantity').value  = item != null   ? item.quantity : '';
  document.getElementById('f-unit').value      = item?.unit     ?? '';
  document.getElementById('f-min-stock').value = item?.minStock ? item.minStock : '';
  document.getElementById('f-price').value     = item?.price    ? item.price    : '';
  document.getElementById('f-category').value  = item?.category ?? state.categories[0]?.id ?? '';
  document.getElementById('f-notes').value     = item?.notes    ?? '';

  document.getElementById('modal-item').classList.add('open');
  requestAnimationFrame(() => {
    setTimeout(() => document.getElementById('f-name').focus(), 380);
  });
}

export function closeItemModal() {
  document.getElementById('modal-item').classList.remove('open');
  state.editingId = null;
}

export function saveItem() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) {
    const el = document.getElementById('f-name');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
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

export function deleteItem() {
  if (!state.editingId) return;
  const item = state.items.find(i => i.id === state.editingId);
  if (!confirm(`Eliminar "${item?.name}"?`)) return;
  state.items = state.items.filter(i => i.id !== state.editingId);
  saveItems();
  closeItemModal();
  render();
  toast('Article eliminat');
}

// ── QUANTITY BUTTONS ─────────────────────────────────────────────────

export function updateQty(id, delta) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item.quantity  = Math.max(0, item.quantity + delta);
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderItems();
  renderStatsStrip();
}
