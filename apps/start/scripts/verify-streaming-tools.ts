import { writeFile } from 'node:fs/promises'
import { streamText } from 'ai'
import type { ToolSet } from 'ai'
import {
  AI_CATALOG,
  getCatalogModel,
  getCatalogModelProviderRoute,
} from '../src/lib/shared/ai-catalog'
import { DECLARED_TOOL_KEYS_BY_MODEL_ID } from '../src/lib/shared/ai-catalog/tool-catalog'
import { STREAMING_TOOLS_VERIFICATIONS } from '../src/lib/shared/ai-catalog/streaming-tools-verification'
import { createModelTools } from '../src/lib/backend/chat/services/model-tools'

/** Run explicitly with a working Gateway key. This makes billable requests;
 * tool execution is removed so verification cannot read or mutate app data.
 * Certificates require a completed streamed function call, not just HTTP 200.
 */
if (!process.env.AI_GATEWAY_API_KEY?.trim())
  throw new Error('AI_GATEWAY_API_KEY is required')
const requested = process.argv.slice(2)
if (requested.length === 0)
  throw new Error(
    'Pass catalog model IDs, or --all to verify every declared tool-capable model',
  )
const ids = requested.includes('--all')
  ? AI_CATALOG.filter(
      (model) =>
        model.capabilities.supportsTools && model.providers.includes('gateway'),
    ).map((model) => model.id)
  : requested
const destination = new URL(
  '../src/lib/shared/ai-catalog/streaming-tools-verification.json',
  import.meta.url,
)
let records = [...STREAMING_TOOLS_VERIFICATIONS]
for (const modelId of ids) {
  const model = getCatalogModel(modelId)
  const route = getCatalogModelProviderRoute({ modelId, providerId: 'gateway' })
  if (!model || !route) throw new Error(`No Gateway route: ${modelId}`)
  let toolKeys = DECLARED_TOOL_KEYS_BY_MODEL_ID.get(modelId) ?? []
  let built = createModelTools({ modelId, resolvedToolKeys: toolKeys })
  // Some providers exclude function tools when native tools are attached.
  // Probe documents alone in that case and certify only that combination.
  if (!built.tools.read_document) {
    toolKeys = toolKeys.filter((key) => key === 'rift.documents')
    built = createModelTools({ modelId, resolvedToolKeys: toolKeys })
  }
  if (!built.tools.read_document)
    throw new Error(`No document function tool: ${modelId}`)
  const tools: ToolSet = Object.fromEntries(
    Object.entries(built.tools).map(([name, definition]) => [
      name,
      { ...definition, execute: undefined },
    ]),
  )
  records = records.filter(
    (record) =>
      !(record.modelId === modelId && record.providerId === 'gateway'),
  )
  try {
    const result = streamText({
      model: route.modelId,
      tools,
      prompt:
        'Call read_document with documentId "compatibility-probe". Do not write any prose.',
      maxOutputTokens: 512,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30_000),
      reasoning: model.defaultReasoningEffort,
      providerOptions: built.defaultProviderOptions as Parameters<
        typeof streamText
      >[0]['providerOptions'],
      onError: () => {},
    })
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'error') throw chunk.error
    }
    if (
      !(await result.toolCalls).some(
        (call) => call.toolName === 'read_document',
      )
    ) {
      throw new Error('Stream completed without the requested function call')
    }
    records.push({
      modelId,
      providerId: 'gateway',
      routeModelId: route.modelId,
      toolKeys: [...toolKeys],
      runtimeToolNames: Object.keys(tools),
      verifiedAt: new Date().toISOString(),
    })
    console.log(
      `${modelId}: verified streaming with ${Object.keys(tools).join(', ')}`,
    )
  } catch (error) {
    // Never serialize provider responses or credentials into the repository.
    console.error(
      `${modelId}: not verified (${error instanceof Error ? error.name : 'request failed'})`,
    )
    process.exitCode = 1
  }
  await writeFile(destination, `${JSON.stringify(records, null, 2)}\n`)
}
