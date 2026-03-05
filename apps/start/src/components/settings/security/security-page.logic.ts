'use client'

import { useCallback, useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

export type SecurityPageLogicResult = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  passwordMessage: string | null
  sessionsMessage: string | null
  sessionsLoaded: boolean
  canEdit: boolean
  activeSessions: Array<ActiveSessionViewModel>
  sessionsLoading: boolean
  sessionsRefreshing: boolean
  mfaEnabled: boolean
  mfaPendingVerification: boolean
  mfaBusy: boolean
  mfaMessage: string | null
  mfaSetupTotpURI: string | null
  mfaSetupStep: 'verify' | 'backup-codes' | null
  mfaBackupCodes: Array<string>
  mfaSetupPassword: string
  mfaSetupCode: string
  mfaDisablePassword: string
  revokingSessionToken: string | null
  revokingAllOtherSessions: boolean
  setCurrentPasswordInput: (nextValue: string) => void
  setNewPasswordInput: (nextValue: string) => void
  setConfirmPasswordInput: (nextValue: string) => void
  setMfaSetupPasswordInput: (nextValue: string) => void
  setMfaSetupCodeInput: (nextValue: string) => void
  setMfaDisablePasswordInput: (nextValue: string) => void
  submitPasswordChange: () => Promise<void>
  enableMfa: () => Promise<void>
  verifyMfaTotp: () => Promise<void>
  cancelMfaSetup: () => void
  finishMfaSetup: () => Promise<void>
  disableMfa: () => Promise<void>
  refreshActiveSessions: () => Promise<void>
  revokeSessionByToken: (sessionToken: string) => Promise<void>
  revokeAllOtherSessions: () => Promise<void>
}

export type ActiveSessionViewModel = {
  sessionId: string | null
  sessionToken: string
  label: string
  ipAddress: string | null
  createdAt: Date | null
  expiresAt: Date | null
  isCurrent: boolean
}

function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return normalizeSecurityErrorMessage(cause.message, fallback)
  }
  return fallback
}

/**
 * Maps provider-specific auth errors to user-facing copy that explains what action to take.
 */
function normalizeSecurityErrorMessage(message: string, fallback: string): string {
  const normalizedMessage = message.trim()
  const lowerCaseMessage = normalizedMessage.toLowerCase()

  if (
    lowerCaseMessage === 'invalid password' ||
    lowerCaseMessage.includes('invalid password')
  ) {
    return m.settings_security_error_current_invalid()
  }
  if (lowerCaseMessage === 'invalid code' || lowerCaseMessage.includes('invalid code')) {
    return m.settings_security_mfa_error_invalid_code()
  }

  return normalizedMessage.length > 0 ? normalizedMessage : fallback
}

function readBetterAuthResultError(result: unknown, fallback: string): string | null {
  if (result == null || typeof result !== 'object') {
    return null
  }

  const error = (result as { error?: unknown }).error
  if (error == null) {
    return null
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return normalizeSecurityErrorMessage(error, fallback)
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return normalizeSecurityErrorMessage(error.message, fallback)
  }

  const message = (error as { message?: unknown }).message
  if (typeof message === 'string' && message.trim().length > 0) {
    return normalizeSecurityErrorMessage(message, fallback)
  }

  return fallback
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function readStringField(
  source: Record<string, unknown> | null,
  keys: Array<string>,
): string | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return null
}

function readBooleanField(
  source: Record<string, unknown> | null,
  keys: Array<string>,
): boolean | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function readDateField(source: Record<string, unknown> | null, keys: Array<string>): Date | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }
  }
  return null
}

function readStringArrayField(
  source: Record<string, unknown> | null,
  keys: Array<string>,
): Array<string> | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (!Array.isArray(value)) continue
    const parsed = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    if (parsed.length > 0) return parsed
  }
  return null
}

function readSessionsArray(result: unknown): Array<unknown> {
  if (Array.isArray(result)) return result
  const resultRecord = readRecord(result)
  if (!resultRecord) return []
  if (Array.isArray(resultRecord.sessions)) return resultRecord.sessions
  const data = resultRecord.data
  if (Array.isArray(data)) return data
  const dataRecord = readRecord(data)
  if (!dataRecord) return []
  const sessions = dataRecord.sessions
  return Array.isArray(sessions) ? sessions : []
}

