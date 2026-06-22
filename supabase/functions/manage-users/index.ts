// Supabase Edge Function: manage-users
// Gestió CRUD d'usuaris reservada a administradors.
// La service_role key MAI surt al navegador: s'usa només aquí, al servidor.
//
// Desplegament:
//   supabase functions deploy manage-users
// (o enganxa aquest codi a Dashboard → Edge Functions → New function → manage-users)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY          = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Identifica qui crida a partir del seu token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Falta autorització' }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: 'Sessió no vàlida' }, 401);

    // 2. Només administradors
    if (user.user_metadata?.rol !== 'admin') {
      return json({ error: 'Només els administradors poden gestionar usuaris' }, 403);
    }

    // 3. Client amb privilegis d'administrador (service_role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body   = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const users = data.users.map((u) => ({
        id:    u.id,
        email: u.email,
        nom:   u.user_metadata?.nom   || '',
        rol:   u.user_metadata?.rol   || '',
        masia: u.user_metadata?.masia || '',
        created_at: u.created_at,
      }));
      return json({ users });
    }

    if (action === 'create') {
      const { email, password, nom, rol, masia } = body;
      if (!email || !password || !rol) return json({ error: 'Falten camps obligatoris (email, contrasenya, rol)' }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nom: nom || '', rol, masia: masia || null },
      });
      if (error) throw error;
      return json({ user: data.user });
    }

    if (action === 'update') {
      const { id, email, password, nom, rol, masia } = body;
      if (!id) return json({ error: 'Falta l\'identificador de l\'usuari' }, 400);
      const attrs: Record<string, unknown> = {
        user_metadata: { nom: nom || '', rol, masia: masia || null },
      };
      if (email)    attrs.email = email;
      if (password) attrs.password = password;
      const { data, error } = await admin.auth.admin.updateUserById(id, attrs);
      if (error) throw error;
      return json({ user: data.user });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return json({ error: 'Falta l\'identificador de l\'usuari' }, 400);
      if (id === user.id) return json({ error: 'No et pots eliminar a tu mateix' }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Acció desconeguda' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Error intern' }, 500);
  }
});
