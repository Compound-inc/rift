'use client'

import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import { useOrgFeatureAccess } from '@/lib/billing/use-org-billing'
import { m } from '@/paraglide/messages.js'

const DOMAINS_ACTION_HREF = '#'
const SSO_ACTION_HREF = '#'
const DIRECTORY_ACTION_HREF = '#'

export function OrgSecurityPage() {
  const domainAccess = useOrgFeatureAccess('verifiedDomains')
  const ssoAccess = useOrgFeatureAccess('singleSignOn')
  const directoryAccess = useOrgFeatureAccess('directoryProvisioning')

  return (
    <ContentPage
      title={m.org_security_page_title()}
      description={m.org_security_page_description()}
    >
      <Form
        title={m.org_security_domains_title()}
        description={m.org_security_domains_description()}
        contentSlot={
          <p className="text-sm text-foreground-tertiary">
            {m.org_security_domains_status_empty()}
          </p>
        }
        forceActions
        buttonText={m.org_security_domains_add_button()}
        buttonDisabled
        handleSubmit={async () => {
          window.open(DOMAINS_ACTION_HREF, '_blank')
        }}
        {...getFeatureAccessFormProps({
          enabled: domainAccess.allowed,
          featureAccess: domainAccess,
          defaultHelpText: m.org_security_coming_soon_self_serve(),
        })}
      />

      <Form
        title={m.org_security_sso_title()}
        description={m.org_security_sso_description()}
        contentSlot={
          <p className="text-sm text-foreground-tertiary">
            {m.org_security_sso_status_empty()}
          </p>
        }
        forceActions
        buttonText={m.org_security_sso_setup_button()}
        buttonDisabled
        handleSubmit={async () => {
          window.open(SSO_ACTION_HREF, '_blank')
        }}
        {...getFeatureAccessFormProps({
          enabled: ssoAccess.allowed,
          featureAccess: ssoAccess,
          defaultHelpText: m.org_security_coming_soon_self_serve(),
        })}
      />

      <Form
        title={m.org_security_directory_title()}
        description={m.org_security_directory_description()}
        contentSlot={
          <p className="text-sm text-foreground-tertiary">
            {m.org_security_directory_status_empty()}
          </p>
        }
        forceActions
        buttonText={m.org_security_directory_setup_button()}
        buttonDisabled
        handleSubmit={async () => {
          window.open(DIRECTORY_ACTION_HREF, '_blank')
        }}
        {...getFeatureAccessFormProps({
          enabled: directoryAccess.allowed,
          featureAccess: directoryAccess,
          defaultHelpText: m.org_security_coming_soon_self_serve(),
        })}
      />
    </ContentPage>
  )
}