/**
 * Better Auth 2FA payloads can be nested in either `{ data }` or the root object.
 * This parser keeps MFA UI logic resilient to minor response-shape differences.
 */
function readTwoFactorEnableData(result: unknown): {
  totpURI: string | null
  backupCodes: Array<string>
} {
  const root = readRecord(result)
  const data = readRecord(root?.data)
  const source = data ?? root
  return {
    totpURI:
      readStringField(source, ['totpURI', 'totpUri', 'totp_uri']) ??
      readStringField(data, ['totpURI', 'totpUri', 'totp_uri']) ??
      null,
    backupCodes:
      readStringArrayField(source, ['backupCodes', 'backup_codes']) ??
      readStringArrayField(data, ['backupCodes', 'backup_codes']) ??
      [],
  }
}

function readTwoFactorEnabled(user: unknown): boolean {
  const userRecord = readRecord(user)
  const value = readBooleanField(userRecord, ['twoFactorEnabled', 'isTwoFactorEnabled'])
  return value === true
}

/**
 * Better Auth multi-session payloads may vary between versions and adapters.
 * The parser normalizes common shapes into a stable UI view-model.
 */
function mapActiveSession(
  entry: unknown,
  currentSessionId: string | null,
  currentSessionToken: string | null,
): ActiveSessionViewModel | null {
  const root = readRecord(entry)
  if (!root) return null
  const nestedSession = readRecord(root.session)

  const sessionId =
    readStringField(root, ['id', 'sessionId']) ?? readStringField(nestedSession, ['id', 'sessionId'])

  const sessionToken =
    readStringField(root, ['sessionToken', 'token']) ??
    readStringField(nestedSession, ['sessionToken', 'token']) ??
    sessionId

  if (!sessionToken) return null

  const label =
    readStringField(root, ['userAgent', 'device', 'deviceName']) ??
    readStringField(nestedSession, ['userAgent', 'device', 'deviceName']) ??
    m.settings_security_sessions_device_unknown()

  const ipAddress =
    readStringField(root, ['ipAddress', 'ip']) ?? readStringField(nestedSession, ['ipAddress', 'ip'])

  const isCurrent =
    readBooleanField(root, ['isCurrent', 'current', 'active']) ??
    readBooleanField(nestedSession, ['isCurrent', 'current', 'active']) ??
    ((sessionId != null && currentSessionId != null && sessionId === currentSessionId) ||
      (currentSessionToken != null && sessionToken === currentSessionToken))

  const createdAt =
    readDateField(root, ['createdAt', 'created_at']) ??
    readDateField(nestedSession, ['createdAt', 'created_at'])

  const expiresAt =
    readDateField(root, ['expiresAt', 'expires_at']) ??
    readDateField(nestedSession, ['expiresAt', 'expires_at'])

  return {
    sessionId,
    sessionToken,
    label,
    ipAddress,
    createdAt,
    expiresAt,
    isCurrent,
  }
}

/**
 * Centralized logic for password update settings.
 */
