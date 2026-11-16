import { useEffect, useMemo, useState } from 'react'
import type { DepenseDocument, DepenseFournisseur } from '../data/depenses'
import { anneeComptable, loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { BarresH } from './DepenseCharts'

// Onglet « Paiement » : comment Induni paie ses fournisseurs. Toutes les factures (genre « Facture »)
// avec une échéance ; montants HT, sauf le DPO (TTC, comme sa définition).
//  - Retard de paiement d'une facture = date de paiement − date d'échéance (positif = retard, négatif = avance).
//  - Taux de paiement à l'échéance = factures payées à temps / factures dont l'échéance est atteinte ou payées.
//  - Date d'arrêt : les journaux n'ont pas tous été extraits le même jour ; une facture impayée est jugée
//    à la date d'arrêt de son année (percentile 99 des dates de paiement connues de cette année-là).

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmt1 = (v: number) => v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const jours = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000)
const ajouteJours = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10)
const moy = (l: number[]) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : null)
const mediane = (l: number[]) => {
  if (!l.length) return null
  const s = [...l].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const SEUIL_TAUX = 90 // objectif du taux de paiement à l'échéance (%)

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

function Tuile({ label, valeur, sous, ton }: { label: string; valeur: string; sous?: string; ton?: 'bon' | 'moyen' | 'mauvais' }) {
  const couleur = ton === 'bon' ? 'text-green-600' : ton === 'mauvais' ? 'text-red-600' : ton === 'moyen' ? 'text-amber-600' : 'text-indigo-600'
  return (
    <div className="card text-center py-4">
      <div className={`text-2xl font-bold ${couleur}`}>{valeur}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sous && <div className="text-[11px] text-slate-400 mt-0.5">{sous}</div>}
    </div>
  )
}

interface Facture {
  nfr: number
  nom: string
  entite: string | null
  annee: string
  ech: string
  pay: string | null
  /** Retard en jours (paiement − échéance) ; null si impayée. */
  retard: number | null
  ht: number
  dispo: string | null
  doc: string | null
  /** Escompte prévu par la condition (« 30 JOURS 2% » : 2 % si payé sous 30 jours). */
  esc: { delai: number; taux: number } | null
}

const ESCOMPTE = /(\d+)\s*JOURS\s+(\d+(?:[.,]\d+)?)\s*%/i

