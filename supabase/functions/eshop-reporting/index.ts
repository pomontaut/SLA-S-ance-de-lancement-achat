// Edge Function "eshop-reporting" — relaie le reporting articles des commandes ESHOP-INDUNI
// (GET {ESHOP_URL}/api/reporting/sla) vers l'application. Passe par une fonction serveur pour que le
// jeton serveur-à-serveur (ESHOP_REPORTING_TOKEN, = SLA_REPORTING_TOKEN côté e-shop) ne soit
// JAMAIS envoyé au navigateur.
//
// Variables d'environnement de la fonction : ESHOP_URL (ex. https://eshop.induni.ch),
// ESHOP_REPORTING_TOKEN. Accès : utilisateur connecté avec le droit « Analyse de la dépense »
// (can_view_depense) ou administrateur. Les prix confidentiels (Sika…) sont déjà masqués par l'e-shop.
//
// POST, body JSON optionnel { from?, to?, supplier? } (dates AAAA-MM-JJ).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PERMANENT_ADMIN_EMAILS = ['pomontaut@induni.ch']

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const eshopUrl = (Deno.env.get('ESHOP_URL') ?? '').replace(/\/+$/, '')
  const token = Deno.env.get('ESHOP_REPORTING_TOKEN') ?? ''
  if (!eshopUrl || !token) return jsonResponse({ error: 'Export e-shop non configuré (ESHOP_URL / ESHOP_REPORTING_TOKEN).' }, 503)

  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user) return jsonResponse({ error: 'Non authentifié.' }, 401)

  // Lecture du profil avec le JWT de l'appelant (la RLS lui donne accès à sa propre ligne).
  const email = (callerData.user.email ?? '').toLowerCase()
  let allowed = PERMANENT_ADMIN_EMAILS.includes(email)
  if (!allowed) {
    const { data: profile } = await caller.from('profiles').select('is_admin, can_view_depense').eq('id', callerData.user.id).maybeSingle()
    allowed = Boolean(profile?.is_admin || profile?.can_view_depense)
  }
  if (!allowed) return jsonResponse({ error: "Accès réservé au droit « Analyse de la dépense »." }, 403)

  let payload: Record<string, unknown> = {}
  try {
    payload = await req.json()
  } catch {
    // corps vide : pas de filtre
  }
  const qs = new URLSearchParams()
  for (const k of ['from', 'to', 'supplier'] as const) {
    const v = String(payload[k] ?? '').trim()
    if (v) qs.set(k, v)
  }

  const res = await fetch(`${eshopUrl}/api/reporting/sla?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) return jsonResponse({ error: `E-shop indisponible (HTTP ${res.status}).` }, 502)
  return jsonResponse(await res.json())
})
