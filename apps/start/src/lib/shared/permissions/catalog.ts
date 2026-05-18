/**
 * Central permission catalog.
 *
 * Product access keys use dotted entitlement paths:
 *   product.<productKey>
 *   product.<productKey>.<addonPath>
 *
 * Product leaf permissions use a colon to separate the entitlement path from
 * the role leaf, avoiding ambiguity with nested addon paths:
 *   product.<productKey>:<leaf>
 *   product.<productKey>.<addonPath>:<leaf>
 */

import {
  ORG_PRODUCT_ADDON_CATALOG,
  getProductAddonPathsForProduct,
  getProductEntitlementIdsForProduct,
  isOrgProductAddonKey,
} from '@/lib/shared/org-product-addons'
import type { OrgProductAddonPath } from '@/lib/shared/org-product-addons'
import { WORKSPACE_FEATURE_IDS } from '@/lib/shared/access-control'
import type { WorkspaceFeatureId } from '@/lib/shared/access-control'
import type { OrgProductKey } from '@/lib/shared/org-products'

// ---------------------------------------------------------------------------
// Product leaf permissions
// ---------------------------------------------------------------------------

type ProductLeafPermissions = {
  readonly productLeaves: readonly string[]
  readonly addonLeaves: Readonly<Record<string, readonly string[]>>
}

/**
 * Declarative map of role leaves per product and addon path. Addon leaves are
 * keyed by full addon path so nested addons can own distinct role permissions.
 */
export const PRODUCT_PERMISSION_CATALOG = {
  chat: {
    productLeaves: [],
    addonLeaves: {},
  },
  writing: {
    productLeaves: [],
    addonLeaves: {},
  },
  hr: {
    productLeaves: [],
    addonLeaves: {
      recruitment: [
        'positions.view',
        'positions.create',
        'positions.update',
        'positions.archive',
        'candidates.view',
        'candidates.archive',
        'applications.view',
        'applications.advance',
        'applications.reject',
        'tests.manage',
        'cv.upload',
      ],
      'recruitment.background-check': ['reports.view', 'reports.request'],
      payroll: [],
    },
  },
} as const satisfies Record<OrgProductKey, ProductLeafPermissions>

// ---------------------------------------------------------------------------
// Workspace administration leaf permissions
// ---------------------------------------------------------------------------

export const WORKSPACE_ADMIN_PERMISSION_LEAVES = [
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'members.view',
  'members.invite',
  'members.assign-role',
  'members.remove',
] as const

// ---------------------------------------------------------------------------
// Permission key derivation
// ---------------------------------------------------------------------------

