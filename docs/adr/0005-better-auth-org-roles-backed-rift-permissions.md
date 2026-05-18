# Back organization roles with Better Auth while keeping Rift permissions

Rift uses Better Auth dynamic organization access control as the source of truth for organization role persistence, role assignment, and role CRUD, but keeps the existing Rift `can()` permission resolver as the only app-facing authorization API. This preserves Better Auth ownership of membership state while keeping product entitlements, admin capabilities, and app-specific leaf permissions composed in one fast, type-safe permission bundle for both client UX and server authorization.
