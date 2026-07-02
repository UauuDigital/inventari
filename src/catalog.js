import {
  CATALOG_URL, OPEN_FOOD_FACTS_URL, SHEET_APPEND_URL, STORAGE_CAT_EXTRA, STORAGE_CAT_EDITS,
  state, saveItems,
} from './config.js';
import { uid, esc, fmtNum, fmtQtyDisplay, toast, parseCSV, findCol, sendToSheet, createTagSearch, matchesTags } from './helpers.js';
import { ensureCategory } from './items.js';

let _catalogTags    = [];
let _scanFillTarget  = null;
let _pendingCreate   = null;

// ── CATALOG LOAD ─────────────────────────────────────────────────────

export async function loadCatalog() {
  if (state.catalogReady) return;
  try {
    const res  = await fetch(CATALOG_URL + '&t=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return;

    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    const iId    = headers.indexOf('id');
    const iName  = findCol(headers, ['producte', 'nom', 'name', 'article']);
    const iCat   = findCol(headers, ['categoria', 'category', 'cat']);
    const iSupp  = findCol(headers, ['proveidor', 'proveedor', 'proveïdor', 'supplier', 'prove']);
    const iCode  = findCol(headers, ['codi', 'code', 'barcode', 'ean', 'upc']);
    const iMin   = findCol(headers, ['min', 'mínim', 'minim', 'min stock', 'estoc mínim']);
    const iUnit  = findCol(headers, ['unitat', 'unit', 'tipus']);
    const iUpB   = findCol(headers, ['unitspercaixa', 'u/caixa', 'unitxbox', 'per_caixa']);
    const iMitja = findCol(headers, ['mitja', 'mitjana', 'media', 'average']);

    state.catalog = rows.slice(1)
      .filter(r => String(r[iName] ?? '').trim())
      .map(r => {
        let avgQty = 0, numCom = 0;
        if (iMitja >= 0) {
          const mitjaStr = String(r[iMitja] ?? '').trim();
          const parts    = mitjaStr.split(',');
          avgQty = parseFloat(String(parts[0] ?? '0').replace(',', '.').trim()) || 0;
          numCom = parseInt(String(parts[1]  ?? '0').trim()) || 0;
        }
        return {
          id:          parseInt(String(r[iId] ?? '0')) || 0,
          code:        String(r[iCode]  ?? '').trim(),
          name:        String(r[iName]  ?? '').trim(),
          category:    String(r[iCat]   ?? '').trim(),
          supplier:    String(r[iSupp]  ?? '').trim(),
          minStock:    parseFloat(String(r[iMin]  ?? '0').replace(',', '.')) || 0,
          unit:        iUnit >= 0 ? String(r[iUnit] ?? '').trim() : '',
          unitsPerBox: iUpB  >= 0 ? parseFloat(String(r[iUpB]  ?? '0').replace(',', '.')) || 0 : 0,
          avgQty,
          numCom,
        };
      });

    state.maxCatalogId = state.catalog.reduce((max, p) => Math.max(max, p.id || 0), 0);

    // Apply local edits (overrides for products from the main sheet)
    const catalogEdits = JSON.parse(localStorage.getItem(STORAGE_CAT_EDITS) || '{}');
    if (Object.keys(catalogEdits).length > 0) {
      state.catalog = state.catalog.map(p => {
        const e = catalogEdits[p.id];
        return e ? { ...p, ...e } : p;
      });
    }

    state.catalogReady = true;
  } catch {
    /* offline o sheet privat */
  }

  if (state.catalogExtra.length > 0) {
    const sheetNames = new Set(state.catalog.map(p => p.name.toLowerCase()));
    const fresh = state.catalogExtra.filter(p => !sheetNames.has(p.name.toLowerCase()));
    // Remove from catalogExtra items that were deleted from the sheet
    if (fresh.length !== state.catalogExtra.length) {
      state.catalogExtra = fresh;
      localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(fresh));
    }
    state.catalog = [...state.catalog, ...fresh];
    fresh.forEach(p => { if ((p.id || 0) > state.maxCatalogId) state.maxCatalogId = p.id; });
    if (fresh.length > 0) state.catalogReady = true;
  }
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────────────

let _ddResults = [];
let _ddIdx     = -1;

function highlightMatch(text, query) {
  if (!query) return esc(text);
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

function openProductDropdown(results, query) {
  _ddResults = results;
  _ddIdx     = -1;
  const dd = document.getElementById('product-dropdown');
  if (!dd) return;

  if (results.length === 0) {
    dd.innerHTML = `<p class="product-dd-empty">Sense coincidències</p>`;
    dd.hidden = false;
    return;
  }

  dd.innerHTML = results.map((p, i) => `
    <div class="product-dd-item" data-dd="${i}" role="option" tabindex="-1">
      <span class="product-dd-name">${highlightMatch(p.name, query)}</span>
      ${p.category ? `<span class="product-dd-cat">${esc(p.category)}</span>` : ''}
    </div>
  `).join('');
  dd.hidden = false;
}

function closeProductDropdown() {
  const dd = document.getElementById('product-dropdown');
  if (dd) dd.hidden = true;
  _ddResults = [];
  _ddIdx     = -1;
}

function moveDDHighlight(dir) {
  _ddIdx = Math.max(-1, Math.min(_ddIdx + dir, _ddResults.length - 1));
  document.querySelectorAll('.product-dd-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === _ddIdx);
    if (i === _ddIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function selectCatalogProduct(product) {
  document.getElementById('f-name').value = product.name;

  const catId = ensureCategory(product.category);
  const catSel = document.getElementById('f-category');
  catSel.innerHTML = state.categories
    .map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  catSel.value = catId;

  closeProductDropdown();
  document.getElementById('f-quantity').focus();
}

export function initCatalogSearch() {
  const input = document.getElementById('f-name');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!state.catalogReady) {
      if (q.length >= 2) {
        const dd = document.getElementById('product-dropdown');
        dd.innerHTML = `<p class="product-dd-loading">Carregant catàleg…</p>`;
        dd.hidden = false;
        loadCatalog().then(() => {
          const results = state.catalog.filter(p =>
            p.name.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 8);
          openProductDropdown(results, q);
        });
      }
      return;
    }
    if (q.length < 2) { closeProductDropdown(); return; }
    const results = state.catalog
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
    openProductDropdown(results, q);
  });

  input.addEventListener('keydown', e => {
    if (_ddResults.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveDDHighlight(1);  return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); moveDDHighlight(-1); return; }
    if (e.key === 'Enter' && _ddIdx >= 0) { e.preventDefault(); selectCatalogProduct(_ddResults[_ddIdx]); return; }
    if (e.key === 'Escape')     { closeProductDropdown(); }
  });

  document.getElementById('product-dropdown').addEventListener('mousedown', e => {
    const item = e.target.closest('.product-dd-item[data-dd]');
    if (item) {
      e.preventDefault();
      selectCatalogProduct(_ddResults[parseInt(item.dataset.dd)]);
    }
  });

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.product-search-wrap')) closeProductDropdown();
  }, true);
}

