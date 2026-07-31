import { beforeEach, describe, expect, it, vi } from 'vitest'

const { forVisionTasks } = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks },
}))

import { resolveVisionFileset } from './vision-fileset'

describe('resolveVisionFileset', () => {
  beforeEach(() => {
    forVisionTasks.mockReset()
  })

  it('selects MediaPipe’s ES-module WASM loader for the module worker', () => {
    resolveVisionFileset('/wasm')

    expect(forVisionTasks).toHaveBeenCalledWith('/wasm', true)
  })
})
