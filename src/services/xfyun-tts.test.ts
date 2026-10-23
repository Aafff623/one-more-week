import { describe, expect, it, vi } from 'vitest'
import {
  buildTtsFrame,
  buildTtsUrl,
  createXfyunTtsProvider,
  encodeWav,
  looksLikeMp3,
  xfyunVoiceFor,
} from '../../shared/xfyun-tts.mjs'
import { IDENTITY_VOICES, PET_VOICE } from '../game/voice'

const CREDENTIALS = { apiKey: 'apikeyTEST0000000000000000000000', apiSecret: 'APISecretValue123' }

const toBase64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
const textFromBase64 = (value: string) => new TextDecoder().decode(fromBase64(value))
const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes)

class FakeSocket {
  static instances: FakeSocket[] = []
  sent: string[] = []
  listeners = new Map<string, ((event: unknown) => void)[]>()
  closed = false
  binaryType = 'blob'

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(handler)
    this.listeners.set(type, list)
  }

  emit(type: string, event: Record<string, unknown> = {}) {
    for (const handler of this.listeners.get(type) ?? []) handler(event)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.closed = true
  }

  openAndRespond(frames: Record<string, unknown>[]) {
    this.emit('open')
    for (const frame of frames) this.emit('message', { data: JSON.stringify(frame) })
  }
}

function audioFrame(status: number, bytes: number[]) {
  return { code: 0, message: 'success', data: { status, audio: toBase64(bytes) } }
}

describe('讯飞语音合成鉴权', () => {
  it('signs the request line without a trailing newline', () => {
    const url = buildTtsUrl({ ...CREDENTIALS, now: new Date('2026-10-23T11:20:02Z') })
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))

    // Reference value computed with `openssl dgst -sha256 -hmac`, not by this module.
    expect(url.startsWith('wss://tts-api.xfyun.cn/v2/tts?')).toBe(true)
    expect(params.get('signature')).toBe('eQFFXRAa3wFb66EPCpHInG0ebcCvVlNJz929wyToYAw=')
    expect(params.get('date')).toBe('Fri, 23 Oct 2026 11:20:02 GMT')
    expect(params.get('host')).toBe('tts-api.xfyun.cn')
  })

  it('declares the enforced headers on one comma-separated line', () => {
    const url = buildTtsUrl({ ...CREDENTIALS, now: new Date('2026-10-23T11:20:02Z') })
    const authorization = atob(new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('authorization')!)

    // The colon/newline form some demos show makes the gateway answer 401 with
    // "enforced header 'host' not used for signature creation".
    expect(authorization).toBe(
      `api_key="${CREDENTIALS.apiKey}", algorithm="hmac-sha256", ` +
        `headers="host date request-line", signature="eQFFXRAa3wFb66EPCpHInG0ebcCvVlNJz929wyToYAw="`,
    )
  })

  it('requires all three credentials before connecting', async () => {
    const provider = createXfyunTtsProvider({
      apiKey: 'apikeyTEST0000000000000000000000',
      apiSecret: '',
      appId: '4976ee45',
      voice: 'aisjiuxu',
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    })
    await expect(provider.synthesize('a')).rejects.toThrow('未配置')
  })
})

describe('讯飞语音合成请求帧', () => {
  it('sends short text as one final frame', () => {
    const frames = buildTtsFrame('今天也要吃饭。', {
      appId: '4976ee45',
      voice: 'aisjiuxu',
      aue: 'lame',
      speed: 50,
      volume: 60,
    })

    expect(frames).toHaveLength(1)
    const parsed = JSON.parse(frames[0])
    expect(Object.keys(parsed).sort()).toEqual(['business', 'common', 'data'])
    expect(parsed.common).toEqual({ app_id: '4976ee45' })
    expect(parsed.business).toEqual({ aue: 'lame', vcn: 'aisjiuxu', speed: 50, volume: 60 })
    expect(parsed.data.status).toBe(2)
    expect(textFromBase64(parsed.data.text)).toBe('今天也要吃饭。')
  })

  it('splits long text into first / middle / empty final frames', () => {
    const text = '字'.repeat(700)
    const frames = buildTtsFrame(text, {
      appId: 'a',
      voice: 'aisjiuxu',
      aue: 'lame',
      speed: 50,
      volume: 60,
    }).map((frame) => JSON.parse(frame))

    expect(frames.map((frame) => frame.data.status)).toEqual([0, 1, 1, 2])
    expect(frames[3].data.text).toBe('')
    const decoded = frames
      .slice(0, 3)
      .map((frame) => textFromBase64(frame.data.text))
      .join('')
    expect(decoded).toBe(text)
  })
})

