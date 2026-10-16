import { describe, expect, it } from 'vitest'
import { organizationListFixture } from './singularity.test-fixtures'
import {
  getSingularityQueueCounts,
  getSingularitySidebarSelection,
} from './singularity-sidebar.logic'

describe('Singularity sidebar queues', () => {
  it('counts affected workspaces once while exposing each issue queue', () => {
    expect(
      getSingularityQueueCounts([
        organizationListFixture(),
        organizationListFixture({
          organizationId: 'org-2',
          memberCount: 5,
          pendingInvitationCount: 1,
          seatCount: 5,
          restrictedMemberCount: 2,
          subscriptionStatus: 'past_due',
          usageSyncStatus: 'degraded',
        }),
      ]),
    ).toEqual({ attention: 1, seats: 1, access: 1, billing: 1, sync: 1 })
  })
  it('selects only the active queue on directory URLs', () => {
    expect(
      getSingularitySidebarSelection('/singularity', { health: 'seats' }),
    ).toBe('seats')
    expect(
      getSingularitySidebarSelection('/singularity/', { health: 'invalid' }),
    ).toBe('organizations')
  })
  it('keeps profiles under Organizations and users under Users', () => {
    expect(
      getSingularitySidebarSelection('/singularity/users', { health: 'seats' }),
    ).toBe('users')
    expect(
      getSingularitySidebarSelection('/singularity/orgs/org-1', {
        tab: 'members',
      }),
    ).toBe('organizations')
    expect(getSingularitySidebarSelection('/singularity/users-other', {})).toBe(
      'organizations',
    )
  })
})
