import type { Ml5Api } from '../ml5-global'

const ML5_SCRIPT_ID = 'ml5-library-script'
const ML5_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/ml5@1.3.1/dist/ml5.min.js'
const ML5_SCRIPT_INTEGRITY =
  'sha384-NgzCgVhddHQwesiM5Dq8em6DAvdTY+QeVyoFKp5puZW69cfMYRBCep1t37Ibt8S0'

let loadingMl5: Promise<Ml5Api> | null = null

export function loadMl5(): Promise<Ml5Api> {
  if (window.ml5) return Promise.resolve(window.ml5)
  if (loadingMl5) return loadingMl5

  loadingMl5 = new Promise<Ml5Api>((resolve, reject) => {
    const existing = document.getElementById(ML5_SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script')

    const handleLoad = () => {
      if (window.ml5) {
        resolve(window.ml5)
      } else {
        reject(new Error('The ml5.js script loaded without its browser API.'))
      }
    }
    const handleError = () => {
      script.remove()
      reject(new Error('The ml5.js library download failed.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existing) {
      script.id = ML5_SCRIPT_ID
      script.src = ML5_SCRIPT_URL
      script.setAttribute('integrity', ML5_SCRIPT_INTEGRITY)
      script.crossOrigin = 'anonymous'
      script.referrerPolicy = 'no-referrer'
      document.head.append(script)
    }
  }).catch((error) => {
    loadingMl5 = null
    throw error
  })

  return loadingMl5
}
