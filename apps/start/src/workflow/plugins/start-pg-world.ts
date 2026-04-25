import { definePlugin as defineNitroPlugin } from 'nitro'
import { getWorkflowPostgresConfig } from '../config.server'

const WORKFLOW_WORLD_START_PROMISE = Symbol.for(
  'rift.workflow.world.startPromise',
)

type GlobalWorkflowBootstrapState = typeof globalThis & {
  [WORKFLOW_WORLD_START_PROMISE]?: Promise<void>
}

export default defineNitroPlugin(async () => {
  if (!getWorkflowPostgresConfig()) {
    return
  }

  const globalState = globalThis as GlobalWorkflowBootstrapState

  globalState[WORKFLOW_WORLD_START_PROMISE] ??= (async () => {
    const { getWorld } = await import('workflow/runtime')
    const world = await getWorld()
    await world.start?.()
  })()

  await globalState[WORKFLOW_WORLD_START_PROMISE]
})
