import type { EndingDefinition, Identity, Stats } from '../game/models'

export interface ShareCardData {
  ending: EndingDefinition
  identity: Identity
  stats: Stats
  choiceCount: number
  choiceHours: number
  restHours: number
  completed: boolean
}

const W = 1200
const H = 630
const INK = '#0D172B'
const PAPER = '#FFFEFB'
const LIME = '#C6FB35'
const CYAN = '#79D8F2'
const CORAL = '#EE8E76'
const FONT_SANS = '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif'

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

const NO_LINE_START = new Set(Array.from('，。、；：？！）》」』】…,.;:!?)]}·'))
const NO_LINE_END = new Set(Array.from('（《「『【([{“‘'))

export function wrapTextLines(
  text: string,
  measure: (value: string) => number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of Array.from(text)) {
    const test = line + char
    if (measure(test) > maxWidth && line) {
      if (NO_LINE_START.has(char)) {
        line = test
        lines.push(line)
        line = ''
      } else {
        const last = Array.from(line).at(-1) ?? ''
        if (NO_LINE_END.has(last)) {
          const head = line.slice(0, -last.length)
          if (head) lines.push(head)
          line = last + char
        } else {
          lines.push(line)
          line = char
        }
      }
      if (lines.length === maxLines) break
    } else {
      line = test
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && Array.from(text).join('').length > lines.join('').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`
  }
  return lines
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  return wrapTextLines(text, (value) => ctx.measureText(value).width, maxWidth, maxLines)
}

function drawHalftone(ctx: CanvasRenderingContext2D) {
  ctx.save()
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < 22; col += 1) {
      const x = 760 + col * 20
      const y = 42 + row * 20
      const alpha = Math.max(0.02, 0.22 - Math.abs(x - 1010) / 520 - Math.abs(y - 160) / 700)
      ctx.fillStyle = `rgba(121,216,242,${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  const background = ctx.createLinearGradient(0, 0, W, H)
  background.addColorStop(0, '#0B1425')
  background.addColorStop(0.62, '#14243B')
  background.addColorStop(1, '#263B53')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  drawHalftone(ctx)

  ctx.save()
  ctx.translate(820, 36)
  ctx.rotate(-0.2)
  ctx.fillStyle = LIME
  ctx.fillRect(0, 0, 410, 18)
  ctx.globalAlpha = 0.35
  ctx.fillRect(24, 28, 340, 5)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,254,251,.44)'
  ctx.lineWidth = 2
  ctx.strokeRect(72, 56, 1056, 512)

  ctx.fillStyle = LIME
  ctx.fillRect(92, 78, 140, 8)
  ctx.fillStyle = LIME
  ctx.font = `800 18px ${FONT_SANS}`
  ctx.fillText('ONE MORE WEEK / 再来一周', 92, 122)

  ctx.fillStyle = PAPER
  ctx.font = `900 62px ${FONT_SANS}`
  ctx.fillText(data.ending.title, 92, 224)

  ctx.fillStyle = 'rgba(255,254,251,.84)'
  ctx.font = `400 24px ${FONT_SANS}`
  const lines = wrapLines(ctx, data.ending.description, 720, 3)
  lines.forEach((line, index) => ctx.fillText(line, 92, 280 + index * 38))

  const metrics: Array<[string, string]> = [
    ['关键选择', `${data.choiceCount}`],
    ['选择用时', `${data.choiceHours}h`],
    ['成长', `${data.stats.growth}`],
    ['人际', `${data.stats.relationships}`],
  ]
  metrics.forEach(([label, value], index) => {
    const x = 92 + index * 190
    roundedRect(ctx, x, 442, 166, 82, 10)
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.32)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = PAPER
    ctx.font = `800 28px ${FONT_SANS}`
    ctx.fillText(value, x + 16, 482)
    ctx.fillStyle = 'rgba(255,255,255,.68)'
    ctx.font = `400 14px ${FONT_SANS}`
    ctx.fillText(label, x + 16, 506)
  })

  ctx.fillStyle = 'rgba(255,255,255,.66)'
  ctx.font = `400 15px ${FONT_SANS}`
  ctx.fillText(
    `${data.identity.name} · 休息 ${data.restHours}h · Seven days. Every choice leaves a mark.`,
    92,
    586,
  )

  ctx.fillStyle = CORAL
  ctx.fillRect(1010, 580, 72, 4)
}

export function shareText(data: ShareCardData): string {
  return [
    `我在《One More Week / 再来一周》里过了一周。`,
    `我的结局是「${data.ending.title}」。`,
    `做了 ${data.choiceCount} 个选择，把 ${data.choiceHours} 小时交给了选择，留了 ${data.restHours} 小时给休息。`,
    `七天时间，每一个选择，都会在你的人生留下印记。`,
    '',
    '#WorkBuddy #1024程序员节',
  ].join('\n')
}
