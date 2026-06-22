'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────

const CATALOG_URL         = 'https://docs.google.com/spreadsheets/d/1Vc3X0RI50pBOQpJUlLwSywAR9twlG4dSaoqONnRf2Ck/export?format=csv&gid=0';
const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product/';
// URL del Google Apps Script per afegir files al full. Deixa buit si no s'ha configurat.
const SHEET_APPEND_URL    = 'https://script.google.com/macros/s/AKfycbztMwSVooLa8kyrfc4w8nwozximqD_mwDztLQ4lvAY99MvUr6pgsS9Pt5i1F-D_nUoiQg/exec';
const INVENTARI_URL       = 'https://docs.google.com/spreadsheets/d/1Vc3X0RI50pBOQpJUlLwSywAR9twlG4dSaoqONnRf2Ck/export?format=csv&gid=1640722155';
const STORAGE_ITEMS       = 'uauu_inv_items';
const STORAGE_CATS        = 'uauu_inv_cats';
const STORAGE_ORDERS      = 'uauu_inv_orders';
const STORAGE_CAT_EXTRA   = 'uauu_inv_catalog_extra';
const STORAGE_MASIA       = 'uauu_inv_masia';

const SUPABASE_URL        = 'https://oeriszeicvdnagohnqvq.supabase.co';
const SUPABASE_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcmlzemVpY3ZkbmFnb2hucXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjM2MTAsImV4cCI6MjA5NzMzOTYxMH0.GyZe8TDZus51kyYeOViZMPKxXYHlynfvJiJ83S_2cu0';
const MANAGE_USERS_URL    = SUPABASE_URL + '/functions/v1/manage-users';
const STORAGE_ACCESS_TOKEN  = 'uauu_inv_access_token';
const STORAGE_REFRESH_TOKEN = 'uauu_inv_refresh_token';
const STORAGE_TOKEN_EXPIRES = 'uauu_inv_token_expires';
const STORAGE_USER_PROFILE  = 'uauu_inv_user_profile';

const STATUS_LABELS = {
  pendent:      'Pendent',
  en_curs:      'En curs',
  rebuda:       'Rebuda',
  'cancel·lada':'Cancel·lada',
};

const MASIA_LABELS = {
  'ca-nalzina':     "Ca l'Alzina",
  'can-macia':      'Can Macià',
  'castell-de-tous':'Castell de Tous',
  'mas-vivencs':    'Mas Vivencs',
};

const STATUS_CSS = {
  pendent:      'status-pendent',
  en_curs:      'status-en_curs',
  rebuda:       'status-rebuda',
  'cancel·lada':'status-cancel_lada',
};

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
  user:        null,
  masia:       null,
  catalog:     [],
  catalogReady: false,
  orders:      [],
  orderFilter: '',
  editingOrderId: null,
  importRows:  [],
  editingCatalogIdx: null,
  catalogExtra: [],
  maxCatalogId: 0,
  scannerInstance: null,
  authProfile:  null,
  accessToken:  null,
};

// ── STORAGE ────────────────────────────────────────────────────────

function loadData() {
  try {
    state.items        = JSON.parse(localStorage.getItem(STORAGE_ITEMS))     || [];
    state.categories   = JSON.parse(localStorage.getItem(STORAGE_CATS))      || [...DEFAULT_CATS];
    state.orders       = JSON.parse(localStorage.getItem(STORAGE_ORDERS))    || [];
    state.catalogExtra = JSON.parse(localStorage.getItem(STORAGE_CAT_EXTRA)) || [];
  } catch {
    state.items        = [];
    state.categories   = [...DEFAULT_CATS];
    state.orders       = [];
    state.catalogExtra = [];
  }
}

function saveItems()  { localStorage.setItem(STORAGE_ITEMS,  JSON.stringify(state.items)); }
function saveCats()   { localStorage.setItem(STORAGE_CATS,   JSON.stringify(state.categories)); }
function saveOrders()   { localStorage.setItem(STORAGE_ORDERS,   JSON.stringify(state.orders)); }

// ── SUPABASE AUTH ──────────────────────────────────────────────────

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Credencials incorrectes');
  return data;
}

async function supabaseGetProfile(userId, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/usuaris?id=eq.${userId}&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error perfil (${res.status}): ${err.message || err.hint || JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data[0] || null;
}

async function supabaseRefreshToken(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error('Sessió caducada');
  return res.json();
}

function clearSession() {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_TOKEN_EXPIRES);
  localStorage.removeItem(STORAGE_USER_PROFILE);
  state.authProfile = null;
  state.accessToken = null;
}

async function tryRestoreSession() {
  const accessToken  = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_REFRESH_TOKEN);
  const expiresAt    = Number(localStorage.getItem(STORAGE_TOKEN_EXPIRES)) || 0;
  const profileStr   = localStorage.getItem(STORAGE_USER_PROFILE);
  if (!accessToken || !refreshToken || !profileStr) return false;

  let token = accessToken;
  if (Date.now() > expiresAt - 60000) {
    try {
      const refreshed = await supabaseRefreshToken(refreshToken);
      token = refreshed.access_token;
      localStorage.setItem(STORAGE_ACCESS_TOKEN, token);
      localStorage.setItem(STORAGE_REFRESH_TOKEN, refreshed.refresh_token || refreshToken);
      localStorage.setItem(STORAGE_TOKEN_EXPIRES, String(Date.now() + (refreshed.expires_in || 3600) * 1000));
    } catch { clearSession(); return false; }
  }

  try {
    const profile = JSON.parse(profileStr);
    state.authProfile = profile;
    state.accessToken = token;
    const rolToUser = { comensal: 'Comensal', coordinador: 'Coordinador', admin: 'Admin' };
    state.user = rolToUser[(profile.rol || '').toLowerCase()] || localStorage.getItem('uauu_inv_user') || 'Comensal';
    const savedMasia = localStorage.getItem(STORAGE_MASIA);
    if ((profile.rol || '').toLowerCase() === 'comensal' && savedMasia) state.masia = savedMasia;
    return true;
  } catch { clearSession(); return false; }
}

