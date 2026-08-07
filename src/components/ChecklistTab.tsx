import { Fragment, useEffect, useState } from 'react'
import type { ChecklistItem, Dossier } from '../types'
import { createChecklistItem, deleteChecklistItem, listChecklistItems, updateChecklistItem } from '../data/db'
import { OUI_NON_OPTIONS, STATUT_DOCUMENT_OPTIONS } from '../data/lists'

export default function ChecklistTab({ dossier }: { dossier: Dossier }) {
  const [items, setItems] = useState<ChecklistItem[]>([])
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
      setItems(await listChecklistItems(dossier.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function persist(item: ChecklistItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
    try {
      await updateChecklistItem(item)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function fieldUpdater<K extends keyof ChecklistItem>(item: ChecklistItem, key: K) {
    return (value: ChecklistItem[K]) => persist({ ...item, [key]: value })
  }

  async function handleAdd(categorie: string) {
    try {
      const created = await createChecklistItem({
        dossierId: dossier.id,
        position: items.length,
        categorie,
        document: '',
        requis: 'Oui',
        statut: 'À confirmer',
        versionDate: '',
        responsable: '',
        echeance: '',
        lienRemarque: '',
      })
      setItems((prev) => [...prev, created])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleAddCategorie() {
    if (!newCategorie.trim()) return
    await handleAdd(newCategorie.trim())
    setNewCategorie('')
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette ligne ?')) return
    try {
      await deleteChecklistItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Chargement…</div>

  const categories = Array.from(new Set(items.map((i) => i.categorie || '(sans catégorie)')))

  return (
    <div className="card">
      {error && <div className="text-sm text-red-600 mb-3">Erreur : {error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2">Document / information</th>
              <th className="py-2 pr-2">Requis ?</th>
              <th className="py-2 pr-2">Statut</th>
              <th className="py-2 pr-2">Version / date</th>
              <th className="py-2 pr-2">Responsable</th>
              <th className="py-2 pr-2">Échéance</th>
              <th className="py-2 pr-2">Lien / remarque</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const rows = items.filter((i) => (i.categorie || '(sans catégorie)') === cat)
              return (
                <Fragment key={cat}>
                  <tr className="categorie-header">
                    <td colSpan={8} className="py-2 px-2">
                      {cat}
                    </td>
                  </tr>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={item.document}
                          onChange={(e) => fieldUpdater(item, 'document')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select className="input" value={item.requis} onChange={(e) => fieldUpdater(item, 'requis')(e.target.value)}>
                          {OUI_NON_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <select className="input" value={item.statut} onChange={(e) => fieldUpdater(item, 'statut')(e.target.value)}>
                          {STATUT_DOCUMENT_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={item.versionDate}
                          onChange={(e) => fieldUpdater(item, 'versionDate')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={item.responsable}
                          onChange={(e) => fieldUpdater(item, 'responsable')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={item.echeance}
                          onChange={(e) => fieldUpdater(item, 'echeance')(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="input"
                          value={item.lienRemarque}
                          onChange={(e) => fieldUpdater(item, 'lienRemarque')(e.target.value)}
                        />
                      </td>
                      <td className="py-1">
                        <button className="btn-danger" onClick={() => handleDelete(item.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8} className="py-1">
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => handleAdd(cat === '(sans catégorie)' ? '' : cat)}
                      >
                        + Ajouter une ligne dans « {cat} »
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
          placeholder="Nouvelle catégorie (ex. Contrat, Budget…)"
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
