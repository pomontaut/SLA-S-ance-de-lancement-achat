// Export Excel (.xlsx) des tableaux affichés. La bibliothèque est chargée à la demande pour ne pas
// alourdir le chargement initial de l'app.

export interface FeuilleExcel {
  nom: string
  /** Première ligne = en-têtes. Nombres laissés en nombres (Excel peut les additionner). */
  lignes: (string | number | null)[][]
}

export async function exportXlsx(fichier: string, feuilles: FeuilleExcel[]): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const f of feuilles) {
    const ws = XLSX.utils.aoa_to_sheet(f.lignes)
    const largeurs = f.lignes[0]?.map((_, c) => ({
      wch: Math.min(60, Math.max(10, ...f.lignes.map((l) => String(l[c] ?? '').length + 2))),
    }))
    if (largeurs) ws['!cols'] = largeurs
    // Excel limite les noms de feuille à 31 caractères et interdit : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, f.nom.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Feuille')
  }
  XLSX.writeFile(wb, fichier.endsWith('.xlsx') ? fichier : `${fichier}.xlsx`)
}

export function dateFichier(): string {
  return new Date().toISOString().slice(0, 10)
}
