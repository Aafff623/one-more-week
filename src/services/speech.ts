export type SpeechState =
  | { kind: 'sample'; identityId: string }
  | { kind: 'text'; token: string }

export interface SpeechProfile {
  id: string
}

export interface SpeechEngineOptions {
  fetchImpl?: typeof fetch
  createAudio?: (url: string) => HTMLAudioElement
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
  cacheLimit?: number
}

type Listener = (state: SpeechState | null) => void

export class SpeechEngine {
  private readonly cache = new Map<string, string>()
  private readonly listeners = new Set<Listener>()
  private readonly fetchImpl: typeof fetch
  private readonly createAudio: (url: string) => HTMLAudioElement
  private readonly createObjectUrl: (blob: Blob) => string
  private readonly revokeObjectUrl: (url: string) => void
  private readonly cacheLimit: number
  private audio: HTMLAudioElement | null = null
  private state: SpeechState | null = null

  constructor(options: SpeechEngineOptions = {}) {
    this.fetchImpl =
      options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
    this.createAudio = options.createAudio ?? ((url) => new Audio(url))
    this.createObjectUrl = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob))
    this.revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url))
    this.cacheLimit = options.cacheLimit ?? 24
  }

  get current(): SpeechState | null {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
    if (this.state) {
      this.state = null
      this.emit()
    }
  }

  async playSample(identityId: string, url: string): Promise<void> {
    await this.play(url, { kind: 'sample', identityId })
  }

  async speak(text: string, profile: SpeechProfile, token: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    const cacheKey = `${profile.id}|${clean}`
    let url = this.cache.get(cacheKey)
    if (!url) {
      const response = await this.fetchImpl('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.slice(0, 800), voiceId: profile.id }),
      })
      if (!response.ok) {
        let message = '语音服务暂时不可用。'
        try {
          const data = await response.json()
          if (data?.error) message = String(data.error)
        } catch {
          // Keep the friendly fallback.
        }
        throw new Error(message)
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('语音服务返回了空音频。')
      url = this.createObjectUrl(blob)
      this.cache.set(cacheKey, url)
      this.trimCache()
    }
    await this.play(url, { kind: 'text', token })
  }

  dispose(): void {
    this.stop()
    for (const url of this.cache.values()) this.revokeObjectUrl(url)
    this.cache.clear()
    this.listeners.clear()
  }

  private async play(url: string, state: SpeechState): Promise<void> {
    this.stop()
    const element = this.createAudio(url)
    this.audio = element
    this.state = state
    this.emit()
    element.onended = () => {
      if (this.audio === element) {
        this.audio = null
        this.state = null
        this.emit()
      }
    }
    element.onerror = () => {
      if (this.audio === element) {
        this.audio = null
        this.state = null
        this.emit()
      }
    }
    try {
      await element.play()
    } catch {
      this.stop()
      throw new Error('浏览器没有允许播放，请再点一次。')
    }
  }

  private trimCache(): void {
    while (this.cache.size > this.cacheLimit) {
      const first = this.cache.keys().next().value
      if (!first) break
      const url = this.cache.get(first)
      this.cache.delete(first)
      if (url) this.revokeObjectUrl(url)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }
}