// ── BARCODE SCANNER ──────────────────────────────────────────────────

let _html5QrLoaded = false;

function loadHtml5QrCode() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload  = () => { _html5QrLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("No s'ha pogut carregar l'escàner."));
    document.head.appendChild(s);
  });
}

export async function openScanModalForField(fieldId) {
  _scanFillTarget = fieldId;
  await openScanModal();
}

export async function openScanModal() {
  document.getElementById('modal-scan').classList.add('open');
  document.getElementById('scan-status-text').textContent = 'Apunta la càmera al codi de barres';

  try {
    await loadHtml5QrCode();
  } catch {
    document.getElementById('scan-status-text').textContent = "Error carregant l'escàner. Comprova la connexió.";
    return;
  }

  try {
    state.scannerInstance = new Html5Qrcode('barcode-reader');
    await state.scannerInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 100 } },
      (code) => handleBarcode(code),
      () => {}
    );
  } catch {
    document.getElementById('scan-status-text').textContent = "No s'ha pogut accedir a la càmera.";
  }
}

export async function closeScanModal() {
  document.getElementById('modal-scan').classList.remove('open');
  document.getElementById('barcode-reader').hidden = false;
  document.getElementById('scan-result').hidden     = true;
  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = 'Apunta la càmera al codi';
  _pendingCreate  = null;
  _scanFillTarget = null;
  if (state.scannerInstance) {
    try {
      await state.scannerInstance.stop();
      state.scannerInstance.clear();
    } catch {}
    state.scannerInstance = null;
  }
}

