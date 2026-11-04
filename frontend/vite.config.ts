/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const brandingDir = resolve(import.meta.dirname, '..', 'branding')
const branding = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'branding.json'), 'utf8')) as { name: string }

/**
 * Brand data from its single source: the product name goes into index.html (%PRODUCT_NAME%) and the logo is served and
 * emitted as /favicon.svg straight from the brand folder, so neither is ever typed or copied by hand.
 */
function brandPlugin(): Plugin {
  const logo = () => readFileSync(resolve(brandingDir, 'logo.svg'))
  return {
    name: 'brand',
    transformIndexHtml: (html) => html.replaceAll('%PRODUCT_NAME%', branding.name),
    configureServer(server) {
      server.middlewares.use('/favicon.svg', (_request, response) => {
        response.setHeader('Content-Type', 'image/svg+xml')
        response.end(logo())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'favicon.svg', source: logo() })
    },
  }
}

// Ports are fixed (never an automatic fallback): Vite 5240 -> server 5241 for development; the desktop development
// setup overrides both through the environment (Vite 5244 -> server 5243).
const port = Number(process.env.VITE_DEV_PORT ?? 5240)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5241'
const proxy = { '/api': { target: apiTarget, changeOrigin: true } }

export default defineConfig({
  plugins: [react(), tailwindcss(), brandPlugin()],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    // The brand folder lives next to frontend/.
    fs: { allow: ['..'] },
    // changeOrigin: the server's desktop mode only answers requests whose Host is its own loopback address.
    proxy,
  },
  preview: { host: '127.0.0.1', port, strictPort: true, proxy },
  build: {
    outDir: 'dist',
    // No data: URIs for small assets - the content security policy of the server does not allow them.
    assetsInlineLimit: 0,
    // One bundle for a local app; the default 500 kB warning is for public sites.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
