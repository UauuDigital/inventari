import {
  CATALOG_URL, OPEN_FOOD_FACTS_URL, SHEET_APPEND_URL, STORAGE_CAT_EXTRA,
  state, saveItems,
} from './config.js';
import { uid, esc, fmtNum, toast, parseCSV, findCol, sendToSheet } from './helpers.js';
import { ensureCategory } from './items.js';

let _catalogQuery = '';

// ── CATALOG LOAD ─────────────────────────────────────────────────────

export async function loadCatalog() {
  if (state.catalogReady) return;
  try {
    const res  = await fetch(CATALOG_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return;

    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    const iId    = headers.indexOf('id');
    const iName  = findCol(headers, ['producte', 'nom', 'name', 'article']);
    const iCat   = findCol(headers, ['categoria', 'category', 'cat']);
    const iPrice = findCol(headers, ['preu', 'price', 'cost']);
    const iSupp  = findCol(headers, ['proveidor', 'proveedor', 'proveïdor', 'supplier', 'prove']);
    const iCode  = findCol(headers, ['codi', 'code', 'barcode', 'ean', 'upc']);

    state.catalog = rows.slice(1)
      .filter(r => String(r[iName] ?? '').trim())
      .map(r => ({
        id:       parseInt(String(r[iId] ?? '0')) || 0,
        code:     String(r[iCode]  ?? '').trim(),
        name:     String(r[iName]  ?? '').trim(),
        category: String(r[iCat]   ?? '').trim(),
        price:    parseFloat(String(r[iPrice] ?? '0').replace(',', '.')) || 0,
        supplier: String(r[iSupp]  ?? '').trim(),
      }));

    state.maxCatalogId = state.catalog.reduce((max, p) => Math.max(max, p.id || 0), 0);
    state.catalogReady = true;
  } catch {
    /* offline o sheet privat */
  }

  if (state.catalogExtra.length > 0) {
    const sheetNames = new Set(state.catalog.map(p => p.name.toLowerCase()));
    const fresh = state.catalogExtra.filter(p => !sheetNames.has(p.name.toLowerCase()));
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

  if (product.price) document.getElementById('f-price').value = product.price;

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
  if (state.scannerInstance) {
    try {
      await state.scannerInstance.stop();
      state.scannerInstance.clear();
    } catch {}
    state.scannerInstance = null;
  }
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
  if (offProduct) {
    closeScanModal();
    toast(`Trobat a Open Food Facts: ${offProduct.name}`);
    openNewProductModal({ ...offProduct, code });
    return;
  }

  if (statusEl) statusEl.textContent = 'Producte no trobat — afegeix-lo manualment';
  setTimeout(() => {
    closeScanModal();
    openNewProductModal({ code });
  }, 900);
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

  _catalogQuery = '';

  const groups = new Map();
  state.catalog.forEach((p, i) => {
    const cat = p.category || 'Sense categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ p, i });
  });

  const html = [`
    <div class="catalog-list">
    <input class="catalog-view-search" id="catalog-view-search" type="search"
           placeholder="Cercar producte…" autocomplete="off" aria-label="Cercar producte">
    <button class="catalog-scan-btn" id="btn-scan-barcode">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/>
        <line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="17" y1="12" x2="17" y2="12.01"/>
      </svg>
      Escaneja codi de barres
    </button>
  `];
  groups.forEach((entries, catName) => {
    html.push(`<div class="catalog-section-title" data-section="${esc(catName)}">${esc(catName)}</div>`);
    entries.forEach(({ p, i }) => {
      const existing = state.items.find(item => item.name.toLowerCase() === p.name.toLowerCase());
      const qty = existing != null ? fmtNum(existing.quantity) : '';
      html.push(`
        <button class="catalog-btn" data-catalog="${i}">
          <span class="catalog-btn-name">${esc(p.name)}</span>
          <span class="catalog-btn-qty${qty ? ' has-qty' : ''}">${qty || '—'}</span>
        </button>
      `);
    });
  });
  html.push('</div>');
  panel.innerHTML = html.join('');

  document.getElementById('catalog-view-search').addEventListener('input', e => {
    _catalogQuery = e.target.value.trim().toLowerCase();
    _filterCatalogView(panel);
  });
}

function _filterCatalogView(panel) {
  const q = _catalogQuery;
  let lastSection = null;
  let sectionVisible = false;

  panel.querySelectorAll('.catalog-list > *').forEach(el => {
    if (el.classList.contains('catalog-section-title')) {
      if (lastSection) lastSection.hidden = !sectionVisible;
      lastSection = el;
      sectionVisible = false;
    } else if (el.classList.contains('catalog-btn')) {
      const name = el.querySelector('.catalog-btn-name').textContent.toLowerCase();
      const show = !q || name.includes(q);
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

  const existing = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());
  const currentQty = existing != null ? existing.quantity : '';

  document.getElementById('modal-qty-title').textContent = product.name;
  const input = document.getElementById('f-qty-value');
  input.value = currentQty !== '' ? currentQty : '';

  document.getElementById('modal-qty').classList.add('open');
  setTimeout(() => { input.focus(); input.select(); }, 350);
}

export function closeQtyModal() {
  document.getElementById('modal-qty').classList.remove('open');
  state.editingCatalogIdx = null;
}

export function saveQty() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;

  const val = document.getElementById('f-qty-value').value;
  const qty = parseFloat(val);
  if (val === '' || isNaN(qty) || qty < 0) {
    document.getElementById('f-qty-value').focus();
    return;
  }

  const catId = ensureCategory(product.category);
  const existing = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());

  if (existing) {
    existing.quantity  = qty;
    existing.updatedAt = new Date().toISOString();
  } else {
    state.items.unshift({
      id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      name: product.name, category: catId,
      quantity: qty, unit: '', minStock: 0,
      price: product.price || 0, notes: '',
    });
  }

  saveItems();
  closeQtyModal();
  toast(`${product.name}: ${fmtNum(qty)} u`);
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
    id: 0, producte: 'TEST_CONNEXIO', proveidor: '', preu: 0, categoria: 'TEST', codi: '',
  });
  window.open(`${url}?${params}`, '_blank');
  toast('Comprova si ha aparegut una fila TEST al full');
}

