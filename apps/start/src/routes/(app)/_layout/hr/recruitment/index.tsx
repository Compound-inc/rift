import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/hr/recruitment/')({
  component: HrRecruitmentPage,
})

function HrRecruitmentPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
      <div className="max-w-2xl space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-foreground-secondary">
          HR · Recruitment
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground-strong md:text-5xl">
          Manage candidates and pipelines.
        </h1>
        <p className="text-base leading-7 text-foreground-secondary md:text-lg">
          This surface will host job postings, the candidate pipeline, and
          interview scheduling once the Recruitment workflows are wired up.
        </p>
      </div>
    </div>
  )
}
