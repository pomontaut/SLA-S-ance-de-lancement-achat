import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { MOIS_COURTS, dernierMois, lignesSpend, variation } from '../data/spend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { useFiltresSpend } from './FiltresSpend'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')

/** Top 50 fournisseurs d'une année au choix (clic sur l'année), avec le classement de l'année précédente à période égale. */
export default function Top50Fournisseurs({ onZoom }: { onZoom?: (nom: string) => void }) {
  const f = useFiltresSpend()
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  const [choix, setChoix] = useState<string | null>(null)

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const toutes = useMemo(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const entite = f?.entite ?? ''
  const base = useMemo(() => (entite ? toutes.filter((l) => l.entite === entite) : toutes), [toutes, entite])
  const annees = useMemo(() => [...new Set(toutes.map((l) => l.annee))].sort(), [toutes])
  const an = choix ?? (f && f.annee !== 'toutes' ? f.annee : annees[annees.length - 1] ?? '')
  const an1 = String(Number(an) - 1)
  const partielle = partielles.includes(an)
  const moisMax = partielle ? dernierMois(toutes, an) : 11
  const libPeriode = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an}` : an
  const libPrev = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an1}` : an1

  const lignes = useMemo(() => {
    const cur = new Map<number, { nom: string; v: number }>()
    const prev = new Map<number, number>()
    for (const l of base) {
      if (l.annee === an && l.mois <= moisMax) {
        const e = cur.get(l.nfr) ?? { nom: l.nom, v: 0 }
        e.v += l.montant
        cur.set(l.nfr, e)
      }
      if (l.annee === an1 && l.mois <= moisMax) prev.set(l.nfr, (prev.get(l.nfr) ?? 0) + l.montant)
    }
    const rangPrev = new Map([...prev.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([nfr], i) => [nfr, i + 1]))
    const total = [...cur.values()].reduce((t, e) => t + Math.max(0, e.v), 0)
    return [...cur.entries()]
      .filter(([, e]) => e.v > 0)
      .sort((a, b) => b[1].v - a[1].v)
      .slice(0, 50)
      .map(([nfr, e], i) => ({ rang: i + 1, nfr, nom: e.nom, cur: e.v, part: total ? (e.v / total) * 100 : 0, prev: prev.get(nfr) ?? 0, rangPrev: rangPrev.get(nfr) ?? null }))
  }, [base, an, an1, moisMax])

  function exporter() {
    exportXlsx(`top50_fournisseurs_${an}_${dateFichier()}`, [
      {
        nom: 'Top 50',
        lignes: [
          [`Top 50 fournisseurs — ${libPeriode}${entite ? ` — ${entite}` : ''}`],
          ['Rang', 'Fournisseur', `Montant ${libPeriode}`, '% du total', `Rang ${libPrev}`, `Montant ${libPrev}`, 'Évolution %'],
          ...lignes.map((l) => [l.rang, l.nom, Math.round(l.cur), Math.round(l.part * 10) / 10, l.rangPrev, Math.round(l.prev), variation(l.cur, l.prev) != null ? Math.round(variation(l.cur, l.prev)! * 10) / 10 : null] as (string | number | null)[]),
        ],
      },
    ])
  }

  if (!fournisseurs) return null
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="font-semibold">Top 50 fournisseurs — {libPeriode}</h3>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
          ⬇ Excel
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs uppercase text-slate-500 mr-1">Classement de l'année</span>
        {annees.map((a) => (
          <button key={a} className={a === an ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'} onClick={() => setChoix(a)}>
            {a}
            {partielles.includes(a) ? ' (partielle)' : ''}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <th className="py-1.5 px-2">Rang {an}</th>
              <th className="py-1.5 px-2">Fournisseur</th>
              <th className="py-1.5 px-2 text-right">{libPeriode}</th>
              <th className="py-1.5 px-2 text-right">%</th>
              <th className="py-1.5 px-2 text-right">Rang {an1}</th>
              <th className="py-1.5 px-2 text-right">{libPrev}</th>
              <th className="py-1.5 px-2 text-right">Évolution</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const v = variation(l.cur, l.prev)
              const delta = l.rangPrev != null ? l.rangPrev - l.rang : null
              return (
                <tr key={l.nfr} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1 px-2 tabular-nums font-semibold">{l.rang}</td>
                  <td className="py-1 px-2">
                    {onZoom ? (
                      <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(l.nom)}>
                        {l.nom}
                      </button>
                    ) : (
                      l.nom
                    )}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(l.cur)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{l.part.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-600">
                    {l.rangPrev ?? '—'}
                    {delta != null && delta !== 0 && <span style={{ color: delta > 0 ? '#15803d' : '#b91c1c' }}> {delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{l.prev ? fmt(l.prev) : '—'}</td>
                  <td className="py-1 px-2 text-right tabular-nums" style={{ color: v == null ? '#94a3b8' : v < 0 ? '#b91c1c' : '#15803d' }}>
                    {v == null ? 'Nouveau' : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} %`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        Montants HT{entite ? `, entité ${entite}` : ', toutes entités'}. {partielle ? `Année en cours comparée à ${libPrev} (période égale). ` : ''}▲ = progression au classement par rapport à {an1}, ▼ = recul.
      </p>
    </div>
  )
}