export function scanCreateProduct() {
  const data = _pendingCreate;
  _pendingCreate = null;
  closeScanModal();
  if (data) openNewProductModal(data);
}

async function lookupOpenFoodFacts(code) {
  try {
    const res  = await fetch(`${OPEN_FOOD_FACTS_URL}${code}.json`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = (p.product_name_ca || p.product_name_es || p.product_name || '').trim();
    if (!name) return null;
    const rawCat = (p.categories || '').split(',')[0].trim();
    return {
      name,
      category: rawCat.replace(/^[a-z]{2}:/, ''),
      supplier: (p.brands || '').split(',')[0].trim(),
    };
  } catch {
    return null;
  }
}

async function handleBarcode(code) {
  if (state.scannerInstance) {
    try { await state.scannerInstance.stop(); state.scannerInstance.clear(); state.scannerInstance = null; } catch {}
  }

  if (_scanFillTarget) {
    const el = document.getElementById(_scanFillTarget);
    if (el) el.value = code;
    _scanFillTarget = null;
    closeScanModal();
    return;
  }

  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = 'Buscant producte…';

  const localIdx = state.catalog.findIndex(p => p.code && p.code === code);
  if (localIdx >= 0) {
    closeScanModal();
    toast(`Trobat: ${state.catalog[localIdx].name}`);
    openQtyModal(localIdx);
    return;
  }

  const offProduct = await lookupOpenFoodFacts(code);

  document.getElementById('barcode-reader').hidden = true;
  document.getElementById('scan-result').hidden     = false;
  const msgEl = document.getElementById('scan-result-msg');

  if (offProduct) {
    _pendingCreate = { ...offProduct, code };
    msgEl.textContent = `"${offProduct.name}" no és al nostre catàleg però existeix a la base de dades pública. Vols afegir-lo?`;
  } else {
    _pendingCreate = { code };
    msgEl.textContent = `El codi ${code} no és al nostre catàleg. Vols crear un producte nou a partir d'aquest codi?`;
  }
}

// ── CATALOG VIEW (Comensal) ──────────────────────────────────────────

export function renderCatalogView() {
  const panel = document.getElementById('view-catalog');
  if (!panel) return;

  if (!state.catalogReady) {
    panel.innerHTML = '<div class="catalog-loading">Carregant catàleg…</div>';
    loadCatalog()
      .then(() => renderCatalogView())
      .catch(() => {
        panel.innerHTML = "<div class=\"catalog-empty\">No s'ha pogut carregar el catàleg.<br>Comprova la connexió a internet.</div>";
      });
    return;
  }

  if (state.catalog.length === 0) {
    panel.innerHTML = '<div class="catalog-empty">Cap producte al catàleg.</div>';
    return;
  }

  const role     = document.body.dataset.role || 'comensal';
  const isEditor = role === 'admin' || role === 'coordinador';

  _catalogTags = [];

  const groups = new Map();
  state.catalog.forEach((p, i) => {
    const cat = p.category || 'Sense categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ p, i });
  });

  const editSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  const html = [`<div class="catalog-list">`];

  html.push(`<div id="catalog-tag-search"></div>`);
  if (!isEditor) {
    html.push(`
      <button class="catalog-scan-btn" id="btn-scan-barcode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/>
          <line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="17" y1="12" x2="17" y2="12.01"/>
        </svg>
        Escaneja codi de barres
      </button>
    `);
  }

  groups.forEach((entries, catName) => {
    html.push(`<div class="catalog-section-title" data-section="${esc(catName)}">${esc(catName)}</div>`);
    entries.forEach(({ p, i }) => {
      const searchVal = [p.name, p.category, p.supplier].filter(Boolean).join(' ').toLowerCase();
      if (isEditor) {
        html.push(`
          <div class="catalog-btn catalog-edit-row" data-search="${esc(searchVal)}">
            <span class="catalog-btn-name">${esc(p.name)}</span>
            <div style="display:flex;align-items:center;gap:6px">
              ${p.supplier ? `<span class="catalog-btn-qty" style="font-size:11px">${esc(p.supplier)}</span>` : ''}
              <button class="item-edit-btn" data-catalog-edit="${i}" aria-label="Editar ${esc(p.name)}">${editSvg}</button>
            </div>
          </div>
        `);
      } else {
        const existing = state.items.find(item => item.name.toLowerCase() === p.name.toLowerCase());
        const qty = existing != null ? fmtQtyDisplay(existing) : '';
        html.push(`
          <button class="catalog-btn" data-catalog="${i}" data-search="${esc(searchVal)}">
            <span class="catalog-btn-name">${esc(p.name)}</span>
            <span class="catalog-btn-qty${qty ? ' has-qty' : ''}">${qty || '—'}</span>
          </button>
        `);
      }
    });
  });
  html.push('</div>');
  panel.innerHTML = html.join('');

  createTagSearch(
    document.getElementById('catalog-tag-search'),
    tags => { _catalogTags = tags; _filterCatalogView(panel); },
    'Nom, categoria, proveïdor… (Enter per text)',
    () => {
      const cats = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort()
        .map(c => ({ value: c.toLowerCase(), label: c, type: 'Categoria' }));
      const supps = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort()
        .map(s => ({ value: s.toLowerCase(), label: s, type: 'Proveïdor' }));
      return [...cats, ...supps];
    }
  );
}

function _filterCatalogView(panel) {
  const tags = _catalogTags;
  let lastSection = null;
  let sectionVisible = false;

  panel.querySelectorAll('.catalog-list > *').forEach(el => {
    if (el.classList.contains('catalog-section-title')) {
      if (lastSection) lastSection.hidden = !sectionVisible;
      lastSection = el;
      sectionVisible = false;
    } else if (el.classList.contains('catalog-btn')) {
      const haystack = el.dataset.search || el.querySelector('.catalog-btn-name').textContent.toLowerCase();
      const show = matchesTags(haystack, tags);
      el.hidden = !show;
      if (show) sectionVisible = true;
    }
  });
  if (lastSection) lastSection.hidden = !sectionVisible;
}

// ── QTY MODAL ────────────────────────────────────────────────────────

export function openQtyModal(idx) {
  const product = state.catalog[idx];
  if (!product) return;
  state.editingCatalogIdx = idx;

  const existing  = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());
  const upb       = product.unitsPerBox || 0;
  const unit      = product.unit || 'u';

  document.getElementById('modal-qty-title').textContent = product.name;

  const boxesField = document.getElementById('qty-boxes-field');
  const unitsLabel = document.getElementById('qty-units-label');
  boxesField.hidden = false;
  unitsLabel.textContent = unit ? (unit.charAt(0).toUpperCase() + unit.slice(1)) : 'Unitats';

  const boxesInput = document.getElementById('f-qty-boxes');
  const unitsInput = document.getElementById('f-qty-value');
  boxesInput.value = existing?.boxes != null ? existing.boxes : '';
  unitsInput.value = existing != null ? (existing.looseUnits ?? existing.quantity ?? '') : '';

  document.getElementById('btn-remove-qty').hidden = !existing;
  document.getElementById('modal-qty').classList.add('open');
  setTimeout(() => { unitsInput.focus(); unitsInput.select(); }, 350);
}

