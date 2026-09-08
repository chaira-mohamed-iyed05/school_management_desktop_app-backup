import { describe, it, expect } from 'vitest'
import ar from '../../renderer/i18n/locales/ar.json'
import fr from '../../renderer/i18n/locales/fr.json'
import en from '../../renderer/i18n/locales/en.json'

function getDeepKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getDeepKeys(v, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

describe('i18n Locale Key Parity', () => {
  const arKeys = new Set(getDeepKeys(ar))
  const frKeys = new Set(getDeepKeys(fr))
  const enKeys = new Set(getDeepKeys(en))

  it('all ar top-level sections exist in fr and en', () => {
    const arTop = Object.keys(ar)
    const frTop = Object.keys(fr)
    const enTop = Object.keys(en)
    expect(frTop).toEqual(expect.arrayContaining(arTop))
    expect(enTop).toEqual(expect.arrayContaining(arTop))
  })

  it('has critical student keys in all locales', () => {
    const criticalKeys = [
      'students.title',
      'students.add',
      'students.edit',
      'students.overview',
      'students.courseHistory',
      'students.transferBalanceToAnother',
      'students.cancelEnrollment',
    ]
    for (const key of criticalKeys) {
      expect(arKeys.has(key), `Missing ar key: ${key}`).toBe(true)
      expect(frKeys.has(key), `Missing fr key: ${key}`).toBe(true)
      expect(enKeys.has(key), `Missing en key: ${key}`).toBe(true)
    }
  })

  it('has complete key parity across all locales', () => {
    const missingInEn = [...arKeys].filter(k => !enKeys.has(k))
    const missingInFr = [...arKeys].filter(k => !frKeys.has(k))
    const missingInAr = [...enKeys].filter(k => !arKeys.has(k))

    expect(missingInEn, `Keys in AR missing in EN: ${missingInEn.join(', ')}`).toEqual([])
    expect(missingInFr, `Keys in AR missing in FR: ${missingInFr.join(', ')}`).toEqual([])
    expect(missingInAr, `Keys in EN missing in AR: ${missingInAr.join(', ')}`).toEqual([])
  })
})
