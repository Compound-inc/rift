import { Link } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import { FolderX } from 'lucide-react'
import { m } from '@/paraglide/messages.js'

/** Shared recovery view for every project route after access resolves empty. */
export function ProjectUnavailable() {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-sm flex-col items-center px-6 py-24 text-center md:py-32"
    >
      <span
        className="mb-4 grid size-10 place-items-center rounded-full bg-surface-inverse/5 text-foreground-tertiary"
        aria-hidden
      >
        <FolderX className="size-4" />
      </span>
      <h1 className="text-balance text-base font-medium text-foreground-strong">
        {m.project_unavailable()}
      </h1>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-foreground-tertiary">
        {m.project_unavailable_description()}
      </p>
      <Button
        variant="ghost"
        className="mt-5 rounded-full bg-surface-inverse/5 px-4 hover:bg-surface-inverse/10"
        asChild
      >
        <Link to="/chat">{m.project_back_to_chat()}</Link>
      </Button>
    </div>
  )
}
