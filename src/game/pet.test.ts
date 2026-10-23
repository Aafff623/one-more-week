import { describe, expect, it } from 'vitest'
import { localPetComment, lowestStat } from './pet'

describe('pet personality fallback', () => {
  it('calls out a repeated tendency', () => {
    expect(localPetComment({ tone: 'focus', toneStreak: 3 })).toContain('专注')
    expect(localPetComment({ tone: 'care', toneStreak: 3 })).toContain('照顾')
  })

  it('picks the lowest stat safely', () => {
    expect(
      lowestStat({ energy: 70, mood: 20, growth: 50, relationships: 60 }),
    ).toBe('mood')
    expect(lowestStat({ energy: 1, mood: 99, growth: 99, relationships: 99 })).toBe('energy')
  })

  it('always returns a short observation', () => {
    const text = localPetComment({ tone: 'risk', toneStreak: 1, lowestStat: 'relationships' })
    expect(text.length).toBeGreaterThan(0)
    expect(text.length).toBeLessThanOrEqual(80)
  })
})
