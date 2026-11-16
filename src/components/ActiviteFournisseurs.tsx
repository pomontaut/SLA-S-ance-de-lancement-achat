import { useMemo, useState } from 'react'
import { variation } from '../data/spend'
import { renouvellementParAnnee } from '../data/renouvellement'
import { usePeriodeSpend } from '../data/usePeriodeSpend'
import { dateFichier, exportXlsx } from '../lib/exportExcel'

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const pc = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

type Cat = 'actifs' | 'nouveaux' | 'perdus' | 'dormants' | 'inutilises'

interface Ligne {
  nfr: number
  nom: string
  famille: string
  montant: number // montant de référence de la catégorie (période, N-1 ou cumul)
  factures: number
  derniere: string // dernière année avec dépense
}

const LIBELLES: Record<Cat, { titre: string; aide: string }> = {
  actifs: { titre: 'Actifs', aide: 'Dépense positive sur la période.' },
  nouveaux: { titre: 'Nouveaux', aide: 'Actifs sur la période, sans aucune dépense avant.' },
  perdus: { titre: 'Sortis du panel', aide: "Dans le panel l'an dernier (dépense sur la même période), plus aucune dépense cette période." },
  dormants: { titre: 'Dormants', aide: "Base fournisseurs : dépense par le passé, rien cette période ni l'an dernier." },
  inutilises: { titre: 'Jamais utilisés', aide: 'Fiche dans la base sans dépense positive sur toutes les années.' },
}

