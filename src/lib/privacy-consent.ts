export const PRIVACY_CHOICE_KEY = 'makestopmotion-privacy-choice-v1'
export const OPEN_PRIVACY_CHOICES_EVENT = 'makestopmotion:open-privacy-choices'

export type PrivacyChoice = 'analytics' | 'declined'

declare global {
  interface Window {
    __MAKESTOPMOTION_LOAD_ANALYTICS__?: () => void
  }
}

export function getPrivacyChoice(): PrivacyChoice | null {
  try {
    const stored = window.localStorage.getItem(PRIVACY_CHOICE_KEY)
    return stored === 'analytics' || stored === 'declined' ? stored : null
  } catch {
    return null
  }
}

export function savePrivacyChoice(choice: PrivacyChoice) {
  try {
    window.localStorage.setItem(PRIVACY_CHOICE_KEY, choice)
  } catch {
    // The choice still applies for this page when storage is unavailable.
  }
}
