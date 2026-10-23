export interface XfyunTtsCredentials {
  appId: string
  apiKey: string
  apiSecret: string
}

export interface XfyunUrlInput {
  apiKey: string
  apiSecret: string
  host?: string
  now?: Date
}

export interface XfyunTtsOptions extends Partial<XfyunTtsCredentials> {
  voice: string
  aue?: string
  speed?: number
  volume?: number
  timeout?: number
  webSocketImpl?: typeof WebSocket
  urlFactory?: () => string
}

export interface XfyunSynthesisResult {
  audio: Uint8Array
  contentType: string
}

export interface XfyunVoiceFrameInput {
  appId: string
  voice: string
  aue: string
  speed: number
  volume: number
}

export function xfyunVoiceFor(voiceId: string): string | null
export function buildTtsFrame(text: string, input: XfyunVoiceFrameInput): string[]
export function buildTtsUrl(input: XfyunUrlInput): string
export function looksLikeMp3(bytes: Uint8Array): boolean
export function encodeWav(
  pcm: Uint8Array,
  options?: { sampleRate?: number; channels?: number; bitsPerSample?: number },
): Uint8Array
export function createXfyunTtsProvider(
  options: XfyunTtsOptions,
): { name: string; synthesize(text: string): Promise<XfyunSynthesisResult> }
