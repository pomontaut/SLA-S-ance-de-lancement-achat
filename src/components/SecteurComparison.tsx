import { useEffect, useMemo, useState } from 'react'
import type { EvalRecord, SecteurStat } from '../data/evaluationsHistorique'
import { SECTEURS, anneesDisponibles, compareCells, computeKpis, findSecteurStat } from '../data/evaluationsHistorique'

// Les 5 vraies entités du groupe — "Général" est une moyenne transversale calculée,
// pas une entité à comparer au même titre que les autres.
const ENTITES = SECTEURS.filter((s) => s !== 'Général')

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
  const [mode, setMode] = useState<'secteurs' | 'annees' | 'toutes'>('secteurs')

  const [secteurA, setSecteurA] = useState('GC')
  const [secteurB, setSecteurB] = useState('BAT GE')

  const anneesToutes = useMemo(
    () => Array.from(new Set(ENTITES.flatMap((s) => anneesDisponibles(all, s)))).sort((a, b) => b - a),
    [all],
  )
  const [anneeToutes, setAnneeToutes] = useState(annee)

  const [secteurUnique, setSecteurUnique] = useState('GC')
  const anneesSecteurUnique = useMemo(() => anneesDisponibles(all, secteurUnique), [all, secteurUnique])
  const [anneeA, setAnneeA] = useState(annee)
  const [anneeB, setAnneeB] = useState(annee - 1)

  // Quand on change de secteur en mode "2 années", recale les deux années sélectionnées
  // sur les deux plus récentes réellement disponibles pour ce secteur.
  useEffect(() => {
    if (anneesSecteurUnique.length === 0) return
    setAnneeA(anneesSecteurUnique[0])
    setAnneeB(anneesSecteurUnique[1] ?? anneesSecteurUnique[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secteurUnique])

  const cellA = mode === 'secteurs' ? { secteur: secteurA, annee } : { secteur: secteurUnique, annee: anneeA }
  const cellB = mode === 'secteurs' ? { secteur: secteurB, annee } : { secteur: secteurUnique, annee: anneeB }
  const labelA = mode === 'secteurs' ? secteurA : `${secteurUnique} ${anneeA}`
  const labelB = mode === 'secteurs' ? secteurB : `${secteurUnique} ${anneeB}`

  const cmp = useMemo(() => compareCells(all, cellA, cellB), [all, cellA.secteur, cellA.annee, cellB.secteur, cellB.annee])
  const statA = findSecteurStat(secteurStats, cellA.secteur, cellA.annee)
  const statB = findSecteurStat(secteurStats, cellB.secteur, cellB.annee)

  const panelTotalA = new Set(all.filter((r) => r.secteur === cellA.secteur).map((r) => r.nom)).size
  const panelTotalB = new Set(all.filter((r) => r.secteur === cellB.secteur).map((r) => r.nom)).size

  const kpisToutes = useMemo(
    () => ENTITES.map((s) => ({ secteur: s, kpis: computeKpis(all, s, anneeToutes) })),
    [all, anneeToutes],
  )
  const panelToutes = useMemo(
    () => ENTITES.map((s) => new Set(all.filter((r) => r.secteur === s).map((r) => r.nom)).size),
    [all],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={mode === 'secteurs' ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
          onClick={() => setMode('secteurs')}
        >
          2 secteurs, même année
        </button>
        <button
          className={mode === 'annees' ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
          onClick={() => setMode('annees')}
        >
          Même secteur, 2 années
        </button>
        <button
          className={mode === 'toutes' ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
          onClick={() => setMode('toutes')}
        >
          Les 5 entités
        </button>
      </div>

      {mode === 'secteurs' ? (
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
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input w-40"
            value={secteurUnique}
            onChange={(e) => setSecteurUnique(e.target.value)}
          >
            {SECTEURS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input w-28" value={anneeA} onChange={(e) => setAnneeA(Number(e.target.value))}>
            {anneesSecteurUnique.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="text-slate-400">vs</span>
          <select className="input w-28" value={anneeB} onChange={(e) => setAnneeB(Number(e.target.value))}>
            {anneesSecteurUnique.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'toutes' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-500">Année</span>
          <select className="input w-28" value={anneeToutes} onChange={(e) => setAnneeToutes(Number(e.target.value))}>
            {anneesToutes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'toutes' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Indicateur</th>
                {ENTITES.map((s) => (
                  <th key={s} className="py-2 pr-3">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50">
                <td colSpan={ENTITES.length + 1} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                  Périmètre
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Périmètre évalué</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {fmtCurrency(kpis.perimetreEvalue)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Top 10 (montant)</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {fmtCurrency(kpis.top10Montant)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Top 10 (% du périmètre)</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {fmtPct(kpis.top10PctPerimetre)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Fournisseurs évalués</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.fournisseursEvalues}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">% du panel fournisseur (secteur)</td>
                {kpisToutes.map(({ kpis }, i) => (
                  <td key={ENTITES[i]} className="py-1.5 pr-3 font-medium">
                    {panelToutes[i] ? `${Math.round((kpis.fournisseursEvalues / panelToutes[i]) * 100)}%` : 'Non disponible'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Nombre d'évaluateurs</td>
                {ENTITES.map((s) => {
                  const stat = findSecteurStat(secteurStats, s, anneeToutes)
                  return (
                    <td key={s} className="py-1.5 pr-3 font-medium">
                      {stat?.nbEvaluateurs != null ? String(stat.nbEvaluateurs) : 'Non disponible'}
                    </td>
                  )
                })}
              </tr>

              <tr className="bg-slate-50">
                <td colSpan={ENTITES.length + 1} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                  Évaluation
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Moyenne globale</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.moyenneGlobale != null ? `${kpis.moyenneGlobale} / 5` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Évolution vs année-1</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.evolution != null ? `${kpis.evolution >= 0 ? '+' : ''}${kpis.evolution} pt` : 'Non disponible'}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Fournisseurs ≥ 3,5</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.excellents}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Fournisseurs &lt; 3</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.faibles}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">dont &lt; 2</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.tresFaibles}
                  </td>
                ))}
              </tr>

              <tr className="bg-slate-50">
                <td colSpan={ENTITES.length + 1} className="py-1 px-2 font-semibold text-xs uppercase text-slate-500">
                  Analyse détaillée
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">À une seule évaluation</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.uneEvaluation}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-600">Non évalués l'année précédente</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.nonEvaluesAnneePrecedente}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-slate-600">Jamais évalués avant</td>
                {kpisToutes.map(({ secteur, kpis }) => (
                  <td key={secteur} className="py-1.5 pr-3 font-medium">
                    {kpis.jamaisEvaluesAvant}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-3">
            Vue synthétique des 5 entités pour l'année {anneeToutes}. Pour le détail des fournisseurs communs et des
            plus grands écarts de notation entre deux entités précises, utilise le mode « 2 secteurs, même année ».
          </p>
        </div>
      ) : (
      <>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Indicateur</th>
              <th className="py-2 pr-3">{labelA}</th>
              <th className="py-2">{labelB}</th>
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
              label="Moyenne globale"
              a={cmp.a.moyenneGlobale != null ? `${cmp.a.moyenneGlobale} / 5 (${cellA.annee})` : '—'}
              b={cmp.b.moyenneGlobale != null ? `${cmp.b.moyenneGlobale} / 5 (${cellB.annee})` : '—'}
            />
            <Row
              label="Évolution vs année-1"
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
            <Row label="Non évalués l'année précédente" a={String(cmp.a.nonEvaluesAnneePrecedente)} b={String(cmp.b.nonEvaluesAnneePrecedente)} />
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
          Fournisseurs communs à {labelA} et {labelB} ({cmp.fournisseursCommuns.length})
        </h3>
        {cmp.fournisseursCommuns.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun fournisseur commun.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-3">
              Moyenne {labelA} : {cmp.moyenneCommuneA ?? '—'} / 5 · Moyenne {labelB} : {cmp.moyenneCommuneB ?? '—'} / 5
            </p>
            <h4 className="text-xs uppercase text-slate-500 mb-2">Plus grands écarts de notation</h4>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-3">Fournisseur</th>
                  <th className="py-1.5 pr-3">{labelA}</th>
                  <th className="py-1.5 pr-3">{labelB}</th>
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
      </>
      )}
    </div>
  )
}
