import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/writer')({
  component: WriterPage,
})

function WriterPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold text-content-emphasis">
        Writer
      </h1>
      <p className="mt-2 text-content-muted">Coming soon</p>
    </div>
  )
}
