import { describe, expect, it } from 'vitest'
import { resolveCanonicalWritingChangeOperation } from './operation-normalization'

describe('resolveCanonicalWritingChangeOperation', () => {
  it('keeps create for files that do not exist in the live tree', () => {
    expect(
      resolveCanonicalWritingChangeOperation({
        requestedOperation: 'create',
        currentEntry: null,
      }),
    ).toBe('create')
  })

  it('normalizes create to update when the live file already exists', () => {
    expect(
      resolveCanonicalWritingChangeOperation({
        requestedOperation: 'create',
        currentEntry: { kind: 'file' } as const,
      }),
    ).toBe('update')
  })

  it('keeps update for existing files', () => {
    expect(
      resolveCanonicalWritingChangeOperation({
        requestedOperation: 'update',
        currentEntry: { kind: 'file' } as const,
      }),
    ).toBe('update')
  })

  it('preserves delete requests so removals stay explicit', () => {
    expect(
      resolveCanonicalWritingChangeOperation({
        requestedOperation: 'delete',
        currentEntry: { kind: 'file' } as const,
      }),
    ).toBe('delete')
  })
})
