import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { MOIS_COURTS, SEUIL_QUEUE_CHF, dernierMois, lignesSpend, variation } from '../data/spend'
import { chantierLabel } from '../data/depenses'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { BarresH, EvolutionChart } from './DepenseCharts'
import { useFiltresSpend } from './FiltresSpend'

// Analyse fournisseurs : qui sont nos fournisseurs, combien, et que se passe-t-il (nouveaux, perdus, hausses,
// baisses, petits fournisseurs à regrouper, fournisseurs communs à plusieurs entités = levier de négociation groupe).
// Même périmètre que les autres onglets (barre du haut) ; comparaison à période égale quand l'année est partielle.

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmt1 = (v: number) => v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Etiquette = 'nouveau' | 'perdu' | 'hausse' | 'baisse' | 'queue' | 'multi'
const ETIQUETTES: Record<Etiquette, { label: string; classe: string; aide: string }> = {
  nouveau: { label: 'Nouveau', classe: 'bg-sky-100 text-sky-700', aide: "Jamais utilisé avant la période" },
  perdu: { label: 'Perdu', classe: 'bg-slate-200 text-slate-700', aide: "Dépense l'an dernier, aucune cette année" },
  hausse: { label: '▲ Hausse', classe: 'bg-orange-100 text-orange-700', aide: "+30 % et plus (écart d'au moins 10'000 CHF)" },
  baisse: { label: '▼ Baisse', classe: 'bg-teal-100 text-teal-700', aide: "−30 % et plus (écart d'au moins 10'000 CHF)" },
  queue: { label: 'Petit fournisseur', classe: 'bg-amber-100 text-amber-700', aide: `Moins de ${SEUIL_QUEUE_CHF.toLocaleString('fr-CH')} CHF sur la période` },
  multi: { label: 'Multi-entités', classe: 'bg-violet-100 text-violet-700', aide: 'Utilisé par plusieurs entités : levier de négociation groupe' },
}

interface Ligne {
  nfr: number
  nom: string
  famille: string
  entites: string[]
  nbChantiers: number
  cur: number
  prev: number
  part: number
  cumul: number
  etiquettes: Etiquette[]
}

