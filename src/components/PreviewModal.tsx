import {
  Check,
  Download,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadBlob } from '../lib/media'
import type { FrameRecord } from '../types'

interface PreviewModalProps {
  frames: FrameRecord[]
  fps: number
  onFpsChange: (fps: number) => void
  onClose: () => void
}

function outputDimensions(frame: FrameRecord) {
  const longestEdge = Math.max(frame.width, frame.height)
  const scale = Math.min(1, 1280 / longestEdge)
  return {
    width: Math.max(1, Math.round(frame.width * scale)),
    height: Math.max(1, Math.round(frame.height * scale)),
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('A captured frame could not be read.'))
    image.src = url
  })
}

async function drawFrame(canvas: HTMLCanvasElement, url: string) {
  const image = await loadImage(url)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  const scale = Math.max(
    canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight,
  )
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const x = (canvas.width - width) / 2
  const y = (canvas.height - height) / 2

  context.fillStyle = '#050606'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, x, y, width, height)
}

function selectVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }

  return (
    [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? null
  )
}

function makeVideoFilename() {
  const stamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replace(/\.\d{3}Z$/, '')
  return `makestopmotion-${stamp}.webm`
}

export function PreviewModal({
  frames,
  fps,
  onFpsChange,
  onClose,
}: PreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportCancelledRef = useRef(false)
  const [urls, setUrls] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [looping, setLooping] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportComplete, setExportComplete] = useState(false)
  const [error, setError] = useState('')
  const mimeType = useMemo(selectVideoMimeType, [])
  const dimensions = useMemo(() => outputDimensions(frames[0]), [frames])

  useEffect(() => {
    const nextUrls = frames.map((frame) =>
      URL.createObjectURL(frame.imageBlob),
    )
    setUrls(nextUrls)
    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [frames])

  useEffect(() => {
    const canvas = canvasRef.current
    const url = urls[currentIndex]
    if (!canvas || !url || exporting) return

    let active = true
    drawFrame(canvas, url).catch((drawError: unknown) => {
      if (active) {
        setError(
          drawError instanceof Error
            ? drawError.message
            : 'The frame could not be previewed.',
        )
      }
    })

    return () => {
      active = false
    }
  }, [currentIndex, exporting, urls])

  useEffect(() => {
    if (!playing || exporting || urls.length === 0) return

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index < frames.length - 1) return index + 1
        if (looping) return 0
        window.setTimeout(() => setPlaying(false), 0)
        return index
      })
    }, 1000 / fps)

    return () => window.clearInterval(timer)
  }, [exporting, fps, frames.length, looping, playing, urls.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !exporting) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [exporting, onClose])

  const exportVideo = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !mimeType || urls.length === 0) return

    setPlaying(false)
    setExporting(true)
    setExportComplete(false)
    setExportProgress(0)
    setError('')
    exportCancelledRef.current = false

    const stream = canvas.captureStream(fps)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    })
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    try {
      recorder.start()
      const frameDuration = 1000 / fps

      for (let index = 0; index < urls.length; index += 1) {
        if (exportCancelledRef.current) break
        await drawFrame(canvas, urls[index])
        setCurrentIndex(index)
        setExportProgress((index + 1) / urls.length)
        await new Promise((resolve) => window.setTimeout(resolve, frameDuration))
      }

      recorder.stop()
      await finished
      stream.getTracks().forEach((track) => track.stop())

      if (!exportCancelledRef.current) {
        downloadBlob(new Blob(chunks, { type: mimeType }), makeVideoFilename())
        setExportComplete(true)
      }
    } catch (exportError) {
      if (recorder.state !== 'inactive') recorder.stop()
      stream.getTracks().forEach((track) => track.stop())
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'The video could not be exported.',
      )
    } finally {
      setExporting(false)
    }
  }, [fps, mimeType, urls])

  const cancelExport = () => {
    exportCancelledRef.current = true
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <header className="preview-modal__header">
          <div>
            <span className="eyebrow">Playback room</span>
            <h2 id="preview-title">Preview your motion</h2>
          </div>
          <button
            className="icon-button icon-button--large"
            type="button"
            onClick={onClose}
            disabled={exporting}
            aria-label="Close preview"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="preview-stage">
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            aria-label="Stop-motion preview"
          />
          <span className="preview-stage__counter">
            {currentIndex + 1} / {frames.length}
          </span>
          {exporting ? (
            <div className="export-overlay" aria-live="polite">
              <LoaderCircle className="spin" size={28} aria-hidden="true" />
              <strong>Rendering video</strong>
              <span>{Math.round(exportProgress * 100)}%</span>
              <div className="export-progress">
                <span style={{ width: `${exportProgress * 100}%` }} />
              </div>
            </div>
          ) : null}
        </div>

        <input
          className="frame-scrubber"
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={currentIndex}
          onChange={(event) => {
            setPlaying(false)
            setCurrentIndex(Number(event.target.value))
          }}
          aria-label="Current frame"
        />

        <div className="preview-controls">
          <div className="playback-controls">
            <button
              className="round-button"
              type="button"
              onClick={() => setCurrentIndex(0)}
              disabled={exporting}
              aria-label="Restart preview"
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
            <button
              className="play-button"
              type="button"
              onClick={() => setPlaying((value) => !value)}
              disabled={exporting}
              aria-label={playing ? 'Pause preview' : 'Play preview'}
            >
              {playing ? (
                <Pause size={20} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={20} fill="currentColor" aria-hidden="true" />
              )}
            </button>
            <label className="loop-control">
              <input
                type="checkbox"
                checked={looping}
                onChange={(event) => setLooping(event.target.checked)}
                disabled={exporting}
              />
              Loop
            </label>
          </div>

          <label className="fps-control">
            <span>Speed</span>
            <select
              value={fps}
              onChange={(event) => onFpsChange(Number(event.target.value))}
              disabled={exporting}
            >
              {Array.from({ length: 24 }, (_, index) => index + 1).map(
                (value) => (
                  <option key={value} value={value}>
                    {value} fps
                  </option>
                ),
              )}
            </select>
          </label>

          {exporting ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={cancelExport}
            >
              Cancel export
            </button>
          ) : (
            <button
              className="button button--accent"
              type="button"
              onClick={exportVideo}
              disabled={!mimeType}
            >
              {exportComplete ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
              {exportComplete ? 'Downloaded' : 'Download video'}
            </button>
          )}
        </div>

        {!mimeType ? (
          <p className="modal-message modal-message--error">
            Video download is not supported by this browser. Preview still
            works.
          </p>
        ) : null}
        {error ? (
          <p className="modal-message modal-message--error">{error}</p>
        ) : null}
      </section>
    </div>
  )
}
