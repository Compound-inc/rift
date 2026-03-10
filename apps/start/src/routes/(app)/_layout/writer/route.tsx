import { createFileRoute } from '@tanstack/react-router'
import { m } from '@/paraglide/messages.js'

export const Route = createFileRoute('/(app)/_layout/writer')({
  component: WriterPage,
})

function WriterPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold text-foreground-strong">
        {m.writer_page_title()}
      </h1>
      <p className="mt-2 text-foreground-secondary">{m.app_coming_soon()}</p>
    </div>
  )
}