export default function AnalyseFournisseursTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const f = useFiltresSpend()
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  const [recherche, setRecherche] = useState('')
  const [famille, setFamille] = useState('')
  const [filtreEtiquette, setFiltreEtiquette] = useState<Etiquette | ''>('')
  const [tri, setTri] = useState<{ col: 'nom' | 'cur' | 'prev' | 'evol' | 'part'; asc: boolean }>({ col: 'cur', asc: false })
  const [nbAffiche, setNbAffiche] = useState(50)
  const [sel, setSel] = useState<number | null>(null)

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const toutes = useMemo(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const entite = f?.entite ?? ''
  const base = useMemo(() => (entite ? toutes.filter((l) => l.entite === entite) : toutes), [toutes, entite])
  const annees = useMemo(() => [...new Set(toutes.map((l) => l.annee))].sort(), [toutes])
  const comparer = !!f && f.annee !== 'toutes'
  const an = comparer ? f!.annee : annees[annees.length - 1] ?? ''
  const an1 = String(Number(an) - 1)
  const partielle = comparer && partielles.includes(an)
  const moisMax = partielle ? dernierMois(toutes, an) : 11
  const libPeriode = comparer ? (partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an}` : an) : 'Toutes années'
  const libPrev = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an1}` : an1

  const lignes = useMemo<Ligne[]>(() => {
    const m = new Map<number, { nom: string; famille: string; ent: Set<string>; chant: Set<string>; cur: number; prev: number; avant: boolean }>()
    const get = (nfr: number, nom: string, fam: string) => {
      let e = m.get(nfr)
      if (!e) m.set(nfr, (e = { nom, famille: fam, ent: new Set(), chant: new Set(), cur: 0, prev: 0, avant: false }))
      return e
    }
    for (const l of base) {
      const dansPeriode = comparer ? l.annee === an && l.mois <= moisMax : true
      const dansPrev = comparer && l.annee === an1 && l.mois <= moisMax
      if (comparer && l.annee < an && l.montant !== 0) get(l.nfr, l.nom, l.famille).avant = true
      if (!dansPeriode && !dansPrev) continue
      const e = get(l.nfr, l.nom, l.famille)
      if (dansPeriode) {
        e.cur += l.montant
        e.ent.add(l.entite ?? 'AUTRES')
        if (l.chantier) e.chant.add(l.chantier)
      }
      if (dansPrev) e.prev += l.montant
    }
    const arr = [...m.entries()]
      .filter(([, e]) => e.cur !== 0 || e.prev !== 0)
      .map(([nfr, e]) => {
        const et: Etiquette[] = []
        if (comparer) {
          if (e.cur > 0 && !e.avant && e.prev <= 0) et.push('nouveau')
          if (e.prev > 0 && e.cur <= 0) et.push('perdu')
          if (e.cur > 0 && e.prev > 0 && e.cur - e.prev >= 10000 && e.cur / e.prev >= 1.3) et.push('hausse')
          if (e.cur > 0 && e.prev > 0 && e.prev - e.cur >= 10000 && e.cur / e.prev <= 0.7) et.push('baisse')
        }
        if (e.cur > 0 && e.cur < SEUIL_QUEUE_CHF) et.push('queue')
        if (e.ent.size >= 2) et.push('multi')
        return { nfr, nom: e.nom, famille: e.famille, entites: [...e.ent].sort(), nbChantiers: e.chant.size, cur: e.cur, prev: e.prev, part: 0, cumul: 0, etiquettes: et }
      })
      .sort((a, b) => b.cur - a.cur)
    const total = arr.reduce((t, e) => t + Math.max(0, e.cur), 0)
    let cum = 0
    for (const e of arr) {
      e.part = total > 0 ? (Math.max(0, e.cur) / total) * 100 : 0
      cum += e.part
      e.cumul = cum
    }
    return arr
  }, [base, comparer, an, an1, moisMax])

  const familles = useMemo(() => [...new Set(lignes.map((l) => l.famille))].sort(), [lignes])
  const compteurs = useMemo(() => {
    const c: Record<Etiquette, { nb: number; montant: number }> = { nouveau: { nb: 0, montant: 0 }, perdu: { nb: 0, montant: 0 }, hausse: { nb: 0, montant: 0 }, baisse: { nb: 0, montant: 0 }, queue: { nb: 0, montant: 0 }, multi: { nb: 0, montant: 0 } }
    for (const l of lignes) for (const e of l.etiquettes) {
      c[e].nb++
      c[e].montant += e === 'perdu' ? l.prev : l.cur
    }
    return c
  }, [lignes])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const l = lignes.filter((x) => (!q || x.nom.toLowerCase().includes(q)) && (!famille || x.famille === famille) && (!filtreEtiquette || x.etiquettes.includes(filtreEtiquette)))
    const cle = (x: Ligne) => (tri.col === 'nom' ? x.nom.toLowerCase() : tri.col === 'cur' ? x.cur : tri.col === 'prev' ? x.prev : tri.col === 'part' ? x.part : variation(x.cur, x.prev) ?? -1e9)
    return [...l].sort((a, b) => {
      const va = cle(a), vb = cle(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * (tri.asc ? 1 : -1)
    })
  }, [lignes, recherche, famille, filtreEtiquette, tri])

  const detail = sel != null ? lignes.find((l) => l.nfr === sel) ?? null : null
  const evolution = useMemo(() => {
    if (sel == null) return []
    const m = new Map<string, number>()
    for (const l of base) if (l.nfr === sel) m.set(l.annee, (m.get(l.annee) ?? 0) + l.montant)
    return [...m.keys()].sort().map((a) => ({ annee: a, valeur: Math.round(m.get(a)! * 100) / 100, partielle: partielles.includes(a) }))
  }, [sel, base, partielles])
  const repEntites = useMemo(() => {
    if (sel == null) return []
    const m = new Map<string, number>()
    for (const l of base) if (l.nfr === sel && (!comparer || (l.annee === an && l.mois <= moisMax))) m.set(l.entite ?? 'AUTRES', (m.get(l.entite ?? 'AUTRES') ?? 0) + l.montant)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: entiteLabel(k), valeur: v }))
  }, [sel, base, comparer, an, moisMax])
  // Détail par chantier du fournisseur sélectionné, avec l'entité qui porte la dépense.
  const detailChantiers = useMemo(() => {
    if (sel == null) return []
    const m = new Map<string, { code: string; nom: string | null; montant: number; nb: number; ent: Map<string, number> }>()
    for (const l of base) {
      if (l.nfr !== sel || (comparer && !(l.annee === an && l.mois <= moisMax))) continue
      const code = l.chantier ?? 'NON RENSEIGNE'
      const e = m.get(code) ?? { code, nom: null, montant: 0, nb: 0, ent: new Map() }
      if (l.chantierNom) e.nom = l.chantierNom
      e.montant += l.montant
      e.nb += 1
      const k = l.entite ?? 'AUTRES'
      e.ent.set(k, (e.ent.get(k) ?? 0) + l.montant)
      m.set(code, e)
    }
    return [...m.values()]
      .map((e) => ({ ...e, entites: [...e.ent.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => entiteLabel(k)).join(', ') }))
      .sort((a, b) => b.montant - a.montant)
  }, [sel, base, comparer, an, moisMax])

  function exporter() {
    exportXlsx(`analyse_fournisseurs_${dateFichier()}`, [
      {
        nom: 'Fournisseurs',
        lignes: [
          [`${entite ? entiteLabel(entite) : 'Toutes entités'} · ${libPeriode}${comparer ? ` vs ${libPrev}` : ''} · CHF HT`],
          ['Fournisseur', 'N° fournisseur', "Famille d'achat", 'Entités', 'Nb chantiers', comparer ? libPrev : '', libPeriode, 'Évolution %', 'Part %', 'Étiquettes'],
          ...filtrees.map((l) => [l.nom, l.nfr, l.famille, l.entites.map(entiteLabel).join(', '), l.nbChantiers, comparer ? Math.round(l.prev) : null, Math.round(l.cur), comparer && variation(l.cur, l.prev) != null ? Math.round(variation(l.cur, l.prev)! * 10) / 10 : null, Math.round(l.part * 10) / 10, l.etiquettes.map((e) => ETIQUETTES[e].label).join(' · ')] as (string | number | null)[]),
        ],
      },
    ])
  }

  if (!fournisseurs || !f) return <p className="text-sm text-slate-500">Chargement des fournisseurs…</p>

  const th = (col: typeof tri.col, label: string, droite = true) => (
    <th className={`py-1.5 px-2 ${droite ? 'text-right' : ''} cursor-pointer select-none hover:text-slate-800 whitespace-nowrap`} onClick={() => setTri((t) => ({ col, asc: t.col === col ? !t.asc : false }))}>
      {label}
      {tri.col === col ? (tri.asc ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        <strong>{libPeriode}</strong>
        {comparer ? ` comparé à ${libPrev} (même période)` : ''} — {entite ? entiteLabel(entite) : 'toutes entités'} — montants HT — {fmt(lignes.length)} fournisseurs.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(Object.keys(ETIQUETTES) as Etiquette[])
          .filter((e) => comparer || e === 'queue' || e === 'multi')
          .map((e) => (
            <button
              key={e}
              title={ETIQUETTES[e].aide}
              onClick={() => {
                setFiltreEtiquette(filtreEtiquette === e ? '' : e)
                setNbAffiche(50)
              }}
              className={`card !p-2 text-left border-2 ${filtreEtiquette === e ? 'border-indigo-500' : 'border-transparent'}`}
            >
              <div className={`inline-block text-[10px] font-semibold rounded px-1.5 py-0.5 ${ETIQUETTES[e].classe}`}>{ETIQUETTES[e].label}</div>
              <div className="text-lg font-bold text-slate-800 leading-tight">{fmt(compteurs[e].nb)}</div>
              <div className="text-[11px] text-slate-500">{fmt(compteurs[e].montant)} CHF</div>
            </button>
          ))}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input !w-56" placeholder="Rechercher un fournisseur…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setNbAffiche(50) }} />
          <select className="input !w-auto" value={famille} onChange={(e) => { setFamille(e.target.value); setNbAffiche(50) }}>
            <option value="">Toutes les familles d'achat</option>
            {familles.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          {filtreEtiquette && (
            <button className="text-xs text-indigo-600 hover:underline" onClick={() => setFiltreEtiquette('')}>
              ✕ {ETIQUETTES[filtreEtiquette].label}
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">{fmt(filtrees.length)} fournisseur(s)</span>
          <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
            ⬇ Excel
          </button>
        </div>

        {detail && (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h5 className="font-semibold text-sm">
                {detail.nom} <span className="text-xs font-normal text-slate-500">· {detail.famille} · n° {detail.nfr}</span>
              </h5>
              <div className="flex items-center gap-3">
                {onZoom && (
                  <button className="text-xs text-indigo-600 hover:underline" onClick={() => onZoom(detail.nom)}>
                    🔍 Ouvrir la fiche fournisseur
                  </button>
                )}
                <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setSel(null)}>
                  ✕ Fermer
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">Évolution année après année (HT)</div>
                <EvolutionChart points={evolution} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-1">Par entité ({libPeriode})</div>
                  <BarresH lignes={repEntites} couleur="#7c3aed" />
                </div>
              </div>
            </div>
            {detailChantiers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Détail par chantier ({libPeriode}) — {detailChantiers.length} chantier(s)
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto bg-white rounded border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-1 px-2">Chantier</th>
                        <th className="py-1 px-2">Entité</th>
                        <th className="py-1 px-2 text-right">Montant HT</th>
                        <th className="py-1 px-2 text-right">% du fournisseur</th>
                        <th className="py-1 px-2 text-right">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailChantiers.map((c) => (
                        <tr key={c.code} className="border-b border-slate-100">
                          <td className="py-1 px-2">{chantierLabel(c.code, c.nom)}</td>
                          <td className="py-1 px-2 text-slate-600">{c.entites}</td>
                          <td className="py-1 px-2 text-right tabular-nums font-medium">{Math.round(c.montant).toLocaleString('fr-CH')}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-slate-500">{detail && detail.cur ? Math.round((c.montant / detail.cur) * 1000) / 10 : 0} %</td>
                          <td className="py-1 px-2 text-right tabular-nums text-slate-500">{c.nb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                {th('nom', 'Fournisseur', false)}
                <th className="py-1.5 px-2">Famille d'achat</th>
                <th className="py-1.5 px-2 text-right">Entités</th>
                <th className="py-1.5 px-2 text-right">Chantiers</th>
                {comparer && th('prev', libPrev)}
                {th('cur', libPeriode)}
                {comparer && th('evol', 'Évolution')}
                {th('part', 'Part / cumul')}
                <th className="py-1.5 px-2">Étiquettes</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.slice(0, nbAffiche).map((l) => {
                const v = variation(l.cur, l.prev)
                return (
                  <tr key={l.nfr} className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${sel === l.nfr ? 'bg-indigo-50' : ''}`} onClick={() => setSel(sel === l.nfr ? null : l.nfr)}>
                    <td className="py-1 px-2 font-medium whitespace-nowrap">{l.nom}</td>
                    <td className="py-1 px-2 text-slate-500">{l.famille}</td>
                    <td className="py-1 px-2 text-right tabular-nums" title={l.entites.map(entiteLabel).join(', ')}>
                      {l.entites.length}
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums">{l.nbChantiers || '—'}</td>
                    {comparer && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{fmt(l.prev)}</td>}
                    <td className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(l.cur)}</td>
                    {comparer && (
                      <td className="py-1 px-2 text-right">
                        {v == null ? <span className="text-slate-300">—</span> : <span className={`font-semibold ${v >= 0 ? 'text-orange-600' : 'text-teal-600'}`}>{v >= 0 ? '▲' : '▼'} {fmt1(Math.abs(v))} %</span>}
                      </td>
                    )}
                    <td className="py-1 px-2 text-right tabular-nums text-slate-500">
                      {fmt1(l.part)} % <span className="text-slate-300">/ {fmt1(l.cumul)} %</span>
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex flex-wrap gap-1">
                        {l.etiquettes.map((e) => (
                          <span key={e} title={ETIQUETTES[e].aide} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${ETIQUETTES[e].classe}`}>
                            {ETIQUETTES[e].label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtrees.length > nbAffiche && (
          <button className="text-xs text-indigo-600 hover:underline" onClick={() => setNbAffiche((n) => n + 100)}>
            Afficher 100 de plus ({fmt(filtrees.length - nbAffiche)} restants — l'export Excel les contient tous)
          </button>
        )}
      </div>
    </div>
  )
}