function updateHeaderUser() {
  const profile = state.authProfile;
  if (!profile) return;
  const nameEl = document.getElementById('user-pill-name');
  if (nameEl) nameEl.textContent = profile.nom || state.user;
  const roleEl = document.getElementById('user-pill-role');
  if (roleEl) { roleEl.textContent = profile.rol || ''; roleEl.hidden = !profile.rol; }
}

function renderCrumb(navId, crumbs) {
  const nav = document.getElementById(navId);
  if (!nav) return;
  nav.innerHTML = crumbs.map((c, i) => {
    const sep = i > 0 ? '<span class="crumb crumb-sep" aria-hidden="true">›</span>' : '';
    if (i === crumbs.length - 1) return `${sep}<span class="crumb crumb-current">${c.label}</span>`;
    return `${sep}<button class="crumb crumb-link" data-ci="${i}">${c.label}</button>`;
  }).join('');
  crumbs.forEach((c, i) => {
    if (i < crumbs.length - 1 && c.onClick) {
      nav.querySelector(`[data-ci="${i}"]`)?.addEventListener('click', c.onClick);
    }
  });
}

function goBackToUsers() {
  document.getElementById('screen-masia').hidden = true;
  document.getElementById('screen-masia').classList.remove('leaving');
  document.getElementById('screen-login').hidden = true;
  document.getElementById('screen-login').classList.remove('leaving');
  const sc = document.getElementById('screen-users');
  sc.classList.remove('leaving');
  sc.hidden = false;
  void sc.offsetWidth;
}

function goBackToMasia() {
  document.getElementById('screen-login').hidden = true;
  document.getElementById('screen-login').classList.remove('leaving');
  const sc = document.getElementById('screen-masia');
  sc.classList.remove('leaving');
  sc.hidden = false;
  void sc.offsetWidth;
}

