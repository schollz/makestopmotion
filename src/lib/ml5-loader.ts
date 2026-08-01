import type { Ml5Api } from '../ml5-global'

const ML5_SCRIPT_ID = 'ml5-library-script'
const ML5_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/ml5@1.3.1/dist/ml5.min.js'
const ML5_SCRIPT_INTEGRITY =
  'sha384-NgzCgVhddHQwesiM5Dq8em6DAvdTY+QeVyoFKp5puZW69cfMYRBCep1t37Ibt8S0'
const LOG_PREFIX = '[hand-detection][ml5-loader]'

let loadingMl5: Promise<Ml5Api> | null = null

export function loadMl5(): Promise<Ml5Api> {
  if (window.ml5) {
    console.info(`${LOG_PREFIX} using existing browser API`)
    return Promise.resolve(window.ml5)
  }
  if (loadingMl5) {
    console.info(`${LOG_PREFIX} reusing in-flight script request`)
    return loadingMl5
  }

  const startedAt = performance.now()
  loadingMl5 = new Promise<Ml5Api>((resolve, reject) => {
    const existing = document.getElementById(ML5_SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script')

    const handleLoad = () => {
      if (window.ml5) {
        console.info(`${LOG_PREFIX} script ready`, {
          elapsedMs: Math.round(performance.now() - startedAt),
          url: ML5_SCRIPT_URL,
        })
        resolve(window.ml5)
      } else {
        console.error(`${LOG_PREFIX} script loaded without window.ml5`)
        reject(new Error('The ml5.js script loaded without its browser API.'))
      }
    }
    const handleError = () => {
      script.remove()
      console.error(`${LOG_PREFIX} script download failed`, {
        elapsedMs: Math.round(performance.now() - startedAt),
        url: ML5_SCRIPT_URL,
      })
      reject(new Error('The ml5.js library download failed.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existing) {
      console.info(`${LOG_PREFIX} downloading script`, { url: ML5_SCRIPT_URL })
      script.id = ML5_SCRIPT_ID
      script.src = ML5_SCRIPT_URL
      script.setAttribute('integrity', ML5_SCRIPT_INTEGRITY)
      script.crossOrigin = 'anonymous'
      script.referrerPolicy = 'no-referrer'
      document.head.append(script)
    } else {
      console.info(`${LOG_PREFIX} waiting for existing script element`, {
        url: script.src,
      })
    }
  }).catch((error) => {
    loadingMl5 = null
    throw error
  })

  return loadingMl5
}
