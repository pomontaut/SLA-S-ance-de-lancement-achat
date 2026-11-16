import { useEffect, useMemo, useState } from 'react'
import type { DepenseDocument, DepenseFournisseur } from '../data/depenses'
import { anneeComptable, formatCurrency, loadDepensesFournisseurs } from '../data/depenses'

// Onglet « Chantiers » : dépense (montant pos., charges d'achat — voir CLAUDE.md) par chantier, par
// mois et par année ; et par fournisseur, par année et par trimestre. Même base d'année que
// l'analyse de dépense (date COFI) ; le mois est lu sur la même date.

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

interface Ligne {
  doc: DepenseDocument
  fournisseur: string
  nfr: number
  annee: string
  mois: number // 0-11
  montant: number
}

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const round2 = (v: number) => Math.round(v * 100) / 100

function Cell({ v, max }: { v: number | undefined; max: number }) {
  if (v === undefined || Math.abs(v) < 0.5) return <td className="py-1 px-2 text-right text-slate-300">—</td>
  const alpha = max > 0 ? Math.min(0.35, (Math.abs(v) / max) * 0.35) : 0
  return (
    <td className="py-1 px-2 text-right tabular-nums" style={{ backgroundColor: `rgba(79,70,229,${alpha})` }}>
      {fmt(v)}
    </td>
  )
}

