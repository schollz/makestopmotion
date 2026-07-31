import type { FrameRecord } from '../types'

export function reorderFrames(
  frames: FrameRecord[],
  activeId: string,
  overId: string,
): FrameRecord[] {
  const activeIndex = frames.findIndex(({ id }) => id === activeId)
  const overIndex = frames.findIndex(({ id }) => id === overId)

  if (
    activeIndex === -1 ||
    overIndex === -1 ||
    activeIndex === overIndex
  ) {
    return frames
  }

  const reordered = [...frames]
  const [activeFrame] = reordered.splice(activeIndex, 1)
  reordered.splice(overIndex, 0, activeFrame)

  return reordered.map((frame, index) => ({
    ...frame,
    sequence: index + 1,
  }))
}
