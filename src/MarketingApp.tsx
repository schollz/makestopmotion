import {
  ArrowRight,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'
import './App.css'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { getContactEmail, getSitePageUrl } from './lib/site-config'

export type MarketingRoute = 'home' | 'privacy' | 'terms' | 'contact'

const PAGE_META: Record<
  MarketingRoute,
  { description: string; path: string; title: string }
> = {
  home: {
    description:
      'Create stop motion animation online with your webcam. Capture frames hands-free, preview your movie, and export it free—no account or uploads required.',
    path: '/',
    title: 'Free Online Stop Motion Maker | makestopmotion.com',
  },
  privacy: {
    description:
      'Learn how makestopmotion.com keeps camera frames and stop motion projects on your device, under your control.',
    path: '/privacy',
    title: 'Privacy | makestopmotion.com',
  },
  terms: {
    description:
      'Terms of use for the free, browser-based makestopmotion.com stop motion studio.',
    path: '/terms',
    title: 'Terms of Use | makestopmotion.com',
  },
  contact: {
    description:
      'Contact the maker of makestopmotion.com with questions, feedback, or bug reports.',
    path: '/contact',
    title: 'Contact | makestopmotion.com',
  },
}

function usePageMetadata(route: MarketingRoute) {
  useEffect(() => {
    const meta = PAGE_META[route]
    const url = getSitePageUrl(meta.path)
    document.title = meta.title

    const updateMeta = (selector: string, value: string) => {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
    }

    updateMeta('meta[name="description"]', meta.description)
    updateMeta('meta[property="og:title"]', meta.title)
    updateMeta('meta[property="og:description"]', meta.description)
    updateMeta('meta[property="og:url"]', url)
    updateMeta('meta[name="twitter:title"]', meta.title)
    updateMeta('meta[name="twitter:description"]', meta.description)
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', url)
  }, [route])
}

function LandingPage() {
  return (
    <main id="top" className="marketing-main">
      <section className="site-intro" aria-labelledby="site-title">
        <div className="site-intro__copy">
          <span className="site-intro__kicker">
            Free online stop motion maker
          </span>
          <h1 id="site-title">Make things move.</h1>
          <p>
            Create stop motion with your webcam—hands-free, private, and
            entirely in your browser.
          </p>
          <div className="site-intro__actions">
            <a className="button button--accent" href="/studio">
              Open the studio
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="button button--light" href="#how-it-works">
              See how it works
            </a>
          </div>
          <div className="site-intro__features" aria-label="Product benefits">
            <span>Free</span>
            <span>No uploads</span>
            <span>No account</span>
          </div>
        </div>
        <div className="site-intro__art">
          <img
            src="/brand/hero-clay-studio.webp"
            alt="Colorful clay characters posing frame by frame in a tiny animation studio"
            width="1400"
            height="735"
            fetchPriority="high"
          />
        </div>
      </section>

      <section
        id="how-it-works"
        className="landing-section how-it-works"
        aria-labelledby="how-it-works-title"
      >
        <header className="landing-section__heading">
          <span className="landing-kicker">Hands-free by design</span>
          <h2 id="how-it-works-title">Your hand is the shutter.</h2>
          <p>
            No remote, timer routine, or repeated camera tapping. The
            on-device hand detectors know when you are working and when the set
            is clear. A detection from any one of them pauses capture.
          </p>
        </header>

        <div className="how-grid">
          <article className="how-card">
            <div className="how-card__image">
              <img
                src="/brand/how-it-works/01-hand-detected.webp"
                alt="Cartoon hand with blue landmark dots being detected beside an orange clay character"
                width="900"
                height="675"
                loading="lazy"
              />
            </div>
            <div className="how-card__body">
              <span className="how-card__number">01</span>
              <h3>Show your hand</h3>
              <p>
                Bring a hand into view. The browser recognizes it and pauses
                capture while you work.
              </p>
            </div>
          </article>

          <article className="how-card">
            <div className="how-card__image">
              <img
                src="/brand/how-it-works/02-adjust-scene.webp"
                alt="Tracked cartoon hand repositioning an orange clay character"
                width="900"
                height="675"
                loading="lazy"
              />
            </div>
            <div className="how-card__body">
              <span className="how-card__number">02</span>
              <h3>Make your move</h3>
              <p>
                Repose a character or adjust a prop at your own pace. Your hand
                stays out of every captured frame.
              </p>
            </div>
          </article>

          <article className="how-card">
            <div className="how-card__image">
              <img
                src="/brand/how-it-works/03-capture-frame.webp"
                alt="Orange clay character captured after the tracked hand moves outside the frame"
                width="900"
                height="675"
                loading="lazy"
              />
            </div>
            <div className="how-card__body">
              <span className="how-card__number">03</span>
              <h3>Move clear</h3>
              <p>
                When your hand leaves, the chosen delay runs and one clean
                frame is captured. Bring your hand back to begin again.
              </p>
            </div>
          </article>
        </div>

      </section>

      <section
        id="privacy-overview"
        className="privacy-section"
        aria-labelledby="privacy-overview-title"
      >
        <div className="privacy-section__copy">
          <span className="landing-kicker">Local means local</span>
          <h2 id="privacy-overview-title">
            Your work never becomes our data.
          </h2>
          <p className="privacy-section__lead">
            No camera frames, captured photos, or projects are stored on a
            server—ever. The creative workflow runs on the device in front of
            you.
          </p>

          <ul className="privacy-list">
            <li>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>
                <strong>Detection stays on-device.</strong> Your live camera
                feed is processed by two models running inside this browser.
              </span>
            </li>
            <li>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>
                <strong>Projects stay in browser storage.</strong> Frames are
                saved only in IndexedDB on this browser and this device.
              </span>
            </li>
            <li>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>
                <strong>You decide what leaves.</strong> Downloads happen only
                when you export a video or frame yourself.
              </span>
            </li>
            <li>
              <ShieldCheck size={19} aria-hidden="true" />
              <span>
                <strong>You can erase it.</strong> Clear frames, delete a
                project, or remove the site’s browser data whenever you want.
              </span>
            </li>
          </ul>

          <a className="privacy-section__link" href="/privacy">
            Read the full privacy policy
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

      </section>
    </main>
  )
}

function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <header className="content-page__intro">
      <span className="landing-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  )
}

