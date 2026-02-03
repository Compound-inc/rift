#!/usr/bin/env bun
/**
 * Sets all legacy organization fields to undefined so they can be removed from the schema.
 * Requires CONVEX_SECRET_TOKEN (e.g. from .env.local) and Convex CLI configured.
 *
 * Run: bun run scripts/clear-org-legacy-fields.ts
 * Or:  CONVEX_SECRET_TOKEN=xxx bun run scripts/clear-org-legacy-fields.ts
 */

import { $ } from "bun";

// Load .env.local then .env so CONVEX_SECRET_TOKEN is available
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

console.log("Clearing legacy fields on all organizations...");
const result = await $`bunx convex run admin/organizations:clearOrganizationsLegacyFields ${args}`.quiet();
if (!result.exitCode) {
  console.log(result.stdout?.toString() || "Done.");
} else {
  console.error(result.stderr?.toString() || "Failed.");
  process.exit(result.exitCode ?? 1);
}
