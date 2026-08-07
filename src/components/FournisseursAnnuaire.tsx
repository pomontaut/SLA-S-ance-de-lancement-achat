import { useEffect, useState } from 'react'
import type { Fournisseur } from '../data/fournisseurs'
import { loadFournisseurs, searchFournisseurs } from '../data/fournisseurs'

export default function FournisseursAnnuaire() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fournisseur[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFournisseurs().then((all) => setTotal(all.length))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    searchFournisseurs(query, 100).then((r) => {
      if (!cancelled) {
        setResults(r)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Annuaire fournisseurs</h2>
        {total != null && <span className="text-sm text-slate-500">{total.toLocaleString('fr-CH')} fournisseurs</span>}
      </div>

      <input
        className="input mb-4"
        placeholder="Rechercher par nom, ville, NPA…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="card divide-y divide-slate-100">
        {loading && <p className="text-sm text-slate-500 py-4">Chargement…</p>}
        {!loading && results.length === 0 && <p className="text-sm text-slate-500 py-4">Aucun fournisseur trouvé.</p>}
        {results.map((f) => (
          <div key={f.id ?? f.nom} className="py-3">
            <div className="font-medium text-sm">{f.nom}</div>
            <div className="text-xs text-slate-500">
              {[f.adresse, [f.npa, f.lieu].filter(Boolean).join(' ')].filter(Boolean).join(' — ')}
            </div>
            {(f.telephone || f.email) && (
              <div className="text-xs text-slate-400">{[f.telephone, f.email].filter(Boolean).join(' · ')}</div>
            )}
          </div>
        ))}
      </div>
      {!loading && results.length >= 100 && (
        <p className="text-xs text-slate-400 mt-2">100 premiers résultats — affinez votre recherche.</p>
      )}
    </div>
  )
}