function showLoginScreen() {
  const sc = document.getElementById('screen-login');
  sc.hidden = false;
  void sc.offsetWidth;
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  const em = document.getElementById('login-email');
  if (em) em.value = '';
  const pw = document.getElementById('login-password');
  if (pw) pw.value = '';
  const btn = document.querySelector('#login-form button[type="submit"]');
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }

  const isComensal = (ROLE_MAP[state.user] || 'comensal') === 'comensal';
  const masiaLabel = (isComensal && state.masia) ? MASIA_LABELS[state.masia] || state.masia : null;
  if (masiaLabel) {
    renderCrumb('crumb-login', [
      { label: state.user, onClick: goBackToUsers },
      { label: masiaLabel, onClick: goBackToMasia },
      { label: 'Accés' },
    ]);
  } else {
    renderCrumb('crumb-login', [
      { label: state.user, onClick: goBackToUsers },
      { label: 'Accés' },
    ]);
  }

  setTimeout(() => { const em = document.getElementById('login-email'); if (em) em.focus(); }, 350);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = e.target.querySelector('button[type="submit"]');

  if (!email || !password) { errEl.textContent = 'Omple tots els camps'; errEl.hidden = false; return; }

  btn.disabled = true;
  btn.textContent = 'Entrant…';
  errEl.hidden = true;

  try {
    const authData = await supabaseSignIn(email, password);
    const meta = authData.user?.user_metadata || {};
    const profile = { id: authData.user?.id, nom: meta.nom, rol: meta.rol, masia: meta.masia || null };
    if (!profile.rol) throw new Error('Perfil sense rol — afegeix user_metadata a Supabase');

    const expectedRole = ROLE_MAP[state.user] || 'comensal';
    const profileRole  = (profile.rol || '').toLowerCase();
    if (profileRole !== expectedRole) throw new Error(`Aquest compte és ${profile.rol}, no ${state.user}`);

    const expiresAt = Date.now() + ((authData.expires_in || 3600) * 1000);
    localStorage.setItem(STORAGE_ACCESS_TOKEN,  authData.access_token);
    localStorage.setItem(STORAGE_REFRESH_TOKEN, authData.refresh_token);
    localStorage.setItem(STORAGE_TOKEN_EXPIRES, String(expiresAt));
    localStorage.setItem(STORAGE_USER_PROFILE,  JSON.stringify(profile));

    state.authProfile = profile;
    state.accessToken = authData.access_token;

    const sc = document.getElementById('screen-login');
    sc.classList.add('leaving');
    setTimeout(() => { sc.hidden = true; sc.classList.remove('leaving'); }, 400);

    updateHeaderUser();
    applyRole(state.user);

  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

// ── USER SELECTION & ROLE ──────────────────────────────────────────

const ROLE_MAP = {
  'Comensal':    'comensal',
  'Começal':     'comensal', // backwards compat amb sessions antigues
  'Coordinador': 'coordinador',
  'Admin':       'admin',
};

function applyRole(name) {
  const role = ROLE_MAP[name] || 'comensal';
  document.body.dataset.role = role;

  // Botons exclusius admin
  const importBtn = document.getElementById('btn-import-excel');
  const gasBtn    = document.getElementById('btn-gas-config');
  if (importBtn) importBtn.hidden = (role !== 'admin');
  if (gasBtn)    gasBtn.hidden    = (role !== 'admin');

  // Default view
  if (role === 'comensal') {
    setView('catalog');
  } else if (role === 'coordinador') {
    setView('reports');
  } else {
    setView('orders');
  }
}

function selectUser(name) {
  state.user = name;
  localStorage.setItem('uauu_inv_user', name);

  const screen = document.getElementById('screen-users');
  screen.classList.add('leaving');
  setTimeout(() => { screen.hidden = true; }, 400);

  const role = ROLE_MAP[name] || 'comensal';
  if (role === 'comensal') {
    renderCrumb('crumb-masia', [
      { label: name, onClick: goBackToUsers },
      { label: 'Masia' },
    ]);
    const masiaSc = document.getElementById('screen-masia');
    masiaSc.hidden = false;
    void masiaSc.offsetWidth;
  } else {
    showLoginScreen();
  }
}

function selectMasia(masiaId) {
  state.masia = masiaId;
  localStorage.setItem(STORAGE_MASIA, masiaId);

  const masiaSc = document.getElementById('screen-masia');
  masiaSc.classList.add('leaving');
  setTimeout(() => { masiaSc.hidden = true; }, 400);

  showLoginScreen();
}

function showUserScreen() {
  clearSession();
  state.user  = null;
  state.masia = null;
  localStorage.removeItem('uauu_inv_user');
  localStorage.removeItem(STORAGE_MASIA);
  document.getElementById('user-pill-name').textContent = '';
  const roleEl = document.getElementById('user-pill-role');
  if (roleEl) { roleEl.textContent = ''; roleEl.hidden = true; }
  document.body.removeAttribute('data-role');

  const masiaSc = document.getElementById('screen-masia');
  masiaSc.hidden = true;
  masiaSc.classList.remove('leaving');

  const loginSc = document.getElementById('screen-login');
  loginSc.hidden = true;
  loginSc.classList.remove('leaving');

  const screen = document.getElementById('screen-users');
  screen.hidden = false;
  screen.classList.remove('leaving');
  void screen.offsetWidth;
}

async function initUserScreen() {
  // 1. Intenta restaurar sessió Supabase
  const restored = await tryRestoreSession();
  if (restored) {
    document.getElementById('screen-users').hidden = true;
    updateHeaderUser();
    applyRole(state.user);
    return;
  }

  // 2. Sense sessió — comprova si hi ha selecció prèvia
  const savedUser  = localStorage.getItem('uauu_inv_user');
  const savedMasia = localStorage.getItem(STORAGE_MASIA);
  if (savedUser) {
    const role = ROLE_MAP[savedUser] || 'comensal';
    if (role === 'comensal' && savedMasia) {
      state.user  = savedUser;
      state.masia = savedMasia;
      document.getElementById('screen-users').hidden = true;
      showLoginScreen();
    } else {
      selectUser(savedUser);
    }
  }

  // 3. Listeners
  document.querySelectorAll('.user-card[data-user]').forEach(card => {
    card.addEventListener('click', () => selectUser(card.dataset.user));
  });
  document.querySelectorAll('.user-card[data-masia]').forEach(card => {
    card.addEventListener('click', () => selectMasia(card.dataset.masia));
  });
  document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
  document.getElementById('btn-logout').addEventListener('click', showUserScreen);
}

// ── CATALOG AUTOCOMPLETE ───────────────────────────────────────────

async function loadCatalog() {
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

  // Afegeix productes creats localment que no estiguin ja al full
  if (state.catalogExtra.length > 0) {
    const sheetNames = new Set(state.catalog.map(p => p.name.toLowerCase()));
    const fresh = state.catalogExtra.filter(p => !sheetNames.has(p.name.toLowerCase()));
    state.catalog = [...state.catalog, ...fresh];
    // Actualitza el maxId pels productes extra
    fresh.forEach(p => { if ((p.id || 0) > state.maxCatalogId) state.maxCatalogId = p.id; });
    if (fresh.length > 0) state.catalogReady = true;
  }
}

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

function ensureCategory(name) {
  if (!name) return state.categories[0]?.id || 'cat_general';
  let cat = state.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) {
    cat = { id: 'cat_' + uid(), name, color: CAT_COLORS[state.categories.length % CAT_COLORS.length] };
    state.categories.push(cat);
    saveCats();
  }
  return cat.id;
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

function initCatalogSearch() {
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

  // Dropdown item click
  document.getElementById('product-dropdown').addEventListener('mousedown', e => {
    const item = e.target.closest('.product-dd-item[data-dd]');
    if (item) {
      e.preventDefault(); // evita que l'input perdi el focus
      selectCatalogProduct(_ddResults[parseInt(item.dataset.dd)]);
    }
  });

  // Close on outside click
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.product-search-wrap')) closeProductDropdown();
  }, true);
}

// ── BARCODE SCANNER ────────────────────────────────────────────────

let _html5QrLoaded = false;

function loadHtml5QrCode() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload  = () => { _html5QrLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('No s\'ha pogut carregar l\'escàner.'));
    document.head.appendChild(s);
  });
}

async function openScanModal() {
  document.getElementById('modal-scan').classList.add('open');
  document.getElementById('scan-status-text').textContent = 'Apunta la càmera al codi de barres';

  try {
    await loadHtml5QrCode();
  } catch {
    document.getElementById('scan-status-text').textContent = 'Error carregant l\'escàner. Comprova la connexió.';
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
    document.getElementById('scan-status-text').textContent = 'No s\'ha pogut accedir a la càmera.';
  }
}

