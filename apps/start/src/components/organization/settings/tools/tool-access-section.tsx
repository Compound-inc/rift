'use client'

import * as React from 'react'
import { Form } from '@rift/ui/form'
import type { WorkspaceFeatureAccessState } from '@/lib/shared/access-control'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import { m } from '@/paraglide/messages.js'
import type { ChatPolicySettingsPayload } from '@/components/organization/settings/chat-policy/types'
import type { useChatPolicySettings } from '@/components/organization/settings/chat-policy/use-chat-policy-settings'

type ToolAccessSectionProps = {
  payload: ChatPolicySettingsPayload
  updating: boolean
  update: ReturnType<typeof useChatPolicySettings>['update']
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
}

/**
 * Organization-wide master switches for provider-native and external tools.
 * Both toggles live in one form so admins can control all tool access in one place.
 */
export function ToolAccessSection({
  payload,
  updating,
  update,
  featureAccess,
}: ToolAccessSectionProps) {
  const featureEnabled = featureAccess?.allowed ?? true
  const handleProviderNative = React.useCallback(
    (enabled: boolean) => {
      void update({
        action: 'toggle_provider_native_tools',
        enabled,
      })
    },
    [update],
  )

  const handleExternal = React.useCallback(
    (enabled: boolean) => {
      void update({
        action: 'toggle_external_tools',
        enabled,
      })
    },
    [update],
  )

  return (
    <Form
      title={m.org_tool_access_title()}
      description={m.org_tool_access_description()}
      {...getFeatureAccessFormProps({
        enabled: featureEnabled,
        featureAccess,
        defaultHelpText: m.org_tool_access_help(),
      })}
      toggleSection={{
        items: [
          {
            id: 'provider-native-tools',
            title: m.org_built_in_tools_toggle_title(),
            description: m.org_built_in_tools_toggle_description(),
            checked: payload.policy.toolPolicy.providerNativeToolsEnabled,
            onCheckedChange: handleProviderNative,
            disabled: updating || !featureEnabled,
          },
          {
            id: 'external-tools',
            title: m.org_external_tools_toggle_title(),
            description: m.org_external_tools_toggle_description(),
            checked: payload.policy.toolPolicy.externalToolsEnabled,
            onCheckedChange: handleExternal,
            disabled: updating || !featureEnabled,
          },
        ],
      }}
    />
  )
}
