import { readFile } from 'node:fs/promises'
import { SessionManager } from '@mariozechner/pi-coding-agent'
import { describe, expect, it } from 'vitest'
import {
  cleanupMaterializedPiSession,
  materializePiSessionFile,
  serializePiSession,
  withPiSessionManager,
} from './pi-session'

describe('pi session bridge', () => {
  it('serializes native PI session state into reusable jsonl', () => {
    const sessionManager = SessionManager.inMemory('/writing/project-1')
    sessionManager.appendModelChange('openai', 'gpt-5.2')
    sessionManager.appendThinkingLevelChange('low')
    sessionManager.appendMessage({
      role: 'user',
      content: [{ type: 'text', text: 'Outline chapter one' }],
      timestamp: 10,
    })

    const jsonl = serializePiSession(sessionManager)

    expect(jsonl).toContain(`"id":"${sessionManager.getSessionId()}"`)
    expect(jsonl).toContain('"type":"session"')
    expect(jsonl).toContain('"role":"user"')
    expect(jsonl.endsWith('\n')).toBe(true)
  })

  it('materializes stored jsonl into file PI can reopen', async () => {
    const sessionManager = SessionManager.inMemory('/writing/project-1')
    sessionManager.appendModelChange('openai', 'gpt-5.2')
    const jsonl = serializePiSession(sessionManager)

    const materialized = await materializePiSessionFile({
      chatId: 'chat-1',
      sessionJsonl: jsonl,
    })

    try {
      expect(
        await readFile(materialized.sessionFilePath, 'utf8'),
      ).toBe(jsonl)
    } finally {
      await cleanupMaterializedPiSession(materialized)
    }
  })

  it('centralizes materialize-open-cleanup through withPiSessionManager', async () => {
    const seed = SessionManager.inMemory('/writing/project-1')
    seed.appendModelChange('openai', 'gpt-5.2')
    seed.appendMessage({
      role: 'user',
      content: [{ type: 'text', text: 'Seed prompt' }],
      timestamp: 20,
    })

    const reopenedMessageCount = await withPiSessionManager({
      chatId: 'chat-1',
      sessionJsonl: serializePiSession(seed),
      run: async (sessionManager) =>
        sessionManager.buildSessionContext().messages.length,
    })

    expect(reopenedMessageCount).toBe(1)
  })
})
