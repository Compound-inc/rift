"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { Autumn } from "autumn-js";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const AUTUMN_ENTITY_NOT_FOUND_SNIPPET =
  "not found. To automatically create this entity, please pass in 'feature_id' into the 'entity_data' field of the request body.";

function isEntityNotFoundMessage(message?: string): boolean {
  if (!message) return false;
  if (message.includes(AUTUMN_ENTITY_NOT_FOUND_SNIPPET)) return true;
  if (message.includes("Entity") && message.includes("not found")) return true;
  return false;
}

const AUTUMN_SEAT_LIMIT_CODES = new Set([
  "balance_exceeded",
  "limit_exceeded",
  "entity_limit",
  "seat_limit",
  "quota_exceeded",
  "insufficient_balance",
]);

function isAutumnSeatLimitError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      AUTUMN_SEAT_LIMIT_CODES.has((error as { code: string }).code),
  );
}

export type EnsureEnterpriseEntityResult =
  | { ok: true }
  | { ok: false; reason: "not_enterprise" }
  | { ok: false; reason: "seat_limit"; message: string }
  | { ok: false; reason: "error"; message?: string };

/**
 * Validates the current user's org is enterprise and ensures their Autumn
 * entity exists (creates under "seats" if missing). Call when the usage page
 * hits "entity not found" so the client can refetch useEntity after success.
 */
export async function ensureEnterpriseEntity(): Promise<EnsureEnterpriseEntityResult> {
  try {
    const { user, organizationId } = await withAuth({ ensureSignedIn: true });

    if (!user?.id || !organizationId) {
      return { ok: false, reason: "error", message: "Not authenticated or no organization" };
    }

    const plan = await fetchQuery(api.organizations.getOrganizationPlan, {
      workos_id: organizationId,
      secret: process.env.CONVEX_SECRET_TOKEN!,
    });

    if (plan !== "enterprise") {
      return { ok: false, reason: "not_enterprise" };
    }

    const secretKey = process.env.AUTUMN_SECRET_KEY;
    if (!secretKey) {
      return { ok: false, reason: "error", message: "Server configuration error" };
    }

    const autumn = new Autumn({ secretKey });
    const userId = user.id;
    const userName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`.trim()
        : (user.email ?? user.id);

    const runCheck = () =>
      autumn.check({
        customer_id: organizationId,
        feature_id: "standard",
        entity_id: userId,
      });

    let createdSeatsEntity = false;
    const ensureSeatsEntity = async (): Promise<"ok" | "no_seats"> => {
      if (createdSeatsEntity) return "ok";

      const seatsResponse = await autumn.check({
        customer_id: organizationId,
        feature_id: "seats",
      });

      const seatsData = (seatsResponse as { data?: unknown })?.data as
        | { allowed?: boolean; unlimited?: boolean }
        | undefined;
      if (!seatsData || typeof seatsData.allowed !== "boolean") {
        const message = (seatsResponse as { error?: { message?: string } })?.error?.message;
        throw new Error(message ?? "Autumn seats check failed");
      }

      const seatsAllowed = seatsData.unlimited === true || seatsData.allowed === true;
      if (!seatsAllowed) {
        return "no_seats";
      }

      try {
        createdSeatsEntity = true;
        await autumn.entities.create(organizationId, {
          id: userId,
          name: userName,
          feature_id: "seats",
        });
      } catch (error) {
        if (isAutumnSeatLimitError(error)) return "no_seats";
        throw error;
      }

      return "ok";
    };

    // Try check; if entity not found, ensure entity then retry
    let response: Awaited<ReturnType<typeof runCheck>>;

    try {
      response = await runCheck();
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      if (!isEntityNotFoundMessage(message)) throw error;
      const ensured = await ensureSeatsEntity();
      if (ensured === "no_seats") {
        return { ok: false, reason: "seat_limit", message: "Su organización ha alcanzado el número máximo de usuarios. Pueden contactar a los administradores de la organización para aumentar el límite." };
      }
      response = await runCheck();
    }

    if ((response as { data?: unknown })?.data == null) {
      const message = (response as { error?: { message?: string } })?.error?.message;
      if (isEntityNotFoundMessage(message)) {
        const ensured = await ensureSeatsEntity();
        if (ensured === "no_seats") {
          return { ok: false, reason: "seat_limit", message: "Su organización ha alcanzado el número máximo de usuarios. Pueden contactar a los administradores de la organización para aumentar el límite." };
        }
        response = await runCheck();
      }
    }

    const responseData = (response as { data?: unknown })?.data;
    if (!responseData || typeof (responseData as { allowed?: boolean }).allowed !== "boolean") {
      throw new Error("Autumn check failed");
    }

    return { ok: true };
  } catch (error) {
    console.error("ensureEnterpriseEntity:", error);
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Failed to ensure entity",
    };
  }
}
