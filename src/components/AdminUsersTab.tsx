import { useEffect, useRef, useState } from 'react'
import type { PermissionKey, Profile } from '../types'
import { listProfiles, updateProfilePermissions } from '../data/db'
import { createUserAccount, deleteUserAccount, resetUserPassword } from '../lib/adminUsers'
import { PERMISSIONS, SECTIONS } from '../data/permissions'

/** Case à cocher « tout / rien / partiel » pour une section entière. */
function SectionCheckbox({ state, onChange }: { state: 'all' | 'some' | 'none'; onChange: (value: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])
  return <input ref={ref} type="checkbox" checked={state === 'all'} onChange={(e) => onChange(e.target.checked)} />
}

const PAUSED = PERMISSIONS.filter((p) => p.section === 'pause')
const ALL_KEYS = PERMISSIONS.map((p) => p.key)

function PermissionCheckboxes({
  isAdmin,
  permissions,
  onChange,
}: {
  isAdmin: boolean
  permissions: Record<PermissionKey, boolean>
  /** Applique `value` à un ou plusieurs droits d'un coup (section entière, tout cocher…). */
  onChange: (keys: PermissionKey[], value: boolean) => void
}) {
  if (isAdmin) {
    return (
      <p className="text-xs text-slate-400">Droit d'administrateur : toutes les sections et sous-sections sont visibles, pas besoin de les cocher une par une.</p>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase text-slate-500 font-semibold">Accès</span>
        <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => onChange(ALL_KEYS, true)}>
          Tout cocher
        </button>
        <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => onChange(ALL_KEYS, false)}>
          Tout décocher
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((sec) => {
          const keys = sec.subs.map((sub) => sub.permission)
          const nb = keys.filter((k) => permissions[k]).length
          const state = nb === 0 ? 'none' : nb === keys.length ? 'all' : 'some'
          return (
            <div key={sec.key} className="border border-slate-200 rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <SectionCheckbox state={state} onChange={(v) => onChange(keys, v)} />
                {sec.label}
                <span className="text-[11px] font-normal text-slate-400">
                  ({nb}/{keys.length})
                </span>
              </label>
              <div className="space-y-1 pl-6">
                {sec.subs.map((sub) => (
                  <label key={sub.permission} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={permissions[sub.permission]} onChange={(e) => onChange([sub.permission], e.target.checked)} />
                    {sub.label}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">Fonctionnalités actuellement en pause</summary>
        <div className="space-y-1 mt-2 pl-2">
          {PAUSED.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={permissions[p.key]} onChange={(e) => onChange([p.key], e.target.checked)} />
              {p.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return 'Induni-' + btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 10)
}

const EMPTY_PERMISSIONS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])) as Record<PermissionKey, boolean>

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({ ...EMPTY_PERMISSIONS })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string; emailSent: boolean } | null>(null)

  function reset() {
    setFullName('')
    setEmail('')
    setPassword(generatePassword())
    setIsAdmin(false)
    setAdminCode('')
    setPermissions({ ...EMPTY_PERMISSIONS })
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const { emailSent } = await createUserAccount({ fullName, email, password, isAdmin, adminConfirmationCode: adminCode, permissions })
      setCreated({ email, password, emailSent })
      reset()
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Créer un compte
      </button>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Créer un compte</h3>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>

      {created && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          {created.emailSent ? (
            <>
              Compte <strong>{created.email}</strong> créé. Un e-mail avec le lien de l'application et le mot de passe
              temporaire lui a été envoyé ; il choisira son propre mot de passe à sa première connexion.
            </>
          ) : (
            <>
              Compte <strong>{created.email}</strong> créé, mais l'e-mail automatique n'a pas pu être envoyé —
              communique ce mot de passe temporaire à la personne toi-même :
              <div className="font-mono bg-white border border-green-300 rounded px-2 py-1 mt-1 inline-block">
                {created.password}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nom complet</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" placeholder="prenom.nom@induni.ch" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Mot de passe temporaire</label>
        <div className="flex gap-2">
          <input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPassword(generatePassword())}>
            Régénérer
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Administrateur (voit tout)
      </label>
      {isAdmin && (
        <div>
          <label className="label">Code de confirmation administrateur</label>
          <input className="input" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
        </div>
      )}

      <PermissionCheckboxes
        isAdmin={isAdmin}
        permissions={permissions}
        onChange={(keys, value) => setPermissions((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, value])) }))}
      />

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="pt-2 border-t border-slate-200">
        <button className="btn-primary" disabled={saving || !fullName.trim() || !email.trim() || password.length < 8} onClick={handleCreate}>
          {saving ? 'Création…' : 'Créer le compte'}
        </button>
      </div>
    </div>
  )
}

