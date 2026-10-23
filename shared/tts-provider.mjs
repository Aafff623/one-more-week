export async function requestAudio(text, providers) {
  for (const provider of providers) {
    try {
      const result = await provider.synthesize(text)
      const audio = result?.audio
      if (audio && audio.length) {
        return { audio, contentType: result.contentType || 'audio/mpeg', provider: provider.name }
      }
      console.error(`[tts] ${provider.name} returned no audio`)
    } catch (error) {
      console.error(`[tts] ${provider.name} failed:`, String(error).slice(0, 200))
    }
  }
  return null
}
