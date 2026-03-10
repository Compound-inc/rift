'use client'

import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import {
  enterprisePlan,
  mainPlans,
  selfHostingPlan,
} from '@/lib/pricing'
import type { LandingPlan } from '@/lib/pricing'
import {
  CardDashedBorder,
  DashedBorderFrame,
  GradientBackground,
} from './pricing-decorative'
import type { PricingPlanActionOverride } from './pricing-card'

type ComparisonCell = string | boolean

type ComparisonRow = {
  label: string
  values: ComparisonCell[]
}

type ComparisonSection = {
  title: string
  rows: ComparisonRow[]
}

type ComparisonPlan = Pick<
  LandingPlan,
  'name' | 'buttonText' | 'href' | 'gradientId'
>

/**
 * The matrix only compares the paid and custom plans. Free stays out of the
 * sticky header to keep the horizontal width focused on the tiers users are
 * actually choosing between at upgrade time.
 */
const comparisonPlans: ComparisonPlan[] = [
  ...mainPlans
    .filter((plan) => plan.name !== 'Free')
    .map(({ name, buttonText, href, gradientId }) => ({
      name,
      buttonText,
      href,
      gradientId,
    })),
  {
    name: enterprisePlan.name,
    buttonText: enterprisePlan.buttonText,
    href: enterprisePlan.href,
    gradientId: enterprisePlan.gradientId,
  },
  {
    name: selfHostingPlan.name,
    buttonText: selfHostingPlan.buttonText,
    href: selfHostingPlan.href,
    gradientId: selfHostingPlan.gradientId,
  },
]

/**
 * The matrix focuses on meaningful differences between paid tiers. Plus is the
 * baseline paid plan, Scale is the high-headroom option, and the custom plans
 * keep their tailored deployment and security language.
 */
const comparisonSections: ComparisonSection[] = [
  {
    title: 'Essentials',
    rows: [
      {
        label: 'Monthly limits',
        values: [
          'Expanded',
          '5x Plus',
          '10x Plus',
          'Custom usage',
          'Custom usage',
        ],
      },
      {
        label: 'Image generation',
        values: [
          'Included',
          'Higher limits',
          'Highest limits',
          'Custom',
          'Custom',
        ],
      },
      {
        label: 'Chat history',
        values: [
          'Unlimited',
          'Unlimited',
          'Unlimited',
          'Unlimited',
          'Unlimited',
        ],
      },
      {
        label: 'Access on web, iOS, Android',
        values: [true, true, true, true, true],
      },
      {
        label: 'Priority support',
        values: [false, true, true, true, true],
      },
    ],
  },
  {
    title: 'Workspace',
    rows: [
      {
        label: 'Model access',
        values: [
          'All models',
          'All models',
          'All models',
          'Custom catalog',
          'Custom deployment',
        ],
      },
      {
        label: 'File storage',
        values: [
          'Included',
          'Higher limits',
          'Highest limits',
          'Custom',
          'Custom',
        ],
      },
      {
        label: 'Memory & projects',
        values: [true, true, true, true, true],
      },
      {
        label: 'Team management',
        values: [true, true, true, true, true],
      },
      {
        label: 'SSO',
        values: [false, false, true, true, true],
      },
      {
        label: 'Directory Sync',
        values: [false, false, false, true, true],
      },
      {
        label: 'SIEM',
        values: [false, false, false, true, true],
      },
      {
        label: 'Usage Analytics',
        values: [false, false, false, true, true],
      },
      {
        label: 'Audit logs',
        values: [false, false, false, true, true],
      },
      {
        label: 'Context window',
        values: ['Standard', 'Expanded', 'Expanded', 'Custom', 'Custom'],
      },
      {
        label: 'Deployment',
        values: [
          'Rift cloud',
          'Rift cloud',
          'Rift cloud',
          'Rift cloud',
          'Private infrastructure',
        ],
      },
      {
        label: 'Technical onboarding',
        values: [false, false, false, true, true],
      },
    ],
  },
]

/**
 * Renders a comparison cell value. String values wrap to multiple lines;
 * booleans render as check or dash.
 */
function ComparisonValue({ value }: { value: ComparisonCell }) {
  if (typeof value === 'boolean') {
    if (!value) {
      return <span className="text-content-subtle">-</span>
    }

    return (
      <span className="inline-flex items-center justify-center text-content-emphasis">
        <Check aria-hidden="true" className="size-4" />
        <span className="sr-only">Included</span>
      </span>
    )
  }

  return (
    <span className="block break-words whitespace-normal text-center">
      {value}
    </span>
  )
}

/**
 * Sticky comparison table that reuses the pricing-card border language. The
 * outer frame mirrors the card grid, while each sticky plan header is rendered
 * as a compact card so the section feels like part of the same pricing system.
 */
