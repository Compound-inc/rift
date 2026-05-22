'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'
import { useSideNav } from '@/components/layout/main-nav'
import { usePageSidebarVisibility } from '@/components/layout/page-sidebar-visibility-context'
import { m } from '@/paraglide/messages.js'
import { useChatMessages } from './chat-context'
import { ChatInput } from './chat-input'
import { ChatProjectChip } from './chat-project-chip'
import { ChatThread } from './chat-thread'

/**
 * Shared shell used by both `/chat` and `/chat/$threadId`.
 * Keeping a single component prevents subtle layout drift between routes.
 */
export function ChatPageShell() {
  const { isMobile } = useMediaQuery()
  const { isOpen: isMobileNavOpen, setIsOpen: setIsMobileNavOpen } =
    useSideNav()
  const { isChatPageSidebarCollapsed, setIsChatPageSidebarCollapsed } =
    usePageSidebarVisibility()
  const { activeProjectId, activeThreadId, messages } = useChatMessages()

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileNavOpen((current) => !current)
      return
    }

    setIsChatPageSidebarCollapsed((current) => !current)
  }

  const isSidebarExpanded = isMobile
    ? isMobileNavOpen
    : !isChatPageSidebarCollapsed

  const toggleLabel = isSidebarExpanded
    ? m.layout_collapse_page_sidebar_aria_label()
    : m.layout_expand_page_sidebar_aria_label()

  useHotkey(
    'Control+B',
    () => {
      toggleSidebar()
    },
    {
      ignoreInputs: true,
      preventDefault: true,
    },
  )

  /**
   * Decorative doodles backdrop is reserved for the project landing
   * page. The matching welcome-screen branch in `ChatThread` reads the
   * same `isProjectLandingState` flag from chat context, so the two
   * views cannot disagree on when the backdrop should appear.
   */
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-visible">
      {isProjectLandingState ? <ChatProjectLandingBackdrop /> : null}
      <div className="pointer-events-none sticky top-0 z-30 h-0 overflow-visible px-2 pt-2 md:px-4 md:pt-3">
        <div className="flex w-full items-center justify-start gap-2">
          <div className="pointer-events-auto">
            <Button
              type="button"
              variant="ghost"
              size="iconSmall"
              aria-label={toggleLabel}
              title={toggleLabel}
              onClick={toggleSidebar}
            >
              {isSidebarExpanded ? (
                <PanelLeftClose className="size-4" aria-hidden />
              ) : (
                <PanelLeftOpen className="size-4" aria-hidden />
              )}
            </Button>
          </div>
          <ChatProjectChip />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-x-hidden px-2 md:px-4"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="h-full">
          <ChatThread />
        </div>
      </div>

      <div className="sticky bottom-0 z-40 overflow-visible px-0 md:px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:pt-4">
        <div className="w-full md:mx-auto md:max-w-2xl -mb-[max(env(safe-area-inset-bottom),0.75rem)] bg-surface-base md:rounded-t-[30px] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <ChatInput />
        </div>
      </div>
    </div>
  )
}

/**
 * Decorative doodles spread across the top of the project landing page,
 * fading to fully transparent before reaching the composer. Rendered at
 * `z-0` so the welcome hero, composer, and any sticky chrome stack over it.
 *
 * The SVG asset ships with hardcoded `fill="black"` paths; rather than
 * rewriting the asset, the dark-mode pass uses `invert` on the rendered
 * image so the doodles read as light strokes on dark surfaces. The
 * `mask-image` linear gradient is what produces the "fades down to 0"
 * effect: anything outside the gradient's reach is clipped, regardless of
 * the underlying image opacity.
 */
function ChatProjectLandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[70vh] overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%)',
      }}
    >
      <img
        src="/doodles.svg"
        alt=""
        aria-hidden
        className="size-full max-w-none object-cover object-top opacity-[0.06] dark:opacity-[0.08] dark:invert"
        draggable={false}
      />
    </div>
  )
}
