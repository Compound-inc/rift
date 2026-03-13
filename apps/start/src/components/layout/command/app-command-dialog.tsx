'use client'

import { useState  } from 'react'
import type {ReactNode} from 'react';
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { CommandDialog } from '@rift/ui/command'
import { Kbd, KbdGroup } from '@rift/ui/kbd'
import { cn } from '@rift/utils'
import {
  CHAT_SEARCH_HIGHLIGHT_CLASS_NAME,
  getSearchHighlightSegments,
  normalizeSearchQuery,
} from '@/lib/shared/chat-search-highlight'

export type AppCommandItem = {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  /**
   * Optional query used to emphasize matching terms inside the subtitle.
   * This is useful for search result rows where the subtitle is a snippet.
   */
  readonly subtitleHighlightQuery?: string
  readonly meta?: string
  readonly value?: string
  readonly icon?: ReactNode
  readonly onSelect: () => void
}

export type AppCommandGroup = {
  readonly id: string
  readonly heading: string
  readonly items: readonly AppCommandItem[]
}

type AppCommandDialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly query: string
  readonly onQueryChange: (query: string) => void
  readonly placeholder: string
  readonly emptyText: string
  readonly loadingText?: string
  readonly isLoading?: boolean
  readonly showEmptyState?: boolean
  readonly emptyIcon?: ReactNode
  readonly actionGroups?: readonly AppCommandGroup[]
  readonly groups: readonly AppCommandGroup[]
}

/**
 * Reusable app-level command shell.
 *
 * The structure intentionally mirrors the provided reference design: fixed
 * 56px search row, 48px command items, grouped sections, and a compact footer
 * action area. Data flow stays fully generic so feature providers can keep
 * controlling grouping and item behavior without coupling to visual details.
 */
