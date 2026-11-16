import { useEffect, useMemo, useState } from 'react'
import type { DepenseBucketStats, DepenseChantierStats, DepenseDocument, DepenseFournisseur, DepensesGlobal, DepenseTranche, GroupeFournisseur, GroupeTotal } from '../data/depenses'
import {
  anneeComptable,
  anneesSignificatives,
  chantierColor,
  chantierLabel,
  computeBucketStats,
  computeTranches,
  formatCurrency,
  loadDepensesFournisseurs,
  loadDepensesGlobal,
  loadGroupesFournisseurs,
  pct,
} from '../data/depenses'
import { entiteLabel, secteurColor } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { Camembert } from './DepenseCharts'
import { useFiltresSpend } from './FiltresSpend'

function StatTile({
  label,
  value,
  sub,
  tone,
  title,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'warning' | 'critical'
  /** Infobulle native au survol (ex. détail des exclusions du reporting). */
  title?: string
}) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'warning' ? 'text-amber-600' : tone === 'critical' ? 'text-red-600' : 'text-indigo-600'
  return (
    <div className={`card text-center py-4 ${title ? 'cursor-help' : ''}`} title={title}>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function ExcelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 whitespace-nowrap" onClick={onClick}>
      ⬇ Excel
    </button>
  )
}

/** En-tête de carte : titre + bouton d'export Excel. */
function CardHead({ titre, onExcel }: { titre: string; onExcel?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <h3 className="font-semibold">{titre}</h3>
      {onExcel && <ExcelBtn onClick={onExcel} />}
    </div>
  )
}

interface GroupeAvecMembres extends GroupeTotal {
  /** Noms des fournisseurs du groupe ayant une dépense dans la sélection, du plus gros au plus petit. */
  membres: string[]
}

