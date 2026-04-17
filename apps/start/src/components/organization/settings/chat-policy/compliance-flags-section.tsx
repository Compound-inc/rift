'use client'

import { Form } from '@rift/ui/form'
import type { WorkspaceFeatureAccessState } from '@/lib/shared/access-control'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import { m } from '@/paraglide/messages.js'
import type { ChatPolicySettingsPayload } from './types'
import type { useChatPolicySettings } from './use-chat-policy-settings'

type ComplianceFlagsSectionProps = {
  payload: ChatPolicySettingsPayload
  updating: boolean
  update: ReturnType<typeof useChatPolicySettings>['update']
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
}

function ZdrComplianceForm({
  payload,
  updating,
  update,
  featureAccess,
}: ComplianceFlagsSectionProps) {
  const sectionEnabled = featureAccess?.allowed ?? true

  return (
    <Form
      title={m.org_compliance_flag_require_zdr_title()}
      description={m.org_compliance_flag_require_zdr_description()}
      {...getFeatureAccessFormProps({
        enabled: sectionEnabled,
        featureAccess,
        defaultHelpText: m.org_compliance_flag_require_zdr_help(),
      })}
      headerToggle={{
        checked: Boolean(payload.policy.complianceFlags.require_zdr),
        onCheckedChange: (enabled) =>
          void update({
            action: 'toggle_compliance_flag',
            flag: 'require_zdr',
            enabled,
          }),
        disabled: updating || !sectionEnabled,
      }}
    />
  )
}

function RequireOrgProviderKeyForm({
  payload,
  updating,
  update,
  featureAccess,
}: ComplianceFlagsSectionProps) {
  const byokEnabled = featureAccess?.allowed ?? false

  return (
    <Form
      title={m.org_compliance_flag_require_org_provider_key_title()}
      description={m.org_compliance_flag_require_org_provider_key_description()}
      {...getFeatureAccessFormProps({
        enabled: byokEnabled,
        featureAccess,
        defaultHelpText: m.org_compliance_flag_require_org_provider_key_help(),
      })}
      headerToggle={{
        checked: Boolean(
          payload.policy.complianceFlags.require_org_provider_key,
        ),
        onCheckedChange: (enabled) =>
          void update({
            action: 'toggle_compliance_flag',
            flag: 'require_org_provider_key',
            enabled,
          }),
        disabled: updating || !byokEnabled,
      }}
    />
  )
}

function EnforceStudyModeForm({
  payload,
  updating,
  update,
  featureAccess,
}: ComplianceFlagsSectionProps) {
  const sectionEnabled = featureAccess?.allowed ?? true

  return (
    <Form
      title={m.org_compliance_flag_enforce_study_mode_title()}
      description={m.org_compliance_flag_enforce_study_mode_description()}
      {...getFeatureAccessFormProps({
        enabled: sectionEnabled,
        featureAccess,
        defaultHelpText: m.org_compliance_flag_enforce_study_mode_help(),
      })}
      headerToggle={{
        checked: payload.policy.enforcedModeId === 'study',
        onCheckedChange: (enabled) =>
          void update({
            action: 'set_enforced_mode',
            modeId: enabled ? 'study' : null,
          }),
        disabled: updating || !sectionEnabled,
      }}
    />
  )
}

export function ComplianceFlagsSection({
  payload,
  updating,
  update,
  featureAccess,
}: ComplianceFlagsSectionProps) {
  const sectionEnabled = featureAccess?.allowed ?? true

  return (
    <div className="space-y-6">
      <ZdrComplianceForm
        payload={payload}
        updating={updating || !sectionEnabled}
        update={update}
        featureAccess={featureAccess}
      />
      <RequireOrgProviderKeyForm
        payload={payload}
        updating={updating || !sectionEnabled}
        update={update}
        featureAccess={featureAccess}
      />
      <EnforceStudyModeForm
        payload={payload}
        updating={updating || !sectionEnabled}
        update={update}
        featureAccess={featureAccess}
      />
    </div>
  )
}
