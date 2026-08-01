import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { clearFrames } from './lib/frame-db'
import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from './types'

vi.mock('./lib/ml5-loader', () => ({
  loadMl5: vi.fn().mockResolvedValue({
    handPose: (_options: unknown, onReady?: () => void) => {
      const model = {
        detect: vi.fn().mockResolvedValue([]),
        detectStop: vi.fn(),
      }
      queueMicrotask(() => onReady?.())
      return model
    },
  }),
}))

class ReadyWorker {
  onmessage: ((event: MessageEvent<WorkerOutgoingMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(message: WorkerIncomingMessage) {
    if (message.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.(
          new MessageEvent('message', { data: { type: 'ready' } }),
        )
      })
    }
  }

  terminate() {}
}

describe('App camera safeguards', () => {
  beforeEach(async () => {
    localStorage.clear()
    await clearFrames()
    vi.stubGlobal('Worker', ReadyWorker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an actionable message when camera permission is denied', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Start camera' })[0],
      ).toBeEnabled()
    })
    await user.click(
      screen.getAllByRole('button', { name: 'Start camera' })[0],
    )

    expect(
      await screen.findByText(/Camera permission was denied/i),
    ).toBeInTheDocument()
    expect(getUserMedia).toHaveBeenCalledOnce()
  })

  it('persists the automatic capture stop preference', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const user = userEvent.setup()
    render(<App />)
    const ready = screen.getByRole('button', { name: 'Ready' })
    const stop = screen.getByRole('button', { name: 'Stop' })

    expect(ready).toHaveAttribute('aria-pressed', 'true')
    await user.click(stop)
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByText('Automatic capture is stopped. Take frame still works.'),
    ).toBeInTheDocument()
    expect(localStorage.getItem('stillframe-settings-v1')).toContain(
      '"autoCaptureEnabled":false',
    )
  })

  it('loads both fast hand detectors without exposing detector controls', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(
      screen.queryByRole('combobox', { name: /Hand detector/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Active hand detectors'),
    ).not.toBeInTheDocument()

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Start camera' })[0],
      ).toBeEnabled(),
    )
  })
})