type ProductLeavesOf<TProduct extends OrgProductKey> =
  (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['productLeaves'][number]

type AddonLeavesOf<
  TProduct extends OrgProductKey,
  TAddon extends OrgProductAddonPath<TProduct>,
> = TAddon extends keyof (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['addonLeaves']
  ? (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['addonLeaves'][TAddon] extends readonly (infer TLeaf)[]
    ? TLeaf & string
    : never
  : never

export type WorkspacePermissionKey = `workspace.${WorkspaceFeatureId}`

export type WorkspaceAdminPermissionKey =
  `workspace:${(typeof WORKSPACE_ADMIN_PERMISSION_LEAVES)[number]}`

export type ProductUmbrellaPermissionKey = `product.${OrgProductKey}`

export type ProductAddonPermissionKey = {
  [TProduct in OrgProductKey]: OrgProductAddonPath<TProduct> extends never
    ? never
    : `product.${TProduct}.${OrgProductAddonPath<TProduct>}`
}[OrgProductKey]

type LeafKeysForProduct<TProduct extends OrgProductKey> =
  | (ProductLeavesOf<TProduct> extends string
      ? `product.${TProduct}:${ProductLeavesOf<TProduct>}`
      : never)
  | (OrgProductAddonPath<TProduct> extends never
      ? never
      : {
          [TAddon in OrgProductAddonPath<TProduct>]: AddonLeavesOf<
            TProduct,
            TAddon
          > extends string
            ? `product.${TProduct}.${TAddon}:${AddonLeavesOf<TProduct, TAddon>}`
            : never
        }[OrgProductAddonPath<TProduct>])

export type ProductLeafPermissionKey = {
  [TProduct in OrgProductKey]: LeafKeysForProduct<TProduct>
}[OrgProductKey]

export type PermissionKey =
  | WorkspacePermissionKey
  | WorkspaceAdminPermissionKey
  | ProductUmbrellaPermissionKey
  | ProductAddonPermissionKey
  | ProductLeafPermissionKey

// ---------------------------------------------------------------------------
// Runtime enumeration
// ---------------------------------------------------------------------------

function buildPermissionKeyList(): readonly PermissionKey[] {
  const workspace = WORKSPACE_FEATURE_IDS.map(
    (feature) => `workspace.${feature}`,
  )

  const workspaceAdmin = WORKSPACE_ADMIN_PERMISSION_LEAVES.map(
    (leaf) => `workspace:${leaf}`,
  )

  const products = Object.keys(PRODUCT_PERMISSION_CATALOG) as OrgProductKey[]

  const productUmbrellas = products.map((productKey) => `product.${productKey}`)

  const productAddons = products.flatMap((productKey) =>
    getProductEntitlementIdsForProduct(productKey)
      .filter((id) => id !== productKey)
      .map((id) => `product.${id}` as ProductAddonPermissionKey),
  )

  const productLeaves = products.flatMap((productKey) => {
    const entry = PRODUCT_PERMISSION_CATALOG[productKey]
    const direct = entry.productLeaves.map(
      (leaf) => `product.${productKey}:${leaf}` as ProductLeafPermissionKey,
    )
    const addon = Object.entries(entry.addonLeaves).flatMap(
      ([addonPath, leaves]) =>
        leaves.map(
          (leaf) =>
            `product.${productKey}.${addonPath}:${leaf}` as ProductLeafPermissionKey,
        ),
    )
    return [...direct, ...addon]
  })

  return [
    ...workspace,
    ...workspaceAdmin,
    ...productUmbrellas,
    ...productAddons,
    ...productLeaves,
  ] as PermissionKey[]
}

export const PERMISSION_KEYS: readonly PermissionKey[] =
  buildPermissionKeyList()

// ---------------------------------------------------------------------------
// Runtime decoders
// ---------------------------------------------------------------------------

export type DecodedPermissionKey =
  | { readonly kind: 'workspace'; readonly featureId: WorkspaceFeatureId }
  | { readonly kind: 'workspace-admin-leaf'; readonly leaf: string }
  | {
      readonly kind: 'product-umbrella'
      readonly productKey: OrgProductKey
    }
  | {
      readonly kind: 'product-addon'
      readonly productKey: OrgProductKey
      readonly addonKey: string
    }
  | {
      readonly kind: 'product-leaf'
      readonly productKey: OrgProductKey
      readonly addonKey: string | null
      readonly leaf: string
    }

function isKnownProductKey(value: string): value is OrgProductKey {
  return value in ORG_PRODUCT_ADDON_CATALOG
}

type DecodedProductAccessKey = Extract<
  DecodedPermissionKey,
  { readonly kind: 'product-umbrella' | 'product-addon' }
>

function decodeProductAccessPath(path: string): DecodedProductAccessKey | null {
  const segments = path.split('.')
  const productKey = segments[0]
  if (!isKnownProductKey(productKey)) {
    return null
  }

  if (segments.length === 1) {
    return { kind: 'product-umbrella', productKey }
  }

  const addonPath = segments.slice(1).join('.')
  if (isOrgProductAddonKey(productKey, addonPath)) {
    return { kind: 'product-addon', productKey, addonKey: addonPath }
  }

  return null
}

/**
 * Decodes a permission key into structured parts. Product leaves must use the
 * colon form (`product.hr.recruitment:applications.view`) so addon path parsing
 * never conflicts with dotted leaf names.
 */
export function decodePermissionKey(key: string): DecodedPermissionKey | null {
  if (key.startsWith('workspace.')) {
    const featureId = key.slice('workspace.'.length) as WorkspaceFeatureId
    if ((WORKSPACE_FEATURE_IDS as readonly string[]).includes(featureId)) {
      return { kind: 'workspace', featureId }
    }
    return null
  }

  if (key.startsWith('workspace:')) {
    const leaf = key.slice('workspace:'.length)
    if ((WORKSPACE_ADMIN_PERMISSION_LEAVES as readonly string[]).includes(leaf)) {
      return { kind: 'workspace-admin-leaf', leaf }
    }
    return null
  }

  if (!key.startsWith('product.')) {
    return null
  }

  const rest = key.slice('product.'.length)
  const [accessPath, leaf, ...extra] = rest.split(':')
  if (extra.length > 0) {
    return null
  }

  const decodedAccess = decodeProductAccessPath(accessPath)
  if (!decodedAccess) {
    return null
  }

  if (leaf === undefined) {
    return decodedAccess
  }

  if (!leaf) {
    return null
  }

  const catalogEntry = PRODUCT_PERMISSION_CATALOG[decodedAccess.productKey]
  const productLeaves = catalogEntry.productLeaves

  if (decodedAccess.kind === 'product-umbrella') {
    if ((productLeaves as readonly string[]).includes(leaf)) {
      return {
        kind: 'product-leaf',
        productKey: decodedAccess.productKey,
        addonKey: null,
        leaf,
      }
    }
    return null
  }

  const addonLeaves =
    (catalogEntry.addonLeaves as Readonly<Record<string, readonly string[]>>)[
      decodedAccess.addonKey
    ] ?? []

  if (addonLeaves.includes(leaf)) {
    return {
      kind: 'product-leaf',
      productKey: decodedAccess.productKey,
      addonKey: decodedAccess.addonKey,
      leaf,
    }
  }

  return null
}

/**
 * Returns the ancestor chain ordered from most general to most specific.
 * Nested addon paths contribute every intermediate entitlement path.
 */
export function getAncestorKeys(
  decoded: DecodedPermissionKey,
): readonly PermissionKey[] {
  if (
    decoded.kind === 'workspace' ||
    decoded.kind === 'workspace-admin-leaf' ||
    decoded.kind === 'product-umbrella'
  ) {
    return []
  }

  const ancestors: PermissionKey[] = [
    `product.${decoded.productKey}` as PermissionKey,
  ]

  const addonPath = decoded.addonKey

  if (!addonPath) {
    return ancestors
  }

  const segments = addonPath.split('.')
  const paths = segments.map((_, index) =>
    segments.slice(0, index + 1).join('.'),
  )

  const addonAncestors =
    decoded.kind === 'product-addon' ? paths.slice(0, -1) : paths

  for (const path of addonAncestors) {
    ancestors.push(`product.${decoded.productKey}.${path}` as PermissionKey)
  }

  return ancestors
}

export function getProductAddonPermissionKeys(
  productKey: OrgProductKey,
): readonly ProductAddonPermissionKey[] {
  return getProductAddonPathsForProduct(productKey).map(
    (addonPath) =>
      `product.${productKey}.${addonPath}` as ProductAddonPermissionKey,
  )
}

export function isLeafPermissionKey(
  key: PermissionKey,
): key is ProductLeafPermissionKey | WorkspaceAdminPermissionKey {
  const decoded = decodePermissionKey(key)
  return (
    decoded?.kind === 'product-leaf' ||
    decoded?.kind === 'workspace-admin-leaf'
  )
}

export function getLeafPermissionKeys(): readonly (
  | ProductLeafPermissionKey
  | WorkspaceAdminPermissionKey
)[] {
  return PERMISSION_KEYS.filter(isLeafPermissionKey)
}

export function getChildLeafPermissionKeys(
  parentKey: ProductUmbrellaPermissionKey | ProductAddonPermissionKey,
): readonly ProductLeafPermissionKey[] {
  const parent = decodePermissionKey(parentKey)
  if (
    !parent ||
    parent.kind === 'workspace' ||
    parent.kind === 'workspace-admin-leaf'
  ) {
    return []
  }

  return PERMISSION_KEYS.filter((key): key is ProductLeafPermissionKey => {
    const decoded = decodePermissionKey(key)
    if (decoded?.kind !== 'product-leaf') return false
    if (decoded.productKey !== parent.productKey) return false
    if (parent.kind === 'product-umbrella') return true
    return (
      decoded.addonKey === parent.addonKey ||
      decoded.addonKey?.startsWith(`${parent.addonKey}.`) === true
    )
  })
}

// Runtime guard for untrusted strings (URL params, external APIs, etc.).
export function isPermissionKey(value: string): value is PermissionKey {
  return decodePermissionKey(value) !== null
}