function EntiteTable({ parEntite }: { parEntite: Record<string, DepenseBucketStats> }) {
  const rows = Object.entries(parEntite).sort((a, b) => b[1].montantTotal - a[1].montantTotal)
  const total = rows.reduce((s, [, v]) => s + v.montantTotal, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Entité</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2 pr-3">Documents</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([entite, v]) => (
            <tr key={entite} className="border-b border-slate-100">
              <td className="py-1.5 pr-3">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                  style={{ backgroundColor: secteurColor(entite) }}
                >
                  {entiteLabel(entite)}
                </span>
              </td>
              <td className="py-1.5 pr-3 font-medium">{formatCurrency(v.montantTotal)}</td>
              <td className="py-1.5 pr-3">{pct(v.montantTotal, total)}%</td>
              <td className="py-1.5 pr-3">{v.nbDocuments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnneeTable({ parAnnee }: { parAnnee: Record<string, DepenseBucketStats> }) {
  // Masque les années à volume négligeable (ex. une poignée de documents isolés en 2019-2022
  // dans ce jeu de données) — polluaient le tableau sans être représentatives.
  const anneesAffichees = anneesSignificatives(parAnnee)
  const rows = anneesAffichees.map((a) => [a, parAnnee[a]] as const)
  const total = rows.reduce((s, [, v]) => s + v.montantTotal, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Année</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2 pr-3">Documents</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([annee, v]) => (
            <tr key={annee} className="border-b border-slate-100">
              <td className="py-1.5 pr-3 font-medium">{annee}</td>
              <td className="py-1.5 pr-3 font-medium">{formatCurrency(v.montantTotal)}</td>
              <td className="py-1.5 pr-3">{pct(v.montantTotal, total)}%</td>
              <td className="py-1.5 pr-3">{v.nbDocuments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Famille d'achat = classification reprise de l'historique d'évaluation (FOURNISSEURS/
 * SOUS-TRAITANTS/TRANSPORTEURS/codes CFC...) par correspondance de nom — "Non classé" = jamais
 * évalué, pas une erreur. Sert au rapprochement CA/fournisseur/famille. */
function FamilleAchatTable({ parFamilleAchat }: { parFamilleAchat: Record<string, DepenseBucketStats> }) {
  const rows = Object.entries(parFamilleAchat).sort((a, b) => b[1].montantTotal - a[1].montantTotal)
  const total = rows.reduce((s, [, v]) => s + v.montantTotal, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Famille d'achat</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2 pr-3">Fournisseurs</th>
            <th className="py-2">Documents</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([famille, v]) => (
            <tr key={famille} className={`border-b border-slate-100 ${famille === 'Non classé' ? 'text-slate-400' : ''}`}>
              <td className="py-1.5 pr-3">{famille}</td>
              <td className="py-1.5 pr-3 font-medium">{formatCurrency(v.montantTotal)}</td>
              <td className="py-1.5 pr-3">{pct(v.montantTotal, total)}%</td>
              <td className="py-1.5 pr-3">{v.nbFournisseurs ?? '—'}</td>
              <td className="py-1.5">{v.nbDocuments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChantierTable({
  parChantier,
  nbChantiers,
  nbChantiersAvecNom,
  montantTotal,
}: {
  parChantier: DepenseChantierStats[]
  nbChantiers: number
  nbChantiersAvecNom: number
  montantTotal: number
}) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? parChantier : parChantier.slice(0, 20)
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chantierColor(false) }} />
          Chantier Induni
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chantierColor(true) }} />
          Consortium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chantierColor(null) }} />
          Non identifié
        </span>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Chantier</th>
            <th className="py-2 pr-3">Technicien</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2 pr-3">Documents</th>
            <th className="py-2 pr-3">Nb factures</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.code} className="border-b border-slate-100">
              <td className="py-1.5 pr-3">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: chantierColor(c.consortium) }}
                />
                {chantierLabel(c.code, c.nom)}
              </td>
              <td className="py-1.5 pr-3 text-slate-500">{c.technicien ?? '—'}</td>
              <td className="py-1.5 pr-3 font-medium">{formatCurrency(c.montantTotal)}</td>
              <td className="py-1.5 pr-3">{pct(c.montantTotal, montantTotal)}%</td>
              <td className="py-1.5 pr-3">{c.nbDocuments}</td>
              <td className="py-1.5 pr-3">{c.nbFactures}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {parChantier.length > 20 && (
        <button className="text-xs text-indigo-600 hover:underline mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Réduire' : `Afficher les ${parChantier.length} chantiers`}
        </button>
      )}
      <p className="text-xs text-slate-400 mt-2">
        {nbChantiers} chantier(s) pour cette sélection, triés par montant décroissant — noms retrouvés pour {nbChantiersAvecNom} d'entre eux
        (référentiel des chantiers). Le code consortium/Induni est celui du chantier, qui ne coïncide pas toujours avec le champ « Aff. » du
        document (~18 % d'écart constaté).
      </p>
    </div>
  )
}

