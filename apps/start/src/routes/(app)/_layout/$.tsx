import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/$')({
  component: NotFoundInApp,
})

function NotFoundInApp() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold text-foreground-strong">
        Not found
      </h1>
      <p className="mt-2 text-foreground-secondary">
        This page doesn't exist yet.
      </p>
    </div>
  )
}
