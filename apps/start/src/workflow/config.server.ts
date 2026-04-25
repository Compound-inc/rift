const WORKFLOW_INFRASTRUCTURE_PATH_PREFIX = '/.well-known/workflow/'
const WORKFLOW_POSTGRES_WORLD_ID = '@workflow/world-postgres'

export type WorkflowPostgresConfig = {
  readonly targetWorld: typeof WORKFLOW_POSTGRES_WORLD_ID
  readonly postgresUrl: string
}

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function isWorkflowInfrastructureRequest(
  input: Request | URL | string,
): boolean {
  const url =
    input instanceof Request
      ? new URL(input.url)
      : input instanceof URL
        ? input
        : new URL(input, 'http://localhost')

  return url.pathname.startsWith(WORKFLOW_INFRASTRUCTURE_PATH_PREFIX)
}

export function getWorkflowPostgresConfig(): WorkflowPostgresConfig | null {
  const targetWorld = readTrimmedEnv('WORKFLOW_TARGET_WORLD')
  const postgresUrl = readTrimmedEnv('WORKFLOW_POSTGRES_URL')

  if (targetWorld !== WORKFLOW_POSTGRES_WORLD_ID || !postgresUrl) {
    return null
  }

  return {
    targetWorld: WORKFLOW_POSTGRES_WORLD_ID,
    postgresUrl,
  }
}

export function getWorkflowPostgresConfigError(): string | null {
  const targetWorld = readTrimmedEnv('WORKFLOW_TARGET_WORLD')
  const postgresUrl = readTrimmedEnv('WORKFLOW_POSTGRES_URL')

  if (targetWorld !== WORKFLOW_POSTGRES_WORLD_ID) {
    return `Set WORKFLOW_TARGET_WORLD=${WORKFLOW_POSTGRES_WORLD_ID} to enable the Workflow Postgres World.`
  }

  if (!postgresUrl) {
    return 'Set WORKFLOW_POSTGRES_URL explicitly. RIFT does not allow Workflow to fall back to DATABASE_URL.'
  }

  return null
}
