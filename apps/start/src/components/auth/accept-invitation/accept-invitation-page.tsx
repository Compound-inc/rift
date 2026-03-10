'use client'

import { Navigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Button } from '@rift/ui/button'
import { Avatar, AvatarFallback } from '@rift/ui/avatar'
import { AlertTriangle, Check } from 'lucide-react'
import {
  cardVariants,
  menuCardButtonVariants,
  menuCardContainerVariants,
  menuCardContentVariants,
  menuCardHeaderVariants,
  staggerChildVariants,
} from '@/lib/animations'
import { m } from '@/paraglide/messages.js'
import { useAcceptInvitationPageLogic } from './accept-invitation-page.logic'

export type AcceptInvitationPageProps = {
  invitationId: string
}

/**
 * Page shown when a user opens an organization invitation link from email.
 * If not signed in, redirects to auth so the invite can be accepted inline
 * right after account creation. Authenticated users stay on this screen so
 * they can review the invitation before explicitly accepting or declining it.
 */
export function AcceptInvitationPage({ invitationId }: AcceptInvitationPageProps) {
  const {
    user,
    authLoading,
    invitation,
    invitationError,
    actionLoading,
    actionError,
    actionSuccess,
    handleAccept,
    handleReject,
  } = useAcceptInvitationPageLogic(invitationId)

  if (!authLoading && !user) {
    return (
      <Navigate
        to="/auth/sign-up"
        search={{
          redirect: '/chat',
          invitationId,
        }}
      />
    )
  }

  if (authLoading) {
    return (
      <div className="relative z-10 flex min-h-[40vh] items-center justify-center p-8">
        <p className="text-foreground-secondary">{m.auth_invitation_loading()}</p>
      </div>
    )
  }

  return (
    <motion.main
      className="relative z-10 flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4"
      variants={menuCardContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="mb-8 max-w-xl text-center"
        variants={menuCardHeaderVariants}
      >
        <h1 className="mb-4 text-3xl font-bold text-black dark:text-white">
          {m.auth_invitation_title()}
        </h1>
        <p className="text-lg text-black/70 dark:text-white/60">
          {m.auth_invitation_subtitle()}
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface-strong/30 dark:bg-surface-strong/50 backdrop-blur-xl shadow-[0_0_1px_rgba(0,0,0,0.40),0_0_2px_rgba(0,0,0,0.05),0_10px_10px_rgba(0,0,0,0.25)] transition-colors duration-200"
        variants={menuCardContentVariants}
      >
        <div className="rounded-b-3xl bg-surface-raised/70 dark:bg-surface-raised/60 backdrop-blur-sm p-8 shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.08)] transition-colors duration-200">
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {actionSuccess ? (
              <motion.div
                variants={staggerChildVariants}
                initial={false}
                animate="visible"
                className="flex flex-col items-center pb-2 pt-4 text-center"
              >
                <div className="relative mb-4 inline-flex">
                  <Avatar className="border border-border-base/60 shadow-sm" size="xl">
                    <AvatarFallback
                      seed={invitation?.organizationName ?? m.layout_organization_tooltip_name()}
                      name={invitation?.organizationName ?? 'O'}
                      className="text-xl"
                    />
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground-success text-white ring-2 ring-surface-raised">
                    <Check strokeWidth={3} className="size-2.5" />
                  </span>
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground-primary">
                  {m.auth_invitation_success_title()}
                </h2>
                <p className="text-sm text-foreground-tertiary">
                  {m.auth_invitation_success_description()}
                </p>
              </motion.div>
            ) : invitationError ? (
              <motion.div
                variants={staggerChildVariants}
                initial={false}
                animate="visible"
                className="flex flex-col items-center pb-2 pt-4 text-center"
              >
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-foreground-error/10">
                  <AlertTriangle className="size-8 text-foreground-error" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground-primary">
                  {m.auth_invitation_invalid_title()}
                </h2>
                <p className="text-sm text-foreground-tertiary">
                  {invitationError}
                </p>
              </motion.div>
            ) : user ? (
              <motion.div
                variants={staggerChildVariants}
                initial={false}
                animate="visible"
                className="flex flex-col items-center pb-2 pt-4"
              >
                <div className="mb-4 flex items-center justify-center">
                  {invitation ? (
                    <Avatar className="border border-border-base/60 shadow-sm" size="xl">
                      <AvatarFallback
                        seed={invitation.organizationName ?? m.layout_organization_tooltip_name()}
                        name={invitation.organizationName ?? 'O'}
                        className="text-xl"
                      />
                    </Avatar>
                  ) : (
                    <div className="size-12 animate-pulse rounded-full bg-foreground-secondary/20" aria-hidden="true" />
                  )}
                </div>

                <div className="text-center">
                  <p className="mb-1 text-sm font-medium text-foreground-secondary">
                    {m.auth_invitation_invited_to_label()}
                  </p>
                  {invitation ? (
                    <>
                      <h2 className="text-xl font-bold text-foreground-primary">
                        {invitation.organizationName ?? m.auth_invitation_title_fallback()}
                      </h2>
                      {invitation.inviterLabel ? (
                        <p className="mt-2 text-sm text-foreground-tertiary">
                          {m.auth_invitation_invited_by({ inviter: invitation.inviterLabel })}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-2 flex flex-col items-center space-y-2">
                      <div className="h-[1.75rem] w-48 animate-pulse rounded-md bg-foreground-secondary/30" aria-hidden="true" />
                      <div className="h-[1.25rem] w-32 animate-pulse rounded-md bg-foreground-secondary/20" aria-hidden="true" />
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}

            {actionError && !actionSuccess ? (
              <motion.div
                variants={staggerChildVariants}
                initial={false}
                animate="visible"
              >
                <p className="text-sm text-foreground-error">{actionError}</p>
              </motion.div>
            ) : null}
          </motion.div>
        </div>

        {!actionSuccess && (
          <motion.div
            variants={menuCardButtonVariants}
            className="flex items-center justify-end gap-3 px-8 py-4 transition-colors duration-200"
          >
            <Button
              type="button"
              variant="ghost"
              size="large"
              onClick={handleReject}
              disabled={!!actionLoading}
            >
              {actionLoading === 'reject' ? m.auth_invitation_declining() : m.auth_invitation_decline()}
            </Button>
            <Button
              type="button"
              variant="default"
              size="large"
              onClick={handleAccept}
              disabled={
                !!actionLoading || !invitation || !!invitationError
              }
            >
              {m.auth_invitation_join()}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.main>
  )
}
