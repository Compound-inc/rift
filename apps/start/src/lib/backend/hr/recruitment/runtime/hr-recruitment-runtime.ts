import { Layer } from 'effect'
import {
  makeRuntimeRunner,
  UpstreamPostgresLayer,
} from '@/lib/backend/server-effect'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { HrApplicationService } from '../services/application.service'
import { HrCandidateService } from '../services/candidate.service'
import { HrCandidateTestDispatcherService } from '../services/candidate-test-dispatcher.service'
import { HrCvAiExtractorService } from '../services/cv-ai-extractor.service'
import { HrCvIngestService } from '../services/cv-ingest.service'
import { HrPositionService } from '../services/position.service'
import { HrTestTemplateService } from '../services/test-template.service'

/**
 * HR Recruitment runtime
 */

const layer = Layer.mergeAll(
  HrPositionService.layer,
  HrCandidateService.layer,
  HrTestTemplateService.layer,
  HrApplicationService.layer,
  HrCvIngestService.layer,
  HrCvAiExtractorService.layer,
  HrCandidateTestDispatcherService.layerConsoleStub,
  MarkdownConversionService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const HrRecruitmentRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
