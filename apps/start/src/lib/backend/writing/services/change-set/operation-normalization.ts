import type { WritingEntryRow } from '../persistence'

export type RequestedWritingChangeOperation = 'create' | 'update' | 'delete'

/**
 * Agent tools can suggest an operation based on a projected workspace read, but
 * the persisted change row must reflect the canonical live tree. Normalizing at
 * the service boundary prevents impossible states such as `create` rows that
 * already have a live base blob behind them.
 */
export function resolveCanonicalWritingChangeOperation(input: {
  readonly requestedOperation: RequestedWritingChangeOperation
  readonly currentEntry: Pick<WritingEntryRow, 'kind'> | null
}): RequestedWritingChangeOperation {
  if (input.requestedOperation === 'delete') {
    return 'delete'
  }

  if (input.currentEntry?.kind === 'file') {
    return 'update'
  }

  return 'create'
}
