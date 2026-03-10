'use client'

import { Button } from '@rift/ui/button'
import { Laptop, Smartphone } from 'lucide-react'
import { m } from '@/paraglide/messages.js'
import type { ActiveSessionViewModel } from './security-page.logic'

type ParsedSessionDevice = {
  browser: string
  platform: string
  isMobile: boolean
}

/**
 * Convert raw user-agent text into a short, human-readable label.
 * Kept lightweight and dependency-free for the settings page.
 */
function parseSessionDeviceLabel(userAgent: string): ParsedSessionDevice {
  const normalizedUA = userAgent.toLowerCase()

  const browser = (() => {
    if (normalizedUA.includes('edg/')) return 'Microsoft Edge'
    if (normalizedUA.includes('opr/') || normalizedUA.includes('opera/')) return 'Opera'
    if (normalizedUA.includes('firefox/')) return 'Firefox'
    if (normalizedUA.includes('chrome/') && !normalizedUA.includes('edg/')) return 'Chrome'
    if (normalizedUA.includes('safari/') && !normalizedUA.includes('chrome/')) return 'Safari'
    return m.settings_security_sessions_device_unknown()
  })()

  const platform = (() => {
    if (normalizedUA.includes('iphone') || normalizedUA.includes('ipad') || normalizedUA.includes('ios')) {
      return 'iOS'
    }
    if (normalizedUA.includes('android')) return 'Android'
    if (normalizedUA.includes('mac os x') || normalizedUA.includes('macintosh')) return 'macOS'
    if (normalizedUA.includes('windows')) return 'Windows'
    if (normalizedUA.includes('linux')) return 'Linux'
    return m.settings_security_sessions_device_unknown()
  })()

  const isMobile =
    normalizedUA.includes('mobile') ||
    normalizedUA.includes('android') ||
    normalizedUA.includes('iphone') ||
    normalizedUA.includes('ipad')

  return {
    browser,
    platform,
    isMobile,
  }
}

export type SessionListProps = {
  activeSessions: Array<ActiveSessionViewModel>
  sessionsLoaded: boolean
  canEdit: boolean
  revokingSessionToken: string | null
  revokingAllOtherSessions: boolean
  onRevokeSession: (sessionToken: string) => void
}

/**
 * Renders the list of active sessions with device info and per-session revoke actions.
 */
export function SessionList({
  activeSessions,
  sessionsLoaded,
  canEdit,
  revokingSessionToken,
  revokingAllOtherSessions,
  onRevokeSession,
}: SessionListProps) {
  if (!sessionsLoaded) {
    return null
  }

  if (activeSessions.length === 0) {
    return (
      <p className="text-sm text-foreground-tertiary">{m.settings_security_sessions_empty()}</p>
    )
  }

  return (
    <ul className="divide-y divide-border-base">
      {activeSessions.map((session) => {
        const parsedSession = parseSessionDeviceLabel(session.label)
        const DeviceIcon = parsedSession.isMobile ? Smartphone : Laptop
        return (
          <li key={session.sessionToken} className="py-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="text-foreground-tertiary">
                  <DeviceIcon className="size-6" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground-strong">
                    {parsedSession.browser} on {parsedSession.platform}{' '}
                    {session.isCurrent ? (
                      <span className="text-xs font-normal text-foreground-tertiary">
                        ({m.settings_security_sessions_current_badge()})
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-foreground-tertiary">
                    {m.settings_security_sessions_ip_label()}:{' '}
                    {session.ipAddress ?? m.settings_security_sessions_ip_unknown()}
                  </p>
                </div>
              </div>
              {!session.isCurrent ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void onRevokeSession(session.sessionToken)
                  }}
                  disabled={!canEdit || revokingSessionToken != null || revokingAllOtherSessions}
                >
                  {revokingSessionToken === session.sessionToken
                    ? m.settings_security_sessions_revoke_single_loading()
                    : m.settings_security_sessions_revoke_single_button()}
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
