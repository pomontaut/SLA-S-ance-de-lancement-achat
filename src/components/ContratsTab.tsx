import { useMemo, useState } from 'react'
import { SEUIL_CANDIDAT_CHF, calculContrats } from '../data/analyseContrat'
import type { StatutContrat } from '../data/analyseContrat'
import { entiteLabel } from '../data/palette'
import { variation } from '../data/spend'
import { usePeriodeSpend } from '../data/usePeriodeSpend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import DepenseSousContrat from './DepenseSousContrat'

// Analyse contrat : où la dépense est couverte par un accord, où elle ne l'est pas alors qu'elle le mériterait,
// et quels contrats ne vivent plus. Périmètre commun (entité + année) ; comparaison à période égale.
// Rien d'estimé : uniquement les journaux de dépense et la liste des contrats (aucun gain « théorique » inventé).

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

const STATUTS: Record<StatutContrat, { label: string; classe: string; aide: string }> = {
  nouveau: { label: 'Nouveau', classe: 'bg-sky-100 text-sky-700', aide: "Contrat de l'année en cours, déjà utilisé" },
  actif: { label: 'Actif', classe: 'bg-green-100 text-green-700', aide: 'Dépense sur la période' },
  baisse: { label: '▼ En baisse', classe: 'bg-amber-100 text-amber-700', aide: "Dépense en recul d'au moins 30 % (et 10'000 CHF) par rapport à N-1" },
  arret: { label: 'Plus utilisé', classe: 'bg-red-100 text-red-700', aide: "Dépense N-1, plus rien sur la période : l'accord n'est plus exploité" },
  aucune: { label: 'Aucune dépense', classe: 'bg-slate-200 text-slate-700', aide: "Aucune dépense au journal sur la période : contrat jamais utilisé ou fournisseur non retrouvé" },
}

function Bloc({ titre, aide, onExcel, children }: { titre: string; aide?: string; onExcel?: () => void; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="font-semibold">{titre}</h3>
        {onExcel && (
          <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={onExcel}>
            ⬇ Excel
          </button>
        )}
      </div>
      {aide && <p className="text-xs text-slate-500 mb-3">{aide}</p>}
      {children}
    </div>
  )
}

