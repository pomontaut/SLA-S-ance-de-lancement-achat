import { useMemo } from 'react'
import { usePeriodeSpend } from '../data/usePeriodeSpend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { BarresH } from './DepenseCharts'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')

/** Fournisseurs actifs sur les deux périodes, classés par écart en CHF HT (période vs même période N-1). */
export default function HaussesBaisses({ onZoom }: { onZoom?: (nom: string) => void }) {
  const P = usePeriodeSpend()
  const { base, comparer, dansCur, dansPrev, libPeriode, libPrev } = P
  const { hausses, baisses } = useMemo(() => {
    const m = new Map<number, { nom: string; cur: number; prev: number }>()
    for (const l of base) {
      const c = dansCur(l), p = dansPrev(l)
      if (!c && !p) continue
      const e = m.get(l.nfr) ?? { nom: l.nom, cur: 0, prev: 0 }
      if (c) e.cur += l.montant
      if (p) e.prev += l.montant
      m.set(l.nfr, e)
    }
    const liste = [...m.values()].filter((x) => x.cur > 0 && x.prev > 0).map((x) => ({ ...x, ecart: x.cur - x.prev }))
    return {
      hausses: [...liste].sort((a, b) => b.ecart - a.ecart).slice(0, 8),
      baisses: [...liste].sort((a, b) => a.ecart - b.ecart).slice(0, 8),
    }
  }, [base, dansCur, dansPrev])

  if (!P.charge || !comparer) return null
  const exporter = () =>
    exportXlsx(`hausses_baisses_${dateFichier()}`, [
      { nom: 'Hausses', lignes: [['Fournisseur', libPrev, libPeriode, 'Écart CHF HT'], ...hausses.map((x) => [x.nom, Math.round(x.prev), Math.round(x.cur), Math.round(x.ecart)] as (string | number)[])] },
      { nom: 'Baisses', lignes: [['Fournisseur', libPrev, libPeriode, 'Écart CHF HT'], ...baisses.map((x) => [x.nom, Math.round(x.prev), Math.round(x.cur), Math.round(x.ecart)] as (string | number)[])] },
    ])
  const carte = (titre: string, aide: string | null, lignes: typeof hausses, couleur: string, signe: 1 | -1) => (
    <div className="card overflow-x-auto space-y-3">
      <h4 className="font-semibold">{titre}</h4>
      {aide && <p className="text-xs text-slate-500">{aide}</p>}
      <BarresH lignes={lignes.map((r) => ({ label: r.nom, valeur: signe * r.ecart }))} couleur={couleur} />
      {onZoom && (
        <div className="flex flex-wrap gap-1">
          {lignes.map((r) => (
            <button key={r.nom} className="text-[11px] text-indigo-600 hover:underline" onClick={() => onZoom(r.nom)}>
              {r.nom} ({fmt(r.prev)} → {fmt(r.cur)})
            </button>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          <strong>{libPeriode}</strong> comparé à <strong>{libPrev}</strong>
        </p>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
          ⬇ Excel
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {carte('Plus fortes hausses vs même période', 'Fournisseurs actifs sur les deux périodes, classés par écart en CHF HT.', hausses, '#ea580c', 1)}
        {carte('Plus fortes baisses vs même période', null, baisses, '#0d9488', -1)}
      </div>
    </div>
  )
}
