# Products and Paid Addons

This document is the canonical guide for introducing a new top-level product
(such as `chat`, `writing`, `hr`) and gating purchasable addons on top of
existing products. Read this before adding any new product or addon surface.

Companion document: `apps/start/BACKEND_EFFECT_PLAYBOOK.md` (backend patterns).

## 1. Core Concepts

Each product is built from **four** layers. Keep them separated.

1. **Product catalog** — the declarative list of products. This is how the
   app _knows_ a product exists. Lives in
   `src/lib/shared/org-products.ts::ORG_PRODUCT_CATALOG`.

2. **Entitlements (platform-granted)** — booleans set by the platform or
   by the plan default, controlling whether an organization can access a
   product and its addons. Resolved into
   `org_entitlement_snapshot.product_addon_entitlements` by the billing
   pipeline. Never writable by org admins. See §3 for the two-layer
   resolver (plan defaults + explicit grants).

3. **Capabilities (org-admin toggle)** — an opt-out switch the org admin
   can flip per product or per addon, stored as
   `OrgProductPolicy.capabilities['<addonPath>.enabled']` (or just
   `'enabled'` for the umbrella product). Default is `true`. Composes as
   **AND** with the entitlement: an addon is only _available_ when the
   org is entitled AND the capability is on.

4. **Org policy (org-admin configurable)** — additional knobs the org
   admin can turn for a product after it has been enabled for them
   (settings, disabled-model lists, compliance flags). Lives in the
   existing `org_product_policy` table via `OrgProductPolicy` and is
   written by the `orgProductPolicy.setPolicy` mutator.

**Critical rule:** entitlements (layer 2) and capabilities/policy (layers
3–4) are distinct. Platform-admin-controlled flags never live in
`OrgProductPolicy`. See §11.

## 2. Naming Conventions

Entitlement IDs use a flat dotted namespace derived from the product's addon tree.

- Umbrella entitlement for a product: the bare product key. Example: `hr`.
- Addon entitlement: `<productKey>.<addonPath>`. Examples:
  `hr.recruitment`, `hr.recruitment.background-check`, `hr.payroll`.
- Capability keys (stored in `OrgProductPolicy.capabilities`) use
  `enabled` for the umbrella and `<addonPath>.enabled` for addons.
  Examples: `recruitment.enabled`, `recruitment.background-check.enabled`.
- Org-configurable setting keys (stored in `OrgProductPolicy.settings`)
  use `<addonPath>.<settingKey>`. Example:
  `recruitment.autoArchiveAfterDays`.

The product entitlement itself grants access to core product features; do not
model core features as a `core` addon.

This convention scales uniformly to future addons on `chat` and `writing`
(e.g. `chat.voiceMode`, `writing.aiEditor`) without any schema changes.

## 3. Entitlement Resolution

Product entitlements are resolved by layering two maps inside
`resolveProductEntitlements`:

1. **Plan defaults** (`PLAN_DEFAULT_PRODUCT_ENTITLEMENTS`) — what the org's plan
   includes by default. For example, a future "pro" plan could include
   the HR umbrella by setting `pro: { hr: true, 'hr.recruitment': true }`.

2. **Explicit grants** (`org_subscription.metadata.addonGrants`) — what
   the Singularity admin or billing pipeline has granted or explicitly
   revoked for this specific org. A boolean here always wins over the
   plan default.

Because explicit grants can flip either direction, the same machinery
expresses:

- **Plan-included products** (plan default `true`). Default behavior when
  the org is on that plan.
- **Addon purchases on top of a plan** (explicit `true` for an id not in
  the plan default). Singularity admin grants this when the org buys a
  paid addon.
- **Revocations** (explicit `false` overriding a plan default `true`).
  Used when a customer churns an addon that is otherwise included in
  their plan.
- **Pre-release / manual grants** (explicit `true` for an id that is
  never in any plan default). For rolling out new products like the
  example image-gen addon to specific orgs only.

Unknown ids are silently ignored so stale metadata and a drifted catalog
cannot widen the entitlement surface.

## 4. File Map

