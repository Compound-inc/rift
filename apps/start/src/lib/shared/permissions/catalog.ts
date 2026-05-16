/**
 * Central permission catalog.
 *
 * This file declares every permission key the app knows about and the
 * resolution metadata each key needs. The catalog is pure data — every
 * other module (frontend hook, backend service, Singularity admin)
 * derives its types and runtime list from here.
 *
 * Key syntax:
 *
 *   workspace.<featureId>                          // plan-gated workspace feature
 *   product.<productKey>                           // product umbrella (entitlement + capability)
 *   product.<productKey>.<addonKey>                // paid addon (entitlement + capability)
 *   product.<productKey>.<addonKey>.<leaf>         // fine-grained leaf permission
 *   product.<productKey>.<leaf>                    // product-level leaf without addon context
 *
 * Leaves are resource-action pairs (`candidates.view`, `jobs.publish`).
 * Adding a leaf is a one-line edit to `PRODUCT_PERMISSION_CATALOG`; the
 * union type updates automatically.
 *
 * See `apps/start/PERMISSIONS.md` for the full model.
 */

import {
  ORG_PRODUCT_ADDON_CATALOG,
  getProductAddonEntitlementIdsForProduct,
} from '@/lib/shared/org-product-addons'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import { WORKSPACE_FEATURE_IDS } from '@/lib/shared/access-control'
import type { WorkspaceFeatureId } from '@/lib/shared/access-control'
import type { OrgProductKey } from '@/lib/shared/org-products'

// ---------------------------------------------------------------------------
// Product leaf permissions
// ---------------------------------------------------------------------------
//
// The leaf catalog is empty today. When a real leaf permission lands
// (e.g. `candidates.view` for HR Recruitment), add it to the relevant
// product + addon entry below. The union type and runtime list pick up
// every entry automatically.

type ProductLeafPermissions = {
  readonly productLeaves: readonly string[]
  readonly addonLeaves: Readonly<Record<string, readonly string[]>>
}

/**
 * Declarative map of leaf permissions per product and per addon. Each
 * entry is a string like `candidates.view` that will be joined onto the
 * product key (`product.<productKey>.<addonKey>.<leaf>`).
 *
 * Empty arrays until real leaves are needed. Design intent: the role
 * selector UI the org admin will eventually use iterates this catalog to
 * build its permission tree, so the shape here directly drives that UI.
 */
export const PRODUCT_PERMISSION_CATALOG = {
  chat: {
    productLeaves: [],
    addonLeaves: {},
  },
  writing: {
    productLeaves: [],
    addonLeaves: {
      core: [],
    },
  },
  hr: {
    productLeaves: [],
    addonLeaves: {
      core: [],

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
      'background-check': ['reports.view', 'reports.request'],
      payroll: [],
    },
  },
} as const satisfies Record<OrgProductKey, ProductLeafPermissions>

// ---------------------------------------------------------------------------
// Permission key derivation
// ---------------------------------------------------------------------------

