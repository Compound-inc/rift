import { describe, expect, it } from 'vitest'
import { activeProjectSkills, projectHomeThreads } from './project-home.logic'
import type { SkillRow } from '@/lib/shared/skills/skill-row'

const skill = (
  id: string,
  name: string,
  extra: Partial<SkillRow> = {},
): SkillRow => ({
  id,
  name,
  userId: 'u',
  body: 'body',
  allowAdminEdit: false,
  ...extra,
})

describe('activeProjectSkills', () => {
  it('matches name shadowing and overrides without hiding project skills', () => {
    const project = skill('p', 'WRITE', { projectId: 'p1' })
    const org = skill('o', 'write', { organizationId: 'org' })
    const personal = skill('u', 'write')
    const visible = skill('v', 'review')
    const hidden = skill('h', 'hidden')
    const deleted = skill('d', 'deleted', { deletedAt: 1 })
    expect(
      activeProjectSkills({
        project: [project],
        org: [org],
        personal: [personal, visible, hidden, deleted],
        hiddenIds: new Set(['p', 'h']),
      }),
    ).toEqual([visible, project])
    expect(
      activeProjectSkills({
        project: [],
        org: [org],
        personal: [personal],
        hiddenIds: new Set(),
      }),
    ).toEqual([org])
    expect(
      activeProjectSkills({
        project: [],
        org: [org],
        personal: [personal],
        hiddenIds: new Set(['o']),
      }),
    ).toEqual([personal])
  })
})

describe('projectHomeThreads', () => {
  it('sorts most recent first with deterministic ties, ignores pins and excludes archives', () => {
    const rows = [
      {
        threadId: 'old',
        title: 'Roadmap',
        updatedAt: 1,
        visibility: 'visible',
        pinned: true,
      },
      { threadId: 'a', title: 'Plan', updatedAt: 2, visibility: 'visible' },
      { threadId: 'z', title: 'Research', updatedAt: 2, visibility: 'visible' },
      {
        threadId: 'archived',
        title: 'Research',
        updatedAt: 3,
        visibility: 'archived',
      },
    ]
    expect(projectHomeThreads(rows, '').map((row) => row.threadId)).toEqual([
      'z',
      'a',
      'old',
    ])
    expect(
      projectHomeThreads(rows, '  ROAD  ').map((row) => row.threadId),
    ).toEqual(['old'])
    expect(rows[0].threadId).toBe('old')
  })
  it('handles untitled threads and an empty list', () => {
    expect(
      projectHomeThreads(
        [{ threadId: 'a', updatedAt: 1, visibility: 'visible' }],
        'anything',
      ),
    ).toEqual([])
    expect(projectHomeThreads([], '')).toEqual([])
  })
})
