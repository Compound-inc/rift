# Permissions

Canonical guide to the permission system. Companion documents:

- `apps/start/PRODUCTS_AND_ADDONS.md` — products, addons, entitlements.
- `apps/start/BACKEND_EFFECT_PLAYBOOK.md` — backend service patterns.

The permission system is the single surface that answers "can this user
do this right now?". It unifies workspace features, product
entitlements, org-admin capability toggles, and (future) role-based
leaf permissions behind one typesafe key.

## 1. Permission key syntax

```
workspace.<featureId>                          // plan-gated workspace feature
product.<productKey>                           // product umbrella
product.<productKey>.<addonKey>                // paid addon
product.<productKey>.<addonKey>.<leaf>         // fine-grained leaf permission
product.<productKey>.<leaf>                    // product-level leaf without addon context
```

Every valid key is encoded in the `PermissionKey` union type, which is
derived from:

- `WORKSPACE_FEATURE_IDS` for `workspace.*` keys
- `ORG_PRODUCT_ADDON_CATALOG` for `product.<productKey>.<addonKey>` keys
- `PRODUCT_PERMISSION_CATALOG` for leaf keys

Adding a new entry to any of those catalogs auto-extends the union. Typos
fail at compile time:

```ts
can('product.hr.recruitment') // ✓
can('product.hq') // ✗ compile error
can('workspace.byok') // ✓
can('workspace.unknown') // ✗ compile error
```

Leaf segments use a `resource.action` convention
(`candidates.view`, `jobs.publish`). This matches REST URLs, groups well
in the role selector UI, and reads left-to-right as "within this scope,
this resource, this action."

## 2. Resolution order

For any requested key the resolver applies these layers, top-to-bottom.
The first denial wins:

1. **Ancestor walk.** A leaf like `product.hr.recruitment.candidates.view`
   requires its ancestors (`product.hr.recruitment`, `product.hr`) to
   resolve allowed. An ancestor denial short-circuits with
   `reason: 'ancestor-denied'`.
2. **Workspace.** `workspace.<featureId>` consults plan rank via
   `getWorkspaceFeatureAccessState`. Denies are `reason:
'plan-insufficient'`.
3. **Product entitlement.** For `product.<productKey>` (and
   `product.<productKey>.<addonKey>`), the snapshot-backed entitlement
   map must contain `true`. Denies are `reason: 'not-entitled'`.
4. **Org-admin capability.** `OrgProductPolicy.capabilities['enabled']`
   or `OrgProductPolicy.capabilities['<addonKey>.enabled']` must not be
   `false`. Denies are `reason: 'disabled-by-admin'`.
