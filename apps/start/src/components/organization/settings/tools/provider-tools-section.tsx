'use client'

import * as React from 'react'
import { Form } from '@rift/ui/form'
import { getProviderIcon } from '@/lib/ai-catalog'
import type { WorkspaceFeatureAccessState } from '@/lib/billing/plan-catalog'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import {
  getLocalizedToolCopy,
  getToolUiGroupKey,
} from '@/lib/ai-catalog/tool-ui'
import type { CatalogProviderId } from '@/lib/ai-catalog/provider-tools'
import { PROVIDER_NAMES } from '@/components/organization/settings/model-policy/provider-constants'
import { m } from '@/paraglide/messages.js'
import type { PolicyPayload } from '@/components/organization/settings/model-policy/types'
import type { useProviderPolicy } from '@/components/organization/settings/model-policy/use-provider-policy'

type ProviderToolsSectionProps = {
  payload: PolicyPayload
  updating: boolean
  update: ReturnType<typeof useProviderPolicy>['update']
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
}

type ToolSettingsGroup = {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly tools: PolicyPayload['tools']
}

/**
 * The settings UI intentionally groups exact provider tool ids when they map
 * to the same user-facing capability. This lets Anthropic expose multiple
 * code-execution revisions in the catalog while still presenting one toggle
 * for "Code Execution", and separate toggles only when the UI copy explicitly
 * differentiates a variant such as "Dynamic Filtering".
 */
function groupToolsForDisplay(
  tools: ReadonlyArray<PolicyPayload['tools'][number]>,
): ReadonlyMap<string, readonly ToolSettingsGroup[]> {
  const groupsByProvider = new Map<string, ToolSettingsGroup[]>()

  for (const tool of tools) {
    const localizedCopy = getLocalizedToolCopy(tool.key)
    const providerGroups = groupsByProvider.get(tool.providerId) ?? []
    const groupId = `${tool.providerId}:${getToolUiGroupKey(tool.key)}`
    const existingGroup = providerGroups.find((group) => group.id === groupId)

    if (existingGroup) {
      existingGroup.tools.push(tool)
      continue
    }

    providerGroups.push({
      id: groupId,
      label: localizedCopy.label,
      description: localizedCopy.description,
      tools: [tool],
    })
    groupsByProvider.set(tool.providerId, providerGroups)
  }

  return groupsByProvider
}

/**
 * Exact provider-tool controls. Tools are grouped by provider with subsection
 * headers (provider name + icon). Each row shows tool name and toggle; no per-row icon.
 */
export function ProviderToolsSection({
  payload,
  updating,
  update,
  featureAccess,
}: ProviderToolsSectionProps) {
  const featureEnabled = featureAccess?.allowed ?? true
  const groupedTools = React.useMemo(
    () => [...groupToolsForDisplay(payload.tools).entries()],
    [payload.tools],
  )

  const subsections = React.useMemo(
    () =>
      groupedTools.map(([providerId, tools]) => {
        const ProviderIcon = getProviderIcon(providerId as CatalogProviderId)
        const providerName = PROVIDER_NAMES[providerId] ?? providerId
        return {
          title: providerName,
          titleIcon: ProviderIcon ? (
            <ProviderIcon className="size-5 text-content-default" />
          ) : (
            <div className="size-5 rounded-full bg-bg-inverted" />
          ),
          items: tools.map((toolGroup) => {
            const groupEnabled = toolGroup.tools.some((tool) => !tool.disabled)
            const toggleDisabled = toolGroup.tools.every(
              (tool) =>
                !(
                  tool.source === 'provider-native'
                    ? payload.policy.toolPolicy.providerNativeToolsEnabled
                    : payload.policy.toolPolicy.externalToolsEnabled
                ),
            )

            return {
              id: toolGroup.id,
              title: toolGroup.label,
              description: toolGroup.description,
              checked: groupEnabled,
              onCheckedChange: (enabled: boolean) =>
                void Promise.all(
                  toolGroup.tools.map((tool) =>
                    update({
                      action: 'toggle_tool',
                      toolKey: tool.key,
                      disabled: !enabled,
                    }),
                  ),
                ),
              disabled: updating || !featureEnabled || toggleDisabled,
            }
          }),
        }
      }),
    [
      groupedTools,
      payload.policy.toolPolicy.externalToolsEnabled,
      payload.policy.toolPolicy.providerNativeToolsEnabled,
      update,
      updating,
    ],
  )

  return (
    <Form
      title={m.org_provider_tools_title()}
      description={m.org_provider_tools_description()}
      {...getFeatureAccessFormProps({
        enabled: featureEnabled,
        featureAccess,
        defaultHelpText: m.org_provider_tools_help(),
      })}
      toggleSection={{
        sectionTitle: m.org_provider_tools_available_tools(),
        rowHover: true,
        subsections,
      }}
    />
  )
}
