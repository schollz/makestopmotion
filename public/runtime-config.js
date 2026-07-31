(function configureMakeStopMotion() {
  const defaults = {
    siteUrl: 'https://makestopmotion.com',
    umamiUrl: '',
    umamiWebsiteId: '',
  }
  const supplied = window.__MAKESTOPMOTION_CONFIG__ || {}
  const config = { ...defaults, ...supplied }
  window.__MAKESTOPMOTION_CONFIG__ = config

  if (!config.umamiUrl || !config.umamiWebsiteId) return
  if (document.querySelector('script[data-makestopmotion-umami]')) return

  const tracker = document.createElement('script')
  tracker.defer = true
  tracker.src = `${config.umamiUrl.replace(/\/+$/, '')}/script.js`
  tracker.dataset.websiteId = config.umamiWebsiteId
  tracker.dataset.makestopmotionUmami = 'true'
  document.head.appendChild(tracker)
})()
