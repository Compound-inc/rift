'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import {
  BrainIcon,
  Grid3X3Icon,
  ImageIcon,
  SearchIcon,
  WrenchIcon,
  FileTextIcon,
  CheckIcon,
  ChevronDownIcon,
} from 'lucide-react'

type ChatModelOption = {
  readonly id: string
  readonly name: string
  readonly providerId: string
  readonly description: string
  readonly capabilities: {
    readonly supportsReasoning: boolean
    readonly supportsTools: boolean
    readonly supportsImageInput: boolean
    readonly supportsPdfInput: boolean
  }
}

type ProviderTab = 'all' | 'search' | string

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
  moonshotai: 'Moonshot',
  zai: 'Z.AI',
  alibaba: 'Alibaba',
  minimax: 'MiniMax',
  meta: 'Meta',
}

const capabilityIcons = [
  { key: 'supportsReasoning', Icon: BrainIcon, label: 'Reasoning' },
  { key: 'supportsTools', Icon: WrenchIcon, label: 'Tools' },
  { key: 'supportsImageInput', Icon: ImageIcon, label: 'Image input' },
  { key: 'supportsPdfInput', Icon: FileTextIcon, label: 'PDF input' },
] as const

/** Resolves human-friendly provider labels while preserving unknown provider ids. */
function providerLabel(providerId: string): string {
  return providerNames[providerId] ?? providerId
}

/** Builds short provider badges so the sidebar remains compact without external icon assets. */
function providerInitials(providerId: string): string {
  const label = providerLabel(providerId)
  const tokens = label
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean)

  if (tokens.length === 0) return label.slice(0, 2).toUpperCase()
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase()
}

/**
 * Chat model picker inspired by the Next app panel: provider tabs, search-first filtering,
 * and capability indicators while staying on shared Start design tokens.
 */
export function ModelSelectorMenu({
  value,
  options,
  disabled,
  onValueChange,
}: {
  value: string
  options: readonly ChatModelOption[]
  disabled?: boolean
  onValueChange: (modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<ProviderTab>('all')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selectedModel = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  )

  const providerIds = useMemo(
    () => [...new Set(options.map((option) => option.providerId))],
    [options],
  )

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return options.filter((option) => {
      if (activeTab !== 'all' && activeTab !== 'search' && option.providerId !== activeTab) {
        return false
      }

      if (!normalizedQuery) return true

      return (
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.description.toLowerCase().includes(normalizedQuery) ||
        providerLabel(option.providerId).toLowerCase().includes(normalizedQuery)
      )
    })
  }, [activeTab, options, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    if (selectedModel) {
      setActiveTab(selectedModel.providerId)
      return
    }

    setActiveTab('all')
  }, [open, selectedModel])

  // Keep the menu interaction predictable by closing it when users click outside the panel.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const handleSelect = useCallback(
    (modelId: string) => {
      onValueChange(modelId)
      setOpen(false)
    },
    [onValueChange],
  )

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="default"
        disabled={disabled}
        onClick={() => setOpen((previousOpen) => !previousOpen)}
        className="max-w-[240px] justify-between gap-2 border border-border-default bg-bg-default hover:bg-bg-subtle"
      >
        <span className="truncate text-xs text-content-emphasis">
          {selectedModel?.name ?? 'Select model'}
        </span>
        <ChevronDownIcon className={cn('size-3 text-content-muted transition-transform', open && 'rotate-180')} />
      </Button>

      {open ? (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-40 h-[420px] w-[min(88vw,640px)] overflow-hidden rounded-xl border border-border-default bg-bg-default shadow-xl">
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border-subtle px-3 py-2">
            <label className="flex items-center gap-2 text-content-muted">
              <SearchIcon className="size-4" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveTab('search')
                }}
                placeholder="Search models"
                aria-label="Search models"
                className="w-full border-0 bg-transparent text-sm text-content-default outline-none placeholder:text-content-muted"
              />
            </label>
          </div>

          <div className="flex h-[calc(100%-48px)] min-h-0">
            <aside className="w-16 border-r border-border-subtle py-2">
              <div className="flex flex-col items-center gap-1">
                <ProviderTabButton
                  label="All providers"
                  isActive={activeTab === 'all'}
                  onClick={() => setActiveTab('all')}
                >
                  <Grid3X3Icon className="size-4" />
                </ProviderTabButton>
                <ProviderTabButton
                  label="Search"
                  isActive={activeTab === 'search'}
                  onClick={() => setActiveTab('search')}
                >
                  <SearchIcon className="size-4" />
                </ProviderTabButton>
                {providerIds.map((providerId) => (
                  <ProviderTabButton
                    key={providerId}
                    label={providerLabel(providerId)}
                    isActive={activeTab === providerId}
                    onClick={() => setActiveTab(providerId)}
                  >
                    <span className="text-[10px] font-semibold">
                      {providerInitials(providerId)}
                    </span>
                  </ProviderTabButton>
                ))}
              </div>
            </aside>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredModels.length === 0 ? (
                <div className="py-10 text-center text-sm text-content-muted">
                  No models match your search.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredModels.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        'w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors',
                        'hover:border-border-default hover:bg-bg-subtle',
                        option.id === value && 'border-border-default bg-bg-subtle',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-content-emphasis">
                            {option.name}
                          </p>
                          <p className="truncate text-xs text-content-muted">
                            {providerLabel(option.providerId)} · {option.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-content-muted">
                          {capabilityIcons.map(({ key, Icon, label }) =>
                            option.capabilities[key] ? (
                              <span
                                key={key}
                                title={label}
                                className="inline-flex size-5 items-center justify-center rounded-full bg-bg-muted"
                              >
                                <Icon className="size-3" />
                              </span>
                            ) : null,
                          )}
                          {option.id === value ? <CheckIcon className="size-4 text-content-info" /> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Reusable provider tab button to keep selection affordances consistent across all tabs. */
function ProviderTabButton({
  children,
  isActive,
  label,
  onClick,
}: {
  children: ReactNode
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-10 items-center justify-center rounded-lg border text-content-subtle transition-colors',
        isActive
          ? 'border-border-default bg-bg-subtle text-content-emphasis'
          : 'border-transparent hover:border-border-subtle hover:bg-bg-subtle/80',
      )}
    >
      {children}
    </button>
  )
}