export default function ChantiersTab() {
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [entite, setEntite] = useState('')
  const [recherche, setRecherche] = useState('')
  const [chantier, setChantier] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [annee, setAnnee] = useState('')
  const [vueFourn, setVueFourn] = useState<'annee' | 'trimestre'>('annee')

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
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
        out.push({ doc: d, fournisseur: f.nom, nfr: f.nfr, annee: an, mois: m >= 0 && m < 12 ? m : 0, montant: d.montant ?? 0 })
      }
    }
    return out
  }, [fournisseurs])

  // Chantiers présents dans les données (code, nom, entité majoritaire, total).
  const chantiers = useMemo(() => {
    const m = new Map<string, { code: string; nom: string | null; entites: Map<string, number>; total: number; nb: number }>()
    for (const l of lignes) {
      const c = l.doc.chantier
      if (!c) continue
      let e = m.get(c)
      if (!e) m.set(c, (e = { code: c, nom: null, entites: new Map(), total: 0, nb: 0 }))
      if (l.doc.chantierNom) e.nom = l.doc.chantierNom
      if (l.doc.entite) e.entites.set(l.doc.entite, (e.entites.get(l.doc.entite) ?? 0) + 1)
      e.total += l.montant
      e.nb++
    }
    return [...m.values()]
      .map((e) => ({
        code: e.code,
        nom: e.nom,
        total: e.total,
        nb: e.nb,
        entite: [...e.entites.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sans entité',
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [lignes])

  const entites = useMemo(() => [...new Set(chantiers.map((c) => c.entite))].sort(), [chantiers])
  const label = (c: { code: string; nom: string | null }) => (c.nom ? `${c.code} - ${c.nom}` : `${c.code} (nom à renseigner)`)

  const chantiersListe = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return chantiers.filter((c) => (!entite || c.entite === entite) && (!q || label(c).toLowerCase().includes(q)))
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
          (!entite || chantier || l.doc.entite === entite) &&
          (!annee || l.annee === annee),
      ),
    [lignes, chantier, fournisseur, entite, annee],
  )

  const annees = useMemo(() => [...new Set(lignes.map((l) => l.annee))].filter((a) => /^\d{4}$/.test(a)).sort(), [lignes])
  const total = round2(retenues.reduce((s, l) => s + l.montant, 0))

  // Par année et par mois (année × 12 mois).
  const matriceMois = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const l of retenues) {
      if (!m.has(l.annee)) m.set(l.annee, Array(12).fill(0))
      m.get(l.annee)![l.mois] += l.montant
    }
    return [...m.entries()].filter(([a]) => /^\d{4}$/.test(a)).sort((a, b) => a[0].localeCompare(b[0]))
  }, [retenues])
  const maxMois = Math.max(0, ...matriceMois.flatMap(([, v]) => v.map(Math.abs)))

  // Par fournisseur : par année ou par trimestre.
  const colonnes = useMemo(() => {
    const ans = [...new Set(retenues.map((l) => l.annee))].filter((a) => /^\d{4}$/.test(a)).sort()
    return vueFourn === 'annee' ? ans.map((a) => ({ cle: a, titre: a })) : ans.flatMap((a) => [0, 1, 2, 3].map((q) => ({ cle: `${a}-T${q + 1}`, titre: `${a} T${q + 1}` })))
  }, [retenues, vueFourn])

  const lignesFourn = useMemo(() => {
    const m = new Map<string, { nom: string; total: number; cols: Record<string, number> }>()
    for (const l of retenues) {
      if (!/^\d{4}$/.test(l.annee)) continue
      let e = m.get(l.fournisseur)
      if (!e) m.set(l.fournisseur, (e = { nom: l.fournisseur, total: 0, cols: {} }))
      const cle = vueFourn === 'annee' ? l.annee : `${l.annee}-T${Math.floor(l.mois / 3) + 1}`
      e.cols[cle] = (e.cols[cle] ?? 0) + l.montant
      e.total += l.montant
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [retenues, vueFourn])
  const maxFourn = Math.max(0, ...lignesFourn.flatMap((e) => Object.values(e.cols).map(Math.abs)))

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
                  {e}
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
                    {label(c)} — {fmt(c.total)} CHF
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
              {chantierChoisi ? label(chantierChoisi) : entite || 'Tous les chantiers'}
              {fournisseur ? ` · ${fournisseur}` : ''}
              {annee ? ` · ${annee}` : ''} — {retenues.length} document(s)
            </div>
          </div>
          {(chantier || fournisseur || entite || annee) && (
            <button className="text-xs text-indigo-600 hover:underline" onClick={() => { setChantier(''); setFournisseur(''); setEntite(''); setAnnee(''); setRecherche('') }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h4 className="font-semibold mb-2">Par mois et par année (CHF)</h4>
        {matriceMois.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune dépense pour cette sélection.</p>
        ) : (
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
                  <td className="py-1 px-2 font-medium">{a}</td>
                  {v.map((x, i) => (
                    <Cell key={i} v={x} max={maxMois} />
                  ))}
                  <td className="py-1 px-2 text-right font-semibold tabular-nums">{fmt(v.reduce((s, x) => s + x, 0))}</td>
                </tr>
              ))}
              {matriceMois.length > 1 && (
                <tr className="font-semibold">
                  <td className="py-1 px-2">Total</td>
                  {MOIS.map((_, i) => (
                    <td key={i} className="py-1 px-2 text-right tabular-nums">
                      {fmt(matriceMois.reduce((s, [, v]) => s + v[i], 0))}
                    </td>
                  ))}
                  <td className="py-1 px-2 text-right tabular-nums">{fmt(matriceMois.reduce((s, [, v]) => s + v.reduce((a, b) => a + b, 0), 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-slate-400 mt-2">
          Année et mois = date de comptabilisation (COFI). L'année en cours est partielle (données jusqu'à fin septembre 2026).
        </p>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h4 className="font-semibold">Par fournisseur (CHF)</h4>
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
        </div>
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
              {lignesFourn.slice(0, 200).map((e) => (
                <tr key={e.nom} className="border-b border-slate-100">
                  <td className="py-1 px-2 font-medium whitespace-nowrap">{e.nom}</td>
                  {colonnes.map((c) => (
                    <Cell key={c.cle} v={e.cols[c.cle]} max={maxFourn} />
                  ))}
                  <td className="py-1 px-2 text-right font-semibold tabular-nums">{fmt(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lignesFourn.length > 200 && <p className="text-[11px] text-slate-400 mt-2">200 premiers fournisseurs sur {lignesFourn.length}, par montant.</p>}
      </div>
    </div>
  )
}
