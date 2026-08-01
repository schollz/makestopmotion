import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getContactEmail } from '../lib/site-config'
import { OPEN_PRIVACY_CHOICES_EVENT } from '../lib/privacy-consent'

const OTHER_TOOLS = [
  {
    description: 'write together, without the setup',
    href: 'https://cowyo.com',
    name: 'cowyo',
  },
  {
    description: 'fast, simple, secure file transfer',
    href: 'https://getcroc.com',
    name: 'croc',
  },
  {
    description: 'yes/no alerts when websites change',
    href: 'https://yesnotice.com',
    name: 'yesnotice',
  },
  {
    description: 'weather without clutter',
    href: 'https://wthrtxt.com',
    name: 'wthrtxt',
  },
]

interface SiteHeaderProps {
  active?: 'studio'
}

export function SiteHeader({ active }: SiteHeaderProps) {
  const isStudio = active === 'studio'
  const contactEnabled = Boolean(getContactEmail())

  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="makestopmotion.com home">
        <img
          className="brand__logo"
          src="/brand/logo.svg"
          alt=""
          aria-hidden="true"
        />
      </a>
      <nav className="marketing-nav" aria-label="Primary navigation">
        <a href="/#how-it-works">How it works</a>
        <a href="/privacy">Privacy</a>
        {contactEnabled ? <a href="/contact">Contact</a> : null}
      </nav>
      <a className="header-cta" href={isStudio ? '/' : '/studio'}>
        {isStudio ? (
          <ArrowLeft size={15} aria-hidden="true" />
        ) : null}
        {isStudio ? 'Home' : 'Open studio'}
        {!isStudio ? (
          <ArrowRight size={15} aria-hidden="true" />
        ) : null}
      </a>
    </header>
  )
}

export function SiteFooter() {
  const contactEnabled = Boolean(getContactEmail())

  return (
    <footer className="site-footer">
      <div className="site-footer__links">
        <span>
          made by{' '}
          <a
            href="https://github.com/sponsors/schollz"
            rel="noreferrer"
            target="_blank"
          >
            schollz
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/schollz/makestopmotion"
          rel="noreferrer"
          target="_blank"
        >
          open source
        </a>
        <span aria-hidden="true">·</span>
        <span>
          deployed with{' '}
          <a href="https://disco.cloud/" rel="noreferrer" target="_blank">
            disco
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <a href="/privacy">privacy</a>
        <span aria-hidden="true">·</span>
        <a href="/terms">terms</a>
        <span aria-hidden="true">·</span>
        <button
          className="site-footer__privacy-button"
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT))
          }
        >
          privacy choices
        </button>
        {contactEnabled ? (
          <>
            <span aria-hidden="true">·</span>
            <a href="/contact">contact</a>
          </>
        ) : null}
      </div>

      <details className="tools-menu">
        <summary>other tools</summary>
        <ul>
          {OTHER_TOOLS.map((tool) => (
            <li key={tool.href}>
              <a href={tool.href} rel="noreferrer" target="_blank">
                <strong>{tool.name}</strong>
                <span>{tool.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </footer>
  )
}
