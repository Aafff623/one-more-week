import { describe, expect, it } from 'vitest'
import { IDENTITY_VOICES, PET_VOICE, identityVoice } from './voice'

describe('voice casting', () => {
  it('gives each identity a distinct MiniMax voice and sample', () => {
    const profiles = Object.values(IDENTITY_VOICES)
    expect(new Set(profiles.map((profile) => profile.id)).size).toBe(profiles.length)
    for (const profile of profiles) {
      expect(profile.sample.startsWith('/audio/voices/')).toBe(true)
    }
  })

  it('falls back to the student voice for an unknown identity', () => {
    expect(identityVoice('unknown').id).toBe(IDENTITY_VOICES.student.id)
    expect(PET_VOICE.id).toBe('cute_boy')
  })
})
