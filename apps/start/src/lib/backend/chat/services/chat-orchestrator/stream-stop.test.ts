import { describe, expect, it } from 'vitest'
import { isUserStopped, parseStreamStopReason } from './stream-stop'

describe('stream abort classification', () => {
  it('recognizes only the explicit user reason, including its pub/sub payload', () => {
    const controller = new AbortController()
    expect(isUserStopped(controller.signal)).toBe(false)
    controller.abort(parseStreamStopReason('user-stop'))
    expect(isUserStopped(controller.signal)).toBe(true)
  })
  it.each(['replaced', 'stop', '', '{"reason":"user-stop"}'])(
    'does not mislabel %s as a user stop',
    (payload) => {
      const controller = new AbortController()
      controller.abort(parseStreamStopReason(payload))
      expect(isUserStopped(controller.signal)).toBe(false)
    },
  )
  it('keeps transport abort semantics', () => {
    const controller = new AbortController()
    controller.abort()
    expect(isUserStopped(controller.signal)).toBe(false)
  })
})