function PrivacyPage({ contactEmail }: { contactEmail: string }) {
  return (
    <main id="top" className="content-page">
      <PageIntro eyebrow="Privacy policy" title="Your camera roll is yours.">
        makestopmotion.com is designed so making a movie does not require
        giving us your footage. This policy explains what stays local and the
        few cases where information leaves your browser.
      </PageIntro>

      <article className="policy-card" aria-label="Privacy policy">
        <p className="policy-card__updated">Last updated July 31, 2026</p>

        <section>
          <h2>Camera and project data</h2>
          <p>
            Camera frames are processed in your browser for hand detection.
            Captured frames, project names, ordering, and preferences are kept
            in browser storage on your device. We do not upload or store that
            material on a makestopmotion.com server.
          </p>
        </section>

        <section>
          <h2>Exports and deletion</h2>
          <p>
            A frame or movie leaves browser storage only when you choose to
            download it. You can delete individual frames, clear a project, or
            remove all makestopmotion.com site data through your browser. We
            cannot recover locally deleted work because we do not have a copy.
          </p>
        </section>

        <section>
          <h2>Site requests and detector files</h2>
          <p>
            Your browser must request the website files needed to run the app.
            As with any website, the hosting provider may receive ordinary
            request information such as an IP address, browser details, and a
            timestamp. MediaPipe and ml5 HandPose both run locally after their
            files load. Library and model files may be requested from jsDelivr
            and the model hosts used by TensorFlow.js; your camera feed is still
            not sent with those requests.
          </p>
        </section>

        <section>
          <h2>Optional site analytics</h2>
          <p>
            The site may use Umami to understand aggregate page visits and
            improve the service. When enabled, the browser sends ordinary
            pageview and request information to the configured Umami service.
            Camera frames, captured photos, project names, and exported movies
            are never included in analytics.
          </p>
        </section>

        {contactEmail ? (
          <>
            <section>
              <h2>Contact form</h2>
              <p>
                The contact page is the exception to the browser-only workflow.
                If you submit it, the name, email address, and message you enter
                are sent to the Subsnail form service so the site operator can
                read and reply. Do not include camera frames or other sensitive
                information in that form.
              </p>
            </section>

            <section>
              <h2>Questions</h2>
              <p>
                Questions about this policy can be sent through the{' '}
                <a href="/contact">contact page</a> or directly to{' '}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </p>
            </section>
          </>
        ) : null}
      </article>
    </main>
  )
}

