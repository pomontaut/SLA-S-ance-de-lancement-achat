import { useEffect, useState } from 'react'
import type { Fournisseur } from '../data/fournisseurs'
import { searchFournisseurs } from '../data/fournisseurs'

export default function SupplierPicker({
  onSelect,
  onClose,
}: {
  onSelect: (fournisseur: Fournisseur) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    searchFournisseurs(query).then((r) => {
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
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Rechercher un fournisseur</h3>
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
        <input
          className="input mb-3"
          autoFocus
          placeholder="Nom, ville, NPA…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {loading && <p className="text-sm text-slate-500 py-4">Chargement…</p>}
          {!loading && results.length === 0 && <p className="text-sm text-slate-500 py-4">Aucun fournisseur trouvé.</p>}
          {results.map((f) => (
            <button
              key={f.id ?? f.nom}
              className="w-full text-left py-2 px-1 hover:bg-slate-50 rounded"
              onClick={() => {
                onSelect(f)
                onClose()
              }}
            >
              <div className="font-medium text-sm">{f.nom}</div>
              <div className="text-xs text-slate-500">
                {[f.adresse, [f.npa, f.lieu].filter(Boolean).join(' ')].filter(Boolean).join(' — ')}
              </div>
              {(f.telephone || f.email) && (
                <div className="text-xs text-slate-400">{[f.telephone, f.email].filter(Boolean).join(' · ')}</div>
              )}
            </button>
          ))}
        </div>
        {!loading && (
          <p className="text-xs text-slate-400 mt-3">
            {results.length >= 50 ? '50 premiers résultats — affinez votre recherche.' : `${results.length} résultat(s)`}
          </p>
        )}
      </div>
    </div>
  )
}
