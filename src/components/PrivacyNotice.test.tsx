import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIVACY_CHOICE_KEY } from '../lib/privacy-consent'
import { PrivacyNotice } from './PrivacyNotice'
import { SiteFooter } from './SiteChrome'

describe('privacy notice', () => {
  beforeEach(() => {
    localStorage.clear()
    delete window.__MAKESTOPMOTION_LOAD_ANALYTICS__
  })

  it('remembers a no-analytics answer and does not return automatically', async () => {
    const user = userEvent.setup()
    const view = render(<PrivacyNotice />)

    expect(
      screen.getByRole('heading', { name: 'Cookies and privacy' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/This site does not set cookies or use advertising trackers/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'No analytics' }))

    expect(localStorage.getItem(PRIVACY_CHOICE_KEY)).toBe('declined')
    expect(
      screen.queryByRole('heading', { name: 'Cookies and privacy' }),
    ).toBeNull()

    view.unmount()
    render(<PrivacyNotice />)
    expect(
      screen.queryByRole('heading', { name: 'Cookies and privacy' }),
    ).toBeNull()
  })

  it('loads analytics only after an affirmative answer', async () => {
    const user = userEvent.setup()
    const loadAnalytics = vi.fn()
    window.__MAKESTOPMOTION_LOAD_ANALYTICS__ = loadAnalytics
    render(<PrivacyNotice />)

    await user.click(
      screen.getByRole('button', { name: 'Allow anonymous analytics' }),
    )

    expect(localStorage.getItem(PRIVACY_CHOICE_KEY)).toBe('analytics')
    expect(loadAnalytics).toHaveBeenCalledOnce()
  })

  it('can be reopened from the footer after a choice', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PRIVACY_CHOICE_KEY, 'declined')
    render(
      <>
        <SiteFooter />
        <PrivacyNotice />
      </>,
    )

    expect(
      screen.queryByRole('heading', { name: 'Cookies and privacy' }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'privacy choices' }))

    expect(
      screen.getByRole('heading', { name: 'Cookies and privacy' }),
    ).toBeInTheDocument()
  })
})
