import { createFileRoute, Link } from '@tanstack/react-router'
import { m } from '@/paraglide/messages.js'

export const Route = createFileRoute('/(app)/_layout/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold text-foreground-strong">{m.home_title()}</h1>
        <p className="text-foreground-secondary">
          <Link to="/chat" className="text-foreground-strong underline hover:no-underline">
            {m.home_go_to_chat()}
          </Link>
          {' '}
          {m.home_get_started_suffix()}
        </p>
      </div>
    </div>
  )
}
