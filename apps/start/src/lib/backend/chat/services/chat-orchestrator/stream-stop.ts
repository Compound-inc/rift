/** Abort reasons travel as strings so Redis pub/sub preserves their meaning. */
export type StreamStopReason = 'user-stop' | 'replaced'

export function parseStreamStopReason(payload: string): StreamStopReason {
  // Legacy instances publish "stop". Never label an unclassified abort as a
  // user decision, including replacement by another turn.
  return payload === 'user-stop' ? 'user-stop' : 'replaced'
}

export function isUserStopped(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason === 'user-stop'
}
