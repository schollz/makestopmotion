(function configureMakeStopMotion() {
  const defaults = {
    contactEmail: '',
    siteUrl: 'https://makestopmotion.com',
    umamiUrl: '',
    umamiWebsiteId: '',
  }
  const supplied = window.__MAKESTOPMOTION_CONFIG__ || {}
  const config = { ...defaults, ...supplied }
  window.__MAKESTOPMOTION_CONFIG__ = config

  function loadAnalytics() {
    if (!config.umamiUrl || !config.umamiWebsiteId) return
    if (document.querySelector('script[data-makestopmotion-umami]')) return

    const tracker = document.createElement('script')
    tracker.defer = true
    tracker.src = `${config.umamiUrl.replace(/\/+$/, '')}/script.js`
    tracker.dataset.websiteId = config.umamiWebsiteId
    tracker.dataset.makestopmotionUmami = 'true'
    document.head.appendChild(tracker)
  }

  window.__MAKESTOPMOTION_LOAD_ANALYTICS__ = loadAnalytics

  try {
    if (window.localStorage.getItem('makestopmotion-privacy-choice-v1') === 'analytics') {
      loadAnalytics()
    }
  } catch {
    // Analytics remains disabled when the saved choice cannot be read.
  }
})()
