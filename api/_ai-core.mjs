import { localPetComment } from '../shared/pet-fallback.mjs'
import { requestPetReply } from '../shared/pet-provider.mjs'
import { requestAudio } from '../shared/tts-provider.mjs'
import { createXfyunTtsProvider, xfyunVoiceFor } from '../shared/xfyun-tts.mjs'

const MINIMAX_BASE = () => (process.env.MINIMAX_BASE_URL || 'https://api.minimax.cn/v1').replace(/\/$/, '')
const STEPFUN_BASE = () => (process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1').replace(/\/$/, '')
const MINIMAX_MODEL = () => process.env.MINIMAX_MODEL || 'MiniMax-M3.1-Flash'
const STEPFUN_MODEL = () => process.env.STEPFUN_MODEL || 'step-5-preview'
const MINIMAX_TTS_MODEL = () => process.env.MINIMAX_TTS_MODEL || 'speech-2.8-hd'
const XFYUN_MAAS_BASE = () =>
  (process.env.XFYUN_MAAS_BASE_URL || 'https://maas-api.cn-huabei-1.xf-yun.com/v2').replace(/\/$/, '')
const XFYUN_MAAS_MODEL = () => process.env.XFYUN_MAAS_MODEL || 'spark-x2.6'

const VOICE_IDS = new Set([
  'male-qn-daxuesheng',
  'female-chengshu',
  'male-qn-qingse',
  'chunzhen_xuedi',
  'cute_boy',
  'female-tianmei',
  'male-qn-badao',
])

export const PET_SYSTEM_PROMPT = `你是「小鲸」，一只住在玩家手机角落里的 Q 版座头鲸观察员。
你不替玩家做决定，不把生活分成成功或失败，也不做心理诊断、命运预测或道德说教。
你观察玩家这一周反复出现的选择倾向、精力与心情的变化，用一到两句话给出具体、略带毒舌但善意的观察或提醒。
可以点破矛盾，可以轻轻吐槽，但不要说教，不要列建议清单，不要复述具体数值，不要编造玩家没有做过的选择。
每次只回一句话，不超过 70 个汉字。用自然、口语化的中文。`

function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > limit) {
        reject(new Error('请求内容过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('请求不是有效 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function sendText(res, status, text) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(text)
}

async function postJson(url, key, body, timeout = 45_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`upstream ${response.status}: ${text.slice(0, 180)}`)
    }
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

async function callChat({ base, key, model, messages, maxTokens = 220, temperature = 0.8, extra = {} }) {
  const data = await postJson(`${base}/chat/completions`, key, {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    ...extra,
  })
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || 'provider error')
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return ''
  return content.trim()
}

function buildPetUserPrompt(payload) {
  const stats = payload.stats || {}
  const tendencies = payload.tendencies || {}
  const parts = [
    `第 ${payload.day || '?'} 天，${payload.period || '某个时段'}，事件「${payload.eventTitle || ''}」。`,
    `玩家刚刚选择「${payload.choiceTitle || ''}」，倾向是「${payload.tone || ''}」，连续同类选择 ${payload.toneStreak || 1} 次。`,
    `当前属性：精力 ${stats.energy ?? '?'}，心情 ${stats.mood ?? '?'}，成长 ${stats.growth ?? '?'}，人际 ${stats.relationships ?? '?'}。`,
    `本周倾向计数：${Object.entries(tendencies)
      .map(([key, value]) => `${key} ${value}`)
      .join('，') || '还没有明显倾向'}。`,
    '请只对小鲸说一句观察，不要总结整周，不要给建议清单。',
  ]
  return parts.join('\n')
}

