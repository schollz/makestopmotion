export type CapturePhase =
  | 'camera-off'
  | 'loading-detector'
  | 'waiting-for-hand'
  | 'hand-present'
  | 'clearing'
  | 'capturing'
  | 'detector-stalled'
  | 'error'

export interface FrameRecord {
  id: string
  projectId: string
  sequence: number
  capturedAt: number
  width: number
  height: number
  imageBlob: Blob
  thumbnailBlob: Blob
}

export interface ProjectRecord {
  id: string
  name: string
  createdAt: number
}

export interface CaptureSettings {
  clearDelayMs: number
  playbackFps: number
  selectedCameraId: string
  autoCaptureEnabled: boolean
}

export interface HandLandmark {
  x: number
  y: number
  z: number
}

export interface HandDetectionResult {
  timestamp: number
  generation: number
  landmarks: HandLandmark[][]
}

export interface DetectorProgressMessage {
  type: 'progress'
  stage: string
  elapsedMs: number
  details?: Record<string, string | number | boolean>
}

export type WorkerIncomingMessage =
  | {
      type: 'init'
      wasmPath: string
      modelPath: string
    }
  | {
      type: 'detect'
      bitmap: ImageBitmap
      timestamp: number
      generation: number
    }
  | {
      type: 'close'
    }

export type WorkerOutgoingMessage =
  | { type: 'ready' }
  | DetectorProgressMessage
  | ({ type: 'result' } & HandDetectionResult)
  | { type: 'error'; message: string }
