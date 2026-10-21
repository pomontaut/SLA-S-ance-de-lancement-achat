import { Fragment, useEffect, useMemo, useState } from 'react'
import { loadEshopReport, sameSupplier, type EshopReport } from '../lib/eshopReporting'

const chf = (v: number | null | undefined) => (v == null ? '🔒' : Math.round(v).toLocaleString('fr-CH') + ' CHF')
const num = (v: number) => v.toLocaleString('fr-CH')
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) + ' %' : '—')

function csvDownload(filename: string, rows: (string | number | null)[][]) {
  const q = (v: string | number | null) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function useEshopReport() {
  const [report, setReport] = useState<EshopReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadEshopReport()
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  return { report, error }
}

const NOTE =
  "Commandes passées via l'e-shop (engagements, hors annulées/remplacées) : à ne pas additionner à la dépense comptable " +
  'ci-dessus, qui provient des factures du Journal COFI. Prix confidentiels masqués (🔒).'

/** Fiche fournisseur : liste des commandes e-shop de ce fournisseur et de leurs articles (quantité, montant). */
export function EshopOrdersSection({ fournisseurNom }: { fournisseurNom: string }) {
  const { report, error } = useEshopReport()
  const [open, setOpen] = useState<string | null>(null)
  const orders = useMemo(() => (report ? report.orders.filter((o) => sameSupplier(o.supplier, fournisseurNom)) : []), [report, fournisseurNom])
  const articles = useMemo(() => (report ? report.articles.filter((a) => sameSupplier(a.supplier, fournisseurNom)) : []), [report, fournisseurNom])
  const total = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const hasMasked = orders.some((o) => o.total == null)

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">🛒 Commandes e-shop</h3>
        {articles.length > 0 && (
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              csvDownload(`eshop_${fournisseurNom}.csv`, [
                ['N° commande', 'Date', 'Chantier', 'Référence', 'Désignation', 'Quantité', 'Unité', 'Prix unitaire', 'Montant'],
                ...orders.flatMap((o) => o.items.map((i) => [o.no, o.date, o.chantier, i.article, i.designation, i.qty, i.unite, i.unitPrice, i.amount])),
              ])
            }
          >
            ⬇ Export CSV
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{NOTE}</p>
      {error && <p className="text-sm text-red-600">Commandes e-shop indisponibles : {error}</p>}
      {!report && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {report && orders.length === 0 && <p className="text-sm text-slate-500">Aucune commande e-shop pour ce fournisseur.</p>}
      {orders.length > 0 && (
        <>
          <p className="text-sm">
            <strong>{orders.length}</strong> commande(s) · <strong>{articles.length}</strong> article(s) ·{' '}
            <strong>{hasMasked ? '🔒' : chf(total)}</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="py-1.5 pr-2">N°</th>
                  <th className="pr-2">Date</th>
                  <th className="pr-2">Chantier</th>
                  <th className="pr-2 text-right">Articles</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Fragment key={o.no}>
                    <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === o.no ? null : o.no)}>
                      <td className="py-1.5 pr-2">
                        {open === o.no ? '▾' : '▸'} {o.no}
                      </td>
                      <td className="pr-2">{o.date}</td>
                      <td className="pr-2">{o.chantier ?? '—'}</td>
                      <td className="pr-2 text-right">{o.items.length}</td>
                      <td className="text-right">{chf(o.total)}</td>
                    </tr>
                    {open === o.no && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th>Réf.</th>
                                <th>Désignation</th>
                                <th className="text-right">Qté</th>
                                <th className="text-right">Prix unit.</th>
                                <th className="text-right">Montant</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.items.map((i, k) => (
                                <tr key={k}>
                                  <td>{i.article}</td>
                                  <td>{i.designation}</td>
                                  <td className="text-right">
                                    {num(i.qty)} {i.unite ?? ''}
                                  </td>
                                  <td className="text-right">{chf(i.unitPrice)}</td>
                                  <td className="text-right">{chf(i.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {o.extraCharges ? <p className="text-xs text-slate-500 mt-1">Frais annexes (transport…) : {chf(o.extraCharges)}</p> : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/** Analyse de la dépense : reporting e-shop à la maille article + indicateurs de bon fonctionnement. */
export function EshopReportingSection() {
  const { report, error } = useEshopReport()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    if (!report) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return report.articles.filter((a) => words.every((w) => `${a.supplier} ${a.reference} ${a.name} ${a.famille ?? ''}`.toLowerCase().includes(w)))
  }, [report, q])

  if (error) return <div className="card text-sm text-red-600">Commandes e-shop indisponibles : {error}</div>
  if (!report) return <div className="card text-sm text-slate-500">Commandes e-shop : chargement…</div>
  const k = report.kpis

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold">🛒 Commandes e-shop — reporting par article</h3>
        <p className="text-xs text-slate-500">{NOTE}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Tile label="Commandes" value={String(k.nbOrders)} sub={`sur ${k.nbOrdersAll} créées`} />
        <Tile label="Articles commandés" value={String(k.nbArticlesOrdered)} sub={`sur ${k.nbCatalogArticles} au catalogue`} />
        <Tile label="Utilisateurs actifs" value={String(k.nbActiveUsers)} sub={`${k.nbChantiers} chantiers`} />
        <Tile label="Écart vs prix catalogue" value={chf(k.gainVsCatalog)} sub="gain cumulé" />
      </div>
      <table className="text-sm">
        <tbody>
          {[
            ['Commandes annulées', k.nbCancelled, pctOf(k.nbCancelled, k.nbOrdersAll)],
            ['Commandes remplacées (ANNULE ET REMPLACE)', k.nbSuperseded, pctOf(k.nbSuperseded, k.nbOrdersAll)],
            ['E-mail fournisseur non envoyé', k.nbEmailNotSent, pctOf(k.nbEmailNotSent, k.nbOrdersAll)],
            ['En attente d’approbation / refusées', `${k.nbPendingApproval} / ${k.nbRefused}`, ''],
            ['Commandes relancées', k.nbRelanced, pctOf(k.nbRelanced, k.nbOrders)],
            ['Réception confirmée', k.nbReceptionConfirmed, pctOf(k.nbReceptionConfirmed, k.nbOrders)],
            ['Facturées', k.nbInvoiced, pctOf(k.nbInvoiced, k.nbOrders)],
            ['Articles dont le prix a varié', k.nbPricesChanged, ''],
            ['Articles du catalogue jamais commandés', k.nbCatalogNeverOrdered, pctOf(k.nbCatalogNeverOrdered, k.nbCatalogArticles)],
          ].map(([l, v, p]) => (
            <tr key={String(l)} className="border-b border-slate-100">
              <td className="py-1 pr-6">{l}</td>
              <td className="pr-4 text-right">{v}</td>
              <td className="text-right text-slate-500">{p}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Détail par article ({rows.length})</h4>
        <div className="flex gap-2">
          <input className="input text-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              csvDownload('eshop_articles.csv', [
                ['Fournisseur', 'Référence', 'Désignation', 'Famille', 'Unité', 'Quantité', 'Nb commandes', 'Montant', 'Prix moyen', 'Dernier prix', 'Prix catalogue', 'Variation %', 'Écart catalogue'],
                ...rows.map((a) => [a.supplier, a.reference, a.name, a.famille, a.unite, a.qty, a.nbOrders, a.amount, a.avgPrice, a.lastPrice, a.catalogPrice, a.priceVariationPct, a.gain]),
              ])
            }
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-xs uppercase text-slate-500 border-b">
              <th className="py-1.5 pr-2">Fournisseur</th>
              <th className="pr-2">Réf.</th>
              <th className="pr-2">Désignation</th>
              <th className="pr-2 text-right">Quantité</th>
              <th className="pr-2 text-right">Cmd</th>
              <th className="pr-2 text-right">Montant</th>
              <th className="pr-2 text-right">Prix moyen</th>
              <th className="text-right">Var. prix</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((a) => (
              <tr key={a.supplier + a.reference} className="border-b border-slate-100">
                <td className="py-1 pr-2">{a.supplier}</td>
                <td className="pr-2">{a.reference}</td>
                <td className="pr-2">{a.name}</td>
                <td className="pr-2 text-right">
                  {num(a.qty)} {a.unite ?? ''}
                </td>
                <td className="pr-2 text-right">{a.nbOrders}</td>
                <td className="pr-2 text-right">{chf(a.amount)}</td>
                <td className="pr-2 text-right">{chf(a.avgPrice)}</td>
                <td className="text-right">{a.priceVariationPct == null ? '—' : a.priceVariationPct + ' %'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && <p className="text-xs text-slate-500 mt-1">500 premières lignes affichées — export CSV pour la liste complète.</p>}
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  )
}