export function closeQtyModal() {
  document.getElementById('modal-qty').classList.remove('open');
  state.editingCatalogIdx = null;
}

export function removeQtyItem() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;
  state.items = state.items.filter(i => i.name.toLowerCase() !== product.name.toLowerCase());
  saveItems();
  closeQtyModal();
  toast(`${product.name} desmarcat`);
  renderCatalogView();
}

export function saveQty() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;

  const upb       = product.unitsPerBox || 0;
  const boxesVal  = document.getElementById('f-qty-boxes').value;
  const unitsVal  = document.getElementById('f-qty-value').value;

  if (boxesVal === '' && unitsVal === '') {
    document.getElementById('f-qty-boxes').focus();
    return;
  }

  const boxes = parseFloat(boxesVal) || 0;
  const loose = parseFloat(unitsVal) || 0;
  const total = upb > 0 ? boxes * upb + loose : loose || boxes;

  const catId     = ensureCategory(product.category);
  const existing  = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());
  const update    = {
    quantity:    total,
    boxes:       boxes,
    looseUnits:  loose,
    unit:        product.unit || '',
    unitsPerBox: upb,
    updatedAt:   new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, update);
  } else {
    state.items.unshift({
      id: uid(), createdAt: new Date().toISOString(),
      name: product.name, category: catId,
      minStock: product.minStock || 0, notes: '',
      ...update,
    });
  }

  saveItems();
  closeQtyModal();
  toast(`${product.name}: ${fmtQtyDisplay({ boxes, looseUnits: loose, unit: product.unit || 'u' })}`);
  renderCatalogView();
}

