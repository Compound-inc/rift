import { Navbar } from '@/components/layout/navbar'

/**
 * Layout for the pricing page. Renders outside the dashboard layout.
 * Uses the same Navbar as the next app for consistent branding.
 */
export function PricingPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center pt-16 py-12 md:py-24">
        {children}
      </main>
    </div>
  )
}
