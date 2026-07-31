import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL, getSitePageUrl, getSiteUrl } from './site-config'

afterEach(() => {
  delete window.__MAKESTOPMOTION_CONFIG__
})

describe('site configuration', () => {
  it('uses the production site by default', () => {
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
    expect(getSitePageUrl('/studio')).toBe(`${DEFAULT_SITE_URL}/studio`)
  })

  it('uses a configured HTTP(S) origin and normalizes page paths', () => {
    window.__MAKESTOPMOTION_CONFIG__ = { siteUrl: 'https://movies.example/' }

    expect(getSiteUrl()).toBe('https://movies.example')
    expect(getSitePageUrl('privacy/')).toBe('https://movies.example/privacy')
    expect(getSitePageUrl('/')).toBe('https://movies.example/')
  })

  it('ignores an invalid or unsafe site URL', () => {
    window.__MAKESTOPMOTION_CONFIG__ = { siteUrl: 'javascript:alert(1)' }
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
  })
})
