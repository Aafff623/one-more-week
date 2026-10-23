import { describe, expect, it, vi } from 'vitest'
import { requestPetReply } from '../../shared/pet-provider.mjs'

const payload = { tone: 'focus' }
const fallback = () => '离线的一句'

describe('pet provider chain', () => {
  it('tries providers in order and returns the first usable reply', async () => {
    const calls: string[] = []
    const providers = [
      {
        name: 'first',
        comment: () => {
          calls.push('first')
          throw new Error('down')
        },
      },
      {
        name: 'second',
        comment: () => {
          calls.push('second')
          return '第二家的回复'
        },
      },
    ]

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(requestPetReply(payload, providers, fallback)).resolves.toEqual({
      text: '第二家的回复',
      provider: 'second',
    })
    expect(calls).toEqual(['first', 'second'])
    spy.mockRestore()
  })

  it('skips empty replies and degrades to the shared fallback', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await requestPetReply(
      payload,
      [
        { name: 'empty', comment: () => '   ' },
        { name: 'broken', comment: () => Promise.reject(new Error('timeout')) },
      ],
      fallback,
    )
    expect(result).toEqual({ text: '离线的一句', provider: '离线', degraded: true })
    spy.mockRestore()
  })

  it('stops after the first provider succeeds', async () => {
    const second = vi.fn(() => 'second')
    const result = await requestPetReply(
      payload,
      [
        { name: 'primary', comment: () => 'primary reply' },
        { name: 'secondary', comment: second },
      ],
      fallback,
    )
    expect(result).toEqual({ text: 'primary reply', provider: 'primary' })
    expect(second).not.toHaveBeenCalled()
  })
})
