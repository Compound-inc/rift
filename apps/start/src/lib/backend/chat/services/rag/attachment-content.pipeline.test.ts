import { describe, expect, it } from 'vitest'
import {
  __testing as pipelineTesting,
  shouldInlineFullContent,
} from './attachment-content.pipeline'

const {
  splitIntoStructureAwareChunks,
  splitOnHeadings,
  stripWorkerBoilerplate,
} = pipelineTesting

/**
 * The Cloudflare markdown worker emits PDFs as a small `# file\n## Metadata\n- …`
 * block, followed by two blank lines, followed by `## Contents\n…` with the
 * real text. Without the metadata strip, every PDF's metadata cluster
 * lands at the top of vector search rankings (because they're all
 * near-identical) and crowds out content from the other files.
 */
const PDF_WORKER_MARKDOWN = [
  '# 58105060.pdf',
  '## Metadata',
  '- PDFFormatVersion=1.4',
  '- IsLinearized=false',
  '- IsAcroFormPresent=false',
  '- IsXFAPresent=false',
  '- IsCollectionPresent=false',
  '- IsSignaturesPresent=false',
  '- Creator=wkhtmltopdf 0.12.4',
  '- Producer=Qt 4.8.7',
  "- CreationDate=D:20210808153434+05'30'",
  '',
  '',
  '## Contents',
  '### Page 1',
  // Pad the contents paragraph past the 1600-char chunk target so the
  // window-split branch is exercised.
  'MATH TEACHER '.repeat(200),
].join('\n')

describe('stripWorkerBoilerplate', () => {
  it('removes the worker `## Metadata` block leaving content untouched', () => {
    const stripped = stripWorkerBoilerplate(PDF_WORKER_MARKDOWN)
    expect(stripped).not.toContain('PDFFormatVersion')
    expect(stripped).not.toContain('wkhtmltopdf')
    expect(stripped).toContain('## Contents')
    expect(stripped).toContain('MATH TEACHER')
  })

  it('preserves user-authored metadata sections that look like prose', () => {
    const userMarkdown = [
      '# My Notes',
      '',
      '## Metadata',
      '',
      'I keep my metadata as prose, not as bullets.',
      '',
      '## Body',
      'Real content.',
    ].join('\n')
    expect(stripWorkerBoilerplate(userMarkdown)).toContain(
      'I keep my metadata as prose',
    )
  })
})

describe('splitOnHeadings', () => {
  it('groups consecutive navigation headings into the first content section', () => {
    const input = [
      '# 99244405.pdf',
      '## Contents',
      '### Page 1',
      'Resume body line one.',
      '',
      'Resume body line two.',
      '',
      '### Page 2',
      'Page 2 body.',
    ].join('\n')

    const sections = splitOnHeadings(input)
    expect(sections).toHaveLength(2)
    // The first section carries the file/contents/page-1 breadcrumb.
    expect(sections[0]).toContain('# 99244405.pdf')
    expect(sections[0]).toContain('### Page 1')
    expect(sections[0]).toContain('Resume body line one.')
    expect(sections[1]).toContain('### Page 2')
    expect(sections[1]).toContain('Page 2 body.')
    expect(sections[1]).not.toContain('Resume body line one.')
  })

  it('returns an empty array for input with no body content', () => {
    expect(splitOnHeadings('# Title only')).toEqual([])
  })
})

