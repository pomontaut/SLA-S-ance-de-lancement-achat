import { useEffect, useState } from 'react'
import type { DepenseBucketStats, DepensesGlobal } from '../data/depenses'
import { formatCurrency, loadDepensesGlobal, pct } from '../data/depenses'

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 pr-3 text-slate-600">{label}</td>
      <td className="py-1.5 pr-3 font-medium">{a}</td>
      <td className="py-1.5 font-medium">{b}</td>
    </tr>
  )
}

function bucketRows(v: DepenseBucketStats) {
  const paiementConnu = v.nbATemps + v.nbEnRetard
  return {
    montant: formatCurrency(v.montantTotal),
    nbDocuments: String(v.nbDocuments),
    nbFournisseurs: v.nbFournisseurs != null ? String(v.nbFournisseurs) : '—',
    factureMoyenne: v.nbFactures ? formatCurrency(v.montantFactures / v.nbFactures) : '—',
    notesCredit: `${formatCurrency(v.montantNotesCredit)} (${v.nbNotesCredit})`,
    aTemps: `${v.nbATemps} (${formatCurrency(v.montantATemps)})${paiementConnu ? ` — ${pct(v.nbATemps, paiementConnu)}%` : ''}`,
    enRetard: `${v.nbEnRetard} (${formatCurrency(v.montantEnRetard)})${paiementConnu ? ` — ${pct(v.nbEnRetard, paiementConnu)}%` : ''}`,
    retardMoyen: v.retardMoyenJours != null ? `${v.retardMoyenJours} j.` : '—',
    enAttente: `${v.nbEnAttente} (${formatCurrency(v.montantEnAttente)})`,
  }
}

export default function ConsortiumTab() {
  const [data, setData] = useState<DepensesGlobal | null>(null)

  useEffect(() => {
    loadDepensesGlobal().then(setData)
  }, [])

  if (!data) {
    return <p className="text-sm text-slate-500">Chargement des données de dépense…</p>
  }

  const chantier = bucketRows(data.chantier)
  const consortium = bucketRows(data.consortium)
  const totalPct = pct(data.consortium.montantTotal, data.global.montantTotal)

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold mb-1">Chantier Induni vs Consortium</h3>
        <p className="text-xs text-slate-500 mb-3">
          Le Consortium représente {totalPct ?? '—'}% de la dépense totale ({formatCurrency(data.consortium.montantTotal)} sur{' '}
          {formatCurrency(data.global.montantTotal)}). Mêmes règles de calcul que l'onglet Analyse de la dépense
          (montant pos., échéance = date doc. + délai de la condition de paiement).
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Indicateur</th>
              <th className="py-2 pr-3">Chantier Induni</th>
              <th className="py-2">Consortium</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Montant total" a={chantier.montant} b={consortium.montant} />
            <Row label="Nombre de documents" a={chantier.nbDocuments} b={consortium.nbDocuments} />
            <Row label="Fournisseurs distincts" a={chantier.nbFournisseurs} b={consortium.nbFournisseurs} />
            <Row label="Facture moyenne" a={chantier.factureMoyenne} b={consortium.factureMoyenne} />
            <Row label="Notes de crédit" a={chantier.notesCredit} b={consortium.notesCredit} />
            <Row label="Payé à temps" a={chantier.aTemps} b={consortium.aTemps} />
            <Row label="Payé en retard" a={chantier.enRetard} b={consortium.enRetard} />
            <Row label="Retard moyen" a={chantier.retardMoyen} b={consortium.retardMoyen} />
            <Row label="En attente de paiement" a={chantier.enAttente} b={consortium.enAttente} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
