'use client'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'

export function InsightPage() {
  return (
    <ContentPage
      title={m.insight_page_title()}
      description={m.insight_page_description()}
    >
      <p className="text-sm text-foreground-secondary">{m.app_coming_soon_with_dot()}</p>
    </ContentPage>
  )
}
