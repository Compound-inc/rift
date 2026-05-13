import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { PermissionService } from '@/lib/backend/permissions'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ChatPolicySettingsService } from '../services/chat-policy-settings.service'

/**
 * Chat policy runtime. Provides `ChatPolicySettingsService` (the domain
 * write surface) and `PermissionService` (the canonical server-side
 * gate) so routes only execute the domain programs.
 */
const layer = Layer.mergeAll(
  PermissionService.layer,
  ChatPolicySettingsService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const ChatPolicyRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
