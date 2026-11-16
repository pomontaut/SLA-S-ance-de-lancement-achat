import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { BarresH } from './DepenseCharts'
import type { FacturePaiement } from '../data/paiement'
import { SEUIL_TAUX_PAIEMENT, ajouteJours, arretsParAnnee, loadEscomptesReels, dpoAnnee as dpoDe, facturesPaiement, indicateursPaiement, jours, moy } from '../data/paiement'
import { useFiltresSpend } from './FiltresSpend'

// Onglet « Paiement » : comment Induni paie ses fournisseurs. Toutes les factures (genre « Facture »)
// avec une échéance ; montants HT, sauf le DPO (TTC, comme sa définition).
//  - Retard de paiement d'une facture = date de paiement − date d'échéance (positif = retard, négatif = avance).
//  - Taux de paiement à l'échéance = factures payées à temps / factures dont l'échéance est atteinte ou payées.
//  - Date d'arrêt : les journaux n'ont pas tous été extraits le même jour ; une facture impayée est jugée
//    à la date d'arrêt de son année (percentile 99 des dates de paiement connues de cette année-là).

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmt1 = (v: number) => v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const SEUIL_TAUX = SEUIL_TAUX_PAIEMENT

function BoutonExcel({ onClick }: { onClick: () => void }) {
  return (
    <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 whitespace-nowrap" onClick={onClick}>
      ⬇ Excel
    </button>
  )
}

function Section({ titre, onExcel, children, aide }: { titre: string; onExcel?: () => void; children: React.ReactNode; aide?: string }) {
  return (
    <div className="card overflow-x-auto space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold">{titre}</h4>
        {onExcel && <BoutonExcel onClick={onExcel} />}
      </div>
      {aide && <p className="text-xs text-slate-500">{aide}</p>}
      {children}
    </div>
  )
}

function Tuile({ label, valeur, sous, ton, periode }: { label: string; valeur: string; sous?: string; ton?: 'bon' | 'moyen' | 'mauvais'; periode?: string }) {
  const couleur = ton === 'bon' ? 'text-green-600' : ton === 'mauvais' ? 'text-red-600' : ton === 'moyen' ? 'text-amber-600' : 'text-indigo-600'
  return (
    <div className="card text-center py-4">
      {periode && <div className="inline-block text-[10px] font-semibold uppercase tracking-wide rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 mb-1">{periode}</div>}
      <div className={`text-2xl font-bold ${couleur}`}>{valeur}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sous && <div className="text-[11px] text-slate-400 mt-0.5">{sous}</div>}
    </div>
  )
}