```
apps/start/src/lib/shared/org-products.ts                 # product catalog (layer 1)
apps/start/src/lib/shared/org-product-addons.ts           # addon catalog (layer 2/3/4 metadata)
apps/start/src/lib/shared/access-control/index.ts         # PLAN_DEFAULT_PRODUCT_ENTITLEMENTS,
                                                          # ProductEntitlementId union,
                                                          # resolveProductEntitlements (layer 2)
apps/start/src/lib/shared/org-product-capabilities.ts     # productCapabilityKey + readOrgProductCapability (layer 3)
apps/start/src/lib/shared/org-product-policy.ts           # org policy shape (layer 4)

apps/start/src/lib/backend/billing/services/workspace-billing/
  persistence.ts          # writes product_addon_entitlements into the snapshot
  shared.ts               # coerces addonGrants from subscription metadata

apps/start/src/integrations/zero/schema.ts                # orgEntitlementSnapshot table

apps/start/src/lib/frontend/organizations/
  use-product-entitlement.ts   # raw entitlement reads (platform layer only)
  use-product-availability.ts  # composite: entitlement AND capability

apps/start/src/routes/(app)/_layout/<product>/            # product routes + sidebar nav file
apps/start/src/routes/(app)/_layout/organization/settings/<product>/
  route.tsx + index.tsx   # product-specific org settings
apps/start/src/components/organization/settings/<product>/
  <product>-settings-page.tsx  # renders capability toggles and addon settings
```

Platform-admin (Singularity) controls the addon entitlements from:

```
apps/start/src/ee/singularity/backend/services/singularity-admin.service.ts
  # service that exposes setProductEntitlements (Effect.fn)
apps/start/src/ee/singularity/backend/services/singularity-admin/operations/
  set-product-addon-entitlements.ts   # operation module (playbook §2 split)
apps/start/src/ee/singularity/frontend/singularity.functions.ts
  # thin createServerFn wrapper
apps/start/src/ee/singularity/components/
  singularity-org-detail-page.tsx     # admin UI card
```

## 5. When To Use Which Layer

| Need                                                          | Layer          | Where it lives                           |
| ------------------------------------------------------------- | -------------- | ---------------------------------------- |
| "Does this product exist at all in the app?"                  | 1. Catalog     | `ORG_PRODUCT_CATALOG`                    |
| "Can this org access the product or a paid addon?"            | 2. Entitlement | `product_addon_entitlements` (snapshot)  |
| "Does the org admin want this addon on right now?"            | 3. Capability  | `OrgProductPolicy.capabilities`          |
| "What configuration has the org admin chosen for this addon?" | 4. Policy      | `OrgProductPolicy.settings` / compliance |

Never blur the boundary. Any flag that the org admin should be able to
flip is a capability or policy. Any flag that only the platform admin can
grant is an entitlement. Any flag that follows plan tier lives in
`PLAN_DEFAULT_PRODUCT_ENTITLEMENTS` (never in workspace feature plan maps).

## 6. Adding a New Product — Checklist

Use this when introducing a brand-new product alongside `chat`, `writing`,
`hr`.

1. **Catalog entry.** Add the product key and a short description to
   `ORG_PRODUCT_CATALOG` in `src/lib/shared/org-products.ts`.
2. **Addon catalog entry.** Add an entry to `ORG_PRODUCT_ADDON_CATALOG` in
   `src/lib/shared/org-product-addons.ts`. Products with only core access use
   an empty addon tree. Each addon declares `label`, `description`, optional
   nested `children`, and an array `orgConfigurableSettingKeys` that names the
   org-editable setting keys (use an empty array until real settings exist).
3. **Entitlement ids (automatic).** The `ProductEntitlementId` union
   and the `PRODUCT_ENTITLEMENT_IDS` runtime list in
   `src/lib/shared/access-control/index.ts` are derived automatically
   from the catalog. Verify with the tests in
   `access-control/access-control.test.ts` and
   `org-product-addons.test.ts`.
4. **Plan defaults (optional).** If a plan includes the product by
   default, add the entitlement ids to that plan's entry in
   `PLAN_DEFAULT_PRODUCT_ENTITLEMENTS`. Leave this alone if the product is
   strictly paid-addon / manually granted.
5. **Sidebar nav file.** Create
   `src/routes/(app)/_layout/<product>/-<product>-nav.tsx` exporting
   `<PRODUCT>_HREF`, `<PRODUCT>_AREA_KEY`, `is<Product>Path`, and a
   `<product>NavArea` function. Use the `ContentComponent` slot when
   sub-nav items depend on per-addon availability (see
   `hr/-hr-nav.tsx`). Gate sub-nav items with
   `useProductAvailability('<product>', '<addonPath>')`, not the raw
   entitlement hook.
