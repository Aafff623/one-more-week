import { describe, expect, it } from 'vitest'
import { imageFor, type ImageRole } from '../lib/images'
import { gameContent } from './content'
import { choiceImageKey, choiceThumbKey, endingImageKey } from './choiceImages'

const assets = import.meta.glob('/public/images/**/*.webp')

function expectAsset(path: string) {
  expect(assets[`/public${path}`], `missing asset ${path}`).toBeTruthy()
}

function expectSources(role: ImageRole, path: string) {
  for (const source of imageFor(role, path, { width: 1440, density: 1 }).sources) {
    expectAsset(source.path)
  }
}

describe('image assets', () => {
  it('does not ship nested responsive variants', () => {
    for (const path of Object.keys(assets)) {
      expect(path).not.toMatch(/-\d+-\d+\.webp$/)
    }
  })

  it('ships every scene candidate from the catalogue', () => {
    for (const event of gameContent.events) {
      expectSources('scene', event.imageKey)
    }
    for (const path of [
      '/images/scene-cover-window.webp',
      '/images/scene-intro-city.webp',
      '/images/scene-ending-silhouette.webp',
    ]) {
      expectSources('scene', path)
    }
  })

  it('ships identity portraits for every catalogue width', () => {
    for (const identity of gameContent.identities) {
      expectSources('identity', identity.imageKey)
    }
  })

  it('ships every choice image and thumbnail', () => {
    for (const event of gameContent.events) {
      for (const choice of event.choices) {
        expectSources('choice', choiceImageKey(choice.id))
        expectAsset(choiceThumbKey(choice.id))
      }
    }
  })

  it('ships ending art for every catalogue width', () => {
    for (const ending of gameContent.endings) {
      expectSources('ending', endingImageKey(ending.id))
    }
  })
})
