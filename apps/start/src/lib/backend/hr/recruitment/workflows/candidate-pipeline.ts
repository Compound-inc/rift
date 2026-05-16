/**
 * Candidate pipeline workflow.
 *
 * Workflow files run inside the Workflow SDK sandbox: no full Node
 * runtime
 *
 */

import { sleep, createHook } from 'workflow'
import type {
  BackgroundCheckPayload,
  CandidatePipelineWorkflowInput,
  TestSubmissionPayload,
} from '@/lib/shared/hr/recruitment'
import {
  computeAffinityStep,
  dispatchTestStep,
  finalizeApplicationStep,
  ingestCvStep,
  recordBackgroundCheckResultStep,
  recordTestResultStep,
  requireBackgroundCheckAddonStep,
  resolveDefaultTestTemplateStep,
} from './steps'

const MS_PER_DAY = 24 * 60 * 60 * 1000

type RaceOutcome<T> =
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'timeout' }

async function awaitHookOrSleep<T>(input: {
  readonly hook: PromiseLike<T>
  readonly timeoutMs: number
}): Promise<RaceOutcome<T>> {
  const hookPromise = Promise.resolve(input.hook).then<RaceOutcome<T>>(
    (value) => ({ kind: 'value', value }),
  )
  const sleepPromise = sleep(`${input.timeoutMs}ms`).then<RaceOutcome<T>>(
    () => ({ kind: 'timeout' }),
  )
  return await Promise.race([hookPromise, sleepPromise])
}

export async function candidatePipelineWorkflow(
  input: CandidatePipelineWorkflowInput,
): Promise<void> {
  'use workflow'

  await ingestCvStep(input)

  let affinity: { stage: 'awaiting_test' | 'rejected' }
  try {
    affinity = await computeAffinityStep(input)
  } catch (cause) {
    const reason =
      cause instanceof Error
        ? `affinity-failed:${cause.message.slice(0, 200)}`
        : 'affinity-failed'
    await finalizeApplicationStep({ ...input, outcome: 'rejected', reason })
    return
  }
  if (affinity.stage === 'rejected') return

  const template = await resolveDefaultTestTemplateStep(input)

  const testHookToken = `hr.recruitment.test:${input.runIdempotencyKey}`
  const testCompletion = createHook<TestSubmissionPayload>({
    token: testHookToken,
  })
  await dispatchTestStep({
    ...input,
    testTemplateId: template.testTemplateId,
    testTitle: template.testTitle,
    resumeWebhookUrl: testHookToken,
    idempotencyKey: `${input.runIdempotencyKey}:test`,
  })

  const submission = await awaitHookOrSleep({
    hook: testCompletion,
    timeoutMs: input.testTimeoutDays * MS_PER_DAY,
  })
  if (submission.kind === 'timeout') {
    await finalizeApplicationStep({
      ...input,
      outcome: 'rejected',
      reason: 'test-timeout',
    })
    return
  }

  await recordTestResultStep({ ...input, submission: submission.value })
  if (!submission.value.passed) return

  if (!input.hasBackgroundCheckAddon) {
    await finalizeApplicationStep({ ...input, outcome: 'advanced' })
    return
  }

  await requireBackgroundCheckAddonStep(input)
  const backgroundHookToken = `hr.recruitment.background-check:${input.runIdempotencyKey}`
  const verification = createHook<BackgroundCheckPayload>({
    token: backgroundHookToken,
  })
  const verificationResult = await awaitHookOrSleep({
    hook: verification,
    timeoutMs: input.testTimeoutDays * MS_PER_DAY,
  })
  if (verificationResult.kind === 'timeout') {
    await finalizeApplicationStep({
      ...input,
      outcome: 'rejected',
      reason: 'background-check-timeout',
    })
    return
  }

  await recordBackgroundCheckResultStep({
    ...input,
    result: verificationResult.value,
  })
}