async function closeScanModal() {
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
    const category = rawCat.replace(/^[a-z]{2}:/, ''); // treu el prefix "en:" etc.
    return {
      name,
      category,
      supplier: (p.brands || '').split(',')[0].trim(),
    };
  } catch {
    return null;
  }
}

async function handleBarcode(code) {
  // Atura l'escàner i mostra estat de cerca
  if (state.scannerInstance) {
    try { await state.scannerInstance.stop(); state.scannerInstance.clear(); state.scannerInstance = null; } catch {}
  }
  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = 'Buscant producte…';

  // 1. Cerca al catàleg local per codi
  const localIdx = state.catalog.findIndex(p => p.code && p.code === code);
  if (localIdx >= 0) {
    closeScanModal();
    toast(`Trobat: ${state.catalog[localIdx].name}`);
    openQtyModal(localIdx);
    return;
  }

  // 2. Cerca a Open Food Facts
  const offProduct = await lookupOpenFoodFacts(code);
  if (offProduct) {
    closeScanModal();
    toast(`Trobat a Open Food Facts: ${offProduct.name}`);
    openNewProductModal({ ...offProduct, code });
    return;
  }

  // 3. No trobat en cap lloc
  if (statusEl) statusEl.textContent = 'Producte no trobat — afegeix-lo manualment';
  setTimeout(() => {
    closeScanModal();
    openNewProductModal({ code });
  }, 900);
}

// ── CATALOG VIEW (Comensal) ────────────────────────────────────────