function TermsPage({ contactEmail }: { contactEmail: string }) {
  return (
    <main id="top" className="content-page">
      <PageIntro eyebrow="Terms of use" title="Make responsibly.">
        These terms cover your use of the free makestopmotion.com website and
        browser studio.
      </PageIntro>

      <article className="policy-card" aria-label="Terms of use">
        <p className="policy-card__updated">Last updated July 31, 2026</p>

        <section>
          <h2>Using the service</h2>
          <p>
            By using makestopmotion.com, you agree to these terms. You may use
            the service for lawful personal, educational, or commercial
            projects. You may not use it to violate another person’s rights,
            break applicable law, interfere with the website, or distribute
            malicious material.
          </p>
        </section>

        <section>
          <h2>Your work and your device</h2>
          <p>
            You retain responsibility for the images and movies you create.
            Projects are stored locally in your browser, so you are responsible
            for exporting anything you want to keep and for obtaining consent
            before recording other people. Clearing browser data, changing
            browsers, device failure, or storage limits can remove local work.
          </p>
        </section>

        <section>
          <h2>Camera access</h2>
          <p>
            The studio needs browser permission to use a camera. You control
            that permission through your browser or operating system and may
            revoke it at any time.
          </p>
        </section>

        <section>
          <h2>Open source and third-party software</h2>
          <p>
            The website is{' '}
            <a href="https://github.com/schollz/makestopmotion">
              open source
            </a>{' '}
            and includes third-party libraries governed by their own licenses.
            Links to other websites and services are provided for convenience;
            their own terms and policies apply.
          </p>
        </section>

        <section>
          <h2>No warranty</h2>
          <p>
            The service is provided “as is” and “as available,” without
            warranties of uninterrupted operation, compatibility, or fitness
            for a particular purpose. To the fullest extent allowed by law,
            the project’s maintainers are not liable for lost local data,
            failed exports, device issues, or other indirect or consequential
            damages resulting from use of the service.
          </p>
        </section>

        <section>
          <h2>{contactEmail ? 'Changes and contact' : 'Changes'}</h2>
          <p>
            The service and these terms may change over time. The current
            version will be posted here with its revision date.
            {contactEmail ? (
              <>
                {' '}Questions can be sent through the{' '}
                <a href="/contact">contact page</a>.
              </>
            ) : null}
          </p>
        </section>
      </article>
    </main>
  )
}

function ContactPage({ contactEmail }: { contactEmail: string }) {
  useEffect(() => {
    const scriptUrl = 'https://subsnail.schollz.com/form/embed.js'
    if (document.querySelector(`script[src="${scriptUrl}"]`)) return

    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <main id="top" className="content-page">
      <PageIntro eyebrow="Contact" title="Say hello.">
        Found a bug, made something delightful, or have an idea for the
        studio? Send a note.
      </PageIntro>

      <section className="contact-card" aria-labelledby="contact-form-title">
        <div className="contact-card__aside">
          <Mail size={28} aria-hidden="true" />
          <h2 id="contact-form-title">Get in touch</h2>
          <p>
            Use the form or email{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
          <p className="contact-card__privacy">
            Form submissions are sent through Subsnail. Your camera projects
            and local frames are never attached or uploaded.
          </p>
        </div>

        <form
          className="contact-form"
          data-subsnail="https://subsnail.schollz.com/form/11764a50-79f7-4c71-aa45-ad7e78b39b55/subscribe/"
        >
          <div className="contact-form__names">
            <label>
              <span>First name</span>
              <input type="text" name="first_name" placeholder="First name" />
            </label>
            <label>
              <span>Last name</span>
              <input type="text" name="last_name" placeholder="Last name" />
            </label>
          </div>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            <span>Message</span>
            <textarea
              name="textarea"
              placeholder="Your message"
              rows={7}
              required
            />
          </label>
          <button className="button button--accent" type="submit">
            Send message
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  )
}

export default function MarketingApp({ route }: { route: MarketingRoute }) {
  const contactEmail = getContactEmail()
  const activeRoute = route === 'contact' && !contactEmail ? 'home' : route
  usePageMetadata(activeRoute)

  return (
    <div className={`app marketing-page marketing-page--${activeRoute}`}>
      <SiteHeader />
      {activeRoute === 'privacy' ? <PrivacyPage contactEmail={contactEmail} /> : null}
      {activeRoute === 'terms' ? <TermsPage contactEmail={contactEmail} /> : null}
      {activeRoute === 'contact' ? <ContactPage contactEmail={contactEmail} /> : null}
      {activeRoute === 'home' ? <LandingPage /> : null}
      <SiteFooter />
    </div>
  )
}
