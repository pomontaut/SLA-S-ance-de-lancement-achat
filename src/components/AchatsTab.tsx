import { Fragment, useEffect, useState } from 'react'
import type { Dossier, Lot, Suivi } from '../types'
import { SUIVI_LABELS } from '../types'
import { createLot, deleteLot, listLots, updateLot } from '../data/db'

function parseLeadingNumber(text: string): number | null {
  const match = text.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

function emptyLot(dossierId: string, categorie: string, position: number): Omit<Lot, 'id'> {
  return {
    dossierId,
    categorie,
    designation: '',
    acheteurInitiales: '',
    dateLivraisonEstimative: '',
    quantite: '',
    budgetPu: '',
    budgetTheo: null,
    remarques: '',
    suivi: 'a_faire',
    position,
  }
}

export default function AchatsTab({ dossier }: { dossier: Dossier }) {
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategorie, setNewCategorie] = useState('')

  useEffect(() => {
    refresh()
  }, [dossier.id])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setLots(await listLots(dossier.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function persist(lot: Lot) {
    setLots((prev) => prev.map((l) => (l.id === lot.id ? lot : l)))
    try {
      await updateLot(lot)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function fieldUpdater<K extends keyof Lot>(lot: Lot, key: K) {
    return (value: Lot[K]) => persist({ ...lot, [key]: value })
  }

  async function handleAddLot(categorie: string) {
    try {
      const created = await createLot(emptyLot(dossier.id, categorie, lots.length))
      setLots((prev) => [...prev, created])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleAddCategorie() {
    if (!newCategorie.trim()) return
    await handleAddLot(newCategorie.trim())
    setNewCategorie('')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lot ?')) return
    try {
      await deleteLot(id)
      setLots((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Chargement…</div>

  const sorted = [...lots].sort((a, b) => {
    const catCompare = a.categorie.localeCompare(b.categorie, 'fr', { sensitivity: 'base' })
    return catCompare !== 0 ? catCompare : a.position - b.position
  })

  const categories = Array.from(new Set(sorted.map((l) => l.categorie || '(sans catégorie)')))

  return (
    <div className="card">
      {error && <div className="text-sm text-red-600 mb-3">Erreur : {error}</div>}

      {dossier.acheteurs.length > 0 && (
        <div className="text-xs text-slate-500 mb-3">
          Acheteurs : {dossier.acheteurs.map((a) => `${a.initiales} = ${a.nom}`).join(' · ')}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2">Lot</th>
              <th className="py-2 pr-2">Acheteur</th>
              <th className="py-2 pr-2">Livraison estimée</th>
              <th className="py-2 pr-2">Quantité</th>
              <th className="py-2 pr-2">Budget PU</th>
              <th className="py-2 pr-2">Budget théo.</th>
              <th className="py-2 pr-2">Remarques</th>
              <th className="py-2 pr-2">Suivi</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const rows = sorted.filter((l) => (l.categorie || '(sans catégorie)') === cat)
              return (
                <Fragment key={cat}>
                  <tr className="categorie-header">
                    <td colSpan={9} className="py-2 px-2">
                      {cat}
                    </td>
                  </tr>
                  {rows.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={lot.designation}
                          onChange={(e) => fieldUpdater(lot, 'designation')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input w-16"
                          value={lot.acheteurInitiales}
                          onChange={(e) => fieldUpdater(lot, 'acheteurInitiales')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={lot.dateLivraisonEstimative}
                          onChange={(e) => fieldUpdater(lot, 'dateLivraisonEstimative')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={lot.quantite}
                          onChange={(e) => fieldUpdater(lot, 'quantite')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={lot.budgetPu}
                          onChange={(e) => fieldUpdater(lot, 'budgetPu')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <div className="flex gap-1">
                          <input
                            className="input"
                            type="number"
                            value={lot.budgetTheo ?? ''}
                            onChange={(e) =>
                              fieldUpdater(lot, 'budgetTheo')(e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                          <button
                            className="btn-secondary px-2"
                            title="Estimer à partir de la quantité × budget PU"
                            onClick={() => {
                              const q = parseLeadingNumber(lot.quantite)
                              const pu = parseLeadingNumber(lot.budgetPu)
                              if (q !== null && pu !== null) fieldUpdater(lot, 'budgetTheo')(q * pu)
                            }}
                          >
                            =
                          </button>
                        </div>
                      </td>
                      <td className="py-1 pr-2">
                        <textarea
                          className="input min-h-[38px]"
                          value={lot.remarques}
                          onChange={(e) => fieldUpdater(lot, 'remarques')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          className="input"
                          value={lot.suivi}
                          onChange={(e) => fieldUpdater(lot, 'suivi')(e.target.value as Suivi)}
                        >
                          {Object.entries(SUIVI_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1">
                        <button className="btn-danger" onClick={() => handleDelete(lot.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={9} className="py-1">
                      <button className="btn-secondary text-xs" onClick={() => handleAddLot(cat === '(sans catégorie)' ? '' : cat)}>
                        + Ajouter un lot dans « {cat} »
                      </button>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
        <input
          className="input max-w-xs"
          placeholder="Nouvelle catégorie (ex. BPE, Armatures…)"
          value={newCategorie}
          onChange={(e) => setNewCategorie(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategorie()}
        />
        <button className="btn-primary" onClick={handleAddCategorie}>
          + Ajouter une catégorie
        </button>
      </div>
    </div>
  )
}
