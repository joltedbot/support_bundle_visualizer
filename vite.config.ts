import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function getCustomerOutDir(): string {
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'src/generated/buildConfig.json'), 'utf-8'))
    if (cfg.customerDir) return `output/${cfg.customerDir}`
  } catch {
    // fall back to default if not yet generated
  }
  return 'output'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: getCustomerOutDir(),
  },
  test: {
    environment: 'node',
  },
})
