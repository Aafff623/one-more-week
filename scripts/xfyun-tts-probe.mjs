import { readFileSync, writeFileSync } from 'node:fs'
import { createXfyunTtsProvider } from '../shared/xfyun-tts.mjs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

const text = process.argv[2] || '这是讯飞语音合成的连通性测试。'
const aue = process.argv[3] || 'lame'
const voiceArg = process.argv[4] || 'aisjiuxu'
const outPath = process.argv[5] || `C:/Users/Lenovo/AppData/Local/Temp/xfyun-probe-${aue}.bin`

const creds = {
  appId: env.XFYUN_APPID,
  apiKey: env.XFYUN_API_KEY,
  apiSecret: env.XFYUN_API_SECRET,
}
console.log({
  hasAppId: Boolean(creds.appId),
  hasApiKey: Boolean(creds.apiKey),
  hasApiSecret: Boolean(creds.apiSecret),
  aue,
  webSocket: typeof globalThis.WebSocket,
})

const provider = createXfyunTtsProvider({ ...creds, voice: voiceArg, aue })
try {
  const result = await provider.synthesize(text)
  writeFileSync(outPath, result.audio)
  console.log({
    ok: true,
    provider: provider.name,
    contentType: result.contentType,
    bytes: result.audio.length,
    head: [...result.audio.subarray(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(' '),
    outPath,
  })
} catch (error) {
  console.log({ ok: false, error: String(error).slice(0, 300) })
  process.exitCode = 1
}
