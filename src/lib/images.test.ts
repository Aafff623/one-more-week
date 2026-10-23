import { describe, expect, it } from 'vitest'
import { imageFor, type ImageRole, type Viewport } from './images'

const scene = '/images/scene-test.webp'
const identity = '/images/identity-test.webp'
const choice = '/images/choices/test.webp'
const ending = '/images/endings/test.webp'

function prefetch(role: ImageRole, src: string, viewport: Viewport): string {
  const image = imageFor(role, src, viewport)
  expect(image.sources.some((source) => source.path === image.prefetchSrc)).toBe(true)
  return image.prefetchSrc
}

describe('image catalogue', () => {
  it('builds ascending srcsets for every role', () => {
    expect(imageFor('scene', scene, { width: 1440, density: 1 }).srcset).toBe(
      '/images/scene-test-720.webp 720w, /images/scene-test-960.webp 960w, /images/scene-test.webp 1200w',
    )
    expect(imageFor('identity', identity, { width: 1440, density: 1 }).srcset).toBe(
      '/images/identity-test-320.webp 320w, /images/identity-test-640.webp 640w, /images/identity-test.webp 800w',
    )
    expect(imageFor('choice', choice, { width: 1440, density: 1 }).srcset).toBe(
      '/images/choices/test-800.webp 800w, /images/choices/test.webp 1000w',
    )
    expect(imageFor('ending', ending, { width: 1440, density: 1 }).srcset).toBe(
      '/images/endings/test-800.webp 800w, /images/endings/test.webp 1200w',
    )
  })

  it('picks the same candidate the browser will use for scenes', () => {
    expect(prefetch('scene', scene, { width: 1440, density: 1 })).toBe('/images/scene-test-720.webp')
    expect(prefetch('scene', scene, { width: 1440, density: 2 })).toBe(scene)
    expect(prefetch('scene', scene, { width: 390, density: 2 })).toBe('/images/scene-test-960.webp')
  })

  it('picks identity variants by their actual display width', () => {
    expect(prefetch('identity', identity, { width: 390, density: 2 })).toBe('/images/identity-test-320.webp')
    expect(prefetch('identity', identity, { width: 390, density: 3 })).toBe('/images/identity-test-640.webp')
    expect(prefetch('identity', identity, { width: 1440, density: 2 })).toBe('/images/identity-test-640.webp')
    expect(prefetch('identity', identity, { width: 1440, density: 3 })).toBe(identity)
  })

  it('picks result and ending variants from the same table', () => {
    expect(prefetch('choice', choice, { width: 390, density: 2 })).toBe('/images/choices/test-800.webp')
    expect(prefetch('choice', choice, { width: 1440, density: 3 })).toBe(choice)
    expect(prefetch('ending', ending, { width: 390, density: 2 })).toBe('/images/endings/test-800.webp')
    expect(prefetch('ending', ending, { width: 1440, density: 2 })).toBe(ending)
  })
})
