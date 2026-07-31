import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  ImageIcon,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useObjectUrl } from '../hooks/use-object-url'
import type { FrameRecord } from '../types'

interface GalleryProps {
  frames: FrameRecord[]
  onDelete: (frame: FrameRecord) => void
  onDownload: (frame: FrameRecord) => void
  onReorder: (activeId: string, overId: string) => void
}

type DropEdge = 'before' | 'after'

interface DropTarget {
  frameId: string
  edge: DropEdge
}

function pointerEdge(element: HTMLElement, clientX: number): DropEdge {
  const bounds = element.getBoundingClientRect()
  return clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
}

function destinationIndexForDrop(
  frames: FrameRecord[],
  activeId: string,
  target: DropTarget,
): number | null {
  const activeIndex = frames.findIndex(({ id }) => id === activeId)
  const targetIndex = frames.findIndex(({ id }) => id === target.frameId)
  if (activeIndex === -1 || targetIndex === -1) return null

  const insertionSlot = targetIndex + (target.edge === 'after' ? 1 : 0)
  const destinationIndex =
    insertionSlot > activeIndex ? insertionSlot - 1 : insertionSlot

  return Math.max(0, Math.min(frames.length - 1, destinationIndex))
}

function FrameCard({
  frame,
  index,
  frameCount,
  previousId,
  nextId,
  onDelete,
  onDownload,
  onMove,
  draggedId,
  dropTarget,
  isRecentlyMoved,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  frame: FrameRecord
  index: number
  frameCount: number
  previousId: string | null
  nextId: string | null
  onDelete: (frame: FrameRecord) => void
  onDownload: (frame: FrameRecord) => void
  onMove: (
    activeId: string,
    overId: string,
    destinationIndex: number,
  ) => void
  draggedId: string | null
  dropTarget: DropTarget | null
  isRecentlyMoved: boolean
  onDragStart: (event: DragEvent<HTMLElement>, frameId: string) => void
  onDragOver: (event: DragEvent<HTMLElement>, frameId: string) => void
  onDrop: (event: DragEvent<HTMLElement>, frameId: string) => void
  onDragEnd: () => void
}) {
  const thumbnailUrl = useObjectUrl(frame.thumbnailBlob)
  const capturedTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(frame.capturedAt)
  const isDragging = draggedId === frame.id
  const dropEdge =
    dropTarget?.frameId === frame.id && !isDragging
      ? dropTarget.edge
      : null

  return (
    <article
      className={`frame-card${isDragging ? ' frame-card--dragging' : ''}${dropEdge ? ` frame-card--drop-${dropEdge}` : ''}${isRecentlyMoved ? ' frame-card--just-moved' : ''}`}
      data-frame-id={frame.id}
      draggable
      onDragStart={(event) => onDragStart(event, frame.id)}
      onDragOver={(event) => onDragOver(event, frame.id)}
      onDrop={(event) => onDrop(event, frame.id)}
      onDragEnd={onDragEnd}
    >
      <div className="frame-card__image">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Captured frame ${frame.sequence}`}
            draggable="false"
          />
        ) : null}
        <span className="frame-card__number">
          {String(frame.sequence).padStart(2, '0')}
        </span>
        {frameCount > 1 ? (
          <span className="frame-card__drag-cue" aria-hidden="true">
            <GripVertical size={14} />
            Drag
          </span>
        ) : null}
        {isRecentlyMoved ? (
          <span className="frame-card__move-confirmation" aria-hidden="true">
            <Check size={14} strokeWidth={2.5} />
            Moved here
          </span>
        ) : null}
      </div>
      <div className="frame-card__meta">
        <div>
          <strong>Frame {frame.sequence}</strong>
          <span>{capturedTime}</span>
        </div>
        <div className="frame-card__actions">
          {frameCount > 1 ? (
            <>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  if (previousId) onMove(frame.id, previousId, index - 1)
                }}
                aria-label={`Move frame ${frame.sequence} earlier`}
                title="Move earlier"
                disabled={index === 0}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  if (nextId) onMove(frame.id, nextId, index + 1)
                }}
                aria-label={`Move frame ${frame.sequence} later`}
                title="Move later"
                disabled={index === frameCount - 1}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </>
          ) : null}
          <button
            className="icon-button"
            type="button"
            onClick={() => onDownload(frame)}
            aria-label={`Download frame ${frame.sequence}`}
            title="Download photo"
          >
            <Download size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            onClick={() => onDelete(frame)}
            aria-label={`Delete frame ${frame.sequence}`}
            title="Delete frame"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export function Gallery({
  frames,
  onDelete,
  onDownload,
  onReorder,
}: GalleryProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)
  const [moveAnnouncement, setMoveAnnouncement] = useState('')
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    },
    [],
  )

  if (frames.length === 0) {
    return (
      <div className="empty-gallery">
        <div className="empty-gallery__icon">
          <ImageIcon size={24} aria-hidden="true" />
        </div>
        <div>
          <strong>Your frames will appear here</strong>
          <p>
            Show the camera your hand, make an adjustment, then move clear.
          </p>
        </div>
      </div>
    )
  }

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    frameId: string,
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', frameId)
    event.dataTransfer.setDragImage(
      event.currentTarget,
      event.currentTarget.offsetWidth / 2,
      28,
    )
    setDraggedId(frameId)
    setDropTarget(null)
  }

  const handleDragOver = (
    event: DragEvent<HTMLElement>,
    frameId: string,
  ) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const nextTarget: DropTarget = {
      frameId,
      edge: pointerEdge(event.currentTarget, event.clientX),
    }
    setDropTarget((current) =>
      current?.frameId === nextTarget.frameId &&
      current.edge === nextTarget.edge
        ? current
        : nextTarget,
    )
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDropTarget(null)
  }

  const showMoveConfirmation = (frameId: string, destinationIndex: number) => {
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    setRecentlyMovedId(frameId)
    setMoveAnnouncement(`Frame moved to position ${destinationIndex + 1}.`)
    confirmationTimer.current = setTimeout(() => {
      setRecentlyMovedId(null)
      confirmationTimer.current = null
    }, 1_250)
  }

  const handleMove = (
    activeId: string,
    overId: string,
    destinationIndex: number,
  ) => {
    if (activeId === overId) return
    onReorder(activeId, overId)
    showMoveConfirmation(activeId, destinationIndex)
  }

  const dropAtTarget = (
    event: DragEvent<HTMLElement>,
    target: DropTarget | null,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const activeId = event.dataTransfer.getData('text/plain') || draggedId
    if (activeId && target) {
      const destinationIndex = destinationIndexForDrop(
        frames,
        activeId,
        target,
      )
      if (destinationIndex !== null) {
        const overId = frames[destinationIndex]?.id
        if (overId) handleMove(activeId, overId, destinationIndex)
      }
    }
    handleDragEnd()
  }

  const handleDropOnFrame = (
    event: DragEvent<HTMLElement>,
    frameId: string,
  ) => {
    dropAtTarget(event, {
      frameId,
      edge: pointerEdge(event.currentTarget, event.clientX),
    })
  }

  return (
    <>
      {frames.length > 1 ? (
        <p className="gallery-reorder-hint">
          Drag toward either edge of a frame to place it precisely, or use the
          arrow buttons.
        </p>
      ) : null}
      <div
        className={`gallery-grid${draggedId ? ' gallery-grid--reordering' : ''}`}
        onDragOver={(event) => {
          if (dropTarget) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }
        }}
        onDrop={(event) => dropAtTarget(event, dropTarget)}
      >
        {frames.map((frame, index) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            index={index}
            frameCount={frames.length}
            previousId={frames[index - 1]?.id ?? null}
            nextId={frames[index + 1]?.id ?? null}
            onDelete={onDelete}
            onDownload={onDownload}
            onMove={handleMove}
            draggedId={draggedId}
            dropTarget={dropTarget}
            isRecentlyMoved={recentlyMovedId === frame.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDropOnFrame}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {moveAnnouncement}
      </p>
    </>
  )
}
