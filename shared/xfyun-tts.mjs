import { createHmac } from 'node:crypto'

const HOST = 'tts-api.xfyun.cn'
const PATH = '/v2/tts'
const MAX_FRAME_CHARS = 300

const VOICE_BY_MINIMAX_ID = {
  'male-qn-daxuesheng': 'aisjiuxu',
  'male-qn-qingse': 'aisjiuxu',
  'male-qn-badao': 'aisjiuxu',
  'female-chengshu': 'aisjinger',
  'female-tianmei': 'x4_yezi',
  chunzhen_xuedi: 'x4_xiaoyan',
  cute_boy: 'aisbabyxu',
}

export function xfyunVoiceFor(voiceId) {
  return VOICE_BY_MINIMAX_ID[voiceId] || null
}

function encodeFrame(common, business, text, status) {
  return JSON.stringify({
    common,
    business,
    data: { status, text: Buffer.from(text, 'utf8').toString('base64') },
  })
}

export function buildTtsFrame(text, { appId, voice, aue, speed, volume }) {
  const common = { app_id: appId }
  const business = { aue, vcn: voice, speed, volume }
  const clean = String(text ?? '')
  if (clean.length <= MAX_FRAME_CHARS) {
    return [encodeFrame(common, business, clean, 2)]
  }
  const frames = []
  for (let start = 0; start < clean.length; start += MAX_FRAME_CHARS) {
    const slice = clean.slice(start, start + MAX_FRAME_CHARS)
    frames.push(encodeFrame(common, business, slice, start === 0 ? 0 : 1))
  }
  frames.push(encodeFrame(common, business, '', 2))
  return frames
}

export function buildTtsUrl({ apiKey, apiSecret, host = HOST, now = new Date() }) {
  const date = now.toUTCString()
  // The gateway parses headers=... out of a single comma-separated line; the colon/newline
  // form used by some iFlytek demos makes it reject the request with "enforced header 'host'
  // not used for signature creation".
  const origin = `host: ${host}\ndate: ${date}\nGET ${PATH} HTTP/1.1`
  const signature = createHmac('sha256', apiSecret).update(origin, 'utf8').digest('base64')
  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin, 'utf8').toString('base64')
  const query = [
    `authorization=${encodeURIComponent(authorization)}`,
    `host=${encodeURIComponent(host)}`,
    `date=${encodeURIComponent(date)}`,
    `signature=${encodeURIComponent(signature)}`,
  ].join('&')
  return `wss://${host}${PATH}?${query}`
}

export function looksLikeMp3(bytes) {
  if (bytes.length < 4) return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
}

export function encodeWav(pcm, { sampleRate = 16000, channels = 1, bitsPerSample = 16 } = {}) {
  const blockAlign = (channels * bitsPerSample) / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * blockAlign, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function collectAudio(frame, chunks) {
  const audio = frame?.data?.audio ?? frame?.data?.result?.audio
  if (typeof audio === 'string' && audio) {
    chunks.push(Buffer.from(audio, 'base64'))
    return
  }
  const status = frame?.data?.status
  if (frame?.code && frame.code !== 0) {
    throw new Error(`xfyun ${frame.code}: ${String(frame.message || '').slice(0, 120)}`)
  }
  if (status === 2) return
  throw new Error(`xfyun returned no audio (status ${status})`)
}

export function createXfyunTtsProvider(options) {
  const {
    appId,
    apiKey,
    apiSecret,
    voice,
    aue = 'lame',
    speed = 50,
    volume = 60,
    timeout = 20_000,
    webSocketImpl = globalThis.WebSocket,
    urlFactory,
  } = options

  return {
    name: '讯飞',
    async synthesize(text) {
      if (!appId || !apiKey || !apiSecret || !voice) throw new Error('讯飞语音合成未配置')
      if (typeof webSocketImpl !== 'function') throw new Error('运行环境没有 WebSocket')
      const frames = buildTtsFrame(text, { appId, voice, aue, speed, volume })
      const url = urlFactory ? urlFactory() : buildTtsUrl({ apiKey, apiSecret })

      return await new Promise((resolve, reject) => {
        const chunks = []
        let settled = false
        let socket
        const finish = (error, value) => {
          if (settled) return
          settled = true
          clearTimeout(guard)
          try {
            socket?.close()
          } catch {
            // The socket is already gone.
          }
          if (error) reject(error)
          else resolve(value)
        }
        const guard = setTimeout(() => finish(new Error('讯飞语音合成超时')), timeout)

        socket = new webSocketImpl(url)
        socket.addEventListener('error', () => finish(new Error('讯飞语音合成连接失败')))
        socket.addEventListener('close', () => {
          if (!settled) finish(new Error('讯飞语音合成连接中断'))
        })
        socket.addEventListener('open', () => {
          for (const frame of frames) socket.send(frame)
        })
        socket.addEventListener('message', (event) => {
          let parsed
          try {
            parsed = JSON.parse(String(event.data))
          } catch {
            finish(new Error('讯飞语音合成返回了无法解析的内容'))
            return
          }
          try {
            collectAudio(parsed, chunks)
          } catch (error) {
            finish(error)
            return
          }
          if (parsed?.data?.status === 2) {
            const audio = Buffer.concat(chunks)
            if (!audio.length) {
              finish(new Error('讯飞语音合成没有返回音频'))
              return
            }
            finish(null, {
              audio,
              contentType: looksLikeMp3(audio) ? 'audio/mpeg' : 'audio/wav',
            })
          }
        })
      })
    },
  }
}
