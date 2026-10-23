import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { imageFor } from './src/lib/images.ts'

const SERVER_ENV_KEYS = [
  'MINIMAX_API_KEY',
  'MINIMAX_BASE_URL',
  'MINIMAX_MODEL',
  'MINIMAX_TTS_MODEL',
  'STEPFUN_API_KEY',
  'STEPFUN_BASE_URL',
  'STEPFUN_MODEL',
]

const coreUrl = new URL('./api/_ai-core.mjs', import.meta.url).href
const getCore = () => import(/* @vite-ignore */ coreUrl)

function coverPreloadPlugin(): Plugin {
  return {
    name: 'omw-cover-preload',
    transformIndexHtml(html) {
      const cover = imageFor('scene', '/images/scene-cover-window.webp', {
        width: 1440,
        density: 1,
      })
      const link = `<link rel="preload" as="image" href="${cover.src}" imagesrcset="${cover.srcset}" imagesizes="${cover.sizes}" fetchpriority="high" />`
      return html.replace('<!--cover-preload-->', link)
    },
  }
}

function localAiPlugin(): Plugin {
  return {
    name: 'omw-local-ai',
    apply: 'serve',
    configureServer(server) {
      const mount = (path: string, loader: () => Promise<(req: any, res: any) => Promise<void>>) => {
        server.middlewares.use(path, (req, res) => {
          void loader()
            .then((handler) => handler(req, res))
            .catch((error) => {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: String(error).slice(0, 160) }))
            })
        })
      }
      mount('/api/pet', async () => (await getCore()).handlePet)
      mount('/api/tts', async () => (await getCore()).handleTts)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const processEnv = (globalThis as any).process?.env as Record<string, string | undefined> | undefined
  if (processEnv) {
    for (const key of SERVER_ENV_KEYS) {
      if (env[key]) processEnv[key] = env[key]
    }
  }
  return {
    plugins: [vue(), tailwindcss(), coverPreloadPlugin(), localAiPlugin()],
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
  }
})
