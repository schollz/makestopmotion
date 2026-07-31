import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createAudioContextMock(state: AudioContextState = 'running') {
  const sources: Array<{
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }> = []
  const resume = vi.fn().mockResolvedValue(undefined)

  class AudioContextMock {
    currentTime = 1
    destination = {}
    sampleRate = 1_000
    state = state
    resume = resume

    createBuffer(_channels: number, length: number) {
      return {
        getChannelData: () => new Float32Array(length),
      }
    }

    createBufferSource() {
      const source = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      sources.push(source)
      return source
    }

    createBiquadFilter() {
      return {
        type: '',
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(),
      }
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
    }
  }

  return { AudioContextMock, resume, sources }
}

describe('capture sound', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays a distinct two-click shutter sound', async () => {
    const { AudioContextMock, sources } = createAudioContextMock()
    vi.stubGlobal('AudioContext', AudioContextMock)

    const { playCaptureSound } = await import('./capture-sound')
    playCaptureSound()

    expect(sources).toHaveLength(2)
    expect(
      sources.every(
        ({ start, stop }) =>
          start.mock.calls.length === 1 && stop.mock.calls.length === 1,
      ),
    ).toBe(true)
  })

  it('unlocks a suspended audio context while starting the camera', async () => {
    const { AudioContextMock, resume } = createAudioContextMock('suspended')
    vi.stubGlobal('AudioContext', AudioContextMock)

    const { prepareCaptureSound } = await import('./capture-sound')
    prepareCaptureSound()

    expect(resume).toHaveBeenCalledOnce()
  })
})
