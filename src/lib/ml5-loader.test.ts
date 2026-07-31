import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ml5Api } from '../ml5-global'

describe('loadMl5', () => {
  afterEach(() => {
    document.getElementById('ml5-library-script')?.remove()
    delete window.ml5
    vi.resetModules()
  })

  it('loads the pinned browser bundle with an integrity check', async () => {
    const { loadMl5 } = await import('./ml5-loader')
    const loading = loadMl5()
    const script = document.getElementById('ml5-library-script')

    expect(script).toBeInstanceOf(HTMLScriptElement)
    expect(script).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/npm/ml5@1.3.1/dist/ml5.min.js',
    )
    expect(script).toHaveAttribute(
      'integrity',
      'sha384-NgzCgVhddHQwesiM5Dq8em6DAvdTY+QeVyoFKp5puZW69cfMYRBCep1t37Ibt8S0',
    )

    const api = { handPose: vi.fn() } as unknown as Ml5Api
    window.ml5 = api
    script?.dispatchEvent(new Event('load'))

    await expect(loading).resolves.toBe(api)
  })
})
