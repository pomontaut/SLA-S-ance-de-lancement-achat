import type { BlacklistEntry } from '../data/evaluationsHistorique'
import { findBlacklistEntry } from '../data/evaluationsHistorique'

export function BlacklistBadge({ nom, blacklist }: { nom: string; blacklist: BlacklistEntry[] }) {
  const entry = findBlacklistEntry(blacklist, nom)
  if (!entry) return null
  return (
    <span
      className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-red-600 align-middle"
      title={entry.remarque}
    >
      🚫 Blacklisté
    </span>
  )
}

export function BlacklistPanel({ blacklist, onZoom }: { blacklist: BlacklistEntry[]; onZoom: (nom: string) => void }) {
  if (blacklist.length === 0) return null
  return (
    <div className="card border border-red-200">
      <h3 className="font-semibold mb-1 text-red-700">🚫 Fournisseurs blacklistés ({blacklist.length})</h3>
      <p className="text-xs text-slate-500 mb-3">
        Identifiés dans l'historique 2008-2025 (colonne Remarques) comme à ne plus consulter.
      </p>
      <div className="divide-y divide-red-100">
        {blacklist.map((b) => (
          <div key={b.nom} className="py-2">
            <button className="font-medium text-sm hover:underline" onClick={() => onZoom(b.nom)}>
              {b.nom}
            </button>
            <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line line-clamp-2">{b.remarque}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
