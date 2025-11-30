import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a UUID v4 (random UUID).
 * Uses crypto.randomUUID() when available
 * falls back to Math.random() for older browsers.
 * 
 * Security note: The fallback using Math.random() is NOT cryptographically secure
 * and should only be used when crypto.randomUUID() is unavailable
 */
export function generateUUID(): string {
  // Use crypto.randomUUID() if available
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper function to copy text to clipboard with fallback support
export async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    throw error; // Re-throw so the caller can handle it
  }
}