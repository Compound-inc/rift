import { Layer } from 'effect'
import { RateLimitService } from '@/lib/backend/chat/services/rate-limit.service'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import {
  makeRuntimeRunner,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect'
import { ThreadSharingService } from '../services/thread-sharing.service'

const layer = ThreadSharingService.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      ZeroDatabaseService.layer,
      RateLimitService.layer.pipe(Layer.provide(UpstreamPostgresLayer)),
    ),
  ),
)
const runtime = makeRuntimeRunner(layer)
export const ThreadSharingRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
