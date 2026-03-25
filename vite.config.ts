import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function getBuildConfig(): { customerDir?: string; pageTitle?: string } {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'src/generated/buildConfig.json'), 'utf-8'))
  } catch {
    return {}
  }
}

const buildConfig = getBuildConfig()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'inject-page-title',
      transformIndexHtml(html) {
        const raw = buildConfig.pageTitle ?? 'Bundle Visualizer'
        const title = raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      },
    },
  ],
  base: './',
  build: {
    outDir: buildConfig.customerDir ? `output/${buildConfig.customerDir}` : 'output',
  },
  test: {
    environment: 'node',
  },
})
