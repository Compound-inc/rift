import { ClassValue } from 'clsx';

declare function cn(...inputs: ClassValue[]): string;

/**
 * Generate a UUID v4 (random UUID).
 * Uses crypto.randomUUID() when available,
 * falls back to Math.random() for older browsers.
 *
 * Security note: The fallback using Math.random() is NOT cryptographically secure
 * and should only be used when crypto.randomUUID() is unavailable.
 */
declare function generateUUID(): string;

/**
 * Copy text to clipboard with fallback support.
 * Triggers a success toast on copy, or an error toast on failure.
 */
declare function copyToClipboard(text: string): Promise<void>;

export { cn, copyToClipboard, generateUUID };
