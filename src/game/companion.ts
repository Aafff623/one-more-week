import { localPetComment, type PetPayload } from './pet'

export interface CompanionReply {
  text: string
  provider: string
}

export interface CompanionOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

function offlineReply(payload: PetPayload): CompanionReply {
  return { text: localPetComment(payload), provider: '离线' }
}

export async function requestPetComment(
  payload: PetPayload,
  options: CompanionOptions = {},
): Promise<CompanionReply | null> {
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const response = await fetchImpl('/api/pet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
    const data = await response.json().catch(() => null)
    if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
      return {
        text: data.text,
        provider: typeof data.provider === 'string' && data.provider ? data.provider : 'AI',
      }
    }
    if (typeof data?.fallback === 'string' && data.fallback.trim()) {
      return { text: data.fallback, provider: '离线' }
    }
    return offlineReply(payload)
  } catch (error) {
    if ((error as Error | undefined)?.name === 'AbortError') return null
    return offlineReply(payload)
  }
}