function renderCatalogView() {
  const panel = document.getElementById('view-catalog');
  if (!panel) return;

  if (!state.catalogReady) {
    panel.innerHTML = '<div class="catalog-loading">Carregant catàleg…</div>';
    loadCatalog()
      .then(() => renderCatalogView())
      .catch(() => {
        panel.innerHTML = '<div class="catalog-empty">No s\'ha pogut carregar el catàleg.<br>Comprova la connexió a internet.</div>';
      });
    return;
  }

  if (state.catalog.length === 0) {
    panel.innerHTML = '<div class="catalog-empty">Cap producte al catàleg.</div>';
    return;
  }

  // Group by category preserving sheet order
  const groups = new Map();
  state.catalog.forEach((p, i) => {
    const cat = p.category || 'Sense categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ p, i });
  });

  const html = [`
    <div class="catalog-list">
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
    html.push(`<div class="catalog-section-title">${esc(catName)}</div>`);
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
}

function openQtyModal(idx) {
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

function closeQtyModal() {
  document.getElementById('modal-qty').classList.remove('open');
  state.editingCatalogIdx = null;
}

function saveQty() {
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

// ── CONFIGURACIÓ GAS (Admin) ───────────────────────────────────────

function openGasModal() {
  const saved = localStorage.getItem('uauu_inv_gas_url') || '';
  document.getElementById('f-gas-url').value = saved;
  document.getElementById('modal-gas').classList.add('open');
  setTimeout(() => document.getElementById('f-gas-url').focus(), 380);
}

function closeGasModal() {
  document.getElementById('modal-gas').classList.remove('open');
}

function saveGasUrl() {
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

function testGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim()
           || localStorage.getItem('uauu_inv_gas_url') || '';
  if (!url) { toast('Enganxa primer la URL'); return; }
  const params = new URLSearchParams({
    id: 0, producte: 'TEST_CONNEXIO', proveidor: '', preu: 0, categoria: 'TEST', codi: '',
  });
  // Obre en una pestanya nova per veure la resposta directament
  window.open(`${url}?${params}`, '_blank');
  toast('Comprova si ha aparegut una fila TEST al full');
}

// ── NOU PRODUCTE (Comensal) ────────────────────────────────────────

function openNewProductModal(prefill = {}) {
  document.getElementById('f-np-name').value     = prefill.name     || '';
  document.getElementById('f-np-category').value = prefill.category || '';
  document.getElementById('f-np-supplier').value = prefill.supplier || '';
  document.getElementById('f-np-price').value    = prefill.price    || '';
  document.getElementById('f-np-code').value     = prefill.code     || '';
  document.getElementById('modal-new-product').classList.add('open');
  const focusField = prefill.name ? 'f-np-category' : 'f-np-name';
  setTimeout(() => document.getElementById(focusField).focus(), 380);
}

function closeNewProductModal() {
  document.getElementById('modal-new-product').classList.remove('open');
}

function sendToSheet(gasUrl, params) {
  const url = `${gasUrl}?${params}`;
  // Iframe ocult: segueix redirects cross-origin igual que obrir en pestanya nova,
  // sense restriccions CORS ni problemes amb service workers. Funciona a mòbil.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);
  iframe.src = url;
  setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 8000);
}

function saveNewProduct() {
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

    // ID = últim ID del full + 1
    state.maxCatalogId++;
    const newId = state.maxCatalogId;

    const product = { id: newId, code, name, category, supplier, price };

    // Desa localment i marca catàleg com a preparat
    state.catalog.push(product);
    state.catalogExtra.push(product);
    state.catalogReady = true;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));

    // Envia al Google Sheet
    const gasUrl = localStorage.getItem('uauu_inv_gas_url') || SHEET_APPEND_URL;
    if (gasUrl) {
      const params = new URLSearchParams({
        id: newId, producte: name, proveidor: supplier,
        preu: price, categoria: category, codi: code,
      });
      sendToSheet(gasUrl, params);
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

// ── ORDERS ─────────────────────────────────────────────────────────

function filteredOrders() {
  if (!state.orderFilter) return state.orders;
  return state.orders.filter(o => o.status === state.orderFilter);
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ca', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function renderOrders() {
  const list  = document.getElementById('orders-list');
  const empty = document.getElementById('orders-empty');
  if (!list) return;

  // Update filter pills
  document.querySelectorAll('#orders-filter-strip .filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === state.orderFilter);
  });

  const orders = filteredOrders();

  if (orders.length === 0) {
    list.innerHTML  = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = orders.map(o => `
    <div class="order-card" data-id="${o.id}">
      <div class="order-card-top">
        <div class="order-card-meta">
          ${o.ref ? `<span class="order-ref">${esc(o.ref)}</span>` : ''}
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

function openOrderModal(order = null) {
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

function closeOrderModal() {
  document.getElementById('modal-order').classList.remove('open');
  state.editingOrderId = null;
}

function saveOrder() {
  const desc = document.getElementById('f-order-desc').value.trim();
  if (!desc) {
    const el = document.getElementById('f-order-desc');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
    return;
  }
  const data = {
    ref:      document.getElementById('f-order-ref').value.trim(),
    date:     document.getElementById('f-order-date').value,
    supplier: document.getElementById('f-order-supplier').value.trim(),
    status:   document.getElementById('f-order-status').value,
    desc,
    amount:   parseFloat(document.getElementById('f-order-amount').value) || 0,
    notes:    document.getElementById('f-order-notes').value.trim(),
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

function deleteOrder() {
  if (!state.editingOrderId) return;
  const o = state.orders.find(x => x.id === state.editingOrderId);
  if (!confirm(`Eliminar la comanda${o?.ref ? ' ' + o.ref : ''}?`)) return;
  state.orders = state.orders.filter(x => x.id !== state.editingOrderId);
  saveOrders();
  closeOrderModal();
  renderOrders();
  toast('Comanda eliminada');
}

// ── EXCEL / CSV IMPORT ─────────────────────────────────────────────

let _xlsxLoaded = false;

function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
    s.onload  = () => { _xlsxLoaded = true; resolve(window.XLSX); };
    s.onerror = () => reject(new Error('No s\'ha pogut carregar la llibreria Excel.\nConnecta\'t a internet i torna a intentar-ho.'));
    document.head.appendChild(s);
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes(';') ? ';' : ',';

  return lines.map(line => {
    const cells = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; } // "" escaped quote
        else inQuote = !inQuote;
      } else if (ch === delim && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  });
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase().includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

function rowsToItems(rows) {
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const iName  = findCol(headers, ['nom', 'name', 'article', 'producte']);
  const iCat   = findCol(headers, ['categoria', 'category', 'cat']);
  const iQty   = findCol(headers, ['quantitat', 'quantity', 'qty', 'estoc', 'stock']);
  const iUnit  = findCol(headers, ['unitat', 'unit']);
  const iMin   = findCol(headers, ['mínim', 'minim', 'min stock', 'estoc mínim']);
  const iPrice = findCol(headers, ['preu', 'price', 'cost']);

  if (iName === -1) throw new Error('Columna "Nom" no trobada. Comprova les capçaleres.');

  return rows.slice(1)
    .filter(r => String(r[iName] || '').trim())
    .map(r => ({
      name:     String(r[iName] || '').trim(),
      category: String(r[iCat]  || '').trim(),
      quantity: parseFloat(String(r[iQty]   || '0').replace(',', '.')) || 0,
      unit:     String(r[iUnit] || '').trim(),
      minStock: parseFloat(String(r[iMin]   || '0').replace(',', '.')) || 0,
      price:    parseFloat(String(r[iPrice] || '0').replace(',', '.')) || 0,
    }));
}

async function processImportFile(file) {
  let rows;
  if (file.name.toLowerCase().endsWith('.csv')) {
    rows = parseCSV(await file.text());
  } else {
    const XLSX = await loadSheetJS();
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  state.importRows = rowsToItems(rows);

  const preview = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (state.importRows.length === 0) {
    preview.innerHTML = '<p style="padding:12px;font-size:13px;color:rgba(34,31,30,0.5)">Cap fila vàlida trobada.</p>';
    preview.hidden = false;
    confirmBtn.hidden = true;
    return;
  }

  const cols = [
    { k: 'name',     l: 'Nom' },
    { k: 'category', l: 'Categoria' },
    { k: 'quantity', l: 'Quantitat' },
    { k: 'unit',     l: 'Unitat' },
    { k: 'price',    l: 'Preu' },
  ];
  const sample = state.importRows.slice(0, 5);

  preview.innerHTML = `
    <table class="import-preview-table">
      <thead><tr>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr></thead>
      <tbody>
        ${sample.map(row =>
          `<tr>${cols.map(c => `<td>${esc(String(row[c.k] ?? ''))}</td>`).join('')}</tr>`
        ).join('')}
      </tbody>
    </table>
    <p class="import-count">${state.importRows.length} articles detectats${state.importRows.length > 5 ? ' (mostrant 5)' : ''}</p>
  `;
  preview.hidden = false;
  confirmBtn.textContent = `Importar ${state.importRows.length} article${state.importRows.length !== 1 ? 's' : ''}`;
  confirmBtn.hidden = false;
}

function confirmImport() {
  if (!state.importRows.length) return;
  let created = 0;
  let updated = 0;

  state.importRows.forEach(row => {
    const catId = ensureCategory(row.category);

    // Check if item already exists (by name, case-insensitive)
    const existing = state.items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
    if (existing) {
      existing.quantity  = row.quantity;
      existing.unit      = row.unit      || existing.unit;
      existing.minStock  = row.minStock  || existing.minStock;
      existing.price     = row.price     || existing.price;
      existing.category  = catId;
      existing.updatedAt = new Date().toISOString();
      updated++;
    } else {
      state.items.unshift({
        id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        name: row.name, category: catId,
        quantity: row.quantity, unit: row.unit,
        minStock: row.minStock, price: row.price, notes: '',
      });
      created++;
    }
  });

  saveCats();
  saveItems();
  state.importRows = [];
  closeImportModal();
  toast(`Importació completada: ${created} nous, ${updated} actualitzats`);
}

function openImportModal() {
  document.getElementById('import-preview').hidden   = true;
  document.getElementById('btn-confirm-import').hidden = true;
  document.getElementById('f-import-file').value    = '';
  document.getElementById('modal-import').classList.add('open');
}

function closeImportModal() {
  document.getElementById('modal-import').classList.remove('open');
  state.importRows = [];
}

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
  const fabLabel = fab.querySelector('span:last-child');
  if (state.view === 'orders') {
    fab.hidden = false;
    fabLabel.textContent = 'Nova comanda';
  } else if (state.view === 'list') {
    fab.hidden = false;
    fabLabel.textContent = 'Nou article';
  } else if (state.view === 'catalog') {
    fab.hidden = false;
    fabLabel.textContent = 'Nou producte';
  } else if (state.view === 'users') {
    fab.hidden = false;
    fabLabel.textContent = 'Nou usuari';
  } else {
    fab.hidden = true;
  }
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

  if (document.body.dataset.role === 'comensal') {
    if (state.items.length === 0) {
      el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.4"><span class="stats-cat-name" style="flex:none;font-size:13px">Encara no s'ha comptat cap producte</span></div>`;
      return;
    }
    const groups = new Map();
    state.items.forEach(item => {
      const cat = state.categories.find(c => c.id === item.category);
      const catName = cat ? cat.name : 'Sense categoria';
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName).push(item);
    });
    let html = `<div class="stats-total-row"><span class="stats-total-label">Total comptat</span><span class="stats-total-val">${state.items.length} productes</span></div>`;
    groups.forEach((items, catName) => {
      html += `<div class="stats-section-title">${esc(catName)}</div>`;
      items.forEach(item => {
        html += `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">${fmtNum(item.quantity)} ${esc(item.unit || 'u')}</span>
        </div>`;
      });
    });
    html += `<textarea class="inv-comment-input" id="inv-comment" placeholder="Comentari opcional…" rows="3"></textarea>`;
    html += `<button class="btn-send-report" data-action="send-report">Enviar inventari al coordinador</button>`;
    el.innerHTML = html;
    return;
  }

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

function sendInventoryReport() {
  if (!state.items.length) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const snapshot = state.items.map(i => ({
    name:     i.name,
    quantity: i.quantity,
    unit:     i.unit || 'u',
    category: i.category,
  }));

  const commentEl = document.getElementById('inv-comment');
  const comment = commentEl ? commentEl.value.trim() : '';

  const inventariStr = snapshot.map(i => `${i.name}: ${fmtNum(i.quantity)} ${i.unit}`).join(' | ');
  const params = new URLSearchParams({
    action:    'inventari',
    id:        String(now.getTime()),
    data:      dateStr,
    hora:      timeStr,
    comensal:  '',
    masia:     state.masia || '',
    inventari: inventariStr,
    comentari: comment,
  });
  sendToSheet(SHEET_APPEND_URL, params.toString());

  state.items = [];
  saveItems();

  // Neteja el comentari i el resum immediatament
  const commentClear = document.getElementById('inv-comment');
  if (commentClear) commentClear.value = '';
  renderStats();

  showToast('Inventari enviat al coordinador');
  setView('catalog');
  renderStatsStrip();
}

async function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;

  el.innerHTML = `<div class="reports-loading">Carregant informes…</div>`;

  try {
    const res  = await fetch(INVENTARI_URL);
    const text = await res.text();
    const rows = parseCSV(text);

    // Validate that we're reading the Inventari sheet (not the catalog)
    const headers = (rows[0] || []).map(h => h.toLowerCase().trim());
    const isCorrectSheet = headers.some(h => h === 'inventari' || h === 'data' || h === 'hora');
    if (!isCorrectSheet) {
      el.innerHTML = `<div class="stats-cat-row" style="flex-direction:column;gap:6px;padding:20px 16px">
        <span class="stats-cat-name" style="flex:none;font-size:13px;color:var(--low)">Error: s'està llegint el full incorrecte.</span>
        <span class="stats-cat-count">Capçaleres trobades: ${esc((rows[0] || []).join(', '))}</span>
      </div>`;
      return;
    }

    const data = rows.slice(1).filter(r => r.length > 1 && r[0]);

    if (!data.length) {
      el.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
            <rect x="10" y="8" width="44" height="50" rx="4"/>
            <path d="M10 22h44"/><path d="M20 36h24M20 44h16"/>
          </svg>
          <p class="empty-title">Sense informes</p>
          <p class="empty-text">Els comensals enviaran informes<br>quan acabin l'inventari.</p>
        </div>`;
      return;
    }

    el.innerHTML = [...data].reverse().map(r => {
      const [id, date, hora, comensal, masia, inventari, comentari] = r;
      const items = (inventari || '').split(' | ').filter(Boolean);
      const itemsHtml = items.map(item => {
        const sep  = item.indexOf(': ');
        const name = sep > -1 ? item.slice(0, sep) : item;
        const qty  = sep > -1 ? item.slice(sep + 2) : '';
        return `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(name)}</span>
          <span class="stats-cat-count">${esc(qty)}</span>
        </div>`;
      }).join('');
      const comentariHtml = comentari ? `<div class="report-comment">${esc(comentari)}</div>` : '';
      return `
        <div class="report-card">
          <div class="report-card-header">
            <span class="report-date-time">${esc(date)} · ${esc(hora)}</span>
            <span class="report-count-badge">${items.length} productes</span>
          </div>
          ${comentariHtml}
          <div class="report-items-list">${itemsHtml}</div>
        </div>`;
    }).join('');

  } catch {
    el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.5"><span class="stats-cat-name" style="flex:none;font-size:13px">Error carregant informes. Comprova la connexió.</span></div>`;
  }
}

// ── GESTIÓ D'USUARIS (Admin) ───────────────────────────────────────

const ROL_LABELS = { comensal: 'Comensal', coordinador: 'Coordinador', admin: 'Admin' };

async function callManageUsers(action, payload = {}) {
  const token = state.accessToken || localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) throw new Error('Sessió no iniciada');
  const res = await fetch(MANAGE_USERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function renderUsers() {
  const el = document.getElementById('users-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">Carregant usuaris…</div>`;

  try {
    const { users } = await callManageUsers('list');
    state.usersCache = users || [];

    if (!users.length) {
      el.innerHTML = `<div class="reports-loading">Cap usuari registrat.</div>`;
      return;
    }

    const order = { admin: 0, coordinador: 1, comensal: 2 };
    const sorted = [...users].sort((a, b) =>
      (order[a.rol] ?? 9) - (order[b.rol] ?? 9) || (a.nom || '').localeCompare(b.nom || ''));

    el.innerHTML = sorted.map(u => {
      const masiaTxt = u.masia ? (MASIA_LABELS[u.masia] || u.masia) : '';
      return `
        <button class="user-manage-card" data-edit-user="${esc(u.id)}">
          <div class="user-manage-main">
            <span class="user-manage-name">${esc(u.nom || '(sense nom)')}</span>
            <span class="user-manage-email">${esc(u.email || '')}</span>
            ${masiaTxt ? `<span class="user-manage-masia">${esc(masiaTxt)}</span>` : ''}
          </div>
          <span class="user-manage-rol rol-${esc(u.rol)}">${esc(ROL_LABELS[u.rol] || u.rol || '—')}</span>
        </button>`;
    }).join('');

  } catch (err) {
    el.innerHTML = `<div class="reports-loading" style="color:var(--low)">${esc(err.message)}</div>`;
  }
}

function openUserModal(user = null) {
  state.editingUserId = user?.id || null;
  document.getElementById('modal-user-title').textContent = user ? 'Editar usuari' : 'Nou usuari';
  document.getElementById('btn-delete-user').hidden = !user;
  document.getElementById('user-pw-hint').textContent = user ? '(deixa-ho buit per no canviar)' : '*';

  document.getElementById('f-user-nom').value      = user?.nom   ?? '';
  document.getElementById('f-user-email').value    = user?.email ?? '';
  document.getElementById('f-user-password').value = '';
  document.getElementById('f-user-rol').value      = user?.rol   ?? 'comensal';
  document.getElementById('f-user-masia').value    = user?.masia ?? '';

  const errEl = document.getElementById('user-error');
  errEl.hidden = true; errEl.textContent = '';
  updateUserMasiaVisibility();

  document.getElementById('modal-user').classList.add('open');
  setTimeout(() => document.getElementById('f-user-nom').focus(), 380);
}

function closeUserModal() {
  document.getElementById('modal-user').classList.remove('open');
  state.editingUserId = null;
}

function updateUserMasiaVisibility() {
  const rol = document.getElementById('f-user-rol').value;
  document.getElementById('user-masia-field').style.visibility = (rol === 'comensal') ? 'visible' : 'hidden';
}

async function saveUser() {
  const nom      = document.getElementById('f-user-nom').value.trim();
  const email    = document.getElementById('f-user-email').value.trim();
  const password = document.getElementById('f-user-password').value;
  const rol      = document.getElementById('f-user-rol').value;
  const masia    = (rol === 'comensal') ? document.getElementById('f-user-masia').value : '';
  const errEl    = document.getElementById('user-error');
  const btn      = document.getElementById('btn-save-user');
  const editing  = state.editingUserId;

  if (!nom || !email || (!editing && !password)) {
    errEl.textContent = 'Omple nom, email i contrasenya';
    errEl.hidden = false;
    return;
  }

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Desant…';
  errEl.hidden = true;

  try {
    if (editing) {
      const payload = { id: editing, email, nom, rol, masia };
      if (password) payload.password = password;
      await callManageUsers('update', payload);
      toast('Usuari actualitzat');
    } else {
      await callManageUsers('create', { email, password, nom, rol, masia });
      toast('Usuari creat');
    }
    closeUserModal();
    renderUsers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function deleteUser() {
  const id = state.editingUserId;
  if (!id) return;
  const u = (state.usersCache || []).find(x => x.id === id);
  if (!confirm(`Eliminar l'usuari "${u?.nom || u?.email || ''}"?\nAquesta acció no es pot desfer.`)) return;

  const btn = document.getElementById('btn-delete-user');
  btn.disabled = true;
  try {
    await callManageUsers('delete', { id });
    toast('Usuari eliminat');
    closeUserModal();
    renderUsers();
  } catch (err) {
    const errEl = document.getElementById('user-error');
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
  }
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
  if (view === 'stats')   renderStats();
  if (view === 'cats')    renderCats();
  if (view === 'orders')  renderOrders();
  if (view === 'catalog') renderCatalogView();
  if (view === 'reports') renderReports();
  if (view === 'users')   renderUsers();
}

// ── EVENT DELEGATION ───────────────────────────────────────────────

document.addEventListener('click', e => {
  // Edit article button
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    const item = state.items.find(i => i.id === editBtn.dataset.edit);
    if (item) openItemModal(item);
    return;
  }

  // Edit order button
  const editOrder = e.target.closest('[data-edit-order]');
  if (editOrder) {
    const o = state.orders.find(x => x.id === editOrder.dataset.editOrder);
    if (o) openOrderModal(o);
    return;
  }

  // Edit user button (Admin)
  const editUser = e.target.closest('[data-edit-user]');
  if (editUser) {
    const u = (state.usersCache || []).find(x => x.id === editUser.dataset.editUser);
    if (u) openUserModal(u);
    return;
  }

  // Quantity +/-
  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn && qtyBtn.dataset.delta) {
    updateQty(qtyBtn.dataset.qty, Number(qtyBtn.dataset.delta));
    return;
  }

  // Articles filter pill
  const pill = e.target.closest('#filter-pills .filter-pill');
  if (pill) {
    state.filter = pill.dataset.cat || null;
    renderFilterPills();
    renderItems();
    return;
  }

  // Orders filter pill
  const orderPill = e.target.closest('#orders-filter-strip .filter-pill');
  if (orderPill) {
    state.orderFilter = orderPill.dataset.status;
    renderOrders();
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

  // Send inventory report
  if (e.target.closest('[data-action="send-report"]')) {
    sendInventoryReport();
    return;
  }

  // Bottom nav tab
  const tab = e.target.closest('.nav-tab[data-view]');
  if (tab) {
    setView(tab.dataset.view);
    return;
  }

  // Scan barcode button
  if (e.target.closest('#btn-scan-barcode')) { openScanModal(); return; }

  // Catalog product button
  const catalogBtn = e.target.closest('.catalog-btn[data-catalog]');
  if (catalogBtn) {
    openQtyModal(parseInt(catalogBtn.dataset.catalog));
    return;
  }

  // Backdrop close for all modals
  if (e.target.id === 'modal-item')   { closeItemModal();   return; }
  if (e.target.id === 'modal-cat')    { closeCatModal();    return; }
  if (e.target.id === 'modal-order')  { closeOrderModal();  return; }
  if (e.target.id === 'modal-user')   { closeUserModal();   return; }
  if (e.target.id === 'modal-import') { closeImportModal(); return; }
  if (e.target.id === 'modal-qty')          { closeQtyModal();         return; }
  if (e.target.id === 'modal-new-product')  { closeNewProductModal();   return; }
  if (e.target.id === 'modal-gas')          { closeGasModal();          return; }
});

// ── KEYBOARD ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-item').classList.contains('open'))   { closeItemModal();   return; }
    if (document.getElementById('modal-cat').classList.contains('open'))    { closeCatModal();    return; }
    if (document.getElementById('modal-order').classList.contains('open'))  { closeOrderModal();  return; }
    if (document.getElementById('modal-user').classList.contains('open'))   { closeUserModal();   return; }
    if (document.getElementById('modal-import').classList.contains('open')) { closeImportModal(); return; }
    if (document.getElementById('modal-qty').classList.contains('open'))           { closeQtyModal();          return; }
    if (document.getElementById('modal-new-product').classList.contains('open'))  { closeNewProductModal();    return; }
    if (document.getElementById('modal-gas').classList.contains('open'))          { closeGasModal();           return; }
    if (document.getElementById('modal-scan').classList.contains('open'))         { closeScanModal();           return; }
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
  initUserScreen();

  // Search (Comensal only)
  document.getElementById('btn-search').addEventListener('click', toggleSearch);
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    renderItems();
  });

  // FAB — obre modal segons la vista activa
  document.getElementById('btn-add').addEventListener('click', () => {
    if (state.view === 'orders')  openOrderModal();
    else if (state.view === 'catalog') openNewProductModal();
    else if (state.view === 'users')   openUserModal();
    else openItemModal();
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

  // Modal configuració GAS (Admin)
  document.getElementById('btn-gas-config').addEventListener('click', openGasModal);
  document.getElementById('btn-gas-close').addEventListener('click', closeGasModal);
  document.getElementById('btn-save-gas').addEventListener('click', saveGasUrl);
  document.getElementById('btn-test-gas').addEventListener('click', testGasUrl);
  document.getElementById('gas-form').addEventListener('submit', e => { e.preventDefault(); saveGasUrl(); });

  // Modal nou producte (Comensal)
  document.getElementById('btn-np-close').addEventListener('click', closeNewProductModal);
  document.getElementById('btn-save-new-product').addEventListener('click', saveNewProduct);
  document.getElementById('new-product-form').addEventListener('submit', e => { e.preventDefault(); saveNewProduct(); });

  // Modal quantitat (Comensal)
  document.getElementById('btn-qty-close').addEventListener('click', closeQtyModal);
  document.getElementById('btn-save-qty').addEventListener('click', saveQty);
  document.getElementById('qty-form').addEventListener('submit', e => { e.preventDefault(); saveQty(); });

  // Modal importació
  document.getElementById('btn-import-excel').addEventListener('click', openImportModal);
  document.getElementById('btn-import-close').addEventListener('click', closeImportModal);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

  // File drop zone
  const dropZone = document.getElementById('file-drop-zone');
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
      document.getElementById('import-preview').hidden = false;
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
      document.getElementById('import-preview').hidden = false;
      document.getElementById('btn-confirm-import').hidden = true;
    }
  });

  // Carrega el catàleg de productes en segon pla
  loadCatalog();
  initCatalogSearch();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
