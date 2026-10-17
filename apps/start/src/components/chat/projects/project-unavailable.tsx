import { Link } from '@tanstack/react-router'
import { m } from '@/paraglide/messages.js'

/** Shared recovery view for every project route after access resolves empty. */
export function ProjectUnavailable() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-3xl space-y-4 px-4 py-16 md:px-8"
    >
      <h1 className="text-sm font-medium text-foreground-strong">
        {m.project_unavailable()}
      </h1>
      <p className="text-sm text-foreground-tertiary">
        {m.project_unavailable_description()}
      </p>
      <Link to="/chat" className="text-sm text-foreground-info underline">
        {m.project_back_to_chat()}
      </Link>
    </div>
  )
}
