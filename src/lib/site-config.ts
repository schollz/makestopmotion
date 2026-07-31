export const DEFAULT_SITE_URL = 'https://makestopmotion.com'

interface MakeStopMotionConfig {
  contactEmail?: string
  siteUrl?: string
  umamiUrl?: string
  umamiWebsiteId?: string
}

declare global {
  interface Window {
    __MAKESTOPMOTION_CONFIG__?: MakeStopMotionConfig
  }
}

export function getSiteUrl() {
  const configured = window.__MAKESTOPMOTION_CONFIG__?.siteUrl?.trim()
  if (!configured) return DEFAULT_SITE_URL

  try {
    const url = new URL(configured)
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_SITE_URL
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function getSitePageUrl(path: string) {
  const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`
  return `${getSiteUrl()}${normalizedPath}`
}

export function getContactEmail() {
  const configured = window.__MAKESTOPMOTION_CONFIG__?.contactEmail?.trim()
  if (!configured) return ''

  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(configured)
    ? configured
    : ''
}
