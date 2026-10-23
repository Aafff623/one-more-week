import { describe, expect, it } from 'vitest'
import { wrapTextLines } from './shareCard'

const measure = (value: string) => Array.from(value).length * 10
const closing = Array.from('，。、；：？！）》」』】…,.;:!?)]}·')
const opening = Array.from('（《「『【([{“‘')

describe('share card line wrapping', () => {
  it('does not start a line with closing punctuation', () => {
    const lines = wrapTextLines('123456789，0', measure, 95, 3)
    expect(lines).toEqual(['123456789，', '0'])
  })

  it('does not leave opening punctuation at the end of a line', () => {
    const lines = wrapTextLines('123456789（0', measure, 100, 3)
    expect(lines).toEqual(['123456789', '（0'])
  })

  it('keeps the Chinese quote and comma together', () => {
    const lines = wrapTextLines(
      '你为重要的事情付出了很多，也确实往前走了。只是这一周的尾声里，身体已经在提醒你。',
      measure,
      120,
      4,
    )
    for (const line of lines.slice(1)) {
      expect(closing).not.toContain(Array.from(line)[0])
    }
    for (const line of lines.slice(0, -1)) {
      expect(opening).not.toContain(Array.from(line).at(-1))
    }
  })

  it('caps lines and adds an ellipsis when text is cut', () => {
    const lines = wrapTextLines('012345678901234567890123456789', measure, 100, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })
})
