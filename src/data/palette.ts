export const SECTEUR_COLORS: Record<string, string> = {
  GC: '#4f46e5',
  'BAT GE': '#0d9488',
  'BAT VD': '#d97706',
  'EG GE/VD': '#be185d',
  'EG VS': '#7c3aed',
  Général: '#64748b',
  // Entités de l'analyse de dépense
  'BAT GE TRANSFO RENO': '#14b8a6',
  'BAT VD TRANSFO RENO': '#f59e0b',
  'EG GE': '#be185d',
  'EG VD': '#e11d48',
  DG: '#0ea5e9',
  DEPOT: '#84cc16',
  AUTRES: '#94a3b8',
}

/** Libellé d'affichage d'une entité (les clés des données restent DG / DEPOT). */
export function entiteLabel(entite: string): string {
  if (entite === 'DG') return 'Direction Générale'
  if (entite === 'DEPOT') return 'Dépôt'
  if (entite === 'AUTRES') return 'Autres'
  return entite
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