type ProductLeavesOf<TProduct extends OrgProductKey> =
  (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['productLeaves'][number]

type AddonLeavesOf<
  TProduct extends OrgProductKey,
  TAddon extends OrgProductAddonKey<TProduct>,
> = TAddon extends keyof (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['addonLeaves']
  ? (typeof PRODUCT_PERMISSION_CATALOG)[TProduct]['addonLeaves'][TAddon] extends readonly (infer TLeaf)[]
    ? TLeaf & string
    : never
  : never

/**
 * Template-literal union covering every valid permission key. Derived
 * from the three catalogs so adding new entries auto-extends this union
 */
export type WorkspacePermissionKey = `workspace.${WorkspaceFeatureId}`

export type ProductUmbrellaPermissionKey = `product.${OrgProductKey}`

export type ProductAddonPermissionKey = {
  [TProduct in OrgProductKey]: OrgProductAddonKey<TProduct> extends never
    ? never
    : `product.${TProduct}.${OrgProductAddonKey<TProduct>}`
}[OrgProductKey]

type LeafKeysForProduct<TProduct extends OrgProductKey> =
  | (ProductLeavesOf<TProduct> extends string
      ? `product.${TProduct}.${ProductLeavesOf<TProduct>}`
      : never)
  | (OrgProductAddonKey<TProduct> extends never
      ? never
      : {
          [TAddon in OrgProductAddonKey<TProduct>]: AddonLeavesOf<
            TProduct,
            TAddon
          > extends string
            ? `product.${TProduct}.${TAddon}.${AddonLeavesOf<TProduct, TAddon>}`
            : never
        }[OrgProductAddonKey<TProduct>])

export type ProductLeafPermissionKey = {
  [TProduct in OrgProductKey]: LeafKeysForProduct<TProduct>
}[OrgProductKey]

export type PermissionKey =
  | WorkspacePermissionKey
  | ProductUmbrellaPermissionKey
  | ProductAddonPermissionKey
  | ProductLeafPermissionKey

// ---------------------------------------------------------------------------
// Runtime enumeration
// ---------------------------------------------------------------------------
//
// The runtime list is only used by tests, docs, and the (future) role
// selector UI. The resolver never walks this list directly — it decodes
// the key into its parts and consults the right source of truth.

function buildPermissionKeyList(): readonly PermissionKey[] {
  const workspace = WORKSPACE_FEATURE_IDS.map(
    (feature) => `workspace.${feature}`,
  )

  const products = Object.keys(PRODUCT_PERMISSION_CATALOG) as OrgProductKey[]

  const productUmbrellas = products.map((productKey) => `product.${productKey}`)

  const productAddons = products.flatMap((productKey) =>
    getProductAddonEntitlementIdsForProduct(productKey)
      .filter((id) => id !== productKey)
      .map((id) => `product.${id}` as ProductAddonPermissionKey),
  )

  const productLeaves = products.flatMap((productKey) => {
    const entry = PRODUCT_PERMISSION_CATALOG[productKey]
    const direct = entry.productLeaves.map(
      (leaf) => `product.${productKey}.${leaf}` as ProductLeafPermissionKey,
    )
    const addon = Object.entries(entry.addonLeaves).flatMap(
      ([addonKey, leaves]) =>
        leaves.map(
          (leaf) =>
            `product.${productKey}.${addonKey}.${leaf}` as ProductLeafPermissionKey,
        ),
    )
    return [...direct, ...addon]
  })

  return [
    ...workspace,
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

/**
 * Decodes a `PermissionKey` string into its structured parts. Returns
 * `null` for strings that do not match any known pattern. The resolver
 * uses this to decide which ancestor chain and which stores to consult
 * without hard-coding key parsing in every branch.
 */
export function decodePermissionKey(key: string): DecodedPermissionKey | null {
  if (key.startsWith('workspace.')) {
    const featureId = key.slice('workspace.'.length) as WorkspaceFeatureId
    if ((WORKSPACE_FEATURE_IDS as readonly string[]).includes(featureId)) {
      return { kind: 'workspace', featureId }
    }
    return null
  }

  if (!key.startsWith('product.')) {
    return null
  }

  const rest = key.slice('product.'.length)
  const segments = rest.split('.')
  const productKey = segments[0] as OrgProductKey
  if (!(productKey in PRODUCT_PERMISSION_CATALOG)) {
    return null
  }

  if (segments.length === 1) {
    return { kind: 'product-umbrella', productKey }
  }

  const second = segments[1]
  const addonsOfProduct = ORG_PRODUCT_ADDON_CATALOG[productKey].addons
  const productLeaves = PRODUCT_PERMISSION_CATALOG[productKey].productLeaves

  // `product.<p>.<addon>`
  if (segments.length === 2) {
    if (second in addonsOfProduct) {
      return { kind: 'product-addon', productKey, addonKey: second }
    }
    if ((productLeaves as readonly string[]).includes(second)) {
      return { kind: 'product-leaf', productKey, addonKey: null, leaf: second }
    }
    return null
  }

  // `product.<p>.<addon>.<leaf>` (addon-scoped leaf)
  if (second in addonsOfProduct) {
    const leaf = segments.slice(2).join('.')
    const allowedLeaves =
      PRODUCT_PERMISSION_CATALOG[productKey].addonLeaves[
        second as keyof (typeof PRODUCT_PERMISSION_CATALOG)[typeof productKey]['addonLeaves']
      ] ?? []
    if ((allowedLeaves as readonly string[]).includes(leaf)) {
      return {
        kind: 'product-leaf',
        productKey,
        addonKey: second,
        leaf,
      }
    }
    return null
  }

  // `product.<p>.<leaf-with-dots>` — product-level multi-segment leaf
  const leaf = segments.slice(1).join('.')
  if ((productLeaves as readonly string[]).includes(leaf)) {
    return { kind: 'product-leaf', productKey, addonKey: null, leaf }
  }

  return null
}

/**
 * Returns the ancestor chain of a decoded key, ordered from most general
 * to most specific. Callers walk this chain to short-circuit on the
 * first ancestor that fails (`ancestor-denied` reason).
 */
export function getAncestorKeys(
  decoded: DecodedPermissionKey,
): readonly PermissionKey[] {
  if (decoded.kind === 'workspace' || decoded.kind === 'product-umbrella') {
    return []
  }

  if (decoded.kind === 'product-addon') {
    return [`product.${decoded.productKey}` as PermissionKey]
  }

  const ancestors: PermissionKey[] = [
    `product.${decoded.productKey}` as PermissionKey,
  ]
  if (decoded.addonKey) {
    ancestors.push(
      `product.${decoded.productKey}.${decoded.addonKey}` as PermissionKey,
    )
  }
  return ancestors
}

// Runtime guard for untrusted strings (URL params, external APIs, etc.).
export function isPermissionKey(value: string): value is PermissionKey {
  return decodePermissionKey(value) !== null
}
