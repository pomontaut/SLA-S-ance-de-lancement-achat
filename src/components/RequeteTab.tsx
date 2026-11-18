import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { MOIS_COURTS, dernierMois, lignesSpend } from '../data/spend'
import type { LigneSpend } from '../data/spend'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'

// Requête : extraction sur mesure de la dépense HT (même source et mêmes règles que les autres onglets).
// Filtres multiples (fournisseurs, années, entités, familles, chantiers), tableau croisé (lignes × colonnes) et export Excel.
// Ne dépend PAS du périmètre commun de la barre du haut : tous les critères sont ici.

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')

type Dim = 'fournisseur' | 'annee' | 'entite' | 'famille' | 'chantier'
const DIMS: { key: Dim; label: string }[] = [
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'annee', label: 'Année' },
  { key: 'entite', label: 'Entité' },
  { key: 'famille', label: 'Famille' },
  { key: 'chantier', label: 'Chantier' },
]

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function chantierCle(l: LigneSpend): string {
  const code = l.chantier || 'NON RENSEIGNE'
  return code === 'NON RENSEIGNE' ? 'Non renseigné' : l.chantierNom ? `${code} - ${l.chantierNom}` : code
}

function valeurDim(l: LigneSpend, d: Dim): string {
  switch (d) {
    case 'fournisseur':
      return l.nom
    case 'annee':
      return l.annee
    case 'entite':
      return l.entite ? entiteLabel(l.entite) : 'Non renseignée'
    case 'famille':
      return l.famille
    case 'chantier':
      return chantierCle(l)
  }
}

interface Croise {
  colList: string[]
  rowList: [string, { cells: Map<string, number>; total: number; nbFactures: number; nfr: number | null }][]
  parCol: Map<string, number>
  total: number
  nbFactures: number
}

const SEP = '\u0001' // sépare les deux critères d'une ligne combinée (ex. fournisseur + entité)

/** Tableau croisé : lignes × colonnes (colDim vide = une seule colonne « Total »).
 * rowDim2 (facultatif) = 2e critère combiné au 1er dans les lignes (une ligne par couple). */
function croiser(lignes: LigneSpend[], rowDim: Dim, colDim: Dim | '', rowDim2: Dim | '' = ''): Croise {
  const cols = new Set<string>()
  const rows = new Map<string, { cells: Map<string, number>; total: number; nbFactures: number; nfr: number | null }>()
  const parCol = new Map<string, number>()
  let total = 0
  let nbFactures = 0
  for (const l of lignes) {
    const r = rowDim2 ? `${valeurDim(l, rowDim)}${SEP}${valeurDim(l, rowDim2)}` : valeurDim(l, rowDim)
    const c = colDim ? valeurDim(l, colDim) : 'Total'
    cols.add(c)
    let row = rows.get(r)
    if (!row) rows.set(r, (row = { cells: new Map(), total: 0, nbFactures: 0, nfr: rowDim === 'fournisseur' ? l.nfr : null }))
    row.cells.set(c, (row.cells.get(c) ?? 0) + l.montant)
    row.total += l.montant
    if (l.facture) { row.nbFactures++; nbFactures++ }
    parCol.set(c, (parCol.get(c) ?? 0) + l.montant)
    total += l.montant
  }
  const colList = [...cols].sort((a, b) => (colDim === 'annee' ? a.localeCompare(b) : (parCol.get(b) ?? 0) - (parCol.get(a) ?? 0)))
  const parPremier = new Map<string, number>()
  if (rowDim2) for (const [k, v] of rows) { const p1 = k.split(SEP)[0]; parPremier.set(p1, (parPremier.get(p1) ?? 0) + v.total) }
  const rowList = [...rows.entries()].sort((a, b) => {
    if (rowDim2) {
      const [a1] = a[0].split(SEP), [b1] = b[0].split(SEP)
      if (a1 !== b1) return rowDim === 'annee' ? a1.localeCompare(b1) : (parPremier.get(b1) ?? 0) - (parPremier.get(a1) ?? 0)
      return b[1].total - a[1].total
    }
    return rowDim === 'annee' ? a[0].localeCompare(b[0]) : b[1].total - a[1].total
  })
  return { colList, rowList, parCol, total, nbFactures }
}

