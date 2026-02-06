#!/usr/bin/env bun
/**
 * Clears all legacy fields on organizations and users so they can be removed from the schema.
 * Requires CONVEX_SECRET_TOKEN (e.g. from .env.local) and Convex CLI configured.
 *
 * Organizations: seatQuantity, productId, billingCycleStart, billingCycleEnd,
 *   stripeCustomerId, subscriptionId, subscriptionStatus, priceId,
 *   paymentMethodBrand, paymentMethodLast4, currentPeriodStart, currentPeriodEnd,
 *   subscriptionIds, cancelAtPeriodEnd, standardQuotaLimit, premiumQuotaLimit
 *
 * Users: standardQuotaUsage, premiumQuotaUsage, lastQuotaResetAt
 *
 * Run: bun run scripts/clear-legacy-fields.ts
 * Or:  CONVEX_SECRET_TOKEN=xxx bun run scripts/clear-legacy-fields.ts
 */

import { $ } from "bun";

async function loadEnvFiles() {
  const roots = [process.cwd()];
  for (const root of roots) {
    for (const name of [".env.local", ".env"]) {
      try {
        const path = `${root}/${name}`;
        const content = await Bun.file(path).text();
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq <= 0) continue;
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1).replace(/\\(.)/g, "$1");
          }
          if (!process.env[key]) process.env[key] = value;
        }
      } catch {
        // ignore missing files
      }
    }
  }
}

await loadEnvFiles();

const secret = process.env.CONVEX_SECRET_TOKEN;
if (!secret) {
  console.error("CONVEX_SECRET_TOKEN is not set. Set it in .env.local or pass it in the environment.");
  process.exit(1);
}

const args = JSON.stringify({ secret });

console.log("Clearing legacy fields on organizations...");
const orgResult = await $`bunx convex run admin/organizations:clearOrganizationsLegacyFields ${args}`.quiet();
if (orgResult.exitCode !== 0) {
  console.error(orgResult.stderr?.toString() || "Failed.");
  process.exit(orgResult.exitCode ?? 1);
}
const orgOut = orgResult.stdout?.toString()?.trim();
if (orgOut) console.log(orgOut);

console.log("Clearing legacy fields on users...");
const userResult = await $`bunx convex run admin/users:clearUsersLegacyFields ${args}`.quiet();
if (userResult.exitCode !== 0) {
  console.error(userResult.stderr?.toString() || "Failed.");
  process.exit(userResult.exitCode ?? 1);
}
const userOut = userResult.stdout?.toString()?.trim();
if (userOut) console.log(userOut);

console.log("Done. You can now remove the legacy fields from convex/schema.ts.");
