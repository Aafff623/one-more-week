import { chromium } from 'playwright'

const url = process.argv[2] ?? 'https://one-more-week-blush.vercel.app/'
const local = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)
const proxy = local ? undefined : process.env.PERF_PROXY
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {})
const mobile = process.argv[3] === 'mobile'
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
})
const page = await context.newPage()
const responses = []
page.on('response', async (res) => {
  const req = res.request()
  const type = req.resourceType()
  if (!['document', 'script', 'stylesheet', 'image', 'font'].includes(type)) return
  const headers = await res.allHeaders().catch(() => ({}))
  const sizes = await req.sizes().catch(() => ({}))
  responses.push({
    type,
    url: res.url(),
    status: res.status(),
    encoded: sizes.responseBodySize ?? 0,
    cache: headers['cache-control'] ?? '',
  })
})
await page.addInitScript(() => {
  window.__perf = { lcp: 0, lcpSrc: '', cls: 0 }
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (!last) return
      window.__perf.lcp = last.startTime
      window.__perf.lcpSrc = last.element?.currentSrc ?? ''
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__perf.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}
})
const t0 = Date.now()
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]
  return {
    ...window.__perf,
    fcp: fcp?.startTime ?? 0,
    dcl: nav?.domContentLoadedEventEnd ?? 0,
    load: nav?.loadEventEnd ?? 0,
  }
})
const byType = {}
for (const r of responses) {
  byType[r.type] ??= { n: 0, bytes: 0 }
  byType[r.type].n += 1
  byType[r.type].bytes += r.encoded
}
console.log(JSON.stringify({ url, mobile, wallMs: Date.now() - t0, metrics, byType, resources: responses }, null, 2))
await browser.close()