// ── NOU PRODUCTE (Comensal) ──────────────────────────────────────────

export function openNewProductModal(prefill = {}) {
  document.getElementById('f-np-name').value     = prefill.name     || '';
  document.getElementById('f-np-category').value = prefill.category || '';
  document.getElementById('f-np-supplier').value = prefill.supplier || '';
  document.getElementById('f-np-price').value    = prefill.price    || '';
  document.getElementById('f-np-code').value     = prefill.code     || '';
  document.getElementById('modal-new-product').classList.add('open');
  const focusField = prefill.name ? 'f-np-category' : 'f-np-name';
  setTimeout(() => document.getElementById(focusField).focus(), 380);
}

export function closeNewProductModal() {
  document.getElementById('modal-new-product').classList.remove('open');
}

export function saveNewProduct() {
  try {
    const name     = document.getElementById('f-np-name').value.trim();
    const category = document.getElementById('f-np-category').value.trim();
    const supplier = document.getElementById('f-np-supplier').value.trim();
    const price    = parseFloat(document.getElementById('f-np-price').value) || 0;
    const code     = document.getElementById('f-np-code').value.trim();

    if (!name) {
      const el = document.getElementById('f-np-name');
      el.focus();
      el.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { el.style.borderColor = ''; }, 1200);
      return;
    }

    state.maxCatalogId++;
    const newId   = state.maxCatalogId;
    const product = { id: newId, code, name, category, supplier, price };

    state.catalog.push(product);
    state.catalogExtra.push(product);
    state.catalogReady = true;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));

    const gasUrl = localStorage.getItem('uauu_inv_gas_url') || SHEET_APPEND_URL;
    if (gasUrl) {
      const params = new URLSearchParams({
        id: newId, producte: name, proveidor: supplier,
        preu: price, categoria: category, codi: code,
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
        comentari: [category, supplier, price ? `${price}€` : ''].filter(Boolean).join(' · '),
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
