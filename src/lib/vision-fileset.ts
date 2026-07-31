import { FilesetResolver } from '@mediapipe/tasks-vision'

export function resolveVisionFileset(wasmPath: string) {
  // The detector runs in an ES-module worker, so MediaPipe must use its module
  // loader. The classic loader does not expose ModuleFactory in that scope.
  return FilesetResolver.forVisionTasks(wasmPath, true)
}
