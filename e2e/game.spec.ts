import { statSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/pet', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: '测试桌宠评论', provider: 'Test' }),
    })
  })
})

async function startGame(page: Page, options: { petEnabled?: boolean } = {}) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(
    (petEnabled) =>
      localStorage.setItem(
        'omw:settings',
        JSON.stringify({ petEnabled, voiceEnabled: false }),
      ),
    options.petEnabled ?? false,
  )
  await page.reload()
  await page.getByRole('button', { name: '开始我的一周' }).click()
  await page.getByRole('button', { name: '选择你的身份' }).click()
  await expect(page.locator('.identity-screen')).toBeVisible()
  const portraits = page.locator('.identity-image img')
  await expect(portraits).toHaveCount(4)
  for (const image of await portraits.all()) {
    await image.evaluate((node: HTMLImageElement) => node.decode())
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
    const srcset = await image.getAttribute('srcset')
    expect(srcset).toContain('320w')
    expect(srcset).toContain('640w')
    expect(srcset).toContain('800w')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  await page.locator('.identity-footer .btn-primary').click()
  await expect(page.locator('.game-screen')).toBeVisible()
}

async function readState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('omw:save:current') ?? 'null'))
}

async function completeWeek(page: Page) {
  for (let step = 0; step < 120; step += 1) {
    if (await page.locator('.ending-shell').count()) return
    if (await page.locator('.day-summary-card').count()) {
      await page.locator('.day-summary-card .btn-primary').click()
      await page.waitForTimeout(150)
      continue
    }
    if (await page.locator('.result-panel--inline').count()) {
      await page.locator('.result-actions .btn-primary').click()
      await page.waitForTimeout(150)
      continue
    }
    const cards = page.locator('.choice-panel .choice-card:not([disabled])')
    if (await cards.count()) {
      const sceneWidth = await page
        .locator('.scene-frame img')
        .evaluate((node: HTMLImageElement) => node.naturalWidth)
      expect(sceneWidth).toBeGreaterThan(0)
      await cards.first().click()
      await expect(page.locator('.result-panel--inline')).toBeVisible()
      const resultWidth = await page
        .locator('.result-insert img')
        .evaluate((node: HTMLImageElement) => node.naturalWidth)
      expect(resultWidth).toBeGreaterThan(0)
      continue
    }
    await page.waitForTimeout(150)
  }
  throw new Error('game did not reach an ending within the step budget')
}

test('desktop: completes a week and downloads the share card', async ({ page, isMobile }) => {  test.skip(isMobile, 'desktop only')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await startGame(page)
  await completeWeek(page)
  const state = await readState(page)
  expect(state.completed).toBe(true)
  expect(state.totalHoursUsed).toBe(168)
  expect(state.day).toBe(7)
  expect(state.history).toHaveLength(28)
  expect(state.daySummaries).toHaveLength(7)
  expect(state.endingId).toBeTruthy()
  const endingImageWidth = await page
    .locator('.ending-hero img')
    .evaluate((node: HTMLImageElement) => node.naturalWidth)
  expect(endingImageWidth).toBeGreaterThan(0)
  await expect(page.locator('.ending-badge strong')).not.toBeEmpty()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)

  await page.getByRole('button', { name: '生成分享卡' }).click()
  const canvas = page.locator('.share-canvas')
  await expect(canvas).toBeVisible()
  expect(await canvas.getAttribute('width')).toBe('1200')
  expect(await canvas.getAttribute('height')).toBe('630')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 PNG 分享卡' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('one-more-week-share-card.png')
  const path = await download.path()
  if (!path) throw new Error('share card download has no local path')
  expect(statSync(path).size).toBeGreaterThan(100_000)
  expect(errors).toEqual([])
})

test('mobile: plays the first day without overflow or tiny controls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only')
  await startGame(page)

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const promptTop = await page
    .locator('.choice-panel')
    .evaluate((node) => node.getBoundingClientRect().top)
  expect(promptTop).toBeLessThan(await page.evaluate(() => innerHeight))

  const firstChoice = page.locator('.choice-panel .choice-card:not([disabled])').first()
  await firstChoice.scrollIntoViewIfNeeded()
  const heights = await page
    .locator('.choice-panel .choice-card')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
  await firstChoice.click()
  await expect(page.locator('.result-panel--inline')).toBeVisible()
  await expect(page.locator('.consequence-layout')).toHaveCount(0)
  await expect(page.locator('.result-insert img')).toHaveJSProperty('complete', true)
  expect(
    await page
      .locator('.result-insert img')
      .evaluate((node: HTMLImageElement) => node.naturalWidth),
  ).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)

  for (let step = 0; step < 8; step += 1) {
    if (await page.locator('.day-summary-card').count()) break
    if (await page.locator('.result-panel--inline').count()) {
      await page.locator('.result-actions .btn-primary').click()
      await page.waitForTimeout(150)
      continue
    }
    await page.locator('.choice-panel .choice-card:not([disabled])').first().click()
    await expect(page.locator('.result-panel--inline')).toBeVisible()
  }
  await expect(page.locator('.day-summary-card')).toBeVisible()
  await expect(page.locator('.time-breakdown')).toContainText('24h')
  await expect(page.locator('.day-slot-row')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
})

test('pet: comments on a choice without breaking the flow', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only')
  await startGame(page, { petEnabled: true })
  await page.locator('.choice-card:not([disabled])').first().click()
  await expect(page.locator('.result-panel--inline')).toBeVisible()
  await expect(page.locator('.pet-bubble')).toContainText('测试桌宠评论', { timeout: 10_000 })
  await expect(page.locator('.pet-provider')).toContainText('Test')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
})
