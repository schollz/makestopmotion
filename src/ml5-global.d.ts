export interface Ml5HandKeypoint {
  x: number
  y: number
  z?: number
  name?: string
}

export interface Ml5HandPrediction {
  confidence: number
  handedness: string
  keypoints: Ml5HandKeypoint[]
  keypoints3D: Ml5HandKeypoint[]
}

export interface Ml5HandPoseModel {
  detect(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Promise<Ml5HandPrediction[]>
  detectStop(): void
}

export interface Ml5Api {
  handPose(options?: {
    maxHands?: number
    modelType?: 'lite' | 'full'
    runtime?: 'mediapipe' | 'tfjs'
  }, onReady?: () => void): Ml5HandPoseModel
}

declare global {
  interface Window {
    ml5?: Ml5Api
  }
}
