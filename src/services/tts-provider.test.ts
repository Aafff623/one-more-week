import { describe, expect, it, vi } from 'vitest'
import { requestAudio } from '../../shared/tts-provider.mjs'

const bytes = (values: number[]) => new Uint8Array(values)

describe('语音合成 provider 链', () => {
  it('returns the first provider that produces audio', async () => {
    const calls: string[] = []
    const providers = [
      {
        name: 'first',
        synthesize: () => {
          calls.push('first')
          throw new Error('down')
        },
      },
      {
        name: 'second',
        synthesize: () => {
          calls.push('second')
          return Promise.resolve({ audio: bytes([1, 2, 3]), contentType: 'audio/wav' })
        },
      },
      {
        name: 'third',
        synthesize: () => {
          calls.push('third')
          return Promise.resolve({ audio: bytes([9]) })
        },
      },
    ]
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await requestAudio('文本', providers as never)
    expect(calls).toEqual(['first', 'second'])
    expect(result).toEqual({ audio: expect.any(Uint8Array), contentType: 'audio/wav', provider: 'second' })
    spy.mockRestore()
  })

  it('skips a provider that answers without audio', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const providers = [
      { name: 'empty', synthesize: () => Promise.resolve({ audio: bytes([]) }) },
      { name: 'null', synthesize: () => Promise.resolve(null) },
      { name: 'ok', synthesize: () => Promise.resolve({ audio: bytes([7, 7]) }) },
    ]

    expect(await requestAudio('文本', providers as never)).toEqual({
      audio: expect.any(Uint8Array),
      contentType: 'audio/mpeg',
      provider: 'ok',
    })
    spy.mockRestore()
  })

  it('returns null when every provider fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const providers = [{ name: 'only', synthesize: () => Promise.reject(new Error('boom')) }]

    expect(await requestAudio('文本', providers as never)).toBeNull()
    spy.mockRestore()
  })

  it('returns null with no providers configured', async () => {
    expect(await requestAudio('文本', [])).toBeNull()
  })
})
