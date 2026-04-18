import { Effect } from 'effect'
import type { WritingErrorCode } from '../domain/error-codes'
import type {
  WritingErrorI18nKey,
  WritingErrorI18nParams,
} from '@/lib/shared/writing-contracts/error-i18n'
import {
  addBackendWideEventBreadcrumb,
  createBackendWideEventBase,
  createDrainBackendWideEventEffect,
  finalizeBackendWideEventFailure,
  finalizeBackendWideEventSuccess,
  type BackendWideEventBase,
  type BackendWideEventBreadcrumb,
  type BackendWideEventLevel,
  type BackendWideEventOutcome,
} from '@/lib/backend/server-effect'

type WritingRequestOutcome = BackendWideEventOutcome<
  WritingErrorCode,
  WritingErrorI18nKey,
  WritingErrorI18nParams
>

/**
 * Request-wide writing observability record.
 */
export type WritingRequestWideEvent = BackendWideEventBase<
  WritingErrorCode,
  WritingErrorI18nKey,
  WritingErrorI18nParams
> & {
  readonly request: {
    readonly requestId: string
    readonly route: string
    readonly method: string
    readonly startedAt: number
    operation?: string
  }
  actor: {
    userId?: string
    organizationId?: string
  }
  workspace: {
    projectId?: string
    chatId?: string
    path?: string
    toolName?: string
    autoAccept?: boolean
    changeSetId?: string
  }
  agent: {
    requestedModelId?: string
    resolvedModelId?: string
  }
  breadcrumbs: BackendWideEventBreadcrumb[]
  outcome?: WritingRequestOutcome
}

export function createWritingWideEvent(input: {
  readonly eventName: string
  readonly requestId: string
  readonly route: string
  readonly method: string
  readonly operation?: string
}): WritingRequestWideEvent {
  const base = createBackendWideEventBase<
    WritingErrorCode,
    WritingErrorI18nKey,
    WritingErrorI18nParams
  >({
    eventName: input.eventName,
    requestId: input.requestId,
    route: input.route,
    method: input.method,
  })

  return {
    ...base,
    request: {
      ...base.request,
      operation: input.operation,
    },
    actor: {},
    workspace: {},
    agent: {},
  }
}

export function setWritingWideEventContext(
  event: WritingRequestWideEvent,
  patch: Partial<Omit<WritingRequestWideEvent, 'eventName' | 'request' | 'breadcrumbs' | '_drained' | 'outcome'>> & {
    readonly request?: Partial<WritingRequestWideEvent['request']>
  },
): WritingRequestWideEvent {
  if (patch.request) Object.assign(event.request, patch.request)
  if (patch.actor) Object.assign(event.actor, patch.actor)
  if (patch.workspace) Object.assign(event.workspace, patch.workspace)
  if (patch.agent) Object.assign(event.agent, patch.agent)
  return event
}

export function addWritingWideEventBreadcrumb(
  event: WritingRequestWideEvent,
  input: {
    readonly name: string
    readonly detail?: Readonly<Record<string, unknown>>
  },
): WritingRequestWideEvent {
  return addBackendWideEventBreadcrumb(event, input)
}

export function finalizeWritingWideEventSuccess(
  event: WritingRequestWideEvent,
  input: {
    readonly status: number
    readonly suppressLog?: boolean
  },
): WritingRequestWideEvent {
  return finalizeBackendWideEventSuccess(event, input)
}

export function finalizeWritingWideEventFailure(
  event: WritingRequestWideEvent,
  input: {
    readonly status: number
    readonly level: BackendWideEventLevel
    readonly captureMode: 'none' | 'signal' | 'exception'
    readonly retryable: boolean
    readonly suppressLog?: boolean
    readonly errorTag: string
    readonly message: string
    readonly errorCode?: WritingErrorCode
    readonly cause?: string
    readonly i18nKey?: WritingErrorI18nKey
    readonly i18nParams?: WritingErrorI18nParams
  },
): WritingRequestWideEvent {
  return finalizeBackendWideEventFailure(event, input)
}

export const drainWritingWideEvent = Effect.fn(
  'WritingObservability.drainWritingWideEvent',
)((event: WritingRequestWideEvent) => {
  return createDrainBackendWideEventEffect({
    event,
    logName: 'writing.request',
    annotations: {
      operation: event.request.operation,
      user_id: event.actor.userId,
      organization_id: event.actor.organizationId,
      project_id: event.workspace.projectId,
      chat_id: event.workspace.chatId,
      path: event.workspace.path,
      tool_name: event.workspace.toolName,
      auto_accept: event.workspace.autoAccept,
      change_set_id: event.workspace.changeSetId,
      requested_model_id: event.agent.requestedModelId,
      resolved_model_id: event.agent.resolvedModelId,
    },
  })
})
