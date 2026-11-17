import { useMemo } from 'react'
import { calculContrats, SEUIL_CANDIDAT_CHF } from '../data/analyseContrat'
import { usePeriodeSpend } from '../data/usePeriodeSpend'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

/** Synthèse : quelques chiffres sur les contrats ; le détail est dans « Analyse contrat ». */
export default function ContratsResume({ onOuvrir }: { onOuvrir?: () => void }) {
  const P = usePeriodeSpend()
  const r = useMemo(() => (P.charge ? calculContrats(P) : null), [P])
  if (!r) return null
  const pts = r.taux != null && r.tauxPrev != null && P.comparer ? r.taux - r.tauxPrev : null
  const tuile = (label: string, val: string, sous: string, ev?: string | null, bon = true) => (
    <div className="card text-center py-3">
      <div className="text-xl font-bold text-indigo-600 whitespace-nowrap">
        {val}
        {ev && <span className="ml-2 text-xs font-semibold align-middle" style={{ color: bon ? '#15803d' : '#b91c1c' }}>{ev}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-400">{sous}</div>
    </div>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Contrats — {P.libPeriode}</h3>
        {onOuvrir && <button className="text-xs text-indigo-600 hover:underline" onClick={onOuvrir}>Analyse contrat →</button>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tuile('Couverture contractuelle', r.taux != null ? pc(r.taux) : '—', P.comparer && r.tauxPrev != null ? `${P.libPrev} : ${pc(r.tauxPrev)}` : 'part de la dépense sous contrat', pts != null ? `${pts >= 0 ? '+' : ''}${pts.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} pt` : null, (pts ?? 0) >= 0)}
        {tuile('Dépense sous contrat', fmt(r.cCur), P.comparer ? `${P.libPrev} : ${fmt(r.cPrev)} CHF` : 'CHF HT')}
        {tuile('Contrats actifs', `${r.nbActifs} / ${r.nbContrats}`, `${r.nbContrats - r.nbActifs} sans dépense sur la période`)}
        {tuile('À contractualiser', String(r.candidats.length), `fournisseurs hors contrat ≥ ${fmt(SEUIL_CANDIDAT_CHF)} CHF · ${fmt(r.candidatsMontant)} CHF`)}
      </div>
    </div>
  )
}