export default function PaiementTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [comptabilises, setComptabilises] = useState<Record<string, number>>({}) // escomptes comptabilisés (compte 702) par année
  const [partielles, setPartielles] = useState<string[]>([])
  const [escReels, setEscReels] = useState<Record<string, number>>({})
  const partage = useFiltresSpend()
  const [localEntite, setLocalEntite] = useState('')
  const [localAnnee, setLocalAnnee] = useState<string | null>(null) // null = dernière année
  const entite = partage ? partage.entite : localEntite
  const setEntite = (v: string) => (partage ? partage.setEntite(v) : setLocalEntite(v))
  const annee = partage ? partage.annee || null : localAnnee
  const setAnnee = (v: string) => (partage ? partage.setAnnee(v) : setLocalAnnee(v))

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadEscomptesReels().then(setEscReels)
    loadDepensesGlobal().then((g) => {
      const m: Record<string, number> = {}
      for (const d of g.exclusionsCompte?.details ?? []) if (d.compte === '702') m[d.annee] = (m[d.annee] ?? 0) + d.montant
      setComptabilises(m)
      setPartielles(Object.keys(g.anneesPartielles ?? {}))
    })
  }, [])

  // Date d'arrêt des paiements de chaque année (définition commune : src/data/paiement.ts).
  const arret = useMemo(() => arretsParAnnee(fournisseurs ?? []), [fournisseurs])

  // Toutes les factures et tous les documents (pour achats / dettes TTC), filtrés par entité.
  const { factures, docsTtc } = useMemo(() => facturesPaiement(fournisseurs ?? [], entite, escReels), [fournisseurs, entite, escReels])

  const entites = useMemo(() => {
    const s = new Set<string>()
    for (const f of fournisseurs ?? []) for (const d of f.documents) if (d.entite) s.add(d.entite)
    return [...s].sort()
  }, [fournisseurs])
  const annees = useMemo(() => Object.keys(arret).filter((a) => /^\d{4}$/.test(a)).sort(), [arret])
  const anneeSel = annee ?? annees[annees.length - 1] ?? ''
  const toutes = anneeSel === 'toutes'

  const indicateurs = (l: FacturePaiement[]) => indicateursPaiement(l, arret)
  const dpoAnnee = (a: string) => dpoDe(docsTtc, arret, a)

  const parAnnee = useMemo(
    () => annees.map((a) => ({ annee: a, ...indicateurs(factures.filter((f) => f.annee === a)), dpo: dpoAnnee(a), comptabilise: comptabilises[a] ?? null })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factures, docsTtc, annees, arret, comptabilises],
  )

  const selection = useMemo(() => (toutes ? factures : factures.filter((f) => f.annee === anneeSel)), [factures, anneeSel, toutes])
  const kpi = useMemo(() => indicateurs(selection), // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, arret])
  const ligneAnnee = parAnnee.find((r) => r.annee === anneeSel)
  // Escomptes réellement obtenus = compte 702 (tous fournisseurs, donc seulement sans filtre d'entité).
  const escComptabilise = useMemo(() => {
    if (entite) return null
    const l = toutes ? Object.values(comptabilises) : comptabilises[anneeSel] != null ? [comptabilises[anneeSel]] : []
    return l.length ? Math.abs(l.reduce((t, v) => t + v, 0)) : null
  }, [entite, toutes, anneeSel, comptabilises])

  // Contrôle des escomptes : couverture (part des factures qui portent une condition d'escompte) et détail par fournisseur.
  const escControle = useMemo(() => {
    const m = new Map<number, { nom: string; nb: number; base: number; taux: Set<string>; possible: number; realise: number; perdu: number; nbATemps: number }>()
    let nbEsc = 0, baseEsc = 0
    const totalHt = selection.reduce((t, f) => t + f.ht, 0)
    for (const f of selection) {
      if (!f.esc && f.escReel <= 0) continue
      nbEsc++
      baseEsc += f.ht
      const e = m.get(f.nfr) ?? { nom: f.nom, nb: 0, base: 0, taux: new Set<string>(), possible: 0, realise: 0, perdu: 0, nbATemps: 0 }
      e.nb++
      e.base += f.ht
      if (f.esc) e.taux.add(`${f.esc.delai} j ${Math.round(f.esc.taux * 1000) / 10} %`)
      if (f.escReel > 0) { e.realise += f.escReel; e.possible += f.escReel; e.nbATemps++ }
      else if (f.esc && f.doc && (f.pay ? true : ajouteJours(f.doc, f.esc.delai) <= (arret[f.annee] ?? '0000'))) { const v = f.ht * f.esc.taux; e.perdu += v; e.possible += v }
      m.set(f.nfr, e)
    }
    const lignes = [...m.values()].sort((a, b) => b.possible - a.possible)
    return { lignes, nbEsc, baseEsc, totalHt, nbFactures: selection.length, possible: lignes.reduce((t, x) => t + x.possible, 0) }
  }, [selection, arret])

  // Répartition des retards (factures payées)
  const classes: { label: string; test: (r: number) => boolean }[] = [
    { label: 'Payée en avance de plus de 15 j', test: (r) => r < -15 },
    { label: 'Payée en avance (1 à 15 j)', test: (r) => r < 0 && r >= -15 },
    { label: "Payée à l'échéance (0 j)", test: (r) => r === 0 },
    { label: 'Retard de 1 à 15 j', test: (r) => r >= 1 && r <= 15 },
    { label: 'Retard de 16 à 30 j', test: (r) => r >= 16 && r <= 30 },
    { label: 'Retard de 31 à 60 j', test: (r) => r >= 31 && r <= 60 },
    { label: 'Retard de 61 à 90 j', test: (r) => r >= 61 && r <= 90 },
    { label: 'Retard de plus de 90 j', test: (r) => r > 90 },
  ]
  const repartition = useMemo(() => {
    const payees = selection.filter((f) => f.pay)
    return classes.map((c) => {
      const l = payees.filter((f) => c.test(f.retard!))
      return { label: c.label, nb: l.length, ht: l.reduce((t, f) => t + f.ht, 0), pct: payees.length ? (l.length / payees.length) * 100 : 0 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  // Balance âgée : impayées échues à la date d'arrêt de leur année
  const balance = useMemo(() => {
    const tr = [
      { label: '0 à 30 jours de retard', min: 1, max: 30 },
      { label: '31 à 60 jours', min: 31, max: 60 },
      { label: '61 à 90 jours', min: 61, max: 90 },
      { label: 'Plus de 90 jours', min: 91, max: 99999 },
    ]
    const echues = selection.filter((f) => !f.pay && arret[f.annee] && f.ech < arret[f.annee]).map((f) => ({ f, j: jours(f.ech, arret[f.annee]) }))
    return tr.map((t) => {
      const l = echues.filter((e) => e.j >= t.min && e.j <= t.max)
      return { label: t.label, nb: l.length, ht: l.reduce((s, e) => s + e.f.ht, 0) }
    })
  }, [selection, arret])
  const totalEchu = balance.reduce((t, b) => t + b.ht, 0)

  // Classements fournisseurs : retard moyen sur les factures payées (au moins 10 factures payées)
  const classement = useMemo(() => {
    const m = new Map<number, { nfr: number; nom: string; retards: number[]; aTemps: number; ht: number }>()
    for (const f of selection) {
      if (!f.pay) continue
      let e = m.get(f.nfr)
      if (!e) m.set(f.nfr, (e = { nfr: f.nfr, nom: f.nom, retards: [], aTemps: 0, ht: 0 }))
      e.retards.push(f.retard!)
      if (f.retard! <= 0) e.aTemps++
      e.ht += f.ht
    }
    const l = [...m.values()].filter((e) => e.retards.length >= 10).map((e) => ({ ...e, moyen: moy(e.retards)!, taux: (e.aTemps / e.retards.length) * 100 }))
    return { mieux: [...l].sort((a, b) => a.moyen - b.moyen).slice(0, 20), pire: [...l].sort((a, b) => b.moyen - a.moyen).slice(0, 20), nb: l.length }
  }, [selection])

  const libAn = toutes ? 'Toutes années' : partielles.includes(anneeSel) ? `${anneeSel} (partielle)` : anneeSel
  const contexte = [entite ? entiteLabel(entite) : 'Toutes entités', toutes ? 'Toutes années' : anneeSel].join(' · ')

  function exporterAnnees() {
    exportXlsx(`paiement_par_annee_${dateFichier()}`, [{
      nom: 'Par année',
      lignes: [[contexte], ['Année', "Date d'arrêt des paiements", 'Factures', 'Payées à temps', 'Payées en retard', 'Taux de paiement à l\'échéance %', 'Retard moyen (j)', 'DPO (j, TTC)', 'Délai interne moyen (j)', 'Escomptes réalisés (estimation) CHF HT', 'Escomptes perdus (estimation) CHF HT', 'Escomptes possibles (estimation) CHF HT', 'Escomptes comptabilisés (compte 702) CHF'],
        ...parAnnee.map((r) => [r.annee, arret[r.annee] ?? null, r.nb, r.nbATemps, r.nbRetard, r.taux != null ? Math.round(r.taux * 10) / 10 : null, r.retardMoyen != null ? Math.round(r.retardMoyen * 10) / 10 : null, r.dpo != null ? Math.round(r.dpo * 10) / 10 : null, r.interneMoyen != null ? Math.round(r.interneMoyen * 10) / 10 : null, Math.round(r.escOb), Math.round(r.escPerdu), Math.round(r.escOb + r.escPerdu), r.comptabilise != null ? Math.round(Math.abs(r.comptabilise)) : null] as (string | number | null)[])],
    }])
  }
  const exporterListe = (nom: string, l: typeof classement.mieux) =>
    exportXlsx(`${nom}_${dateFichier()}`, [{ nom, lignes: [[contexte], ['Rang', 'Fournisseur', 'Retard moyen (j)', 'Taux à l\'échéance %', 'Factures payées', 'Montant CHF HT'], ...l.map((e, i) => [i + 1, e.nom, Math.round(e.moyen * 10) / 10, Math.round(e.taux * 10) / 10, e.retards.length, Math.round(e.ht)] as (string | number | null)[])] }])

  if (!fournisseurs) return <p className="text-sm text-slate-500">Chargement des données de paiement…</p>

  const tonTaux = kpi.taux == null ? undefined : kpi.taux >= SEUIL_TAUX ? 'bon' : kpi.taux >= 70 ? 'moyen' : 'mauvais'

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">💳 Paiement des fournisseurs — {libAn}</h3>
        {!partage && (
          <>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase text-slate-500 mr-1">Entité</span>
          {['', ...entites].map((e) => (
            <button key={e || 'toutes'} className="px-2 py-0.5 rounded-full text-xs font-medium border" style={entite === e ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' } : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }} onClick={() => setEntite(e)}>
              {e ? entiteLabel(e) : 'Toutes entités'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase text-slate-500 mr-1">Année</span>
          {[...annees, 'toutes'].map((a) => (
            <button key={a} className="px-2 py-0.5 rounded-full text-xs font-medium border" style={anneeSel === a ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' } : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }} onClick={() => setAnnee(a)}>
              {a === 'toutes' ? 'Toutes années' : a}
            </button>
          ))}
        </div>
          </>
        )}
        <p className="text-[11px] text-slate-400">
          Montants HT (le DPO est en TTC). Retard de paiement = date de paiement − date d'échéance (positif = retard, négatif = paiement anticipé). Paiements connus
          jusqu'au : {annees.map((a) => `${a} → ${arret[a]?.split('-').reverse().join('.')}`).join(' · ')} — une facture impayée est jugée à cette date.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tuile periode={libAn} label={`Taux de paiement à l'échéance (objectif ≥ ${SEUIL_TAUX} %)`} valeur={kpi.taux != null ? `${fmt1(kpi.taux)} %` : '—'} sous={`${fmt(kpi.nbATemps)} à temps / ${fmt(kpi.nbPayees + kpi.nbImpayeesEchues)} factures`} ton={tonTaux} />
        <Tuile periode={libAn} label="Retard moyen (factures payées en retard)" valeur={kpi.retardMoyen != null ? `${fmt1(kpi.retardMoyen)} j` : '—'} sous={`${fmt(kpi.nbRetard)} factures en retard`} ton="mauvais" />
        <Tuile periode={libAn} label="Délai moyen de paiement (DPO, TTC)" valeur={!toutes && ligneAnnee?.dpo != null ? `${fmt1(ligneAnnee.dpo)} j` : '—'} sous={toutes ? 'voir le tableau par année' : '(dettes ÷ achats) × jours'} />
        <Tuile periode={libAn} label="Délai de traitement interne (indicatif)" valeur={kpi.interneMoyen != null ? `${fmt1(kpi.interneMoyen)} j` : '—'} sous={kpi.interneMedian != null ? `médiane ${kpi.interneMedian} j · mise à disposition − date facture` : undefined} />
        <Tuile periode={libAn}
          label="Escomptes réalisés (pris au paiement, HT)"
          valeur={`${fmt(kpi.escOb)} CHF`}
          ton="bon"
          sous={`écart réel facture − montant payé · ${fmt(selection.filter((f) => f.escReel > 0).length)} factures`}
        />
        <Tuile periode={libAn} label="Escomptes perdus (HT)" valeur={`${fmt(kpi.escPerdu)} CHF`} ton="mauvais" sous={`non pris alors que la condition le prévoit (payé hors délai ou pas encore payé) — possible au total : ${fmt(kpi.escOb + kpi.escPerdu)} CHF`} />
        <Tuile periode={libAn} label="Montant échu non payé (HT)" valeur={`${fmt(totalEchu)} CHF`} ton="moyen" sous={`${fmt(balance.reduce((t, b) => t + b.nb, 0))} factures`} />
        <Tuile periode={libAn} label="Factures analysées" valeur={fmt(kpi.nb)} sous={contexte} />
      </div>

      <Section titre="Indicateurs par année" onExcel={exporterAnnees} aide="Le DPO retient les factures de l'année impayées à la clôture (31.12, ou la date d'arrêt pour l'année en cours). Le délai interne est indicatif : les journaux ne contiennent pas la date de validation ni de réception, seulement la mise à disposition au paiement.">
        <table className="text-xs w-full">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-1 px-2">Année</th>
              <th className="py-1 px-2 text-right">Factures</th>
              <th className="py-1 px-2 text-right">Taux à l'échéance</th>
              <th className="py-1 px-2 text-right">Retard moyen</th>
              <th className="py-1 px-2 text-right">DPO (TTC)</th>
              <th className="py-1 px-2 text-right">Délai interne</th>
              <th className="py-1 px-2 text-right" title="Factures à condition d'escompte payées dans le délai : taux × montant HT">Escomptes réalisés</th>
              <th className="py-1 px-2 text-right" title="Factures à condition d'escompte payées après le délai ou pas encore payées">Escomptes perdus</th>
              <th className="py-1 px-2 text-right" title="Réalisés + perdus : tout ce que les conditions de paiement permettaient de prendre">Escomptes possibles</th>
            </tr>
          </thead>
          <tbody>
            {parAnnee.map((r) => (
              <tr key={r.annee} className={`border-b border-slate-100 ${r.annee === anneeSel ? 'bg-indigo-50' : ''}`}>
                <td className="py-1 px-2 font-medium">{r.annee}</td>
                <td className="py-1 px-2 text-right tabular-nums">{fmt(r.nb)}</td>
                <td className="py-1 px-2 text-right tabular-nums font-semibold" style={{ color: r.taux == null ? undefined : r.taux >= SEUIL_TAUX ? '#16a34a' : r.taux >= 70 ? '#d97706' : '#dc2626' }}>
                  {r.taux != null ? `${fmt1(r.taux)} %` : '—'}
                </td>
                <td className="py-1 px-2 text-right tabular-nums">{r.retardMoyen != null ? `${fmt1(r.retardMoyen)} j` : '—'}</td>
                <td className="py-1 px-2 text-right tabular-nums">{r.dpo != null ? `${fmt1(r.dpo)} j` : '—'}</td>
                <td className="py-1 px-2 text-right tabular-nums">{r.interneMoyen != null ? `${fmt1(r.interneMoyen)} j` : '—'}</td>
                <td className="py-1 px-2 text-right tabular-nums text-green-700">{fmt(r.escOb)}</td>
                <td className="py-1 px-2 text-right tabular-nums text-red-600">{fmt(r.escPerdu)}</td>
                <td className="py-1 px-2 text-right tabular-nums text-slate-600">{fmt(r.escOb + r.escPerdu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[11px] text-slate-500 space-y-1">
          <p>
            <strong>Escomptes réalisés</strong> = escompte réellement pris, mesuré par l'écart entre le montant de la facture et le montant payé (journaux, escompte ≤ 6 % de la facture ; HT).{' '}
            <strong>Escomptes perdus</strong> = taux × montant HT des factures dont la condition prévoit un escompte (ex. « 30 JOURS 2 % ») mais où il n'a pas été pris : payées au-delà du délai (ou sans escompte), ou
            impayées et délai dépassé. <strong>Escomptes possibles</strong> = réalisés + perdus. Seules les factures dont la condition enregistrée contient un escompte sont éligibles.
          </p>
          {!entite && Object.keys(comptabilises).length > 0 && (
            <p>
              Pour mémoire, le compte comptable 702 « Résultat des escomptes Fournisseurs » (tous fournisseurs) totalise : {annees.filter((a) => comptabilises[a] != null).map((a) => `${a} : ${fmt(Math.abs(comptabilises[a]))} CHF`).join(' · ')}.
              Ces montants sont très supérieurs aux escomptes retrouvés au niveau des factures (écart facture − paiement) : le 702 contient d'autres écritures (regroupées, hors paiement facture par facture) — à faire expliquer par la comptabilité.
            </p>
          )}
        </div>
      </Section>

      <Section
        titre={`Contrôle des escomptes — ${contexte}`}
        onExcel={() =>
          exportXlsx(`controle_escomptes_${dateFichier()}`, [
            {
              nom: 'Escomptes par fournisseur',
              lignes: [
                [contexte],
                ['Fournisseur', 'Factures avec escompte', 'Base HT', 'Condition(s)', 'Escompte possible HT', 'Réalisé HT (écart facture − paiement)', 'Perdu HT', 'Factures avec escompte pris'],
                ...escControle.lignes.map((x) => [x.nom, x.nb, Math.round(x.base), [...x.taux].join(' / '), Math.round(x.possible), Math.round(x.realise), Math.round(x.perdu), x.nbATemps] as (string | number | null)[]),
              ],
            },
          ])
        }
        aide="Vérification des chiffres d'escompte : seules les factures dont la condition de paiement enregistrée contient un escompte (« N JOURS p % ») sont comptées."
      >
        <p className="text-xs text-slate-600">
          <strong>{fmt(escControle.nbEsc)}</strong> factures sur {fmt(escControle.nbFactures)} ({escControle.nbFactures ? fmt1((escControle.nbEsc / escControle.nbFactures) * 100) : '0'} %) portent une condition d'escompte ou ont bénéficié d'un escompte, soit{' '}
          <strong>{fmt(escControle.baseEsc)} CHF HT</strong> sur {fmt(escControle.totalHt)} ({escControle.totalHt ? fmt1((escControle.baseEsc / escControle.totalHt) * 100) : '0'} % du montant facturé). Escompte possible (réalisé + perdu) :{' '}
          <strong>{fmt(escControle.possible)} CHF</strong>.
        </p>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
                <th className="py-1 px-2">Fournisseur</th>
                <th className="py-1 px-2">Condition</th>
                <th className="py-1 px-2 text-right">Factures</th>
                <th className="py-1 px-2 text-right">Base HT</th>
                <th className="py-1 px-2 text-right">Possible</th>
                <th className="py-1 px-2 text-right">Réalisé</th>
                <th className="py-1 px-2 text-right">Perdu</th>
                <th className="py-1 px-2 text-right">Escompte pris</th>
              </tr>
            </thead>
            <tbody>
              {escControle.lignes.slice(0, 30).map((x) => (
                <tr key={x.nom} className="border-b border-slate-100">
                  <td className="py-1 px-2">{x.nom}</td>
                  <td className="py-1 px-2 text-slate-500">{[...x.taux].join(' · ')}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{fmt(x.nb)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{fmt(x.base)}</td>
                  <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(x.possible)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-green-700">{fmt(x.realise)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-red-600">{fmt(x.perdu)}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{fmt1(x.nb ? (x.nbATemps / x.nb) * 100 : 0)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400">30 premiers fournisseurs ; l'export Excel les contient tous.</p>
      </Section>

      <Section
        titre={`Répartition du retard de paiement par facture — ${contexte}`}
        onExcel={() => exportXlsx(`repartition_retards_${dateFichier()}`, [{ nom: 'Répartition', lignes: [[contexte], ['Classe', 'Factures', '% des factures payées', 'Montant CHF HT'], ...repartition.map((r) => [r.label, r.nb, Math.round(r.pct * 10) / 10, Math.round(r.ht)] as (string | number | null)[])] }])}
      >
        <BarresH lignes={repartition.map((r) => ({ label: r.label, valeur: r.nb, pct: r.pct }))} couleur="#4f46e5" />
        <p className="text-[11px] text-slate-400">Barres = nombre de factures payées dans chaque classe de retard (paiement − échéance).</p>
      </Section>

      <Section
        titre={`Balance âgée fournisseurs — montant échu non payé (HT) — ${contexte}`}
        onExcel={() => exportXlsx(`balance_agee_${dateFichier()}`, [{ nom: 'Balance âgée', lignes: [[contexte], ['Ancienneté du retard', 'Factures', 'Montant CHF HT'], ...balance.map((b) => [b.label, b.nb, Math.round(b.ht)] as (string | number | null)[]), ['Total', balance.reduce((t, b) => t + b.nb, 0), Math.round(totalEchu)]] }])}
        aide="Factures impayées dont l'échéance est dépassée à la date d'arrêt des paiements de leur année. Pour les années anciennes, une partie des impayés peut être un paiement non enregistré dans l'export."
      >
        <BarresH lignes={balance.map((b) => ({ label: b.label, valeur: b.ht, pct: totalEchu > 0 ? (b.ht / totalEchu) * 100 : null }))} couleur="#d97706" />
      </Section>

      {[
        { cle: 'mieux', titre: 'Top 20 des fournisseurs les mieux payés', l: classement.mieux, couleur: '#16a34a' },
        { cle: 'pire', titre: 'Top 20 des fournisseurs les moins bien payés', l: classement.pire, couleur: '#dc2626' },
      ].map(({ cle, titre, l, couleur }) => (
        <Section
          key={cle}
          titre={`${titre} — ${contexte}`}
          onExcel={l.length ? () => exporterListe(cle === 'mieux' ? 'top20_mieux_payes' : 'top20_moins_bien_payes', l) : undefined}
          aide={`Classés par retard moyen de paiement (paiement − échéance) sur leurs factures payées ; au moins 10 factures payées (${classement.nb} fournisseurs retenus). Un retard négatif = payé avant l'échéance.`}
        >
          {l.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun fournisseur avec au moins 10 factures payées pour cette sélection.</p>
          ) : (
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-2">#</th>
                  <th className="py-1 px-2">Fournisseur</th>
                  <th className="py-1 px-2 text-right">Retard moyen</th>
                  <th className="py-1 px-2 text-right">À l'échéance</th>
                  <th className="py-1 px-2 text-right">Factures payées</th>
                  <th className="py-1 px-2 text-right">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {l.map((e, i) => (
                  <tr key={e.nfr} className="border-b border-slate-100">
                    <td className="py-1 px-2 text-slate-400">{i + 1}</td>
                    <td className="py-1 px-2 font-medium">
                      {onZoom ? (
                        <button className="hover:underline text-left" onClick={() => onZoom(e.nom)}>
                          {e.nom}
                        </button>
                      ) : (
                        e.nom
                      )}
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums font-semibold" style={{ color: couleur }}>
                      {e.moyen > 0 ? '+' : ''}
                      {fmt1(e.moyen)} j
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt1(e.taux)} %</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(e.retards.length)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(e.ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ))}
    </div>
  )
}
