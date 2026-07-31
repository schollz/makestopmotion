import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FrameRecord } from '../types'
import { PreviewModal } from './PreviewModal'

function frame(id: string, sequence: number): FrameRecord {
  return {
    id,
    projectId: 'project-one',
    sequence,
    capturedAt: sequence * 1_000,
    width: 1280,
    height: 720,
    imageBlob: new Blob([id], { type: 'image/jpeg' }),
    thumbnailBlob: new Blob([id], { type: 'image/jpeg' }),
  }
}

describe('PreviewModal', () => {
  it('keeps preview available when native video export is unsupported', () => {
    render(
      <PreviewModal
        frames={[frame('one', 1), frame('two', 2)]}
        fps={8}
        onFpsChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Preview your motion')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop-motion preview')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download video' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Video download is not supported/i),
    ).toBeInTheDocument()
  })
})
