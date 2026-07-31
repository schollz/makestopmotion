import type { CapturePhase } from '../types'

export const HAND_ARM_DELAY_MS = 150

export interface CaptureMachineState {
  armed: boolean
  handSince: number | null
  lastHandSeenAt: number | null
}

export interface CaptureMachineOutput {
  state: CaptureMachineState
  phase: CapturePhase
  remainingMs: number
  shouldCapture: boolean
}

export const createCaptureMachineState = (): CaptureMachineState => ({
  armed: false,
  handSince: null,
  lastHandSeenAt: null,
})

export function resetCaptureMachine(): CaptureMachineState {
  return createCaptureMachineState()
}

export function updateCaptureMachine(
  state: CaptureMachineState,
  input: {
    now: number
    hasHand: boolean
    enabled: boolean
    clearDelayMs: number
  },
): CaptureMachineOutput {
  const { now, hasHand, enabled, clearDelayMs } = input

  if (!enabled) {
    return {
      state: createCaptureMachineState(),
      phase: 'waiting-for-hand',
      remainingMs: clearDelayMs,
      shouldCapture: false,
    }
  }

  if (hasHand) {
    const handSince = state.handSince ?? now
    const armed = state.armed || now - handSince >= HAND_ARM_DELAY_MS

    return {
      state: {
        armed,
        handSince,
        lastHandSeenAt: now,
      },
      phase: 'hand-present',
      remainingMs: clearDelayMs,
      shouldCapture: false,
    }
  }

  if (!state.armed || state.lastHandSeenAt === null) {
    return {
      state: {
        ...state,
        handSince: null,
      },
      phase: 'waiting-for-hand',
      remainingMs: clearDelayMs,
      shouldCapture: false,
    }
  }

  const clearForMs = Math.max(0, now - state.lastHandSeenAt)
  const remainingMs = Math.max(0, clearDelayMs - clearForMs)

  if (remainingMs === 0) {
    return {
      state: createCaptureMachineState(),
      phase: 'capturing',
      remainingMs: 0,
      shouldCapture: true,
    }
  }

  return {
    state: {
      ...state,
      handSince: null,
    },
    phase: 'clearing',
    remainingMs,
    shouldCapture: false,
  }
}