// ── GAS CONFIG (Admin) ───────────────────────────────────────────────

export function openGasModal() {
  const saved = localStorage.getItem('uauu_inv_gas_url') || '';
  document.getElementById('f-gas-url').value = saved;
  document.getElementById('modal-gas').classList.add('open');
  setTimeout(() => document.getElementById('f-gas-url').focus(), 380);
}

export function closeGasModal() {
  document.getElementById('modal-gas').classList.remove('open');
}

export function saveGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim();
  if (url) {
    localStorage.setItem('uauu_inv_gas_url', url);
    toast('URL desada correctament');
  } else {
    localStorage.removeItem('uauu_inv_gas_url');
    toast('URL eliminada');
  }
  closeGasModal();
}

export function testGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim()
           || localStorage.getItem('uauu_inv_gas_url') || '';
  if (!url) { toast('Enganxa primer la URL'); return; }
  const params = new URLSearchParams({
    id: 0, producte: 'TEST_CONNEXIO', proveidor: '', categoria: 'TEST', codi: '',
  });
  window.open(`${url}?${params}`, '_blank');
  toast('Comprova si ha aparegut una fila TEST al full');
}

// ── NOU PRODUCTE (Comensal) ──────────────────────────────────────────

function _fillProductDataLists() {
  const categories = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort();
  const suppliers  = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort();
  document.getElementById('dl-np-categories').innerHTML = categories.map(c => `<option value="${esc(c)}">`).join('');
  document.getElementById('dl-np-suppliers').innerHTML  = suppliers.map(s => `<option value="${esc(s)}">`).join('');
}

export function openNewProductModal(prefill = {}) {
  state.editingCatalogProductIdx = null;
  document.getElementById('modal-np-title').textContent = 'Nou producte';
  document.getElementById('btn-save-new-product').textContent = 'Afegir al catàleg';
  const delBtn = document.getElementById('btn-delete-product');
  if (delBtn) delBtn.hidden = true;

  _fillProductDataLists();
  document.getElementById('f-np-name').value        = prefill.name        || '';
  document.getElementById('f-np-category').value    = prefill.category    || '';
  document.getElementById('f-np-supplier').value    = prefill.supplier    || '';
  document.getElementById('f-np-unit').value        = prefill.unit        || '';
  document.getElementById('f-np-unitsperbox').value = prefill.unitsPerBox || '';
  document.getElementById('f-np-minstock').value    = prefill.minStock    || '';
  document.getElementById('f-np-code').value        = prefill.code        || '';
  document.getElementById('modal-new-product').classList.add('open');
  const focusField = prefill.name ? 'f-np-category' : 'f-np-name';
  setTimeout(() => document.getElementById(focusField).focus(), 380);
}

export function openEditProductModal(idx) {
  const product = state.catalog[idx];
  if (!product) return;
  state.editingCatalogProductIdx = idx;

  document.getElementById('modal-np-title').textContent = 'Editar producte';
  document.getElementById('btn-save-new-product').textContent = 'Desar canvis';

  _fillProductDataLists();
  document.getElementById('f-np-name').value        = product.name        || '';
  document.getElementById('f-np-category').value    = product.category    || '';
  document.getElementById('f-np-supplier').value    = product.supplier    || '';
  document.getElementById('f-np-unit').value        = product.unit        || '';
  document.getElementById('f-np-unitsperbox').value = product.unitsPerBox || '';
  document.getElementById('f-np-minstock').value    = product.minStock    || '';
  document.getElementById('f-np-code').value        = product.code        || '';

  const isExtra = state.catalogExtra.some(e => e.id === product.id);
  const delBtn = document.getElementById('btn-delete-product');
  if (delBtn) delBtn.hidden = !isExtra;

  document.getElementById('modal-new-product').classList.add('open');
  setTimeout(() => document.getElementById('f-np-name').focus(), 380);
}

