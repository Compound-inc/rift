import { afterEach, describe, expect, it } from 'vitest'
import {
  getWorkflowPostgresConfig,
  getWorkflowPostgresConfigError,
  isWorkflowInfrastructureRequest,
} from './config.server'

const ORIGINAL_ENV = { ...process.env }

describe('workflow config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('matches workflow infrastructure requests by path prefix', () => {
    expect(
      isWorkflowInfrastructureRequest(
        'http://localhost:3000/.well-known/workflow/v1/flow',
      ),
    ).toBe(true)

    expect(
      isWorkflowInfrastructureRequest('http://localhost:3000/api/chat'),
    ).toBe(false)
  })

  it('requires explicit Postgres world configuration', () => {
    process.env.WORKFLOW_TARGET_WORLD = '@workflow/world-postgres'
    process.env.WORKFLOW_POSTGRES_URL = 'postgres://workflow.example/rift'

    expect(getWorkflowPostgresConfig()).toEqual({
      targetWorld: '@workflow/world-postgres',
      postgresUrl: 'postgres://workflow.example/rift',
    })
    expect(getWorkflowPostgresConfigError()).toBeNull()
  })

  it('rejects implicit world or URL fallbacks', () => {
    delete process.env.WORKFLOW_TARGET_WORLD
    delete process.env.WORKFLOW_POSTGRES_URL
    process.env.DATABASE_URL = 'postgres://app.example/rift'

    expect(getWorkflowPostgresConfig()).toBeNull()
    expect(getWorkflowPostgresConfigError()).toContain(
      'WORKFLOW_TARGET_WORLD=@workflow/world-postgres',
    )
  })
})
