import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MarketingApp from './MarketingApp'

afterEach(() => {
  delete window.__MAKESTOPMOTION_CONFIG__
  document
    .querySelectorAll('script[src="https://subsnail.schollz.com/form/embed.js"]')
    .forEach((script) => script.remove())
})

describe('contact configuration', () => {
  it('hides contact navigation and content when no email is configured', () => {
    render(<MarketingApp route="contact" />)

    expect(
      screen.getByRole('heading', { name: 'Make things move.' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /contact/i })).toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('shows the contact page with the configured email address', () => {
    window.__MAKESTOPMOTION_CONFIG__ = {
      contactEmail: 'hello@example.com',
    }

    render(<MarketingApp route="contact" />)

    expect(
      screen.getByRole('heading', { name: 'Say hello.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    )
    expect(screen.getAllByRole('link', { name: /contact/i })).toHaveLength(2)
  })
})
