'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@rift/ui/button'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'
import { useSideNav } from '@/components/layout/main-nav'
import { usePageSidebarVisibility } from '@/components/layout/page-sidebar-visibility-context'
import { m } from '@/paraglide/messages.js'
import { ChatInput } from './chat-input'
import { ChatThread } from './chat-thread'

/**
 * Shared shell used by both `/chat` and `/chat/$threadId`.
 * Keeping a single component prevents subtle layout drift between routes.
 */
export function ChatPageShell({
  ThreadComponent = ChatThread,
  InputComponent = ChatInput,
}: {
  /**
   * Allow sibling products like writing to reuse the exact same shell while
   * swapping in their own provider-backed thread renderer.
   */
  ThreadComponent?: ComponentType
  /**
   * The shared composer chrome stays identical across products even when the
   * send logic comes from a different context implementation.
   */
  InputComponent?: ComponentType
}) {
  const { isMobile } = useMediaQuery()
  const { isOpen: isMobileNavOpen, setIsOpen: setIsMobileNavOpen } =
    useSideNav()
  const { isChatPageSidebarCollapsed, setIsChatPageSidebarCollapsed } =
    usePageSidebarVisibility()

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

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-visible">
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
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-x-hidden px-2 md:px-4"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="h-full">
          <ThreadComponent />
        </div>
      </div>

      <div className="sticky bottom-0 z-40 overflow-visible px-0 md:px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:pt-4">
        <div className="w-full md:mx-auto md:max-w-2xl -mb-[max(env(safe-area-inset-bottom),0.75rem)] bg-surface-base md:rounded-t-[30px] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <InputComponent />
        </div>
      </div>
    </div>
  )
}
