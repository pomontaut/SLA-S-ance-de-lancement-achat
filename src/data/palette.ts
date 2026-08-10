export const SECTEUR_COLORS: Record<string, string> = {
  GC: '#4f46e5',
  'BAT GE': '#0d9488',
  'BAT VD': '#d97706',
  'EG GE/VD': '#be185d',
  'EG VS': '#7c3aed',
  Général: '#64748b',
}

export function secteurColor(secteur: string): string {
  return SECTEUR_COLORS[secteur] ?? '#64748b'
}

export const STATUS = {
  good: '#16a34a',
  warning: '#d97706',
  critical: '#dc2626',
  neutral: '#4f46e5',
}

export function noteColor(note: number): string {
  if (note >= 3.5) return STATUS.good
  if (note < 2) return STATUS.critical
  if (note < 3) return STATUS.warning
  return '#94a3b8'
}
