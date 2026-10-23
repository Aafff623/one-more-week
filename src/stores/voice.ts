import { defineStore } from 'pinia'
import { identityVoice, type VoiceProfile } from '../game/voice'
import { SpeechEngine, type SpeechState } from '../services/speech'

let engine: SpeechEngine | null = null

interface VoiceStoreLike {
  playing: SpeechState | null
  lastError: string
}

function ensureEngine(store: VoiceStoreLike): SpeechEngine {
  if (!engine) {
    engine = new SpeechEngine()
    engine.subscribe((state) => {
      store.playing = state
    })
  }
  return engine
}

export const useVoiceStore = defineStore('voice', {
  state: () => ({
    playing: null as SpeechState | null,
    lastError: '',
  }),

  getters: {
    isTextPlaying(state) {
      return (token: string) => state.playing?.kind === 'text' && state.playing.token === token
    },
    isSamplePlaying(state) {
      return (identityId: string) =>
        state.playing?.kind === 'sample' && state.playing.identityId === identityId
    },
  },

  actions: {
    stop() {
      ensureEngine(this).stop()
      this.lastError = ''
    },

    async toggleSample(identityId: string): Promise<boolean> {
      const speech = ensureEngine(this)
      if (this.isSamplePlaying(identityId)) {
        speech.stop()
        return false
      }
      this.lastError = ''
      try {
        await speech.playSample(identityId, identityVoice(identityId).sample)
        return true
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '语音暂时不可用。'
        throw error
      }
    },

    async toggleText(text: string, profile: VoiceProfile, token: string): Promise<boolean> {
      const speech = ensureEngine(this)
      if (this.isTextPlaying(token)) {
        speech.stop()
        return false
      }
      this.lastError = ''
      try {
        await speech.speak(text, profile, token)
        return true
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '语音暂时不可用。'
        throw error
      }
    },
  },
})
