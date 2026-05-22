'use client'

import { m } from '@/paraglide/messages.js'

import { DoddleLine } from './chat-welcome-screen'

/**
 * Project-aware welcome screen rendered on `/chat/projects/$projectId`.
 *
 * This is the in-project counterpart to {@link ChatWelcomeScreen}. The
 * generic suggestion cards are intentionally omitted: a project already
 * carries its own intent (custom instruction + sources), and offering a
 * "dark matter" starter prompt next to a project named "Q4 Marketing"
 * reads like noise.
 *
 * The structure mirrors the regular welcome (centered hero, project name,
 * generic subtitle) so the visual rhythm of `/chat` and
 * `/chat/projects/<id>` feels like the same surface in two states. The
 * project name is decorated with the same hand-drawn underline used for
 * the signed-in user's first name on the global welcome \u2014 it ties the
 * two empty states together as members of one family. The slide / scale
 * intro animations are deliberately omitted here so the project hero
 * lands instantly when the route opens, while the global welcome keeps
 * its first-impression flourish.
 */
export function ChatProjectWelcomeScreen({
  projectName,
}: {
  projectName: string
}) {
  return (
    <div className="w-full py-4 md:py-6">
      <div className="mx-auto w-full max-w-2xl text-center">
        <h1 className="mb-6 flex items-center justify-center text-4xl font-semibold text-foreground-strong">
          <span className="relative inline-block">
            <span
              className="relative inline-block font-semibold"
              style={{ overflow: 'visible', whiteSpace: 'nowrap' }}
            >
              {projectName}
            </span>
            <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-blue-600">
              <DoddleLine className="h-20 w-38" />
            </span>
          </span>
        </h1>

        <h2 className="mb-8 text-3xl font-normal text-foreground-secondary">
          {m.chat_project_welcome_subtitle()}
        </h2>
      </div>
    </div>
  )
}
