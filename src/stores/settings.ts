import { defineStore } from 'pinia'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from '../services/settings'

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...DEFAULT_SETTINGS }),
  actions: {
    load() {
      Object.assign(this, loadSettings())
      this.apply()
    },
    update(patch: Partial<AppSettings>) {
      Object.assign(this, patch)
      saveSettings({
        theme: this.theme,
        textSize: this.textSize,
        reduceMotion: this.reduceMotion,
        highContrast: this.highContrast,
        autoSave: this.autoSave,
        voiceEnabled: this.voiceEnabled,
        petEnabled: this.petEnabled,
      })
      this.apply()
    },
    apply() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.dataset.theme = this.theme
      root.dataset.textSize = this.textSize
      root.dataset.contrast = this.highContrast ? 'high' : 'normal'
      root.classList.toggle('reduce-motion', this.reduceMotion)
    },
  },
})
