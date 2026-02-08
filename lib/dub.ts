import { Dub } from "dub";

let dubInstance: Dub | null = null;

/**
 * Returns a singleton Dub SDK client configured for the self-hosted instance.
 * Returns null if the DUB_API_KEY is not set.
 */
export function getDubClient(): Dub | null {
  if (!process.env.DUB_API_KEY) return null;
  if (!dubInstance) {
    dubInstance = new Dub({
      token: process.env.DUB_API_KEY,
      serverURL: process.env.NEXT_PUBLIC_DUB_API_HOST || undefined,
    });
  }
  return dubInstance;
}
