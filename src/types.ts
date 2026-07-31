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

export type HandDetector = 'mediapipe' | 'handtrack' | 'ml5'

export interface CaptureSettings {
  clearDelayMs: number
  playbackFps: number
  selectedCameraId: string
  autoCaptureEnabled: boolean
  handDetector: HandDetector
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

export interface HandDetectionBox {
  bbox: [number, number, number, number]
  label: string
  score: number
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
  | ({ type: 'result' } & HandDetectionResult)
  | { type: 'error'; message: string }
