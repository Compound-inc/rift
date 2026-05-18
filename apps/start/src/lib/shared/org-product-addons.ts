import { isOrgProductKey } from './org-products'
import type { OrgProductKey } from './org-products'

export type ProductAddonDefinition = {
  readonly label: string
  readonly description: string
  readonly orgConfigurableSettingKeys: readonly string[]
  readonly children?: Readonly<Record<string, ProductAddonDefinition>>
}

type ProductAddonTree = {
  readonly addons: Readonly<Record<string, ProductAddonDefinition>>
}

export const ORG_PRODUCT_ADDON_CATALOG = {
  chat: {
    addons: {},
  },
  writing: {
    addons: {},
  },
  hr: {
    addons: {
      recruitment: {
        label: 'Recruitment',
        description:
          'Candidate pipeline, job postings, bulk CV intake, AI affinity scoring, and assessment workflows.',
        orgConfigurableSettingKeys: [
          'recruitment.aiRerankEnabled',
          'recruitment.aiRerankTopK',
          'recruitment.autoArchiveAfterDays',
          'recruitment.testTimeoutDays',
        ] as const,
        children: {
          'background-check': {
            label: 'Background Check',
            description:
              'Credit and legal verification for shortlisted recruitment candidates. Runs as the final stage of the recruitment pipeline.',
            orgConfigurableSettingKeys: [
              'recruitment.background-check.creditScoreEnabled',
              'recruitment.background-check.legalBuroEnabled',
              'recruitment.background-check.providerKey',
            ] as const,
          },
        },
      },
      payroll: {
        label: 'Payroll',
        description:
          'Compensation cycles, payroll runs, and integrations with external payroll providers.',
        orgConfigurableSettingKeys: [] as const,
      },
    },
  },
} as const satisfies Record<OrgProductKey, ProductAddonTree>

type AddonPathFromDefinitions<
  TDefinitions extends Readonly<Record<string, ProductAddonDefinition>>,
> = {
  [K in keyof TDefinitions & string]: TDefinitions[K] extends {
    readonly children: infer TChildren extends Readonly<
      Record<string, ProductAddonDefinition>
    >
  }
    ? K | `${K}.${AddonPathFromDefinitions<TChildren>}`
    : K
}[keyof TDefinitions & string]

export type OrgProductAddonPath<TProduct extends OrgProductKey> =
  AddonPathFromDefinitions<(typeof ORG_PRODUCT_ADDON_CATALOG)[TProduct]['addons']>

export type OrgProductAddonKey<TProduct extends OrgProductKey> =
  OrgProductAddonPath<TProduct>

function collectAddonPaths(
  addons: Readonly<Record<string, ProductAddonDefinition>>,
  parentPath = '',
): string[] {
  return Object.entries(addons).flatMap(([addonKey, definition]) => {
    const addonPath = parentPath ? `${parentPath}.${addonKey}` : addonKey
    return [
      addonPath,
      ...collectAddonPaths(definition.children ?? {}, addonPath),
    ]
  })
}

function findAddonDefinition(
  addons: Readonly<Record<string, ProductAddonDefinition>>,
  addonPath: string,
): ProductAddonDefinition | null {
  const [head, ...tail] = addonPath.split('.')
  const definition = addons[head]
  if (!definition) {
    return null
  }
  if (tail.length === 0) {
    return definition
  }
  return findAddonDefinition(definition.children ?? {}, tail.join('.'))
}

/**
 * Flattens a product's addon tree into stable dotted addon paths. Runtime
 * entitlement and capability maps use these paths for O(depth) ancestor checks
 * while the catalog remains a tree for domain clarity and UI hierarchy.
 */
export function getProductAddonPathsForProduct<
  TProduct extends OrgProductKey,
>(productKey: TProduct): readonly OrgProductAddonPath<TProduct>[] {
  return collectAddonPaths(
    ORG_PRODUCT_ADDON_CATALOG[productKey].addons,
  ) as OrgProductAddonPath<TProduct>[]
}

export function getProductAddonDefinition<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonPath: OrgProductAddonPath<TProduct>,
): ProductAddonDefinition {
  const definition = findAddonDefinition(
    ORG_PRODUCT_ADDON_CATALOG[productKey].addons,
    addonPath,
  )
  if (!definition) {
    throw new Error(`Unknown product addon: ${productKey}.${addonPath}`)
  }
  return definition
}

export function isOrgProductAddonKey<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonPath: string,
): addonPath is OrgProductAddonPath<TProduct> {
  return findAddonDefinition(
    ORG_PRODUCT_ADDON_CATALOG[productKey].addons,
    addonPath,
  ) !== null
}

export function isKnownProductAddon(input: {
  readonly productKey: string
  readonly addonKey: string
}): boolean {
  if (!isOrgProductKey(input.productKey)) {
    return false
  }

  return isOrgProductAddonKey(input.productKey, input.addonKey)
}

export function toProductEntitlementId<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonPath?: OrgProductAddonPath<TProduct>,
): string {
  return addonPath ? `${productKey}.${addonPath}` : productKey
}

export function getProductEntitlementIdsForProduct<
  TProduct extends OrgProductKey,
>(productKey: TProduct): readonly string[] {
  return [
    productKey,
    ...getProductAddonPathsForProduct(productKey).map(
      (addonPath) => `${productKey}.${addonPath}`,
    ),
  ]
}