export function saveEditProduct() {
  const idx = state.editingCatalogProductIdx;
  if (idx === null) return;
  const original = state.catalog[idx];

  const name        = document.getElementById('f-np-name').value.trim();
  const category    = document.getElementById('f-np-category').value.trim();
  const supplier    = document.getElementById('f-np-supplier').value.trim();
  const unit        = document.getElementById('f-np-unit').value.trim();
  const unitsPerBox = parseFloat(document.getElementById('f-np-unitsperbox').value) || 0;
  const minStock    = parseFloat(document.getElementById('f-np-minstock').value) || 0;
  const code        = document.getElementById('f-np-code').value.trim();

  if (!name) {
    const el = document.getElementById('f-np-name');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
    return;
  }

  const updated = { ...original, name, category, supplier, unit, unitsPerBox, minStock, code };
  state.catalog[idx] = updated;

  const extraIdx = state.catalogExtra.findIndex(p => p.id === original.id);
  if (extraIdx >= 0) {
    state.catalogExtra[extraIdx] = updated;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));
  } else {
    const edits = JSON.parse(localStorage.getItem(STORAGE_CAT_EDITS) || '{}');
    edits[original.id] = { name, category, supplier, code };
    localStorage.setItem(STORAGE_CAT_EDITS, JSON.stringify(edits));
  }

  closeNewProductModal();
  renderCatalogView();
  toast(`"${name}" actualitzat`);
}

export function deleteEditProduct() {
  const idx = state.editingCatalogProductIdx;
  if (idx === null) return;
  const product = state.catalog[idx];

  const extraIdx = state.catalogExtra.findIndex(p => p.id === product.id);
  if (extraIdx < 0) return;

  if (!confirm(`Eliminar "${product.name}" del catàleg?`)) return;

  state.catalogExtra.splice(extraIdx, 1);
  localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));
  state.catalog.splice(idx, 1);

  closeNewProductModal();
  renderCatalogView();
  toast(`"${product.name}" eliminat del catàleg`);
}

export function closeNewProductModal() {
  document.getElementById('modal-new-product').classList.remove('open');
}

export function saveNewProduct() {
  try {
    const name        = document.getElementById('f-np-name').value.trim();
    const category    = document.getElementById('f-np-category').value.trim();
    const supplier    = document.getElementById('f-np-supplier').value.trim();
    const unit        = document.getElementById('f-np-unit').value.trim();
    const unitsPerBox = parseFloat(document.getElementById('f-np-unitsperbox').value) || 0;
    const minStock    = parseFloat(document.getElementById('f-np-minstock').value) || 0;
    const code        = document.getElementById('f-np-code').value.trim();

    if (!name) {
      const el = document.getElementById('f-np-name');
      el.focus();
      el.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { el.style.borderColor = ''; }, 1200);
      return;
    }

    state.maxCatalogId++;
    const newId   = state.maxCatalogId;
    const product = { id: newId, code, name, category, supplier, unit, unitsPerBox, minStock };

    state.catalog.push(product);
    state.catalogExtra.push(product);
    state.catalogReady = true;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));

    const gasUrl = localStorage.getItem('uauu_inv_gas_url') || SHEET_APPEND_URL;
    if (gasUrl) {
      const params = new URLSearchParams({
        action: 'add-producte',
        id: newId, producte: name, proveidor: supplier,
        categoria: category, codi: code, min: minStock,
        unitat: unit, unitspercaixa: unitsPerBox,
      });
      sendToSheet(gasUrl, params);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const histParams = new URLSearchParams({
        action:    'inventari',
        id:        String(now.getTime()),
        data:      `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
        hora:      `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        comensal:  state.authProfile?.nom || state.user || '',
        masia:     state.masia || '',
        inventari: `[PRODUCTE]: ${name}`,
        comentari: [category, supplier].filter(Boolean).join(' · '),
      });
      sendToSheet(SHEET_APPEND_URL, histParams.toString());

      toast(`"${name}" afegit i enviat al full`);
    } else {
      toast(`"${name}" desat localment`);
    }

    closeNewProductModal();
    renderCatalogView();
  } catch (err) {
    toast(`Error al desar: ${err.message}`);
  }
}
