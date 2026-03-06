'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth/auth-client'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/** Minimal view model for the invitation card. */
export type InvitationViewModel = {
  organizationName: string | null
  inviterLabel: string | null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readInvitationViewModel(value: unknown): InvitationViewModel {
  const root = readRecord(value)
  const invitation = readRecord(root?.invitation)
  const organization = readRecord(root?.organization) ?? readRecord(invitation?.organization)
  const inviter = readRecord(root?.inviter) ?? readRecord(invitation?.inviter)
  const inviterUser = readRecord(inviter?.user)

  const organizationName =
    readString(organization?.name) ??
    readString(root?.organizationName) ??
    readString(invitation?.organizationName) ??
    null

  const inviterLabel =
    readString(inviterUser?.name) ??
    readString(inviterUser?.email) ??
    readString(inviter?.name) ??
    readString(inviter?.email) ??
    readString(root?.inviterName) ??
    readString(root?.inviterEmail) ??
    null

  return {
    organizationName,
    inviterLabel,
  }
}

export type AcceptInvitationPageLogicResult = {
  user: ReturnType<typeof useAppAuth>['user']
  authLoading: boolean
  invitation: InvitationViewModel | null
  invitationError: string | null
  actionLoading: 'accept' | 'reject' | null
  actionError: string | null
  actionSuccess: boolean
  handleAccept: () => Promise<void>
  handleReject: () => Promise<void>
}

/**
 * Hook that manages invitation state, fetching, and accept/reject actions.
 * Invitation metadata is only fetched for authenticated users; unauthenticated
 * invitees are redirected into sign-up by the page component.
 */
export function useAcceptInvitationPageLogic(
  invitationId: string,
): AcceptInvitationPageLogicResult {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAppAuth()
  const [invitation, setInvitation] = useState<InvitationViewModel | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(
    null,
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState(false)

  useEffect(() => {
    if (!user || !invitationId) return
    let cancelled = false
    setInvitationError(null)
    setActionError(null)
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setInvitationError(error.message ?? m.auth_invitation_error_load())
          return
        }
        if (data) {
          setInvitation(readInvitationViewModel(data))
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setInvitationError(
            err instanceof Error ? err.message : m.auth_invitation_error_load(),
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [user, invitationId])

  const handleAccept = async () => {
    if (!invitationId) return
    setActionError(null)
    setActionLoading('accept')
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      })
      if (error) {
        setActionError(error.message ?? m.auth_invitation_error_accept())
        return
      }
      const res = data as {
        invitation?: { organizationId?: string }
        member?: { organizationId?: string }
      }
      const orgId = res?.invitation?.organizationId ?? res?.member?.organizationId
      if (orgId) {
        await authClient.organization.setActive({ organizationId: orgId })
      }
      
      setActionSuccess(true)
      setTimeout(() => {
        navigate({ to: '/chat' })
      }, 3000)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : m.auth_invitation_error_accept(),
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!invitationId) return
    setActionError(null)
    setActionLoading('reject')
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      })
      if (error) {
        setActionError(error.message ?? m.auth_invitation_error_reject())
        return
      }
      navigate({ to: '/chat' })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : m.auth_invitation_error_reject(),
      )
    } finally {
      setActionLoading(null)
    }
  }

  return {
    user,
    authLoading,
    invitation,
    invitationError,
    actionLoading,
    actionError,
    actionSuccess,
    handleAccept,
    handleReject,
  }
}
