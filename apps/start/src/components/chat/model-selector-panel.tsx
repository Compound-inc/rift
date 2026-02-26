'use client'

import * as React from 'react'
import {
  ChevronDown,
  Search,
  LayoutGrid,
  Wrench,
  Brain,
  Image,
  FileText,
} from 'lucide-react'
import { cn } from '@rift/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rift/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rift/ui/tooltip'
import { getCatalogModel, getProviderIcon } from '@/lib/ai-catalog'
import type { AiModelCatalogEntry } from '@/lib/ai-catalog/types'
import type { CatalogProviderId } from '@/lib/ai-catalog/provider-tools'

/** Display names for providers in the sidebar filter. */
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  alibaba: 'Alibaba',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  mistral: 'Mistral',
  minimax: 'MiniMax',
  moonshotai: 'Moonshot',
  xai: 'xAI',
  zai: 'Z.AI',
}

const CAPABILITY_ICONS = {
  supportsTools: Wrench,
  supportsReasoning: Brain,
  supportsImageInput: Image,
  supportsPdfInput: FileText,
} as const

const CAPABILITY_LABELS: Record<keyof typeof CAPABILITY_ICONS, string> = {
  supportsTools: 'Tools',
  supportsReasoning: 'Reasoning',
  supportsImageInput: 'Images',
  supportsPdfInput: 'PDF',
}

const CAPABILITY_ORDER: Array<keyof typeof CAPABILITY_ICONS> = [
  'supportsReasoning',
  'supportsTools',
  'supportsImageInput',
  'supportsPdfInput',
]

export type SelectableModelOption = {
  readonly id: string
  readonly name: string
}

export type ModelSelectorPanelProps = {
  value: string
  onValueChange: (modelId: string) => void
  options: readonly SelectableModelOption[]
  disabled?: boolean
  className?: string
}

/**
 * Model selector that opens a popover with search, provider filter, and model list.
 * Uses the TanStack app design tokens (bg-bg-default, text-content-default, etc.).
 */