describe('音色映射', () => {
  it('covers every voice the client can request', () => {
    const clientVoiceIds = [...Object.values(IDENTITY_VOICES), PET_VOICE].map((voice) => voice.id)
    for (const id of clientVoiceIds) {
      expect(xfyunVoiceFor(id), `${id} has no 讯飞 fallback voice`).toBeTruthy()
    }
  })

  it('returns null for unknown voices so the caller can skip the provider', () => {
    expect(xfyunVoiceFor('no-such-voice')).toBeNull()
  })
})

describe('音频格式', () => {
  it('detects mp3 by id3 tag or frame sync', () => {
    expect(looksLikeMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe(true)
    expect(looksLikeMp3(new Uint8Array([0xff, 0xf3, 0x68, 0xc4]))).toBe(true)
    expect(looksLikeMp3(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false)
  })

  it('wraps pcm in a wav header', () => {
    const wav = encodeWav(new Uint8Array([1, 2, 3, 4]), { sampleRate: 16000 })
    expect(ascii(wav.subarray(0, 4))).toBe('RIFF')
    expect(ascii(wav.subarray(8, 12))).toBe('WAVE')
    expect(wav.length).toBe(48)
    expect([...wav.subarray(4, 8)]).toEqual([40, 0, 0, 0])
  })
})

describe('讯飞语音合成调用', () => {
  const baseOptions = { ...CREDENTIALS, appId: '4976ee45', voice: 'aisjiuxu' }

  it('assembles streamed audio and reports the container', async () => {
    FakeSocket.instances = []
    const provider = createXfyunTtsProvider({
      ...baseOptions,
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    })
    const promise = provider.synthesize('测试')
    FakeSocket.instances[0].openAndRespond([audioFrame(1, [0xff, 0xf3, 0x10]), audioFrame(2, [0x20, 0x30])])

    await expect(promise).resolves.toEqual({
      audio: expect.any(Uint8Array),
      contentType: 'audio/mpeg',
    })
    expect([...(await promise).audio]).toEqual([0xff, 0xf3, 0x10, 0x20, 0x30])
    expect(FakeSocket.instances[0].sent).toHaveLength(1)
  })

  it('falls back to wav when the gateway returns raw pcm', async () => {
    FakeSocket.instances = []
    const provider = createXfyunTtsProvider({
      ...baseOptions,
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    })
    const promise = provider.synthesize('测试')
    FakeSocket.instances[0].openAndRespond([audioFrame(2, [0x01, 0x02, 0x03, 0x04])])

    expect((await promise).contentType).toBe('audio/wav')
  })

  it('rejects with the gateway error code', async () => {
    FakeSocket.instances = []
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider = createXfyunTtsProvider({
      ...baseOptions,
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    })
    const promise = provider.synthesize('测试')
    FakeSocket.instances[0].openAndRespond([
      { code: 10163, message: "param validate error:'$.business.spe' unknown field", data: { status: 0 } },
    ])

    await expect(promise).rejects.toThrow(/10163/)
    spy.mockRestore()
  })

  it('refuses to run without credentials or a WebSocket implementation', async () => {
    await expect(createXfyunTtsProvider({ ...baseOptions, apiKey: '' }).synthesize('a')).rejects.toThrow('未配置')
    await expect(
      createXfyunTtsProvider({ ...baseOptions, webSocketImpl: null as never }).synthesize('a'),
    ).rejects.toThrow('WebSocket')
  })
})
