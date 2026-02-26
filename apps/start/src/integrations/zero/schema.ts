import {
  createSchema,
  table,
  string,
  number,
  boolean,
  json,
  enumeration,
  relationships,
} from '@rocicorp/zero'

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

const user = table('user')
  .from('users')
  .columns({
    id: string(),
    email: string(),
    workos_id: string(),
    firstName: string().from('first_name').optional(),
    lastName: string().from('last_name').optional(),
    profilePictureUrl: string().from('profile_picture_url').optional(),
  })
  .primaryKey('id')

const organization = table('organization')
  .from('organizations')
  .columns({
    id: string(),
    workos_id: string(),
    name: string(),
    plan: string().optional(),
    productStatus: string().from('product_status').optional(),
  })
  .primaryKey('id')

const orgAiPolicy = table('orgAiPolicy')
  .from('org_ai_policy')
  .columns({
    id: string(),
    orgWorkosId: string().from('org_workos_id'),
    disabledProviderIds: json<readonly string[]>()
      .from('disabled_provider_ids'),
    disabledModelIds: json<readonly string[]>().from('disabled_model_ids'),
    complianceFlags: json<Record<string, boolean>>().from('compliance_flags'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const thread = table('thread')
  .from('threads')
  .columns({
    id: string(),
    threadId: string().from('thread_id'),
    title: string(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
    lastMessageAt: number().from('last_message_at'),
    generationStatus: enumeration<
      'pending' | 'generation' | 'completed' | 'failed'
    >()
      .from('generation_status'),
    visibility: enumeration<'visible' | 'archived'>(),
    userSetTitle: boolean().from('user_set_title').optional(),
    userId: string().from('user_id'),
    model: string(),
    reasoningEffort: enumeration<
      'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
    >()
      .from('reasoning_effort')
      .optional(),
    responseStyle: enumeration<
      'regular' | 'learning' | 'technical' | 'concise'
    >()
      .from('response_style')
      .optional(),
    pinned: boolean(),
    branchParentThreadId: string().from('branch_parent_thread_id').optional(),
    branchParentPublicMessageId: string()
      .from('branch_parent_public_message_id')
      .optional(),
    shareId: string().from('share_id').optional(),
    shareStatus: enumeration<'active' | 'revoked'>()
      .from('share_status')
      .optional(),
    sharedAt: number().from('shared_at').optional(),
    allowAttachments: boolean().from('allow_attachments').optional(),
    orgOnly: boolean().from('org_only').optional(),
    shareName: boolean().from('share_name').optional(),
    ownerOrgId: string().from('owner_org_id').optional(),
    customInstructionId: string().from('custom_instruction_id').optional(),
  })
  .primaryKey('id')

const message = table('message')
  .from('messages')
  .columns({
    id: string(),
    messageId: string().from('message_id'),
    threadId: string().from('thread_id'),
    userId: string().from('user_id'),
    reasoning: string().optional(),
    content: string(),
    status: enumeration<
      | 'waiting'
      | 'thinking'
      | 'streaming'
      | 'done'
      | 'error'
      | 'error.rejected'
      | 'deleted'
      | 'cancelled'
    >(),
    updated_at: number().optional(),
    branches: json<readonly string[]>().optional(),
    role: enumeration<'user' | 'assistant' | 'system'>(),
    created_at: number(),
    serverError: json<{ type: string; message: string }>()
      .from('server_error')
      .optional(),
    model: string(),
    attachmentsIds: json<readonly string[]>().from('attachments_ids'),
    sources: json<
      readonly { sourceId: string; url: string; title?: string }[]
    >().optional(),
    modelParams: json<{
      temperature?: number
      topP?: number
      topK?: number
      reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
      includeSearch?: boolean
    }>()
      .from('model_params')
      .optional(),
    providerMetadata: json().from('provider_metadata').optional(),
  })
  .primaryKey('id')

const attachment = table('attachment')
  .from('attachments')
  .columns({
    id: string(),
    messageId: string().from('message_id').optional(),
    threadId: string().from('thread_id').optional(),
    userId: string().from('user_id'),
    fileKey: string().from('file_key'),
    attachmentUrl: string().from('attachment_url'),
    fileName: string().from('file_name'),
    mimeType: string().from('mime_type'),
    fileSize: number().from('file_size'),
    fileContent: string().from('file_content'),
    embeddingModel: string().from('embedding_model').optional(),
    embeddingTokens: number().from('embedding_tokens').optional(),
    embeddingDimensions: number().from('embedding_dimensions').optional(),
    embeddingChunks: number().from('embedding_chunks').optional(),
    embeddingStatus: string().from('embedding_status').optional(),
    ownerOrgId: string().from('owner_org_id').optional(),
    workspaceId: string().from('workspace_id').optional(),
    accessScope: enumeration<'user' | 'workspace' | 'org'>()
      .from('access_scope')
      .optional(),
    accessGroupIds: json<readonly string[]>().from('access_group_ids').optional(),
    vectorIndexedAt: number().from('vector_indexed_at').optional(),
    vectorError: string().from('vector_error').optional(),
    status: enumeration<'deleted' | 'uploaded'>().optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

// ---------------------------------------------------------------------------
// Relationships (optional; use for .related() in ZQL)
// ---------------------------------------------------------------------------

const threadRelationships = relationships(thread, ({ one }) => ({
  user: one({
    sourceField: ['userId'],
    destField: ['id'],
    destSchema: user,
  }),
}))

const messageRelationships = relationships(message, ({ one }) => ({
  thread: one({
    sourceField: ['threadId'],
    destField: ['threadId'],
    destSchema: thread,
  }),
}))

// ---------------------------------------------------------------------------
// Schema export and default types
// ---------------------------------------------------------------------------

export const schema = createSchema({
  tables: [user, organization, orgAiPolicy, thread, message, attachment],
  relationships: [threadRelationships, messageRelationships],
})

export type Schema = typeof schema

/**
 * Auth context passed through Zero query/mutate endpoints.
 * `orgWorkosId` is optional because users can browse without an active org,
 * but org-scoped queries/mutators must explicitly guard against that case.
 */
export type ZeroContext = {
  userID: string
  orgWorkosId?: string
}

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema
    context: ZeroContext
  }
}
