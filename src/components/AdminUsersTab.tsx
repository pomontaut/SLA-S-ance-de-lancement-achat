import { useEffect, useState } from 'react'
import type { Profile } from '../types'
import { listProfiles, updateProfilePermissions } from '../data/db'
import { PERMISSIONS } from '../data/permissions'

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

const GROUPED_PERMISSIONS = groupBy(PERMISSIONS, (p) => p.groupe)

function UserCard({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [form, setForm] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(profile)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfilePermissions(profile.id, form)
      setForm(updated)
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
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

      {!form.isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from(GROUPED_PERMISSIONS.entries()).map(([groupe, perms]) => (
            <div key={groupe}>
              <div className="text-xs uppercase text-slate-500 font-semibold mb-1.5">{groupe}</div>
              <div className="space-y-1">
                {perms.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[p.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [p.key]: e.target.checked }))}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {form.isAdmin && <p className="text-xs text-slate-400">Droit d'administrateur : tous les onglets sont visibles, pas besoin de les cocher un par un.</p>}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <button className="btn-primary" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {dirty && (
          <button className="btn-secondary" disabled={saving} onClick={() => setForm(profile)}>
            Annuler
          </button>
        )}
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
          Cochez les onglets que chaque personne peut voir. Un compte nouvellement créé n'a aucun droit par défaut —
          il n'est visible qu'après avoir été coché ici.
        </p>
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  )
}
