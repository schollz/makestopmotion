import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { clearFrames } from './lib/frame-db'
import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from './types'

vi.mock('handtrackjs', () => ({
  ObjectDetection: class {
    modelPath = 'model.json '
    async load() {}
    async detect() {
      return []
    }
    dispose() {}
  },
}))

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

  it('persists the hands-free capture preference', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('checkbox', {
      name: 'Enable hands-free capture',
    })

    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(localStorage.getItem('stillframe-settings-v1')).toContain(
      '"autoCaptureEnabled":false',
    )
  })

  it('lets the user switch to Handtrack.js and remembers the choice', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const user = userEvent.setup()
    render(<App />)
    const detector = screen.getByRole('combobox', { name: /Hand detector/i })

    await user.selectOptions(detector, 'handtrack')

    expect(detector).toHaveValue('handtrack')
    expect(localStorage.getItem('stillframe-settings-v1')).toContain(
      '"handDetector":"handtrack"',
    )
  })

  it('lets the user switch to ml5 HandPose and remembers the choice', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    })

    const user = userEvent.setup()
    render(<App />)
    const detector = screen.getByRole('combobox', { name: /Hand detector/i })

    await user.selectOptions(detector, 'ml5')

    expect(detector).toHaveValue('ml5')
    expect(localStorage.getItem('stillframe-settings-v1')).toContain(
      '"handDetector":"ml5"',
    )
  })
})
