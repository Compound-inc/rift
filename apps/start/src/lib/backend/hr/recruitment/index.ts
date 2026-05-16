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
export { HrCvIngestService } from './services/cv-ingest.service'
export type {
  CvContact,
  ExtractContactInput,
  HrCvIngestServiceShape,
} from './services/cv-ingest.service'
export { HrCandidateTestDispatcherService } from './services/candidate-test-dispatcher.service'
export type {
  DispatchTestInput,
  DispatchTestResult,
  HrCandidateTestDispatcherServiceShape,
} from './services/candidate-test-dispatcher.service'
export { HrPositionService } from './services/position.service'
export type {
  CreatePositionInput,
  HrPositionServiceShape,
  UpdatePositionInput,
} from './services/position.service'
export { HrTestTemplateService } from './services/test-template.service'
export type {
  CreateTestTemplateInput,
  HrTestTemplateServiceShape,
} from './services/test-template.service'
export { HrRecruitmentRuntime } from './runtime/hr-recruitment-runtime'
