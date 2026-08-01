import {
  Aperture,
  ArrowRight,
  Camera,
  CameraOff,
  CircleAlert,
  Hand,
  ImagePlus,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import { Gallery } from './components/Gallery'
import { PreviewModal } from './components/PreviewModal'
import { ProjectNav } from './components/ProjectNav'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import {
  createCaptureMachineState,
  resetCaptureMachine,
  updateCaptureMachine,
} from './lib/capture-machine'
import {
  clearFrames,
  createProject as createStoredProject,
  DEFAULT_PROJECT_ID,
  deleteProject as deleteStoredProject,
  getAllFrames,
  getProjects,
  removeFrame,
  renameProject as renameStoredProject,
  saveFrame,
  saveFrames,
} from './lib/frame-db'
import { reorderFrames } from './lib/frame-order'
import {
  captureVideoFrame,
  downloadBlob,
  formatFrameFilename,
} from './lib/media'
import {
  playCaptureSound,
  playHandClearSound,
  prepareCaptureSound,
} from './lib/capture-sound'
import {
  anyHandDetectorVotedYes,
  didDetectedHandClear,
} from './lib/hand-detection'
import { loadMl5 } from './lib/ml5-loader'
import { getSitePageUrl } from './lib/site-config'
import type {
  CapturePhase,
  CaptureSettings,
  FrameRecord,
  HandLandmark,
  ProjectRecord,
  WorkerOutgoingMessage,
} from './types'
import type {
  Ml5HandPoseModel,
  Ml5HandPrediction,
} from './ml5-global'

const SETTINGS_KEY = 'stillframe-settings-v1'
const ACTIVE_PROJECT_KEY = 'stillframe-active-project-v1'
const DETECTION_INTERVAL_MS = 1000 / 15
const DETECTOR_STALE_MS = 1_200
const VISION_LOG_PREFIX = '[hand-detection][coordinator]'

const DEFAULT_SETTINGS: CaptureSettings = {
  clearDelayMs: 500,
  playbackFps: 8,
  selectedCameraId: '',
  autoCaptureEnabled: true,
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

function loadSettings(): CaptureSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    const parsed = JSON.parse(stored) as Partial<CaptureSettings>
    return {
      clearDelayMs:
        typeof parsed.clearDelayMs === 'number'
          ? Math.min(5_000, Math.max(100, parsed.clearDelayMs))
          : DEFAULT_SETTINGS.clearDelayMs,
      playbackFps:
        typeof parsed.playbackFps === 'number'
          ? Math.min(24, Math.max(1, parsed.playbackFps))
          : DEFAULT_SETTINGS.playbackFps,
      selectedCameraId:
        typeof parsed.selectedCameraId === 'string'
          ? parsed.selectedCameraId
          : DEFAULT_SETTINGS.selectedCameraId,
      autoCaptureEnabled:
        typeof parsed.autoCaptureEnabled === 'boolean'
          ? parsed.autoCaptureEnabled
          : DEFAULT_SETTINGS.autoCaptureEnabled,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function describePhase(
  phase: CapturePhase,
  remainingMs: number,
  autoCaptureEnabled: boolean,
) {
  if (!autoCaptureEnabled && phase !== 'camera-off') {
    return {
      label: 'Capture stopped',
      detail: 'Use Take frame for manual photos',
      tone: 'neutral',
    }
  }

  switch (phase) {
    case 'loading-detector':
      return {
        label: 'Preparing vision',
        detail: 'Loading both on-device hand models',
        tone: 'neutral',
      }
    case 'waiting-for-hand':
      return {
        label: 'Ready for your hand',
        detail: 'Move in to make the next adjustment',
        tone: 'ready',
      }
    case 'hand-present':
      return {
        label: 'Hand detected',
        detail: 'Take your time — capture is blocked',
        tone: 'blocked',
      }
    case 'clearing':
      return {
        label: 'Hold clear',
        detail: `Capturing in ${(remainingMs / 1000).toFixed(1)} seconds`,
        tone: 'countdown',
      }
    case 'capturing':
      return {
        label: 'Frame captured',
        detail: 'Waiting for your hand to return',
        tone: 'captured',
      }
    case 'detector-stalled':
      return {
        label: 'Detection paused',
        detail: 'No photo will be taken until vision resumes',
        tone: 'warning',
      }
    case 'error':
      return {
        label: 'Needs attention',
        detail: 'Check the message below',
        tone: 'warning',
      }
    default:
      return {
        label: 'Camera is off',
        detail: 'Start the camera when your set is ready',
        tone: 'neutral',
      }
  }
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function cleanProjectName(name: string) {
  return name.trim().slice(0, 60)
}

interface PendingMediaPipeDetection {
  generation: number
  cycleId: number
  startedAt: number
  resolve: (landmarks: HandLandmark[][]) => void
  reject: (error: Error) => void
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const ml5ModelRef = useRef<Ml5HandPoseModel | null>(null)
  const ml5LoadRef = useRef<Promise<Ml5HandPoseModel> | null>(null)
  const modelCleanupTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const machineRef = useRef(createCaptureMachineState())
  const inferenceInFlightRef = useRef(false)
  const pendingMediaPipeDetectionRef =
    useRef<PendingMediaPipeDetection | null>(null)
  const readinessLogKeyRef = useRef('')
  const detectionCycleRef = useRef(0)
  const lastDetectorVoteKeyRef = useRef('')
  const didLogVisionStartupRef = useRef(false)
  const lastInferenceSentAtRef = useRef(0)
  const lastDetectorResultAtRef = useRef(0)
  const handWasDetectedRef = useRef(false)
  const detectorReadyRef = useRef(false)
  const mediaPipeReadyRef = useRef(false)
  const ml5ReadyRef = useRef(false)
  const detectorGenerationRef = useRef(0)
  const cameraActiveRef = useRef(false)
  const captureBusyRef = useRef(false)
  const captureGenerationRef = useRef(0)
  const nextSequenceRef = useRef(1)
  const activeProjectIdRef = useRef(DEFAULT_PROJECT_ID)
  const settingsRef = useRef(loadSettings())

  const [settings, setSettings] = useState(settingsRef.current)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectsReady, setProjectsReady] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID)
  const [frames, setFrames] = useState<FrameRecord[]>([])
  const [framesLoading, setFramesLoading] = useState(true)
  const [mediaPipeReady, setMediaPipeReady] = useState(false)
  const [ml5Ready, setMl5Ready] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [phase, setPhase] = useState<CapturePhase>('loading-detector')
  const [remainingMs, setRemainingMs] = useState(settings.clearDelayMs)
  const [landmarks, setLandmarks] = useState<HandLandmark[][]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [shutterVisible, setShutterVisible] = useState(false)
  const [deletedFrame, setDeletedFrame] = useState<FrameRecord | null>(null)
  const detectorReady = mediaPipeReady && ml5Ready

  useEffect(() => {
    if (didLogVisionStartupRef.current) return
    didLogVisionStartupRef.current = true
    console.info(`${VISION_LOG_PREFIX} starting both detector initializers`, {
      detectors: ['MediaPipe', 'ml5 HandPose'],
      combinationRule: 'OR — any positive vote detects a hand',
      developmentEffectReplayExpected: import.meta.env.DEV,
    })
  }, [])

  useEffect(() => {
    const title = 'Stop Motion Studio | makestopmotion.com'
    const description =
      'Create stop motion privately in your browser with hands-free frame capture.'
    const url = getSitePageUrl('/studio')
    document.title = title
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', description)
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.setAttribute('content', title)
    document
      .querySelector<HTMLMetaElement>('meta[property="og:description"]')
      ?.setAttribute('content', description)
    document
      .querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.setAttribute('content', url)
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute('href', url)
  }, [])

  const updateSettings = useCallback(
    (patch: Partial<CaptureSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch }
        settingsRef.current = next
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
        } catch {
          // Preferences can remain in memory if browser storage is unavailable.
        }
        return next
      })
    },
    [],
  )

  const refreshCombinedDetectorReadiness = useCallback(() => {
    const readiness = {
      mediapipe: mediaPipeReadyRef.current,
      ml5: ml5ReadyRef.current,
    }
    const ready = readiness.mediapipe && readiness.ml5
    detectorReadyRef.current = ready

    const readinessKey = JSON.stringify(readiness)
    if (readinessLogKeyRef.current !== readinessKey) {
      readinessLogKeyRef.current = readinessKey
      console.info(`${VISION_LOG_PREFIX} readiness changed`, {
        ...readiness,
        allReady: ready,
      })
    }

    if (ready) {
      console.info(`${VISION_LOG_PREFIX} both models are ready`)
      setPhase(cameraActiveRef.current ? 'waiting-for-hand' : 'camera-off')
    }

    return ready
  }, [])

  const failCombinedDetection = useCallback((message: string) => {
    console.error(`${VISION_LOG_PREFIX} detector failure`, {
      message,
      readinessBeforeFailure: {
        mediapipe: mediaPipeReadyRef.current,
        ml5: ml5ReadyRef.current,
      },
    })
    mediaPipeReadyRef.current = false
    ml5ReadyRef.current = false
    detectorReadyRef.current = false
    handWasDetectedRef.current = false
    setMediaPipeReady(false)
    setMl5Ready(false)
    readinessLogKeyRef.current = ''
    machineRef.current = resetCaptureMachine()
    setPhase('error')
    setErrorMessage(message)
  }, [])

  const selectActiveProject = useCallback((projectId: string) => {
    if (!projectId) return
    activeProjectIdRef.current = projectId
    captureGenerationRef.current += 1
    setActiveProjectId(projectId)
    setDeletedFrame(null)
    setShowPreview(false)
    machineRef.current = resetCaptureMachine()
    setRemainingMs(settingsRef.current.clearDelayMs)
    if (cameraActiveRef.current) {
      setPhase(
        detectorReadyRef.current ? 'waiting-for-hand' : 'loading-detector',
      )
    }
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId)
    } catch {
      // The active project still remains selected for this session.
    }
  }, [])

  const captureCurrentFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || captureBusyRef.current || !cameraActiveRef.current) return

    captureBusyRef.current = true
    machineRef.current = resetCaptureMachine()
    setPhase('capturing')
    setRemainingMs(settingsRef.current.clearDelayMs)

    try {
      const projectId = activeProjectIdRef.current
      const captureGeneration = captureGenerationRef.current
      const frame = await captureVideoFrame(
        video,
        nextSequenceRef.current,
        projectId,
      )
      if (
        activeProjectIdRef.current !== projectId ||
        captureGenerationRef.current !== captureGeneration
      ) {
        return
      }
      await saveFrame(frame)
      nextSequenceRef.current += 1
      setFrames((current) => [...current, frame])
      setShutterVisible(true)
      playCaptureSound()
      window.setTimeout(() => setShutterVisible(false), 180)
      navigator.storage?.persist?.().catch(() => undefined)
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === 'QuotaExceededError'
          ? 'This browser is out of space for more frames. Download or delete some photos and try again.'
          : error instanceof Error
            ? error.message
            : 'The frame could not be saved.',
      )
      setPhase('error')
    } finally {
      captureBusyRef.current = false
    }
  }, [])

  const applyHandPresence = useCallback(
    (hasHand: boolean) => {
      if (!cameraActiveRef.current || document.hidden) return

      const now = performance.now()
      lastDetectorResultAtRef.current = now
      if (didDetectedHandClear(handWasDetectedRef.current, hasHand)) {
        playHandClearSound()
      }
      handWasDetectedRef.current = hasHand
      if (captureBusyRef.current) return

      const output = updateCaptureMachine(machineRef.current, {
        now,
        hasHand,
        enabled: settingsRef.current.autoCaptureEnabled,
        clearDelayMs: settingsRef.current.clearDelayMs,
      })
      machineRef.current = output.state
      setPhase(output.phase)
      setRemainingMs(output.remainingMs)

      if (output.shouldCapture) {
        void captureCurrentFrame()
      }
    },
    [captureCurrentFrame],
  )

  useEffect(() => {
    let active = true
    getProjects()
      .then((storedProjects) => {
        if (!active) return
        setProjects(storedProjects)
        let preferredProjectId = DEFAULT_PROJECT_ID
        try {
          preferredProjectId =
            localStorage.getItem(ACTIVE_PROJECT_KEY) ?? DEFAULT_PROJECT_ID
        } catch {
          // Use the default project when preferences are unavailable.
        }
        const selectedProject =
          storedProjects.find(({ id }) => id === preferredProjectId) ??
          storedProjects[0]
        if (selectedProject) selectActiveProject(selectedProject.id)
      })
      .catch(() => {
        if (active) {
          setErrorMessage(
            'Saved projects could not be opened. Refresh the page to try again.',
          )
        }
      })
      .finally(() => {
        if (active) setProjectsReady(true)
      })

    return () => {
      active = false
    }
  }, [selectActiveProject])

  useEffect(() => {
    if (!projectsReady) return

    let active = true
    setFramesLoading(true)
    setFrames([])
    getAllFrames(activeProjectId)
      .then((storedFrames) => {
        if (!active) return
        setFrames(storedFrames)
        nextSequenceRef.current =
          storedFrames.reduce(
            (largest, frame) => Math.max(largest, frame.sequence),
            0,
          ) + 1
      })
      .catch(() => {
        if (active) {
          setErrorMessage(
            'This project’s frames could not be opened. Try switching projects and back.',
          )
        }
      })
      .finally(() => {
        if (active) setFramesLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeProjectId, projectsReady])

  useEffect(() => {
    const workerStartedAt = performance.now()
    console.info(`${VISION_LOG_PREFIX} launching MediaPipe worker`)
    const worker = new Worker(
      new URL('./workers/hand.worker.ts', import.meta.url),
      { type: 'module', name: 'mediapipe-hand-detector' },
    )
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
      const message = event.data

      if (message.type === 'progress') {
        console.info(`${VISION_LOG_PREFIX} MediaPipe: ${message.stage}`, {
          elapsedMs: message.elapsedMs,
          ...message.details,
        })
        return
      }

      if (message.type === 'ready') {
        console.info(`${VISION_LOG_PREFIX} MediaPipe ready`, {
          elapsedMs: Math.round(performance.now() - workerStartedAt),
        })
        mediaPipeReadyRef.current = true
        setMediaPipeReady(true)
        refreshCombinedDetectorReadiness()
        return
      }

      if (message.type === 'error') {
        pendingMediaPipeDetectionRef.current?.reject(new Error(message.message))
        pendingMediaPipeDetectionRef.current = null
        failCombinedDetection(
          `MediaPipe detection stopped: ${message.message} Refresh the page to restart both detectors.`,
        )
        return
      }

      const pendingDetection = pendingMediaPipeDetectionRef.current
      if (pendingDetection?.generation === message.generation) {
        pendingMediaPipeDetectionRef.current = null
        console.debug(`${VISION_LOG_PREFIX} MediaPipe inference returned`, {
          cycleId: pendingDetection.cycleId,
          elapsedMs: Math.round(
            performance.now() - pendingDetection.startedAt,
          ),
          hands: message.landmarks.length,
        })
        pendingDetection.resolve(message.landmarks)
      }
    }

    worker.onerror = (event) => {
      console.error(`${VISION_LOG_PREFIX} MediaPipe worker error event`, {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      })
      pendingMediaPipeDetectionRef.current?.reject(
        new Error('The MediaPipe worker stopped unexpectedly.'),
      )
      pendingMediaPipeDetectionRef.current = null
      failCombinedDetection(
        'MediaPipe could not start. Refresh the page to restart both detectors.',
      )
    }

    worker.postMessage({
      type: 'init',
      wasmPath: `${window.location.origin}/wasm`,
      modelPath: `${window.location.origin}/models/hand_landmarker.task`,
    })

    return () => {
      console.debug(`${VISION_LOG_PREFIX} stopping MediaPipe worker`, {
        reason: 'React effect cleanup',
        note: import.meta.env.DEV
          ? 'One early stop/relaunch is expected from Strict Mode in development.'
          : undefined,
      })
      worker.postMessage({ type: 'close' })
      worker.terminate()
      workerRef.current = null
      detectorReadyRef.current = false
      mediaPipeReadyRef.current = false
    }
  }, [failCombinedDetection, refreshCombinedDetectorReadiness])

  useEffect(() => {
    const initializationStartedAt = performance.now()
    if (ml5ModelRef.current) {
      console.info(`${VISION_LOG_PREFIX} ml5 HandPose reused existing model`)
      ml5ReadyRef.current = true
      setMl5Ready(true)
      refreshCombinedDetectorReadiness()
      return
    }

    setPhase('loading-detector')
    console.info(`${VISION_LOG_PREFIX} initializing ml5 HandPose`, {
      runtime: 'tfjs',
      modelType: 'full',
    })
    let active = true
    const loadModel = async () => {
      if (!ml5LoadRef.current) {
        console.info(`${VISION_LOG_PREFIX} requesting ml5 browser library`)
        ml5LoadRef.current = loadMl5()
          .then((ml5) => {
            console.info(`${VISION_LOG_PREFIX} ml5 browser API ready`, {
              elapsedMs: Math.round(
                performance.now() - initializationStartedAt,
              ),
            })
            console.info(`${VISION_LOG_PREFIX} loading ml5 HandPose model`)
            return new Promise<Ml5HandPoseModel>((resolve, reject) => {
              let model: Ml5HandPoseModel | undefined
              const timeout = window.setTimeout(() => {
                model?.detectStop()
                console.error(`${VISION_LOG_PREFIX} ml5 model load timed out`, {
                  elapsedMs: Math.round(
                    performance.now() - initializationStartedAt,
                  ),
                })
                reject(new Error('The ml5 HandPose model timed out while loading.'))
              }, 45_000)

              model = ml5.handPose(
                {
                  maxHands: 2,
                  modelType: 'full',
                  runtime: 'tfjs',
                },
                () => {
                  window.clearTimeout(timeout)
                  console.info(`${VISION_LOG_PREFIX} ml5 model callback fired`, {
                    elapsedMs: Math.round(
                      performance.now() - initializationStartedAt,
                    ),
                    modelAssigned: Boolean(model),
                  })
                  if (model) resolve(model)
                },
              )
            })
          })
          .then((model) => {
            ml5ModelRef.current = model
            return model
          })
          .finally(() => {
            ml5LoadRef.current = null
          })
      }
      return ml5LoadRef.current
    }

    void loadModel()
      .then(() => {
        if (!active) return
        console.info(`${VISION_LOG_PREFIX} ml5 HandPose ready`, {
          elapsedMs: Math.round(performance.now() - initializationStartedAt),
        })
        ml5ReadyRef.current = true
        setMl5Ready(true)
        refreshCombinedDetectorReadiness()
      })
      .catch((error) => {
        if (!active) return
        failCombinedDetection(
          `ml5 HandPose could not start: ${
            error instanceof Error ? error.message : 'the model failed to load'
          }. Refresh the page to restart both detectors.`,
        )
      })

    return () => {
      active = false
    }
  }, [failCombinedDetection, refreshCombinedDetectorReadiness])

  const stopCamera = useCallback(() => {
    cameraActiveRef.current = false
    setCameraActive(false)
    detectorGenerationRef.current += 1
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    machineRef.current = resetCaptureMachine()
    lastDetectorResultAtRef.current = 0
    handWasDetectedRef.current = false
    setLandmarks([])
    setRemainingMs(settingsRef.current.clearDelayMs)
    setPhase(detectorReadyRef.current ? 'camera-off' : 'loading-detector')
  }, [])

  const startCamera = useCallback(
    async (requestedDeviceId = settingsRef.current.selectedCameraId) => {
      prepareCaptureSound()
      detectorGenerationRef.current += 1

      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('error')
        setErrorMessage(
          'Camera access is not available. Open this app on localhost in Chrome or Edge.',
        )
        return
      }

      setErrorMessage('')
      cameraActiveRef.current = false
      handWasDetectedRef.current = false
      setCameraActive(false)
      stopMediaStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setPhase('waiting-for-hand')

      const videoConstraints: MediaTrackConstraints = requestedDeviceId
        ? {
            deviceId: { exact: requestedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          })
        } catch (error) {
          if (!requestedDeviceId) throw error
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        }

        const video = videoRef.current
        if (!video) {
          stopMediaStream(stream)
          return
        }

        streamRef.current = stream
        video.srcObject = stream
        await video.play()
        video.width = video.videoWidth
        video.height = video.videoHeight
        cameraActiveRef.current = true
        setCameraActive(true)
        machineRef.current = resetCaptureMachine()
        lastDetectorResultAtRef.current = performance.now()
        lastDetectorVoteKeyRef.current = ''
        console.info(`${VISION_LOG_PREFIX} camera active; inference can begin`, {
          generation: detectorGenerationRef.current,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        })
        setPhase('waiting-for-hand')

        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(
          (device) => device.kind === 'videoinput',
        )
        setCameras(videoDevices)

        const activeDeviceId =
          stream.getVideoTracks()[0]?.getSettings().deviceId ?? ''
        if (activeDeviceId) {
          updateSettings({ selectedCameraId: activeDeviceId })
        }

        const track = stream.getVideoTracks()[0]
        if (track) track.onended = stopCamera
      } catch (error) {
        stopCamera()
        setPhase('error')
        setErrorMessage(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in the address bar, then start the camera again.'
            : error instanceof DOMException && error.name === 'NotFoundError'
              ? 'No camera was found. Connect a camera and try again.'
              : 'The camera could not start. Make sure another app is not using it, then try again.',
        )
      }
    },
    [stopCamera, updateSettings],
  )

  useEffect(() => {
    if (!cameraActive) return

    const detect = (now: number) => {
      const video = videoRef.current
      const worker = workerRef.current
      const activeDetectorReady =
        mediaPipeReadyRef.current && ml5ReadyRef.current

      if (
        video &&
        worker &&
        activeDetectorReady &&
        !document.hidden &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        if (
          !inferenceInFlightRef.current &&
          lastDetectorResultAtRef.current > 0 &&
          now - lastDetectorResultAtRef.current > DETECTOR_STALE_MS
        ) {
          console.warn(`${VISION_LOG_PREFIX} detector results became stale`, {
            staleForMs: Math.round(now - lastDetectorResultAtRef.current),
          })
          machineRef.current = resetCaptureMachine()
          handWasDetectedRef.current = false
          setLandmarks([])
          setPhase('detector-stalled')
        }

        if (
          !inferenceInFlightRef.current &&
          now - lastInferenceSentAtRef.current >= DETECTION_INTERVAL_MS
        ) {
          inferenceInFlightRef.current = true
          lastInferenceSentAtRef.current = now
          const generation = detectorGenerationRef.current
          const cycleId = ++detectionCycleRef.current
          const cycleStartedAt = performance.now()
          const ml5Model = ml5ModelRef.current

          console.debug(`${VISION_LOG_PREFIX} inference cycle started`, {
            cycleId,
            generation,
          })

          if (!ml5Model) {
            inferenceInFlightRef.current = false
            failCombinedDetection(
              'One of the hand detectors became unavailable. Refresh the page to restart both detectors.',
            )
          } else {
            const sourceWidth = video.videoWidth || video.width
            const sourceHeight = video.videoHeight || video.height
            const mediaPipeDetection = createImageBitmap(video).then(
              (bitmap) =>
                new Promise<HandLandmark[][]>((resolve, reject) => {
                  if (generation !== detectorGenerationRef.current) {
                    bitmap.close()
                    resolve([])
                    return
                  }

                  pendingMediaPipeDetectionRef.current = {
                    generation,
                    cycleId,
                    startedAt: cycleStartedAt,
                    resolve,
                    reject,
                  }
                  worker.postMessage(
                    {
                      type: 'detect',
                      bitmap,
                      timestamp: now,
                      generation,
                    },
                    [bitmap],
                  )
                }),
            )

            const ml5Detection = ml5Model
              .detect(video)
              .then((predictions: Ml5HandPrediction[]) => {
                console.debug(`${VISION_LOG_PREFIX} ml5 inference returned`, {
                  cycleId,
                  elapsedMs: Math.round(performance.now() - cycleStartedAt),
                  hands: predictions.length,
                })
                return predictions.map(({ keypoints }) =>
                  keypoints.map(({ x, y, z }) => ({
                    x: x / sourceWidth,
                    y: y / sourceHeight,
                    z: z ?? 0,
                  })),
                )
              })

            void Promise.all([mediaPipeDetection, ml5Detection])
              .then(
                ([mediaPipeLandmarks, ml5Landmarks]) => {
                  if (
                    generation !== detectorGenerationRef.current ||
                    !cameraActiveRef.current
                  ) {
                    return
                  }

                  setLandmarks([...mediaPipeLandmarks, ...ml5Landmarks])
                  const votes = {
                    mediapipe: mediaPipeLandmarks.length > 0,
                    ml5: ml5Landmarks.length > 0,
                  }
                  const hasHand = anyHandDetectorVotedYes(votes)
                  const voteKey = JSON.stringify(votes)
                  const summary = {
                    cycleId,
                    generation,
                    elapsedMs: Math.round(
                      performance.now() - cycleStartedAt,
                    ),
                    votes,
                    detections: {
                      mediaPipeHands: mediaPipeLandmarks.length,
                      ml5Hands: ml5Landmarks.length,
                    },
                    combinedHasHand: hasHand,
                  }

                  if (
                    cycleId === 1 ||
                    lastDetectorVoteKeyRef.current !== voteKey
                  ) {
                    console.info(
                      `${VISION_LOG_PREFIX} inference result`,
                      summary,
                    )
                    lastDetectorVoteKeyRef.current = voteKey
                  } else {
                    console.debug(
                      `${VISION_LOG_PREFIX} inference result`,
                      summary,
                    )
                  }

                  applyHandPresence(hasHand)
                },
              )
              .catch((error) => {
                if (
                  generation !== detectorGenerationRef.current ||
                  !cameraActiveRef.current ||
                  !detectorReadyRef.current
                ) {
                  return
                }

                failCombinedDetection(
                  `Combined hand detection stopped: ${
                    error instanceof Error ? error.message : 'inference failed'
                  }. Refresh the page to restart both detectors.`,
                )
              })
              .finally(() => {
                inferenceInFlightRef.current = false
              })
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect)
    }

    animationFrameRef.current = requestAnimationFrame(detect)
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = null
    }
  }, [applyHandPresence, cameraActive, failCombinedDetection])

  useEffect(() => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)

    for (const hand of landmarks) {
      context.lineWidth = Math.max(2, width / 520)
      context.strokeStyle = 'rgba(218, 255, 92, 0.9)'
      context.fillStyle = '#dafe5c'
      context.shadowColor = 'rgba(218, 255, 92, 0.35)'
      context.shadowBlur = 8

      for (const [from, to] of HAND_CONNECTIONS) {
        const start = hand[from]
        const end = hand[to]
        if (!start || !end) continue
        context.beginPath()
        context.moveTo(start.x * width, start.y * height)
        context.lineTo(end.x * width, end.y * height)
        context.stroke()
      }

      for (const point of hand) {
        context.beginPath()
        context.arc(
          point.x * width,
          point.y * height,
          Math.max(3, width / 310),
          0,
          Math.PI * 2,
        )
        context.fill()
      }
    }

  }, [landmarks])

  useEffect(() => {
    const handleVisibility = () => {
      if (!cameraActiveRef.current) return
      detectorGenerationRef.current += 1
      machineRef.current = resetCaptureMachine()
      handWasDetectedRef.current = false
      setLandmarks([])
      setRemainingMs(settingsRef.current.clearDelayMs)
      setPhase(document.hidden ? 'detector-stalled' : 'waiting-for-hand')
      if (!document.hidden) {
        lastDetectorResultAtRef.current = performance.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (modelCleanupTimerRef.current !== null) {
      window.clearTimeout(modelCleanupTimerRef.current)
      modelCleanupTimerRef.current = null
    }

    return () => {
      // Delay disposal by one task so React Strict Mode's development-only
      // effect replay can reuse models that are already loading.
      modelCleanupTimerRef.current = window.setTimeout(() => {
        stopMediaStream(streamRef.current)
        const pendingMl5Model = ml5LoadRef.current
        if (ml5ModelRef.current) {
          ml5ModelRef.current.detectStop()
        } else {
          void pendingMl5Model
            ?.then((model) => model.detectStop())
            .catch(() => undefined)
        }
      }, 0)
    }
  }, [])

  useEffect(() => {
    if (!deletedFrame) return
    const timer = window.setTimeout(() => setDeletedFrame(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [deletedFrame])

  const handleAutoCaptureChange = (enabled: boolean) => {
    updateSettings({ autoCaptureEnabled: enabled })
    machineRef.current = resetCaptureMachine()
    setRemainingMs(settings.clearDelayMs)
    if (cameraActive) {
      setPhase(
        detectorReadyRef.current ? 'waiting-for-hand' : 'loading-detector',
      )
    }
  }

  const activeProject =
    projects.find(({ id }) => id === activeProjectId) ?? null

  const handleCreateProject = async () => {
    const suggestedName = `Project ${projects.length + 1}`
    const requestedName = window.prompt('Name the new project', suggestedName)
    if (requestedName === null) return

    const name = cleanProjectName(requestedName)
    if (!name) {
      setErrorMessage('Enter a name for the new project.')
      return
    }

    try {
      const project = await createStoredProject(name)
      setProjects((current) => [...current, project])
      selectActiveProject(project.id)
    } catch {
      setErrorMessage('The project could not be created. Try again.')
    }
  }

  const handleRenameProject = async () => {
    if (!activeProject) return
    const requestedName = window.prompt(
      'Rename this project',
      activeProject.name,
    )
    if (requestedName === null) return

    const name = cleanProjectName(requestedName)
    if (!name) {
      setErrorMessage('Project names cannot be empty.')
      return
    }

    try {
      await renameStoredProject(activeProject.id, name)
      setProjects((current) =>
        current.map((project) =>
          project.id === activeProject.id ? { ...project, name } : project,
        ),
      )
    } catch {
      setErrorMessage('The project could not be renamed. Try again.')
    }
  }

  const handleDeleteProject = async () => {
    if (!activeProject || projects.length < 2) return
    if (
      !window.confirm(
        `Delete “${activeProject.name}” and all ${frames.length} of its frames? This cannot be undone.`,
      )
    ) {
      return
    }

    const nextProject = projects.find(({ id }) => id !== activeProject.id)
    if (!nextProject) return

    selectActiveProject(nextProject.id)
    try {
      await deleteStoredProject(activeProject.id)
      setProjects((current) =>
        current.filter(({ id }) => id !== activeProject.id),
      )
    } catch {
      selectActiveProject(activeProject.id)
      setErrorMessage('The project could not be deleted. Try again.')
    }
  }

  const handleDeleteFrame = async (frame: FrameRecord) => {
    try {
      await removeFrame(frame.id)
      setFrames((current) => current.filter(({ id }) => id !== frame.id))
      setDeletedFrame(frame)
    } catch {
      setErrorMessage('That frame could not be deleted. Try again.')
    }
  }

  const handleReorderFrames = async (activeId: string, overId: string) => {
    const previousFrames = frames
    const reorderedFrames = reorderFrames(previousFrames, activeId, overId)

    if (reorderedFrames === previousFrames) return

    setFrames(reorderedFrames)
    setDeletedFrame(null)
    nextSequenceRef.current = reorderedFrames.length + 1

    try {
      await saveFrames(reorderedFrames)
    } catch {
      setFrames(previousFrames)
      nextSequenceRef.current =
        previousFrames.reduce(
          (largest, frame) => Math.max(largest, frame.sequence),
          0,
        ) + 1
      setErrorMessage('The new frame order could not be saved. Try again.')
    }
  }

  const handleUndoDelete = async () => {
    if (!deletedFrame) return
    try {
      await saveFrame(deletedFrame)
      setFrames((current) =>
        [...current, deletedFrame].sort((a, b) => a.sequence - b.sequence),
      )
      setDeletedFrame(null)
    } catch {
      setErrorMessage('That frame could not be restored.')
    }
  }

  const handleClearFrames = async () => {
    if (!activeProject) return
    if (
      !window.confirm(
        `Delete all ${frames.length} frames from “${activeProject.name}”? This cannot be undone.`,
      )
    ) {
      return
    }

    try {
      captureGenerationRef.current += 1
      machineRef.current = resetCaptureMachine()
      await clearFrames(activeProject.id)
      setFrames([])
      setDeletedFrame(null)
      nextSequenceRef.current = 1
    } catch {
      setErrorMessage('The gallery could not be cleared. Try again.')
    }
  }

  const phaseDescription = describePhase(
    phase,
    remainingMs,
    settings.autoCaptureEnabled,
  )
  const countdownProgress =
    phase === 'clearing'
      ? 1 - remainingMs / settings.clearDelayMs
      : phase === 'capturing'
        ? 1
        : 0
  const activeTrackSettings = streamRef.current
    ?.getVideoTracks()[0]
    ?.getSettings()
  const cameraResolution =
    activeTrackSettings?.width && activeTrackSettings.height
      ? `${activeTrackSettings.width} × ${activeTrackSettings.height}`
      : '1280 × 720'
  const galleryLabel = useMemo(
    () => `${frames.length} ${frames.length === 1 ? 'frame' : 'frames'}`,
    [frames.length],
  )
  const showLandingSections = window.location.pathname === '/'

  return (
    <div className="app studio-page">
      <SiteHeader active="studio" />

      <main id="top">
        {showLandingSections ? (
          <>
        <section className="site-intro" aria-labelledby="site-title">
          <div className="site-intro__copy">
            <span className="site-intro__kicker">
              Free online stop motion maker
            </span>
            <h1 id="site-title">Make things move.</h1>
            <p>
              Create stop motion with your webcam—hands-free, private, and
              entirely in your browser.
            </p>
            <div className="site-intro__actions">
              <a className="button button--accent" href="#studio">
                Open the studio
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="button button--light" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="site-intro__features" aria-label="Product benefits">
              <span>Free</span>
              <span>No uploads</span>
              <span>No account</span>
            </div>
          </div>
          <div className="site-intro__art">
            <img
              src="/brand/hero-clay-studio.webp"
              alt="Colorful clay characters posing frame by frame in a tiny animation studio"
              width="1400"
              height="735"
              fetchPriority="high"
            />
          </div>
        </section>

        <section
          id="how-it-works"
          className="landing-section how-it-works"
          aria-labelledby="how-it-works-title"
        >
          <header className="landing-section__heading">
            <span className="landing-kicker">Hands-free by design</span>
            <h2 id="how-it-works-title">Your hand is the shutter.</h2>
            <p>
              No remote, timer routine, or repeated camera tapping. The
              on-device hand detectors know when you are working and when the
              set is clear. MediaPipe and ml5 HandPose run together, so a hand
              found by either model pauses capture.
            </p>
          </header>

          <div className="how-grid">
            <article className="how-card">
              <div className="how-card__image">
                <img
                  src="/brand/how-it-works/01-hand-detected.webp"
                  alt="Cartoon hand with blue landmark dots being detected beside an orange clay character"
                  width="900"
                  height="675"
                  loading="lazy"
                />
              </div>
              <div className="how-card__body">
                <span className="how-card__number">01</span>
                <h3>Show your hand</h3>
                <p>
                  Bring a hand into view. The browser recognizes its landmark
                  points and pauses capture while you work.
                </p>
              </div>
            </article>

            <article className="how-card">
              <div className="how-card__image">
                <img
                  src="/brand/how-it-works/02-adjust-scene.webp"
                  alt="Tracked cartoon hand repositioning an orange clay character"
                  width="900"
                  height="675"
                  loading="lazy"
                />
              </div>
              <div className="how-card__body">
                <span className="how-card__number">02</span>
                <h3>Make your move</h3>
                <p>
                  Repose a character or adjust a prop at your own pace. Your
                  hand stays out of every captured frame.
                </p>
              </div>
            </article>

            <article className="how-card">
              <div className="how-card__image">
                <img
                  src="/brand/how-it-works/03-capture-frame.webp"
                  alt="Orange clay character captured after the tracked hand moves outside the frame"
                  width="900"
                  height="675"
                  loading="lazy"
                />
              </div>
              <div className="how-card__body">
                <span className="how-card__number">03</span>
                <h3>Move clear</h3>
                <p>
                  When your hand leaves, the chosen delay runs and one clean
                  frame is captured. Bring your hand back to begin again.
                </p>
              </div>
            </article>
          </div>

        </section>

        <section
          id="privacy"
          className="privacy-section"
          aria-labelledby="privacy-title"
        >
          <div className="privacy-section__copy">
            <span className="landing-kicker">Local means local</span>
            <h2 id="privacy-title">Your work never becomes our data.</h2>
            <p className="privacy-section__lead">
              No camera frames, captured photos, or projects are stored on a
              server—ever. The entire creative workflow runs on the device in
              front of you.
            </p>

            <ul className="privacy-list">
              <li>
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  <strong>Detection stays on-device.</strong> Your live camera
                  feed is processed by two models running inside this browser.
                </span>
              </li>
              <li>
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  <strong>Projects stay in browser storage.</strong> Frames are
                  saved only in IndexedDB on this browser and this device.
                </span>
              </li>
              <li>
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  <strong>You decide what leaves.</strong> Downloads happen only
                  when you export a video or frame yourself.
                </span>
              </li>
              <li>
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  <strong>You can erase it.</strong> Clear frames, delete a
                  project, or remove the site’s browser data whenever you want.
                </span>
              </li>
            </ul>
          </div>

        </section>
          </>
        ) : null}

        <section
          id="studio"
          className="studio-section"
          aria-labelledby="studio-title"
        >
          <header className="studio-section__header">
            <div>
              <span className="landing-kicker">Your browser studio</span>
              <h2 id="studio-title">Start making.</h2>
            </div>
            <div className="studio-section__toolbar">
              <ProjectNav
                projects={projects}
                activeProjectId={activeProjectId}
                activeFrameCount={frames.length}
                onSelect={selectActiveProject}
                onCreate={() => void handleCreateProject()}
                onRename={() => void handleRenameProject()}
                onClear={() => void handleClearFrames()}
                onDelete={() => void handleDeleteProject()}
              />
            </div>
          </header>

          {errorMessage ? (
            <div className="error-banner" role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <span>{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage('')}>
                Dismiss
              </button>
            </div>
          ) : null}

          <section className="capture-workspace" aria-label="Camera workspace">
          <div
            className={`camera-card camera-card--${phaseDescription.tone} ${
              shutterVisible ? 'camera-card--shutter' : ''
            }`}
          >
            <div className="camera-card__media">
              <video ref={videoRef} muted playsInline aria-label="Live camera" />
              <canvas
                ref={overlayRef}
                className="landmark-overlay"
                aria-hidden="true"
              />
              {!cameraActive ? (
                <div className="camera-empty">
                  <div className="camera-empty__aperture">
                    <Aperture size={34} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <strong>Your set goes here</strong>
                  <p>
                    Start the camera, then bring a hand into view to arm the
                    shutter.
                  </p>
                  <button
                    className="button button--accent"
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={!detectorReady}
                  >
                    <Camera size={18} aria-hidden="true" />
                    {detectorReady ? 'Start camera' : 'Preparing camera…'}
                  </button>
                </div>
              ) : null}

              {cameraActive ? (
                <div className="camera-hud camera-hud--top">
                  <span className="live-chip">
                    <span />
                    Live
                  </span>
                  <span className="resolution-chip">{cameraResolution}</span>
                </div>
              ) : null}

              {cameraActive ? (
                <div className="camera-hud camera-hud--bottom">
                  <div
                    className={`camera-status camera-status--${phaseDescription.tone}`}
                    aria-live="polite"
                  >
                    <span className="camera-status__icon">
                      {phase === 'hand-present' ? (
                        <Hand size={19} aria-hidden="true" />
                      ) : phase === 'capturing' ? (
                        <Sparkles size={19} aria-hidden="true" />
                      ) : (
                        <span className="status-dot" />
                      )}
                    </span>
                    <span>
                      <strong>{phaseDescription.label}</strong>
                      <small>{phaseDescription.detail}</small>
                    </span>
                  </div>
                  {phase === 'clearing' ? (
                    <div
                      className="countdown-meter"
                      aria-label={`${Math.ceil(remainingMs)} milliseconds until capture`}
                    >
                      <span
                        style={{
                          transform: `scaleX(${Math.max(0, countdownProgress)})`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="shutter-flash" aria-hidden="true" />
            </div>
          </div>

          <aside className="control-panel">
            <div className="control-block control-block--capture-mode">
              <div
                className="capture-mode-toggle"
                role="group"
                aria-label="Automatic capture mode"
              >
                <button
                  type="button"
                  className={
                    settings.autoCaptureEnabled
                      ? 'capture-mode-toggle__option is-active'
                      : 'capture-mode-toggle__option'
                  }
                  aria-pressed={settings.autoCaptureEnabled}
                  onClick={() => handleAutoCaptureChange(true)}
                >
                  <span className="capture-mode-toggle__dot" aria-hidden="true" />
                  Ready
                </button>
                <button
                  type="button"
                  className={
                    settings.autoCaptureEnabled
                      ? 'capture-mode-toggle__option'
                      : 'capture-mode-toggle__option is-active'
                  }
                  aria-pressed={!settings.autoCaptureEnabled}
                  onClick={() => handleAutoCaptureChange(false)}
                >
                  Stop
                </button>
              </div>
              <p className="capture-mode-help">
                {settings.autoCaptureEnabled
                  ? 'Automatic capture is ready.'
                  : 'Automatic capture is stopped. Take frame still works.'}
              </p>
            </div>

            <div className="control-block delay-control">
              <div className="control-label">
                <div>
                  <strong>Clear-frame delay</strong>
                  <span>Time after your hand leaves</span>
                </div>
                <output>{settings.clearDelayMs} ms</output>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={settings.clearDelayMs}
                onChange={(event) => {
                  const clearDelayMs = Number(event.target.value)
                  updateSettings({ clearDelayMs })
                  setRemainingMs(clearDelayMs)
                  machineRef.current = resetCaptureMachine()
                }}
                aria-label="Clear-frame delay in milliseconds"
              />
              <div className="range-labels">
                <span>100 ms</span>
                <span>5 sec</span>
              </div>
            </div>

            <div className="control-block">
              <label className="select-label" htmlFor="camera-select">
                <strong>Camera source</strong>
                <span>Choose after granting access</span>
              </label>
              <select
                id="camera-select"
                value={settings.selectedCameraId}
                onChange={(event) => {
                  const selectedCameraId = event.target.value
                  updateSettings({ selectedCameraId })
                  if (cameraActive) void startCamera(selectedCameraId)
                }}
                disabled={cameras.length === 0}
              >
                {cameras.length === 0 ? (
                  <option value="">Default camera</option>
                ) : (
                  cameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${index + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="capture-buttons">
              <button
                className="button button--secondary"
                type="button"
                onClick={cameraActive ? stopCamera : () => void startCamera()}
                disabled={!cameraActive && !detectorReady}
              >
                {cameraActive ? (
                  <CameraOff size={18} aria-hidden="true" />
                ) : (
                  <Camera size={18} aria-hidden="true" />
                )}
                {cameraActive ? 'Stop camera' : 'Start camera'}
              </button>
              <button
                className="button button--light"
                type="button"
                onClick={() => void captureCurrentFrame()}
                disabled={!cameraActive || captureBusyRef.current}
              >
                <ImagePlus size={18} aria-hidden="true" />
                Take frame
              </button>
            </div>

            <p className="privacy-note">
              <LockKeyhole size={14} aria-hidden="true" />
              Camera processing and photos stay in this browser.
            </p>
          </aside>
        </section>

          <section className="gallery-section" aria-labelledby="gallery-title">
          <header className="section-header">
            <div className="section-header__title">
              <span className="step-number">01</span>
              <div>
                <span className="eyebrow">
                  {activeProject?.name ?? 'Your sequence'}
                </span>
                <h2 id="gallery-title">Captured frames</h2>
              </div>
              <span className="frame-count">{galleryLabel}</span>
            </div>
            <div className="section-actions">
              <button
                className="button button--ghost-danger"
                type="button"
                onClick={() => void handleClearFrames()}
                disabled={frames.length === 0}
              >
                <Trash2 size={17} aria-hidden="true" />
                Clear all
              </button>
              <button
                className="button button--accent"
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={frames.length < 2}
              >
                <Play size={17} fill="currentColor" aria-hidden="true" />
                Preview motion
              </button>
            </div>
          </header>

          {framesLoading ? (
            <div className="gallery-loading">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <Gallery
              frames={frames}
              onDelete={(frame) => void handleDeleteFrame(frame)}
              onDownload={(frame) =>
                downloadBlob(frame.imageBlob, formatFrameFilename(frame))
              }
              onReorder={(activeId, overId) =>
                void handleReorderFrames(activeId, overId)
              }
            />
          )}
          </section>
        </section>
      </main>

      <SiteFooter />

      {deletedFrame ? (
        <div className="undo-toast" role="status">
          <span>Frame {deletedFrame.sequence} deleted</span>
          <button type="button" onClick={() => void handleUndoDelete()}>
            Undo
          </button>
        </div>
      ) : null}

      {showPreview ? (
        <PreviewModal
          frames={frames}
          fps={settings.playbackFps}
          onFpsChange={(playbackFps) => updateSettings({ playbackFps })}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </div>
  )
}

export default App
