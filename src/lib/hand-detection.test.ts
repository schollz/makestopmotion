import { describe, expect, it } from 'vitest'
import {
  anyHandDetectorVotedYes,
  didDetectedHandClear,
} from './hand-detection'

describe('combined hand detection', () => {
  it.each([
    { mediapipe: true, ml5: false },
    { mediapipe: false, ml5: true },
  ])('detects a hand when any one model votes yes', (votes) => {
    expect(anyHandDetectorVotedYes(votes)).toBe(true)
  })

  it('reports a clear frame only when every model votes no', () => {
    expect(
      anyHandDetectorVotedYes({
        mediapipe: false,
        ml5: false,
      }),
    ).toBe(false)
  })

  it('signals hand clear only on the detected-to-clear transition', () => {
    expect(didDetectedHandClear(true, false)).toBe(true)
    expect(didDetectedHandClear(false, false)).toBe(false)
    expect(didDetectedHandClear(true, true)).toBe(false)
    expect(didDetectedHandClear(false, true)).toBe(false)
  })
})
