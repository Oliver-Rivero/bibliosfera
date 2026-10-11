import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    server: {
      watch: {
        usePolling: true,
        interval: 300
      },
      headers: {
        'Cache-Control': 'no-store'
      }
    },
    plugins: [react()]
  }
})
