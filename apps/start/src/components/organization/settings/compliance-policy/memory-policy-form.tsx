import { useEffect, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Form } from '@rift/ui/form'
import { mutators, queries } from '@/integrations/zero'
import { managePersonalizationMemory } from '@/lib/frontend/settings/personalization/personalization.functions'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

export function MemoryPolicyForm() {
  const z = useZero()
  const { activeOrganizationId } = useAppAuth()
  const [policy, result] = useQuery(queries.orgPolicy.current())
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    // The server rejects status checks for any workspace other than the
    // active one, so wait until the session knows which workspace that is.
    if (!activeOrganizationId) return
    let active = true
    void managePersonalizationMemory({
      data: { action: 'status', organizationId: activeOrganizationId },
    })
      .then((status) => {
        if (!active) return
        setError('')
        if ('configured' in status) setConfigured(Boolean(status.configured))
      })
      .catch(() => {
        if (active) setError(m.personalization_load_error())
      })
    return () => {
      active = false
    }
  }, [activeOrganizationId])
  const zdr = Boolean(policy?.complianceFlags.require_zdr)
  return (
    <Form
      title={m.personalization_org_memory_title()}
      description={
        !configured
          ? m.personalization_memory_unavailable()
          : zdr
            ? m.personalization_memory_zdr()
            : m.personalization_org_memory_description()
      }
      error={error}
      headerToggle={{
        checked: configured && !zdr && policy?.memoryEnabled !== false,
        enabledLabel: m.personalization_on(),
        disabledLabel: m.personalization_off(),
        disabled: busy || !configured || zdr || result.type !== 'complete',
        onCheckedChange: (enabled) => {
          setBusy(true)
          setError('')
          void z
            .mutate(mutators.orgPolicy.setMemoryEnabled({ enabled }))
            .server.then((response) => {
              if (response.type === 'error')
                setError(m.personalization_save_error())
            })
            .catch(() => setError(m.personalization_save_error()))
            .finally(() => setBusy(false))
        },
      }}
    />
  )
}
