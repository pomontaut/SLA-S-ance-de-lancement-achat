import type { BlacklistEntry } from '../data/evaluationsHistorique'
import { findBlacklistEntry } from '../data/evaluationsHistorique'

export function BlacklistBadge({ nom, blacklist }: { nom: string; blacklist: BlacklistEntry[] }) {
  const entry = findBlacklistEntry(blacklist, nom)
  if (!entry) return null
  return (
    <span
      className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-red-600 align-middle"
      title={entry.remarques.join(' • ')}
    >
      🚫 Blacklisté
    </span>
  )
}
