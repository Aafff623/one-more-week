import type { KeyValueStorage } from './SaveRepository'
import { getDefaultStorage } from './SaveRepository'

export type Theme = 'light' | 'dark'
export type TextSize = 'small' | 'normal' | 'large'

export interface AppSettings {
  theme: Theme
  textSize: TextSize
  reduceMotion: boolean
  highContrast: boolean
  autoSave: boolean
  voiceEnabled: boolean
  petEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  textSize: 'normal',
  reduceMotion: false,
  highContrast: false,
  autoSave: true,
  voiceEnabled: false,
  petEnabled: true,
}

const SETTINGS_KEY = 'omw:settings'

export function loadSettings(storage: KeyValueStorage | null = getDefaultStorage()): AppSettings {
  if (!storage) return { ...DEFAULT_SETTINGS }
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      textSize:
        parsed.textSize === 'large' || parsed.textSize === 'small'
          ? parsed.textSize
          : 'normal',
      reduceMotion: Boolean(parsed.reduceMotion),
      highContrast: Boolean(parsed.highContrast),
      autoSave: parsed.autoSave !== false,
      voiceEnabled: parsed.voiceEnabled === true,
      petEnabled: parsed.petEnabled !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(
  settings: AppSettings,
  storage: KeyValueStorage | null = getDefaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Settings are a preference; a full storage quota should not break the game.
  }
}
