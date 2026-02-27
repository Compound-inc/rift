'use client'

import { Form } from '@rift/ui/form'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import type { PolicyPayload } from './types'
import type { useProviderPolicy } from './use-provider-policy'

type ComplianceFlagsSectionProps = {
  payload: PolicyPayload
  updating: boolean
  update: ReturnType<typeof useProviderPolicy>['update']
}

/**
 * Compliance flags section: single Form card with toggleSection for flags
 * (e.g. require_zdr). Updates policy on toggle change.
 */
export function ComplianceFlagsSection({
  payload,
  updating,
  update,
}: ComplianceFlagsSectionProps) {
  const byokEnabled = canUseOrganizationProviderKeys()

  return (
    <Form
      title="Compliance Flags"
      description="Organization-level compliance toggles. Denied catalog models are not available for use."
      helpText="Changes apply immediately. Toggling off a flag re-allows previously denied models."
      toggleSection={{
        sectionTitle: 'Flags',
        items: [
          {
            id: 'require_zdr',
            title: 'Require ZDR (Zero Data Retention)',
            description: 'Only allow models that do not retain training data.',
            checked: Boolean(payload.policy.complianceFlags.require_zdr),
            onCheckedChange: (enabled) =>
              void update({
                action: 'toggle_compliance_flag',
                flag: 'require_zdr',
                enabled,
              }),
            disabled: updating,
          },
          {
            id: 'require_org_provider_key',
            title: 'Require organization provider key',
            description:
              'Only allow models from providers that have an active org API key configured.',
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
          },
        ],
      }}
    />
  )
}
