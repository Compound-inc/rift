import { RAG_CONFIG } from '../domain/config'
import type { DocumentChunk } from '../domain/types'

/**
 * Structure-aware markdown chunker shared by every ingest path.
 *
 * The markdown worker (and plain-text uploads) give us headings, paragraphs
 * and tables. Chunks follow that structure instead of cutting at fixed
 * offsets:
 *
 *   1. The document is split into heading-delimited sections. Each section
 *      remembers its heading breadcrumb (`Handbook › Leave › Page 3`), which
 *      is embedded alongside the chunk text (contextual chunk header) and
 *      shown to the model when the chunk is retrieved.
 *   2. Paragraphs are packed into chunks of up to `targetChars`. Consecutive
 *      small sections share a chunk, so a resume with a heading every three
 *      lines does not become thirty fragment chunks.
 *   3. A paragraph larger than `targetChars` (long tables, unbroken text) is
 *      split into overlapping windows that prefer line or sentence
 *      boundaries.
 */

type ChunkingOptions = {
  readonly targetChars: number
  readonly overlapChars: number
  readonly maxChunks: number
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  targetChars: RAG_CONFIG.chunking.targetChars,
  overlapChars: RAG_CONFIG.chunking.overlapChars,
  maxChunks: RAG_CONFIG.chunking.maxChunksPerDocument,
}

const HEADING_PATTERN = /^(#{1,6})\s+(\S.*)$/

/**
 * Strip the markdown worker's auto-generated PDF metadata block
 * (`## Metadata` followed by `- key=value` bullets). It is identical across
 * PDFs, so its chunks cluster in embedding space and crowd real content out
 * of rankings. Only that exact shape is removed.
 */
export function stripWorkerBoilerplate(markdown: string): string {
  return markdown.replace(/^## Metadata\n(?:[-*] [^\n]*(?:\n|$))+\n*/gm, '')
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Canonical stored form of a document's extracted text. Every ingest path
 * stores this in `attachments.file_content` and chunks the same string, so
 * full-text injection and retrieved excerpts always agree.
 */
export function normalizeMarkdownForStorage(markdown: string): string {
  return normalizeWhitespace(stripWorkerBoilerplate(markdown))
}

type Section = {
  readonly path: string
  readonly text: string
}

/**
 * Split markdown into sections with a heading breadcrumb. Heading lines stay
 * in the section text so the first chunk of a section still reads naturally.
 */
function splitIntoSections(markdown: string): readonly Section[] {
  const sections: Section[] = []
  const headingStack: Array<{ level: number; title: string }> = []
  let lines: string[] = []
  let hasBody = false

  const currentPath = () => headingStack.map((entry) => entry.title).join(' › ')
  let sectionPath = ''

  const flush = () => {
    const text = lines.join('\n').trim()
    if (hasBody && text.length > 0) sections.push({ path: sectionPath, text })
    lines = []
    hasBody = false
  }

  for (const line of markdown.split('\n')) {
    const heading = HEADING_PATTERN.exec(line)
    if (heading) {
      // Stacked headings with no body in between (`# Title` + `## Intro`)
      // stay in the same section so the breadcrumb reaches the content.
      if (hasBody) flush()
      const level = heading[1].length
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop()
      }
      headingStack.push({ level, title: heading[2].trim() })
      sectionPath = currentPath()
      lines.push(line)
      continue
    }
    if (line.trim().length > 0) hasBody = true
    lines.push(line)
  }
  flush()
  return sections
}

/**
 * Find a cut point inside `text[start, start + maxLength)`, preferring a line
 * break, then a sentence end, then a space, in the last 40% of the window.
 */
function findWindowEnd(text: string, start: number, maxLength: number): number {
  const hardEnd = Math.min(text.length, start + maxLength)
  if (hardEnd === text.length) return hardEnd
  const minEnd = start + Math.floor(maxLength * 0.6)
  const window = text.slice(minEnd, hardEnd)
  for (const separator of ['\n', '. ', ' ']) {
    const at = window.lastIndexOf(separator)
    if (at >= 0) return minEnd + at + separator.length
  }
  return hardEnd
}

function splitOversizedParagraph(
  paragraph: string,
  options: ChunkingOptions,
): readonly string[] {
  const windows: string[] = []
  let start = 0
  while (start < paragraph.length) {
    const end = findWindowEnd(paragraph, start, options.targetChars)
    windows.push(paragraph.slice(start, end).trim())
    if (end >= paragraph.length) break
    start = Math.max(start + 1, end - options.overlapChars)
  }
  return windows.filter((window) => window.length > 0)
}

/**
 * Chunk a normalized markdown document. Pure and deterministic: the same
 * input always yields the same chunks, which keeps vector point ids stable
 * across re-indexing.
 */
export function chunkDocument(
  markdown: string,
  overrides?: Partial<ChunkingOptions>,
): readonly DocumentChunk[] {
  const options = { ...DEFAULT_OPTIONS, ...overrides }
  const normalized = normalizeWhitespace(markdown)
  if (normalized.length === 0) return []

  const sections = splitIntoSections(normalized)
  const effectiveSections =
    sections.length > 0 ? sections : [{ path: '', text: normalized }]

  const chunks: Array<{ content: string; section: string }> = []
  let buffer = ''
  let bufferSection = ''

  const flush = () => {
    const content = buffer.trim()
    if (content.length > 0) chunks.push({ content, section: bufferSection })
    buffer = ''
  }

  for (const section of effectiveSections) {
    const paragraphs = section.text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)

    for (const paragraph of paragraphs) {
      if (buffer.length === 0) bufferSection = section.path
      const candidate = buffer.length > 0 ? `${buffer}\n\n${paragraph}` : paragraph
      if (candidate.length <= options.targetChars) {
        buffer = candidate
        continue
      }

      if (paragraph.length > options.targetChars) {
        // A short pending buffer (typically just the section heading) rides
        // along with the first window so headings never become lone chunks.
        const prefix =
          buffer.length > 0 && buffer.length < options.targetChars / 4
            ? `${buffer}\n\n`
            : ''
        if (prefix.length === 0) flush()
        buffer = ''
        const windows = splitOversizedParagraph(paragraph, {
          ...options,
          targetChars: options.targetChars - prefix.length,
        })
        windows.forEach((window, windowIndex) => {
          chunks.push({
            content: windowIndex === 0 ? `${prefix}${window}` : window,
            section: section.path,
          })
        })
        continue
      }

      flush()
      bufferSection = section.path
      buffer = paragraph
    }
  }
  flush()

  return chunks.slice(0, options.maxChunks).map((chunk, index) => ({
    index,
    content: chunk.content,
    section: chunk.section,
  }))
}

/**
 * Text sent to the embedding model for a chunk. Prefixing the file name and
 * section breadcrumb (a "contextual chunk header") lets a chunk that only
 * says "the limit is 30 days" still match "refund policy in terms.pdf".
 * The stored chunk content stays unprefixed.
 */
export function buildChunkEmbeddingText(input: {
  readonly fileName: string
  readonly chunk: DocumentChunk
}): string {
  const header = input.chunk.section
    ? `${input.fileName} › ${input.chunk.section}`
    : input.fileName
  return `${header}\n\n${input.chunk.content}`
}
