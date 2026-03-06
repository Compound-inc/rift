'use client'

/**
 * Shared layout shell for auth-related pages (sign-in, sign-up, accept-invitation,
 * forgot-password, etc.). Provides the centered flex container and shadow
 * background image used across all auth flows.
 */
export function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-[#2A2929] flex items-center justify-center px-4 relative overflow-hidden">
      <img
        src="/shadowfull.webp"
        alt=""
        className="absolute top-0 left-0 w-full h-full z-0 mix-blend-multiply object-cover pointer-events-none dark:hidden"
        aria-hidden
      />
      {children}
    </div>
  )
}