export default function PaiementTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [comptabilises, setComptabilises] = useState<Record<string, number>>({}) // escomptes comptabilisés (compte 702) par année
  const [entite, setEntite] = useState('')
  const [annee, setAnnee] = useState<string | null>(null) // null = dernière année

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => {
      const m: Record<string, number> = {}
      for (const d of g.exclusionsCompte?.details ?? []) if (d.compte === '702') m[d.annee] = (m[d.annee] ?? 0) + d.montant
      setComptabilises(m)
    })
  }, [])

  // Date d'arrêt des paiements de chaque année (percentile 99 des dates de paiement connues).
  const arret = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const f of fournisseurs ?? []) {
      for (const d of f.documents) {
        const a = anneeComptable(d)
        if (a && d.datePaiement) (m.get(a) ?? m.set(a, []).get(a)!).push(d.datePaiement)
      }
    }
    const out: Record<string, string> = {}
    for (const [a, l] of m) {
      l.sort()
      out[a] = l[Math.min(l.length - 1, Math.floor(l.length * 0.99))]
    }
    return out
  }, [fournisseurs])

  // Toutes les factures et tous les documents (pour achats / dettes TTC), filtrés par entité.
  const { factures, docsTtc } = useMemo(() => {
    const factures: Facture[] = []
    const docsTtc: { annee: string; ttc: number; pay: string | null; doc: DepenseDocument }[] = []
    for (const f of fournisseurs ?? []) {
      for (const d of f.documents) {
        if (entite && d.entite !== entite) continue
        const a = anneeComptable(d)
        if (!a || !/^\d{4}$/.test(a)) continue
        docsTtc.push({ annee: a, ttc: (d.montant ?? 0) + (d.tva ?? 0), pay: d.datePaiement, doc: d })
        if (d.genre !== 'Facture' || d.montant == null || !d.dateEcheance) continue
        const m = d.condition ? ESCOMPTE.exec(d.condition) : null
        factures.push({
          nfr: f.nfr,
          nom: f.nom,
          entite: d.entite,
          annee: a,
          ech: d.dateEcheance,
          pay: d.datePaiement,
          retard: d.datePaiement ? jours(d.dateEcheance, d.datePaiement) : null,
          ht: d.montant,
          dispo: d.dateDispo ?? null,
          doc: d.dateDoc,
          esc: m && +m[2].replace(',', '.') > 0 ? { delai: +m[1], taux: +m[2].replace(',', '.') / 100 } : null,
        })
      }
    }
    return { factures, docsTtc }
  }, [fournisseurs, entite])

  const entites = useMemo(() => {
    const s = new Set<string>()
    for (const f of fournisseurs ?? []) for (const d of f.documents) if (d.entite) s.add(d.entite)
    return [...s].sort()
  }, [fournisseurs])
  const annees = useMemo(() => Object.keys(arret).filter((a) => /^\d{4}$/.test(a)).sort(), [arret])
  const anneeSel = annee ?? annees[annees.length - 1] ?? ''
  const toutes = anneeSel === 'toutes'

  /** Indicateurs d'un ensemble de factures (à l'arrêt de chaque facture : celui de son année). */
  function indicateurs(l: Facture[]) {
    const payees = l.filter((f) => f.pay)
    const impayeesEchues = l.filter((f) => !f.pay && f.ech <= (arret[f.annee] ?? '0000'))
    const aTemps = payees.filter((f) => (f.retard ?? 1) <= 0)
    const enRetard = payees.filter((f) => (f.retard ?? 0) > 0)
    const base = payees.length + impayeesEchues.length
    const escOb = payees.filter((f) => f.esc && f.pay! <= ajouteJours(f.doc ?? f.ech, f.esc.delai)).reduce((t, f) => t + f.ht * f.esc!.taux, 0)
    const escPerdu = l
      .filter((f) => f.esc && f.doc && (f.pay ? f.pay > ajouteJours(f.doc, f.esc.delai) : ajouteJours(f.doc, f.esc.delai) <= (arret[f.annee] ?? '0000')))
      .reduce((t, f) => t + f.ht * f.esc!.taux, 0)
    const interne = l.filter((f) => f.dispo && f.doc).map((f) => jours(f.doc!, f.dispo!)).filter((v) => v >= 0 && v <= 120)
    return {
      nb: l.length,
      nbPayees: payees.length,
      nbATemps: aTemps.length,
      nbRetard: enRetard.length,
      nbImpayeesEchues: impayeesEchues.length,
      taux: base ? (aTemps.length / base) * 100 : null,
      retardMoyen: moy(enRetard.map((f) => f.retard!)),
      interneMoyen: moy(interne),
      interneMedian: mediane(interne),
      escOb,
      escPerdu,
    }
  }

  /** DPO = (dettes fournisseurs TTC / achats TTC de l'année) × jours ; dettes = documents de l'année impayés à la clôture. */
  function dpoAnnee(a: string): number | null {
    const l = docsTtc.filter((d) => d.annee === a)
    const achats = l.reduce((t, d) => t + d.ttc, 0)
    if (achats <= 0) return null
    const finAnnee = `${a}-12-31`
    const cloture = (arret[a] ?? finAnnee) < finAnnee ? arret[a] : finAnnee // année en cours : à la date d'arrêt
    const dettes = l.filter((d) => d.ttc > 0 && (!d.pay || d.pay > cloture)).reduce((t, d) => t + d.ttc, 0)
    const nbJours = cloture < finAnnee ? jours(`${a}-01-01`, cloture) + 1 : 365
    return (dettes / achats) * nbJours
  }

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

  const contexte = [entite ? entiteLabel(entite) : 'Toutes entités', toutes ? 'Toutes années' : anneeSel].join(' · ')

  function exporterAnnees() {
    exportXlsx(`paiement_par_annee_${dateFichier()}`, [{
      nom: 'Par année',
      lignes: [[contexte], ['Année', "Date d'arrêt des paiements", 'Factures', 'Payées à temps', 'Payées en retard', 'Taux de paiement à l\'échéance %', 'Retard moyen (j)', 'DPO (j, TTC)', 'Délai interne moyen (j)', 'Escomptes obtenus CHF HT', 'Escomptes perdus CHF HT', 'Escomptes comptabilisés (compte 702) CHF'],
        ...parAnnee.map((r) => [r.annee, arret[r.annee] ?? null, r.nb, r.nbATemps, r.nbRetard, r.taux != null ? Math.round(r.taux * 10) / 10 : null, r.retardMoyen != null ? Math.round(r.retardMoyen * 10) / 10 : null, r.dpo != null ? Math.round(r.dpo * 10) / 10 : null, r.interneMoyen != null ? Math.round(r.interneMoyen * 10) / 10 : null, Math.round(r.escOb), Math.round(r.escPerdu), r.comptabilise != null ? Math.round(Math.abs(r.comptabilise)) : null] as (string | number | null)[])],
    }])
  }
  const exporterListe = (nom: string, l: typeof classement.mieux) =>
    exportXlsx(`${nom}_${dateFichier()}`, [{ nom, lignes: [[contexte], ['Rang', 'Fournisseur', 'Retard moyen (j)', 'Taux à l\'échéance %', 'Factures payées', 'Montant CHF HT'], ...l.map((e, i) => [i + 1, e.nom, Math.round(e.moyen * 10) / 10, Math.round(e.taux * 10) / 10, e.retards.length, Math.round(e.ht)] as (string | number | null)[])] }])

  if (!fournisseurs) return <p className="text-sm text-slate-500">Chargement des données de paiement…</p>

  const tonTaux = kpi.taux == null ? undefined : kpi.taux >= SEUIL_TAUX ? 'bon' : kpi.taux >= 70 ? 'moyen' : 'mauvais'

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">💳 Paiement des fournisseurs</h3>
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
        <p className="text-[11px] text-slate-400">
          Montants HT (le DPO est en TTC). Retard de paiement = date de paiement − date d'échéance (positif = retard, négatif = paiement anticipé). Paiements connus
          jusqu'au : {annees.map((a) => `${a} → ${arret[a]?.split('-').reverse().join('.')}`).join(' · ')} — une facture impayée est jugée à cette date.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tuile label={`Taux de paiement à l'échéance (objectif ≥ ${SEUIL_TAUX} %)`} valeur={kpi.taux != null ? `${fmt1(kpi.taux)} %` : '—'} sous={`${fmt(kpi.nbATemps)} à temps / ${fmt(kpi.nbPayees + kpi.nbImpayeesEchues)} factures`} ton={tonTaux} />
        <Tuile label="Retard moyen (factures payées en retard)" valeur={kpi.retardMoyen != null ? `${fmt1(kpi.retardMoyen)} j` : '—'} sous={`${fmt(kpi.nbRetard)} factures en retard`} ton="mauvais" />
        <Tuile label="Délai moyen de paiement (DPO, TTC)" valeur={!toutes && ligneAnnee?.dpo != null ? `${fmt1(ligneAnnee.dpo)} j` : '—'} sous={toutes ? 'voir le tableau par année' : '(dettes ÷ achats) × jours'} />
        <Tuile label="Délai de traitement interne (indicatif)" valeur={kpi.interneMoyen != null ? `${fmt1(kpi.interneMoyen)} j` : '—'} sous={kpi.interneMedian != null ? `médiane ${kpi.interneMedian} j · mise à disposition − date facture` : undefined} />
        <Tuile
          label={escComptabilise != null ? 'Escomptes obtenus (comptabilisés, compte 702)' : 'Escomptes obtenus (estimation HT)'}
          valeur={`${fmt(escComptabilise ?? kpi.escOb)} CHF`}
          ton="bon"
          sous={escComptabilise != null ? `estimation d'après les conditions : ${fmt(kpi.escOb)} CHF` : "estimation : payé dans le délai d'escompte"}
        />
        <Tuile label="Escomptes perdus (estimation HT)" valeur={`${fmt(kpi.escPerdu)} CHF`} ton="mauvais" sous="payé après le délai d'escompte ou pas encore payé" />
        <Tuile label="Montant échu non payé (HT)" valeur={`${fmt(totalEchu)} CHF`} ton="moyen" sous={`${fmt(balance.reduce((t, b) => t + b.nb, 0))} factures`} />
        <Tuile label="Factures analysées" valeur={fmt(kpi.nb)} sous={contexte} />
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
              <th className="py-1 px-2 text-right">Escomptes obtenus</th>
              <th className="py-1 px-2 text-right">Escomptes perdus</th>
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
              </tr>
            ))}
          </tbody>
        </table>
        {!entite && Object.keys(comptabilises).length > 0 && (
          <p className="text-[11px] text-slate-400">
            Escomptes réellement comptabilisés (compte 702, tous fournisseurs) : {annees.filter((a) => comptabilises[a] != null).map((a) => `${a} : ${fmt(Math.abs(comptabilises[a]))} CHF`).join(' · ')} — à comparer aux « obtenus »
            calculés ci-dessus à partir des conditions de paiement.
          </p>
        )}
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
