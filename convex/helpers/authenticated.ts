import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserIdentity } from "./getUser";
import { extractOrganizationIdFromJWT } from "./identity";
import { UserIdentity } from "convex/server";
import { ObjectType, PropertyValidators } from "convex/values";

export const PERMISSIONS = {
  WIDGETS_USERS_TABLE_MANAGE: "widgets:users-table:manage",
  WIDGETS_DOMAIN_VERIFICATION_MANAGE: "widgets:domain-verification:manage",
  WIDGETS_SSO_MANAGE: "widgets:sso:manage",
  VIEW_ORG_ANALYTICS: "view-org-analytics",
  MANAGE_BILLING: "manage-billing",
  AUDIT_LOGS: "audit-logs",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// Base Configuration Types
type AuthConfig<Args extends PropertyValidators, Output, Ctx> = {
  args: Args;
  returns?: any;
  handler: (
    ctx: Ctx & { identity: UserIdentity },
    args: ObjectType<Args>
  ) => Promise<Output>;
};

type AuthOrgConfig<Args extends PropertyValidators, Output, Ctx> = {
  args: Args;
  returns?: any;
  handler: (
    ctx: Ctx & { orgId: string; identity: UserIdentity },
    args: ObjectType<Args>
  ) => Promise<Output>;
};

type PermissionCheckConfig<Args extends PropertyValidators, Output, Ctx> = {
  args: Args;
  returns?: any;
  permissions?: PermissionKey[];
  handler: (
    ctx: Ctx & { orgId: string; identity: UserIdentity },
    args: ObjectType<Args>
  ) => Promise<Output>;
};

// Auth wrappers (User only)
export function AuthQuery<Args extends PropertyValidators, Output>(
  config: AuthConfig<Args, Output, QueryCtx>
) {
  return query({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        return null;
      }

      return await config.handler({ ...ctx, identity }, args);
    },
  });
}

export function AuthMutation<Args extends PropertyValidators, Output>(
  config: AuthConfig<Args, Output, MutationCtx>
) {
  return mutation({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        throw new Error("Unauthenticated call");
      }

      return await config.handler({ ...ctx, identity }, args);
    },
  });
}

// AuthOrg wrappers (User + Org)
export function AuthOrgQuery<Args extends PropertyValidators, Output>(
  config: AuthOrgConfig<Args, Output, QueryCtx>
) {
  return query({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        return null;
      }

      const orgId = extractOrganizationIdFromJWT(identity);

      if (!orgId) {
        return null;
      }

      return await config.handler({ ...ctx, orgId, identity }, args);
    },
  });
}

export function AuthOrgMutation<Args extends PropertyValidators, Output>(
  config: AuthOrgConfig<Args, Output, MutationCtx>
) {
  return mutation({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        throw new Error("Unauthenticated call");
      }

      const orgId = extractOrganizationIdFromJWT(identity);

      if (!orgId) {
        throw new Error("No organization found");
      }

      return await config.handler({ ...ctx, orgId, identity }, args);
    },
  });
}

// Permission wrappers (User + Org + Permissions)
export function PermissionQuery<Args extends PropertyValidators, Output>(
  config: PermissionCheckConfig<Args, Output, QueryCtx>
) {
  return query({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        return null;
      }

      const orgId = extractOrganizationIdFromJWT(identity);

      if (!orgId) {
        return null;
      }

      if (config.permissions) {
        const userPermissions = (identity.permissions as string[]) || [];
        const hasPermission = config.permissions.some((key) =>
          userPermissions.includes(PERMISSIONS[key])
        );
        if (!hasPermission) {
          console.error(
            `User ${identity.subject} missing required permissions: ${config.permissions.join(", ")}`
          );
          return null;
        }
      }

      return await config.handler({ ...ctx, orgId, identity }, args);
    },
  });
}

export function PermissionMutation<Args extends PropertyValidators, Output>(
  config: PermissionCheckConfig<Args, Output, MutationCtx>
) {
  return mutation({
    args: config.args,
    returns: config.returns,
    handler: async (ctx, args: any) => {
      const identity = await getAuthUserIdentity(ctx);

      if (!identity) {
        throw new Error("Unauthenticated call");
      }

      const orgId = extractOrganizationIdFromJWT(identity);

      if (!orgId) {
        throw new Error("No organization found");
      }

      if (config.permissions) {
        const userPermissions = (identity.permissions as string[]) || [];
        const hasPermission = config.permissions.some((key) =>
          userPermissions.includes(PERMISSIONS[key])
        );
        if (!hasPermission) {
          throw new Error(
            `Missing required permissions: ${config.permissions.join(", ")}`
          );
        }
      }

      return await config.handler({ ...ctx, orgId, identity }, args);
    },
  });
}

