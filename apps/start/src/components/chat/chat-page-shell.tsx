'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { useHotkey } from '@tanstack/react-hotkeys'
import { usePageSidebarVisibility } from '@/components/layout/page-sidebar-visibility-context'
import { m } from '@/paraglide/messages.js'
import { ChatInput } from './chat-input'
import { ChatThread } from './chat-thread'

/**
 * Shared shell used by both `/chat` and `/chat/$threadId`.
 * Keeping a single component prevents subtle layout drift between routes.
 */
export function ChatPageShell() {
  const { isChatPageSidebarCollapsed, setIsChatPageSidebarCollapsed } =
    usePageSidebarVisibility()

  useHotkey(
    'Control+B',
    () => {
      setIsChatPageSidebarCollapsed((current) => !current)
    },
    {
      ignoreInputs: true,
      preventDefault: true,
    },
  )

  const toggleLabel = isChatPageSidebarCollapsed
    ? m.layout_expand_page_sidebar_aria_label()
    : m.layout_collapse_page_sidebar_aria_label()

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Action overlay lives at shell level so it is not constrained by chat-content width wrappers. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pb-2 pt-3">
        <div className="flex w-full items-center justify-start gap-2 pointer-events-auto">
          <Button
            type="button"
            variant="ghost"
            size="iconSmall"
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => {
              setIsChatPageSidebarCollapsed((current) => !current)
            }}
          >
            {isChatPageSidebarCollapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <div className="px-4 pt-10">
          <ChatThread />
        </div>
      </div>

      <div className="sticky bottom-0 z-40 overflow-visible px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-4">
        <div className="mx-auto w-full max-w-2xl -mb-[max(env(safe-area-inset-bottom),0.75rem)] rounded-t-[30px] bg-surface-base pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <ChatInput />
        </div>
      </div>
    </div>
  )
}
