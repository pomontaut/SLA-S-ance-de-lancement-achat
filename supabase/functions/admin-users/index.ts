// Edge Function "admin-users" — création / réinitialisation de mot de passe / suppression de
// comptes, réservé aux administrateurs. Tourne côté serveur (Deno, infrastructure Supabase) car
// c'est le SEUL endroit autorisé à utiliser la clé service_role (accès total à la base) — cette
// clé ne doit JAMAIS être envoyée au navigateur. Déployée séparément du frontend statique.
//
// Actions (POST, body JSON { action, ... }) :
//   - create         { fullName, email, password, isAdmin, adminConfirmationCode?, <droits...> }
//   - reset_password { userId }
//   - delete         { userId }
//
// Sécurité : même principe que ADMIN_PROMOTION_CODE côté ESHOP-INDUNI — accorder le droit
// administrateur à la création exige un code secret (ADMIN_PROMOTION_CODE, variable d'env de
// cette fonction), pour qu'une session admin compromise ne suffise pas seule à créer un autre
// admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PERMISSION_FIELDS = [
  'canViewOverview',
  'canViewSecteur',
  'canViewComparaison',
  'canViewDepense',
  'canViewConsortium',
  'canViewBlacklist',
  'canViewFormulaire',
  'canViewZoomEvaluation',
  'canViewChantiers',
  'canViewSynthese',
  'canViewAnalyseFournisseurs',
  'canViewPaiement',
  'canViewRequete',
  'canViewContrats',
  'canViewZoomFournisseur',
  'canViewBfa',
  'canViewSeanceLancement',
  'canViewFournisseurs',
] as const

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return 'Induni-' + btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 10)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Retourne null si l'e-mail est parti, sinon la raison de l'échec (affichée à l'administrateur).
 * Envoie au nouvel utilisateur le lien de l'app + son mot de passe temporaire (Resend).
 * Secrets : RESEND_API_KEY, MAIL_FROM (ex. « Induni Achats <achats@induni.ch> »), APP_URL. */
async function sendCredentialsEmail(
  to: string,
  fullName: string,
  tempPassword: string,
  fallbackUrl = '',
): Promise<string | null> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM')
  // APP_URL peut être saisi sans « https:// » (lien alors cassé) ou absent : on le normalise
  // et, à défaut, on reprend l'adresse de l'app depuis laquelle l'admin a créé le compte.
  let appUrl = (Deno.env.get('APP_URL') ?? '').trim() || fallbackUrl.trim()
  if (appUrl && !/^https?:\/\//i.test(appUrl)) appUrl = `https://${appUrl}`
  appUrl = appUrl.replace(/\/+$/, '')
  if (!apiKey) return "secret RESEND_API_KEY absent dans Supabase (Edge Functions > Secrets)"
  if (!from) return "secret MAIL_FROM absent dans Supabase (Edge Functions > Secrets)"

  const html = `
    <p>Bonjour ${escapeHtml(fullName)},</p>
    <p>Un compte a été créé pour vous.</p>
    <p><strong>Adresse :</strong> ${escapeHtml(to)}<br>
       <strong>Mot de passe temporaire :</strong> ${escapeHtml(tempPassword)}</p>
    ${appUrl ? `<p><a href="${escapeHtml(appUrl)}">Cliquez ici pour vous connecter</a><br>${escapeHtml(appUrl)}</p>` : ''}
    <p>À votre première connexion, il vous sera demandé de choisir votre propre mot de passe.</p>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Votre accès — Induni', html }),
    })
    if (res.ok) return null
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    return `Resend a refusé l'envoi (HTTP ${res.status}) : ${detail}`
  } catch (e) {
    return `Resend injoignable : ${(e as Error).message}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Non authentifié.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Admin permanent (même filet de sécurité que is_admin() côté SQL et isAdminProfile() côté app)
  // + sinon lecture du flag is_admin sur le profil de l'appelant.
  const PERMANENT_ADMIN_EMAILS = ['pomontaut@induni.ch']
  let callerIsAdmin = PERMANENT_ADMIN_EMAILS.includes((callerData.user.email ?? '').toLowerCase())
  if (!callerIsAdmin) {
    const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('id', callerData.user.id).maybeSingle()
    callerIsAdmin = Boolean(callerProfile?.is_admin)
  }
  if (!callerIsAdmin) {
    return jsonResponse({ error: 'Accès réservé aux administrateurs.' }, 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400)
  }

  const action = payload.action

  if (action === 'create') {
    const email = String(payload.email ?? '').trim().toLowerCase()
    const fullName = String(payload.fullName ?? '').trim()
    const password = String(payload.password ?? '')
    const wantsAdmin = Boolean(payload.isAdmin)

    if (!email.endsWith('@induni.ch')) {
      return jsonResponse({ error: 'Seules les adresses @induni.ch sont autorisées.' }, 400)
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, 400)
    }
    if (wantsAdmin) {
      const expected = Deno.env.get('ADMIN_PROMOTION_CODE')
      const provided = String(payload.adminConfirmationCode ?? '')
      if (!expected || provided !== expected) {
        return jsonResponse({ error: 'Code de confirmation administrateur invalide ou manquant.' }, 400)
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, must_change_password: true },
    })
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? 'Échec de la création du compte.' }, 400)
    }

    const profilePatch: Record<string, unknown> = { full_name: fullName, is_admin: wantsAdmin }
    for (const key of PERMISSION_FIELDS) {
      profilePatch[toSnake(key)] = Boolean(payload[key])
    }
    // Le trigger on_auth_user_created a déjà inséré une ligne vide — on la complète ici.
    const { error: profileError } = await admin.from('profiles').update(profilePatch).eq('id', created.user.id)
    if (profileError) {
      return jsonResponse({ error: `Compte créé mais erreur sur les droits : ${profileError.message}` }, 500)
    }

    // Envoi automatique des accès ; un échec d'envoi ne bloque pas la création.
    const emailError = await sendCredentialsEmail(email, fullName, password, req.headers.get('origin') ?? '')
    return jsonResponse({ ok: true, userId: created.user.id, emailSent: emailError === null, emailError })
  }

  if (action === 'reset_password') {
    const userId = String(payload.userId ?? '')
    if (!userId) return jsonResponse({ error: 'userId manquant.' }, 400)
    const newPassword = generatePassword()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      user_metadata: { must_change_password: true },
    })
    if (error) return jsonResponse({ error: error.message }, 400)
    // « Renvoyer le lien » : nouveau mot de passe temporaire + e-mail d'accès (lien de l'app).
    let emailError: string | null = null
    if (payload.sendEmail) {
      const { data: target } = await admin.auth.admin.getUserById(userId)
      const email = target?.user?.email ?? ''
      const fullName = String(target?.user?.user_metadata?.full_name ?? email)
      emailError = email
        ? await sendCredentialsEmail(email, fullName, newPassword, req.headers.get('origin') ?? '')
        : "adresse e-mail introuvable pour ce compte"
    }
    return jsonResponse({ ok: true, password: newPassword, emailSent: emailError === null, emailError })
  }

  if (action === 'delete') {
    const userId = String(payload.userId ?? '')
    if (!userId) return jsonResponse({ error: 'userId manquant.' }, 400)
    if (userId === callerData.user.id) {
      return jsonResponse({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)
    }
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return jsonResponse({ error: error.message }, 400)
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: `Action inconnue : ${String(action)}` }, 400)
})
