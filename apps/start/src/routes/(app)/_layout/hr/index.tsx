import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/hr/')({
  component: HrPage,
})

function HrPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
      <div className="max-w-2xl space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-foreground-secondary">
          HR
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground-strong md:text-5xl">
          Run HR operations alongside the rest of your workspace.
        </h1>
        <p className="text-base leading-7 text-foreground-secondary md:text-lg">
          This product is the landing page for human resources workflows. Paid
          addons such as Recruitment and Payroll unlock their own surfaces once
          the platform admin grants access. See the sidebar for the addons
          enabled for this organization.
        </p>
      </div>
    </div>
  )
}
