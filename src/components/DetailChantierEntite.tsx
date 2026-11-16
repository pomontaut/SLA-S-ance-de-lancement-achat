import { chantierLabel } from '../data/depenses'
import { entiteLabel } from '../data/palette'
import { variation } from '../data/spend'

export interface LigneDetailChantier {
  code: string
  nom: string | null
  entites: string[]
  cur: number
  prev: number
}

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')

/** Détail par chantier d'un fournisseur : entité portant la dépense, période et comparaison à la période précédente. */
export default function DetailChantierEntite({
  rows,
  libPeriode,
  libPrev,
}: {
  rows: LigneDetailChantier[]
  libPeriode: string
  /** null = pas de comparaison (toutes années). */
  libPrev: string | null
}) {
  const total = rows.reduce((t, r) => t + r.cur, 0)
  if (rows.length === 0) return <p className="text-xs text-slate-500">Aucune dépense sur cette période.</p>
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-1">
        Détail par chantier ({libPeriode}) — {rows.length} chantier(s)
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto bg-white rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-slate-50">
              <th className="py-1 px-2">Chantier</th>
              <th className="py-1 px-2">Entité</th>
              {libPrev && <th className="py-1 px-2 text-right">{libPrev}</th>}
              <th className="py-1 px-2 text-right">{libPeriode}</th>
              {libPrev && <th className="py-1 px-2 text-right">Évolution</th>}
              <th className="py-1 px-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = libPrev ? variation(r.cur, r.prev) : null
              return (
                <tr key={r.code} className="border-b border-slate-100">
                  <td className="py-1 px-2">{chantierLabel(r.code, r.nom)}</td>
                  <td className="py-1 px-2 text-slate-600">{r.entites.map(entiteLabel).join(', ') || '—'}</td>
                  {libPrev && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{r.prev ? fmt(r.prev) : '—'}</td>}
                  <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(r.cur)}</td>
                  {libPrev && (
                    <td className="py-1 px-2 text-right tabular-nums" style={{ color: v == null ? '#94a3b8' : v < 0 ? '#b91c1c' : '#15803d' }}>
                      {v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} %`}
                    </td>
                  )}
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{total ? Math.round((r.cur / total) * 1000) / 10 : 0} %</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
