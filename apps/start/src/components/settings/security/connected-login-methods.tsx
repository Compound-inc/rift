'use client'

import { Button } from '@rift/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { GitHubIcon, GoogleIcon, MicrosoftIcon } from '@/components/icons/provider-icons'
import { Mail, MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { m } from '@/paraglide/messages.js'
import type { ConnectedLoginMethodViewModel } from './security-page.logic'

export type ConnectedLoginMethodsProps = {
  connectedLoginMethods: Array<ConnectedLoginMethodViewModel>
  loginMethodsLoaded: boolean
  loginMethodsLoading: boolean
  primaryEmail: string | null
  canEdit: boolean
  linkingProviderId: string | null
  unlinkingLoginMethodId: string | null
  onConnectProvider: (providerId: string) => void
  onUnlinkMethod: (method: ConnectedLoginMethodViewModel) => void
}

/**
 * Renders the connected login methods section with fixed provider rows so the
 * visual hierarchy mirrors common auth-settings layouts.
 */
export function ConnectedLoginMethods({
  connectedLoginMethods,
  loginMethodsLoaded,
  loginMethodsLoading,
  primaryEmail,
  canEdit,
  linkingProviderId,
  unlinkingLoginMethodId,
  onConnectProvider,
  onUnlinkMethod,
}: ConnectedLoginMethodsProps) {
  const isLoading = !loginMethodsLoaded || loginMethodsLoading

  const findMethodByProvider = (providerId: string): ConnectedLoginMethodViewModel | null => {
    const normalizedTarget = providerId.trim().toLowerCase()
    return (
      connectedLoginMethods.find((method) => method.providerId.trim().toLowerCase() === normalizedTarget) ??
      null
    )
  }

  const credentialMethod =
    findMethodByProvider('credential') ??
    findMethodByProvider('credentials') ??
    findMethodByProvider('email-password')
  const googleMethod = findMethodByProvider('google')
  const githubMethod = findMethodByProvider('github')
  const microsoftMethod = findMethodByProvider('microsoft')

  const canRemoveEmail =
    !!credentialMethod && connectedLoginMethods.length > 1

  const socialRows: Array<{
    providerId: string
    providerLabel: string
    connectedMethod: ConnectedLoginMethodViewModel | null
    icon: ReactNode
  }> = [
    {
      providerId: 'google',
      providerLabel: m.settings_security_login_methods_provider_google(),
      connectedMethod: googleMethod,
      icon: <GoogleIcon className="size-5" />,
    },
    {
      providerId: 'github',
      providerLabel: m.settings_security_login_methods_provider_github(),
      connectedMethod: githubMethod,
      icon: <GitHubIcon className="size-5 text-foreground-primary" />,
    },
    {
      providerId: 'microsoft',
      providerLabel: 'Microsoft',
      connectedMethod: microsoftMethod,
      icon: <MicrosoftIcon className="size-5" />,
    },
  ]

  return (
    <ul className="overflow-hidden rounded-xl border border-border-base divide-y divide-border-base">
      <li className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-6 shrink-0 items-center justify-center">
            <Mail className="size-5 text-foreground-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-strong">
              {m.settings_security_login_methods_provider_email_password()}
            </p>
            <p className="truncate text-sm text-foreground-tertiary">
              {primaryEmail && primaryEmail.trim().length > 0
                ? primaryEmail
                : m.settings_security_login_methods_email_description_fallback()}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="iconSmall"
                className="size-8 rounded-md"
                aria-label={m.settings_security_login_methods_action_manage()}
                disabled={!canEdit || isLoading}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={6} className="w-40 min-w-0">
            {canRemoveEmail && credentialMethod ? (
              <DropdownMenuItem
                onClick={() => {
                  void onUnlinkMethod(credentialMethod)
                }}
                disabled={!canEdit || unlinkingLoginMethodId != null || isLoading}
                variant="destructive"
              >
                {unlinkingLoginMethodId === credentialMethod.methodId
                  ? m.settings_security_login_methods_unlink_loading()
                  : m.settings_security_login_methods_unlink_button()}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                {m.settings_security_login_methods_action_manage()}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>

      {socialRows.map((row) => {
        const connectedMethod = row.connectedMethod
        return (
        <li key={row.providerId} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center">{row.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-strong">{row.providerLabel}</p>
              <p className="truncate text-sm text-foreground-tertiary">
                {row.connectedMethod
                  ? m.settings_security_login_methods_connected_provider_help()
                  : m.settings_security_login_methods_connect_provider_help({
                      provider: row.providerLabel,
                    })}
              </p>
            </div>
          </div>
          {connectedMethod ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSmall"
                    className="size-8 rounded-md"
                    aria-label={m.settings_security_login_methods_action_manage()}
                disabled={!canEdit || unlinkingLoginMethodId != null || isLoading}
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={6} className="w-40 min-w-0">
                <DropdownMenuItem
                  onClick={() => {
                    void onUnlinkMethod(connectedMethod)
                  }}
                  disabled={!canEdit || unlinkingLoginMethodId != null}
                  variant="destructive"
                >
                  {unlinkingLoginMethodId === connectedMethod.methodId
                    ? m.settings_security_login_methods_unlink_loading()
                    : m.settings_security_login_methods_unlink_button()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              onClick={() => {
                void onConnectProvider(row.providerId)
              }}
              disabled={!canEdit || linkingProviderId != null || isLoading}
            >
              {m.settings_security_login_methods_action_connect()}
            </Button>
          )}
        </li>
      )})}
    </ul>
  )
}
