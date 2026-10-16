import { describe, expect, it } from 'vitest'
import {
  parseSingularityDirectorySearch,
  parseSingularityProfileSearch,
} from '../shared/singularity-search'
import {
  getOrganizationIssues,
  selectSingularityOrganizations,
} from './singularity-org-list-page.logic'
import { organizationListFixture } from './singularity.test-fixtures'
import { buildSingularityCsv } from './singularity-export'

describe('Singularity organization directory', () => {
  it('matches multiple terms across organization and member fields without accent sensitivity', () => {
    const org = organizationListFixture({ name: 'México team' })
    expect(
      selectSingularityOrganizations([org], { q: 'MEXICO maria@acme' })
        .matching,
    ).toHaveLength(1)
    expect(
      selectSingularityOrganizations([org], { q: 'user-maria org-1' }).matching,
    ).toHaveLength(1)
    expect(
      selectSingularityOrganizations([org], { q: 'acme absent' }).matching,
    ).toHaveLength(0)
  })
  it('combines plan and health filters while keeping summary totals global', () => {
    const rows = [
      organizationListFixture(),
      organizationListFixture({
        organizationId: 'org-2',
        planId: 'free',
        usageSyncStatus: 'degraded',
      }),
      organizationListFixture({
        organizationId: 'org-3',
        subscriptionStatus: 'past_due',
      }),
    ]
    const result = selectSingularityOrganizations(rows, {
      plan: 'paid',
      health: 'attention',
    })
    expect(result.matching.map((row) => row.organizationId)).toEqual(['org-3'])
    expect(result.summary).toEqual({
      organizations: 3,
      paid: 2,
      members: 6,
      attention: 2,
    })
  })
  it('counts invitations against capacity and identifies restricted members independently', () => {
    expect(
      getOrganizationIssues(
        organizationListFixture({
          memberCount: 4,
          pendingInvitationCount: 2,
          seatCount: 5,
          restrictedMemberCount: 1,
        }),
      ),
    ).toEqual(['seats', 'access'])
    expect(
      getOrganizationIssues(
        organizationListFixture({
          memberCount: 4,
          pendingInvitationCount: 1,
          seatCount: 5,
        }),
      ),
    ).toEqual([])
  })
  it('sorts seat utilization numerically and keeps ties stable by ID', () => {
    const result = selectSingularityOrganizations(
      [
        organizationListFixture({
          organizationId: 'z',
          memberCount: 2,
          seatCount: 10,
        }),
        organizationListFixture({
          organizationId: 'a',
          memberCount: 2,
          seatCount: 10,
        }),
        organizationListFixture({
          organizationId: 'b',
          memberCount: 9,
          seatCount: 10,
        }),
      ],
      { sort: 'seats' },
    )
    expect(result.rows.map((row) => row.organizationId)).toEqual([
      'b',
      'a',
      'z',
    ])
  })
  it('clamps a stale page after the data or filters shrink', () => {
    const result = selectSingularityOrganizations([organizationListFixture()], {
      page: 99,
    })
    expect(result.page).toBe(1)
    expect(result.rows).toHaveLength(1)
  })
  it('sanitizes URL parameters and rejects invalid page sizes and profile tabs', () => {
    expect(
      parseSingularityDirectorySearch({
        plan: 'unknown',
        health: 'delete',
        sort: 'none',
        q: ' ',
        page: -1,
      }),
    ).toEqual({
      plan: undefined,
      health: undefined,
      sort: undefined,
      q: undefined,
      page: undefined,
    })
    expect(
      parseSingularityDirectorySearch({ page: '3', health: 'sync' }),
    ).toMatchObject({ page: 3, health: 'sync' })
    expect(
      parseSingularityDirectorySearch({ page: '2.5' }).page,
    ).toBeUndefined()
    expect(parseSingularityProfileSearch({ tab: 'members' }).tab).toBe(
      'members',
    )
    expect(
      parseSingularityProfileSearch({ tab: 'invalid' }).tab,
    ).toBeUndefined()
  })
  it('quotes CSV values and prevents spreadsheet formula execution', () => {
    expect(
      buildSingularityCsv([
        ['Name', 'Value'],
        ['a,"b', '=HYPERLINK("bad")'],
        ['line\nbreak', '\t+SUM(1,2)'],
      ]),
    ).toBe(
      '\uFEFF"Name","Value"\r\n"a,""b","\'=HYPERLINK(""bad"")"\r\n"line\nbreak","\'\t+SUM(1,2)"',
    )
  })
})
