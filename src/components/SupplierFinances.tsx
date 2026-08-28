import { useMemo, useState } from 'react'
import type { DepenseFournisseur } from '../data/depenses'
import { chantierColor, chantierLabel, computeTranches, formatCurrency, pct } from '../data/depenses'
import { secteurColor, noteColor } from '../data/palette'

export interface NotesRecentes {
  yLatest: number
  noteLatest: number | null
  yPrev: number | null
  notePrev: number | null
}

function KpiTile({
  label,
  value,
  sub,
  tone,
  color,
  big,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'warning' | 'critical'
  color?: string
  big?: boolean
}) {
  const toneClass =
    tone === 'good' ? 'text-green-600' : tone === 'warning' ? 'text-amber-600' : tone === 'critical' ? 'text-red-600' : 'text-indigo-600'
  return (
    <div className="bg-white rounded-lg border border-slate-200 text-center py-3 px-2">
      <div className={`${big ? 'text-3xl' : 'text-lg'} font-bold ${color ? '' : toneClass}`} style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function SupplierFinances({
  fournisseur,
  loading,
  notesRecentes,
}: {
  fournisseur: DepenseFournisseur | null
  loading: boolean
  notesRecentes?: NotesRecentes | null
}) {
  const [showAllDocs, setShowAllDocs] = useState(false)
  const trancheData = useMemo(() => (fournisseur ? computeTranches(fournisseur.documents) : null), [fournisseur])

  if (loading) {
    return <p className="text-xs text-slate-400">Chargement des données de dépense…</p>
  }
  if (!fournisseur) {
    return (
      <div className="bg-slate-50 rounded-lg p-3">
        <p className="text-xs text-slate-500">
          💰 Aucune donnée financière trouvée pour ce fournisseur dans le journal comptable (Journal COFI 2025) —
          soit il n'y a pas eu de dépense sur la période couverte, soit le nom ne correspond à aucune entrée
          (le journal utilise des noms tronqués SAP à ~20 caractères).
        </p>
      </div>
    )
  }

  const g = fournisseur.global
  const paiementConnu = g.nbATemps + g.nbEnRetard
  const notesCredit = fournisseur.documents.filter((d) => d.genre.toLowerCase().includes('crédit'))
  const docs = showAllDocs ? fournisseur.documents : fournisseur.documents.slice(0, 30)

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-3">
      <h4 className="text-xs uppercase text-slate-500">💰 Dépenses &amp; paiements (Journal COFI)</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {notesRecentes && (
          <KpiTile
            label={`Note ${notesRecentes.yLatest}`}
            value={notesRecentes.noteLatest != null ? `${notesRecentes.noteLatest} / 5` : '—'}
            color={notesRecentes.noteLatest != null ? noteColor(notesRecentes.noteLatest) : undefined}
            big
          />
        )}
        {notesRecentes && notesRecentes.yPrev != null && (
          <KpiTile
            label={`Note ${notesRecentes.yPrev}`}
            value={notesRecentes.notePrev != null ? `${notesRecentes.notePrev} / 5` : '—'}
            color={notesRecentes.notePrev != null ? noteColor(notesRecentes.notePrev) : undefined}
            big
            sub={
              notesRecentes.noteLatest != null && notesRecentes.notePrev != null
                ? (() => {
                    const variation = Math.round((notesRecentes.noteLatest! - notesRecentes.notePrev!) * 100) / 100
                    const emoji = variation > 0 ? '📈' : variation < 0 ? '📉' : '➡️'
                    return `${variation > 0 ? '+' : ''}${variation} ${emoji}`
                  })()
                : undefined
            }
          />
        )}
        <KpiTile label="CA Chantier Induni" value={formatCurrency(fournisseur.chantierMontant)} />
        <KpiTile label="CA Consortium" value={formatCurrency(fournisseur.consortiumMontant)} />
        <KpiTile label="Total" value={formatCurrency(g.montantTotal)} sub={`${g.nbDocuments} document(s)`} />
        <KpiTile
          label="Panier moyen"
          value={g.nbDocuments ? formatCurrency(g.montantTotal / g.nbDocuments) : '—'}
          sub="montant total / nb documents"
        />
        <KpiTile
          label="Notes de crédit"
          value={formatCurrency(g.montantNotesCredit)}
          sub={`${g.nbNotesCredit} note(s)`}
        />
        <KpiTile
          label="Payé à temps"
          value={`${g.nbATemps}${paiementConnu ? ` (${pct(g.nbATemps, paiementConnu)}%)` : ''}`}
          sub={formatCurrency(g.montantATemps)}
          tone="good"
        />
        <KpiTile
          label="Payé en retard"
          value={`${g.nbEnRetard}${paiementConnu ? ` (${pct(g.nbEnRetard, paiementConnu)}%)` : ''}`}
          sub={`${formatCurrency(g.montantEnRetard)}${g.retardMoyenJours != null ? ` — ${g.retardMoyenJours} j. en moy.` : ''}`}
          tone="critical"
        />
        <KpiTile
          label="En attente de paiement"
          value={String(g.nbEnAttente)}
          sub={formatCurrency(g.montantEnAttente)}
          tone="warning"
        />
        <KpiTile label="Conditions de paiement" value={fournisseur.conditions.length ? fournisseur.conditions[0] : '—'} sub={fournisseur.conditions.length > 1 ? `+${fournisseur.conditions.length - 1} autre(s)` : undefined} />
      </div>

      {Object.keys(fournisseur.parEntite).length > 1 && (
        <div>
          <h5 className="text-[11px] uppercase text-slate-500 mb-1">Par entité</h5>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-2">Entité</th>
                  <th className="py-1 pr-2">Montant</th>
                  <th className="py-1 pr-2">À temps</th>
                  <th className="py-1">En retard</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fournisseur.parEntite)
                  .sort((a, b) => b[1].montantTotal - a[1].montantTotal)
                  .map(([entite, v]) => (
                    <tr key={entite} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: secteurColor(entite) }}
                        >
                          {entite}
                        </span>
                      </td>
                      <td className="py-1 pr-2">{formatCurrency(v.montantTotal)}</td>
                      <td className="py-1 pr-2 text-green-600">{v.nbATemps}</td>
                      <td className="py-1 text-red-600">{v.nbEnRetard}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Object.keys(fournisseur.parChantier).length > 0 && (
        <div>
          <h5 className="text-[11px] uppercase text-slate-500 mb-1">
            Détail par chantier — {Object.keys(fournisseur.parChantier).length}
          </h5>
          <div className="overflow-x-auto max-h-40 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-slate-50">
                  <th className="py-1 pr-2">Chantier</th>
                  <th className="py-1 pr-2">Montant</th>
                  <th className="py-1 pr-2">À temps</th>
                  <th className="py-1">En retard</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fournisseur.parChantier)
                  .sort((a, b) => b[1].montantTotal - a[1].montantTotal)
                  .map(([code, v]) => (
                    <tr key={code} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: chantierColor(v.consortium) }}
                        />
                        {chantierLabel(code, v.nom)}
                      </td>
                      <td className="py-1 pr-2">{formatCurrency(v.montantTotal)}</td>
                      <td className="py-1 pr-2 text-green-600">{v.nbATemps}</td>
                      <td className="py-1 text-red-600">{v.nbEnRetard}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notesCredit.length > 0 && (
        <div>
          <h5 className="text-[11px] uppercase text-slate-500 mb-1">Notes de crédit versées ({notesCredit.length})</h5>
          <div className="overflow-x-auto max-h-40 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <tbody>
                {notesCredit.map((d) => (
                  <tr key={d.docno} className="border-b border-slate-100">
                    <td className="py-1 pr-2 text-slate-500">{d.dateDoc}</td>
                    <td className="py-1 pr-2 font-medium text-red-600">{formatCurrency(d.montant)}</td>
                    <td className="py-1 text-slate-500">{d.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trancheData && trancheData.nbFactures > 0 && (
        <div>
          <h5 className="text-[11px] uppercase text-slate-500 mb-1">
            Répartition des factures par tranche de montant ({trancheData.nbFactures}) — panier moyen{' '}
            {formatCurrency(trancheData.panierMoyen)}
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-2">Tranche</th>
                  <th className="py-1 pr-2">Nb</th>
                  <th className="py-1 pr-2">% nb</th>
                  <th className="py-1 pr-2">Montant</th>
                  <th className="py-1">% montant</th>
                </tr>
              </thead>
              <tbody>
                {trancheData.tranches.map((t) => (
                  <tr key={t.label} className="border-b border-slate-100">
                    <td className="py-1 pr-2 font-medium">{t.label}</td>
                    <td className="py-1 pr-2">{t.nbFactures}</td>
                    <td className="py-1 pr-2">{t.pctNb != null ? `${t.pctNb.toFixed(1)}%` : '—'}</td>
                    <td className="py-1 pr-2">{formatCurrency(t.montantFactures)}</td>
                    <td className="py-1">{t.pctMontant != null ? `${t.pctMontant.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h5 className="text-[11px] uppercase text-slate-500">
            Détail par document ({fournisseur.documents.length})
          </h5>
          {fournisseur.documents.length > 30 && (
            <button className="text-[11px] text-indigo-600 hover:underline" onClick={() => setShowAllDocs((v) => !v)}>
              {showAllDocs ? 'Afficher les 30 plus récents' : 'Afficher tout'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 sticky top-0 bg-slate-50">
                <th className="py-1 pr-2">N° doc.</th>
                <th className="py-1 pr-2">Date doc.</th>
                <th className="py-1 pr-2">Genre</th>
                <th className="py-1 pr-2">Entité</th>
                <th className="py-1 pr-2">Chantier</th>
                <th className="py-1 pr-2">Aff.</th>
                <th className="py-1 pr-2">Montant</th>
                <th className="py-1 pr-2">Échéance</th>
                <th className="py-1">Payé le</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.docno} className="border-b border-slate-100">
                  <td className="py-1 pr-2 text-slate-500">{d.docno}</td>
                  <td className="py-1 pr-2">{d.dateDoc}</td>
                  <td className="py-1 pr-2">{d.genre}</td>
                  <td className="py-1 pr-2">{d.entite}</td>
                  <td className="py-1 pr-2">
                    {d.chantier && (
                      <>
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: chantierColor(d.chantierConsortium) }}
                        />
                        {chantierLabel(d.chantier, d.chantierNom)}
                      </>
                    )}
                  </td>
                  <td className="py-1 pr-2">{d.aff === 'CONSORTIUM' ? 'Consortium' : 'Chantier'}</td>
                  <td className="py-1 pr-2">{formatCurrency(d.montant)}</td>
                  <td className="py-1 pr-2 text-slate-500">{d.dateEcheance ?? '—'}</td>
                  <td className={`py-1 ${d.enRetard ? 'text-red-600' : d.datePaiement ? 'text-green-600' : 'text-amber-600'}`}>
                    {d.datePaiement ?? 'en attente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
