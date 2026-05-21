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
import { Popover, PopoverContent, PopoverTrigger } from '@rift/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import { getCatalogModel, getProviderIcon } from '@/lib/shared/ai-catalog'
import { getModelCostTier } from '@/lib/shared/ai-catalog/cost-tier'
import type { AiModelCostTier } from '@/lib/shared/ai-catalog/cost-tier'
import type { AiModelCatalogEntry } from '@/lib/shared/ai-catalog/types'
import type { CatalogProviderId } from '@/lib/shared/ai-catalog/provider-tools'
import type {PaidWorkspacePlanId} from '@/lib/shared/access-control';
import { getLocalizedFeatureAccessGateMessage } from '@/lib/frontend/access-control'
import { m } from '@/paraglide/messages.js'

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

const CAPABILITY_ORDER: Array<keyof typeof CAPABILITY_ICONS> = [
  'supportsReasoning',
  'supportsTools',
  'supportsImageInput',
  'supportsPdfInput',
]

/**
 * Visual recipe per cost tier. The indicator renders three slots that are
 * either filled with a colored "$" or a muted dot, plus an optional trailing
 * "+" so the most expensive tier reads as "off the scale". Colors progress
 * from muted gray (cheapest) through emerald/amber/orange to red, giving both
 * a length and a hue gradient.
 */
const COST_TIER_VISUALS: Record<
  AiModelCostTier,
  {
    /** Number of "$" glyphs to render in the three-slot indicator. */
    readonly dollarCount: 0 | 1 | 2 | 3
    /** Tailwind classes applied to the colored "$" glyphs only. */
    readonly colorClass: string
    /** When true, render a trailing "+" after the three slots. */
    readonly overflow: boolean
  }
> = {
  very_low: {
    dollarCount: 0,
    colorClass: '',
    overflow: false,
  },
  low: {
    dollarCount: 1,
    colorClass: 'text-emerald-700/85 dark:text-emerald-400/80',
    overflow: false,
  },
  medium: {
    dollarCount: 2,
    colorClass: 'text-amber-600/85 dark:text-amber-400/80',
    overflow: false,
  },
  high: {
    dollarCount: 3,
    colorClass: 'text-orange-600/85 dark:text-orange-400/80',
    overflow: false,
  },
  very_high: {
    dollarCount: 3,
    colorClass: 'text-red-600/85 dark:text-red-400',
    overflow: true,
  },
}

const COST_TIER_SLOT_COUNT = 3

