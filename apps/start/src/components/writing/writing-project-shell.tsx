'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'
import { useSideNav } from '@/components/layout/main-nav'
import { usePageSidebarVisibility } from '@/components/layout/page-sidebar-visibility-context'
import { ChatInput } from '@/components/chat'
import { WritingChatThread } from './writing-chat-thread'
import { WritingDocumentViewer } from './writing-document-viewer'
import { m } from '@/paraglide/messages.js'

type WritingProjectShellProps = {
  readonly projectId: string
}

/**
 * Writing uses the same sidebar controls as chat, but its workspace needs a
 * two-pane canvas so conversation and markdown preview stay visible together.
 * The split is intentionally static and understated to match the current
 * product language instead of introducing IDE-style chrome.
 */
export function WritingProjectShell({ projectId }: WritingProjectShellProps) {
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
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0 overflow-visible px-2 pt-2 md:px-4 md:pt-3">
        <div className="flex items-center justify-start gap-2">
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
        className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden px-2 md:px-4 lg:grid-cols-2"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex min-h-full flex-col">
              <WritingChatThread />
              <div className="sticky bottom-0 z-20 mt-auto pr-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:pr-4">
                <div className="-mb-[max(env(safe-area-inset-bottom),0.75rem)] bg-surface-base pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                  <ChatInput />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden border-t border-border-base lg:border-t-0 lg:border-l">
          <WritingDocumentViewer projectId={projectId} />
        </div>
      </div>
    </div>
  )
}