export async function handlePet(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendText(res, 405, 'Method Not Allowed')
    return
  }
  let payload
  try {
    payload = await readBody(req)
  } catch (error) {
    sendJson(res, 400, { error: error.message })
    return
  }
  const messages = [
    { role: 'system', content: PET_SYSTEM_PROMPT },
    { role: 'user', content: buildPetUserPrompt(payload) },
  ]

  const providers = []
  const minimaxKey = process.env.MINIMAX_API_KEY
  if (minimaxKey) {
    providers.push({
      name: 'MiniMax',
      comment: () =>
        callChat({
          base: MINIMAX_BASE(),
          key: minimaxKey,
          model: MINIMAX_MODEL(),
          messages,
          maxTokens: 520,
          temperature: 0.85,
        }),
    })
  }

  const stepfunKey = process.env.STEPFUN_API_KEY
  if (stepfunKey) {
    providers.push({
      name: 'StepFun',
      comment: () =>
        callChat({
          base: STEPFUN_BASE(),
          key: stepfunKey,
          model: STEPFUN_MODEL(),
          messages,
          maxTokens: 900,
          temperature: 0.7,
        }),
    })
  }

  const sparkKey = process.env.XFYUN_MAAS_API_KEY
  if (sparkKey) {
    providers.push({
      name: '讯飞星火',
      comment: () =>
        callChat({
          base: XFYUN_MAAS_BASE(),
          key: sparkKey,
          model: XFYUN_MAAS_MODEL(),
          messages,
          maxTokens: 600,
          temperature: 0.8,
        }),
    })
  }

  sendJson(res, 200, await requestPetReply(payload, providers))
}

export async function handleTts(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendText(res, 405, 'Method Not Allowed')
    return
  }
  let body
  try {
    body = await readBody(req, 12_000)
  } catch (error) {
    sendJson(res, 400, { error: error.message })
    return
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : ''
  if (!text || text.length > 800) {
    sendJson(res, 400, { error: '朗读文本需在 1–800 字之间' })
    return
  }
  if (!VOICE_IDS.has(voiceId)) {
    sendJson(res, 400, { error: '未知音色' })
    return
  }
  const rawSpeed = Number(body.speed)
  const speed = Number.isFinite(rawSpeed) ? Math.min(1.2, Math.max(0.8, rawSpeed)) : 1
  const minimaxKey = process.env.MINIMAX_API_KEY
  const xfyunVoice = xfyunVoiceFor(voiceId)

  const providers = []
  if (minimaxKey) {
    providers.push({
      name: 'MiniMax',
      synthesize: async () => {
        const data = await postJson(`${MINIMAX_BASE()}/t2a_v2`, minimaxKey, {
          model: MINIMAX_TTS_MODEL(),
          text,
          voice_setting: { voice_id: voiceId, speed, vol: 1, pitch: 0 },
          audio_setting: {
            format: 'mp3',
            sample_rate: 32000,
            bitrate: 128000,
            channel: 1,
          },
          output_format: 'hex',
          stream: false,
        })
        if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
          throw new Error(data.base_resp.status_msg || 'TTS provider error')
        }
        const hex = data?.data?.audio
        if (typeof hex !== 'string' || hex.length < 8) {
          throw new Error('TTS returned no audio')
        }
        return { audio: Buffer.from(hex, 'hex'), contentType: 'audio/mpeg' }
      },
    })
  }

  if (xfyunVoice && process.env.XFYUN_APPID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET) {
    providers.push(
      createXfyunTtsProvider({
        appId: process.env.XFYUN_APPID,
        apiKey: process.env.XFYUN_API_KEY,
        apiSecret: process.env.XFYUN_API_SECRET,
        voice: xfyunVoice,
        speed: Math.round(50 * speed),
      }),
    )
  }

  if (!providers.length) {
    sendJson(res, 503, { error: '语音服务未配置' })
    return
  }

  const result = await requestAudio(text, providers)
  if (!result) {
    sendJson(res, 502, { error: '语音暂时不可用' })
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', result.contentType)
  res.setHeader('X-TTS-Provider', result.provider)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('Content-Length', String(result.audio.length))
  res.end(result.audio)
}