export type SelectableModelOption = {
  readonly id: string
  readonly name: string
  readonly locked?: boolean
  readonly minimumPlanId?: PaidWorkspacePlanId
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
  const capabilityLabels: Record<keyof typeof CAPABILITY_ICONS, string> = {
    supportsTools: m.chat_model_capability_tools(),
    supportsReasoning: m.chat_model_capability_reasoning(),
    supportsImageInput: m.chat_model_capability_images(),
    supportsPdfInput: m.chat_model_capability_pdf(),
  }
  const costTierLabels: Record<AiModelCostTier, string> = {
    very_low: m.chat_model_cost_very_low(),
    low: m.chat_model_cost_low(),
    medium: m.chat_model_cost_medium(),
    high: m.chat_model_cost_high(),
    very_high: m.chat_model_cost_very_high(),
  }

  const selectedCatalog = React.useMemo(
    () => (value ? getCatalogModel(value) : undefined),
    [value],
  )
  const selectedCostTier = React.useMemo(
    () => (selectedCatalog ? getModelCostTier(selectedCatalog) : undefined),
    [selectedCatalog],
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
        : options.filter(
            (o) => getCatalogModel(o.id)?.providerId === selectedProvider,
          )
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
    optionsById.get(value)?.name ?? selectedCatalog?.name ?? m.chat_model_select_trigger()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        tabIndex={-1}
        className={cn(
          'h-10 rounded-lg border border-transparent bg-transparent px-3 ltr:pr-8 rtl:pl-8 text-sm font-normal text-foreground-primary outline-none focus:!outline-none focus-visible:!outline-none transition-colors hover:bg-surface-inverse/5 active:bg-surface-inverse/10 focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50 disabled:pointer-events-none disabled:opacity-50',
          'relative flex items-center gap-2 w-fit group',
          'outline-none rounded-lg [&:focus]:!outline-none [&:focus-visible]:!outline-none',
          className,
        )}
        disabled={disabled}
        aria-label={m.chat_model_select_aria_label()}
      >
        {selectedCatalog
          ? (() => {
              const Icon = getProviderIcon(selectedCatalog.providerId)
              return Icon ? (
                <Icon
                  className={cn(
                    'size-4 shrink-0 text-foreground-primary transition-[filter]',
                    'grayscale group-hover:grayscale-0',
                    'grayscale-0',
                  )}
                  aria-hidden
                />
              ) : null
            })()
          : null}
        <span className="truncate font-normal">{triggerLabel}</span>
        {selectedCostTier ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded outline-none"
                  aria-label={costTierLabels[selectedCostTier]}
                  data-cost-tier={selectedCostTier}
                >
                  <CostTierIndicator tier={selectedCostTier} />
                </span>
              }
            />
            <TooltipContent side="top" sideOffset={8}>
              <p className="text-xs">{costTierLabels[selectedCostTier]}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
        <ChevronDown
          className="pointer-events-none absolute ltr:right-2 rtl:left-2 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary shrink-0"
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
          'bg-surface-base text-foreground-primary rounded-lg',
          'outline-none focus:!outline-none focus-visible:!outline-none',
          'animate-none data-open:animate-none data-closed:animate-none',
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
              'ltr:border-r rtl:border-l border-border-light',
              '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              'outline-none focus:!outline-none focus-visible:!outline-none',
            )}
            aria-label={m.chat_model_filter_by_provider_aria_label()}
            tabIndex={-1}
          >
            <Tooltip>
              <TooltipTrigger
                className="rounded-lg"
                render={
                  <ProviderButton
                    isActive={selectedProvider === 'all'}
                    onClick={() => setSelectedProvider('all')}
                    label={m.chat_model_all_providers()}
                  >
                    <LayoutGrid className="size-5 shrink-0" aria-hidden />
                  </ProviderButton>
                }
              />
              <TooltipContent side="inline-start" sideOffset={8}>
                <p className="text-xs">{m.chat_model_all_providers()}</p>
              </TooltipContent>
            </Tooltip>
            {providersInOptions.map((providerId) => {
              const label = PROVIDER_NAMES[providerId] ?? providerId
              return (
                <Tooltip key={providerId}>
                  <TooltipTrigger
                    className="rounded-lg"
                    render={
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
                            <span className="text-xs font-medium uppercase text-foreground-primary">
                              {providerId.slice(0, 2)}
                            </span>
                          )
                        })()}
                      </ProviderButton>
                    }
                  />
                  <TooltipContent side="inline-start" sideOffset={8}>
                    <p className="text-xs">{label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </aside>
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0 h-[60px]">
              <Search
                className="size-5 text-foreground-secondary shrink-0"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={m.chat_model_search_placeholder()}
                className="w-full bg-transparent text-sm text-foreground-primary placeholder:text-foreground-secondary outline-none"
                aria-label={m.chat_model_search_aria_label()}
              />
            </div>
            <div
              className={cn(
                'flex-1 min-h-0 overflow-y-auto px-2 pb-3',
                '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              )}
            >
              {filteredModels.length === 0 ? (
                <div className="py-10 text-center text-sm text-foreground-secondary">
                  {m.chat_model_no_search_results()}
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
                        locked={opt.locked}
                        minimumPlanId={opt.minimumPlanId}
                        onSelect={handleSelect}
                        capabilityLabels={capabilityLabels}
                        costTierLabels={costTierLabels}
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
  locked?: boolean
  minimumPlanId?: PaidWorkspacePlanId
  onSelect: (id: string) => void
  capabilityLabels: Record<keyof typeof CAPABILITY_ICONS, string>
  costTierLabels: Record<AiModelCostTier, string>
  style?: React.CSSProperties
}

const ModelRow = React.memo(function ModelRow({
  model,
  displayName,
  isSelected,
  locked = false,
  minimumPlanId,
  onSelect,
  capabilityLabels,
  costTierLabels,
  style,
}: ModelRowProps) {
  const capabilities = CAPABILITY_ORDER.filter(
    (key) => model.capabilities[key as keyof typeof model.capabilities],
  )
  const costTier = getModelCostTier(model)
  const costTierLabel = costTier ? costTierLabels[costTier] : null

  const buttonContent = (
    <button
      type="button"
      onClick={() => {
        if (locked) return
        onSelect(model.id)
      }}
      data-active={isSelected}
      disabled={locked}
      style={locked ? undefined : style}
      className={cn(
        'w-full rounded-lg border border-transparent px-3 py-3 text-start text-sm leading-none font-normal transition-[background-color,color,font-weight] duration-0 active:duration-75 group',
        'hover:bg-surface-inverse/5 active:bg-surface-inverse/10',
        'data-[active=true]:bg-surface-info/25 data-[active=true]:font-medium data-[active=true]:text-foreground-info',
        'data-[active=true]:hover:bg-surface-info/45 data-[active=true]:active:bg-surface-info/75',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-inverse/5 disabled:active:bg-surface-inverse/5',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50',
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
                  isSelected ? 'text-foreground-info' : 'text-foreground-secondary',
                )}
                aria-hidden
              />
            ) : null
          })()}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">{displayName}</span>
              {costTier && costTierLabel ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className="inline-flex shrink-0 items-center justify-center rounded outline-none"
                        aria-label={costTierLabel}
                        data-cost-tier={costTier}
                      >
                        <CostTierIndicator tier={costTier} />
                      </span>
                    }
                  />
                  <TooltipContent side="top" sideOffset={8}>
                    <p className="text-xs">{costTierLabel}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <div
              className={cn(
                'text-xs line-clamp-1 mt-0.5',
                isSelected ? 'text-foreground-info/80' : 'text-foreground-secondary',
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
              const label = capabilityLabels[key]
              return Icon ? (
                <Tooltip key={key}>
                  <TooltipTrigger
                    render={
                      <span
                        className="inline-flex size-6 items-center justify-center rounded text-foreground-secondary hover:text-foreground-primary outline-none"
                        aria-hidden
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                    }
                  />
                  <TooltipContent side="top" sideOffset={8}>
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

  if (locked && minimumPlanId) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="w-full" style={style}>
              {buttonContent}
            </div>
          }
        />
        <TooltipContent side="top" sideOffset={8}>
          <p className="text-xs">
            {getLocalizedFeatureAccessGateMessage(minimumPlanId)}
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return buttonContent
})

/**
 * Renders the three-slot "$$$" cost indicator for a single tier. Filled slots
 * use the tier's color class; remaining slots fall back to a muted middle dot.
 * The trailing "+" appears only for the highest tier so users see at a glance
 * that costs run beyond the rest of the catalog.
 */
function CostTierIndicator({ tier }: { tier: AiModelCostTier }) {
  const visual = COST_TIER_VISUALS[tier]
  const slots = Array.from({ length: COST_TIER_SLOT_COUNT }, (_, index) =>
    index < visual.dollarCount ? '$' : '·',
  )
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-0 font-mono text-xs font-semibold tabular-nums tracking-tight text-foreground-secondary/70"
    >
      {slots.map((glyph, index) => (
        <span
          key={index}
          className={glyph === '$' ? visual.colorClass : undefined}
        >
          {glyph}
        </span>
      ))}
      {visual.overflow ? <span>+</span> : null}
    </span>
  )
}

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
        'text-foreground-secondary hover:text-foreground-primary hover:bg-surface-inverse/5 active:bg-surface-inverse/10',
        'data-[active=true]:bg-surface-info/25 data-[active=true]:font-medium data-[active=true]:text-foreground-info data-[active=true]:[&_svg]:grayscale-0',
        'data-[active=true]:hover:bg-surface-info/45 data-[active=true]:active:bg-surface-info/75',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
ProviderButton.displayName = 'ProviderButton'
