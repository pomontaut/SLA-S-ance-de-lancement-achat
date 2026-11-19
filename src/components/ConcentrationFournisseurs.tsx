import { useMemo, useState } from 'react'
import { totaux, variation } from '../data/spend'
import { usePeriodeSpend } from '../data/usePeriodeSpend'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} %`

/** Rappel de la dépense de la période (année en cours) avec N-1 à période égale, en tête d'Analyse fournisseurs. */
export function RappelDepense() {
  const P = usePeriodeSpend()
  const { base, comparer, dansCur, dansPrev, libPeriode, libPrev } = P
  const t = useMemo(() => ({ cur: totaux(base.filter(dansCur)), prev: totaux(base.filter(dansPrev)) }), [base, dansCur, dansPrev])
  if (!P.charge) return null
  const v = comparer ? variation(t.cur.total, t.prev.total) : null
  return (
    <div className="card py-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <span className="text-xs uppercase text-slate-500">Rappel de la dépense — {libPeriode}</span>
      <span className="text-2xl font-bold text-indigo-600 tabular-nums">{fmt(t.cur.total)} <span className="text-sm font-medium text-slate-400">CHF HT</span></span>
      {v != null && (
        <span className={`text-sm font-semibold ${v >= 0 ? 'text-orange-600' : 'text-teal-600'}`}>
          {v >= 0 ? '▲' : '▼'} {Math.abs(v).toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
        </span>
      )}
      {comparer && <span className="text-[11px] text-slate-400">{libPrev} : {fmt(t.prev.total)} CHF</span>}
      <span className="text-[11px] text-slate-400">{fmt(t.cur.nbFournisseurs)} fournisseurs actifs · {fmt(t.cur.nbFactures)} factures</span>
    </div>
  )
}

const TRANCHES = [
  { cle: 'top10', label: 'Top 10', couleur: '#5b94f5' },
  { cle: 'top30', label: 'Top 11 à 30', couleur: '#8fd3a8' },
  { cle: 'autres', label: 'Autres', couleur: '#f4b89b' },
] as const

function repartition(lignes: { nfr: number; montant: number }[]) {
  const m = new Map<number, number>()
  for (const l of lignes) m.set(l.nfr, (m.get(l.nfr) ?? 0) + l.montant)
  const v = [...m.values()].filter((x) => x > 0).sort((a, b) => b - a)
  const total = v.reduce((s, x) => s + x, 0)
  const somme = (a: number, b: number) => v.slice(a, b).reduce((s, x) => s + x, 0)
  const top10 = somme(0, 10), top30 = somme(10, 30), autres = total - top10 - top30
  return { total, nb: v.length, montants: { top10, top30, autres } as Record<string, number> }
}

/** Concentration des fournisseurs : part de la dépense du Top 10, du Top 11 à 30 et des autres (anneau). */
export default function ConcentrationFournisseurs() {
  const P = usePeriodeSpend()
  const { base, comparer, dansCur, dansPrev, libPeriode, libPrev } = P
  const [survol, setSurvol] = useState<string | null>(null)
  const cur = useMemo(() => repartition(base.filter(dansCur)), [base, dansCur])
  const prev = useMemo(() => (comparer ? repartition(base.filter(dansPrev)) : null), [base, dansPrev, comparer])
  if (!P.charge || cur.total <= 0) return null

  const R = 70, W = 32, C = 2 * Math.PI * R
  let acc = 0
  const arcs = TRANCHES.map((t) => {
    const part = cur.montants[t.cle] / cur.total
    const a = { ...t, part, dash: part * C, offset: -acc * C }
    acc += part
    return a
  })
  const actif = arcs.find((a) => a.cle === survol)
  return (
    <div className="card">
      <h3 className="font-semibold">Concentration fournisseurs</h3>
      <p className="text-xs text-slate-500 mb-2">Part de la dépense HT — {libPeriode}{comparer ? ` (petit : ${libPrev})` : ''} · {fmt(cur.nb)} fournisseurs actifs</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-52 h-52 shrink-0">
          <g transform="rotate(-90 100 100)">
            {arcs.map((a) => (
              <circle
                key={a.cle}
                cx="100" cy="100" r={R}
                fill="none" stroke={a.couleur} strokeWidth={survol === a.cle ? W + 4 : W}
                strokeDasharray={`${Math.max(0, a.dash - 1)} ${C}`} strokeDashoffset={a.offset}
                onMouseEnter={() => setSurvol(a.cle)} onMouseLeave={() => setSurvol(null)}
                style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
              />
            ))}
          </g>
          <text x="100" y="94" textAnchor="middle" className="fill-slate-500" fontSize="10">{actif ? actif.label : 'Top 10'}</text>
          <text x="100" y="114" textAnchor="middle" className="fill-slate-800" fontSize="20" fontWeight="700">{pc((actif ?? arcs[0]).part * 100)}</text>
        </svg>
        <table className="text-sm">
          <tbody>
            {arcs.map((a) => {
              const p = prev && prev.total > 0 ? (prev.montants[a.cle] / prev.total) * 100 : null
              const ecart = p != null ? a.part * 100 - p : null
              return (
                <tr key={a.cle} onMouseEnter={() => setSurvol(a.cle)} onMouseLeave={() => setSurvol(null)} className="align-baseline">
                  <td className="pr-3 py-1"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: a.couleur }} />{a.label}</td>
                  <td className="pr-3 py-1 text-right tabular-nums font-semibold">{pc(a.part * 100)}</td>
                  <td className="pr-3 py-1 text-right tabular-nums text-slate-500">{fmt(cur.montants[a.cle])} CHF</td>
                  {p != null && (
                    <td className="py-1 text-[11px] text-slate-400">
                      {libPrev} : {pc(p)} ({ecart! > 0 ? '+' : ''}{ecart!.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} pt)
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        Fournisseurs classés par dépense HT sur {libPeriode}. Plus la part du Top 10 est élevée, plus la dépense dépend de peu de fournisseurs.
      </p>
    </div>
  )
}
