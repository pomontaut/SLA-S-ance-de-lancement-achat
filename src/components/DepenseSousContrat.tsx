import { useMemo } from 'react'
import { variation } from '../data/spend'
import { CONTRATS, SANS_CORRESPONDANCE, contratDe, sousContrat } from '../data/sousContrat'
import { usePeriodeSpend } from '../data/usePeriodeSpend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'

const depuisDe = (c: string) => CONTRATS.find((x) => x.contrat === c)?.depuis ?? null
const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

/** Dépense (CA des fournisseurs) sous contrat : montant, part de la dépense, factures, comparaison N-1 à période égale. */
export default function DepenseSousContrat({ onZoom }: { onZoom?: (nom: string) => void }) {
  const P = usePeriodeSpend()
  const { base, comparer, an, libPeriode, libPrev, dansCur, dansPrev } = P

  const r = useMemo(() => {
    let totCur = 0, totPrev = 0, cCur = 0, cPrev = 0, facCur = 0, facPrev = 0, cPrevConstant = 0, nouvCur = 0, nouvPrev = 0, nouvFac = 0
    const m = new Map<string, { contrat: string; nom: string; nfr: Set<number>; cur: number; prev: number; fac: number }>()
    for (const l of base) {
      const cur = dansCur(l), prev = dansPrev(l)
      if (cur) totCur += l.montant
      if (prev) totPrev += l.montant
      if (!cur && !prev) continue
      // Nouveaux contrats de l'année en cours : leur dépense sur la période et ce que ces fournisseurs représentaient N-1 (hors contrat).
      if (comparer && depuisDe(contratDe(l.nfr) ?? '') === Number(an)) {
        if (cur) { nouvCur += l.montant; if (l.facture) nouvFac++ }
        if (prev) nouvPrev += l.montant
      }
      // Sous contrat = contrat en vigueur l'année de la dépense (CHALLANDE, CREABETON, LEVIAT : 2025 ; JURACIME, VIGIER, PRO BETON, GRUYERE METAL, VISTONA : 2026).
      if (prev && comparer && sousContrat(l.nfr, an)) cPrevConstant += l.montant // périmètre constant : contrats de la période courante
      if (!sousContrat(l.nfr, l.annee)) continue
      const k = contratDe(l.nfr)!
      const e = m.get(k) ?? { contrat: k, nom: l.nom, nfr: new Set<number>(), cur: 0, prev: 0, fac: 0 }
      e.nfr.add(l.nfr)
      if (cur) { e.cur += l.montant; if (l.facture) e.fac++; cCur += l.montant; if (l.facture) facCur++ }
      if (prev) { e.prev += l.montant; cPrev += l.montant; if (l.facture) facPrev++ }
      m.set(k, e)
    }
    const lignes = [...m.values()].sort((a, b) => b.cur - a.cur)
    return { totCur, totPrev, cCur, cPrev, cPrevConstant, nouvCur, nouvPrev, nouvFac, facCur, facPrev, lignes, actifs: lignes.filter((x) => x.cur > 0).length, actifsPrev: lignes.filter((x) => x.prev > 0).length }
  }, [base, dansCur, dansPrev, comparer, an])

  const nouveauxAn = comparer ? CONTRATS.filter((c) => c.depuis === Number(an)) : []
  const nbContrats = CONTRATS.filter((c) => !comparer || !c.depuis || Number(an) >= c.depuis).length
  const ecart = (a: number, b: number) => {
    const v = variation(a, b)
    return v == null ? null : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %`
  }
  const tuile = (label: string, val: string, sub?: string | null, ev?: string | null) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-indigo-600 tabular-nums">{val}</span>
        {ev && <span className="text-xs font-semibold" style={{ color: ev.startsWith('-') ? '#b91c1c' : '#15803d' }}>{ev}</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )

  function exporter() {
    exportXlsx(`depense_sous_contrat_${dateFichier()}`, [
      {
        nom: 'Sous contrat',
        lignes: [
          [`Dépense sous contrat — ${libPeriode}`],
          ['Contrat', 'N° fournisseur', `Montant HT ${libPeriode}`, '% de la dépense totale', 'Factures', comparer ? `Montant ${libPrev}` : '', 'Évolution %'],
          ...r.lignes.map((x) => [x.contrat, [...x.nfr].join(' / '), Math.round(x.cur), r.totCur ? Math.round((x.cur / r.totCur) * 1000) / 10 : null, x.fac, comparer ? Math.round(x.prev) : null, comparer && variation(x.cur, x.prev) != null ? Math.round(variation(x.cur, x.prev)! * 10) / 10 : null] as (string | number | null)[]),
        ],
      },
    ])
  }

  if (!P.charge) return null
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="font-semibold">Détail par contrat — {libPeriode}</h3>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
          ⬇ Excel
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        CA HT des {nbContrats} contrats fournisseurs en vigueur (un contrat peut couvrir plusieurs numéros fournisseur, chacun n'est compté qu'une fois).
        {nouveauxAn.length > 0 ? ` Nouveaux contrats ${an} : ${nouveauxAn.map((c) => c.contrat).join(', ')}.` : ''}
        {comparer ? ` Comparé à ${libPrev} (période égale).` : ''}
      </p>
      {nouveauxAn.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {tuile(`Assiette ajoutée par les nouveaux contrats ${an}`, fmt(r.nouvCur), `${nouveauxAn.length} contrats · ${r.totCur ? pc((r.nouvCur / r.totCur) * 100) : '—'} de la dépense totale · ${fmt(r.nouvFac)} factures`)}
          {tuile(`Ces mêmes fournisseurs en ${libPrev}`, fmt(r.nouvPrev), `dépense ${libPrev}, hors contrat · ${r.totPrev ? pc((r.nouvPrev / r.totPrev) * 100) : '—'} de la dépense totale ${libPrev}`)}
          {tuile('Contrats existants', fmt(r.cCur - r.nouvCur), `${libPeriode} · ${libPrev} : ${fmt(r.cPrevConstant - r.nouvPrev)} (même périmètre) · ${ecart(r.cCur - r.nouvCur, r.cPrevConstant - r.nouvPrev) ?? '—'}`)}
        </div>
      )}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <th className="py-1.5 px-2">Contrat</th>
              <th className="py-1.5 px-2 text-right">{libPeriode}</th>
              <th className="py-1.5 px-2 text-right">% dépense totale</th>
              <th className="py-1.5 px-2 text-right">Factures</th>
              {comparer && <th className="py-1.5 px-2 text-right">{libPrev}</th>}
              {comparer && <th className="py-1.5 px-2 text-right">Évolution</th>}
            </tr>
          </thead>
          <tbody>
            {r.lignes.map((x) => {
              const v = variation(x.cur, x.prev)
              return (
                <tr key={x.contrat} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1 px-2">
                    {onZoom ? (
                      <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(x.nom)}>{x.contrat}</button>
                    ) : x.contrat}
                    {x.nfr.size > 1 && <span className="text-[10px] text-slate-400"> · {x.nfr.size} n°</span>}
                    {comparer && depuisDe(x.contrat) === Number(an) && <span className="ml-1 text-[10px] font-semibold rounded px-1 py-0.5 bg-amber-100 text-amber-700">nouveau {an}</span>}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(x.cur)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{r.totCur ? pc((x.cur / r.totCur) * 100) : '—'}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.fac}</td>
                  {comparer && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.prev ? fmt(x.prev) : '—'}</td>}
                  {comparer && (
                    <td className="py-1 px-2 text-right tabular-nums" style={{ color: v == null ? '#94a3b8' : v < 0 ? '#b91c1c' : '#15803d' }}>
                      {v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} %`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        Sans correspondance dans les journaux de dépense : {SANS_CORRESPONDANCE.join(', ')}.
      </p>
    </div>
  )
}
