export interface TtsAudio {
  audio: Uint8Array
  contentType: string
  provider: string
}

export interface TtsProvider {
  name: string
  synthesize(text: string): Promise<{ audio: Uint8Array; contentType?: string } | null>
}

export function requestAudio(text: string, providers: TtsProvider[]): Promise<TtsAudio | null>
