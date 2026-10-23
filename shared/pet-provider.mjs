export async function requestPetReply(payload, providers, fallback) {
  for (const provider of providers) {
    try {
      const text = await provider.comment(payload)
      if (typeof text === 'string' && text.trim()) {
        return { text: text.trim(), provider: provider.name }
      }
    } catch (error) {
      console.error(`[pet] ${provider.name} failed:`, String(error).slice(0, 200))
    }
  }
  return { text: fallback(payload), provider: '离线', degraded: true }
}