export function PricingComparisonTable(props: {
  resolvePlanAction?: (planName: string) => PricingPlanActionOverride | undefined
}) {
  return (
    <>
      <style>{`
        /**
         * Compact plan headers need the same restrained gradient wash as the
         * pricing cards, but the styling stays local so the table does not rely
         * on CSS declared in pricing-section.tsx.
         */
        .pricing-comparison__orb {
          opacity: 0.34;
          filter: saturate(1.08) brightness(0.98);
        }

        .dark .pricing-comparison__orb {
          opacity: 0.3;
          filter: saturate(1.08) brightness(1.05);
        }
      `}</style>

      <section
        aria-label="Pricing comparison"
        className="mx-auto mt-16 w-full max-w-[1400px]"
      >
        <div className="relative mx-auto w-full max-md:px-4 max-md:py-4 max-lg:p-4 lg:p-12">
          <DashedBorderFrame>
            <div className="relative max-lg:mx-3.5 max-lg:my-3.5">
              <div className="">
                <table className="w-full min-w-[1120px] table-fixed border-collapse text-center text-sm text-content-default">
                  <colgroup>
                    <col className="w-[280px]" style={{ width: 280 }} />
                    {comparisonPlans.map((plan) => (
                      <col
                        key={plan.name}
                        style={{
                          width: `calc((100% - 280px) / ${comparisonPlans.length})`,
                        }}
                      />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        colSpan={comparisonPlans.length + 1}
                        className="sticky top-16 z-30 bg-bg-default/96 px-0 align-top backdrop-blur-md"
                      >
                        <div className="relative flex min-h-[100px] w-full bg-bg-default">
                          <CardDashedBorder />
                          <div className="flex w-full">
                            <div className="w-[280px] flex-shrink-0 px-6 pb-3 pt-6">
                              <span className="sr-only">Feature comparison</span>
                            </div>
                            <div
                              className="grid flex-1 gap-0"
                              style={{
                                gridTemplateColumns: `repeat(${comparisonPlans.length}, minmax(0, 1fr))`,
                              }}
                            >
                              {comparisonPlans.map((plan) => {
                                const actionOverride = props.resolvePlanAction?.(plan.name)
                                const buttonText = actionOverride?.buttonText ?? plan.buttonText
                                const href = actionOverride?.href ?? plan.href
                                const isDisabled = actionOverride?.disabled ?? false
                                const handleSelect = actionOverride?.onSelect

                                return (
                                  <div
                                    key={plan.name}
                                    className="relative px-4 py-3"
                                  >
                                    <GradientBackground
                                      id={plan.gradientId}
                                      className="pricing-comparison__orb"
                                    />

                                    <div className="relative z-[1] flex h-full flex-col items-center gap-3">
                                      <span className="text-lg font-medium tracking-tight text-content-emphasis">
                                        {plan.name}
                                      </span>
                                      {handleSelect ? (
                                        <Button
                                          variant="outline"
                                          size="default"
                                          className="mt-auto"
                                          type="button"
                                          disabled={isDisabled}
                                          onClick={() => void handleSelect()}
                                        >
                                          {buttonText}
                                        </Button>
                                      ) : href.startsWith('mailto:') ? (
                                        <Button
                                          variant="outline"
                                          size="default"
                                          className="mt-auto"
                                          asChild
                                        >
                                          <a href={href}>
                                            {buttonText}
                                          </a>
                                        </Button>
                                      ) : isDisabled ? (
                                        <Button
                                          variant="outline"
                                          size="default"
                                          className="mt-auto"
                                          type="button"
                                          disabled
                                        >
                                          {buttonText}
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="default"
                                          className="mt-auto"
                                          asChild
                                        >
                                          <Link to={href}>
                                            {buttonText}
                                          </Link>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {comparisonSections.map((section, sectionIndex) => (
                      <Fragment key={section.title}>
                        <tr>
                          <th
                            colSpan={comparisonPlans.length + 1}
                            className={cn(
                              'px-6 pb-5 text-left text-2xl font-semibold text-content-emphasis',
                              sectionIndex === 0 ? 'pt-2' : 'pt-8',
                            )}
                          >
                            {section.title}
                          </th>
                        </tr>

                        {section.rows.map((row) => (
                          <tr key={`${section.title}-${row.label}`}>
                            <th
                              scope="row"
                              className="w-[280px] max-w-[280px] border-b border-border-default/70 px-6 py-5 text-left align-top font-medium text-content-emphasis break-words whitespace-normal"
                            >
                              {row.label}
                            </th>
                            {row.values.map((value, index) => (
                              <td
                                key={`${row.label}-${comparisonPlans[index]?.name ?? index}`}
                                className="border-b border-border-default/70 px-5 py-5 align-top break-words"
                              >
                                <ComparisonValue value={value} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DashedBorderFrame>
        </div>
      </section>
    </>
  )
}
