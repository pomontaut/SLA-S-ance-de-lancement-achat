import { useEffect, useMemo, useState } from 'react'
import type { DepenseDocument, DepenseFournisseur } from '../data/depenses'
import { anneeComptable, formatCurrency, loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { Anneau, BarresH, MoisChart, ParetoChart } from './DepenseCharts'

// Onglet « Chantiers » : dépense (montant pos., charges d'achat — voir CLAUDE.md) par chantier, par
// mois et par année ; par fournisseur (année, trimestre, % de l'année) ; Pareto, Top 20, typologie
// de fournisseurs et dépense par chantier. Année = date COFI ; chaque tableau s'exporte en Excel.

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const ORDRE_ENTITES = ['GC', 'BAT GE', 'BAT GE TRANSFO RENO', 'BAT VD', 'BAT VD TRANSFO RENO', 'EG GE', 'EG VD', 'EG VS', 'DG', 'DEPOT', 'AUTRES']

interface Ligne {
  doc: DepenseDocument
  fournisseur: string
  nfr: number
  famille: string
  annee: string
  mois: number // 0-11
  montant: number
}

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const round2 = (v: number) => Math.round(v * 100) / 100
const pctDe = (v: number, total: number): number | null => (total > 0 ? Math.round((v / total) * 1000) / 10 : null)
const fmtPct = (p: number | null) => (p == null ? '' : `${p.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`)

function BoutonExcel({ onClick }: { onClick: () => void }) {
  return (
    <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={onClick}>
      ⬇ Excel
    </button>
  )
}

function Cell({ v, max, pct }: { v: number | undefined; max: number; pct?: number | null }) {
  if (v === undefined || Math.abs(v) < 0.5) return <td className="py-1 px-2 text-right text-slate-300">—</td>
  const alpha = max > 0 ? Math.min(0.35, (Math.abs(v) / max) * 0.35) : 0
  return (
    <td className="py-1 px-2 text-right tabular-nums" style={{ backgroundColor: `rgba(79,70,229,${alpha})` }}>
      {fmt(v)}
      {pct != null && <div className="text-[10px] text-slate-500">{fmtPct(pct)}</div>}
    </td>
  )
}

function Section({ titre, onExcel, children, aide }: { titre: string; onExcel?: () => void; children: React.ReactNode; aide?: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold">{titre}</h4>
        <div className="flex items-center gap-2">
          {aide}
          {onExcel && <BoutonExcel onClick={onExcel} />}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ChantiersTab() {
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  const [entite, setEntite] = useState('')
  const [recherche, setRecherche] = useState('')
  const [chantier, setChantier] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [annee, setAnnee] = useState('')
  const [vueFourn, setVueFourn] = useState<'annee' | 'trimestre'>('annee')
  const [tousFourn, setTousFourn] = useState(false)
  const [anneeChantier, setAnneeChantier] = useState<string | null>(null) // null = année en cours (la plus récente)

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const lignes = useMemo<Ligne[]>(() => {
    if (!fournisseurs) return []
    const out: Ligne[] = []
    for (const f of fournisseurs) {
      for (const d of f.documents) {
        const an = anneeComptable(d)
        const date = d.dateCofi || d.dateDoc
        if (!an || !date) continue
        const m = Number(date.slice(5, 7)) - 1
        out.push({ doc: d, fournisseur: f.nom, nfr: f.nfr, famille: f.familleAchat || 'Non classé', annee: an, mois: m >= 0 && m < 12 ? m : 0, montant: d.montant ?? 0 })
      }
    }
    return out
  }, [fournisseurs])

  // Chantiers présents dans les données (code, nom, entité majoritaire, total).
  const chantiers = useMemo(() => {
    const m = new Map<string, { code: string; nom: string | null; entites: Map<string, number>; total: number }>()
    for (const l of lignes) {
      const c = l.doc.chantier
      if (!c) continue
      let e = m.get(c)
      if (!e) m.set(c, (e = { code: c, nom: null, entites: new Map(), total: 0 }))
      if (l.doc.chantierNom) e.nom = l.doc.chantierNom
      if (l.doc.entite) e.entites.set(l.doc.entite, (e.entites.get(l.doc.entite) ?? 0) + 1)
      e.total += l.montant
    }
    return [...m.values()]
      .map((e) => ({
        code: e.code,
        nom: e.nom,
        total: e.total,
        entite: [...e.entites.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sans entité',
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [lignes])

  // Entités proposées : toutes celles des documents (dont Direction Générale et Dépôt), même sans chantier.
  const entites = useMemo(() => {
    const set = new Set<string>([...chantiers.map((c) => c.entite), ...lignes.map((l) => l.doc.entite ?? '')])
    set.delete('')
    set.delete('Sans entité')
    return [...set].sort((a, b) => {
      const ia = ORDRE_ENTITES.indexOf(a), ib = ORDRE_ENTITES.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
    })
  }, [chantiers, lignes])

  const labelChantier = (c: { code: string; nom: string | null }) => (c.nom ? `${c.code} - ${c.nom}` : `${c.code} (nom à renseigner)`)
  const nomChantierDe = useMemo(() => new Map(chantiers.map((c) => [c.code, labelChantier(c)])), [chantiers])

  const chantiersListe = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return chantiers.filter((c) => (!entite || c.entite === entite) && (!q || labelChantier(c).toLowerCase().includes(q)))
  }, [chantiers, entite, recherche])

  const nomsFournisseurs = useMemo(
    () => (fournisseurs ? [...new Set(fournisseurs.filter((f) => f.documents.length).map((f) => f.nom))].sort((a, b) => a.localeCompare(b)) : []),
    [fournisseurs],
  )

  // Lignes retenues par les filtres.
  const retenues = useMemo(
    () =>
      lignes.filter(
        (l) =>
          (!chantier || l.doc.chantier === chantier) &&
          (!fournisseur || l.fournisseur === fournisseur) &&
          (!entite || l.doc.entite === entite || (chantier !== '' && l.doc.chantier === chantier)) &&
          (!annee || l.annee === annee),
      ),
    [lignes, chantier, fournisseur, entite, annee],
  )

  const annees = useMemo(() => [...new Set(lignes.map((l) => l.annee))].filter((a) => /^\d{4}$/.test(a)).sort(), [lignes])
  const anneeEnCours = annees[annees.length - 1] ?? ''
  const total = round2(retenues.reduce((s, l) => s + l.montant, 0))
  const contexte = [chantier ? nomChantierDe.get(chantier) ?? chantier : '', entite && !chantier ? entiteLabel(entite) : '', fournisseur, annee].filter(Boolean).join(' · ') || 'Toutes dépenses'

  // ---- Par mois et par année -------------------------------------------------------------------
  const matriceMois = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const l of retenues) {
      if (!/^\d{4}$/.test(l.annee)) continue
      if (!m.has(l.annee)) m.set(l.annee, Array(12).fill(0))
      m.get(l.annee)![l.mois] += l.montant
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [retenues])
  const maxMois = Math.max(0, ...matriceMois.flatMap(([, v]) => v.map(Math.abs)))
  // % de la dépense par mois : uniquement sur les années pleines (l'année en cours, partielle, est exclue).
  const anneesPleines = matriceMois.filter(([a]) => !partielles.includes(a))
  const totalPleines = anneesPleines.reduce((s, [, v]) => s + v.reduce((a, b) => a + b, 0), 0)
  const pctMois = MOIS.map((_, i) => pctDe(anneesPleines.reduce((s, [, v]) => s + v[i], 0), totalPleines))
  const libPleines = anneesPleines.length ? `${anneesPleines[0][0]}${anneesPleines.length > 1 ? `–${anneesPleines[anneesPleines.length - 1][0]}` : ''}` : ''

  function exportMois() {
    const lignesX: (string | number | null)[][] = [['Année', ...MOIS, 'Total']]
    for (const [a, v] of matriceMois) lignesX.push([partielles.includes(a) ? `${a} (partielle)` : a, ...v.map(round2), round2(v.reduce((s, x) => s + x, 0))])
    if (matriceMois.length > 1) lignesX.push(['Total', ...MOIS.map((_, i) => round2(matriceMois.reduce((s, [, v]) => s + v[i], 0))), round2(matriceMois.reduce((s, [, v]) => s + v.reduce((a, b) => a + b, 0), 0))])
    if (anneesPleines.length) lignesX.push([`% par mois (années pleines ${libPleines})`, ...pctMois.map((p) => p ?? null), anneesPleines.length ? 100 : null])
    exportXlsx(`depense_par_mois_${dateFichier()}`, [{ nom: 'Par mois', lignes: [[contexte], ...lignesX] }])
  }

  // ---- Par fournisseur : année ou trimestre, avec % de la colonne ----------------------------------
  const colonnes = useMemo(() => {
    const ans = [...new Set(retenues.map((l) => l.annee))].filter((a) => /^\d{4}$/.test(a)).sort()
    return vueFourn === 'annee' ? ans.map((a) => ({ cle: a, titre: a })) : ans.flatMap((a) => [0, 1, 2, 3].map((q) => ({ cle: `${a}-T${q + 1}`, titre: `${a} T${q + 1}` })))
  }, [retenues, vueFourn])

  const { lignesFourn, totauxCol } = useMemo(() => {
    const m = new Map<string, { nom: string; total: number; cols: Record<string, number> }>()
    const tc: Record<string, number> = {}
    for (const l of retenues) {
      if (!/^\d{4}$/.test(l.annee)) continue
      let e = m.get(l.fournisseur)
      if (!e) m.set(l.fournisseur, (e = { nom: l.fournisseur, total: 0, cols: {} }))
      const cle = vueFourn === 'annee' ? l.annee : `${l.annee}-T${Math.floor(l.mois / 3) + 1}`
      e.cols[cle] = (e.cols[cle] ?? 0) + l.montant
      e.total += l.montant
      tc[cle] = (tc[cle] ?? 0) + l.montant
    }
    return { lignesFourn: [...m.values()].sort((a, b) => b.total - a.total), totauxCol: tc }
  }, [retenues, vueFourn])
  const maxFourn = Math.max(0, ...lignesFourn.flatMap((e) => Object.values(e.cols).map(Math.abs)))
  const totalFourn = lignesFourn.reduce((s, e) => s + e.total, 0)

  function exportFourn() {
    const entete: (string | number | null)[] = ['Fournisseur']
    for (const c of colonnes) entete.push(c.titre, `${c.titre} %`)
    entete.push('Total', 'Total %')
    const lignesX: (string | number | null)[][] = [entete]
    for (const e of lignesFourn) {
      const l: (string | number | null)[] = [e.nom]
      for (const c of colonnes) l.push(e.cols[c.cle] != null ? round2(e.cols[c.cle]) : null, e.cols[c.cle] != null ? pctDe(e.cols[c.cle], totauxCol[c.cle] ?? 0) : null)
      l.push(round2(e.total), pctDe(e.total, totalFourn))
      lignesX.push(l)
    }
    const tl: (string | number | null)[] = ['Total']
    for (const c of colonnes) tl.push(round2(totauxCol[c.cle] ?? 0), 100)
    tl.push(round2(totalFourn), 100)
    lignesX.push(tl)
    exportXlsx(`depense_par_fournisseur_${vueFourn}_${dateFichier()}`, [{ nom: `Par fournisseur (${vueFourn})`, lignes: [[contexte], ...lignesX] }])
  }

  // ---- Pareto / Top 20 -----------------------------------------------------------------------------
  const fournPositifs = useMemo(() => lignesFourn.filter((e) => e.total > 0), [lignesFourn])
  const totalPositif = fournPositifs.reduce((s, e) => s + e.total, 0)

  function exportPareto() {
    let cum = 0
    const lignesX: (string | number | null)[][] = [['Rang', 'Fournisseur', 'Montant CHF', '% de la dépense', '% cumulé', 'Classe (A ≤ 80 %, B ≤ 95 %, C)']]
    fournPositifs.forEach((e, i) => {
      cum += e.total
      const pc = (cum / totalPositif) * 100
      const avant = ((cum - e.total) / totalPositif) * 100
      lignesX.push([i + 1, e.nom, round2(e.total), pctDe(e.total, totalPositif), Math.round(pc * 10) / 10, avant < 80 ? 'A' : avant < 95 ? 'B' : 'C'])
    })
    exportXlsx(`pareto_fournisseurs_${dateFichier()}`, [{ nom: 'Pareto', lignes: [[contexte], ...lignesX] }])
  }

  const top20 = fournPositifs.slice(0, 20)
  function exportTop20() {
    let cum = 0
    const lignesX: (string | number | null)[][] = [['Rang', 'Fournisseur', 'Montant CHF', '% de la dépense', '% cumulé']]
    top20.forEach((e, i) => {
      cum += e.total
      lignesX.push([i + 1, e.nom, round2(e.total), pctDe(e.total, totalPositif), pctDe(cum, totalPositif)])
    })
    exportXlsx(`top20_fournisseurs_${dateFichier()}`, [{ nom: 'Top 20', lignes: [[contexte], ...lignesX] }])
  }

  // ---- Typologie de fournisseurs ---------------------------------------------------------------------
  const typologie = useMemo(() => {
    const m = new Map<string, { famille: string; total: number; fournisseurs: Set<string>; nb: number }>()
    for (const l of retenues) {
      let e = m.get(l.famille)
      if (!e) m.set(l.famille, (e = { famille: l.famille, total: 0, fournisseurs: new Set(), nb: 0 }))
      e.total += l.montant
      e.fournisseurs.add(l.fournisseur)
      e.nb++
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [retenues])
  const totalTypo = typologie.reduce((s, e) => s + Math.max(0, e.total), 0)

  function exportTypologie() {
    exportXlsx(`typologie_fournisseurs_${dateFichier()}`, [
      {
        nom: 'Typologie',
        lignes: [[contexte], ['Typologie (famille d\'achat)', 'Montant CHF', '% de la dépense', 'Fournisseurs', 'Documents'], ...typologie.map((e) => [e.famille, round2(e.total), pctDe(e.total, totalTypo), e.fournisseurs.size, e.nb] as (string | number | null)[])],
      },
    ])
  }

  // ---- Par chantier dans l'année en cours (année modifiable) -----------------------------------------
  const anneeSection = anneeChantier ?? anneeEnCours
  const parChantier = useMemo(() => {
    const m = new Map<string, { code: string; label: string; total: number; nb: number }>()
    for (const l of lignes) {
      if (anneeSection && anneeSection !== 'toutes' && l.annee !== anneeSection) continue
      if (fournisseur && l.fournisseur !== fournisseur) continue
      if (entite && l.doc.entite !== entite) continue
      const code = l.doc.chantier ?? '—'
      let e = m.get(code)
      if (!e) m.set(code, (e = { code, label: code === '—' ? '(sans chantier)' : nomChantierDe.get(code) ?? code, total: 0, nb: 0 }))
      e.total += l.montant
      e.nb++
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [lignes, anneeSection, fournisseur, entite, nomChantierDe])
  const totalChantiers = parChantier.reduce((s, e) => s + Math.max(0, e.total), 0)

  function exportChantiers() {
    exportXlsx(`depense_par_chantier_${anneeSection}_${dateFichier()}`, [
      {
        nom: `Chantiers ${anneeSection}`,
        lignes: [[`${contexte} — chantiers ${anneeSection}`], ['Chantier', 'Montant CHF', '% de la dépense', 'Documents'], ...parChantier.map((e) => [e.label, round2(e.total), pctDe(e.total, totalChantiers), e.nb] as (string | number | null)[])],
      },
    ])
  }

  const chantierChoisi = chantiers.find((c) => c.code === chantier)

  if (!fournisseurs) return <p className="text-sm text-slate-500">Chargement des données de dépense…</p>

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">🏗 Dépense par chantier et par fournisseur</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Entité</label>
            <select className="input" value={entite} onChange={(e) => { setEntite(e.target.value); setChantier('') }}>
              <option value="">Toutes</option>
              {entites.map((e) => (
                <option key={e} value={e}>
                  {entiteLabel(e)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="label">Chantier ({chantiersListe.length})</label>
            <div className="flex gap-2">
              <input className="input !w-32" placeholder="Filtrer…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              <select className="input" value={chantier} onChange={(e) => setChantier(e.target.value)}>
                <option value="">Tous les chantiers</option>
                {chantiersListe.map((c) => (
                  <option key={c.code} value={c.code}>
                    {labelChantier(c)} — {fmt(c.total)} CHF
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Année</label>
            <select className="input" value={annee} onChange={(e) => setAnnee(e.target.value)}>
              <option value="">Toutes</option>
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                  {partielles.includes(a) ? ' (partielle)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Fournisseur</label>
          <input className="input" list="chantiers-tab-fournisseurs" placeholder="Tous (tapez pour chercher un fournisseur)" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
          <datalist id="chantiers-tab-fournisseurs">
            {nomsFournisseurs.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-wrap gap-6 items-baseline pt-1">
          <div>
            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(total)}</div>
            <div className="text-xs text-slate-500">
              {chantierChoisi ? labelChantier(chantierChoisi) : entite ? entiteLabel(entite) : 'Tous les chantiers'}
              {fournisseur ? ` · ${fournisseur}` : ''}
              {annee ? ` · ${annee}` : ''} — {fmt(retenues.length)} document(s)
            </div>
          </div>
          {(chantier || fournisseur || entite || annee) && (
            <button className="text-xs text-indigo-600 hover:underline" onClick={() => { setChantier(''); setFournisseur(''); setEntite(''); setAnnee(''); setRecherche('') }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      <Section titre="Par mois et par année (CHF)" onExcel={matriceMois.length ? exportMois : undefined}>
        {matriceMois.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
          <>
            <MoisChart mois={MOIS} series={matriceMois.map(([a, v]) => ({ label: partielles.includes(a) ? `${a} (partielle)` : a, valeurs: v }))} />
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-2">Année</th>
                  {MOIS.map((m) => (
                    <th key={m} className="py-1 px-2 text-right">
                      {m}
                    </th>
                  ))}
                  <th className="py-1 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {matriceMois.map(([a, v]) => (
                  <tr key={a} className="border-b border-slate-100">
                    <td className="py-1 px-2 font-medium whitespace-nowrap">
                      {a}
                      {partielles.includes(a) && <span className="text-[10px] text-slate-400"> (partielle)</span>}
                    </td>
                    {v.map((x, i) => (
                      <Cell key={i} v={x} max={maxMois} />
                    ))}
                    <td className="py-1 px-2 text-right font-semibold tabular-nums">{fmt(v.reduce((s, x) => s + x, 0))}</td>
                  </tr>
                ))}
                {matriceMois.length > 1 && (
                  <tr className="font-semibold border-b border-slate-100">
                    <td className="py-1 px-2">Total</td>
                    {MOIS.map((_, i) => (
                      <td key={i} className="py-1 px-2 text-right tabular-nums">
                        {fmt(matriceMois.reduce((s, [, v]) => s + v[i], 0))}
                      </td>
                    ))}
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(matriceMois.reduce((s, [, v]) => s + v.reduce((a, b) => a + b, 0), 0))}</td>
                  </tr>
                )}
                {anneesPleines.length > 0 && (
                  <tr className="font-semibold bg-indigo-50">
                    <td className="py-1 px-2 whitespace-nowrap">% par mois</td>
                    {pctMois.map((p, i) => (
                      <td key={i} className="py-1 px-2 text-right tabular-nums text-indigo-700">
                        {fmtPct(p) || '—'}
                      </td>
                    ))}
                    <td className="py-1 px-2 text-right tabular-nums text-indigo-700">100 %</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400">
              Année et mois = date de comptabilisation (COFI). « % par mois » : part de chaque mois dans la dépense des années pleines
              {libPleines ? ` (${libPleines})` : ''} uniquement — l'année en cours, partielle, n'est pas comptée.
            </p>
          </>
        )}
      </Section>

      <Section
        titre="Par fournisseur (CHF et % de la période)"
        onExcel={lignesFourn.length ? exportFourn : undefined}
        aide={
          <div className="flex gap-1">
            {(['annee', 'trimestre'] as const).map((v) => (
              <button
                key={v}
                className="px-2 py-0.5 rounded-full text-xs font-medium border"
                style={vueFourn === v ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' } : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }}
                onClick={() => setVueFourn(v)}
              >
                {v === 'annee' ? 'Par année' : 'Par trimestre'}
              </button>
            ))}
          </div>
        }
      >
        {lignesFourn.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
          <table className="text-xs w-full">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1 px-2">Fournisseur</th>
                {colonnes.map((c) => (
                  <th key={c.cle} className="py-1 px-2 text-right whitespace-nowrap">
                    {c.titre}
                  </th>
                ))}
                <th className="py-1 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold bg-slate-50 border-b border-slate-200">
                <td className="py-1 px-2">Total</td>
                {colonnes.map((c) => (
                  <td key={c.cle} className="py-1 px-2 text-right tabular-nums">
                    {totauxCol[c.cle] != null ? fmt(totauxCol[c.cle]) : '—'}
                  </td>
                ))}
                <td className="py-1 px-2 text-right tabular-nums">{fmt(totalFourn)}</td>
              </tr>
              {lignesFourn.slice(0, tousFourn ? 200 : 25).map((e) => (
                <tr key={e.nom} className="border-b border-slate-100">
                  <td className="py-1 px-2 font-medium whitespace-nowrap">{e.nom}</td>
                  {colonnes.map((c) => (
                    <Cell key={c.cle} v={e.cols[c.cle]} max={maxFourn} pct={e.cols[c.cle] != null ? pctDe(e.cols[c.cle], totauxCol[c.cle] ?? 0) : null} />
                  ))}
                  <td className="py-1 px-2 text-right font-semibold tabular-nums">
                    {fmt(e.total)}
                    <div className="text-[10px] font-normal text-slate-500">{fmtPct(pctDe(e.total, totalFourn))}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lignesFourn.length > 25 && (
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <button className="text-indigo-600 hover:underline text-xs" onClick={() => setTousFourn((v) => !v)}>
              {tousFourn ? 'Réduire à 25 fournisseurs' : `Voir les ${Math.min(200, lignesFourn.length)} premiers fournisseurs`}
            </button>
            <span>{fmt(lignesFourn.length)} fournisseurs au total — l'export Excel les contient tous.</span>
          </div>
        )}
        <p className="text-[11px] text-slate-400">% = part du fournisseur dans la dépense totale de la même {vueFourn === 'annee' ? 'année' : 'période (trimestre)'}.</p>
      </Section>

      <Section titre="Pareto des fournisseurs" onExcel={fournPositifs.length ? exportPareto : undefined}>
        <ParetoChart valeurs={fournPositifs.map((e) => e.total)} />
      </Section>

      <Section titre="Top 20 fournisseurs" onExcel={top20.length ? exportTop20 : undefined}>
        {top20.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
          <BarresH lignes={top20.map((e) => ({ label: e.nom, valeur: e.total, pct: pctDe(e.total, totalPositif) }))} />
        )}
      </Section>

      <Section titre="Par typologie de fournisseurs" onExcel={typologie.length ? exportTypologie : undefined}>
        {typologie.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
          <>
            <Anneau tranches={typologie.map((e) => ({ label: e.famille, valeur: e.total }))} />
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-2">Typologie (famille d'achat)</th>
                  <th className="py-1 px-2 text-right">Montant (CHF)</th>
                  <th className="py-1 px-2 text-right">%</th>
                  <th className="py-1 px-2 text-right">Fournisseurs</th>
                </tr>
              </thead>
              <tbody>
                {typologie.map((e) => (
                  <tr key={e.famille} className="border-b border-slate-100">
                    <td className="py-1 px-2 font-medium">{e.famille}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(e.total)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmtPct(pctDe(e.total, totalTypo))}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{fmt(e.fournisseurs.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400">« Non classé » = fournisseur jamais évalué (famille d'achat inconnue).</p>
          </>
        )}
      </Section>

      <Section
        titre={`Par chantier — ${anneeSection === 'toutes' ? 'toutes années' : anneeSection}${partielles.includes(anneeSection) ? ' (année en cours, partielle)' : ''}`}
        onExcel={parChantier.length ? exportChantiers : undefined}
        aide={
          <select className="input !w-auto !py-0.5 text-xs" value={anneeSection} onChange={(e) => setAnneeChantier(e.target.value)}>
            <option value="toutes">Toutes années</option>
            {[...annees].reverse().map((a) => (
              <option key={a} value={a}>
                {a}
                {a === anneeEnCours ? ' (en cours)' : ''}
              </option>
            ))}
          </select>
        }
      >
        {parChantier.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
          <>
            <BarresH lignes={parChantier.slice(0, 20).map((e) => ({ label: e.label, valeur: e.total, pct: pctDe(e.total, totalChantiers) }))} couleur="#0d9488" />
            <p className="text-[11px] text-slate-400">
              20 premiers chantiers sur {parChantier.length} (l'export Excel les contient tous). Filtres entité et fournisseur appliqués ; le filtre « Chantier » ne s'applique pas ici.
            </p>
          </>
        )}
      </Section>
    </div>
  )
}