/** Fournisseurs actifs (variation N-1), nouveaux, sortis du panel, dormants et jamais utilisés, avec factures et part de la dépense. */
export default function ActiviteFournisseurs({ onZoom }: { onZoom?: (nom: string) => void }) {
  const P = usePeriodeSpend()
  const { base, toutes, comparer, libPeriode, libPrev, an, dansCur, dansPrev } = P
  const [cat, setCat] = useState<Cat>('actifs')

  const r = useMemo(() => {
    // Par fournisseur : période, N-1, avant la période, factures, dernière année avec dépense (toutes entités du périmètre).
    type A = { nom: string; famille: string; cur: number; prev: number; avant: number; fCur: number; fPrev: number; fTout: number; tout: number; der: string }
    const m = new Map<number, A>()
    const get = (nfr: number, nom: string, famille: string) => {
      let e = m.get(nfr)
      if (!e) m.set(nfr, (e = { nom, famille, cur: 0, prev: 0, avant: 0, fCur: 0, fPrev: 0, fTout: 0, tout: 0, der: '' }))
      return e
    }
    for (const l of base) {
      const e = get(l.nfr, l.nom, l.famille)
      e.tout += l.montant
      if (l.facture) e.fTout++
      if (l.montant > 0 && l.annee > e.der) e.der = l.annee
      if (dansCur(l)) { e.cur += l.montant; if (l.facture) e.fCur++ }
      else if (dansPrev(l)) { e.prev += l.montant; if (l.facture) e.fPrev++ }
      // « avant » = dépense strictement antérieure à la période courante
      if (!comparer ? false : l.annee < an) e.avant += l.montant
    }
    // fiches de la base sans aucune ligne sur le périmètre (entité) : comptées pour « jamais utilisés » uniquement hors filtre entité
    const nfrBase = new Set(base.map((l) => l.nfr))
    for (const l of toutes) if (!nfrBase.has(l.nfr) && !P.entite) get(l.nfr, l.nom, l.famille)
    const totCur = [...m.values()].reduce((t, e) => t + Math.max(0, e.cur), 0)
    const totPrev = [...m.values()].reduce((t, e) => t + Math.max(0, e.prev), 0)
    const totTout = [...m.values()].reduce((t, e) => t + Math.max(0, e.tout), 0)
    const L: Record<Cat, Ligne[]> = { actifs: [], nouveaux: [], perdus: [], dormants: [], inutilises: [] }
    const prevAn = (nfr: number, e: A, montant: number, factures: number): Ligne => ({ nfr, nom: e.nom, famille: e.famille, montant, factures, derniere: e.der })
    for (const [nfr, e] of m) {
      if (e.cur > 0) {
        L.actifs.push(prevAn(nfr, e, e.cur, e.fCur))
        if (comparer && e.avant <= 0 && e.prev <= 0) L.nouveaux.push(prevAn(nfr, e, e.cur, e.fCur))
      } else if (e.prev > 0 || (comparer && e.der === P.an1)) L.perdus.push(prevAn(nfr, e, e.prev, e.fPrev))
      else if (e.tout > 0) L.dormants.push(prevAn(nfr, e, e.tout, e.fTout))
      else L.inutilises.push(prevAn(nfr, e, 0, e.fTout))
    }
    for (const k of Object.keys(L) as Cat[]) L[k].sort((a, b) => b.montant - a.montant)
    const actifsPrev = [...m.values()].filter((e) => e.prev > 0).length
    return { L, totCur, totPrev, totTout, actifsPrev, nbBase: m.size }
  }, [base, toutes, comparer, an, dansCur, dansPrev, P.entite])

  // part que représente chaque catégorie : sur la dépense de la période (actifs/nouveaux), de N-1 (perdus), cumulée (dormants)
  const part = (c: Cat) => {
    const somme = r.L[c].reduce((t, x) => t + x.montant, 0)
    const ref = c === 'actifs' || c === 'nouveaux' ? r.totCur : c === 'perdus' ? r.totPrev : r.totTout
    return ref ? (somme / ref) * 100 : null
  }
  const refLib = (c: Cat) => (c === 'actifs' || c === 'nouveaux' ? libPeriode : c === 'perdus' ? libPrev : 'toutes années')
  const nbFact = (c: Cat) => r.L[c].reduce((t, x) => t + x.factures, 0)
  const renouv = useMemo(
    () => (comparer ? renouvellementParAnnee(base, toutes, P.annees, P.partielles).find((x) => x.annee === an) ?? null : null),
    [comparer, base, toutes, P.annees, P.partielles, an],
  )
  const cats: Cat[] = comparer ? ['actifs', 'nouveaux', 'perdus', 'dormants', 'inutilises'] : ['actifs', 'dormants', 'inutilises']
  const catActive = cats.includes(cat) ? cat : 'actifs'
  const vActifs = comparer ? variation(r.L.actifs.length, r.actifsPrev) : null
  const lignes = r.L[catActive]

  function exporter() {
    exportXlsx(`activite_fournisseurs_${dateFichier()}`, [
      {
        nom: 'Synthèse',
        lignes: [
          [`Activité des fournisseurs — ${libPeriode}`],
          ['Catégorie', 'Fournisseurs', 'Factures', 'Montant HT', 'Part %', 'Référence de la part'],
          ...cats.map((c) => [LIBELLES[c].titre, r.L[c].length, nbFact(c), Math.round(r.L[c].reduce((t, x) => t + x.montant, 0)), part(c) != null ? Math.round(part(c)! * 10) / 10 : null, refLib(c)] as (string | number | null)[]),
        ],
      },
      ...cats.map((c) => ({
        nom: LIBELLES[c].titre,
        lignes: [['Fournisseur', "Famille d'achat", 'Dernière année avec dépense', 'Factures', 'Montant HT'], ...r.L[c].map((x) => [x.nom, x.famille, x.derniere, x.factures, Math.round(x.montant)] as (string | number | null)[])],
      })),
    ])
  }

  if (!P.charge) return null
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="font-semibold">Activité des fournisseurs — {libPeriode}</h3>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exporter}>
          ⬇ Excel
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {r.nbBase} fournisseurs dans la base. Cliquez une catégorie pour voir le détail.{comparer ? ` Comparaison à ${libPrev} (période égale).` : ''}
      </p>
      <div className={`grid grid-cols-2 gap-2 mb-3 ${renouv ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        {cats.map((c) => (
          <button key={c} title={LIBELLES[c].aide} onClick={() => setCat(c)} className={`card !p-3 text-left border-2 ${catActive === c ? 'border-indigo-500' : 'border-transparent'}`}>
            <div className="text-xs text-slate-500">{LIBELLES[c].titre}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-800 tabular-nums">{fmt(r.L[c].length)}</span>
              {c === 'actifs' && vActifs != null && (
                <span className="text-xs font-semibold" style={{ color: vActifs < 0 ? '#b91c1c' : '#15803d' }}>{vActifs > 0 ? '+' : ''}{vActifs.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {fmt(nbFact(c))} facture(s){part(c) != null && c !== 'inutilises' ? ` · ${pc(part(c)!)}` : ''}
            </div>
            {c === 'actifs' && comparer && <div className="text-[11px] text-slate-400">{libPrev} : {fmt(r.actifsPrev)}</div>}
          </button>
        ))}
        {renouv && (
          <div className="card !p-3 border-2 border-transparent" title="(entrants + sortants) ÷ (actifs N-1 + actifs N)">
            <div className="text-xs text-slate-500">Taux de renouvellement</div>
            <div className="text-xl font-bold text-indigo-700 tabular-nums">{renouv.taux != null ? `${renouv.taux.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : '—'}</div>
            <div className="text-[11px] text-slate-500">{fmt(renouv.entrants)} entrants · {fmt(renouv.sortants)} sortants</div>
            <div className="text-[11px] text-slate-400">solde {renouv.entrants - renouv.sortants > 0 ? '+' : ''}{fmt(renouv.entrants - renouv.sortants)}</div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-2">
        <strong>{LIBELLES[catActive].titre}</strong> — {LIBELLES[catActive].aide}
        {catActive !== 'inutilises' ? ` Part : % de la dépense ${refLib(catActive)}.` : ''}
      </p>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <th className="py-1.5 px-2">Fournisseur</th>
              <th className="py-1.5 px-2">Famille d'achat</th>
              <th className="py-1.5 px-2">Dernière dépense</th>
              <th className="py-1.5 px-2 text-right">Factures</th>
              {catActive !== 'inutilises' && <th className="py-1.5 px-2 text-right">Montant HT</th>}
              {catActive !== 'inutilises' && <th className="py-1.5 px-2 text-right">Part</th>}
            </tr>
          </thead>
          <tbody>
            {lignes.slice(0, 300).map((x) => {
              const ref = catActive === 'actifs' || catActive === 'nouveaux' ? r.totCur : catActive === 'perdus' ? r.totPrev : r.totTout
              return (
                <tr key={x.nfr} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1 px-2">
                    {onZoom ? <button className="hover:text-indigo-600 hover:underline text-left" onClick={() => onZoom(x.nom)}>{x.nom}</button> : x.nom}
                  </td>
                  <td className="py-1 px-2 text-slate-500">{x.famille}</td>
                  <td className="py-1 px-2 text-slate-500">{x.derniere || '—'}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">{x.factures}</td>
                  {catActive !== 'inutilises' && <td className="py-1 px-2 text-right tabular-nums font-medium">{fmt(x.montant)}</td>}
                  {catActive !== 'inutilises' && <td className="py-1 px-2 text-right tabular-nums text-slate-500">{ref ? pc((x.montant / ref) * 100) : '—'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {lignes.length === 0 && <p className="text-sm text-slate-500 py-2">Aucun fournisseur dans cette catégorie.</p>}
        {lignes.length > 300 && <p className="text-[11px] text-slate-400 mt-1">300 premiers sur {fmt(lignes.length)} — l'export Excel les contient tous.</p>}
      </div>
    </div>
  )
}
