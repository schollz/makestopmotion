import { useEffect, useState } from 'react'
import {
  getPrivacyChoice,
  OPEN_PRIVACY_CHOICES_EVENT,
  type PrivacyChoice,
  savePrivacyChoice,
} from '../lib/privacy-consent'

export function PrivacyNotice() {
  const [choice, setChoice] = useState<PrivacyChoice | null>(() =>
    getPrivacyChoice(),
  )
  const [isOpen, setIsOpen] = useState(() => choice === null)

  useEffect(() => {
    const openChoices = () => setIsOpen(true)
    window.addEventListener(OPEN_PRIVACY_CHOICES_EVENT, openChoices)
    return () =>
      window.removeEventListener(OPEN_PRIVACY_CHOICES_EVENT, openChoices)
  }, [])

  if (!isOpen) return null

  const selectChoice = (nextChoice: PrivacyChoice) => {
    const analyticsWasEnabled = choice === 'analytics'
    savePrivacyChoice(nextChoice)
    setChoice(nextChoice)
    setIsOpen(false)

    if (nextChoice === 'analytics') {
      window.__MAKESTOPMOTION_LOAD_ANALYTICS__?.()
    } else if (analyticsWasEnabled) {
      window.location.reload()
    }
  }

  return (
    <aside className="privacy-notice" aria-labelledby="privacy-notice-title">
      <div className="privacy-notice__copy">
        <h2 id="privacy-notice-title">Cookies and privacy</h2>
        <p>
          This site does not set cookies or use advertising trackers. Local
          browser storage keeps your projects, settings, and this choice on
          your device. If you allow it, our only optional tracker—cookie-free
          Umami—records anonymous page views such as the page, referrer, browser
          or device, and approximate country. It never receives camera frames,
          projects, or exports. <a href="/privacy">Read the privacy policy</a>.
        </p>
      </div>
      <div
        className="privacy-notice__actions"
        aria-label="Analytics preference"
      >
        <button
          type="button"
          aria-pressed={choice === 'declined'}
          onClick={() => selectChoice('declined')}
        >
          No analytics
        </button>
        <button
          type="button"
          aria-pressed={choice === 'analytics'}
          onClick={() => selectChoice('analytics')}
        >
          Allow anonymous analytics
        </button>
      </div>
    </aside>
  )
}