describe('splitIntoStructureAwareChunks', () => {
  it('returns a single chunk for documents under the small-doc threshold', () => {
    // Short structured doc: keep whole markdown as one chunk so
    // retrieval always returns the entire document.
    const tiny = [
      '# CV - Jane Doe',
      '',
      '## Experience',
      'Three years of backend engineering work.',
      '',
      '## Skills',
      'Kotlin, TypeScript, Postgres.',
    ].join('\n')
    const chunks = splitIntoStructureAwareChunks(tiny)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('Jane Doe')
    expect(chunks[0]).toContain('Kotlin')
  })

  it('splits multi-page PDF markdown into per-page chunks', () => {
    // Build a multi-page document where each page exceeds the
    // small-doc threshold so the structure-aware path runs.
    const pageBody = (label: string) => `${label} content `.repeat(800).trim()
    const input = [
      '# 58105060.pdf',
      '## Contents',
      '### Page 1',
      pageBody('alpha'),
      '',
      '### Page 2',
      pageBody('beta'),
      '',
      '### Page 3',
      pageBody('gamma'),
    ].join('\n')
    const chunks = splitIntoStructureAwareChunks(input)
    // Each page is its own section so we expect at least one chunk
    // per page (each page exceeds chunkTargetChars so window-split
    // applies, but each page's first chunk should mention its label).
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks.some((chunk) => chunk.includes('alpha'))).toBe(true)
    expect(chunks.some((chunk) => chunk.includes('beta'))).toBe(true)
    expect(chunks.some((chunk) => chunk.includes('gamma'))).toBe(true)
    // The file/contents breadcrumb must ride with the first content
    // section (the page-1 chunk) so per-document context is preserved.
    const firstChunk = chunks[0]
    expect(firstChunk).toContain('# 58105060.pdf')
    expect(firstChunk).toContain('### Page 1')
    expect(firstChunk).toContain('alpha')
  })

  it('handles documents with no headings by paragraph-packing', () => {
    const long = 'X'.repeat(20_000)
    const chunks = splitIntoStructureAwareChunks(long)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('returns an empty array for empty input', () => {
    expect(splitIntoStructureAwareChunks('')).toEqual([])
    expect(splitIntoStructureAwareChunks('   \n   ')).toEqual([])
  })
})

describe('shouldInlineFullContent', () => {
  function pdfMarkdownWithPages(pageCount: number, bodyChars = 200): string {
    const pages = Array.from({ length: pageCount }, (_, index) => [
      `### Page ${index + 1}`,
      'x'.repeat(bodyChars),
      '',
    ]).flat()
    return ['# file.pdf', '## Contents', ...pages].join('\n')
  }

  it('inlines a 1-page PDF', () => {
    expect(shouldInlineFullContent(pdfMarkdownWithPages(1))).toBe(true)
  })

  it('inlines a 2-page PDF', () => {
    expect(shouldInlineFullContent(pdfMarkdownWithPages(2))).toBe(true)
  })

  it('does NOT inline a 3-page PDF', () => {
    expect(shouldInlineFullContent(pdfMarkdownWithPages(3))).toBe(false)
  })

  it('inlines a 2-page PDF even when its byte length exceeds the byte threshold', () => {
    // PDF page count wins over byte count. A dense 2-page PDF (e.g.
    // a tightly-typeset resume) might run 15–20 KB of extracted text;
    // we still inline because at 2 pages the user almost always wants
    // the whole thing in context.
    expect(shouldInlineFullContent(pdfMarkdownWithPages(2, 8_000))).toBe(true)
  })

  it('inlines a typical short docx via the byte fallback', () => {
    // Mirrors the worker output for a short hiring-policy docx:
    // h1 filename, h1 doc title, prose paragraphs, h2 sections.
    // No `### Page N` markers — falls back to byte count.
    const docx = [
      '# Fases mas importantes del proceso de seleccion.docx',
      '',
      '# **Fases mas importantes del proceso de seleccion**',
      '',
      'El proceso de seleccion de talento es una serie de etapas...',
      '',
      '## **1. Deteccion de la necesidad de contratacion**',
      '',
      'La primera fase consiste en identificar...',
    ].join('\n')
    expect(shouldInlineFullContent(docx)).toBe(true)
  })

  it('inlines short markdown / text content', () => {
    expect(shouldInlineFullContent('A short note about something.')).toBe(true)
  })

  it('does NOT inline long non-PDF content (no page markers, exceeds byte threshold)', () => {
    expect(shouldInlineFullContent('x'.repeat(20_000))).toBe(false)
  })

  it('treats a markdown file with `### Page 1` mid-paragraph as one PDF page', () => {
    // The regex anchors on line start, so a leading `### Page 1`
    // counts as 1 page marker. With page count = 1 ≤ inlineMaxPages,
    // this inlines regardless of byte length — the contract is: if
    // your markdown declares page boundaries with `### Page N`, you're
    // signalling it's a PDF-style document.
    const content = ['### Page 1', 'x'.repeat(20_000)].join('\n')
    expect(shouldInlineFullContent(content)).toBe(true)
  })
})
