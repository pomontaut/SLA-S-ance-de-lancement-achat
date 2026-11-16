import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { MOIS_COURTS, dernierMois, lignesSpend, variation } from '../data/spend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { ParetoChart } from './DepenseCharts'
import { useFiltresSpend } from './FiltresSpend'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc1 = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

interface Rang {
  nfr: number
  nom: string
  cur: number
  prev: number
  cumul: number
  classe: 'A' | 'B' | 'C'
  rangPrev: number | null
}

/** Pareto des fournisseurs (règle des 80/20) de la période choisie, comparé à la période égale de l'année précédente. */
export default function ParetoDepense({ onZoom }: { onZoom?: (nom: string) => void }) {
  const f = useFiltresSpend()
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  const [tous, setTous] = useState(false)

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const toutes = useMemo(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const entite = f?.entite ?? ''
  const base = useMemo(() => (entite ? toutes.filter((l) => l.entite === entite) : toutes), [toutes, entite])
  const comparer = !!f && f.annee !== 'toutes'
  const an = comparer ? f!.annee : ''
  const an1 = comparer ? String(Number(an) - 1) : ''
  const partielle = comparer && partielles.includes(an)
  const moisMax = partielle ? dernierMois(toutes, an) : 11
  const libPeriode = comparer ? (partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an}` : an) : 'Toutes années'
  const libPrev = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an1}` : an1

  const { rangs, nPrev, a80Cur, a80Prev, top10Cur, top10Prev, actifsCur, actifsPrev, totalCur, totalPrev } = useMemo(() => {
    const cur = new Map<number, { nom: string; v: number }>()
    const prev = new Map<number, number>()
    for (const l of base) {
      if (comparer ? l.annee === an && l.mois <= moisMax : true) {
        const e = cur.get(l.nfr) ?? { nom: l.nom, v: 0 }
        e.v += l.montant
        cur.set(l.nfr, e)
      }
      if (comparer && l.annee === an1 && l.mois <= moisMax) prev.set(l.nfr, (prev.get(l.nfr) ?? 0) + l.montant)
    }
    const pos = [...cur.entries()].filter(([, e]) => e.v > 0).sort((a, b) => b[1].v - a[1].v)
    const tc = pos.reduce((t, [, e]) => t + e.v, 0)
    const posPrev = [...prev.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    const tp = posPrev.reduce((t, [, v]) => t + v, 0)
    const rangPrev = new Map(posPrev.map(([nfr], i) => [nfr, i + 1]))
    let cum = 0
    const rangs: Rang[] = pos.map(([nfr, e]) => {
      const avant = tc ? cum / tc : 0
      cum += e.v
      return { nfr, nom: e.nom, cur: e.v, prev: prev.get(nfr) ?? 0, cumul: tc ? (cum / tc) * 100 : 0, classe: avant < 0.8 ? 'A' : avant < 0.95 ? 'B' : 'C', rangPrev: rangPrev.get(nfr) ?? null }
    })
    const nb80 = (l: number[], t: number) => {
      let c = 0, n = 0
      for (const v of l) { c += v; n++; if (t && c / t >= 0.8) break }
      return n
    }
    return {
      rangs,
      nPrev: posPrev.length,
      a80Cur: nb80(pos.map(([, e]) => e.v), tc),
      a80Prev: nb80(posPrev.map(([, v]) => v), tp),
      top10Cur: tc ? (pos.slice(0, 10).reduce((t, [, e]) => t + e.v, 0) / tc) * 100 : 0,
      top10Prev: tp ? (posPrev.slice(0, 10).reduce((t, [, v]) => t + v, 0) / tp) * 100 : 0,
      actifsCur: pos.length,
      actifsPrev: posPrev.length,
      totalCur: tc,
      totalPrev: tp,
    }
  }, [base, comparer, an, an1, moisMax])

  const affiche = tous ? rangs.slice(0, 200) : rangs.filter((r) => r.classe === 'A').slice(0, 30)

  function exporter() {
    exportXlsx(`pareto_depense_${dateFichier()}`, [
      {
        nom: 'Pareto',
        lignes: [
          [`Pareto des fournisseurs — ${libPeriode}${entite ? ` — ${entite}` : ''}`],
          ['Rang', 'Fournisseur', `Montant ${libPeriode}`, '% du total', '% cumulé', 'Classe', comparer ? `Montant ${libPrev}` : '', 'Évolution %', comparer ? `Rang ${libPrev}` : ''],
          ...rangs.map((r, i) => [i + 1, r.nom, Math.round(r.cur), totalCur ? Math.round((r.cur / totalCur) * 1000) / 10 : null, Math.round(r.cumul * 10) / 10, r.classe, comparer ? Math.round(r.prev) : null, comparer && variation(r.cur, r.prev) != null ? Math.round(variation(r.cur, r.prev)! * 10) / 10 : null, r.rangPrev] as (string | number | null)[]),
        ],
      },
    ])
  }

  const tuile = (label: string, cur: string, prev: string | null) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-indigo-600 tabular-nums">{cur}</div>
      {prev != null && <div className="text-[11px] text-slate-400">{libPrev} : {prev}</div>}
    </div>
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="font-semibold">Pareto des fournisseurs — {libPeriode}</h3>
        {rangs.length > 0 && (
          <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
            ⬇ Excel
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Classe A = fournisseurs qui font les 80 % premiers de la dépense, B jusqu'à 95 %, C le reste.
        {comparer ? ` Comparé à ${libPrev} (période égale).` : ''}
      </p>
      {!fournisseurs ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : rangs.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tuile('Fournisseurs = 80 % de la dépense', String(a80Cur), comparer ? String(a80Prev) : null)}
            {tuile('Part du Top 10', pc1(top10Cur), comparer ? pc1(top10Prev) : null)}
            {tuile('Fournisseurs actifs', fmt(actifsCur), comparer ? fmt(actifsPrev) : null)}
            {tuile('Dépense HT', fmt(totalCur), comparer ? fmt(totalPrev) : null)}
          </div>
          <ParetoChart valeurs={rangs.map((r) => r.cur)} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-2">Rang</th>
                  <th className="py-1 px-2">Fournisseur</th>
                  <th className="py-1 px-2 text-right">{libPeriode}</th>
                  <th className="py-1 px-2 text-right">% cumulé</th>
                  <th className="py-1 px-2">Classe</th>
                  {comparer && <th className="py-1 px-2 text-right">{libPrev}</th>}
                  {comparer && <th className="py-1 px-2 text-right">Évolution</th>}
                  {comparer && <th className="py-1 px-2 text-right">Rang {an1}</th>}
                </tr>
              </thead>
              <tbody>
                {affiche.map((r) => {
                  const rang = rangs.indexOf(r) + 1
                  const v = variation(r.cur, r.prev)
                  return (
                    <tr key={r.nfr} className="border-b border-slate-100">
                      <td className="py-1 px-2 tabular-nums text-slate-500">{rang}</td>
                      <td className="py-1 px-2">
                        {onZoom ? (
                          <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(r.nom)}>
                            {r.nom}
                          </button>
                        ) : (
                          r.nom
                        )}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(r.cur)}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-slate-500">{pc1(r.cumul)}</td>
                      <td className="py-1 px-2">{r.classe}</td>
                      {comparer && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{r.prev ? fmt(r.prev) : '—'}</td>}
                      {comparer && (
                        <td className="py-1 px-2 text-right tabular-nums" style={{ color: v == null ? '#94a3b8' : v < 0 ? '#b91c1c' : '#15803d' }}>
                          {v == null ? 'Nouveau' : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} %`}
                        </td>
                      )}
                      {comparer && (
                        <td className="py-1 px-2 text-right tabular-nums text-slate-500">
                          {r.rangPrev ?? '—'}
                          {r.rangPrev != null && r.rangPrev !== rang && (
                            <span style={{ color: r.rangPrev > rang ? '#15803d' : '#b91c1c' }}> {r.rangPrev > rang ? '▲' : '▼'}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button className="text-xs text-indigo-600 hover:underline" onClick={() => setTous((v) => !v)}>
            {tous ? 'Réduire à la classe A' : `Voir les ${Math.min(200, rangs.length)} premiers fournisseurs`}
          </button>
          {comparer && nPrev === 0 && <p className="text-xs text-slate-400">Pas de dépense {libPrev} pour cette sélection : comparaison indisponible.</p>}
        </div>
      )}
    </div>
  )
}
