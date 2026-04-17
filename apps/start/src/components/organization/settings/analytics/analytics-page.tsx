'use client'

import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { useChatPolicySettings } from '../chat-policy/use-chat-policy-settings'

/** Flag keys stored in org policy complianceFlags for analytics extraction features. */
const TOPIC_EXTRACTION_FLAG = 'topic_extraction_enabled' as const
const SENTIMENT_EMOTION_FLAG = 'sentiment_emotion_extraction_enabled' as const
const INTENTION_EXTRACTION_FLAG = 'intention_extraction_enabled' as const

/**
 * Analytics & Insights settings page.
 * Extraction toggles (topic, sentiment/emotion, intention) are disabled by default.
 * Contact Rift support to enable. Analytics are org-internal only, not shared externally.
 */
export function AnalyticsPage() {
  const { payload, error, update } = useChatPolicySettings()
  const flags = payload.policy.complianceFlags ?? {}

  return (
    <ContentPage
      title={m.org_analytics_page_title()}
      description={m.org_analytics_page_description()}
    >
      {error && (
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <Form
        title={m.org_analytics_section_title()}
        description={m.org_analytics_section_description()}
        helpText={m.org_analytics_section_help()}
        helpLearnMoreHref="mailto:enterprise@rift.mx"
        helpLearnMoreLabel={m.org_analytics_section_contact_link()}
        toggleSection={{
          sectionTitle: m.org_analytics_section_toggle_title(),
          items: [
            {
              id: TOPIC_EXTRACTION_FLAG,
              title: m.org_analytics_topic_extraction_title(),
              description: m.org_analytics_topic_extraction_description(),
              checked: Boolean(flags[TOPIC_EXTRACTION_FLAG]),
              onCheckedChange: (enabled) =>
                void update({
                  action: 'toggle_compliance_flag',
                  flag: TOPIC_EXTRACTION_FLAG,
                  enabled,
                }),
              disabled: true,
            },
            {
              id: SENTIMENT_EMOTION_FLAG,
              title: m.org_analytics_sentiment_emotion_title(),
              description: m.org_analytics_sentiment_emotion_description(),
              checked: Boolean(flags[SENTIMENT_EMOTION_FLAG]),
              onCheckedChange: (enabled) =>
                void update({
                  action: 'toggle_compliance_flag',
                  flag: SENTIMENT_EMOTION_FLAG,
                  enabled,
                }),
              disabled: true,
            },
            {
              id: INTENTION_EXTRACTION_FLAG,
              title: m.org_analytics_intention_extraction_title(),
              description: m.org_analytics_intention_extraction_description(),
              checked: Boolean(flags[INTENTION_EXTRACTION_FLAG]),
              onCheckedChange: (enabled) =>
                void update({
                  action: 'toggle_compliance_flag',
                  flag: INTENTION_EXTRACTION_FLAG,
                  enabled,
                }),
              disabled: true,
            },
          ],
        }}
      />
    </ContentPage>
  )
}
