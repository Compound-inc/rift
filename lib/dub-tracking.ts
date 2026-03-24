import { cookies } from "next/headers";
import { getDubClient } from "./dub";

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Reads the `dub_id` cookie set by the @dub/analytics client-side script.
 * This cookie is present when the user arrived via a Dub short link.
 */
export async function getDubClickId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("dub_id")?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Clears the `dub_id` cookie so it is consumed only once.
 */
async function clearDubCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set("dub_id", "", {
      expires: new Date(0),
      path: "/",
    });
  } catch {
    // cookies() may throw outside a request context — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Lead tracking
// ---------------------------------------------------------------------------

type TrackLeadOptions = {
  /**
   * The dub_id click ID.
   * - Pass the actual click ID when you already have it (e.g. from query param).
   * - Pass "" to auto-resolve: the function will read the dub_id cookie and,
   *   if unavailable, fall back to deferred tracking (requires an existing customer).
   */
  clickId: string;
  eventName: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  metadata?: Record<string, string>;
};

/**
 * Tracks a lead conversion event with Dub.
 *
 * When `clickId` is empty the function reads the `dub_id` cookie as a
 * fallback.  On success the cookie is automatically cleared so it is only
 * consumed once across the entire funnel.
 *
 * Returns `true` on success, `false` on failure.
 */
export async function trackDubLead(options: TrackLeadOptions): Promise<boolean> {
  const dub = getDubClient();
  if (!dub) return false;

  // Resolve clickId: explicit value → cookie fallback → deferred ("")
  let clickId = options.clickId;
  if (!clickId) {
    const cookieClickId = await getDubClickId();
    if (cookieClickId) clickId = cookieClickId;
  }

  try {
    await dub.track.lead({
      clickId,
      eventName: options.eventName,
      customerExternalId: options.userId,
      customerName: options.userName,
      customerEmail: options.userEmail,
      metadata: options.metadata,
    });

    // Consume the cookie after the first successful lead so subsequent
    // events use deferred tracking instead of creating duplicate leads.
    if (clickId) {
      await clearDubCookie();
    }

    return true;
  } catch (err) {
    console.error(`[Dub] Failed to track lead "${options.eventName}":`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sale tracking
// ---------------------------------------------------------------------------

type TrackSaleOptions = {
  userId: string;
  eventName: string;
  /** Sale amount in cents */
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
};

/**
 * Tracks a sale conversion event with Dub.
 * The customer must have been previously registered via a lead event;
 * Dub links the sale to the customer via `customerExternalId`.
 *
 * Returns `true` on success, `false` on failure.
 */
export async function trackDubSale(options: TrackSaleOptions): Promise<boolean> {
  const dub = getDubClient();
  if (!dub) return false;

  try {
    await dub.track.sale({
      customerExternalId: options.userId,
      eventName: options.eventName,
      amount: options.amount,
      currency: options.currency ?? "MXN",
      metadata: options.metadata,
    });
    return true;
  } catch (err) {
    console.error(`[Dub] Failed to track sale "${options.eventName}":`, err);
    return false;
  }
}
