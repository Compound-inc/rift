// PREVIEW-ONLY probe (untracked): call the shimmed default provider like the gateway does.
import '@/lib/backend/chat/services/local-model-routing'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
const result = streamText({
  model: process.argv[2] ?? 'openai/gpt-6-luna',
  instructions: [{ role: 'system', content: 'You are helpful.' }],
  messages: [{ role: 'user', content: process.argv[3] ?? 'What is the latest Bun release? Search the web.' }],
  tools: { web_search: openai.tools.webSearch({}) } as any,
  providerOptions: { openai: { reasoningEffort: 'medium' } } as any,
  maxOutputTokens: 4000,
})
for await (const part of result.fullStream) {
  const p: any = part
  if (p.type === 'text-delta' || p.type === 'reasoning-delta') continue
  console.log(p.type, JSON.stringify(p).slice(0, 300))
}