function TrancheTable({ tranches }: { tranches: DepenseTranche[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Tranche de montant</th>
            <th className="py-2 pr-3">Nb factures</th>
            <th className="py-2 pr-3">% du nombre</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2">% du montant</th>
          </tr>
        </thead>
        <tbody>
          {tranches.map((t) => (
            <tr key={t.label} className="border-b border-slate-100">
              <td className="py-1.5 pr-3 font-medium">{t.label}</td>
              <td className="py-1.5 pr-3">{t.nbFactures}</td>
              <td className="py-1.5 pr-3">{t.pctNb != null ? `${t.pctNb.toFixed(1)}%` : '—'}</td>
              <td className="py-1.5 pr-3">{formatCurrency(t.montantFactures)}</td>
              <td className="py-1.5">{t.pctMontant != null ? `${t.pctMontant.toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TopFournisseursTable({ top20, montantTotal }: { top20: { nfr: number; nom: string; montant: number }[]; montantTotal: number }) {
  let cumul = 0
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Fournisseur</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2">% cumulé</th>
          </tr>
        </thead>
        <tbody>
          {top20.map((f, i) => {
            cumul += f.montant
            return (
              <tr key={f.nfr} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                <td className="py-1.5 pr-3 font-medium">{f.nom}</td>
                <td className="py-1.5 pr-3">{formatCurrency(f.montant)}</td>
                <td className="py-1.5 pr-3">{pct(f.montant, montantTotal)}%</td>
                <td className="py-1.5">{pct(cumul, montantTotal)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        Les écritures intercompagnie (INDUNI &amp; CIE — loyers, refacturations internes) et la caisse de
        compensation (cotisations sociales) sont exclues de toute l'analyse de la dépense, ici comme
        ailleurs dans cet onglet.
      </p>
    </div>
  )
}

function TopGroupesTable({ groupes, montantTotal }: { groupes: GroupeAvecMembres[]; montantTotal: number }) {
  const top20 = groupes.slice(0, 20)
  let cumul = 0
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Groupe</th>
            <th className="py-2 pr-3">Entités</th>
            <th className="py-2 pr-3">Montant</th>
            <th className="py-2 pr-3">% du total</th>
            <th className="py-2">% cumulé</th>
          </tr>
        </thead>
        <tbody>
          {top20.map((g, i) => {
            cumul += g.montantTotal
            return (
              <tr key={g.nom} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {g.nom}
                  {g.parent && <span className="ml-1.5 font-normal text-slate-400">(filiale du {g.parent})</span>}
                  {g.membres.length > 0 && <div className="text-[9px] font-normal leading-tight text-slate-400 mt-0.5 max-w-md">{g.membres.join(' · ')}</div>}
                </td>
                <td className="py-1.5 pr-3">{g.nbEntites}</td>
                <td className="py-1.5 pr-3">{formatCurrency(g.montantTotal)}</td>
                <td className="py-1.5 pr-3">{pct(g.montantTotal, montantTotal)}%</td>
                <td className="py-1.5">{pct(cumul, montantTotal)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        Regroupements de fournisseurs distincts appartenant au même groupe (holding, filiales, entreprises
        sœurs), validés manuellement — voir le fichier de détection de doublons/groupes.
      </p>
    </div>
  )
}

export default function DepenseTab({ onZoom }: { onZoom: (nom: string) => void }) {
  const [data, setData] = useState<DepensesGlobal | null>(null)
  const [groupes, setGroupes] = useState<GroupeFournisseur[] | null>(null)
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  // Périmètre commun à la section (barre du haut) ; repli sur un état local hors de la section.
  const partage = useFiltresSpend()
  const [localEntite, setLocalEntite] = useState<string | null>(null)
  const [localAnnee, setLocalAnnee] = useState<string | null>(null)
  const selectedEntite = partage ? partage.entite || null : localEntite
  const selectedAnnee = partage ? (partage.annee === 'toutes' ? null : partage.annee || null) : localAnnee
  const setSelectedEntite = (v: string | null) => (partage ? partage.setEntite(v ?? '') : setLocalEntite(v))
  const setSelectedAnnee = (v: string | null) => (partage ? partage.setAnnee(v ?? 'toutes') : setLocalAnnee(v))

  useEffect(() => {
    loadDepensesGlobal().then(setData)
    loadGroupesFournisseurs().then(setGroupes)
    loadDepensesFournisseurs().then(setFournisseurs)
  }, [])

  const anneesDisponibles = useMemo(() => (data ? anneesSignificatives(data.parAnnee) : []), [data])


  // Le filtre par entité et/ou par année s'applique aux tuiles d'analyse achat et au Top 20
  // fournisseurs/groupes — mais pas au détail par chantier ni aux tranches, qui restent "toutes
  // entités/années confondues". Un seul filtre actif : on réutilise directement les agrégats déjà
  // précalculés et légers (data.parEntite / data.parAnnee), chargés indépendamment de
  // `fournisseurs` (depensesFournisseurs.json, 50+ Mo, bien plus long à charger) — sinon les tuiles
  // retomberaient silencieusement sur le total non filtré tant que ce gros fichier n'est pas prêt.
  // Les deux filtres combinés à la fois sont le seul cas qui a besoin de recalculer depuis les
  // documents bruts (aucune table précalculée entité × année).
  const filtered = useMemo(() => {
    if (!fournisseurs || !selectedEntite || !selectedAnnee) return null
    const docs: typeof fournisseurs[number]['documents'] = []
    let nbFournisseurs = 0
    for (const f of fournisseurs) {
      let has = false
      for (const d of f.documents) {
        if (d.entite !== selectedEntite) continue
        if (anneeComptable(d) !== selectedAnnee) continue
        docs.push(d)
        has = true
      }
      if (has) nbFournisseurs++
    }
    return { docs, nbFournisseurs }
  }, [fournisseurs, selectedEntite, selectedAnnee])

  const g = useMemo(() => {
    if (selectedEntite && selectedAnnee) {
      if (!filtered) return undefined // encore en cours de chargement de fournisseurs
      return { ...computeBucketStats(filtered.docs, false), nbFournisseurs: filtered.nbFournisseurs }
    }
    if (selectedAnnee) return data?.parAnnee[selectedAnnee]
    if (selectedEntite) return data?.parEntite[selectedEntite]
    return data?.global
  }, [filtered, data, selectedEntite, selectedAnnee])

  const top20ForEntite = useMemo(() => {
    if (!selectedEntite && !selectedAnnee) return data?.top20Fournisseurs ?? null
    if (!fournisseurs) return null
    return fournisseurs
      .map((f) => {
        const docs = f.documents.filter(
          (d) => (!selectedEntite || d.entite === selectedEntite) && (!selectedAnnee || anneeComptable(d) === selectedAnnee),
        )
        return { nfr: f.nfr, nom: f.nom, montant: Math.round(docs.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100 }
      })
      .filter((f) => f.montant > 0)
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 20)
  }, [data, fournisseurs, selectedEntite, selectedAnnee])
  const chantierPct = useMemo(
    () => (data && !selectedEntite && !selectedAnnee ? pct(data.chantier.montantTotal, data.global.montantTotal) : null),
    [data, selectedEntite, selectedAnnee],
  )
  const consortiumPct = useMemo(
    () => (data && !selectedEntite && !selectedAnnee ? pct(data.consortium.montantTotal, data.global.montantTotal) : null),
    [data, selectedEntite, selectedAnnee],
  )

  // ---- Périmètre commun à toutes les sections : entité ET année choisies (calculé depuis les documents) ----
  const entrees = useMemo(() => {
    if (!fournisseurs) return null
    const out: { d: DepenseDocument; f: DepenseFournisseur }[] = []
    for (const f of fournisseurs) {
      for (const d of f.documents) {
        if (selectedEntite && d.entite !== selectedEntite) continue
        if (selectedAnnee && anneeComptable(d) !== selectedAnnee) continue
        out.push({ d, f })
      }
    }
    return out
  }, [fournisseurs, selectedEntite, selectedAnnee])

  function grouper<K extends string>(cle: (e: { d: DepenseDocument; f: DepenseFournisseur }) => K | null) {
    const m = new Map<K, { d: DepenseDocument; f: DepenseFournisseur }[]>()
    for (const e of entrees ?? []) {
      const k = cle(e)
      if (k == null) continue
      const l = m.get(k)
      if (l) l.push(e)
      else m.set(k, [e])
    }
    return m
  }

  const parAnneeEff = useMemo<Record<string, DepenseBucketStats> | null>(() => {
    if (entrees) {
      const m = grouper((e) => anneeComptable(e.d))
      return Object.fromEntries([...m].map(([a, l]) => [a, computeBucketStats(l.map((e) => e.d))]))
    }
    return !selectedEntite && !selectedAnnee && data ? data.parAnnee : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, data])

  const parEntiteEff = useMemo<Record<string, DepenseBucketStats> | null>(() => {
    if (entrees) {
      const m = grouper((e) => e.d.entite)
      return Object.fromEntries([...m].map(([en, l]) => [en, computeBucketStats(l.map((e) => e.d))]))
    }
    return !selectedEntite && !selectedAnnee && data ? data.parEntite : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, data])

  const parFamilleEff = useMemo<Record<string, DepenseBucketStats> | null>(() => {
    if (entrees) {
      const m = grouper((e) => e.f.familleAchat || 'Non classé')
      return Object.fromEntries([...m].map(([fa, l]) => [fa, { ...computeBucketStats(l.map((e) => e.d), true), nbFournisseurs: new Set(l.map((e) => e.f.nfr)).size }]))
    }
    return !selectedEntite && !selectedAnnee && data ? data.parFamilleAchat : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, data])

  const chantierEff = useMemo(() => {
    if (!entrees) return null
    const techniciens = new Map((data?.parChantier ?? []).map((c) => [c.code, c.technicien]))
    const m = grouper((e) => e.d.chantier ?? 'NON RENSEIGNE')
    const rows: DepenseChantierStats[] = [...m].map(([code, l]) => {
      const docs = l.map((e) => e.d)
      return {
        ...computeBucketStats(docs, true),
        nbFournisseurs: new Set(l.map((e) => e.f.nfr)).size,
        code,
        nom: docs.find((d) => d.chantierNom)?.chantierNom ?? null,
        consortium: docs.find((d) => d.chantierConsortium != null)?.chantierConsortium ?? null,
        technicien: techniciens.get(code) ?? null,
      }
    })
    rows.sort((a, b) => b.montantTotal - a.montantTotal)
    return { rows, nbAvecNom: rows.filter((r) => r.nom).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, data])

  const tranchesEff = useMemo(() => {
    if (entrees) return computeTranches(entrees.map((e) => e.d))
    return null
  }, [entrees])

  // Groupes de fournisseurs : somme des membres sur la sélection (masqué quand une seule entité est choisie).
  const groupesEff = useMemo<GroupeAvecMembres[] | null>(() => {
    if (!groupes || !entrees) return null
    const parNfr = new Map<number, number>()
    const noms = new Map<number, string>()
    for (const { d, f } of entrees) {
      parNfr.set(f.nfr, (parNfr.get(f.nfr) ?? 0) + (d.montant ?? 0))
      noms.set(f.nfr, f.nom)
    }
    return groupes
      .map((gr) => {
        const actifs = gr.membres.filter((m) => (parNfr.get(m.nfr) ?? 0) !== 0).sort((a, b) => (parNfr.get(b.nfr) ?? 0) - (parNfr.get(a.nfr) ?? 0))
        const montantTotal = Math.round(gr.membres.reduce((t, m) => t + (parNfr.get(m.nfr) ?? 0), 0) * 100) / 100
        return { nom: gr.nom, parent: gr.parent, montantTotal, nbEntites: gr.membres.length, membres: (actifs.length ? actifs : gr.membres).map((m) => noms.get(m.nfr) ?? m.nom) }
      })
      .filter((gr) => gr.montantTotal !== 0)
      .sort((a, b) => b.montantTotal - a.montantTotal)
  }, [groupes, entrees])

  // ---- Exports Excel ----
  const contexteXls = [selectedEntite ? entiteLabel(selectedEntite) : 'Toutes entités', selectedAnnee ?? 'Toutes années'].join(' · ')
  function exportBuckets(nom: string, colonne: string, rows: [string, DepenseBucketStats][], total: number) {
    exportXlsx(`depense_${nom}_${dateFichier()}`, [
      {
        nom,
        lignes: [
          [contexteXls],
          [colonne, 'Montant CHF HT', '% du total', 'Documents'],
          ...rows.map(([k, v]) => [k, v.montantTotal, pct(v.montantTotal, total), v.nbDocuments] as (string | number | null)[]),
        ],
      },
    ])
  }

  if (!data || !g) {
    return <p className="text-sm text-slate-500">Chargement des données de dépense…</p>
  }

  const entites = Object.keys(data.parEntite).sort((a, b) => data.parEntite[b].montantTotal - data.parEntite[a].montantTotal)

  return (
    <div className="space-y-4">
      <div className="card bg-amber-50 border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Méthodologie :</strong> tous les montants ci-dessous sont <strong>HT (hors TVA)</strong> : montant du journal
          comptable moins l'impôt préalable (TVA) de chaque document. Seules les charges d'achat du plan comptable sont comptées.
          Les délais et retards de paiement sont dans l'onglet « Paiement ».
        </p>
      </div>

      {!partage && (
        <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase text-slate-500 mr-1">Analyse achat — entité</span>
        <button
          className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
          style={
            !selectedEntite
              ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
          }
          onClick={() => setSelectedEntite(null)}
        >
          Toutes entités
        </button>
        {entites.map((entite) => (
          <button
            key={entite}
            className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
            style={
              selectedEntite === entite
                ? { backgroundColor: secteurColor(entite), borderColor: secteurColor(entite), color: 'white' }
                : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
            }
            onClick={() => setSelectedEntite(entite)}
          >
            {entiteLabel(entite)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase text-slate-500 mr-1">Analyse achat — année</span>
        <button
          className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
          style={
            !selectedAnnee
              ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
          }
          onClick={() => setSelectedAnnee(null)}
        >
          Toutes années
        </button>
        {anneesDisponibles.map((annee) => (
          <button
            key={annee}
            className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
            style={
              selectedAnnee === annee
                ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' }
                : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
            }
            onClick={() => setSelectedAnnee(annee)}
            title={data.anneesPartielles?.[annee] ? `Année en cours : données ${data.anneesPartielles[annee]} seulement — ne pas comparer à une année complète.` : undefined}
          >
            {annee}
            {data.anneesPartielles?.[annee] ? ' (partielle)' : ''}
          </button>
        ))}
      </div>

        </>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Dépense totale HT (hors TVA)"
          value={formatCurrency(g.montantTotal)}
          title={[
            data.exclusions
              ? `${formatCurrency(data.exclusions.montantTotal)} exclus (${data.exclusions.nbLignes} ligne(s), montants TTC) : ${data.exclusions.details.map((e) => `${e.nom} (${formatCurrency(e.montant)}) — ${e.motif}`).join(' · ')}`
              : null,
            data.exclusionsCompte
              ? `Plan comptable : ${formatCurrency(data.exclusionsCompte.montantTotal)} retirés (${data.exclusionsCompte.nbLignes} document(s) hors charges d'achat — ${data.exclusionsCompte.details.slice(0, 6).map((e) => `${e.compte} ${e.libelle || ''} ${e.annee}: ${formatCurrency(e.montant)}`).join(' · ')}). ${data.exclusionsCompte.regle}`
              : null,
          ]
            .filter(Boolean)
            .join('\n\n') || undefined}
        />
        {!selectedEntite && !selectedAnnee && (
          <>
            <StatTile
              label="Chantier Induni"
              value={formatCurrency(data.chantier.montantTotal)}
              sub={chantierPct != null ? `${chantierPct}% du total` : undefined}
            />
            <StatTile
              label="Consortium"
              value={formatCurrency(data.consortium.montantTotal)}
              sub={consortiumPct != null ? `${consortiumPct}% du total` : undefined}
            />
          </>
        )}
        <StatTile label="Fournisseurs actifs" value={String(g.nbFournisseurs)} />
        <StatTile
          label="Panier moyen"
          value={formatCurrency(g.montantTotal / g.nbDocuments)}
          sub={`${formatCurrency(g.montantTotal)} / ${g.nbDocuments} document(s)`}
        />
        <StatTile
          label="Factures"
          value={String(g.nbFactures)}
          sub={`Facture moyenne : ${formatCurrency(g.montantFactures / g.nbFactures)}`}
        />
      </div>

      {/* Dépense par année : masquée quand une seule année est choisie (il n'y a plus qu'elle). */}
      {!selectedAnnee && (
        <div className="card">
          <CardHead
            titre="Dépense par année"
            onExcel={parAnneeEff ? () => exportBuckets('par_annee', 'Année', anneesSignificatives(parAnneeEff).map((a) => [a, parAnneeEff[a]]), Object.values(parAnneeEff).reduce((t, v) => t + v.montantTotal, 0)) : undefined}
          />
          <p className="text-xs text-slate-500 mb-3">
            Année de comptabilisation (date COFI){selectedEntite ? ` — entité ${entiteLabel(selectedEntite)}` : ''}.
          </p>
          {parAnneeEff ? <AnneeTable parAnnee={parAnneeEff} /> : <p className="text-sm text-slate-500">Chargement…</p>}
        </div>
      )}

      {/* Dépense par entité : masquée quand une seule entité est choisie. */}
      {!selectedEntite && (
        <div className="card">
          <CardHead
            titre="Dépense par entité"
            onExcel={parEntiteEff ? () => exportBuckets('par_entite', 'Entité', Object.entries(parEntiteEff).sort((a, b) => b[1].montantTotal - a[1].montantTotal).map(([e, v]) => [entiteLabel(e), v]), Object.values(parEntiteEff).reduce((t, v) => t + v.montantTotal, 0)) : undefined}
          />
          {selectedAnnee && <p className="text-xs text-slate-500 mb-2">Année {selectedAnnee}.</p>}
          {parEntiteEff ? (
            <div className="space-y-4">
              <Camembert lignes={Object.entries(parEntiteEff).map(([e, v]) => ({ label: entiteLabel(e), valeur: v.montantTotal }))} />
              <EntiteTable parEntite={parEntiteEff} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chargement…</p>
          )}
        </div>
      )}

      <div className="card">
        <CardHead
          titre="Dépense par famille d'achat"
          onExcel={parFamilleEff ? () => exportBuckets('par_famille', "Famille d'achat", Object.entries(parFamilleEff).sort((a, b) => b[1].montantTotal - a[1].montantTotal), Object.values(parFamilleEff).reduce((t, v) => t + v.montantTotal, 0)) : undefined}
        />
        <p className="text-xs text-slate-500 mb-3">
          {contexteXls}. Famille reprise du Dashboard évaluations (par correspondance de nom) — « Non classé » = fournisseur jamais évalué.
        </p>
        {parFamilleEff ? (
          <div className="space-y-4">
            <Camembert lignes={Object.entries(parFamilleEff).map(([f2, v]) => ({ label: f2, valeur: v.montantTotal }))} />
            <FamilleAchatTable parFamilleAchat={parFamilleEff} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </div>

      <div className="card">
        <CardHead
          titre="Dépense par chantier"
          onExcel={
            chantierEff
              ? () =>
                  exportXlsx(`depense_par_chantier_${dateFichier()}`, [
                    {
                      nom: 'Par chantier',
                      lignes: [
                        [contexteXls],
                        ['Chantier', 'Technicien', 'Montant CHF HT', '% du total', 'Documents', 'Factures'],
                        ...chantierEff.rows.map((c) => [chantierLabel(c.code, c.nom), c.technicien, c.montantTotal, pct(c.montantTotal, g.montantTotal), c.nbDocuments, c.nbFactures] as (string | number | null)[]),
                      ],
                    },
                  ])
              : undefined
          }
        />
        <p className="text-xs text-slate-500 mb-3">
          {contexteXls}. « Chantier » = numéro « SECT Débit » du journal comptable.
        </p>
        {chantierEff ? (
          <div className="space-y-4">
            <Camembert lignes={chantierEff.rows.map((c) => ({ label: chantierLabel(c.code, c.nom), valeur: c.montantTotal }))} />
            <ChantierTable parChantier={chantierEff.rows} nbChantiers={chantierEff.rows.length} nbChantiersAvecNom={chantierEff.nbAvecNom} montantTotal={g.montantTotal} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </div>

      <div className="card">
        <CardHead
          titre="Répartition des factures par tranche de montant"
          onExcel={
            tranchesEff
              ? () =>
                  exportXlsx(`repartition_factures_${dateFichier()}`, [
                    {
                      nom: 'Tranches',
                      lignes: [[contexteXls], ['Tranche', 'Nb factures', '% du nombre', 'Montant CHF HT', '% du montant'], ...tranchesEff.tranches.map((t) => [t.label, t.nbFactures, t.pctNb, t.montantFactures, t.pctMontant] as (string | number | null)[])],
                    },
                  ])
              : undefined
          }
        />
        <p className="text-xs text-slate-500 mb-3">
          {contexteXls}. Uniquement les documents de genre « Facture » avec un montant renseigné
          {tranchesEff ? ` — ${tranchesEff.nbFactures.toLocaleString('fr-CH')} factures (${formatCurrency(tranchesEff.montantFactures)}). Panier moyen : ${formatCurrency(tranchesEff.panierMoyen)}.` : '.'}
        </p>
        {tranchesEff ? (
          <div className="space-y-4">
            <Camembert pareto={false} lignes={tranchesEff.tranches.map((t) => ({ label: t.label, valeur: t.montantFactures }))} />
            <TrancheTable tranches={tranchesEff.tranches} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </div>

      <div className="card">
        <CardHead
          titre="Top 20 fournisseurs par dépense"
          onExcel={
            top20ForEntite
              ? () => {
                  let cum = 0
                  exportXlsx(`top20_fournisseurs_${dateFichier()}`, [
                    {
                      nom: 'Top 20',
                      lignes: [[contexteXls], ['Rang', 'Fournisseur', 'Montant CHF HT', '% du total', '% cumulé'], ...top20ForEntite.map((f, i) => { cum += f.montant; return [i + 1, f.nom, f.montant, pct(f.montant, g.montantTotal), pct(cum, g.montantTotal)] as (string | number | null)[] })],
                    },
                  ])
                }
              : undefined
          }
        />
        <p className="text-xs text-slate-500 mb-3">Cliquez un nom pour ouvrir sa fiche fournisseur.</p>
        {top20ForEntite ? (
          <>
            <TopFournisseursTable top20={top20ForEntite} montantTotal={g.montantTotal} />
            <div className="mt-2 flex flex-wrap gap-2">
              {top20ForEntite.map((f) => (
                <button key={f.nfr} className="text-xs text-indigo-600 hover:underline" onClick={() => onZoom(f.nom)}>
                  {f.nom} →
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </div>

      {/* Top 20 groupes : masqué quand on est sur une seule entité. */}
      {!selectedEntite && groupesEff && groupesEff.length > 0 && (
        <div className="card">
          <CardHead
            titre="Top 20 groupes fournisseurs par dépense"
            onExcel={() => {
              let cum = 0
              exportXlsx(`top20_groupes_${dateFichier()}`, [
                {
                  nom: 'Top 20 groupes',
                  lignes: [[contexteXls], ['Rang', 'Groupe', 'Filiale du', 'Fournisseurs du groupe', 'Montant CHF HT', '% du total', '% cumulé'], ...groupesEff.slice(0, 20).map((gr, i) => { cum += gr.montantTotal; return [i + 1, gr.nom, gr.parent ?? null, gr.membres.join(' ; '), gr.montantTotal, pct(gr.montantTotal, g.montantTotal), pct(cum, g.montantTotal)] as (string | number | null)[] })],
                },
              ])
            }}
          />
          <p className="text-xs text-slate-500 mb-3">
            Fournisseurs distincts appartenant au même groupe, agrégés — {contexteXls}. Les fournisseurs du groupe sont indiqués en petit sous son nom.
          </p>
          <TopGroupesTable groupes={groupesEff} montantTotal={g.montantTotal} />
        </div>
      )}
    </div>
  )
}
