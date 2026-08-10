import type { GlobalFilters } from '../data/evaluationsHistorique'
import { SECTEURS } from '../data/evaluationsHistorique'
import { secteurColor } from '../data/palette'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function FilterBar({
  filters,
  onChange,
  types,
  anneeBounds,
}: {
  filters: GlobalFilters
  onChange: (f: GlobalFilters) => void
  types: string[]
  anneeBounds: [number, number]
}) {
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase text-slate-500 w-20">Secteurs</span>
        {SECTEURS.map((s) => {
          const active = filters.secteurs.includes(s)
          return (
            <button
              key={s}
              className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: secteurColor(s), borderColor: secteurColor(s), color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
              }
              onClick={() => onChange({ ...filters, secteurs: toggle(filters.secteurs, s) })}
            >
              {s}
            </button>
          )
        })}
        {filters.secteurs.length > 0 && (
          <button className="text-xs text-slate-400 underline" onClick={() => onChange({ ...filters, secteurs: [] })}>
            Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase text-slate-500 w-20">Types</span>
        {types.map((t) => {
          const active = filters.types.includes(t)
          return (
            <button
              key={t}
              className={active ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
              onClick={() => onChange({ ...filters, types: toggle(filters.types, t) })}
            >
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-slate-500">Années</span>
          <select
            className="input w-24 py-1"
            value={filters.anneeMin}
            onChange={(e) => onChange({ ...filters, anneeMin: Number(e.target.value) })}
          >
            {Array.from({ length: anneeBounds[1] - anneeBounds[0] + 1 }, (_, i) => anneeBounds[0] + i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="text-slate-400">→</span>
          <select
            className="input w-24 py-1"
            value={filters.anneeMax}
            onChange={(e) => onChange({ ...filters, anneeMax: Number(e.target.value) })}
          >
            {Array.from({ length: anneeBounds[1] - anneeBounds[0] + 1 }, (_, i) => anneeBounds[0] + i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-slate-500">Note</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.5}
            className="input w-16 py-1"
            value={filters.noteMin}
            onChange={(e) => onChange({ ...filters, noteMin: Number(e.target.value) })}
          />
          <span className="text-slate-400">→</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.5}
            className="input w-16 py-1"
            value={filters.noteMax}
            onChange={(e) => onChange({ ...filters, noteMax: Number(e.target.value) })}
          />
        </div>

        <input
          className="input flex-1 min-w-[160px] py-1"
          placeholder="Rechercher un fournisseur…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
    </div>
  )
}
