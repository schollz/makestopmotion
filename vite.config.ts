import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        contact: `${projectRoot}contact/index.html`,
        home: `${projectRoot}index.html`,
        privacy: `${projectRoot}privacy/index.html`,
        studio: `${projectRoot}studio/index.html`,
        terms: `${projectRoot}terms/index.html`,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
  },
})
