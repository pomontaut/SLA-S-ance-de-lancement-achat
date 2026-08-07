import { useEffect, useState } from 'react'
import type { Dossier } from '../types'
import { createDossier, listDossiers } from '../data/db'

const EMPTY_NEW = { numeroChantier: '', adresse: '', client: '' }

export default function DossiersList({ onOpen }: { onOpen: (id: string) => void }) {
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_NEW)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setDossiers(await listDossiers())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.numeroChantier.trim() && !form.adresse.trim()) return
    setCreating(true)
    try {
      const dossier = await createDossier({
        numeroChantier: form.numeroChantier,
        adresse: form.adresse,
        client: form.client,
        architecte: '',
        ingenieur: '',
        conducteurTravaux: '',
        contremaitre: '',
        typologieTravaux: '',
        planningDemarrage: '',
        planningFin: '',
        conditions: '',
        garanties: '',
        deductionsContractuelles: '',
        documentsDisposition: [],
        particularites: [],
        acheteurs: [],
      })
      setForm(EMPTY_NEW)
      setShowForm(false)
      onOpen(dossier.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dossiers SLA</h2>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          + Nouveau dossier
        </button>
      </div>

      {error && (
        <div className="card border-red-300 bg-red-50 mb-4 text-sm text-red-700">Erreur : {error}</div>
      )}

      {showForm && (
        <div className="card mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">N° chantier</label>
              <input
                className="input"
                value={form.numeroChantier}
                onChange={(e) => setForm({ ...form, numeroChantier: e.target.value })}
                placeholder="26-503"
              />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                className="input"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                placeholder="Chemin des Clochettes 20, 22, 22B – Genève"
              />
            </div>
            <div>
              <label className="label">Client</label>
              <input
                className="input"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Halter SA"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={creating} onClick={handleCreate}>
              {creating ? 'Création…' : 'Créer le dossier'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : dossiers.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun dossier pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {dossiers.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpen(d.id)}
              className="card w-full text-left hover:border-indigo-400 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-medium">
                  {d.numeroChantier || 'Sans numéro'} — {d.adresse || 'Adresse non renseignée'}
                </div>
                <div className="text-sm text-slate-500">{d.client}</div>
              </div>
              <span className="text-xs text-slate-400">
                Mis à jour le {new Date(d.updatedAt).toLocaleDateString('fr-CH')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