export function AppCommandDialog({
  open,
  onOpenChange,
  title,
  description,
  query,
  onQueryChange,
  placeholder,
  emptyText,
  loadingText,
  isLoading = false,
  showEmptyState = true,
  emptyIcon,
  actionGroups = [],
  groups,
}: AppCommandDialogProps) {
  const normalizedQuery = normalizeSearchQuery(query).toLocaleLowerCase()
  const shouldShowThreadGroups = normalizedQuery.length > 0

  /**
   * Actions are always visible while idle, and become query-filtered once
   * the user starts typing. Threads are hidden until there is a search query.
   */
  const visibleActionGroups = actionGroups
    .map((group) => {
      if (normalizedQuery.length === 0) {
        return group
      }

      return {
        ...group,
        items: group.items.filter((item) => {
          const searchableValue = (
            item.value ?? `${item.title} ${item.subtitle ?? ''} ${item.meta ?? ''}`
          )
            .trim()
            .toLocaleLowerCase()
          return searchableValue.includes(normalizedQuery)
        }),
      }
    })
    .filter((group) => group.items.length > 0)

  /**
   * Thread headings should never render without rows. Filtering at the group
   * level avoids empty section labels such as "Threads" in no-result states.
   */
  const visibleThreadGroups = shouldShowThreadGroups
    ? groups.filter((group) => group.items.length > 0)
    : []

  const visibleGroups = [...visibleActionGroups, ...visibleThreadGroups]

  const hasVisibleItems = visibleGroups.some((group) => group.items.length > 0)
  const showLoadingState = isLoading && shouldShowThreadGroups && visibleThreadGroups.length === 0
  const shouldRenderGroups = !showLoadingState && hasVisibleItems
  const [navigationMode, setNavigationMode] = useState<'pointer' | 'keyboard'>('pointer')

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={cn(
        'max-w-3xl overflow-hidden rounded-xl border border-surface-strong bg-surface-strong p-0 text-foreground-primary shadow-md sm:max-w-3xl',
        'font-sans leading-6 tracking-[-0.1px]',
      )}
      showCloseButton={false}
    >
      <div className="relative bg-surface-strong">
        <div className="relative z-10 flex flex-col space-y-6 rounded-b-2xl bg-surface-raised px-6 pt-6 shadow-[0_2px_12px_rgb(0,0,0,0.05)]">
          <CommandPrimitive
            shouldFilter={false}
            className="flex w-full flex-col focus-visible:outline-none"
            /**
             * When users navigate with arrows, keep a single visual highlight
             * source (cmdk selected item) by suppressing pointer-hover styling
             * until mouse/pointer movement resumes.
             */
            onKeyDownCapture={(event) => {
              if (
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Home' ||
                event.key === 'End' ||
                event.key === 'PageDown' ||
                event.key === 'PageUp'
              ) {
                setNavigationMode('keyboard')
              }
            }}
          >
            <div className="-mx-6 -mt-6 flex h-14 items-center gap-3 border-b border-border-base px-5">
              <div className="flex w-full items-center gap-2">
                <CommandPrimitive.Input
                  value={query}
                  onValueChange={onQueryChange}
                  placeholder={placeholder}
                  className="w-full flex-1 bg-surface-raised p-0 text-base text-foreground-strong placeholder:text-foreground-secondary focus-visible:outline-none"
                />
                <div className="shrink-0 text-foreground-secondary">
                  <Search className="size-5" aria-hidden="true" />
                </div>
              </div>
            </div>

            <CommandPrimitive.List
              className="no-scrollbar -mx-6 max-h-[min(460px,calc(100dvh-136px))] overflow-y-auto px-3 pb-0"
              onPointerMove={() => {
                setNavigationMode('pointer')
              }}
            >
              {showLoadingState ? (
                <div className="px-3 py-8 text-sm text-foreground-secondary">{loadingText ?? emptyText}</div>
              ) : null}

              {!showLoadingState && showEmptyState && !hasVisibleItems ? (
                <CommandPrimitive.Empty className="flex min-h-[140px] items-center justify-center px-3 py-0 text-center text-sm text-foreground-secondary">
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon ? (
                      <div className="text-foreground-tertiary [&_svg]:size-5">
                        {emptyIcon}
                      </div>
                    ) : null}
                    <span>{emptyText}</span>
                  </div>
                </CommandPrimitive.Empty>
              ) : null}

              {shouldRenderGroups ? (
                <div className="relative grid h-full grid-cols-1 xl:grid-cols-2">
                  <div className="col-span-1 space-y-3 xl:col-span-2">
                    {visibleGroups.map((group, groupIndex) => (
                      <div
                        key={group.id}
                        className={groupIndex > 0 ? 'mt-3' : undefined}
                      >
                        <div className="px-3 pb-1.5 pt-2 text-sm leading-[21px] text-foreground-secondary">
                          {group.heading}
                        </div>

                        <CommandPrimitive.Group className="p-0">
                          {group.items.map((item) => (
                            <CommandPrimitive.Item
                              key={item.id}
                              value={item.value ?? `${item.title} ${item.subtitle ?? ''} ${item.meta ?? ''}`}
                              onSelect={item.onSelect}
                              className={cn(
                                // Match sidebar interaction language: compact radius + soft neutral hover/active fills.
                                'group grid min-h-10 grid-cols-1 grid-rows-1 rounded-lg p-2 outline-hidden select-none transition-colors duration-75',
                                navigationMode === 'pointer'
                                  ? 'hover:bg-surface-inverse/5 active:bg-surface-inverse/10'
                                  : undefined,
                                'data-[selected=true]:bg-surface-inverse/5 data-[selected=true]:hover:bg-surface-inverse/7',
                              )}
                            >
                              <div className="col-start-1 col-end-2 row-start-1 row-end-2 flex cursor-pointer items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex w-full items-center gap-2">
                                    <div className="flex min-h-6 w-full items-center gap-2">
                                      {item.icon ? (
                                        <div className="h-4 w-4 shrink-0 text-foreground-primary [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2]">
                                          {item.icon}
                                        </div>
                                      ) : null}
                                      <span className="w-full truncate text-sm text-foreground-primary">
                                        {item.title}
                                      </span>
                                    </div>
                                  </div>
                                  {item.subtitle ? (
                                    <div className="mt-0.5 line-clamp-1 text-xs text-foreground-secondary">
                                      {item.subtitleHighlightQuery
                                        ? getSearchHighlightSegments(item.subtitle, item.subtitleHighlightQuery).map(
                                            (segment, index) => (
                                              <span
                                                key={`${item.id}:subtitle:${index}:${segment.text}`}
                                                className={
                                                  segment.isMatch
                                                    ? CHAT_SEARCH_HIGHLIGHT_CLASS_NAME
                                                    : undefined
                                                }
                                              >
                                                {segment.text}
                                              </span>
                                            ),
                                          )
                                        : item.subtitle}
                                    </div>
                                  ) : null}
                                </div>
                                {item.meta ? (
                                  <span className="ms-2 hidden whitespace-nowrap text-sm text-foreground-secondary md:inline">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </div>
                            </CommandPrimitive.Item>
                          ))}
                        </CommandPrimitive.Group>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>

        <div
          className={cn(
            'relative z-0 -mt-3 flex flex-col items-start justify-between gap-4 rounded-b-xl border-t px-5 pb-4 pt-6 transition-[background-color,border-color] duration-250 ease-out sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:pb-3 sm:pt-5',
            'border-border-faint bg-surface-strong',
          )}
        >
          <div className="flex min-h-[1.25rem] min-w-0 flex-1 justify-end text-sm text-foreground-secondary">
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <div className="inline-flex items-center gap-2">
                <KbdGroup aria-hidden="true">
                  <Kbd>&uarr;</Kbd>
                  <Kbd>&darr;</Kbd>
                </KbdGroup>
                <span>Navigate</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Kbd>Enter</Kbd>
                <span>Select</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CommandDialog>
  )
}
