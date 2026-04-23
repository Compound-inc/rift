import { describe, expect, it } from 'vitest'
import { buildWritingManuscript } from './manuscript'

describe('buildWritingManuscript', () => {
  it('groups markdown files into top-level sections and hides agents instructions', () => {
    const manuscript = buildWritingManuscript([
      {
        id: 'root',
        path: '/agents.md',
        name: 'agents.md',
        kind: 'file',
        blob: { content: '# Instructions' },
      },
      {
        id: 'section-folder',
        path: '/mechanics',
        name: 'mechanics',
        kind: 'folder',
      },
      {
        id: 'intro',
        path: '/mechanics/01-intro.md',
        name: '01-intro.md',
        kind: 'file',
        blob: { content: 'Alpha beta gamma' },
      },
      {
        id: 'details',
        path: '/mechanics/02-deep-dive.md',
        name: '02-deep-dive.md',
        kind: 'file',
        blob: { content: 'Delta epsilon' },
      },
    ])

    expect(manuscript.workspaceInstructionsPath).toBe('/agents.md')
    expect(manuscript.totalFileCount).toBe(2)
    expect(manuscript.sections).toHaveLength(1)
    expect(manuscript.sections[0]).toMatchObject({
      path: '/mechanics',
      title: 'Mechanics',
      wordCount: 5,
    })
    expect(manuscript.sections[0]?.files.map((file) => file.title)).toEqual([
      'Intro',
      'Deep Dive',
    ])
  })

  it('keeps root markdown files visible as ungrouped drafts for older projects', () => {
    const manuscript = buildWritingManuscript([
      {
        id: 'draft',
        path: '/loose-notes.md',
        name: 'loose-notes.md',
        kind: 'file',
        blob: { content: 'one two three four' },
      },
    ])

    expect(manuscript.hasUngroupedFiles).toBe(true)
    expect(manuscript.sections).toHaveLength(1)
    expect(manuscript.sections[0]).toMatchObject({
      path: null,
      title: 'Ungrouped Drafts',
      wordCount: 4,
    })
  })

  it('uses numeric folder and file prefixes as manuscript order', () => {
    const manuscript = buildWritingManuscript([
      {
        id: 'appendix',
        path: '/10.-appendix/01-reference.md',
        name: '01-reference.md',
        kind: 'file',
        blob: { content: 'Appendix' },
      },
      {
        id: 'mechanics-middle',
        path: '/01.-mechanics/02.-deep-dive/01-details.md',
        name: '01-details.md',
        kind: 'file',
        blob: { content: 'Details' },
      },
      {
        id: 'story',
        path: '/02.-story/01-outline.md',
        name: '01-outline.md',
        kind: 'file',
        blob: { content: 'Story' },
      },
      {
        id: 'mechanics-start',
        path: '/01.-mechanics/01-intro.md',
        name: '01-intro.md',
        kind: 'file',
        blob: { content: 'Intro' },
      },
      {
        id: 'mechanics-late',
        path: '/01.-mechanics/02.-deep-dive/10-edge-cases.md',
        name: '10-edge-cases.md',
        kind: 'file',
        blob: { content: 'Edges' },
      },
      {
        id: 'mechanics-early',
        path: '/01.-mechanics/02.-deep-dive/02-examples.md',
        name: '02-examples.md',
        kind: 'file',
        blob: { content: 'Examples' },
      },
    ])

    expect(manuscript.sections.map((section) => section.path)).toEqual([
      '/01.-mechanics',
      '/02.-story',
      '/10.-appendix',
    ])
    expect(manuscript.sections[0]?.title).toBe('Mechanics')
    expect(manuscript.sections[0]?.files.map((file) => file.path)).toEqual([
      '/01.-mechanics/01-intro.md',
      '/01.-mechanics/02.-deep-dive/01-details.md',
      '/01.-mechanics/02.-deep-dive/02-examples.md',
      '/01.-mechanics/02.-deep-dive/10-edge-cases.md',
    ])
  })

  it('overlays pending AI-created files into the manuscript before acceptance', () => {
    const manuscript = buildWritingManuscript(
      [
        {
          id: 'intro',
          path: '/01.-mechanics/01-intro.md',
          name: '01-intro.md',
          kind: 'file',
          blob: { content: 'Intro' },
        },
      ],
      [
        {
          changeSetId: 'change-set-1',
          changeId: 'change-1',
          changeSetSummary: 'Drafted a new advanced section',
          changeSetStatus: 'pending',
          path: '/01.-mechanics/02.-advanced/01-notes.md',
          operation: 'create',
          createdAt: 10,
          baseContent: '',
          proposedContent: 'Pending notes',
          hunkIds: ['hunk-1'],
        },
      ],
    )

    expect(manuscript.files.map((file) => file.path)).toEqual([
      '/01.-mechanics/01-intro.md',
      '/01.-mechanics/02.-advanced/01-notes.md',
    ])
    expect(manuscript.files[1]?.review).toMatchObject({
      changeSetId: 'change-set-1',
      operation: 'create',
      pendingHunkCount: 1,
    })
    expect(manuscript.sections[0]?.files[1]?.title).toBe('Notes')
  })
})
