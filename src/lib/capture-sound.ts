type SafariWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

let audioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextConstructor =
    window.AudioContext ?? (window as SafariWindow).webkitAudioContext

  if (!AudioContextConstructor) return null

  try {
    audioContext ??= new AudioContextConstructor()
    return audioContext
  } catch {
    return null
  }
}

function makeClick(context: AudioContext, startAt: number, duration: number) {
  const frameCount = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let index = 0; index < samples.length; index += 1) {
    const decay = 1 - index / samples.length
    samples[index] = (Math.random() * 2 - 1) * decay
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = 1_800
  filter.Q.value = 0.7
  gain.gain.setValueAtTime(0.5, startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)
  source.start(startAt)
  source.stop(startAt + duration)
}

function soundShutter(context: AudioContext) {
  const startAt = context.currentTime + 0.01

  // Two contrasting impacts read as a camera shutter, even on small speakers.
  makeClick(context, startAt, 0.06)
  makeClick(context, startAt + 0.1, 0.09)
}

function soundHandClear(context: AudioContext) {
  const duration = 0.2
  const startAt = context.currentTime + 0.01
  const frameCount = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / context.sampleRate
    const attack = Math.min(1, time / 0.008)
    const decay = Math.exp(-14 * time)
    const fundamental = Math.sin(2 * Math.PI * 1_046.5 * time)
    const overtone = Math.sin(2 * Math.PI * 2_093 * time) * 0.24
    samples[index] = (fundamental + overtone) * attack * decay
  }

  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(0.045, startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)
  source.connect(gain)
  gain.connect(context.destination)
  source.start(startAt)
  source.stop(startAt + duration)
}

/** Unlock Web Audio from the user gesture that starts the camera. */
export function prepareCaptureSound() {
  const context = getAudioContext()
  if (context?.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

/** Play a local, synthesized shutter sound without delaying capture. */
export function playCaptureSound() {
  const context = getAudioContext()
  if (!context) return

  if (context.state === 'suspended') {
    void context
      .resume()
      .then(() => soundShutter(context))
      .catch(() => undefined)
    return
  }

  soundShutter(context)
}

/** Play a quiet local cue when the detected hand leaves the camera view. */
export function playHandClearSound() {
  const context = getAudioContext()
  if (!context) return

  if (context.state === 'suspended') {
    void context
      .resume()
      .then(() => soundHandClear(context))
      .catch(() => undefined)
    return
  }

  soundHandClear(context)
}
