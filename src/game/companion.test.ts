import { describe, expect, it, vi } from 'vitest'
import { requestPetComment } from './companion'
import { localPetComment, type PetPayload } from './pet'

const payload: PetPayload = {
  day: 1,
  period: 'morning',
  eventTitle: '闹钟响过第三次',
  choiceTitle: '再睡二十分钟',
  tone: 'rest',
  toneStreak: 1,
  stats: { energy: 50, mood: 60, growth: 40, relationships: 30, money: 100 },
  tendencies: { care: 0, focus: 0, rest: 1, connect: 0, risk: 0 },
  lowestStat: 'relationships',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.fn(handler) as unknown as typeof fetch
}

describe('companion request', () => {
  it('returns the provider reply', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse({ text: '继续观察。', provider: 'MiniMax' }))
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toEqual({
      text: '继续观察。',
      provider: 'MiniMax',
    })
  })

  it('uses the fallback the server already sent', async () => {
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({ error: 'AI 暂时不可用', fallback: '服务端兜底' }, 503),
    )
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toEqual({
      text: '服务端兜底',
      provider: '离线',
    })
  })

  it('falls back to the shared offline line on a network error', async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new Error('offline')
    })
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toEqual({
      text: localPetComment(payload),
      provider: '离线',
    })
  })

  it('returns null when the request is aborted', async () => {
    const fetchImpl = fakeFetch(async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    })
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toBeNull()
  })

  it('falls back when the API returns no text', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse({ provider: 'AI' }))
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toEqual({
      text: localPetComment(payload),
      provider: '离线',
    })
  })

  it('falls back when the response is not valid JSON', async () => {
    const fetchImpl = fakeFetch(async () => new Response('not json', { status: 200 }))
    await expect(requestPetComment(payload, { fetchImpl })).resolves.toEqual({
      text: localPetComment(payload),
      provider: '离线',
    })
  })

  it('sends the payload to the pet endpoint', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        choiceTitle: payload.choiceTitle,
        tone: payload.tone,
      })
      return jsonResponse({ text: '好。', provider: 'AI' })
    }) as unknown as typeof fetch
    await requestPetComment(payload, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith('/api/pet', expect.objectContaining({ method: 'POST' }))
  })
})
