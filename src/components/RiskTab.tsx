import { useMemo, useState } from 'react'
import type { EvalRecord } from '../data/evaluationsHistorique'
import { SECTEURS, riskWatchlist, topMovers } from '../data/evaluationsHistorique'
import { secteurColor } from '../data/palette'

function formatCurrency(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

export default function RiskTab({ all, onZoom }: { all: EvalRecord[]; onZoom: (nom: string) => void }) {
  const [secteurMovers, setSecteurMovers] = useState('GC')

  const watchlist = useMemo(() => riskWatchlist(all), [all])
  const movers = useMemo(() => topMovers(all, secteurMovers), [all, secteurMovers])

  const critiques = watchlist.filter((w) => w.gravite === 'critical')
  const avertissements = watchlist.filter((w) => w.gravite === 'warning')

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold mb-1">Watchlist — fournisseurs à surveiller</h3>
        <p className="text-xs text-slate-500 mb-3">
          Calculée automatiquement sur la dernière année disponible de chaque secteur : notes critiques (&lt; 2), fort
          volume d'achat avec note &lt; 3 (top 20% du CA du secteur), fortes baisses (≥ 0,5 pt) et nouveaux fournisseurs
          mal notés dès leur première évaluation.
        </p>
        {watchlist.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune alerte détectée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Fournisseur</th>
                  <th className="py-2 pr-2">Secteur</th>
                  <th className="py-2 pr-2">Année</th>
                  <th className="py-2 pr-2">Note</th>
                  <th className="py-2 pr-2">Montant</th>
                  <th className="py-2 pr-2">Motif</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {[...critiques, ...avertissements].map((w, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-medium">{w.nom}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: secteurColor(w.secteur) }}
                      >
                        {w.secteur}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">{w.annee}</td>
                    <td className="py-1.5 pr-2 font-medium">{w.note} / 5</td>
                    <td className="py-1.5 pr-2">{formatCurrency(w.ca)}</td>
                    <td className="py-1.5 pr-2">
                      <span className={w.gravite === 'critical' ? 'text-red-600' : 'text-amber-600'}>{w.motif}</span>
                    </td>
                    <td className="py-1.5">
                      <button className="btn-secondary text-xs" onClick={() => onZoom(w.nom)}>
                        Zoom
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Plus fortes évolutions (année vs année précédente)</h3>
          <select className="input w-32" value={secteurMovers} onChange={(e) => setSecteurMovers(e.target.value)}>
            {SECTEURS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs uppercase text-green-600 mb-2">Plus fortes hausses</h4>
            {movers.hausses.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune donnée.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {movers.hausses.map((m) => (
                  <li key={m.nom} className="flex justify-between">
                    <button className="text-left hover:underline" onClick={() => onZoom(m.nom)}>
                      {m.nom}
                    </button>
                    <span className="text-green-600 font-medium">
                      {m.noteAnterieure} → {m.noteActuelle} ({m.evolution >= 0 ? '+' : ''}
                      {m.evolution})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs uppercase text-red-600 mb-2">Plus fortes baisses</h4>
            {movers.baisses.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune donnée.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {movers.baisses.map((m) => (
                  <li key={m.nom} className="flex justify-between">
                    <button className="text-left hover:underline" onClick={() => onZoom(m.nom)}>
                      {m.nom}
                    </button>
                    <span className="text-red-600 font-medium">
                      {m.noteAnterieure} → {m.noteActuelle} ({m.evolution})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
