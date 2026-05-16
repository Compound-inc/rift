'use client'

import { ContentPage } from '@/components/layout'
import { cn } from '@rift/utils'
import { m } from '@/paraglide/messages.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import CreditCard from 'lucide-react/dist/esm/icons/credit-card'
import Scale from 'lucide-react/dist/esm/icons/scale'

export function HrBackgroundCheckOverviewPage() {
  return (
    <ContentPage
      title={m.hr_background_check_title()}
      description={m.hr_background_check_description()}
    >
      <section
        aria-label="Provider"
        className="rounded-xl border border-border-base bg-surface-overlay p-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-foreground-info" aria-hidden />
          <h2 className="text-sm font-medium text-foreground-strong">
            {m.hr_background_check_provider_title()}
          </h2>
        </div>
        <p className="mt-1 text-xs text-foreground-tertiary">
          {m.hr_background_check_provider_description()}
        </p>
      </section>

      <section
        aria-label="Sample dossier"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <DossierCard
          icon={CreditCard}
          title={m.hr_background_check_credit_standing_title()}
          summary={m.hr_background_check_credit_standing_summary()}
          tone="info"
        />
        <DossierCard
          icon={Scale}
          title={m.hr_background_check_legal_regulatory_title()}
          summary={m.hr_background_check_legal_regulatory_summary()}
          tone="success"
        />
      </section>

      <section
        aria-label="What happens next"
        className="rounded-xl border border-border-base bg-surface-overlay p-4 text-sm text-foreground-primary"
      >
        <h2 className="font-medium text-foreground-strong">
          {m.hr_background_check_how_it_works_title()}
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground-secondary">
          <li>{m.hr_background_check_step_1()}</li>
          <li>{m.hr_background_check_step_2()}</li>
          <li>{m.hr_background_check_step_3()}</li>
        </ol>
      </section>
    </ContentPage>
  )
}

function DossierCard({
  icon: Icon,
  title,
  summary,
  tone,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  summary: string
  tone: 'info' | 'success'
}) {
  return (
    <div className="rounded-xl border border-border-base bg-surface-raised p-4">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          className={cn(
            'size-4',
            tone === 'info' && 'text-foreground-info',
            tone === 'success' && 'text-foreground-success',
          )}
        />
        <h3 className="text-sm font-medium text-foreground-strong">{title}</h3>
      </div>
      <p className="mt-1 text-xs text-foreground-tertiary">{summary}</p>
    </div>
  )
}