6. **Register the area.** Add the area key to `NAV_AREAS` in
   `src/components/layout/sidebar/app-sidebar-nav.config.tsx` and the
   path guard in `getCurrentArea`.
7. **Gate the sidebar icon.** In
   `src/components/layout/app-sidebar.tsx`, filter the area rail by
   `useProductAvailability('<product>')` so the icon only appears when
   the org is entitled AND the capability is on.
8. **Routes.** Create `src/routes/(app)/_layout/<product>/route.tsx`
   (umbrella guard using `useProductAvailability('<product>')`),
   `src/routes/(app)/_layout/<product>/index.tsx` (landing page), and
   one folder per addon with its own guard (on the specific sub-addon
   via `useProductAvailability('<product>', '<addonPath>')`) +
   placeholder page. Regenerate `routeTree.gen.ts` via
   `bun --bun vite build` (or the dev server) so the file-route factory
   accepts the new paths.
9. **Org settings.** Extend
   `src/routes/(app)/_layout/organization/settings/-organization-settings-nav.ts`
   to accept a flag for your product and conditionally emit the nav
   section. Gate the flag on the umbrella availability through a small
   content component in
   `src/components/layout/sidebar/app-sidebar-nav.config.tsx` (see
   `OrgSettingsNavContent`). Create
   `src/routes/(app)/_layout/organization/settings/<product>/route.tsx`
   and `index.tsx`. CRITICAL: this route must guard on the raw
   **entitlement** (`useProductEntitlement`), NOT availability —
   otherwise the admin can lock themselves out by turning the
   capability off.
10. **Settings page.** Create
    `src/components/organization/settings/<product>/<product>-settings-page.tsx`.
    At minimum it should render one capability toggle per entitled
    addon (see `hr-settings-page.tsx` for the current scaffold).
    Additional configuration lands via the same pattern using
    `OrgProductPolicy.settings['<addonPath>.<settingKey>']`.
11. **Tests.** Cover catalog shape, entitlement resolver defaults, plan
    defaults (if any), capability default-true, route redirect when
    entitlement OR capability is off, settings page renders only
    entitled sections and preserves unrelated policy keys on submit,
    sidebar gating.

## 7. Adding a Paid Addon to an Existing Product — Checklist

Use this when adding `chat.voiceMode`, `writing.aiEditor`, another HR
addon, or similar.

1. **Addon catalog.** Append the addon key to the product's entry in
   `ORG_PRODUCT_ADDON_CATALOG` with `label`, `description`, and any
   `orgConfigurableSettingKeys` (empty array until real settings
   exist).
2. **Entitlement id (automatic).** `PRODUCT_ENTITLEMENT_IDS` and
   the `ProductEntitlementId` union pick up the new key
   automatically.
3. **Plan defaults (optional).** If the addon is included in any plan by
   default, add the entitlement id to that plan's entry in
   `PLAN_DEFAULT_PRODUCT_ENTITLEMENTS`.
4. **Sidebar sub-item.** If the addon deserves its own sidebar entry,
   add it to the product's nav file, gated on
   `useProductAvailability('<productKey>', '<addonPath>')`.
5. **Route (optional).** If the addon has its own route, create
   `src/routes/(app)/_layout/<product>/<addon>/route.tsx` with a
   `useProductAvailability` guard + `index.tsx` as the page.
6. **Settings UI.** The product's settings page will pick up the new
   addon automatically because it iterates the addon catalog and
   renders a capability toggle per entitled addon. Add more per-addon
   configuration as needed.
7. **Tests.** Add test coverage for the new entitlement id default-false
   (or plan-default if included), sidebar gate, route guard, and
   capability toggle rendering.

Schema changes are not required. The entitlement snapshot stores a flat
`Record<string, boolean>` JSON; new keys simply become new entries.

## 8. Activating Entitlements

Product entitlements are set by the platform admin (or inherited
from the plan default). Org admins never write them. Activation goes
through the Singularity admin UI:

The Singularity org-detail page exposes an **Addon Entitlements** card
listing every entitlement id with a toggle. Saving calls the backend
`SingularityAdminService.setProductEntitlements` effect, which:

1. Reads the active `org_subscription` row for the org.
2. Merges the new grants into
   `org_subscription.metadata.addonGrants`. Existing explicit grants are
   preserved; unknown keys are dropped.
