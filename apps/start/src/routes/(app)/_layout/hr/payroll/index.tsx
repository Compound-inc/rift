import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/hr/payroll/')({
  component: HrPayrollPage,
})

function HrPayrollPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
      <div className="max-w-2xl space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-foreground-secondary">
          HR · Payroll
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground-strong md:text-5xl">
          Run payroll cycles and track compensation.
        </h1>
        <p className="text-base leading-7 text-foreground-secondary md:text-lg">
          This surface will host pay periods, payroll runs, and integrations
          with external payroll providers once the workflows are wired up.
        </p>
      </div>
    </div>
  )
}
