import { describe, expect, it } from 'vitest'
import type { FrameRecord } from '../types'
import { reorderFrames } from './frame-order'

function makeFrame(id: string, sequence: number): FrameRecord {
  return {
    id,
    projectId: 'project-one',
    sequence,
    capturedAt: sequence * 1_000,
    width: 1280,
    height: 720,
    imageBlob: new Blob([id]),
    thumbnailBlob: new Blob([id]),
  }
}

const frames = [
  makeFrame('one', 1),
  makeFrame('two', 2),
  makeFrame('three', 3),
]

describe('reorderFrames', () => {
  it('moves a frame and renumbers the resulting sequence', () => {
    const reordered = reorderFrames(frames, 'three', 'one')

    expect(reordered.map(({ id }) => id)).toEqual(['three', 'one', 'two'])
    expect(reordered.map(({ sequence }) => sequence)).toEqual([1, 2, 3])
  })

  it('returns the existing sequence when a frame cannot move', () => {
    expect(reorderFrames(frames, 'missing', 'one')).toBe(frames)
    expect(reorderFrames(frames, 'two', 'two')).toBe(frames)
  })
})