interface Option {
  value: string
  label: string
  total: number
}

/** Choix multiple avec recherche : puces des éléments retenus + liste de suggestions. */
function MultiPicker({ titre, options, valeurs, onChange, placeholder }: { titre: string; options: Option[]; valeurs: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [q, setQ] = useState('')
  const retenus = new Set(valeurs)
  const mots = normaliser(q).split(/\s+/).filter(Boolean)
  const suggestions = useMemo(
    () => (mots.length ? options.filter((o) => !retenus.has(o.value) && mots.every((m) => normaliser(o.label).includes(m))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, options, valeurs],
  )
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase text-slate-500 w-24 shrink-0">{titre}</span>
        <input className="input !py-1 flex-1" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
        {suggestions.length > 1 && (
          <button className="btn-secondary !py-1 text-xs whitespace-nowrap" onClick={() => { onChange([...valeurs, ...suggestions.map((s) => s.value)]); setQ('') }}>
            Tout ajouter ({suggestions.length})
          </button>
        )}
        {valeurs.length > 0 && (
          <button className="text-xs text-slate-500 underline whitespace-nowrap" onClick={() => onChange([])}>
            Tout retirer
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="ml-24 border border-slate-200 rounded-lg bg-white max-h-52 overflow-auto text-sm shadow-sm">
          {suggestions.slice(0, 40).map((o) => (
            <button key={o.value} className="w-full text-left px-3 py-1 hover:bg-indigo-50 flex justify-between gap-3" onClick={() => { onChange([...valeurs, o.value]); setQ('') }}>
              <span className="truncate">{o.label}</span>
              <span className="text-slate-400 tabular-nums">{fmt(o.total)}</span>
            </button>
          ))}
          {suggestions.length > 40 && <div className="px-3 py-1 text-xs text-slate-400">… {suggestions.length - 40} autres : précisez la recherche ou « Tout ajouter ».</div>}
        </div>
      )}
      {valeurs.length > 0 && (
        <div className="ml-24 flex flex-wrap gap-1.5">
          {valeurs.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-600 text-white">
              {label(v)}
              <button aria-label="Retirer" className="opacity-80 hover:opacity-100" onClick={() => onChange(valeurs.filter((x) => x !== v))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Choix multiple par puces (listes courtes : années, entités, familles). */
function Puces({ titre, options, valeurs, onChange, aide }: { titre: string; options: { value: string; label: string }[]; valeurs: string[]; onChange: (v: string[]) => void; aide?: string }) {
  const actif = new Set(valeurs)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs uppercase text-slate-500 w-24 shrink-0">{titre}</span>
      {options.map((o) => (
        <button
          key={o.value}
          className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
          style={actif.has(o.value) ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' } : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }}
          onClick={() => onChange(actif.has(o.value) ? valeurs.filter((v) => v !== o.value) : [...valeurs, o.value])}
        >
          {o.label}
        </button>
      ))}
      <span className="text-[11px] text-slate-400 ml-1">{valeurs.length === 0 ? (aide ?? 'toutes') : `${valeurs.length} sélectionné(s)`}</span>
    </div>
  )
}

export default function RequeteTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  const [selFourn, setSelFourn] = useState<string[]>([]) // n° fournisseur (texte)
  const [selAnnees, setSelAnnees] = useState<string[]>([])
  const [selEntites, setSelEntites] = useState<string[]>([])
  const [selFamilles, setSelFamilles] = useState<string[]>([])
  const [selChantiers, setSelChantiers] = useState<string[]>([])
  const [lignesDim, setLignesDim] = useState<Dim>('fournisseur')
  const [lignesDim2, setLignesDim2] = useState<Dim | ''>('') // 2e critère combiné dans les lignes (facultatif)
  const [colsDim, setColsDim] = useState<Dim | ''>('annee')
  const [periodeEgale, setPeriodeEgale] = useState(false)
  const [nbAffiche, setNbAffiche] = useState(200)

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs).catch((e) => setErreur((e as Error).message))
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const toutes = useMemo(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const annees = useMemo(() => [...new Set(toutes.map((l) => l.annee))].sort(), [toutes])

  // Listes d'options (avec le montant total pour guider le choix).
  const optFourn = useMemo<Option[]>(() => {
    const m = new Map<number, Option>()
    for (const l of toutes) {
      const o = m.get(l.nfr) ?? { value: String(l.nfr), label: `${l.nom} (n° ${l.nfr})`, total: 0 }
      o.total += l.montant
      m.set(l.nfr, o)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [toutes])
  const optChantier = useMemo<Option[]>(() => {
    const m = new Map<string, Option>()
    for (const l of toutes) {
      const k = chantierCle(l)
      const o = m.get(k) ?? { value: k, label: k, total: 0 }
      o.total += l.montant
      m.set(k, o)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [toutes])
  const entites = useMemo(() => [...new Set(toutes.map((l) => l.entite).filter((e): e is string => !!e))].sort(), [toutes])
  const familles = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of toutes) m.set(l.famille, (m.get(l.famille) ?? 0) + l.montant)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [toutes])

  // Dernier mois de l'année partielle : borne du cumul comparable.
  const anneePartielle = annees.find((a) => partielles.includes(a))
  const moisMax = anneePartielle ? dernierMois(toutes, anneePartielle) : 11

  const filtrees = useMemo(() => {
    const f = new Set(selFourn.map(Number))
    const a = new Set(selAnnees)
    const e = new Set(selEntites)
    const fa = new Set(selFamilles)
    const c = new Set(selChantiers)
    return toutes.filter(
      (l) =>
        (!f.size || f.has(l.nfr)) &&
        (!a.size || a.has(l.annee)) &&
        (!e.size || (l.entite != null && e.has(l.entite))) &&
        (!fa.size || fa.has(l.famille)) &&
        (!c.size || c.has(chantierCle(l))) &&
        (!periodeEgale || l.mois <= moisMax),
    )
  }, [toutes, selFourn, selAnnees, selEntites, selFamilles, selChantiers, periodeEgale, moisMax])

  const filtreActif = selFourn.length + selAnnees.length + selEntites.length + selFamilles.length + selChantiers.length > 0

  const pivot = useMemo(() => croiser(filtrees, lignesDim, colsDim, lignesDim2), [filtrees, lignesDim, colsDim, lignesDim2])

  // Dès que 2 valeurs ou plus sont retenues sur un critère (ex. BAT GE + BAT VD), le détail par valeur est affiché
  // automatiquement, année par année (sauf si ce critère est déjà celui des lignes du tableau principal).
  const details = useMemo(() => {
    const multi: { dim: Dim; n: number }[] = [
      { dim: 'fournisseur', n: selFourn.length },
      { dim: 'entite', n: selEntites.length },
      { dim: 'famille', n: selFamilles.length },
      { dim: 'chantier', n: selChantiers.length },
    ]
    return multi.filter((m) => m.n >= 2 && m.dim !== lignesDim && m.dim !== lignesDim2).map((m) => ({ dim: m.dim, croise: croiser(filtrees, m.dim, 'annee') }))
  }, [filtrees, selFourn, selEntites, selFamilles, selChantiers, lignesDim, lignesDim2])

  const enteteCol = (c: string) => (colsDim === 'annee' && partielles.includes(c) ? `${c} (janv.–${MOIS_COURTS[periodeEgale ? moisMax : dernierMois(toutes, c)]})` : c)

  function reinitialiser() {
    setSelFourn([]); setSelAnnees([]); setSelEntites([]); setSelFamilles([]); setSelChantiers([])
  }

  /** Description lisible des critères : 1re feuille de l'Excel (traçabilité de l'extraction). */
  function criteres(): (string | number | null)[][] {
    const lib = (opts: Option[], v: string[]) => v.map((x) => opts.find((o) => o.value === x)?.label ?? x).join(' ; ') || 'Tous'
    return [
      ['Critère', 'Valeur'],
      ['Extraction du', dateFichier()],
      ['Montants', 'HT (charges d\'achat du plan comptable, journal COFI)'],
      ['Fournisseurs', lib(optFourn, selFourn)],
      ['Années', selAnnees.length ? [...selAnnees].sort().join(', ') : 'Toutes'],
      ['Entités', selEntites.length ? selEntites.map(entiteLabel).join(', ') : 'Toutes'],
      ['Familles', selFamilles.length ? selFamilles.join(' ; ') : 'Toutes'],
      ['Chantiers', selChantiers.length ? selChantiers.join(' ; ') : 'Tous'],
      ['Période égale', periodeEgale ? `Oui : janv.–${MOIS_COURTS[moisMax]} pour chaque année` : 'Non'],
      ['Années partielles', partielles.length ? partielles.map((a) => `${a} (jusqu'à ${MOIS_COURTS[dernierMois(toutes, a)]})`).join(', ') : 'Aucune'],
      ['Total HT', Math.round(pivot.total * 100) / 100],
      ['Nb factures', pivot.nbFactures],
    ]
  }

  function exporter() {
    const libDim = (d: Dim) => DIMS.find((x) => x.key === d)!.label
    const entete = [libDim(lignesDim), ...(lignesDim2 ? [libDim(lignesDim2)] : []), ...pivot.colList.map(enteteCol), ...(colsDim ? ['Total'] : []), 'Nb factures']
    const lignes: (string | number | null)[][] = [entete]
    for (const [r, row] of pivot.rowList) {
      lignes.push([...r.split(SEP), ...pivot.colList.map((c) => Math.round((row.cells.get(c) ?? 0) * 100) / 100), ...(colsDim ? [Math.round(row.total * 100) / 100] : []), row.nbFactures])
    }
    lignes.push(['TOTAL', ...(lignesDim2 ? [''] : []), ...pivot.colList.map((c) => Math.round((pivot.parCol.get(c) ?? 0) * 100) / 100), ...(colsDim ? [Math.round(pivot.total * 100) / 100] : []), pivot.nbFactures])
    const detail: (string | number | null)[][] = [['N° fournisseur', 'Fournisseur', 'Année', 'Mois', 'Entité', 'Famille', 'N° chantier', 'Chantier', 'Montant HT']]
    for (const l of filtrees) detail.push([l.nfr, l.nom, l.annee, l.mois + 1, l.entite ? entiteLabel(l.entite) : '', l.famille, l.chantier ?? '', l.chantierNom ?? '', Math.round(l.montant * 100) / 100])
    const feuillesDetail = details.map((d) => {
      const c = d.croise
      const l: (string | number | null)[][] = [[DIMS.find((x) => x.key === d.dim)!.label, ...c.colList.map(enteteCol), 'Total', 'Nb factures']]
      for (const [r, row] of c.rowList) l.push([r, ...c.colList.map((k) => Math.round((row.cells.get(k) ?? 0) * 100) / 100), Math.round(row.total * 100) / 100, row.nbFactures])
      l.push(['TOTAL', ...c.colList.map((k) => Math.round((c.parCol.get(k) ?? 0) * 100) / 100), Math.round(c.total * 100) / 100, c.nbFactures])
      return { nom: `Par ${DIMS.find((x) => x.key === d.dim)!.label}`, lignes: l }
    })
    exportXlsx(`requete_depense_${dateFichier()}`, [
      { nom: 'Critères', lignes: criteres() },
      { nom: 'Résultat', lignes },
      ...feuillesDetail,
      { nom: 'Détail', lignes: detail },
    ])
  }

  if (erreur) return <div className="card border-red-300 bg-red-50 text-sm text-red-700">Erreur : {erreur}</div>
  if (!fournisseurs) return <p className="text-sm text-slate-500">Chargement des dépenses…</p>

  const nbCols = pivot.colList.length
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Critères de l'extraction</h3>
          {filtreActif && (
            <button className="text-xs text-slate-500 underline" onClick={reinitialiser}>
              Réinitialiser les critères
            </button>
          )}
        </div>
        <MultiPicker titre="Fournisseurs" options={optFourn} valeurs={selFourn} onChange={setSelFourn} placeholder="Tapez un nom ou un n° (ex. getaz, hg commerciale, jerome…) puis cliquez" />
        <Puces titre="Années" options={annees.map((a) => ({ value: a, label: a + (partielles.includes(a) ? ' (partielle)' : '') }))} valeurs={selAnnees} onChange={setSelAnnees} />
        <Puces titre="Entités" options={entites.map((e) => ({ value: e, label: entiteLabel(e) }))} valeurs={selEntites} onChange={setSelEntites} />
        <Puces titre="Familles" options={familles.map((x) => ({ value: x, label: x }))} valeurs={selFamilles} onChange={setSelFamilles} />
        <MultiPicker titre="Chantiers" options={optChantier} valeurs={selChantiers} onChange={setSelChantiers} placeholder="Tapez un n° ou un nom de chantier puis cliquez" />
        {anneePartielle && (
          <label className="flex items-center gap-2 text-sm text-slate-600 ml-24">
            <input type="checkbox" checked={periodeEgale} onChange={(e) => setPeriodeEgale(e.target.checked)} />
            Comparer à période égale : limiter chaque année à janv.–{MOIS_COURTS[moisMax]} (comme {anneePartielle}, année partielle)
          </label>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500">Lignes</span>
            <select className="input !w-40 !py-1" value={lignesDim} onChange={(e) => { const v = e.target.value as Dim; setLignesDim(v); if (v === lignesDim2) setLignesDim2(''); if (v === colsDim) setColsDim('') }}>
              {DIMS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500">puis</span>
            <select className="input !w-40 !py-1" value={lignesDim2} onChange={(e) => { const v = e.target.value as Dim | ''; setLignesDim2(v); if (v && v === colsDim) setColsDim('') }}>
              <option value="">— (1 critère)</option>
              {DIMS.filter((d) => d.key !== lignesDim).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500">Colonnes</span>
            <select className="input !w-40 !py-1" value={colsDim} onChange={(e) => setColsDim(e.target.value as Dim | '')}>
              <option value="">Total seul</option>
              {DIMS.filter((d) => d.key !== lignesDim && d.key !== lignesDim2).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-slate-600">
              <b className="tabular-nums">{fmt(pivot.total)}</b> CHF HT · {pivot.rowList.length} ligne(s) · {fmt(pivot.nbFactures)} factures
            </span>
            <button className="btn-primary !py-1" disabled={!filtrees.length} onClick={exporter}>
              ⬇ Excel
            </button>
          </div>
        </div>

        {!filtrees.length ? (
          <p className="text-sm text-slate-500">Aucune dépense ne correspond à ces critères.</p>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-3">{DIMS.find((d) => d.key === lignesDim)!.label}</th>
                  {lignesDim2 && <th className="py-1.5 pr-3">{DIMS.find((d) => d.key === lignesDim2)!.label}</th>}
                  {pivot.colList.map((c) => <th key={c} className="py-1.5 px-2 text-right whitespace-nowrap">{enteteCol(c)}</th>)}
                  {colsDim && nbCols > 0 && <th className="py-1.5 pl-2 text-right">Total</th>}
                  <th className="py-1.5 pl-3 text-right">Factures</th>
                </tr>
              </thead>
              <tbody>
                {pivot.rowList.slice(0, nbAffiche).map(([r, row]) => (
                  <tr key={r} className="border-b border-slate-100">
                    <td className="py-1 pr-3">
                      {onZoom && lignesDim === 'fournisseur' ? (
                        <button className="text-indigo-700 hover:underline text-left" onClick={() => onZoom(r.split(SEP)[0])}>{r.split(SEP)[0]}</button>
                      ) : r.split(SEP)[0]}
                    </td>
                    {lignesDim2 && <td className="py-1 pr-3">{r.split(SEP)[1]}</td>}
                    {pivot.colList.map((c) => <td key={c} className="py-1 px-2 text-right tabular-nums">{row.cells.has(c) ? fmt(row.cells.get(c)!) : '–'}</td>)}
                    {colsDim && <td className="py-1 pl-2 text-right tabular-nums font-medium">{fmt(row.total)}</td>}
                    <td className="py-1 pl-3 text-right tabular-nums text-slate-500">{fmt(row.nbFactures)}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t-2 border-slate-300">
                  <td className="py-1.5 pr-3">Total</td>
                  {lignesDim2 && <td />}
                  {pivot.colList.map((c) => <td key={c} className="py-1.5 px-2 text-right tabular-nums">{fmt(pivot.parCol.get(c) ?? 0)}</td>)}
                  {colsDim && <td className="py-1.5 pl-2 text-right tabular-nums">{fmt(pivot.total)}</td>}
                  <td className="py-1.5 pl-3 text-right tabular-nums">{fmt(pivot.nbFactures)}</td>
                </tr>
              </tbody>
            </table>
            {pivot.rowList.length > nbAffiche && (
              <button className="btn-secondary mt-2 text-xs" onClick={() => setNbAffiche(nbAffiche + 300)}>
                Afficher plus ({pivot.rowList.length - nbAffiche} lignes masquées — l'Excel contient tout)
              </button>
            )}
          </div>
        )}
        {details.map((d) => (
          <div key={d.dim} className="border-t border-slate-200 pt-3">
            <h4 className="text-sm font-semibold mb-2">
              Détail par {DIMS.find((x) => x.key === d.dim)!.label.toLowerCase()} <span className="font-normal text-slate-400">· année par année</span>
            </h4>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-1.5 pr-3">{DIMS.find((x) => x.key === d.dim)!.label}</th>
                    {d.croise.colList.map((c) => <th key={c} className="py-1.5 px-2 text-right whitespace-nowrap">{enteteCol(c)}</th>)}
                    <th className="py-1.5 pl-2 text-right">Total</th>
                    <th className="py-1.5 pl-3 text-right">Part</th>
                    <th className="py-1.5 pl-3 text-right">Factures</th>
                  </tr>
                </thead>
                <tbody>
                  {d.croise.rowList.map(([r, row]) => (
                    <tr key={r} className="border-b border-slate-100">
                      <td className="py-1 pr-3">{r}</td>
                      {d.croise.colList.map((c) => <td key={c} className="py-1 px-2 text-right tabular-nums">{row.cells.has(c) ? fmt(row.cells.get(c)!) : '–'}</td>)}
                      <td className="py-1 pl-2 text-right tabular-nums font-medium">{fmt(row.total)}</td>
                      <td className="py-1 pl-3 text-right tabular-nums text-slate-500">{d.croise.total ? `${((row.total / d.croise.total) * 100).toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : '—'}</td>
                      <td className="py-1 pl-3 text-right tabular-nums text-slate-500">{fmt(row.nbFactures)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold border-t-2 border-slate-300">
                    <td className="py-1.5 pr-3">Total</td>
                    {d.croise.colList.map((c) => <td key={c} className="py-1.5 px-2 text-right tabular-nums">{fmt(d.croise.parCol.get(c) ?? 0)}</td>)}
                    <td className="py-1.5 pl-2 text-right tabular-nums">{fmt(d.croise.total)}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">100 %</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{fmt(d.croise.nbFactures)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-slate-400">
          Montants HT, notes de crédit déduites, année = année comptable (Date COFI). Fournisseurs à plusieurs numéros fusionnés (HGC, SINEF, Romande Energie) ; les autres homonymes (ex. plusieurs agences Getaz) ont un n° chacun : sélectionnez-les tous (« Tout ajouter »).
        </p>
      </div>
    </div>
  )
}
