import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const defaultSiteUrl = 'https://makestopmotion.com'

function normalizeOrigin(value: string | undefined, name: string, fallback = '') {
  const configured = value?.trim()
  if (!configured) return fallback

  const url = new URL(configured)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an HTTP(S) origin without a path, query, or fragment`)
  }

  return url.origin
}

function siteEnvironmentPlugin(mode: string, command: 'build' | 'serve'): Plugin {
  const loaded = loadEnv(mode, projectRoot, '')
  const environment = { ...loaded, ...process.env }
  const siteUrl = normalizeOrigin(environment.SITE_URL, 'SITE_URL', defaultSiteUrl)
  const contactEmail = environment.CONTACT_EMAIL?.trim() ?? ''
  const configuredUmamiUrl = environment.UMAMI_URL?.trim() ?? ''
  const configuredUmamiWebsiteId = environment.UMAMI_WEBSITE_ID?.trim() ?? ''
  const analyticsEnabled = Boolean(configuredUmamiUrl && configuredUmamiWebsiteId)
  const umamiUrl = analyticsEnabled
    ? normalizeOrigin(configuredUmamiUrl, 'UMAMI_URL')
    : ''
  const umamiWebsiteId = analyticsEnabled ? configuredUmamiWebsiteId : ''

  if (umamiWebsiteId && !/^[A-Za-z0-9_-]+$/.test(umamiWebsiteId)) {
    throw new Error('UMAMI_WEBSITE_ID may only contain letters, numbers, underscores, and hyphens')
  }
  if (contactEmail && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(contactEmail)) {
    throw new Error('CONTACT_EMAIL must be a valid email address')
  }

  const browserConfig = JSON.stringify({
    contactEmail,
    siteUrl,
    umamiUrl,
    umamiWebsiteId,
  }).replaceAll('<', '\\u003c')
  const hasBrowserOverride = Boolean(
    contactEmail || environment.SITE_URL?.trim() || analyticsEnabled,
  )

  return {
    name: 'makestopmotion-site-environment',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return {
          html: html.replaceAll(defaultSiteUrl, siteUrl),
          tags: hasBrowserOverride
            ? [
                {
                  tag: 'script',
                  children: `window.__MAKESTOPMOTION_CONFIG__ = ${browserConfig}`,
                  injectTo: 'head-prepend',
                },
              ]
            : [],
        }
      },
    },
    async closeBundle() {
      if (command !== 'build' || siteUrl === defaultSiteUrl) return

      await Promise.all(
        ['robots.txt', 'sitemap.xml'].map(async (fileName) => {
          const outputPath = fileURLToPath(new URL(`dist/${fileName}`, import.meta.url))
          const contents = await readFile(outputPath, 'utf8')
          await writeFile(outputPath, contents.replaceAll(defaultSiteUrl, siteUrl))
        }),
      )
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), siteEnvironmentPlugin(mode, command)],
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
}))
