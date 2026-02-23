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
    version: number(),
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
      reasoningEffort?: 'low' | 'medium' | 'high'
      includeSearch?: boolean
    }>()
      .from('model_params')
      .optional(),
    providerMetadata: json().from('provider_metadata').optional(),
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
  tables: [user, organization, orgAiPolicy, thread, message],
  relationships: [threadRelationships, messageRelationships],
})

export type Schema = typeof schema

/** Context passed by ZeroProvider; used in queries/mutators for auth (e.g. restrict by userID). */
export type ZeroContext = { userID: string }

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema
    context: ZeroContext
  }
}
