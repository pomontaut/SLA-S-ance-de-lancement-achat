import { useMemo, useState } from 'react'
import type { EvalRecord, SecteurStat } from '../data/evaluationsHistorique'
import { SECTEURS, compareSecteurs, findSecteurStat } from '../data/evaluationsHistorique'

function fmtCurrency(v: number | null): string {
  return v == null ? 'Non disponible' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function fmtPct(v: number | null): string {
  return v == null ? 'Non disponible' : `${v}%`
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 pr-3 text-slate-600">{label}</td>
      <td className="py-1.5 pr-3 font-medium">{a}</td>
      <td className="py-1.5 font-medium">{b}</td>
    </tr>
  )
}

export default function SecteurComparison({ all, secteurStats, annee }: { all: EvalRecord[]; secteurStats: SecteurStat[]; annee: number }) {
  const [secteurA, setSecteurA] = useState('GC')
  const [secteurB, setSecteurB] = useState('BAT GE')

  const cmp = useMemo(() => compareSecteurs(all, secteurA, secteurB, annee), [all, secteurA, secteurB, annee])
  const statA = findSecteurStat(secteurStats, secteurA, annee)
  const statB = findSecteurStat(secteurStats, secteurB, annee)

  const panelTotalA = all.filter((r) => r.secteur === secteurA).length
    ? new Set(all.filter((r) => r.secteur === secteurA).map((r) => r.nom)).size
    : 0
  const panelTotalB = new Set(all.filter((r) => r.secteur === secteurB).map((r) => r.nom)).size

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-40" value={secteurA} onChange={(e) => setSecteurA(e.target.value)}>
          {SECTEURS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-slate-400">vs</span>
        <select className="input w-40" value={secteurB} onChange={(e) => setSecteurB(e.target.value)}>
          {SECTEURS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">Année {annee}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Indicateur</th>
              <th className="py-2 pr-3">{secteurA}</th>
              <th className="py-2">{secteurB}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50">
              <td colSpan={3} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                Périmètre
              </td>
            </tr>
            <Row label="Périmètre évalué" a={fmtCurrency(cmp.a.perimetreEvalue)} b={fmtCurrency(cmp.b.perimetreEvalue)} />
            <Row
              label="Top 10 (montant)"
              a={fmtCurrency(cmp.a.top10Montant)}
              b={fmtCurrency(cmp.b.top10Montant)}
            />
            <Row
              label="Top 10 (% du périmètre)"
              a={fmtPct(cmp.a.top10PctPerimetre)}
              b={fmtPct(cmp.b.top10PctPerimetre)}
            />
            <Row label="Fournisseurs évalués" a={String(cmp.a.fournisseursEvalues)} b={String(cmp.b.fournisseursEvalues)} />
            <Row
              label="% du panel fournisseur (secteur)"
              a={panelTotalA ? `${Math.round((cmp.a.fournisseursEvalues / panelTotalA) * 100)}%` : 'Non disponible'}
              b={panelTotalB ? `${Math.round((cmp.b.fournisseursEvalues / panelTotalB) * 100)}%` : 'Non disponible'}
            />
            <Row
              label="Nombre d'évaluateurs"
              a={statA?.nbEvaluateurs != null ? String(statA.nbEvaluateurs) : 'Non disponible'}
              b={statB?.nbEvaluateurs != null ? String(statB.nbEvaluateurs) : 'Non disponible'}
            />

            <tr className="bg-slate-50">
              <td colSpan={3} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                Évaluation
              </td>
            </tr>
            <Row
              label={`Moyenne globale ${annee}`}
              a={cmp.a.moyenneGlobale != null ? `${cmp.a.moyenneGlobale} / 5` : '—'}
              b={cmp.b.moyenneGlobale != null ? `${cmp.b.moyenneGlobale} / 5` : '—'}
            />
            <Row
              label={`Évolution vs ${annee - 1}`}
              a={cmp.a.evolution != null ? `${cmp.a.evolution >= 0 ? '+' : ''}${cmp.a.evolution} pt` : 'Non disponible'}
              b={cmp.b.evolution != null ? `${cmp.b.evolution >= 0 ? '+' : ''}${cmp.b.evolution} pt` : 'Non disponible'}
            />
            <Row
              label="Fournisseurs communs (iso-périmètre, vs année-1)"
              a={String(cmp.a.fournisseursCommuns)}
              b={String(cmp.b.fournisseursCommuns)}
            />
            <Row
              label="Moyenne iso-périmètre"
              a={cmp.a.moyenneIsoPerimetre != null ? `${cmp.a.moyenneIsoPerimetre} / 5` : 'Non disponible'}
              b={cmp.b.moyenneIsoPerimetre != null ? `${cmp.b.moyenneIsoPerimetre} / 5` : 'Non disponible'}
            />
            <Row
              label="Évolution iso-périmètre"
              a={cmp.a.evolutionIsoPerimetre != null ? `${cmp.a.evolutionIsoPerimetre >= 0 ? '+' : ''}${cmp.a.evolutionIsoPerimetre} pt` : 'Non disponible'}
              b={cmp.b.evolutionIsoPerimetre != null ? `${cmp.b.evolutionIsoPerimetre >= 0 ? '+' : ''}${cmp.b.evolutionIsoPerimetre} pt` : 'Non disponible'}
            />
            <Row label="Fournisseurs ≥ 3,5" a={String(cmp.a.excellents)} b={String(cmp.b.excellents)} />
            <Row label="Fournisseurs < 3" a={String(cmp.a.faibles)} b={String(cmp.b.faibles)} />
            <Row label="dont < 2" a={String(cmp.a.tresFaibles)} b={String(cmp.b.tresFaibles)} />

            <tr className="bg-slate-50">
              <td colSpan={3} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                Analyse détaillée
              </td>
            </tr>
            <Row label="À une seule évaluation" a={String(cmp.a.uneEvaluation)} b={String(cmp.b.uneEvaluation)} />
            <Row label={`Non évalués en ${annee - 1}`} a={String(cmp.a.nonEvaluesAnneePrecedente)} b={String(cmp.b.nonEvaluesAnneePrecedente)} />
            <Row label="Jamais évalués avant" a={String(cmp.a.jamaisEvaluesAvant)} b={String(cmp.b.jamaisEvaluesAvant)} />
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-3">
          « Couverture de la dépense totale du département » n'est pas calculable : la dépense totale par département
          (hors fournisseurs évalués) n'est présente dans aucun fichier fourni. Le "panel fournisseur" utilisé pour le %
          est le nombre de fournisseurs distincts déjà vus dans l'historique de ce secteur, pas le panel ABACUS complet.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">
          Fournisseurs communs à {secteurA} et {secteurB} en {annee} ({cmp.fournisseursCommuns.length})
        </h3>
        {cmp.fournisseursCommuns.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun fournisseur commun cette année-là.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-3">
              Moyenne {secteurA} : {cmp.moyenneCommuneA ?? '—'} / 5 · Moyenne {secteurB} : {cmp.moyenneCommuneB ?? '—'} / 5
            </p>
            <h4 className="text-xs uppercase text-slate-500 mb-2">Plus grands écarts de notation</h4>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-3">Fournisseur</th>
                  <th className="py-1.5 pr-3">{secteurA}</th>
                  <th className="py-1.5 pr-3">{secteurB}</th>
                  <th className="py-1.5">Écart</th>
                </tr>
              </thead>
              <tbody>
                {cmp.ecartsMax.map((e) => (
                  <tr key={e.nom} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-medium">{e.nom}</td>
                    <td className="py-1.5 pr-3">{e.noteA} / 5</td>
                    <td className="py-1.5 pr-3">{e.noteB} / 5</td>
                    <td className="py-1.5 font-medium">{Math.round(e.ecart * 100) / 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
