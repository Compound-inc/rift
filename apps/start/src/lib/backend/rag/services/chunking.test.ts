import { describe, expect, it } from 'vitest'
import {
  buildChunkEmbeddingText,
  chunkDocument,
  normalizeMarkdownForStorage,
  stripWorkerBoilerplate,
} from './chunking'

/** Shape of the Cloudflare markdown worker's PDF output. */
const PDF_WORKER_MARKDOWN = [
  '# 58105060.pdf',
  '## Metadata',
  '- PDFFormatVersion=1.4',
  '- IsLinearized=false',
  '- Creator=wkhtmltopdf 0.12.4',
  '',
  '',
  '## Contents',
  '### Page 1',
  'MATH TEACHER '.repeat(200),
].join('\n')

describe('stripWorkerBoilerplate', () => {
  it('removes the worker metadata block and keeps content', () => {
    const stripped = stripWorkerBoilerplate(PDF_WORKER_MARKDOWN)
    expect(stripped).not.toContain('PDFFormatVersion')
    expect(stripped).toContain('## Contents')
    expect(stripped).toContain('MATH TEACHER')
  })

  it('keeps user-authored metadata sections written as prose', () => {
    const markdown = '## Metadata\n\nI keep my metadata as prose.\n\n## Body\nReal content.'
    expect(stripWorkerBoilerplate(markdown)).toContain('I keep my metadata as prose')
  })
})

describe('chunkDocument', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkDocument('')).toEqual([])
    expect(chunkDocument('  \n  ')).toEqual([])
  })

  it('packs a small structured document into one chunk with its breadcrumb', () => {
    const chunks = chunkDocument(
      [
        '# CV - Jane Doe',
        '## Experience',
        'Three years of backend engineering work.',
        '',
        '## Skills',
        'Kotlin, TypeScript, Postgres.',
      ].join('\n'),
    )
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toContain('Jane Doe')
    expect(chunks[0].content).toContain('Kotlin')
    expect(chunks[0].section).toBe('CV - Jane Doe › Experience')
  })

  it('tracks heading breadcrumbs per section', () => {
    const page = (label: string) => `${label} content `.repeat(150).trim()
    const chunks = chunkDocument(
      [
        '# report.pdf',
        '## Contents',
        '### Page 1',
        page('alpha'),
        '',
        '### Page 2',
        page('beta'),
      ].join('\n'),
    )
    const alpha = chunks.find((chunk) => chunk.content.includes('alpha'))
    const beta = chunks.find((chunk) => chunk.content.includes('beta'))
    expect(alpha?.section).toBe('report.pdf › Contents › Page 1')
    expect(beta?.section).toBe('report.pdf › Contents › Page 2')
    expect(alpha?.content).toContain('### Page 1')
  })

  it('splits oversized paragraphs into overlapping windows at word boundaries', () => {
    const words = Array.from({ length: 1_500 }, (_, index) => `word${index}`)
    const chunks = chunkDocument(words.join(' '), {
      targetChars: 1_000,
      overlapChars: 100,
    })
    expect(chunks.length).toBeGreaterThan(5)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1_000)
      expect(chunk.content).not.toMatch(/^\S*\d\S* $/)
    }
    // Consecutive windows overlap so a fact cut at a boundary is in both.
    const firstTail = chunks[0].content.split(' ').at(-1)!
    expect(chunks[1].content).toContain(firstTail)
    // Nothing is lost: the last word is in the last chunk.
    expect(chunks.at(-1)?.content).toContain('word1499')
  })

  it('assigns stable sequential indexes', () => {
    const markdown = Array.from(
      { length: 20 },
      (_, index) => `## Section ${index}\n${'text '.repeat(120)}`,
    ).join('\n\n')
    const first = chunkDocument(markdown)
    expect(first.map((chunk) => chunk.index)).toEqual(first.map((_, index) => index))
    expect(chunkDocument(markdown)).toEqual(first)
  })

  it('indexes long documents end to end instead of truncating them', () => {
    // ~700 KB: the previous 140-chunk cap dropped everything after ~250 KB.
    const markdown = Array.from(
      { length: 400 },
      (_, index) => `### Page ${index + 1}\n${'lorem ipsum dolor '.repeat(100)}`,
    ).join('\n\n')
    const chunks = chunkDocument(markdown)
    expect(chunks.at(-1)?.section).toBe('Page 400')
  })
})

describe('normalizeMarkdownForStorage', () => {
  it('strips boilerplate and collapses blank lines', () => {
    const normalized = normalizeMarkdownForStorage(`${PDF_WORKER_MARKDOWN}\n\n\n\nEnd`)
    expect(normalized).not.toContain('PDFFormatVersion')
    expect(normalized).not.toMatch(/\n{3,}/)
  })
})

describe('buildChunkEmbeddingText', () => {
  it('prefixes the file name and section breadcrumb', () => {
    expect(
      buildChunkEmbeddingText({
        fileName: 'terms.pdf',
        chunk: { index: 0, content: 'Refunds within 30 days.', section: 'Refunds' },
      }),
    ).toBe('terms.pdf › Refunds\n\nRefunds within 30 days.')
  })
})
