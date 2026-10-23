const prefetched = new Set<string>()

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

function constrainedNetwork(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection) return false
  return Boolean(connection.saveData) || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
}

function onIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 2500 })
    return
  }
  setTimeout(callback, 1200)
}

export function prefetchImage(src: string): void {
  if (!src || prefetched.has(src) || constrainedNetwork()) return
  prefetched.add(src)
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'image'
  link.href = src
  document.head.appendChild(link)
}

export function prefetchImagesAfterLoad(srcs: Array<string | undefined>): void {
  if (constrainedNetwork()) return
  const start = () => {
    onIdle(() => {
      for (const src of srcs) {
        if (src) prefetchImage(src)
      }
    })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

export function prefetchModule(loader: () => Promise<unknown>): void {
  if (constrainedNetwork()) return
  onIdle(() => {
    void loader()
  })
}