5. **Role permission (future).** Leaf keys consult an explicit
   role-permission set. When the set is empty (today's default), leaves
   inherit their ancestor decision — which means adding role
   enforcement later does NOT break existing leaf consumers.

## 3. File map

```
apps/start/src/lib/shared/permissions/
  catalog.ts              # PermissionKey union, PRODUCT_PERMISSION_CATALOG, decoder, ancestor walker
  resolver.ts             # Pure resolvePermission / resolvePermissionRaw / bundle helpers
  permissions.test.ts     # Resolver, ancestor walking, bundle normalization coverage
  index.ts                # Barrel

apps/start/src/lib/frontend/permissions/
  use-permissions.ts      # Canonical client hook (can / canRaw / check / workspaceFeatureState)

apps/start/src/lib/backend/permissions/
  domain/errors.ts            # Tagged PermissionDeniedError / PermissionResolveError
  services/permission.service.ts  # PermissionService (Effect.fn, layerMemory, layerNoop)
  runtime/permissions-runtime.ts  # makeRuntimeRunner wiring
```

## 4. Using it — client

```ts
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

const { can, canRaw, check, workspaceFeatureState, loading } = usePermissions()

// Standard user-facing gate. Walks ancestors, composes every layer.
if (can('product.hr.recruitment')) {
  // render sidebar, nav, landing, etc.
}

// Settings pages that configure a capability must use the RAW variant
// or they will lock the admin out of their own kill switch.
if (canRaw('product.hr')) {
  // render the HR settings page
}

// Discriminated reason for richer UX copy.
const { allowed, reason } = check('workspace.singleSignOn')
if (!allowed && reason === 'plan-insufficient') {
  // show the upgrade CTA
}

// Legacy workspace feature state (upgrade hints, minimumPlanId).
const featureAccess = workspaceFeatureState('byok')
```

`usePermissions` reads from the single layout-level Zero query
(`queries.orgBilling.currentSummary`). The bundle is cached across
navigations — there is no fresh fetch on route change.

## 5. Using it — server

```ts
const context = yield* permissions.forOrg({ organizationId, userId })
if (!context.can('product.hr.recruitment')) return Effect.fail(...)

// Or one-shot:
yield* permissions.authorize({
  organizationId,
  userId,
  permissionKey: 'product.hr.recruitment',
})
```

The server service loads a fresh bundle from the database on every
request. Client-asserted permission state must NEVER be trusted for
security-sensitive operations.

Tests use `PermissionService.layerMemory(bundle)` with a deterministic
bundle built via `EMPTY_PERMISSION_BUNDLE` + `setCapability` +
`resolveProductAddonEntitlements` + `resolveWorkspaceEffectiveFeatures`.

## 6. Adding a new permission

### A new workspace feature

1. Add the id to `WORKSPACE_FEATURE_IDS`.
2. Map it in `ORG_FEATURE_MINIMUM_PLANS`.
3. Done. `workspace.<id>` is now a valid `PermissionKey` everywhere.

### A new product or addon

See `PRODUCTS_AND_ADDONS.md`. Permission keys update automatically once
the catalog entry lands.

### A new leaf permission (e.g. `product.hr.recruitment.candidates.view`)

1. Add the leaf string to
   `PRODUCT_PERMISSION_CATALOG.hr.addonLeaves.recruitment`.
2. The `PermissionKey` union and runtime list pick it up automatically.
3. When the role selector UI lands, populate `PermissionBundle.rolePermissions`
   with the granted leaf keys for the active user. Until then, every
   leaf inherits its ancestor decision.

## 7. Testing checklist

1. Unit test each new `product.*` / `workspace.*` / leaf key's
   default-deny / grant behavior in the resolver.
2. If a new UI surface calls `can(...)`, add a smoke test that flips
   the bundle and verifies the UI reacts.
3. Server-side authorization tests use
   `PermissionService.layerMemory` + the tagged
   `PermissionDeniedError`.

## 8. Anti-patterns

1. **Bypassing `usePermissions()` in user-facing surfaces.** Every gate
   should go through the composite hook so org-admin kill switches
   (and future role-based gates) take effect everywhere.
2. **Using `can(...)` for settings pages that configure a capability.**
   Use `canRaw(...)`. See §4 and `hr-settings-page.tsx` for the
   pattern.
3. **Gating security-critical server operations on client-asserted
   permission state.** Always resolve the bundle fresh on the server
   via `PermissionService.forOrg`.
4. **Free-text permission keys.** Always register the id in the
   catalog so the union type picks it up. The resolver silently
   returns `invalid-key` for strings it cannot decode.
5. **Nested permission namespaces outside `workspace.*` / `product.*`.**
   Those two prefixes cover every current use case; adding a third
   namespace would fragment the decoder.

## 9. Future extensions

The composite `can()` is deliberately split into layered factors so the
following extensions land without any call-site changes:

- **Org member role selector.** Populates
  `PermissionBundle.rolePermissions` with leaf keys the current role
  has granted.
- **Group-based gating.** Adds another AND factor inside the resolver;
  consumer surfaces keep reading `can(...)`.
- **Time-based / usage-based gating.** Same — a new AND factor with a
  new discriminated `reason` variant.

None of these require schema changes or refactoring the call sites.
