/**
 * Public surface of the HR Recruitment backend.
 *
 * Routes and workflow steps import from this barrel; workflow files
 * may only import the runtime-free types/contracts.
 */

export * from './domain/errors'
export * from './domain/types'
export { HrApplicationService } from './services/application.service'
export type {
  CreateApplicationInput,
  HrApplicationServiceShape,
  SetApplicationAffinityInput,
  SetApplicationStageInput,
} from './services/application.service'
export { HrCandidateService } from './services/candidate.service'
export type {
  ApplyCandidateAiProfileInput,
  HrCandidateServiceShape,
  UpsertCandidateInput,
} from './services/candidate.service'
export { HrCvAiExtractorService } from './services/cv-ai-extractor.service'
export type {
  AnalyzeCvInput,
  HrCandidateAiProfile,
  HrCvAiAnalysis,
  HrCvAiExtractorServiceShape,
} from './services/cv-ai-extractor.service'
export { extractFirstCvEmail } from './services/cv-email-extraction'
export type { ExtractFirstCvEmailInput } from './services/cv-email-extraction'
export { HrEvaluationDispatcherService } from './services/evaluation-dispatcher.service'
export type {
  DispatchEvaluationInput,
  DispatchEvaluationOutcome,
  HrEvaluationDispatcherServiceShape,
} from './services/evaluation-dispatcher.service'
export {
  buildEvaluationDispatchUrl,
  signEvaluationDispatchToken,
  verifyEvaluationDispatchToken,
} from './services/evaluation-urls'
export { HrPositionService } from './services/position.service'
export type {
  CreatePositionInput,
  HrPositionServiceShape,
  UpdatePositionInput,
} from './services/position.service'
export { HrRecruitmentRuntime } from './runtime/hr-recruitment-runtime'
