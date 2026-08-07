export interface BadChar {
  index: number
  codePoint: number
  hex: string
}

export function findNonLatin1Chars(value: string): BadChar[] {
  const bad: BadChar[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code > 255) {
      bad.push({ index: i, codePoint: code, hex: '0x' + code.toString(16).toUpperCase() })
    }
  }
  return bad
}

export interface EnvDiagnostic {
  name: string
  length: number
  firstChars: string
  lastChars: string
  badChars: BadChar[]
}

export function diagnoseEnvVar(name: string, value: string | undefined): EnvDiagnostic {
  const v = value ?? ''
  return {
    name,
    length: v.length,
    firstChars: JSON.stringify(v.slice(0, 6)),
    lastChars: JSON.stringify(v.slice(-6)),
    badChars: findNonLatin1Chars(v),
  }
}
