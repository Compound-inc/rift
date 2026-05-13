'use client'

import { ContentPage } from '@/components/layout'
import { HrCandidatesTable } from './hr-candidates-table'
import { useHrHomePageLogic } from './hr-home-page.logic'
import { HrPipelineFunnel } from './hr-pipeline-funnel'
import { HrStatCard } from './hr-stat-card'

export function HrHomePage() {
  const { stats, pipeline, insight, candidates } = useHrHomePageLogic()

  return (
    <ContentPage
      title="HR overview"
      description="Track headcount, recruitment pipeline, and recent candidate activity across your organization."
    >
      <div className="rounded-2xl border border-border-base bg-surface-strong/60 p-1.5">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <HrStatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              icon={stat.icon}
            />
          ))}
        </div>
      </div>

      <HrPipelineFunnel stages={pipeline} insight={insight} />

      <HrCandidatesTable rows={candidates} />
    </ContentPage>
  )
}
