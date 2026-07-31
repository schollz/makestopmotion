/// <reference lib="webworker" />

import {
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { resolveVisionFileset } from '../lib/vision-fileset'
import type {
  HandLandmark,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from '../types'

let handLandmarker: HandLandmarker | null = null

function send(message: WorkerOutgoingMessage) {
  self.postMessage(message)
}

function serializeLandmarks(
  landmarks: NormalizedLandmark[][],
): HandLandmark[][] {
  return landmarks.map((hand) =>
    hand.map(({ x, y, z }) => ({ x, y, z })),
  )
}

self.onmessage = async (event: MessageEvent<WorkerIncomingMessage>) => {
  const message = event.data

  try {
    if (message.type === 'init') {
      const fileset = await resolveVisionFileset(message.wasmPath)
      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: message.modelPath,
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      send({ type: 'ready' })
      return
    }

    if (message.type === 'detect') {
      if (!handLandmarker) {
        throw new Error('The hand detector has not finished loading.')
      }

      const result = handLandmarker.detectForVideo(
        message.bitmap,
        message.timestamp,
      )
      message.bitmap.close()
      send({
        type: 'result',
        timestamp: message.timestamp,
        generation: message.generation,
        landmarks: serializeLandmarks(result.landmarks),
      })
      return
    }

    handLandmarker?.close()
    handLandmarker = null
    self.close()
  } catch (error) {
    if (message.type === 'detect') {
      message.bitmap.close()
    }
    send({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'The hand detector failed.',
    })
  }
}
