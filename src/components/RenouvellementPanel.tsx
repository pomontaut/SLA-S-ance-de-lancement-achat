import { useMemo } from 'react'
import { MOIS_COURTS } from '../data/spend'
import { renouvellementParAnnee } from '../data/renouvellement'
import { usePeriodeSpend } from '../data/usePeriodeSpend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const p1 = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`)
const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} k` : String(Math.round(v)))

/** Barres groupées entrants (vert) / sortants (rouge) par année + courbe du taux de renouvellement. */
function GrapheBarres({ rows, valeurs, titre, format, courbe, couleurs = ['#16a34a', '#dc2626'] }: { couleurs?: [string, string]; rows: { label: string; a: number; b: number; taux?: number | null }[]; valeurs: [string, string]; titre: string; format: (v: number) => string; courbe?: boolean }) {
  const W = 560, H = 230, P = { t: 34, r: courbe ? 46 : 12, b: 38, l: 48 }
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]))
  const maxT = courbe ? 100 : 1
  const gw = iw / Math.max(1, rows.length), bw = Math.min(34, gw / 3)
  const y = (v: number) => P.t + ih - (v / max) * ih
  const yt = (v: number) => P.t + ih - (v / maxT) * ih
  const pts = rows.map((r, i) => [P.l + gw * i + gw / 2, yt(r.taux ?? 0)] as const)
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-1">{titre}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={titre}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
            <text x={P.l - 5} y={y(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">{format(max * t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x0 = P.l + gw * i + gw / 2
          return (
            <g key={r.label}>
              <rect x={x0 - bw - 1} y={y(r.a)} width={bw} height={P.t + ih - y(r.a)} fill={couleurs[0]}><title>{`${valeurs[0]} ${r.label} : ${format(r.a)}`}</title></rect>
              <rect x={x0 + 1} y={y(r.b)} width={bw} height={P.t + ih - y(r.b)} fill={couleurs[1]}><title>{`${valeurs[1]} ${r.label} : ${format(r.b)}`}</title></rect>
              <text x={x0 - bw / 2 - 1} y={y(r.a) - 3} textAnchor="middle" fontSize={9} fill="#475569">{format(r.a)}</text>
              <text x={x0 + bw / 2 + 1} y={y(r.b) - 3} textAnchor="middle" fontSize={9} fill="#475569">{format(r.b)}</text>
              <text x={x0} y={H - 20} textAnchor="middle" fontSize={11} fill="#475569">{r.label}</text>
            </g>
          )
        })}
        {courbe && (
          <>
            <text x={P.l} y={12} fontSize={10} fill="#6366f1">Taux :</text>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#4f46e5" strokeWidth={2} />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={3.5} fill="#4f46e5" />
                <text x={p[0]} y={12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#4338ca">{p1(rows[i].taux ?? null)}</text>
              </g>
            ))}
            {[0, 0.5, 1].map((t) => (
              <text key={t} x={W - P.r + 5} y={yt(maxT * t)} dominantBaseline="middle" fontSize={10} fill="#6366f1">{Math.round(maxT * t)} %</text>
            ))}
          </>
        )}
      </svg>
      <div className="flex gap-4 text-[11px] text-slate-500 mt-0.5">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: couleurs[0] }} />{valeurs[0]}</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: couleurs[1] }} />{valeurs[1]}</span>
        {courbe && <span><span className="inline-block w-3 h-0.5 bg-indigo-600 mr-1 align-middle" />Taux de renouvellement</span>}
      </div>
    </div>
  )
}

export default function RenouvellementPanel() {
  const P = usePeriodeSpend()
  const rows = useMemo(() => {
    if (!P.charge) return []
    return renouvellementParAnnee(P.base, P.toutes, P.annees, P.partielles)
  }, [P.charge, P.base, P.toutes, P.annees, P.partielles])
  if (!P.charge || rows.length === 0) return null
  const lib = (r: (typeof rows)[number]) => (r.partielle ? `${r.annee} (janv.–${MOIS_COURTS[r.moisMax]})` : r.annee)

  function exporter() {
    exportXlsx(`renouvellement_panel_${dateFichier()}`, [
      {
        nom: 'Renouvellement',
        lignes: [
          [`Renouvellement du panel fournisseurs${P.entite ? ` — ${P.entite}` : ''}`],
          ['Année', 'Actifs N-1', 'Actifs N', 'Entrants', 'Sortants', 'Solde', "Taux d'entrée %", 'Taux de sortie %', 'Taux de renouvellement %', 'Factures entrants', 'Factures sortants', 'Montant entrants HT', 'Montant sortants HT (N-1)', 'Dépense HT'],
          ...rows.map((r) => [lib(r), r.actifsPrev, r.actifs, r.entrants, r.sortants, r.entrants - r.sortants, r.tauxEntree != null ? Math.round(r.tauxEntree * 10) / 10 : null, r.tauxSortie != null ? Math.round(r.tauxSortie * 10) / 10 : null, r.taux != null ? Math.round(r.taux * 10) / 10 : null, r.facturesEntrants, r.facturesSortants, Math.round(r.montantEntrants), Math.round(r.montantSortants), Math.round(r.depense)] as (string | number | null)[]),
        ],
      },
    ])
  }

  const th = 'py-1.5 px-2 text-right'
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="font-semibold">Renouvellement du panel fournisseurs</h3>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>⬇ Excel</button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        <strong>Entrants</strong> = fournisseurs avec dépense sur la période et aucune les années précédentes ; <strong>sortants</strong> = fournisseurs avec dépense l'an dernier (même période) et plus aucune.
        <strong> Taux de renouvellement</strong> = (entrants + sortants) ÷ (actifs N-1 + actifs N) : part du panel qui bouge. L'historique commence en {P.annees[0]} (année de base, sans « avant »). Une année partielle est comparée à la même période de l'année précédente.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GrapheBarres titre="Fournisseurs entrants / sortants et taux de renouvellement" valeurs={['Entrants', 'Sortants']} format={(v) => String(Math.round(v))} courbe rows={rows.map((r) => ({ label: lib(r), a: r.entrants, b: r.sortants, taux: r.taux }))} />
        <GrapheBarres titre="Dépense HT des entrants (période) et des sortants (N-1)" valeurs={['Entrants', 'Sortants']} format={compact} rows={rows.map((r) => ({ label: lib(r), a: r.montantEntrants, b: r.montantSortants }))} />
        <GrapheBarres titre="Factures des entrants (période) et des sortants (N-1)" valeurs={['Entrants', 'Sortants']} format={(v) => String(Math.round(v))} rows={rows.map((r) => ({ label: lib(r), a: r.facturesEntrants, b: r.facturesSortants }))} />
        <GrapheBarres titre="Fournisseurs actifs : année précédente et année" couleurs={['#4f46e5', '#94a3b8']} valeurs={['Actifs N', 'Actifs N-1']} format={(v) => String(Math.round(v))} rows={rows.map((r) => ({ label: lib(r), a: r.actifs, b: r.actifsPrev }))} />
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              <th className="py-1.5 px-2 text-left">Année</th>
              <th className={th}>Actifs N-1</th>
              <th className={th}>Actifs N</th>
              <th className={th}>Entrants</th>
              <th className={th}>Sortants</th>
              <th className={th}>Solde</th>
              <th className={th}>Taux d'entrée</th>
              <th className={th}>Taux de sortie</th>
              <th className={th}>Renouvellement</th>
              <th className={th}>Factures entrants / sortants</th>
              <th className={th}>Montant entrants / sortants</th>
              <th className={th}>% dépense (entrants)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const solde = r.entrants - r.sortants
              return (
                <tr key={r.annee} className="border-b border-slate-100">
                  <td className="py-1 px-2 font-medium">{lib(r)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{fmt(r.actifsPrev)}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{fmt(r.actifs)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-green-700">{fmt(r.entrants)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-red-600">{fmt(r.sortants)}</td>
                  <td className="py-1 px-2 text-right tabular-nums font-medium" style={{ color: solde < 0 ? '#b91c1c' : '#15803d' }}>{solde > 0 ? '+' : ''}{fmt(solde)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{p1(r.tauxEntree)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{p1(r.tauxSortie)}</td>
                  <td className="py-1 px-2 text-right tabular-nums font-semibold text-indigo-700">{p1(r.taux)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{fmt(r.facturesEntrants)} / {fmt(r.facturesSortants)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{compact(r.montantEntrants)} / {compact(r.montantSortants)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{r.depense ? p1((r.montantEntrants / r.depense) * 100) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
