import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import MarketingApp, { type MarketingRoute } from './MarketingApp.tsx'
import { PrivacyNotice } from './components/PrivacyNotice.tsx'

export const StudioApp = lazy(() => import('./App.tsx'))

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
const marketingRoutes: Record<string, MarketingRoute> = {
  '/': 'home',
  '/contact': 'contact',
  '/privacy': 'privacy',
  '/terms': 'terms',
}
const route = marketingRoutes[normalizedPath]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      {normalizedPath === '/studio' ? (
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              Preparing your browser studio…
            </div>
          }
        >
          <StudioApp />
        </Suspense>
      ) : (
        <MarketingApp route={route ?? 'home'} />
      )}
      <PrivacyNotice />
    </>
  </StrictMode>,
)
