declare module 'handtrackjs' {
  export interface HandTrackPrediction {
    bbox: [number, number, number, number]
    class: number
    label: string
    score: number | string
  }

  export interface HandTrackModel {
    detect(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<HandTrackPrediction[]>
    dispose(): void
  }

  export interface HandTrackParameters {
    basePath?: string
    bboxLineWidth?: string
    flipHorizontal?: boolean
    fontSize?: number
    imageScaleFactor?: number
    iouThreshold?: number
    labelMap?: Record<number, string>
    maxNumBoxes?: number
    modelSize?: 'small' | 'medium' | 'large'
    modelType?: 'ssd320fpnlite' | 'ssd640fpnlite' | 'centernet512fpn'
    outputStride?: number
    renderThresholds?: Record<string, number> | null
    scoreThreshold?: number
  }

  export class ObjectDetection implements HandTrackModel {
    constructor(parameters: HandTrackParameters)
    modelPath: string
    load(): Promise<void>
    detect(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<HandTrackPrediction[]>
    dispose(): void
  }

  export function load(parameters?: HandTrackParameters): Promise<HandTrackModel>
  export const version: string
}
