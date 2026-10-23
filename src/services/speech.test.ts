import { describe, expect, it, vi } from 'vitest'
import { SpeechEngine, type SpeechState } from './speech'

class FakeAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  paused = false
  readonly src: string
  play = vi.fn(async () => {})
  pause = vi.fn(() => {
    this.paused = true
  })

  constructor(src: string) {
    this.src = src
  }
}

function audioResponse(): Response {
  return new Response(new Blob(['audio'], { type: 'audio/mpeg' }), { status: 200 })
}

function makeEngine(options: { cacheLimit?: number; fetchImpl?: typeof fetch; playRejects?: boolean } = {}) {
  const audios: FakeAudio[] = []
  const created: string[] = []
  const revoked: string[] = []
  let sequence = 0
  const fetchImpl =
    options.fetchImpl ??
    (vi.fn(async () => audioResponse()) as unknown as typeof fetch)
  const engine = new SpeechEngine({
    fetchImpl,
    cacheLimit: options.cacheLimit,
    createAudio: (url) => {
      const audio = new FakeAudio(url)
      if (options.playRejects) {
        audio.play = vi.fn(async () => {
          throw new Error('blocked')
        })
      }
      audios.push(audio)
      return audio as unknown as HTMLAudioElement
    },
    createObjectUrl: () => {
      const url = `blob:test-${++sequence}`
      created.push(url)
      return url
    },
    revokeObjectUrl: (url) => {
      revoked.push(url)
    },
  })
  return { engine, audios, created, revoked, fetchImpl }
}

describe('speech engine', () => {
  it('speaks through the TTS endpoint and exposes the playing token', async () => {
    const { engine, audios, fetchImpl } = makeEngine()
    const states: Array<SpeechState | null> = []
    engine.subscribe((state) => states.push(state))

    await engine.speak('你好，这一周。', { id: 'voice-a' }, 'scene')

    expect(fetchImpl).toHaveBeenCalledWith('/api/tts', expect.objectContaining({ method: 'POST' }))
    const init = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0][1]
    expect(JSON.parse(String(init.body))).toEqual({
      text: '你好，这一周。',
      voiceId: 'voice-a',
    })
    expect(engine.current).toEqual({ kind: 'text', token: 'scene' })
    expect(audios[0].src).toBe('blob:test-1')
    expect(audios[0].play).toHaveBeenCalled()
    expect(states.at(-1)).toEqual({ kind: 'text', token: 'scene' })
  })

  it('reuses the cached audio for the same text and voice', async () => {
    const { engine, audios, fetchImpl } = makeEngine()

    await engine.speak('同一句话。', { id: 'voice-a' }, 'scene')
    await engine.speak('同一句话。', { id: 'voice-a' }, 'pet')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(audios).toHaveLength(2)
    expect(engine.current).toEqual({ kind: 'text', token: 'pet' })
  })

  it('plays a static sample and stops it by identity', async () => {
    const { engine, audios } = makeEngine()
    await engine.playSample('student', '/audio/voices/student.mp3')

    expect(engine.current).toEqual({ kind: 'sample', identityId: 'student' })
    expect(audios[0].src).toBe('/audio/voices/student.mp3')

    engine.stop()
    expect(engine.current).toBeNull()
    expect(audios[0].pause).toHaveBeenCalled()
  })

  it('clears state and rethrows when the browser blocks playback', async () => {
    const { engine } = makeEngine({ playRejects: true })
    await expect(engine.speak('试一下。', { id: 'voice-a' }, 'scene')).rejects.toThrow(
      '浏览器没有允许播放',
    )
    expect(engine.current).toBeNull()
  })

  it('rejects with the server error and keeps no state', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: '语音服务暂时不可用。' }), { status: 503 }),
    ) as unknown as typeof fetch
    const { engine } = makeEngine({ fetchImpl })

    await expect(engine.speak('试一下。', { id: 'voice-a' }, 'scene')).rejects.toThrow(
      '语音服务暂时不可用。',
    )
    expect(engine.current).toBeNull()
  })

  it('does nothing for empty text', async () => {
    const { engine, fetchImpl } = makeEngine()
    await engine.speak('   ', { id: 'voice-a' }, 'scene')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('calls the default global fetch without an instance receiver', async () => {
    const original = globalThis.fetch
    const fake = vi.fn(function (this: unknown) {
      if (this && this !== globalThis) throw new Error('Illegal invocation')
      return audioResponse()
    })
    globalThis.fetch = fake as unknown as typeof fetch
    try {
      const engine = new SpeechEngine({
        createAudio: (url) => new FakeAudio(url) as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:default-fetch',
        revokeObjectUrl: () => {},
      })
      await engine.speak('绑定测试。', { id: 'voice-a' }, 'scene')
      expect(fake).toHaveBeenCalled()
    } finally {
      globalThis.fetch = original
    }
  })

  it('revokes old object URLs when the cache trims and on dispose', async () => {
    const { engine, created, revoked } = makeEngine({ cacheLimit: 1 })
    await engine.speak('第一句。', { id: 'voice-a' }, 'scene')
    await engine.speak('第二句。', { id: 'voice-a' }, 'scene')

    expect(created).toHaveLength(2)
    expect(revoked).toEqual([created[0]])

    engine.dispose()
    expect(revoked).toContain(created[1])
  })
})
