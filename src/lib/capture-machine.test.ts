import { describe, expect, it } from 'vitest'
import {
  createCaptureMachineState,
  updateCaptureMachine,
} from './capture-machine'

function update(
  state: ReturnType<typeof createCaptureMachineState>,
  now: number,
  hasHand: boolean,
  clearDelayMs = 500,
  enabled = true,
) {
  return updateCaptureMachine(state, {
    now,
    hasHand,
    clearDelayMs,
    enabled,
  })
}

describe('capture machine', () => {
  it('never captures before a hand has armed the cycle', () => {
    const output = update(createCaptureMachineState(), 10_000, false)
    expect(output.phase).toBe('waiting-for-hand')
    expect(output.shouldCapture).toBe(false)
    expect(output.state.armed).toBe(false)
  })

  it('requires a stable hand before arming', () => {
    const first = update(createCaptureMachineState(), 0, true)
    const tooSoon = update(first.state, 149, true)
    const armed = update(tooSoon.state, 150, true)

    expect(first.state.armed).toBe(false)
    expect(tooSoon.state.armed).toBe(false)
    expect(armed.state.armed).toBe(true)
  })

  it('captures after the configured clear delay', () => {
    const first = update(createCaptureMachineState(), 0, true)
    const armed = update(first.state, 150, true)
    const almost = update(armed.state, 649, false)
    const capture = update(almost.state, 650, false)

    expect(almost.phase).toBe('clearing')
    expect(almost.remainingMs).toBe(1)
    expect(capture.shouldCapture).toBe(true)
    expect(capture.phase).toBe('capturing')
  })

  it('cancels the countdown when a hand returns', () => {
    const first = update(createCaptureMachineState(), 0, true)
    const armed = update(first.state, 150, true)
    const clearing = update(armed.state, 400, false)
    const returned = update(clearing.state, 500, true)
    const stillWaiting = update(returned.state, 900, false)
    const capture = update(stillWaiting.state, 1_000, false)

    expect(returned.phase).toBe('hand-present')
    expect(stillWaiting.shouldCapture).toBe(false)
    expect(capture.shouldCapture).toBe(true)
  })

  it('captures only once until a hand returns and arms again', () => {
    const first = update(createCaptureMachineState(), 0, true)
    const armed = update(first.state, 150, true)
    const capture = update(armed.state, 650, false)
    const continuedAbsence = update(capture.state, 2_000, false)

    expect(capture.shouldCapture).toBe(true)
    expect(continuedAbsence.shouldCapture).toBe(false)
    expect(continuedAbsence.phase).toBe('waiting-for-hand')
  })

  it('resets safely when auto capture is disabled', () => {
    const first = update(createCaptureMachineState(), 0, true)
    const armed = update(first.state, 150, true)
    const disabled = update(armed.state, 1_000, false, 500, false)

    expect(disabled.shouldCapture).toBe(false)
    expect(disabled.state.armed).toBe(false)
    expect(disabled.phase).toBe('waiting-for-hand')
  })

  it('uses an updated delay without retaining the old countdown', () => {
    const first = update(createCaptureMachineState(), 0, true, 1_000)
    const armed = update(first.state, 150, true, 1_000)
    const clearing = update(armed.state, 650, false, 1_000)
    const capture = update(clearing.state, 750, false, 500)

    expect(capture.shouldCapture).toBe(true)
  })
})
