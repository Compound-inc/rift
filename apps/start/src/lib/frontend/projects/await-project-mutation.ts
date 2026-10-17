type MutationResult = { readonly type: string }

/** Zero resolves failures as values. Check both phases before reporting success. */
export async function awaitProjectMutation(mutation: {
  readonly client: Promise<MutationResult>
  readonly server: Promise<MutationResult>
}): Promise<void> {
  const client = await mutation.client
  if (client.type === 'error') throw new Error('project_mutation_failed')
  const server = await mutation.server
  if (server.type === 'error') throw new Error('project_mutation_failed')
}
