import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vite = resolve(root, 'node_modules/vite/bin/vite.js')
const child = spawn(
  process.execPath,
  [vite, '--host', '127.0.0.1', ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  },
)
child.on('exit', (code) => process.exit(code ?? 0))
