export type ImageRole = 'scene' | 'identity' | 'choice' | 'ending'

export interface Viewport {
  width: number
  density: number
}

export interface ImageCandidate {
  width: number
  path: string
}

export interface ImageSources {
  src: string
  srcset: string
  sizes: string
  prefetchSrc: string
  sources: ImageCandidate[]
}

interface RoleConfig {
  widths: number[]
  sizes: string
  displayWidth: (viewport: Viewport) => number
}

const ROLES: Record<ImageRole, RoleConfig> = {
  scene: {
    widths: [720, 960, 1200],
    sizes: '(max-width: 960px) 100vw, 640px',
    displayWidth: (viewport) => (viewport.width <= 960 ? viewport.width : 640),
  },
  identity: {
    widths: [320, 640, 800],
    sizes: '(max-width: 720px) 122px, 250px',
    displayWidth: (viewport) => (viewport.width <= 720 ? 122 : 250),
  },
  choice: {
    widths: [800, 1000],
    sizes: '(max-width: 960px) 100vw, 400px',
    displayWidth: (viewport) => (viewport.width <= 960 ? viewport.width : 400),
  },
  ending: {
    widths: [800, 1200],
    sizes: '(max-width: 960px) 100vw, 1100px',
    displayWidth: (viewport) => (viewport.width <= 960 ? viewport.width : 1100),
  },
}

export function currentViewport(): Viewport {
  if (typeof window === 'undefined') return { width: 1440, density: 1 }
  return {
    width: window.innerWidth,
    density: Math.min(window.devicePixelRatio || 1, 3),
  }
}

function variantPath(src: string, width: number, fullWidth: number): string {
  return width === fullWidth ? src : src.replace(/\.webp$/, `-${width}.webp`)
}

export function imageFor(
  role: ImageRole,
  src: string,
  viewport: Viewport = currentViewport(),
): ImageSources {
  const config = ROLES[role]
  const fullWidth = config.widths[config.widths.length - 1]
  const sources = config.widths.map((width) => ({
    width,
    path: variantPath(src, width, fullWidth),
  }))
  const needed = config.displayWidth(viewport) * viewport.density
  const prefetch = sources.find((source) => source.width >= needed) ?? sources[sources.length - 1]
  return {
    src,
    srcset: sources.map((source) => `${source.path} ${source.width}w`).join(', '),
    sizes: config.sizes,
    prefetchSrc: prefetch.path,
    sources,
  }
}
