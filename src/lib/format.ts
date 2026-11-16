// Format suisse des nombres : apostrophe pour séparer les milliers (137'782'841), virgule décimale.
// Le navigateur sépare les milliers de « fr-CH » par une espace fine insécable ; on la remplace par « ' »
// pour tous les appels `toLocaleString('fr-CH', …)` de l'app (importé une seule fois, dans main.tsx).

const original = Number.prototype.toLocaleString

Number.prototype.toLocaleString = function (this: number, locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions): string {
  const s = original.call(this, locales, options)
  return locales === 'fr-CH' ? s.replace(/[  ]/g, "'") : s
}

export {}
