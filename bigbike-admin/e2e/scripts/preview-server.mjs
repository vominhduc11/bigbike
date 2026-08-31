import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'
const npmBuild = isWindows
  ? { cmd: 'cmd.exe', args: ['/d', '/s', '/c', 'npm run build'] }
  : { cmd: 'npm', args: ['run', 'build'] }
const vitePreview = isWindows
  ? {
      cmd: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx vite preview --config e2e/vite.preview.config.ts'],
    }
  : { cmd: 'npx', args: ['vite', 'preview', '--config', 'e2e/vite.preview.config.ts'] }

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      ...options,
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })
}

const buildEnv = {
  ...process.env,
  VITE_ADMIN_API_BASE: process.env.VITE_ADMIN_API_BASE || '/api/v1',
  VITE_MINIO_INTERNAL_ORIGIN: process.env.VITE_MINIO_INTERNAL_ORIGIN || 'http://minio:9000',
}

await run(npmBuild.cmd, npmBuild.args, { env: buildEnv })

const preview = spawn(vitePreview.cmd, vitePreview.args, {
  stdio: 'inherit',
  env: process.env,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!preview.killed) preview.kill(signal)
  })
}

preview.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

preview.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