export function ModelSelectorPanel({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: ModelSelectorPanelProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedProvider, setSelectedProvider] = React.useState<
    CatalogProviderId | 'all'
  >('all')

  const selectedCatalog = React.useMemo(
    () => (value ? getCatalogModel(value) : undefined),
    [value],
  )

  React.useEffect(() => {
    if (!open) {
      setQuery('')
    } else {
      const catalog = value ? getCatalogModel(value) : undefined
      setSelectedProvider(catalog?.providerId ?? 'all')
    }
  }, [open, value])

  const filteredModels = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const byProvider =
      selectedProvider === 'all'
        ? options
        : options.filter((o) => getCatalogModel(o.id)?.providerId === selectedProvider)
    if (!normalized) return byProvider
    return byProvider.filter((opt) => {
      const catalog = getCatalogModel(opt.id)
      const searchText = [opt.name, catalog?.description ?? '']
        .join(' ')
        .toLowerCase()
      return searchText.includes(normalized)
    })
  }, [options, query, selectedProvider])

  const providersInOptions = React.useMemo(() => {
    const set = new Set<CatalogProviderId>()
    for (const opt of options) {
      const catalog = getCatalogModel(opt.id)
      if (catalog) set.add(catalog.providerId)
    }
    return Array.from(set)
  }, [options])

  const handleSelect = React.useCallback(
    (modelId: string) => {
      onValueChange(modelId)
      setOpen(false)
    },
    [onValueChange],
  )

  const optionsById = React.useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options],
  )
  const triggerLabel =
    optionsById.get(value)?.name ??
    selectedCatalog?.name ??
    'Select model'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        tabIndex={-1}
        className={cn(
          'h-10 rounded-lg border border-transparent bg-transparent px-3 pr-8 text-sm font-medium text-content-default outline-none focus:!outline-none focus-visible:!outline-none transition-colors hover:bg-bg-inverted/5 active:bg-bg-inverted/10 focus-visible:border-border-emphasis focus-visible:ring-[3px] focus-visible:ring-border-emphasis/50 disabled:pointer-events-none disabled:opacity-50',
          'relative flex items-center gap-2 w-fit group',
          'outline-none rounded-lg [&:focus]:!outline-none [&:focus-visible]:!outline-none',
          className
        )}
        disabled={disabled}
        aria-label="Select model"
      >
        {selectedCatalog ? (() => {
          const Icon = getProviderIcon(selectedCatalog.providerId)
          return Icon ? (
            <Icon
              className={cn(
                'size-4 shrink-0 text-content-default transition-[filter]',
                'grayscale group-hover:grayscale-0',
                'grayscale-0'
              )}
              aria-hidden
            />
          ) : null
        })() : null}
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-content-muted shrink-0"
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        tabIndex={-1}
        className={cn(
          'flex h-[520px] w-[min(88vw,640px)] flex-col p-0 overflow-hidden',
          'bg-bg-default text-content-default rounded-lg',
          'outline-none focus:!outline-none focus-visible:!outline-none',
          'animate-none data-open:animate-none data-closed:animate-none'
        )}
      >
        <div
          className="flex h-full min-h-0 outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <aside
            className={cn(
              'w-[64px] py-3 overflow-y-auto shrink-0 flex flex-col items-center gap-1',
              'border-r border-border-muted',
              '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              'outline-none focus:!outline-none focus-visible:!outline-none'
            )}
            aria-label="Filter by provider"
            tabIndex={-1}
          >
            <Tooltip>
              <TooltipTrigger className="rounded-lg">
                <ProviderButton
                  isActive={selectedProvider === 'all'}
                  onClick={() => setSelectedProvider('all')}
                  label="All providers"
                >
                  <LayoutGrid className="size-5 shrink-0" aria-hidden />
                </ProviderButton>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8} pointerEventsNone>
                <p className="text-xs">All providers</p>
              </TooltipContent>
            </Tooltip>
            {providersInOptions.map((providerId) => {
                const label = PROVIDER_NAMES[providerId] ?? providerId
              return (
                <Tooltip key={providerId}>
                  <TooltipTrigger className="rounded-lg">
                    <ProviderButton
                      isActive={selectedProvider === providerId}
                      onClick={() => setSelectedProvider(providerId)}
                      label={label}
                    >
                      {(() => {
                        const Icon = getProviderIcon(providerId)
                        return Icon ? (
                          <Icon className="size-5 shrink-0" aria-hidden />
                        ) : (
                          <span className="text-xs font-medium uppercase text-content-default">
                            {providerId.slice(0, 2)}
                          </span>
                        )
                      })()}
                    </ProviderButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8} pointerEventsNone>
                    <p className="text-xs">{label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
            </aside>
            <div className="flex flex-1 flex-col min-h-0 min-w-0">
              <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0 h-[60px]">
                <Search className="size-5 text-content-muted shrink-0" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models…"
                  className="w-full bg-transparent text-sm text-content-default placeholder:text-content-muted outline-none"
                  aria-label="Search models"
                />
              </div>
              <div
                className={cn(
                  'flex-1 min-h-0 overflow-y-auto px-2 pb-3',
                  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                )}
              >
                {filteredModels.length === 0 ? (
                  <div className="py-10 text-center text-sm text-content-muted">
                    No models match your search.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredModels.map((opt) => {
                      const catalog = getCatalogModel(opt.id)
                      if (!catalog) return null
                      return (
                        <ModelRow
                          key={opt.id}
                          model={catalog}
                          displayName={opt.name}
                          isSelected={value === opt.id}
                          onSelect={handleSelect}
                          style={{
                            contentVisibility: 'auto',
                            containIntrinsicSize: '0 60px',
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ModelRowProps {
  model: AiModelCatalogEntry
  displayName: string
  isSelected: boolean
  onSelect: (id: string) => void
  style?: React.CSSProperties
}

const ModelRow = React.memo(function ModelRow({
  model,
  displayName,
  isSelected,
  onSelect,
  style,
}: ModelRowProps) {
  const capabilities = CAPABILITY_ORDER.filter(
    (key) => model.capabilities[key as keyof typeof model.capabilities],
  )

  return (
    <button
      type="button"
      onClick={() => onSelect(model.id)}
      data-active={isSelected}
      style={style}
      className={cn(
        'w-full rounded-lg border border-transparent px-3 py-3 text-left text-sm leading-none font-normal transition-[background-color,color,font-weight] duration-0 active:duration-75 group',
        'hover:bg-bg-inverted/5 active:bg-bg-inverted/10',
        'data-[active=true]:bg-bg-info/25 data-[active=true]:font-medium data-[active=true]:text-content-info',
        'data-[active=true]:hover:bg-bg-info/45 data-[active=true]:active:bg-bg-info/75',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-emphasis focus-visible:ring-[3px] focus-visible:ring-border-emphasis/50'
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 flex items-start gap-2">
          {(() => {
            const Icon = getProviderIcon(model.providerId)
            return Icon ? (
              <Icon
                className={cn(
                  'size-4 shrink-0 mt-0.5 grayscale group-hover:grayscale-0',
                  isSelected && 'grayscale-0',
                  isSelected ? 'text-content-info' : 'text-content-muted'
                )}
                aria-hidden
              />
            ) : null
          })()}
          <div className="min-w-0">
            <div className="truncate">{displayName}</div>
            <div
              className={cn(
                'text-xs line-clamp-1 mt-0.5',
                isSelected ? 'text-content-info/80' : 'text-content-muted'
              )}
            >
              {model.description}
            </div>
          </div>
        </div>
        {capabilities.length > 0 ? (
          <div className="flex items-center gap-1 shrink-0">
            {capabilities.map((key) => {
              const Icon = CAPABILITY_ICONS[key]
              const label = CAPABILITY_LABELS[key]
              return Icon ? (
                <Tooltip key={key}>
                  <TooltipTrigger>
                    <span
                      className="inline-flex size-6 items-center justify-center rounded text-content-muted hover:text-content-default outline-none"
                      aria-hidden
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} pointerEventsNone>
                    <p className="text-xs">{label}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null
            })}
          </div>
        ) : null}
      </div>
    </button>
  )
})

interface ProviderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}

const ProviderButton = React.forwardRef<HTMLButtonElement, ProviderButtonProps>(
  ({ isActive, onClick, label, children, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={label}
      data-active={isActive}
      className={cn(
        'flex size-10 items-center justify-center rounded-lg border border-transparent text-sm leading-none font-normal transition-[background-color,color,font-weight] duration-0 active:duration-75 [&_svg]:grayscale [&_svg]:transition-none hover:[&_svg]:grayscale-0',
        'text-content-muted hover:text-content-default hover:bg-bg-inverted/5 active:bg-bg-inverted/10',
        'data-[active=true]:bg-bg-info/25 data-[active=true]:font-medium data-[active=true]:text-content-info data-[active=true]:[&_svg]:grayscale-0',
        'data-[active=true]:hover:bg-bg-info/45 data-[active=true]:active:bg-bg-info/75',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-emphasis focus-visible:ring-[3px] focus-visible:ring-border-emphasis/50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
ProviderButton.displayName = 'ProviderButton'
