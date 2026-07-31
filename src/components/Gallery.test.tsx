import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FrameRecord } from '../types'
import { Gallery } from './Gallery'

const frame: FrameRecord = {
  id: 'frame-one',
  projectId: 'project-one',
  sequence: 1,
  capturedAt: new Date('2026-07-31T12:00:00Z').getTime(),
  width: 1280,
  height: 720,
  imageBlob: new Blob(['image'], { type: 'image/jpeg' }),
  thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
}

const secondFrame: FrameRecord = {
  ...frame,
  id: 'frame-two',
  sequence: 2,
}

describe('Gallery', () => {
  it('explains the hands-free workflow when empty', () => {
    render(
      <Gallery
        frames={[]}
        onDelete={vi.fn()}
        onDownload={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Your frames will appear here'),
    ).toBeInTheDocument()
    expect(screen.getByText(/move clear/i)).toBeInTheDocument()
  })

  it('shows frame metadata and recovery actions', () => {
    render(
      <Gallery
        frames={[frame]}
        onDelete={vi.fn()}
        onDownload={vi.fn()}
        onReorder={vi.fn()}
      />,
    )
    expect(screen.getByText('Frame 1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download frame 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete frame 1' }),
    ).toBeInTheDocument()
  })

  it('moves frames with accessible reorder controls', async () => {
    const onReorder = vi.fn()
    const user = userEvent.setup()
    render(
      <Gallery
        frames={[frame, secondFrame]}
        onDelete={vi.fn()}
        onDownload={vi.fn()}
        onReorder={onReorder}
      />,
    )

    expect(
      screen.getByText(/drag toward either edge/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Move frame 1 earlier' }),
    ).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Move frame 2 earlier' }),
    )
    expect(onReorder).toHaveBeenCalledWith('frame-two', 'frame-one')
  })

  it('shows the exact drop edge and confirms the destination', () => {
    const onReorder = vi.fn()
    render(
      <Gallery
        frames={[frame, secondFrame]}
        onDelete={vi.fn()}
        onDownload={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const [firstCard, secondCard] = screen.getAllByRole('article')
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      getData: vi.fn(() => 'frame-one'),
      setData: vi.fn(),
      setDragImage: vi.fn(),
    }
    vi.spyOn(secondCard, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 100,
      right: 200,
      top: 0,
      width: 100,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.dragStart(firstCard, { dataTransfer })
    fireEvent.dragOver(secondCard, { clientX: 190, dataTransfer })

    expect(secondCard).toHaveClass('frame-card--drop-after')

    fireEvent.drop(secondCard, { clientX: 190, dataTransfer })

    expect(onReorder).toHaveBeenCalledWith('frame-one', 'frame-two')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Frame moved to position 2.',
    )
    expect(firstCard).toHaveTextContent('Moved here')
  })
})
