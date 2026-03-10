'use client'

import type { ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import type { LandingPlan, FeatureIconId } from '@/lib/pricing'
import {
  StandarIcon,
  PremiumIcon,
  AIModelsIcon,
  SoporteIcon,
  ExpandIcon,
  SSOIcon,
  LogsIcon,
  TeamsIcon,
  DirectorySyncIcon,
  OnboardingIcon,
  MessageIcon,
  ImageIcon,
  AnalyticsIcon,
} from './pricing-icons'
import { CardDashedBorder, GradientBackground } from './pricing-decorative'
import { Check, ShieldCheck } from 'lucide-react'
import { cn } from '@rift/utils'

/** Maps FeatureIconId to the icon component. No arrow icons; each feature has a semantic icon. */
const FEATURE_ICON_MAP: Record<
  FeatureIconId,
  ComponentType<{ className?: string }>
> = {
  standard: StandarIcon,
  premium: PremiumIcon,
  'ai-models': AIModelsIcon,
  support: SoporteIcon,
  expand: ExpandIcon,
  sso: SSOIcon,
  logs: LogsIcon,
  teams: TeamsIcon,
  shield: ShieldCheck,
  check: Check,
  'directory-sync': DirectorySyncIcon,
  onboarding: OnboardingIcon,
  analytics: AnalyticsIcon,
  image: ImageIcon,
  message: MessageIcon,
}

const priceFormatters: Record<string, Intl.NumberFormat> = {}

function formatPrice(amount: number, currency: string, locale: string) {
  const localeTag = locale === 'es' ? 'es-MX' : 'en-US'
  const hasDecimals = amount % 1 !== 0
  const key = `${currency}-${localeTag}-${hasDecimals ? '2' : '0'}`
  if (!priceFormatters[key]) {
    priceFormatters[key] = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    })
  }
  return priceFormatters[key].format(amount)
}

export type PricingCardProps = {
  plan: LandingPlan
  locale?: string
  /** When true, uses fixed width for secondary row (Enterprise, Self-hosting). */
  fixedWidth?: boolean
  actionOverride?: PricingPlanActionOverride
}

export type PricingPlanActionOverride = {
  buttonText?: string
  href?: string
  disabled?: boolean
  description?: string
  onSelect?: () => void | Promise<void>
}

/**
 * Single pricing plan card. Renders name, price, description, features, and CTA.
 * Supports main plans (with formatted price and period) and secondary plans
 * (Enterprise, Self-hosting) with "Custom" pricing.
 */
export function PricingCard({
  plan,
  locale = 'en',
  fixedWidth = false,
  actionOverride,
}: PricingCardProps) {
  const useUsd =
    locale === 'en' && plan.usdPriceAmount != null && plan.priceAmount != null
  const amount = useUsd ? plan.usdPriceAmount! : plan.priceAmount
  const currency = useUsd ? 'USD' : plan.currency
  const periodLabel =
    useUsd && plan.billingPeriodLabelEn
      ? plan.billingPeriodLabelEn
      : plan.billingPeriodLabel
  const formattedPrice =
    amount !== null ? formatPrice(amount, currency, locale) : 'Custom'
  const period = periodLabel ? `/${periodLabel}` : ''

  const buttonText = actionOverride?.buttonText ?? plan.buttonText
  const href = actionOverride?.href ?? plan.href
  const isDisabled = actionOverride?.disabled ?? false
  const helperDescription = actionOverride?.description
  const handleSelect = actionOverride?.onSelect

  return (
    <article
      aria-labelledby={`plan-${plan.name.toLowerCase()}-title`}
      className={cn(
        // The pricing section applies scoped hover animations to this class so the
        // decorative SVG can intensify and drift without affecting other cards.
        'pricing-card group/pricing-card relative z-[2] flex flex-col items-center gap-6 overflow-hidden bg-bg-default px-6 py-12',
        fixedWidth ? 'w-[320px] flex-shrink-0' : 'w-full',
      )}
    >
      <CardDashedBorder />
      <GradientBackground
        id={plan.gradientId}
        className="pricing-card__orb"
      />

      {plan.popular ? (
        <div className="absolute top-4 rounded-full bg-content-emphasis px-3 py-1 text-xs font-bold uppercase tracking-wide text-content-inverted dark:bg-content-inverted dark:text-content-emphasis">
          Most Popular
        </div>
      ) : null}

      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <h3
          id={`plan-${plan.name.toLowerCase()}-title`}
          className="text-2xl font-medium leading-6 tracking-tight text-content-emphasis"
        >
          {plan.name}
        </h3>
        <div className="flex items-baseline justify-center text-content-emphasis">
          <span className="text-4xl font-bold tracking-tight">
            {formattedPrice}
          </span>
          {period && amount !== null && (
            <span className="ml-1 text-sm font-medium opacity-60">{period}</span>
          )}
        </div>
        <p className="max-w-[280px] text-sm leading-6 tracking-tight text-content-muted">
          {plan.description}
        </p>
      </div>

      <ul
        className="flex-1 w-full max-w-[280px] space-y-4"
        aria-label={`Features of ${plan.name}`}
      >
        {plan.featureIntro ? (
          <li className="pb-1 text-sm leading-6 text-content-muted">
            {plan.featureIntro}
          </li>
        ) : null}
        {plan.features.map((feature) => {
          const Icon = FEATURE_ICON_MAP[feature.iconId]
          return (
            <li
              key={feature.text}
              className="flex items-center text-content-default"
            >
              <div className="mr-3 shrink-0">
                <Icon
                  className={cn('h-5 w-5 text-content-emphasis opacity-80')}
                />
              </div>
              <span className="text-sm">{feature.text}</span>
            </li>
          )
        })}
      </ul>

      <footer className="mt-auto w-full max-w-[280px]">
        {handleSelect ? (
          <Button
            variant="outline"
            size="large"
            className="w-full"
            type="button"
            disabled={isDisabled}
            onClick={() => void handleSelect()}
          >
            {buttonText}
          </Button>
        ) : href.startsWith('mailto:') ? (
          <Button variant="outline" size="large" className="w-full" asChild>
            <a href={href}>{buttonText}</a>
          </Button>
        ) : isDisabled ? (
          <Button
            variant="outline"
            size="large"
            className="w-full"
            type="button"
            disabled
          >
            {buttonText}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="large"
            className="w-full"
            asChild
          >
            <Link to={href}>{buttonText}</Link>
          </Button>
        )}
        {helperDescription ? (
          <p className="mt-2 text-center text-xs text-content-muted">
            {helperDescription}
          </p>
        ) : null}
      </footer>
    </article>
  )
}
