import { state, SUPABASE_KEY, MANAGE_USERS_URL, STORAGE_ACCESS_TOKEN, MASIA_LABELS } from './config.js';
import { t } from './i18n.js';
import { esc, toast } from './helpers.js';

export const ROL_LABELS = { comensal: 'Encarregat', coordinador: 'Coordinador', admin: 'Admin' };

async function callManageUsers(action, payload = {}) {
  const token = state.accessToken || localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) throw new Error(t('Sessió no iniciada'));
  const res = await fetch(MANAGE_USERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export async function renderUsers() {
  const el = document.getElementById('users-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">${t('Carregant usuaris…')}</div>`;

  try {
    const { users } = await callManageUsers('list');
    state.usersCache = users || [];

    if (!users.length) {
      el.innerHTML = `<div class="reports-loading">${t('Cap usuari registrat.')}</div>`;
      return;
    }

    const order  = { admin: 0, coordinador: 1, comensal: 2 };
    const sorted = [...users].sort((a, b) =>
      (order[a.rol] ?? 9) - (order[b.rol] ?? 9) || (a.nom || '').localeCompare(b.nom || ''));

    el.innerHTML = sorted.map(u => {
      const masiaTxt = u.masia ? (MASIA_LABELS[u.masia] || u.masia) : '';
      return `
        <button class="user-manage-card" data-edit-user="${esc(u.id)}">
          <div class="user-manage-main">
            <span class="user-manage-name">${esc(u.nom || t('(sense nom)'))}</span>
            <span class="user-manage-email">${esc(u.email || '')}</span>
            ${masiaTxt ? `<span class="user-manage-masia">${esc(masiaTxt)}</span>` : ''}
          </div>
          <span class="user-manage-rol rol-${esc(u.rol)}">${esc(t(ROL_LABELS[u.rol]) || u.rol || '—')}</span>
        </button>`;
    }).join('');

  } catch (err) {
    el.innerHTML = `<div class="reports-loading" style="color:var(--low)">${esc(err.message)}</div>`;
  }
}

export function openUserModal(user = null) {
  state.editingUserId = user?.id || null;
  document.getElementById('modal-user-title').textContent = user ? t('Editar usuari') : t('Nou usuari');
  document.getElementById('btn-delete-user').hidden        = !user;
  document.getElementById('user-pw-hint').textContent      = user ? t('(deixa-ho buit per no canviar)') : '*';

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

export function closeUserModal() {
  document.getElementById('modal-user').classList.remove('open');
  state.editingUserId = null;
}

export function updateUserMasiaVisibility() {
  const rol = document.getElementById('f-user-rol').value;
  document.getElementById('user-masia-field').style.visibility = (rol === 'comensal') ? 'visible' : 'hidden';
}

export async function saveUser() {
  const nom      = document.getElementById('f-user-nom').value.trim();
  const email    = document.getElementById('f-user-email').value.trim();
  const password = document.getElementById('f-user-password').value;
  const rol      = document.getElementById('f-user-rol').value;
  const masia    = (rol === 'comensal') ? document.getElementById('f-user-masia').value : '';
  const errEl    = document.getElementById('user-error');
  const btn      = document.getElementById('btn-save-user');
  const editing  = state.editingUserId;

  if (!nom || !email || (!editing && !password)) {
    errEl.textContent = t('Omple nom, email i contrasenya');
    errEl.hidden = false;
    return;
  }

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = t('Desant…');
  errEl.hidden = true;

  try {
    if (editing) {
      const payload = { id: editing, email, nom, rol, masia };
      if (password) payload.password = password;
      await callManageUsers('update', payload);
      toast(t('Usuari actualitzat'));
    } else {
      await callManageUsers('create', { email, password, nom, rol, masia });
      toast(t('Usuari creat'));
    }
    closeUserModal();
    renderUsers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    btn.disabled    = false;
    btn.textContent = original;
  }
}

export async function deleteUser() {
  const id = state.editingUserId;
  if (!id) return;
  const u = (state.usersCache || []).find(x => x.id === id);
  if (!confirm(t('Eliminar l\'usuari "{name}"?\nAquesta acció no es pot desfer.', { name: u?.nom || u?.email || '' }))) return;

  const btn = document.getElementById('btn-delete-user');
  btn.disabled = true;
  try {
    await callManageUsers('delete', { id });
    toast(t('Usuari eliminat'));
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
