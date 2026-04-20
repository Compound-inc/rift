import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionManager } from '@mariozechner/pi-coding-agent'
import type { SessionManager as SessionManagerShape } from '@mariozechner/pi-coding-agent'

export type MaterializedPiSession = {
  readonly directoryPath: string
  readonly sessionFilePath: string
}

/**
 * PI SDK persists sessions as JSONL files. Rift stores canonical session
 * contents in Postgres, so each request materializes one temp file that PI can
 * open natively through SessionManager.open().
 */
export async function materializePiSessionFile(input: {
  readonly chatId: string
  readonly sessionJsonl?: string
}): Promise<MaterializedPiSession> {
  const directoryPath = await fs.mkdtemp(
    join(tmpdir(), `rift-writing-pi-${input.chatId}-`),
  )
  const sessionFilePath = join(directoryPath, 'session.jsonl')

  if (typeof input.sessionJsonl === 'string' && input.sessionJsonl.length > 0) {
    await fs.writeFile(sessionFilePath, input.sessionJsonl, 'utf8')
  }

  return {
    directoryPath,
    sessionFilePath,
  }
}

/**
 * Serialize full PI session state back into canonical JSONL so later requests
 * can resume through native SessionManager restoration instead of transcript
 * replay.
 */
export function serializePiSession(sessionManager: SessionManager): string {
  const header = sessionManager.getHeader()
  if (!header) {
    throw new Error('PI session header missing')
  }

  const lines = [header, ...sessionManager.getEntries()].map((entry) =>
    JSON.stringify(entry),
  )

  return `${lines.join('\n')}\n`
}

export async function cleanupMaterializedPiSession(
  session: MaterializedPiSession,
): Promise<void> {
  await fs.rm(session.directoryPath, { recursive: true, force: true })
}

/**
 * Bridge entrypoint from DB-backed writing chat storage to PI's
 * file-based SessionManager API. Callers receive native SessionManager, while
 * temp-file setup/cleanup stays centralized here.
 */
export async function withPiSessionManager<T>(input: {
  readonly chatId: string
  readonly sessionJsonl?: string
  readonly run: (sessionManager: SessionManagerShape) => Promise<T>
}): Promise<T> {
  const materializedSession = await materializePiSessionFile({
    chatId: input.chatId,
    sessionJsonl: input.sessionJsonl,
  })

  try {
    const sessionManager = SessionManager.open(materializedSession.sessionFilePath)
    return await input.run(sessionManager)
  } finally {
    await cleanupMaterializedPiSession(materializedSession)
  }
}
