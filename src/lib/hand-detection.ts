export interface HandDetectorVotes {
  mediapipe: boolean
  ml5: boolean
}

export function anyHandDetectorVotedYes(votes: HandDetectorVotes): boolean {
  return votes.mediapipe || votes.ml5
}

export function didDetectedHandClear(
  wasDetected: boolean,
  isDetected: boolean,
): boolean {
  return wasDetected && !isDetected
}