export function useSecurityPageLogic(): SecurityPageLogicResult {
  const { loading, user, isAnonymous, session, refetchSession } = useAppAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [sessionsMessage, setSessionsMessage] = useState<string | null>(null)
  const [activeSessions, setActiveSessions] = useState<Array<ActiveSessionViewModel>>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false)
  const [mfaMessage, setMfaMessage] = useState<string | null>(null)
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaSetupTotpURI, setMfaSetupTotpURI] = useState<string | null>(null)
  const [mfaSetupStep, setMfaSetupStep] = useState<'verify' | 'backup-codes' | null>(null)
  const [mfaBackupCodes, setMfaBackupCodes] = useState<Array<string>>([])
  const [mfaSetupPassword, setMfaSetupPassword] = useState('')
  const [mfaSetupCode, setMfaSetupCode] = useState('')
  const [mfaDisablePassword, setMfaDisablePassword] = useState('')
  const [revokingSessionToken, setRevokingSessionToken] = useState<string | null>(null)
  const [revokingAllOtherSessions, setRevokingAllOtherSessions] = useState(false)

  const canEdit = !loading && !!user && !isAnonymous
  const sessionRecord = readRecord(session)
  const currentSessionId = readStringField(sessionRecord, ['id', 'sessionId'])
  const currentSessionToken =
    readStringField(sessionRecord, ['token', 'sessionToken']) ??
    readStringField(readRecord(sessionRecord?.session), ['token', 'sessionToken'])
  const mfaEnabled = readTwoFactorEnabled(user)
  const mfaPendingVerification = mfaSetupTotpURI != null || mfaSetupStep === 'backup-codes'

  const setCurrentPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setCurrentPassword(nextValue)
  }

  const setNewPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setNewPassword(nextValue)
  }

  const setConfirmPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setConfirmPassword(nextValue)
  }

  const setMfaSetupPasswordInput = (nextValue: string) => {
    setMfaMessage(null)
    setMfaSetupPassword(nextValue)
  }

  const setMfaSetupCodeInput = (nextValue: string) => {
    setMfaSetupCode((currentValue) => {
      if (currentValue !== nextValue) {
        setMfaMessage(null)
      }
      return nextValue
    })
  }

  const setMfaDisablePasswordInput = (nextValue: string) => {
    setMfaMessage(null)
    setMfaDisablePassword(nextValue)
  }

  const submitPasswordChange = async () => {
    const normalizedCurrentPassword = currentPassword.trim()
    const normalizedNewPassword = newPassword.trim()
    const normalizedConfirmPassword = confirmPassword.trim()

    if (!canEdit) {
      setPasswordMessage(m.settings_security_error_sign_in_required())
      return
    }
    if (!normalizedCurrentPassword) {
      setPasswordMessage(m.settings_security_error_current_required())
      return
    }
    if (!normalizedNewPassword) {
      setPasswordMessage(m.settings_security_error_new_required())
      return
    }
    if (!normalizedConfirmPassword) {
      setPasswordMessage(m.settings_security_error_confirm_required())
      return
    }
    if (normalizedNewPassword !== normalizedConfirmPassword) {
      setPasswordMessage(m.settings_security_error_password_mismatch())
      return
    }
    if (normalizedCurrentPassword === normalizedNewPassword) {
      setPasswordMessage(m.settings_security_error_password_unchanged())
      return
    }

    try {
      const result = await authClient.changePassword({
        currentPassword: normalizedCurrentPassword,
        newPassword: normalizedNewPassword,
        revokeOtherSessions: true,
      })
      const apiErrorMessage = readBetterAuthResultError(result, m.settings_security_error_default())
      if (apiErrorMessage != null) {
        setPasswordMessage(apiErrorMessage)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(m.settings_security_success())
    } catch (cause) {
      setPasswordMessage(getErrorMessage(cause, m.settings_security_error_default()))
    }
  }

  /**
   * Start TOTP enrollment. Better Auth returns the provisioning URI and backup codes.
   * We persist both in state so the UI can render QR setup + a copyable recovery list.
   */
  const enableMfa = async () => {
    if (!canEdit) {
      setMfaMessage(m.settings_security_error_sign_in_required())
      return
    }

    const normalizedPassword = mfaSetupPassword.trim()
    if (!normalizedPassword) {
      setMfaMessage(m.settings_security_error_current_required())
      return
    }

    setMfaBusy(true)
    setMfaMessage(null)

    try {
      const result = await authClient.twoFactor.enable({
        password: normalizedPassword,
      })
      const apiErrorMessage = readBetterAuthResultError(result, m.settings_security_mfa_error_enable())
      if (apiErrorMessage != null) {
        setMfaMessage(apiErrorMessage)
        return
      }

      const data = readTwoFactorEnableData(result)
      if (!data.totpURI) {
        setMfaMessage(m.settings_security_mfa_error_enable())
        return
      }

      setMfaSetupTotpURI(data.totpURI)
      setMfaSetupStep('verify')
      setMfaBackupCodes(data.backupCodes)
      setMfaSetupCode('')
      setMfaMessage(null)
    } catch (cause) {
      setMfaMessage(getErrorMessage(cause, m.settings_security_mfa_error_enable()))
    } finally {
      setMfaBusy(false)
    }
  }

  const verifyMfaTotp = async () => {
    if (!canEdit) {
      setMfaMessage(m.settings_security_error_sign_in_required())
      return
    }

    const normalizedCode = mfaSetupCode.replace(/\s+/g, '')
    if (normalizedCode.length === 0) {
      setMfaMessage(m.settings_security_mfa_error_code_required())
      return
    }

    setMfaBusy(true)
    setMfaMessage(null)

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: normalizedCode,
        trustDevice: true,
      })
      const apiErrorMessage = readBetterAuthResultError(result, m.settings_security_mfa_error_verify())
      if (apiErrorMessage != null) {
        setMfaMessage(apiErrorMessage)
        return
      }

      setMfaSetupStep('backup-codes')
      setMfaSetupPassword('')
      setMfaSetupCode('')
      setMfaMessage(null)
    } catch (cause) {
      setMfaMessage(getErrorMessage(cause, m.settings_security_mfa_error_verify()))
    } finally {
      setMfaBusy(false)
    }
  }

  const cancelMfaSetup = () => {
    setMfaSetupTotpURI(null)
    setMfaSetupStep(null)
    setMfaSetupCode('')
    setMfaBackupCodes([])
    setMfaMessage(null)
  }

  const finishMfaSetup = async () => {
    setMfaSetupTotpURI(null)
    setMfaSetupStep(null)
    setMfaSetupPassword('')
    setMfaSetupCode('')
    setMfaBackupCodes([])
    try {
      await refetchSession()
    } finally {
      setMfaMessage(m.settings_security_mfa_success_enabled())
    }
  }

  const disableMfa = async () => {
    if (!canEdit) {
      setMfaMessage(m.settings_security_error_sign_in_required())
      return
    }

    const normalizedPassword = mfaDisablePassword.trim()
    if (!normalizedPassword) {
      setMfaMessage(m.settings_security_error_current_required())
      return
    }

    setMfaBusy(true)
    setMfaMessage(null)

    try {
      const result = await authClient.twoFactor.disable({
        password: normalizedPassword,
      })
      const apiErrorMessage = readBetterAuthResultError(result, m.settings_security_mfa_error_disable())
      if (apiErrorMessage != null) {
        setMfaMessage(apiErrorMessage)
        return
      }

      setMfaDisablePassword('')
      setMfaSetupPassword('')
      setMfaSetupCode('')
      setMfaSetupTotpURI(null)
      setMfaBackupCodes([])
      setMfaMessage(m.settings_security_mfa_success_disabled())
      await refetchSession()
    } catch (cause) {
      setMfaMessage(getErrorMessage(cause, m.settings_security_mfa_error_disable()))
    } finally {
      setMfaBusy(false)
    }
  }

  const refreshActiveSessions = useCallback(async () => {
    if (!canEdit) {
      setActiveSessions([])
      setSessionsLoaded(false)
      if (!loading) {
        setSessionsMessage(m.settings_security_sessions_error_sign_in_required())
      }
      return
    }

    setSessionsMessage(null)
    setSessionsRefreshing(true)
    setSessionsLoading(true)

    try {
      const authClientWithSessionApi = authClient as unknown as {
        listSessions?: () => Promise<unknown>
      }
      const result =
        typeof authClientWithSessionApi.listSessions === 'function'
          ? await authClientWithSessionApi.listSessions()
          : await authClient.multiSession.listDeviceSessions()
      const apiErrorMessage = readBetterAuthResultError(
        result,
        m.settings_security_sessions_error_load_default(),
      )
      if (apiErrorMessage != null) {
        setSessionsMessage(apiErrorMessage)
        return
      }

      const normalizedSessions = readSessionsArray(result)
        .map((entry) => mapActiveSession(entry, currentSessionId, currentSessionToken))
        .filter((item): item is ActiveSessionViewModel => item != null)
      setActiveSessions(normalizedSessions)
    } catch (cause) {
      setSessionsMessage(getErrorMessage(cause, m.settings_security_sessions_error_load_default()))
    } finally {
      setSessionsLoaded(true)
      setSessionsLoading(false)
      setSessionsRefreshing(false)
    }
  }, [canEdit, currentSessionId, currentSessionToken])

  const revokeSessionWithFallbackKeys = useCallback(
    async (sessionRef: string): Promise<unknown> => {
      const authClientWithSessionApi = authClient as unknown as {
        revokeSession?: (payload: Record<string, string>) => Promise<unknown>
      }

      if (typeof authClientWithSessionApi.revokeSession !== 'function') {
        return authClient.multiSession.revoke({
          sessionToken: sessionRef,
        })
      }

      const payloadCandidates: Array<Record<string, string>> = [
        { token: sessionRef },
        { sessionToken: sessionRef },
        { sessionId: sessionRef },
        { id: sessionRef },
      ]

      let lastResult: unknown = null
      for (const payload of payloadCandidates) {
        const candidateResult = await authClientWithSessionApi.revokeSession(payload)
        const candidateError = readBetterAuthResultError(candidateResult, '')
        lastResult = candidateResult
        if (candidateError == null || candidateError.trim().length === 0) {
          return candidateResult
        }
      }

      return lastResult
    },
    [],
  )

  const revokeSessionByToken = async (sessionToken: string) => {
    if (!canEdit) {
      setSessionsMessage(m.settings_security_sessions_error_sign_in_required())
      return
    }

    setRevokingSessionToken(sessionToken)
    setSessionsMessage(null)

    try {
      const result = await revokeSessionWithFallbackKeys(sessionToken)
      const apiErrorMessage = readBetterAuthResultError(
        result,
        m.settings_security_sessions_error_revoke_default(),
      )
      if (apiErrorMessage != null) {
        setSessionsMessage(apiErrorMessage)
        return
      }

      setSessionsMessage(m.settings_security_sessions_success_revoke_one())
      await refreshActiveSessions()
    } catch (cause) {
      setSessionsMessage(getErrorMessage(cause, m.settings_security_sessions_error_revoke_default()))
    } finally {
      setRevokingSessionToken(null)
    }
  }

  const revokeAllOtherSessions = async () => {
    if (!canEdit) {
      setSessionsMessage(m.settings_security_sessions_error_sign_in_required())
      return
    }

    const otherSessions = activeSessions.filter((session) => !session.isCurrent)
    if (otherSessions.length === 0) {
      setSessionsMessage(m.settings_security_sessions_no_other_sessions())
      return
    }

    setRevokingAllOtherSessions(true)
    setSessionsMessage(null)

    try {
      for (const session of otherSessions) {
        const result = await revokeSessionWithFallbackKeys(session.sessionToken)
        const apiErrorMessage = readBetterAuthResultError(
          result,
          m.settings_security_sessions_error_revoke_default(),
        )
        if (apiErrorMessage != null) {
          setSessionsMessage(apiErrorMessage)
          return
        }
      }

      setSessionsMessage(m.settings_security_sessions_success_revoke_others())
      await refreshActiveSessions()
    } catch (cause) {
      setSessionsMessage(getErrorMessage(cause, m.settings_security_sessions_error_revoke_default()))
    } finally {
      setRevokingAllOtherSessions(false)
    }
  }

  useEffect(() => {
    if (!canEdit) {
      setActiveSessions([])
      setSessionsMessage(m.settings_security_sessions_error_sign_in_required())
      return
    }
    void refreshActiveSessions()
  }, [canEdit, refreshActiveSessions])

  return {
    currentPassword,
    newPassword,
    confirmPassword,
    passwordMessage,
    sessionsMessage,
    canEdit,
    mfaEnabled,
    mfaPendingVerification,
    mfaBusy,
    mfaMessage,
    mfaSetupTotpURI,
    mfaBackupCodes,
    mfaSetupPassword,
    mfaSetupCode,
    mfaDisablePassword,
    activeSessions,
    sessionsLoaded,
    sessionsLoading,
    sessionsRefreshing,
    revokingSessionToken,
    revokingAllOtherSessions,
    setCurrentPasswordInput,
    setNewPasswordInput,
    setConfirmPasswordInput,
    setMfaSetupPasswordInput,
    setMfaSetupCodeInput,
    setMfaDisablePasswordInput,
    submitPasswordChange,
    enableMfa,
    verifyMfaTotp,
    cancelMfaSetup,
    finishMfaSetup,
    disableMfa,
    mfaSetupStep,
    refreshActiveSessions,
    revokeSessionByToken,
    revokeAllOtherSessions,
  }
}
