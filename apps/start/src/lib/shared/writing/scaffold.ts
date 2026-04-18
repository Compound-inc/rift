import { WRITING_PROJECT_INSTRUCTION_PATH, WRITING_ROOT_PATH } from './constants'

export type WritingScaffoldEntry =
  | {
      readonly path: string
      readonly kind: 'folder'
    }
  | {
      readonly path: string
      readonly kind: 'file'
      readonly content: string
    }

function createProjectInstructions(title: string) {
  return `# Writing Workspace Instructions

Project: ${title}

This project starts intentionally blank. Create folders and markdown files only when they are useful for the work.

Guidelines:
- Keep the workspace markdown-first
- Prefer clear, specific file names
- Create folders only when they improve organization
- Keep long-form writing structured with headings and sections
`
}

export function createDefaultWritingScaffold(title: string): readonly WritingScaffoldEntry[] {
  return [
    {
      path: WRITING_ROOT_PATH,
      kind: 'folder',
    },
    {
      path: WRITING_PROJECT_INSTRUCTION_PATH,
      kind: 'file',
      content: createProjectInstructions(title),
    },
  ]
}
