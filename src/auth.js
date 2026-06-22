import {
  SUPABASE_URL, SUPABASE_KEY,
  STORAGE_ACCESS_TOKEN, STORAGE_REFRESH_TOKEN, STORAGE_TOKEN_EXPIRES, STORAGE_USER_PROFILE,
  STORAGE_MASIA, MASIA_LABELS,
  state, loadData,
} from './config.js';
import { setView, render } from './main.js';

// ── SUPABASE AUTH ────────────────────────────────────────────────────

export async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Credencials incorrectes');
  return data;
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

export function clearSession() {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_TOKEN_EXPIRES);
  localStorage.removeItem(STORAGE_USER_PROFILE);
  state.authProfile = null;
  state.accessToken = null;
}

export async function tryRestoreSession() {
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

export function updateHeaderUser() {
  const profile = state.authProfile;
  if (!profile) return;
  const nameEl = document.getElementById('user-pill-name');
  if (nameEl) nameEl.textContent = profile.nom || state.user;
  const roleEl = document.getElementById('user-pill-role');
  if (roleEl) { roleEl.textContent = profile.rol || ''; roleEl.hidden = !profile.rol; }
}

// ── LOGIN / ROLE SCREENS ─────────────────────────────────────────────

export function renderCrumb(navId, crumbs) {
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

export function showLoginScreen() {
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

export async function handleLoginSubmit(e) {
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

// ── ROLE / USER SELECTION ────────────────────────────────────────────

export const ROLE_MAP = {
  'Comensal':    'comensal',
  'Começal':     'comensal',
  'Coordinador': 'coordinador',
  'Admin':       'admin',
};

export function applyRole(name) {
  const role = ROLE_MAP[name] || 'comensal';
  document.body.dataset.role = role;

  loadData();

  const importBtn = document.getElementById('btn-import-excel');
  const gasBtn    = document.getElementById('btn-gas-config');
  if (importBtn) importBtn.hidden = (role !== 'admin');
  if (gasBtn)    gasBtn.hidden    = (role !== 'admin');

  if (role === 'comensal')         setView('catalog');
  else if (role === 'coordinador') setView('reports');
  else if (role === 'admin')       setView('reports');
  else                             setView('orders');

  render();
}

export function selectUser(name) {
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

export function selectMasia(masiaId) {
  state.masia = masiaId;
  localStorage.setItem(STORAGE_MASIA, masiaId);

  const masiaSc = document.getElementById('screen-masia');
  masiaSc.classList.add('leaving');
  setTimeout(() => { masiaSc.hidden = true; }, 400);

  showLoginScreen();
}

export function showUserScreen() {
  clearSession();
  state.user  = null;
  state.masia = null;
  localStorage.removeItem('uauu_inv_user');
  localStorage.removeItem(STORAGE_MASIA);
  document.getElementById('user-pill-name').textContent = '';
  const roleEl = document.getElementById('user-pill-role');
  if (roleEl) { roleEl.textContent = ''; roleEl.hidden = true; }
  document.body.removeAttribute('data-role');

  document.getElementById('screen-masia').hidden = true;
  document.getElementById('screen-masia').classList.remove('leaving');
  document.getElementById('screen-login').hidden = true;
  document.getElementById('screen-login').classList.remove('leaving');

  const screen = document.getElementById('screen-users');
  screen.hidden = false;
  screen.classList.remove('leaving');
  void screen.offsetWidth;
}

export async function initUserScreen() {
  document.querySelectorAll('.user-card[data-user]').forEach(card => {
    card.addEventListener('click', () => selectUser(card.dataset.user));
  });
  document.querySelectorAll('.user-card[data-masia]').forEach(card => {
    card.addEventListener('click', () => selectMasia(card.dataset.masia));
  });
  document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);

  const restored = await tryRestoreSession();
  if (restored) {
    document.getElementById('screen-users').hidden = true;
    updateHeaderUser();
    applyRole(state.user);
    return;
  }

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
}
