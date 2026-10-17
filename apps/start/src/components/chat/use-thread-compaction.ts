import { useQuery } from '@rocicorp/zero/react'
import type { UIMessage } from 'ai'
import { queries } from '@/integrations/zero'
import {
  applicableCompaction,
  compactionViewModel,
} from '@/lib/shared/chat-contracts/compaction'
import { useCompactionProgress } from './compaction-progress'

/** Synced checkpoints survive reload; the stream also covers DB fallback rows. */
export function useThreadCompaction(
  threadId: string | undefined,
  messages: readonly UIMessage[],
) {
  const [checkpoints] = useQuery(
    queries.compactions.byThread({ threadId: threadId ?? '' }),
    { enabled: Boolean(threadId) },
  )
  const progress = useCompactionProgress(threadId)
  const checkpoint = applicableCompaction(
    [
      ...(checkpoints ?? []),
      ...(progress?.checkpoint ? [progress.checkpoint] : []),
    ],
    messages,
  )
  return { view: compactionViewModel(checkpoint, messages), progress }
}
