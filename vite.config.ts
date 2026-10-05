import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/pages-test/' : '/',
  server: command === 'serve' ? {
    proxy: { '/api': { target: 'http://bitunix:8765', changeOrigin: true } },
  } : undefined,
}))