3. Writes the metadata back and triggers an entitlement snapshot
   recompute in the same transaction.

Once the snapshot row is updated, Zero replicates it to the org's
clients and the sidebar, route guards, and settings page react
automatically.

## 9. Reading Availability from the UI

User-facing gates go through the unified `usePermissions()` hook. See
`PERMISSIONS.md` for the full API and resolution order. Quick reference:

```ts
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

const { can, canRaw, check } = usePermissions()

// Composite (entitlement + capability, walks ancestors). Use for every
// sidebar / route / product UI gate.
can('product.hr')
can('product.hr.recruitment')

// Raw entitlement (skips capability layer). Use ONLY for settings pages
// that configure the capability — otherwise the org admin locks
// themselves out.
canRaw('product.hr')

// Discriminated reason for richer UX copy.
const { allowed, reason } = check('product.hr.recruitment')
// reason: 'allowed' | 'not-entitled' | 'disabled-by-admin'
//       | 'ancestor-denied' | 'plan-insufficient' | 'role-denied'
//       | 'loading' | 'invalid-key'
```

For non-hook contexts (server effects, tests, selectors) use the pure
helpers from `@/lib/shared/permissions` and `@/lib/shared/access-control`:

```ts
import {
  resolvePermission,
  buildProductCapabilitiesMap,
  EMPTY_PERMISSION_BUNDLE,
} from '@/lib/shared/permissions'
```

Backend callers authorize through `PermissionService.authorize(...)` —
see §5 of `PERMISSIONS.md`.

## 10. Future extensions

Both the permission resolver and the product catalog are designed so
upcoming access features slot in without touching call sites. See
`PERMISSIONS.md` §9 for the full extension plan (role-based gating,
group-based gating, time-based gating). None of those require schema
changes or new entitlement writes; they simply add factors inside the
permission resolver.

## 11. Anti-Patterns (Do Not Add)

1. **Storing entitlement flags in `OrgProductPolicy`.** Org admins can
   mutate `OrgProductPolicy` through the `orgProductPolicy.setPolicy`
   mutator. Any boolean that represents "has the org purchased this
   addon" must live in `product_addon_entitlements` / `addonGrants`,
   never in policy.
2. **Mapping product addons into `ORG_FEATURE_MINIMUM_PLANS`.** That map
   is for plan-gated workspace features (`byok`, `singleSignOn`, etc.)
   and auto-unlocks everything above a plan rank. Product addons either
   live in `PLAN_DEFAULT_PRODUCT_ENTITLEMENTS` (plan inclusion) or are
   explicit grants only.
3. **New snapshot columns per product.** The
   `product_addon_entitlements` JSONB column is a flat map keyed by
   entitlement id and scales to any product. Do not add per-product
   columns.
4. **Client-side entitlement writes.** The frontend must only read
   entitlements. No org mutator should write to
   `metadata.addonGrants`.
5. **Gating the product settings page on `can(...)`.** Org admins need a
   way back in after turning a capability off. Settings routes guard on
   `canRaw(...)` (the raw entitlement) only.
6. **Bypassing `usePermissions()` in user-facing surfaces.** Use the
   canonical hook so the org-admin kill switch (and future role-based
   gates) take effect everywhere.
7. **Free-text entitlement ids.** Always register the id in the catalog
   so the union type and runtime list pick it up. The resolver filters
   unknown strings silently.

## 12. Testing Checklist for New Products / Addons

At minimum, the following must be covered:

1. Catalog entries exist and shape matches
   (`org-product-addons.test.ts`).
2. `resolveProductEntitlements` defaults the new id to `false`,
   honors plan defaults, and allows explicit grants to override either
   direction.
3. `readOrgProductCapability` defaults the capability to `true` and
   respects `false` overrides.
4. `resolvePermission` composes ancestors + entitlement + capability
   correctly (see `permissions.test.ts`).
5. Sidebar hides the product / sub-addon when the umbrella is
   unavailable OR the specific addon is unavailable; shows it
   otherwise.
6. Route guard redirects when unavailable.
7. Org settings page renders capability toggles for entitled addons and
   preserves unrelated policy keys on submit.
8. Singularity admin toggle persists into
   `metadata.addonGrants` and triggers a snapshot recompute.

Run `bun run test` and `bun run lint` from `apps/start` before landing
any product or addon work.
