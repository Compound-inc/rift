import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { WorkspaceBillingService } from '@/lib/backend/billing/services/workspace-billing.service'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ChatPolicySettingsService } from '../services/chat-policy-settings.service'

const layer = Layer.mergeAll(
  WorkspaceBillingService.layer,
  ChatPolicySettingsService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const ChatPolicyRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
