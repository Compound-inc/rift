export const ORG_PRODUCT_CATALOG = {
  chat: {
    description:
      'Conversational assistants, model selection, tools, and chat-specific runtime policy.',
  },
  writing: {
    description:
      'Long-form document collaboration surfaces such as the Witting workspace.',
  },
  hr: {
    description:
      'Human resources surfaces: employee directory, recruitment, payroll, and other HR workflows offered as paid addons.',
  },
} as const

export type OrgProductKey = keyof typeof ORG_PRODUCT_CATALOG

/**
 * Runtime guard shared by org product config and org product policy paths.
 * Keeping this in one module prevents product-key drift across subsystems.
 */
export function isOrgProductKey(value: string): value is OrgProductKey {
  return value in ORG_PRODUCT_CATALOG
}