export default function ContratsTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const P = usePeriodeSpend()
  const r = useMemo(() => (P.charge ? calculContrats(P) : null), [P])
  const [filtreStatut, setFiltreStatut] = useState<StatutContrat | ''>('')
  const [familleCand, setFamilleCand] = useState('')
  if (!r) return <p className="text-sm text-slate-500">Chargement de l'analyse contrat…</p>

  const { comparer, libPeriode, libPrev, entite } = P
  const pts = r.taux != null && r.tauxPrev != null && comparer ? r.taux - r.tauxPrev : null
  const ctx = `${entite ? entiteLabel(entite) : 'Toutes entités'} · ${libPeriode}${comparer ? ` vs ${libPrev}` : ''}`

  // ---- Lecture : constats chiffrés issus des données (pas d'interprétation hors données) ----
  const lecture: string[] = []
  if (r.taux != null) {
    lecture.push(`${pc(r.taux)} de la dépense (${fmt(r.cCur)} CHF sur ${fmt(r.totCur)}) est sous contrat${pts != null ? ` : ${pts >= 0 ? '+' : ''}${pts.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} pt vs ${libPrev}` : ''}.`)
  }
  if (r.candidats.length) {
    const top = r.candidats[0]
    lecture.push(`${r.candidats.length} fournisseur(s) hors contrat dépassent ${fmt(SEUIL_CANDIDAT_CHF)} CHF : ${fmt(r.candidatsMontant)} CHF, soit ${r.horsTotal > 0 ? pc((r.candidatsMontant / r.horsTotal) * 100) : '—'} de la dépense hors contrat. Le plus important : ${top.nom} (${fmt(top.cur)} CHF, ${pc(top.partFamille)} de sa famille « ${top.famille} »).`)
  }
  const peuCouvertes = r.familles.filter((x) => x.total >= 500000 && x.contrat / x.total < 0.1)
  if (peuCouvertes.length) {
    lecture.push(`Familles de plus de 500'000 CHF couvertes à moins de 10 % : ${peuCouvertes.slice(0, 4).map((x) => `${x.famille} (${fmt(x.total)} CHF)`).join(', ')}.`)
  }
  const aSurveiller = r.lignesContrat.filter((x) => x.statut === 'arret' || x.statut === 'baisse' || x.statut === 'aucune')
  if (aSurveiller.length) {
    const n = (s: StatutContrat) => aSurveiller.filter((x) => x.statut === s).length
    lecture.push(`Contrats à surveiller : ${n('arret')} plus utilisé(s), ${n('baisse')} en baisse, ${n('aucune')} sans aucune dépense.`)
  }

  const candidatsVus = r.candidats.filter((x) => !familleCand || x.famille === familleCand)
  const familleCandOptions = [...new Set(r.candidats.map((x) => x.famille))].sort()
  const surveiller = r.lignesContrat
    .filter((x) => (filtreStatut ? x.statut === filtreStatut : x.statut !== 'actif'))
    .sort((a, b) => b.prev - a.prev || a.contrat.localeCompare(b.contrat))

  const exportCandidats = () =>
    exportXlsx(`candidats_contrat_${dateFichier()}`, [
      {
        nom: 'À contractualiser',
        lignes: [
          [`Fournisseurs hors contrat ≥ ${SEUIL_CANDIDAT_CHF} CHF HT — ${ctx}`],
          ['Fournisseur', 'N°', 'Famille', `Montant HT ${libPeriode}`, comparer ? `Montant ${libPrev}` : '', 'Part de sa famille %', 'Entités', 'Chantiers'],
          ...r.candidats.map((x) => [x.nom, x.nfr, x.famille, Math.round(x.cur), comparer ? Math.round(x.prev) : null, Math.round(x.partFamille * 10) / 10, x.entites.map(entiteLabel).join(', '), x.nbChantiers] as (string | number | null)[]),
        ],
      },
    ])
  const exportFamilles = () =>
    exportXlsx(`couverture_familles_${dateFichier()}`, [
      {
        nom: 'Couverture par famille',
        lignes: [
          [`Couverture contractuelle par famille d'achat — ${ctx}`],
          ["Famille d'achat", 'Dépense HT', 'Sous contrat', 'Taux de couverture %', 'Fournisseurs hors contrat', `dont ≥ ${SEUIL_CANDIDAT_CHF} CHF`],
          ...r.familles.map((x) => [x.famille, Math.round(x.total), Math.round(x.contrat), x.total > 0 ? Math.round((x.contrat / x.total) * 1000) / 10 : null, x.nbHors, x.nbCandidats] as (string | number | null)[]),
        ],
      },
    ])
  const exportSurveiller = () =>
    exportXlsx(`contrats_a_surveiller_${dateFichier()}`, [
      {
        nom: 'Contrats',
        lignes: [
          [`Contrats : statut — ${ctx}`],
          ['Contrat', 'N° fournisseur', 'Statut', `Montant HT ${libPeriode}`, comparer ? `Montant ${libPrev}` : '', 'Depuis'],
          ...r.lignesContrat.map((x) => [x.contrat, x.nfr.join(' / '), STATUTS[x.statut].label, Math.round(x.cur), comparer ? Math.round(x.prev) : null, x.depuis] as (string | number | null)[]),
        ],
      },
    ])

  const tuile = (label: string, val: string, sous: string, ev?: string | null, bon = true) => (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold text-indigo-600 whitespace-nowrap">
        {val}
        {ev && <span className="ml-2 text-xs font-semibold align-middle" style={{ color: bon ? '#15803d' : '#b91c1c' }}>{ev}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      <div className="text-[11px] text-slate-400">{sous}</div>
    </div>
  )
  const maxTaux = Math.max(1, ...r.parAnnee.map((a) => (a.total > 0 ? (a.contrat / a.total) * 100 : 0)))

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        <strong>{libPeriode}</strong>
        {comparer ? ` comparé à ${libPrev} (même période)` : ''} — {entite ? entiteLabel(entite) : 'toutes entités'} — montants HT.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tuile('Couverture contractuelle', r.taux != null ? pc(r.taux) : '—', comparer && r.tauxPrev != null ? `${libPrev} : ${pc(r.tauxPrev)}` : 'part de la dépense sous contrat', pts != null ? `${pts >= 0 ? '+' : ''}${pts.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} pt` : null, (pts ?? 0) >= 0)}
        {tuile('Dépense sous contrat', fmt(r.cCur), comparer ? `${libPrev} : ${fmt(r.cPrev)} CHF` : 'CHF HT', comparer && variation(r.cCur, r.cPrev) != null ? `${variation(r.cCur, r.cPrev)! > 0 ? '+' : ''}${variation(r.cCur, r.cPrev)!.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %` : null, (variation(r.cCur, r.cPrev) ?? 0) >= 0)}
        {tuile('Contrats actifs', `${r.nbActifs} / ${r.nbContrats}`, `${r.nbContrats - r.nbActifs} sans dépense sur la période`)}
        {tuile('Hors contrat', fmt(r.horsTotal), `${fmt(r.nbHors)} fournisseurs · dont ${r.candidats.length} ≥ ${fmt(SEUIL_CANDIDAT_CHF)} CHF`)}
      </div>

      {lecture.length > 0 && (
        <div className="card border-indigo-200 bg-indigo-50/40">
          <h3 className="font-semibold mb-1">Lecture</h3>
          <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
            {lecture.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <p className="text-[11px] text-slate-400 mt-2">Constats calculés sur les journaux de dépense ; aucun gain ni prix théorique n'est estimé.</p>
        </div>
      )}

      <Bloc
        titre="Fournisseurs hors contrat à fort volume"
        aide={`Fournisseurs sans contrat dont la dépense sur la période atteint ${fmt(SEUIL_CANDIDAT_CHF)} CHF : premiers candidats à un accord-cadre. Le poids dans la famille indique le levier de négociation.`}
        onExcel={r.candidats.length ? exportCandidats : undefined}
      >
        {r.candidats.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            Famille
            <select className="input !w-64 !py-1" value={familleCand} onChange={(e) => setFamilleCand(e.target.value)}>
              <option value="">Toutes ({r.candidats.length})</option>
              {familleCandOptions.map((f) => <option key={f} value={f}>{f} ({r.candidats.filter((x) => x.famille === f).length})</option>)}
            </select>
            <span>{fmt(candidatsVus.reduce((s, x) => s + x.cur, 0))} CHF</span>
          </label>
        )}
        {r.candidats.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun fournisseur hors contrat n'atteint ce seuil sur la période.</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
                  <th className="py-1.5 px-2">Fournisseur</th>
                  <th className="py-1.5 px-2">Famille</th>
                  <th className="py-1.5 px-2 text-right">{libPeriode}</th>
                  {comparer && <th className="py-1.5 px-2 text-right">{libPrev}</th>}
                  <th className="py-1.5 px-2 text-right">Part de la famille</th>
                  <th className="py-1.5 px-2">Entités</th>
                  <th className="py-1.5 px-2 text-right">Chantiers</th>
                </tr>
              </thead>
              <tbody>
                {candidatsVus.slice(0, 50).map((x) => (
                  <tr key={x.nfr} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1 px-2">{onZoom ? <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(x.nom)}>{x.nom}</button> : x.nom}</td>
                    <td className="py-1 px-2 text-slate-500">{x.famille}</td>
                    <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(x.cur)}</td>
                    {comparer && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.prev ? fmt(x.prev) : '—'}</td>}
                    <td className="py-1 px-2 text-right tabular-nums text-slate-500">{pc(x.partFamille)}</td>
                    <td className="py-1 px-2 text-slate-500">{x.entites.map(entiteLabel).join(', ') || '—'}{x.entites.length > 1 && <span className="ml-1 text-[10px] font-semibold rounded px-1 py-0.5 bg-violet-100 text-violet-700">multi-entités</span>}</td>
                    <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.nbChantiers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {candidatsVus.length > 50 && <p className="text-[11px] text-slate-400 mt-1">50 premiers sur {candidatsVus.length} : l'Excel contient la liste complète.</p>}
          </div>
        )}
      </Bloc>

      <Bloc titre="Couverture par famille d'achat" aide="Part de la dépense de chaque famille couverte par un contrat : repère les familles sans accord malgré un volume important." onExcel={exportFamilles}>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
                <th className="py-1.5 px-2">Famille</th>
                <th className="py-1.5 px-2 text-right">Dépense</th>
                <th className="py-1.5 px-2 text-right">Sous contrat</th>
                <th className="py-1.5 px-2 w-44">Couverture</th>
                <th className="py-1.5 px-2 text-right">Hors contrat</th>
                <th className="py-1.5 px-2 text-right">dont ≥ {fmt(SEUIL_CANDIDAT_CHF)}</th>
              </tr>
            </thead>
            <tbody>
              {r.familles.map((x) => {
                const t = x.total > 0 ? (x.contrat / x.total) * 100 : 0
                return (
                  <tr key={x.famille} className="border-b border-slate-100">
                    <td className="py-1 px-2">{x.famille}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(x.total)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(x.contrat)}</td>
                    <td className="py-1 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded"><div className="h-2 rounded bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, t))}%` }} /></div>
                        <span className="tabular-nums w-12 text-right text-slate-600">{pc(t)}</span>
                      </div>
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.nbHors} fourn.</td>
                    <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.nbCandidats || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Bloc>

      <Bloc
        titre="Contrats à surveiller"
        aide="Un contrat qui n'est plus utilisé ou dont la dépense recule peut signaler un accord non exploité (ristourne, prix) ou un fournisseur contourné. Filtrez par statut."
        onExcel={exportSurveiller}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['arret', 'baisse', 'aucune', 'nouveau', 'actif'] as StatutContrat[]).map((s) => {
            const n = r.lignesContrat.filter((x) => x.statut === s).length
            return (
              <button
                key={s}
                title={STATUTS[s].aide}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${filtreStatut === s ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-transparent'} ${STATUTS[s].classe}`}
                onClick={() => setFiltreStatut(filtreStatut === s ? '' : s)}
              >
                {STATUTS[s].label} · {n}
              </button>
            )
          })}
        </div>
        {surveiller.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun contrat à signaler.</p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
                  <th className="py-1.5 px-2">Contrat</th>
                  <th className="py-1.5 px-2">Statut</th>
                  <th className="py-1.5 px-2 text-right">{libPeriode}</th>
                  {comparer && <th className="py-1.5 px-2 text-right">{libPrev}</th>}
                </tr>
              </thead>
              <tbody>
                {surveiller.map((x) => (
                  <tr key={x.contrat} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1 px-2">{onZoom && x.nom ? <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(x.nom!)}>{x.contrat}</button> : x.contrat}{x.depuis ? <span className="text-[10px] text-slate-400"> · depuis {x.depuis}</span> : null}</td>
                    <td className="py-1 px-2"><span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${STATUTS[x.statut].classe}`}>{STATUTS[x.statut].label}</span></td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(x.cur)}</td>
                    {comparer && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.prev ? fmt(x.prev) : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloc>

      <Bloc titre="Évolution de la couverture par année" aide="Part de la dépense sous contrat chaque année (contrat en vigueur l'année de la dépense ; 2026 partielle).">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {r.parAnnee.map((a) => {
              const t = a.total > 0 ? (a.contrat / a.total) * 100 : 0
              return (
                <tr key={a.annee} className="border-b border-slate-100">
                  <td className="py-1 px-2 w-16">{a.annee}</td>
                  <td className="py-1 px-2">
                    <div className="h-2.5 bg-slate-100 rounded"><div className="h-2.5 rounded bg-indigo-500" style={{ width: `${(t / maxTaux) * 100}%` }} /></div>
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums w-16 font-medium">{pc(t)}</td>
                  <td className="py-1 px-2 text-right tabular-nums w-40 text-slate-500">{fmt(a.contrat)} / {fmt(a.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Bloc>

      <DepenseSousContrat onZoom={onZoom} />
    </div>
  )
}
