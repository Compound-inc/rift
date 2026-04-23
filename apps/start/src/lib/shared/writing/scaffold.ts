import {
  WRITING_PROJECT_INSTRUCTION_PATH,
  WRITING_ROOT_PATH,
} from './constants'

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
- Reserve the root for /agents.md and top-level section folders
- Put manuscript files inside ordered section folders such as /01.-mechanics/01-intro.md
- Prefer clear, specific folder and file names
- Use numeric prefixes as the source of truth for folder, subfolder, and file order
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
