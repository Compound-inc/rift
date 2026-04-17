import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/writing/')({
  component: WritingPage,
})

function WritingPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-10">
      <div className="max-w-2xl space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-foreground-secondary">
          Writing
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground-strong md:text-5xl">
          Collaborate with AI on long-form documents.
        </h1>
        <p className="text-base leading-7 text-foreground-secondary md:text-lg">
          This workspace will become the home for drafting, revising, and
          shaping long documents with an AI agent. For now, it is wired into the
          app shell so the page can be reached from the sidebar.
        </p>
      </div>
    </div>
  )
}
