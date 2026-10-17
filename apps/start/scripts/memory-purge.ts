/** Manual/self-hosted drain. The app server also owns a recurring purge worker. */
import { MemoryPurgeRuntime } from '../src/lib/backend/chat/runtime/memory-purge-runtime'
import { drainMemoryPurges } from '../src/lib/backend/chat/services/personalization/memory-purge-loop.service'

try {
  await MemoryPurgeRuntime.run(
    drainMemoryPurges(),
  )
} finally {
  await MemoryPurgeRuntime.dispose()
}
