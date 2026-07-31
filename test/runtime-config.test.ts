import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const runtimeConfigSource = await readFile(
  resolve(process.cwd(), 'public/runtime-config.js'),
  'utf8',
)

describe('runtime analytics configuration', () => {
  beforeEach(() => {
    delete window.__MAKESTOPMOTION_CONFIG__
    document.head.querySelectorAll('script[data-makestopmotion-umami]').forEach((script) => {
      script.remove()
    })
  })

  afterEach(() => {
    delete window.__MAKESTOPMOTION_CONFIG__
  })

  it('does not add a tracker without both Umami values', () => {
    window.eval(runtimeConfigSource)

    expect(document.querySelector('script[data-makestopmotion-umami]')).toBeNull()
  })

  it('adds the configured Umami tracker once', () => {
    window.__MAKESTOPMOTION_CONFIG__ = {
      siteUrl: 'https://movies.example',
      umamiUrl: 'https://stats.example/',
      umamiWebsiteId: 'site-123',
    }

    window.eval(runtimeConfigSource)
    window.eval(runtimeConfigSource)

    const trackers = document.querySelectorAll<HTMLScriptElement>(
      'script[data-makestopmotion-umami]',
    )
    expect(trackers).toHaveLength(1)
    expect(trackers[0].src).toBe('https://stats.example/script.js')
    expect(trackers[0].dataset.websiteId).toBe('site-123')
    expect(trackers[0].defer).toBe(true)
  })
})
