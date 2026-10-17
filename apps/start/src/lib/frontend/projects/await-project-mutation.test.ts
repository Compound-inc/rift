import { describe, expect, it, vi } from 'vitest'
import { awaitProjectMutation } from './await-project-mutation'

describe('project mutation results', () => {
  it.each(['client', 'server'] as const)(
    'rejects a resolved %s error before navigation or success feedback',
    async (phase) => {
      const navigate = vi.fn()
      const showSuccess = vi.fn()
      const action = async () => {
        await awaitProjectMutation({
          client: Promise.resolve({
            type: phase === 'client' ? 'error' : 'success',
          }),
          server: Promise.resolve({
            type: phase === 'server' ? 'error' : 'success',
          }),
        })
        showSuccess()
        navigate()
      }
      await expect(action()).rejects.toThrow('project_mutation_failed')
      expect(navigate).not.toHaveBeenCalled()
      expect(showSuccess).not.toHaveBeenCalled()
    },
  )
  it('waits for the server before returning success', async () => {
    let complete!: (value: { type: string }) => void
    const server = new Promise<{ type: string }>((resolve) => {
      complete = resolve
    })
    const success = vi.fn()
    const pending = awaitProjectMutation({
      client: Promise.resolve({ type: 'success' }),
      server,
    }).then(success)
    await Promise.resolve()
    expect(success).not.toHaveBeenCalled()
    complete({ type: 'success' })
    await pending
    expect(success).toHaveBeenCalledOnce()
  })
})
