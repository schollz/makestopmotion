import type { FrameRecord } from '../types'

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('The browser could not create an image from the camera.'))
      }
    }, type, quality)
  })
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  sequence: number,
  projectId: string,
): Promise<FrameRecord> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('The camera is not ready yet.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const imageBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92)

  const thumbnail = document.createElement('canvas')
  const thumbnailWidth = 360
  thumbnail.width = thumbnailWidth
  thumbnail.height = Math.max(
    1,
    Math.round((thumbnailWidth * video.videoHeight) / video.videoWidth),
  )
  const thumbnailContext = thumbnail.getContext('2d')

  if (!thumbnailContext) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  thumbnailContext.drawImage(
    canvas,
    0,
    0,
    thumbnail.width,
    thumbnail.height,
  )
  const thumbnailBlob = await canvasToBlob(thumbnail, 'image/jpeg', 0.78)

  return {
    id: crypto.randomUUID(),
    projectId,
    sequence,
    capturedAt: Date.now(),
    width: canvas.width,
    height: canvas.height,
    imageBlob,
    thumbnailBlob,
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function formatFrameFilename(frame: FrameRecord): string {
  return `makestopmotion-${String(frame.sequence).padStart(4, '0')}.jpg`
}
