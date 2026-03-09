'use client'

import type { WorkspaceFeatureAccessState } from '@/lib/billing/plan-catalog'
import { m } from '@/paraglide/messages.js'

type FeatureAccessInput = {
  enabled: boolean
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
  defaultHelpText?: string
}

/**
 * Small helper for settings forms that need either their normal help copy or
 * the locked-feature upgrade/contact copy. Uses translated strings for all
 * user-facing messages.
 */
export function getFeatureAccessFormProps(input: FeatureAccessInput) {
  if (input.enabled || !input.featureAccess) {
    return {
      helpText: input.defaultHelpText,
      helpLearnMoreHref: undefined,
      helpLearnMoreLabel: undefined,
      featureDisabled: false,
    }
  }

  const planName = input.featureAccess.minimumPlanName
  const helpLabel =
    input.featureAccess.action.kind === 'contact'
      ? m.feature_access_contact_label()
      : m.feature_access_upgrade_label({ planName })

  return {
    helpText: m.feature_access_requires_plan({ planName }),
    helpLearnMoreHref: input.featureAccess.action.href,
    helpLearnMoreLabel: helpLabel,
    featureDisabled: true,
  }
}