function UserCard({
  profile,
  onSaved,
  onDeleted,
}: {
  profile: Profile
  onSaved: (p: Profile) => void
  onDeleted: (id: string) => void
}) {
  const [form, setForm] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(profile)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // Seuls les champs modifiés sont envoyés (une colonne de droit absente de la base n'empêche pas
      // d'enregistrer un autre changement ; voir supabase/migration_permissions_sections.sql).
      const patch: Record<string, unknown> = {}
      for (const k of ['fullName', 'isAdmin', ...ALL_KEYS] as (keyof Profile)[]) {
        if (form[k] !== profile[k]) patch[k] = form[k]
      }
      const updated = await updateProfilePermissions(profile.id, patch)
      setForm(updated)
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    setBusy(true)
    setError(null)
    try {
      const newPassword = await resetUserPassword(profile.id)
      setResetPasswordValue(newPassword)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le compte de ${profile.fullName || profile.email} ? Cette action est irréversible.`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteUserAccount(profile.id)
      onDeleted(profile.id)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <input
            className="input font-medium"
            value={form.fullName}
            placeholder="Nom non renseigné"
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <div className="text-xs text-slate-500 mt-1">{form.email}</div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.isAdmin}
            onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))}
          />
          Administrateur (voit tout)
        </label>
      </div>

      <PermissionCheckboxes
        isAdmin={form.isAdmin}
        permissions={form}
        onChange={(keys, value) => setForm((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, value])) }))}
      />

      {resetPasswordValue && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          Nouveau mot de passe généré — communique-le à la personne :
          <div className="font-mono bg-white border border-green-300 rounded px-2 py-1 mt-1 inline-block">
            {resetPasswordValue}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
        <button className="btn-primary" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {dirty && (
          <button className="btn-secondary" disabled={saving} onClick={() => setForm(profile)}>
            Annuler
          </button>
        )}
        <button className="btn-secondary" disabled={busy} onClick={handleResetPassword}>
          Réinitialiser le mot de passe
        </button>
        <button className="btn-danger" disabled={busy} onClick={handleDelete}>
          Supprimer le compte
        </button>
      </div>
    </div>
  )
}

export default function AdminUsersTab() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      setProfiles(await listProfiles())
    } catch (e) {
      setError((e as Error).message)
      setProfiles([])
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Administration — comptes et accès</h2>
        <p className="text-sm text-slate-500 mt-1">
          Crée les comptes directement ici (adresses @induni.ch uniquement) et règle ce que chaque personne peut voir :
          section entière (case du titre) ou sous-section par sous-section. À la création, la personne reçoit automatiquement un e-mail avec le lien et son mot de passe
          temporaire, puis choisit le sien à sa première connexion (le mot de passe s'affiche aussi ici si l'envoi échoue).
        </p>
      </div>

      <CreateUserForm onCreated={refresh} />

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!profiles ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun compte pour l'instant.</p>
      ) : (
        <div className="space-y-4">
          {profiles.map((p) => (
            <UserCard
              key={p.id}
              profile={p}
              onSaved={(updated) => setProfiles((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev))}
              onDeleted={(id) => setProfiles((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
