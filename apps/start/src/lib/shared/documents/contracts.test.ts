import { describe, expect, it } from 'vitest'
import { documentModelBudgets, documentModelView } from './contracts'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'

describe('document model budgets', () => {
  it('scales replacements with the resolved output limit', () => {
    expect(
      documentModelBudgets({
        userId: 'u',
        threadId: 't',
        maxOutputTokens: 32_000,
        documentReadTokens: 50_000,
      }),
    ).toEqual({ rewriteTokens: 22_400, readTokens: 50_000 })
    expect(
      documentModelBudgets({
        userId: 'u',
        threadId: 't',
        maxOutputTokens: 8_000,
      }).rewriteTokens,
    ).toBe(5_600)
  })
  it.each(['word '.repeat(8000), '漢字'.repeat(8000), '\n"😀'.repeat(8000)])(
    'bounds complete serialized reads by estimated tokens',
    (content) => {
      const metadata = { title: 'Plan', documentId: 'doc', version: 2 }
      const result = documentModelView(content, metadata, 3000)
      expect(result.truncated).toBe(true)
      expect(
        estimateTokensFromText(
          JSON.stringify({ ok: true, ...metadata, ...result }),
        ),
      ).toBeLessThanOrEqual(3000)
      expect(result.content).not.toContain('�')
    },
  )
  it('reads a document larger than the old byte ceiling when tokens fit', () => {
    const content = 'word '.repeat(2000)
    expect(documentModelView(content, {}, 8000)).toMatchObject({
      content,
      truncated: false,
    })
  })
})
