'use client'

import { Form } from '@rift/ui/form'
import type { WorkspaceFeatureAccessState } from '@/lib/shared/access-control'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import { m } from '@/paraglide/messages.js'
import type { ChatPolicySettingsPayload } from './types'
import type { useChatPolicySettings } from './use-chat-policy-settings'

type ModelControlsSectionProps = {
  payload: ChatPolicySettingsPayload
  updating: boolean
  update: ReturnType<typeof useChatPolicySettings>['update']
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
}

/**
 * Model controls section: Form card with toggleSection for each model.
 * Toggling disables or enables the model; shows denial reason when disabled elsewhere.
 */
export function ModelControlsSection({
  payload,
  updating,
  update,
  featureAccess,
}: ModelControlsSectionProps) {
  const featureEnabled = featureAccess?.allowed ?? true

  return (
    <Form
      title={m.org_model_controls_title()}
      description={m.org_model_controls_description()}
      {...getFeatureAccessFormProps({
        enabled: featureEnabled,
        featureAccess,
        defaultHelpText: m.org_model_controls_help(),
      })}
      toggleSection={{
        sectionTitle: m.org_model_controls_section_title(),
        items: payload.models.map((model) => ({
          id: model.id,
          title: model.name,
          description: [
            model.id,
            model.deniedBy.length > 0
              ? m.org_model_controls_disabled_by({ sources: model.deniedBy.join(', ') })
              : null,
          ]
            .filter(Boolean)
            .join(' · '),
          checked: payload.policy.disabledModelIds.includes(model.id),
          onCheckedChange: (disabled) =>
            void update({
              action: 'toggle_model',
              modelId: model.id,
              disabled,
            }),
          disabled: updating || !featureEnabled,
        })),
      }}
    />
  )
}
