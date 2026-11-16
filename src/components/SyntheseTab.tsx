import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from '../data/depenses'
import type { LigneSpend } from '../data/spend'
import { MOIS_COURTS, SEUIL_QUEUE_CHF, dernierMois, lignesSpend, sommeParCle, totaux, variation } from '../data/spend'
import { entiteLabel } from '../data/palette'
import { dateFichier, exportXlsx } from '../lib/exportExcel'
import { BarresH, Camembert, CumulChart } from './DepenseCharts'
import { useFiltresSpend } from './FiltresSpend'

// Synthèse : « où en est-on ? » — la dépense de l'année choisie comparée à la même période de l'année précédente
// (cumul à fin septembre 2026 vs cumul à fin septembre 2025), puis d'où elle vient, avec qui, et ce qu'il faut traiter.

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmt1 = (v: number) => v.toLocaleString('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const v = variation(cur, prev)
  if (v == null) return <span className="text-slate-300">—</span>
  const hausse = v >= 0
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${hausse ? 'text-orange-600' : 'text-teal-600'}`}>
      {hausse ? '▲' : '▼'} {fmt1(Math.abs(v))} %
    </span>
  )
}

function Tuile({ label, valeur, prec, delta, sous }: { label: string; valeur: string; prec?: string; delta?: React.ReactNode; sous?: string }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold text-indigo-600 whitespace-nowrap">
        {valeur}
        {delta && <span className="ml-2 align-middle">{delta}</span>}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {prec && <div className="text-[11px] text-slate-400 mt-0.5">{prec}</div>}
      {sous && <div className="text-[11px] text-slate-400">{sous}</div>}
    </div>
  )
}

function Section({ titre, children, aide, onExcel }: { titre: string; children: React.ReactNode; aide?: string; onExcel?: () => void }) {
  return (
    <div className="card overflow-x-auto space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold">{titre}</h4>
        {onExcel && (
          <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={onExcel}>
            ⬇ Excel
          </button>
        )}
      </div>
      {aide && <p className="text-xs text-slate-500">{aide}</p>}
      {children}
    </div>
  )
}

export default function SyntheseTab({ onZoom }: { onZoom?: (nom: string) => void }) {
  const f = useFiltresSpend()
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])

  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])

  const toutes = useMemo(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const entite = f?.entite ?? ''
  const base = useMemo(() => (entite ? toutes.filter((l) => l.entite === entite) : toutes), [toutes, entite])
  const annees = useMemo(() => [...new Set(toutes.map((l) => l.annee))].sort(), [toutes])
  const an = f && f.annee !== 'toutes' ? f.annee : annees[annees.length - 1] ?? ''
  const toutesAnnees = f?.annee === 'toutes'
  const an1 = String(Number(an) - 1)
  const an2 = String(Number(an) - 2)
  const partielle = partielles.includes(an)
  // Cumul comparable : si l'année est partielle, toutes les années sont coupées au même mois.
  const moisMax = partielle ? dernierMois(toutes, an) : 11
  const sel = (a: string) => base.filter((l) => l.annee === a && l.mois <= moisMax)

  const cur = useMemo(() => sel(an), [base, an, moisMax]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => sel(an1), [base, an1, moisMax]) // eslint-disable-line react-hooks/exhaustive-deps
  const tCur = useMemo(() => totaux(cur), [cur])
  const tPrev = useMemo(() => totaux(prev), [prev])
  const libPeriode = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an}` : an
  const libPrev = partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an1}` : an1

  // Cumul mensuel
  const cumul = useMemo(() => {
    const serie = (a: string, limite: number) => {
      const par = Array(12).fill(0)
      for (const l of base) if (l.annee === a) par[l.mois] += l.montant
      let c = 0
      return par.map((v, i) => (i <= limite ? (c += v) : null))
    }
    return [
      { label: `${an}${partielle ? ' (en cours)' : ''}`, valeurs: serie(an, moisMax), couleur: '#4f46e5' },
      { label: an1, valeurs: serie(an1, 11), couleur: '#f59e0b' },
      { label: an2, valeurs: serie(an2, 11), couleur: '#94a3b8' },
    ].filter((s) => s.valeurs.some((v) => v != null && v !== 0))
  }, [base, an, an1, an2, moisMax, partielle])

  const tableau = (cle: (l: LigneSpend) => string | null) => {
    const a = sommeParCle(cur, cle)
    const b = sommeParCle(prev, cle)
    return [...new Set([...a.keys(), ...b.keys()])]
      .map((k) => ({ k, cur: a.get(k) ?? 0, prev: b.get(k) ?? 0 }))
      .sort((x, y) => y.cur - x.cur)
  }
  const parFamille = useMemo(() => tableau((l) => l.famille), [cur, prev]) // eslint-disable-line react-hooks/exhaustive-deps
  const parEntite = useMemo(() => tableau((l) => l.entite ?? 'AUTRES'), [cur, prev]) // eslint-disable-line react-hooks/exhaustive-deps

  // Top 10 fournisseurs + mouvements
  const fourn = useMemo(() => {
    const a = new Map<number, { nom: string; cur: number; prev: number }>()
    for (const l of cur) {
      const e = a.get(l.nfr) ?? { nom: l.nom, cur: 0, prev: 0 }
      e.cur += l.montant
      a.set(l.nfr, e)
    }
    for (const l of prev) {
      const e = a.get(l.nfr) ?? { nom: l.nom, cur: 0, prev: 0 }
      e.prev += l.montant
      a.set(l.nfr, e)
    }
    // « nouveau » = aucune dépense avant la période étudiée
    const avant = new Set<number>()
    for (const l of base) if (l.annee < an && l.montant !== 0) avant.add(l.nfr)
    const lignes = [...a.entries()].map(([nfr, v]) => ({ nfr, ...v, nouveau: v.cur > 0 && !avant.has(nfr) && v.prev <= 0 }))
    return lignes
  }, [cur, prev, base, an])
  const top10 = useMemo(() => [...fourn].sort((x, y) => y.cur - x.cur).slice(0, 10), [fourn])
  const nouveaux = useMemo(() => fourn.filter((x) => x.nouveau), [fourn])
  const perdus = useMemo(() => fourn.filter((x) => x.prev > 0 && x.cur <= 0), [fourn])
  const hausses = useMemo(() => fourn.filter((x) => x.cur > 0 && x.prev > 0).map((x) => ({ ...x, ecart: x.cur - x.prev })).sort((x, y) => y.ecart - x.ecart).slice(0, 8), [fourn])
  const baisses = useMemo(() => fourn.filter((x) => x.cur > 0 && x.prev > 0).map((x) => ({ ...x, ecart: x.cur - x.prev })).sort((x, y) => x.ecart - y.ecart).slice(0, 8), [fourn])

  // Qualité des données à traiter
  const qualite = useMemo(() => {
    const t = tCur.total || 1
    const nonClasse = cur.filter((l) => l.famille === 'Non classé').reduce((s, l) => s + l.montant, 0)
    const sansChantier = cur.filter((l) => !l.chantier).reduce((s, l) => s + l.montant, 0)
    const entiteAutre = cur.filter((l) => !l.entite || l.entite === 'AUTRES').reduce((s, l) => s + l.montant, 0)
    return [
      { label: 'Dépense « Non classé » (famille d\'achat inconnue)', v: nonClasse, pct: (nonClasse / t) * 100 },
      { label: 'Dépense sans chantier', v: sansChantier, pct: (sansChantier / t) * 100 },
      { label: 'Dépense sans entité identifiée (Autres)', v: entiteAutre, pct: (entiteAutre / t) * 100 },
    ]
  }, [cur, tCur])

  if (!fournisseurs || !f) return <p className="text-sm text-slate-500">Chargement de la synthèse…</p>
  if (toutesAnnees) {
    return (
      <div className="card text-sm text-slate-600">
        La synthèse compare une année à la précédente : choisissez une année dans la barre du haut (la dernière est sélectionnée par défaut).
        <button className="ml-2 text-indigo-600 hover:underline" onClick={() => f.setAnnee(f.anneeEnCours)}>
          Revenir à {f.anneeEnCours}
        </button>
      </div>
    )
  }

  const contexte = `${entite ? entiteLabel(entite) : 'Toutes entités'} · ${libPeriode} vs ${libPrev}`
  const exportTout = () =>
    exportXlsx(`synthese_depense_${dateFichier()}`, [
      { nom: 'Indicateurs', lignes: [[contexte], ['Indicateur', libPeriode, libPrev], ['Dépense HT', Math.round(tCur.total), Math.round(tPrev.total)], ['Fournisseurs actifs', tCur.nbFournisseurs, tPrev.nbFournisseurs], ['Factures', tCur.nbFactures, tPrev.nbFactures], ['Facture moyenne HT', Math.round(tCur.factureMoyenne ?? 0), Math.round(tPrev.factureMoyenne ?? 0)], ['Part du top 10 %', tCur.top10Pct != null ? Math.round(tCur.top10Pct * 10) / 10 : null, tPrev.top10Pct != null ? Math.round(tPrev.top10Pct * 10) / 10 : null], ['Fournisseurs pour 80 % de la dépense', tCur.n80, tPrev.n80], [`Fournisseurs < ${SEUIL_QUEUE_CHF} CHF`, tCur.queueNb, tPrev.queueNb]] },
      { nom: 'Familles', lignes: [[contexte], ["Famille d'achat", `${libPeriode} CHF HT`, `${libPrev} CHF HT`], ...parFamille.map((r) => [r.k, Math.round(r.cur), Math.round(r.prev)] as (string | number)[])] },
      { nom: 'Top 10 fournisseurs', lignes: [[contexte], ['Fournisseur', `${libPeriode} CHF HT`, `${libPrev} CHF HT`], ...top10.map((r) => [r.nom, Math.round(r.cur), Math.round(r.prev)] as (string | number)[])] },
    ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-slate-500">
          <strong>{libPeriode}</strong> comparé à <strong>{libPrev}</strong> (même période) — {entite ? entiteLabel(entite) : 'toutes entités'} — montants HT.
        </p>
        <button className="px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={exportTout}>
          ⬇ Excel (synthèse)
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tuile label="Dépense HT" valeur={`${fmt(tCur.total)}`} delta={<Delta cur={tCur.total} prev={tPrev.total} />} prec={`${libPrev} : ${fmt(tPrev.total)} CHF`} />
        <Tuile label="Fournisseurs actifs" valeur={fmt(tCur.nbFournisseurs)} delta={<Delta cur={tCur.nbFournisseurs} prev={tPrev.nbFournisseurs} />} prec={`${libPrev} : ${fmt(tPrev.nbFournisseurs)}`} />
        <Tuile label="Factures" valeur={fmt(tCur.nbFactures)} delta={<Delta cur={tCur.nbFactures} prev={tPrev.nbFactures} />} prec={`facture moyenne ${fmt(tCur.factureMoyenne ?? 0)} CHF (${libPrev} : ${fmt(tPrev.factureMoyenne ?? 0)})`} />
        <Tuile label="Part des 10 plus gros fournisseurs" valeur={tCur.top10Pct != null ? `${fmt1(tCur.top10Pct)} %` : '—'} prec={tPrev.top10Pct != null ? `${libPrev} : ${fmt1(tPrev.top10Pct)} %` : undefined} sous={`${tCur.n80} fournisseurs font 80 % de la dépense`} />
      </div>

      <Section titre="Où en est-on ? Dépense cumulée mois par mois" aide="Cumul de la dépense HT depuis janvier. L'année en cours (trait plein) est comparée aux années précédentes au même mois.">
        {cumul.length ? <CumulChart mois={MOIS_COURTS} series={cumul} /> : <p className="text-sm text-slate-500">Aucune donnée.</p>}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section titre="D'où vient la dépense ? Par famille d'achat">
          <Camembert lignes={parFamille.map((r) => ({ label: r.k, valeur: r.cur }))} />
          <table className="text-xs w-full">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1 px-1">Famille</th>
                <th className="py-1 px-1 text-right">{libPeriode}</th>
                <th className="py-1 px-1 text-right">Évolution</th>
              </tr>
            </thead>
            <tbody>
              {parFamille.slice(0, 10).map((r) => (
                <tr key={r.k} className="border-b border-slate-100">
                  <td className="py-1 px-1">{r.k}</td>
                  <td className="py-1 px-1 text-right tabular-nums">{fmt(r.cur)}</td>
                  <td className="py-1 px-1 text-right">
                    <Delta cur={r.cur} prev={r.prev} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        {!entite ? (
          <Section titre="Par entité">
            <Camembert lignes={parEntite.map((r) => ({ label: entiteLabel(r.k), valeur: r.cur }))} />
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-1">Entité</th>
                  <th className="py-1 px-1 text-right">{libPeriode}</th>
                  <th className="py-1 px-1 text-right">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {parEntite.map((r) => (
                  <tr key={r.k} className="border-b border-slate-100">
                    <td className="py-1 px-1">{entiteLabel(r.k)}</td>
                    <td className="py-1 px-1 text-right tabular-nums">{fmt(r.cur)}</td>
                    <td className="py-1 px-1 text-right">
                      <Delta cur={r.cur} prev={r.prev} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : (
          <Section titre="Par famille d'achat — répartition">
            <BarresH lignes={parFamille.slice(0, 10).map((r) => ({ label: r.k, valeur: r.cur, pct: tCur.total > 0 ? (r.cur / tCur.total) * 100 : null }))} />
          </Section>
        )}
      </div>

      <Section titre="Avec qui ? Les 10 plus gros fournisseurs" aide={`Ils représentent ${tCur.top10Pct != null ? fmt1(tCur.top10Pct) : '—'} % de la dépense. Cliquez un nom pour ouvrir sa fiche.`}>
        <table className="text-xs w-full">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-1 px-1">#</th>
              <th className="py-1 px-1">Fournisseur</th>
              <th className="py-1 px-1 text-right">{libPeriode}</th>
              <th className="py-1 px-1 text-right">Part</th>
              <th className="py-1 px-1 text-right">{libPrev}</th>
              <th className="py-1 px-1 text-right">Évolution</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((r, i) => (
              <tr key={r.nfr} className="border-b border-slate-100">
                <td className="py-1 px-1 text-slate-400">{i + 1}</td>
                <td className="py-1 px-1 font-medium">
                  {onZoom ? (
                    <button className="hover:underline text-left" onClick={() => onZoom(r.nom)}>
                      {r.nom}
                    </button>
                  ) : (
                    r.nom
                  )}
                </td>
                <td className="py-1 px-1 text-right tabular-nums">{fmt(r.cur)}</td>
                <td className="py-1 px-1 text-right tabular-nums">{tCur.total > 0 ? fmt1((r.cur / tCur.total) * 100) : '—'} %</td>
                <td className="py-1 px-1 text-right tabular-nums text-slate-500">{fmt(r.prev)}</td>
                <td className="py-1 px-1 text-right">
                  <Delta cur={r.cur} prev={r.prev} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section titre="Plus fortes hausses vs même période" aide="Fournisseurs actifs sur les deux périodes, classés par écart en CHF HT.">
          <BarresH lignes={hausses.map((r) => ({ label: r.nom, valeur: r.ecart }))} couleur="#ea580c" />
        </Section>
        <Section titre="Plus fortes baisses vs même période">
          <BarresH lignes={baisses.map((r) => ({ label: r.nom, valeur: Math.abs(r.ecart) }))} couleur="#0d9488" />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Tuile label="Nouveaux fournisseurs" valeur={fmt(nouveaux.length)} sous={`${fmt(nouveaux.reduce((t, x) => t + x.cur, 0))} CHF HT — jamais utilisés avant ${an}`} />
        <Tuile label={`Fournisseurs perdus (dépense en ${libPrev}, aucune en ${libPeriode})`} valeur={fmt(perdus.length)} sous={`${fmt(perdus.reduce((t, x) => t + x.prev, 0))} CHF HT l'an dernier`} />
        <Tuile label={`Fournisseurs de « queue » (moins de ${fmt(SEUIL_QUEUE_CHF)} CHF)`} valeur={fmt(tCur.queueNb)} sous={tCur.queuePct != null ? `${fmt1(tCur.queuePct)} % de la dépense — à regrouper ou à rationaliser` : undefined} />
      </div>

      <Section titre="Données à fiabiliser" aide="Part de la dépense de la période qui n'est pas pleinement qualifiée : plus ces lignes sont basses, plus les analyses sont fiables.">
        <BarresH lignes={qualite.map((q) => ({ label: q.label, valeur: q.v, pct: q.pct }))} couleur="#94a3b8" />
      </Section>
    </div>
  )
}
