import { describe, expect, it } from 'vitest'
import type {
  SingularityUserListItem,
  SingularityUserMembership,
} from '../shared/singularity-admin'
import {
  parseSingularityUserSearch,
  selectSingularityUsers,
} from './singularity-users-page.logic'
import { parseSingularityProfileSearch } from '../shared/singularity-search'

function membership(
  overrides: Partial<SingularityUserMembership> = {},
): SingularityUserMembership {
  return {
    memberId: 'membership-1',
    organizationId: 'org-1',
    organizationName: 'Atlas Recruiting',
    organizationSlug: 'atlas',
    role: 'owner',
    accessStatus: 'active',
    accessReason: null,
    ...overrides,
  }
}
function user(
  overrides: Partial<SingularityUserListItem> = {},
): SingularityUserListItem {
  return {
    userId: 'user-1',
    name: 'María Torres',
    email: 'maria@atlas.example',
    image: null,
    emailVerified: true,
    createdAt: 1727740800000,
    memberships: [membership()],
    ...overrides,
  }
}

describe('Global user directory', () => {
  it('searches across account and workspace fields without accent sensitivity', () => {
    expect(
      selectSingularityUsers([user()], { q: 'MARIA recruiting' }).rows,
    ).toHaveLength(1)
    expect(
      selectSingularityUsers([user()], { q: 'user-1 atlas.example' }).rows,
    ).toHaveLength(1)
    expect(
      selectSingularityUsers([user()], { q: 'unknown@example.com' }).rows,
    ).toHaveLength(0)
  })
  it('counts each user once even with several memberships and restrictions', () => {
    const users = [
      user({
        memberships: [
          membership({ accessStatus: 'restricted' }),
          membership({
            memberId: 'other',
            organizationId: 'other',
            accessStatus: 'restricted',
          }),
        ],
      }),
      user({ userId: 'unassigned', emailVerified: false, memberships: [] }),
    ]
    expect(selectSingularityUsers(users, {}).summary).toEqual({
      total: 2,
      restricted: 1,
      unverified: 1,
      noWorkspace: 1,
    })
    expect(
      selectSingularityUsers(users, { status: 'no_workspace' }).rows.map(
        (row) => row.userId,
      ),
    ).toEqual(['unassigned'])
    expect(
      selectSingularityUsers(users, { status: 'unverified' }).rows.map(
        (row) => row.userId,
      ),
    ).toEqual(['unassigned'])
  })
  it('requires the role and restriction to belong to the same workspace', () => {
    const account = user({
      memberships: [
        membership(),
        membership({
          memberId: 'restricted',
          role: 'member',
          accessStatus: 'restricted',
        }),
      ],
    })
    expect(
      selectSingularityUsers([account], { role: 'owner', status: 'restricted' })
        .rows,
    ).toHaveLength(0)
    expect(
      selectSingularityUsers([account], {
        role: 'member',
        status: 'restricted',
      }).rows,
    ).toHaveLength(1)
    expect(
      selectSingularityUsers([user({ memberships: [] })], {
        role: 'admin',
        status: 'no_workspace',
      }).rows,
    ).toHaveLength(0)
  })
  it('sorts dates numerically and clamps stale pages', () => {
    const users = [user(), user({ userId: 'newest', createdAt: 1730419200000 })]
    const result = selectSingularityUsers(users, { sort: 'recent', page: 99 })
    expect(result.rows.map((row) => row.userId)).toEqual(['newest', 'user-1'])
    expect(result.page).toBe(1)
  })
  it('sanitizes shared links and preserves explicit user and membership searches', () => {
    expect(
      parseSingularityUserSearch({
        role: 'root',
        status: 'delete',
        sort: 'invalid',
        page: -1,
        user: ' ',
      }),
    ).toMatchObject({
      role: undefined,
      status: undefined,
      sort: undefined,
      page: undefined,
      user: undefined,
    })
    expect(
      parseSingularityUserSearch({ page: '2', role: 'admin', user: 'user-1' }),
    ).toMatchObject({ page: 2, role: 'admin', user: 'user-1' })
    expect(
      parseSingularityProfileSearch({
        tab: 'members',
        member: 'maria@atlas.example',
      }),
    ).toEqual({ tab: 'members', member: 'maria@atlas.example' })
  })
})
