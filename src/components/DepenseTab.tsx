import { useEffect, useMemo, useState } from 'react'
import type { DepenseBucketStats, DepenseChantierStats, DepensesGlobal, DepenseTranche } from '../data/depenses'
import { chantierColor, chantierLabel, formatCurrency, loadDepensesGlobal, pct } from '../data/depenses'
import { secteurColor } from '../data/palette'

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warning' | 'critical' }) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'warning' ? 'text-amber-600' : tone === 'critical' ? 'text-red-600' : 'text-indigo-600'
  return (
    <div className="card text-center py-4">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
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
            <th className="py-2 pr-3">Payé à temps</th>
            <th className="py-2">Payé en retard</th>
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
                  {entite}
                </span>
              </td>
              <td className="py-1.5 pr-3 font-medium">{formatCurrency(v.montantTotal)}</td>
              <td className="py-1.5 pr-3">{pct(v.montantTotal, total)}%</td>
              <td className="py-1.5 pr-3">{v.nbDocuments}</td>
              <td className="py-1.5 pr-3 text-green-600">
                {v.nbATemps} ({formatCurrency(v.montantATemps)})
              </td>
              <td className="py-1.5 text-red-600">
                {v.nbEnRetard} ({formatCurrency(v.montantEnRetard)})
              </td>
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
            <th className="py-2 pr-3">Payé à temps</th>
            <th className="py-2">Payé en retard</th>
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
              <td className="py-1.5 pr-3 text-green-600">
                {c.nbATemps} ({formatCurrency(c.montantATemps)})
              </td>
              <td className="py-1.5 text-red-600">
                {c.nbEnRetard} ({formatCurrency(c.montantEnRetard)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {parChantier.length > 20 && (
        <button className="text-xs text-indigo-600 hover:underline mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Réduire' : `Afficher les ${parChantier.length} chantiers chargés`}
        </button>
      )}
      <p className="text-xs text-slate-400 mt-2">
        {nbChantiers} chantiers distincts au total (60 chargés ici, triés par montant décroissant) — noms et
        techniciens retrouvés pour {nbChantiersAvecNom} d'entre eux via Chantiers.xlsx. Le code consortium/Induni
        est celui du chantier (colonne "Chantier consortium" de ce fichier), qui ne coïncide pas toujours avec le
        champ "Aff." du document (~18% d'écart constaté) — à clarifier avec la comptabilité si besoin.
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
        "INDUNI &amp; CIE" en tête de liste correspond à des écritures intercompagnie (loyers,
        refacturations internes), pas à un fournisseur externe — à interpréter en conséquence.
      </p>
    </div>
  )
}

export default function DepenseTab({ onZoom }: { onZoom: (nom: string) => void }) {
  const [data, setData] = useState<DepensesGlobal | null>(null)

  useEffect(() => {
    loadDepensesGlobal().then(setData)
  }, [])

  const g = data?.global
  const chantierPct = useMemo(() => (data ? pct(data.chantier.montantTotal, data.global.montantTotal) : null), [data])
  const consortiumPct = useMemo(() => (data ? pct(data.consortium.montantTotal, data.global.montantTotal) : null), [data])
  const ncPct = useMemo(() => (data && g ? pct(Math.abs(g.montantNotesCredit), g.montantFactures) : null), [data, g])
  const paiementConnuPct = useMemo(
    () => (g ? pct(g.nbATemps, g.nbATemps + g.nbEnRetard) : null),
    [g],
  )

  if (!data || !g) {
    return <p className="text-sm text-slate-500">Chargement des données de dépense…</p>
  }

  return (
    <div className="space-y-4">
      <div className="card bg-amber-50 border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Méthodologie :</strong> tous les montants ci-dessous utilisent la colonne « Montant pos. » du
          journal comptable (et non le montant brut du document, qui peut différer d'une allocation). L'échéance
          de paiement est estimée par <em>Date doc. + nombre de jours de la condition de paiement</em> (ex. « 30
          JOURS NET » → 30 jours) : les conditions avec escompte n'indiquent pas toujours le délai net réel dans ce
          fichier. Le taux de retard constaté ci-dessous est élevé (délai médian observé ≈ 73 jours pour un délai
          « 30 JOURS NET ») — à valider avec la comptabilité avant diffusion, ça peut aussi être révélateur d'une
          vraie pratique de paiement différé.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Dépense totale (montant pos.)" value={formatCurrency(g.montantTotal)} />
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
        <StatTile
          label="Notes de crédit"
          value={formatCurrency(g.montantNotesCredit)}
          sub={ncPct != null ? `${ncPct}% du montant facturé — ${g.nbNotesCredit} note(s)` : `${g.nbNotesCredit} note(s)`}
        />
        <StatTile
          label="Payé à temps"
          value={`${g.nbATemps} doc.`}
          sub={`${formatCurrency(g.montantATemps)}${paiementConnuPct != null ? ` — ${paiementConnuPct}%` : ''}`}
          tone="good"
        />
        <StatTile
          label="Payé en retard"
          value={`${g.nbEnRetard} doc.`}
          sub={`${formatCurrency(g.montantEnRetard)} — retard moyen ${g.retardMoyenJours ?? '—'} j.`}
          tone="critical"
        />
        <StatTile
          label="En attente de paiement"
          value={formatCurrency(g.montantEnAttente)}
          sub={`${g.nbEnAttente} document(s) non soldé(s)`}
          tone="warning"
        />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Dépense par entité</h3>
        <EntiteTable parEntite={data.parEntite} />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">Dépense par chantier</h3>
        <p className="text-xs text-slate-500 mb-3">
          "Chantier" = numéro "SECT Débit" du journal comptable, sur indication explicite de la personne qui utilise l'outil.
        </p>
        <ChantierTable
          parChantier={data.parChantier}
          nbChantiers={data.nbChantiers}
          nbChantiersAvecNom={data.nbChantiersAvecNom}
          montantTotal={g.montantTotal}
        />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">Répartition des factures par tranche de montant</h3>
        <p className="text-xs text-slate-500 mb-3">
          Uniquement les documents de genre "Facture" avec un montant pos. renseigné —{' '}
          {data.nbFacturesTotal.toLocaleString('fr-CH')} factures ({formatCurrency(data.montantFacturesTotal)}), soit
          {g.nbFactures - data.nbFacturesTotal > 0
            ? ` ${g.nbFactures - data.nbFacturesTotal} facture(s) de moins que le total ci-dessus car leur montant pos. n'est pas renseigné`
            : ''}
          . Panier moyen sur ce périmètre : {formatCurrency(data.panierMoyenFacture)}.
        </p>
        <TrancheTable tranches={data.tranches} />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">Top 20 fournisseurs par dépense</h3>
        <p className="text-xs text-slate-500 mb-3">Cliquez un nom pour ouvrir sa fiche fournisseur.</p>
        <TopFournisseursTable top20={data.top20Fournisseurs} montantTotal={g.montantTotal} />
        <div className="mt-2 flex flex-wrap gap-2">
          {data.top20Fournisseurs.map((f) => (
            <button key={f.nfr} className="text-xs text-indigo-600 hover:underline" onClick={() => onZoom(f.nom)}>
              {f.nom} →
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
