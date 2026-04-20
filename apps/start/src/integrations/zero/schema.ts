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
import type { ChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'
import type { ChatErrorI18nKey } from '@/lib/shared/chat-contracts/error-i18n'

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

/**
 * Better Auth stores organization membership data in the same Postgres
 * database as the rest of the app. These table definitions intentionally map
 * only the fields needed by the members settings page so Zero can serve the
 * directory locally without duplicating the full auth model.
 */
const user = table('user')
  .from('user')
  .columns({
    id: string(),
    name: string(),
    email: string(),
    image: string().optional(),
  })
  .primaryKey('id')

const organization = table('organization')
  .from('organization')
  .columns({
    id: string(),
    name: string(),
    slug: string(),
    logo: string().optional(),
  })
  .primaryKey('id')

const member = table('member')
  .from('member')
  .columns({
    id: string(),
    organizationId: string(),
    userId: string(),
    role: string(),
  })
  .primaryKey('id')

const invitation = table('invitation')
  .from('invitation')
  .columns({
    id: string(),
    organizationId: string(),
    email: string(),
    role: string(),
    status: string(),
  })
  .primaryKey('id')

const orgPolicy = table('orgPolicy')
  .from('org_policy')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    disabledProviderIds: json<readonly string[]>()
      .from('disabled_provider_ids'),
    disabledModelIds: json<readonly string[]>().from('disabled_model_ids'),
    complianceFlags: json<Record<string, boolean>>().from('compliance_flags'),
    providerNativeToolsEnabled: boolean()
      .from('provider_native_tools_enabled')
      .optional(),
    externalToolsEnabled: boolean().from('external_tools_enabled').optional(),
    disabledToolKeys: json<readonly string[]>()
      .from('disabled_tool_keys'),
    orgKnowledgeEnabled: boolean().from('org_knowledge_enabled').optional(),
    providerKeyStatus: json<{
      syncedAt: number
      hasAnyProviderKey: boolean
      providers: {
        openai: boolean
        anthropic: boolean
      }
    }>().from('provider_key_status'),
    enforcedModeId: string().from('enforced_mode_id').optional(),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgProductConfig = table('orgProductConfig')
  .from('org_product_config')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    featureStates: json<Record<string, boolean>>().from('feature_states'),
    version: number(),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgProductPolicy = table('orgProductPolicy')
  .from('org_product_policy')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    productKey: string().from('product_key'),
    capabilities: json<Record<string, boolean>>(),
    settings: json<Record<string, boolean | string | number | null>>(),
    disabledProviderIds: json<readonly string[]>()
      .from('disabled_provider_ids'),
    disabledModelIds: json<readonly string[]>().from('disabled_model_ids'),
    disabledToolKeys: json<readonly string[]>().from('disabled_tool_keys'),
    complianceFlags: json<Record<string, boolean>>().from('compliance_flags'),
    version: number(),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgBillingAccount = table('orgBillingAccount')
  .from('org_billing_account')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    provider: string(),
    providerCustomerId: string().from('provider_customer_id').optional(),
    status: string(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgSubscription = table('orgSubscription')
  .from('org_subscription')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    billingAccountId: string().from('billing_account_id'),
    providerSubscriptionId: string().from('provider_subscription_id').optional(),
    planId: string().from('plan_id'),
    billingInterval: string().from('billing_interval').optional(),
    seatCount: number().from('seat_count').optional(),
    status: string(),
    currentPeriodStart: number().from('current_period_start').optional(),
    currentPeriodEnd: number().from('current_period_end').optional(),
    cancelAtPeriodEnd: boolean().from('cancel_at_period_end').optional(),
    scheduledPlanId: string().from('scheduled_plan_id').optional(),
    scheduledSeatCount: number().from('scheduled_seat_count').optional(),
    scheduledChangeEffectiveAt: number()
      .from('scheduled_change_effective_at')
      .optional(),
    pendingChangeReason: string().from('pending_change_reason').optional(),
    metadata: json<Record<string, string | number | boolean | null>>(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgEntitlementSnapshot = table('orgEntitlementSnapshot')
  .from('org_entitlement_snapshot')
  .columns({
    organizationId: string().from('organization_id'),
    planId: string().from('plan_id'),
    billingProvider: string().from('billing_provider'),
    subscriptionStatus: string().from('subscription_status'),
    seatCount: number().from('seat_count').optional(),
    activeMemberCount: number().from('active_member_count'),
    pendingInvitationCount: number().from('pending_invitation_count'),
    isOverSeatLimit: boolean().from('is_over_seat_limit'),
    effectiveFeatures: json<Record<string, boolean | string | number>>()
      .from('effective_features'),
    usagePolicy: json<Record<string, boolean | string | number>>()
      .from('usage_policy'),
    usageSyncStatus: string().from('usage_sync_status'),
    usageSyncError: string().from('usage_sync_error').optional(),
    computedAt: number().from('computed_at'),
    version: number(),
  })
  .primaryKey('organizationId')

const orgMemberAccess = table('orgMemberAccess')
  .from('org_member_access')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    userId: string().from('user_id'),
    status: string(),
    reasonCode: string().from('reason_code').optional(),
    suspendedAt: number().from('suspended_at').optional(),
    reactivatedAt: number().from('reactivated_at').optional(),
    sourceSubscriptionId: string().from('source_subscription_id').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const orgUserUsageSummary = table('orgUserUsageSummary')
  .from('org_user_usage_summary')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    userId: string().from('user_id'),
    kind: enumeration<'free' | 'paid'>(),
    seatIndex: number().from('seat_index').optional(),
    monthlyUsedPercent: number().from('monthly_used_percent'),
    monthlyRemainingPercent: number().from('monthly_remaining_percent'),
    monthlyResetAt: number().from('monthly_reset_at'),
    createdAt: number().from('created_at'),
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
      'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
    >()
      .from('reasoning_effort')
      .optional(),
    responseStyle: enumeration<
      'regular' | 'learning' | 'technical' | 'concise'
    >()
      .from('response_style')
      .optional(),
    pinned: boolean(),
    activeChildByParent: json<Record<string, string>>()
      .from('active_child_by_parent'),
    branchVersion: number().from('branch_version'),
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
    modeId: string().from('mode_id').optional(),
    disabledToolKeys: json<readonly string[]>()
      .from('disabled_tool_keys')
      .optional(),
    contextWindowMode: enumeration<'standard' | 'max'>()
      .from('context_window_mode')
      .optional(),
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
    parentMessageId: string().from('parent_message_id').optional(),
    branchIndex: number().from('branch_index'),
    branchAnchorMessageId: string()
      .from('branch_anchor_message_id')
      .optional(),
    regenSourceMessageId: string()
      .from('regen_source_message_id')
      .optional(),
    role: enumeration<'user' | 'assistant' | 'system'>(),
    created_at: number(),
    serverError: json<{
      type: string
      message: string
      code?: ChatErrorCode
      i18nKey?: ChatErrorI18nKey
    }>()
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
      reasoningEffort?:
        | 'none'
        | 'minimal'
        | 'low'
        | 'medium'
        | 'high'
        | 'xhigh'
        | 'max'
      includeSearch?: boolean
    }>()
      .from('model_params')
      .optional(),
    providerMetadata: json().from('provider_metadata').optional(),
    generationMetadata: json().from('generation_metadata').optional(),
    publicCost: number().from('public_cost').optional(),
    inputTokens: number().from('input_tokens').optional(),
    outputTokens: number().from('output_tokens').optional(),
    totalTokens: number().from('total_tokens').optional(),
    reasoningTokens: number().from('reasoning_tokens').optional(),
    textTokens: number().from('text_tokens').optional(),
    cacheReadTokens: number().from('cache_read_tokens').optional(),
    cacheWriteTokens: number().from('cache_write_tokens').optional(),
    noCacheTokens: number().from('no_cache_tokens').optional(),
    billableWebSearchCalls: number()
      .from('billable_web_search_calls')
      .optional(),
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
    embeddingStatus: string().from('embedding_status').optional(),
    ownerOrgId: string().from('owner_org_id').optional(),
    workspaceId: string().from('workspace_id').optional(),
    accessScope: enumeration<'user' | 'workspace' | 'org'>()
      .from('access_scope')
      .optional(),
    orgKnowledgeKind: string().from('org_knowledge_kind').optional(),
    orgKnowledgeActive: boolean().from('org_knowledge_active').optional(),
    accessGroupIds: json<readonly string[]>().from('access_group_ids').optional(),
    vectorIndexedAt: number().from('vector_indexed_at').optional(),
    vectorError: string().from('vector_error').optional(),
    status: enumeration<'deleted' | 'uploaded'>().optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const writingProject = table('writingProject')
  .from('writing_projects')
  .columns({
    id: string(),
    ownerUserId: string().from('owner_user_id'),
    ownerOrgId: string().from('owner_org_id'),
    title: string(),
    slug: string(),
    description: string().optional(),
    headSnapshotId: string().from('head_snapshot_id').optional(),
    defaultChatId: string().from('default_chat_id').optional(),
    autoAcceptMode: boolean().from('auto_accept_mode'),
    archivedAt: number().from('archived_at').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const writingBlob = table('writingBlob')
  .from('writing_blobs')
  .columns({
    id: string(),
    sha256: string(),
    content: string(),
    byteSize: number().from('byte_size'),
    createdAt: number().from('created_at'),
  })
  .primaryKey('id')

const writingEntry = table('writingEntry')
  .from('writing_entries')
  .columns({
    id: string(),
    projectId: string().from('project_id'),
    path: string(),
    parentPath: string().from('parent_path').optional(),
    name: string(),
    kind: enumeration<'file' | 'folder'>(),
    blobId: string().from('blob_id').optional(),
    sha256: string().optional(),
    lineCount: number().from('line_count').optional(),
    sizeBytes: number().from('size_bytes').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const writingSnapshot = table('writingSnapshot')
  .from('writing_snapshots')
  .columns({
    id: string(),
    projectId: string().from('project_id'),
    parentSnapshotId: string().from('parent_snapshot_id').optional(),
    source: enumeration<'user' | 'ai' | 'restore' | 'system'>(),
    summary: string(),
    chatId: string().from('chat_id').optional(),
    messageId: string().from('message_id').optional(),
    createdByUserId: string().from('created_by_user_id'),
    restoredFromSnapshotId: string().from('restored_from_snapshot_id').optional(),
    createdAt: number().from('created_at'),
  })
  .primaryKey('id')

const writingSnapshotEntry = table('writingSnapshotEntry')
  .from('writing_snapshot_entries')
  .columns({
    id: string(),
    snapshotId: string().from('snapshot_id'),
    path: string(),
    kind: enumeration<'file' | 'folder'>(),
    blobId: string().from('blob_id').optional(),
    sha256: string().optional(),
    lineCount: number().from('line_count').optional(),
  })
  .primaryKey('id')

const writingProjectChat = table('writingProjectChat')
  .from('writing_project_chats')
  .columns({
    id: string(),
    projectId: string().from('project_id'),
    ownerUserId: string().from('owner_user_id'),
    title: string(),
    modelId: string().from('model_id'),
    status: enumeration<'active' | 'archived'>(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
    lastMessageAt: number().from('last_message_at'),
  })
  .primaryKey('id')

const writingChatMessage = table('writingChatMessage')
  .from('writing_chat_messages')
  .columns({
    id: string(),
    chatId: string().from('chat_id'),
    projectId: string().from('project_id'),
    role: enumeration<'user' | 'assistant' | 'system'>(),
    content: string(),
    status: enumeration<'pending' | 'done' | 'error'>(),
    metadataJson: json().from('metadata_json'),
    changeSetId: string().from('change_set_id').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const writingChatSession = table('writingChatSession')
  .from('writing_chat_sessions')
  .columns({
    chatId: string().from('chat_id'),
    projectId: string().from('project_id'),
    sessionJsonl: string().from('session_jsonl'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('chatId')

const writingChangeSet = table('writingChangeSet')
  .from('writing_change_sets')
  .columns({
    id: string(),
    projectId: string().from('project_id'),
    chatId: string().from('chat_id'),
    assistantMessageId: string().from('assistant_message_id').optional(),
    baseSnapshotId: string().from('base_snapshot_id'),
    status: enumeration<
      'pending' | 'partially_applied' | 'applied' | 'rejected' | 'conflicted'
    >(),
    autoAccept: boolean().from('auto_accept'),
    summary: string(),
    createdAt: number().from('created_at'),
    resolvedAt: number().from('resolved_at').optional(),
  })
  .primaryKey('id')

const writingChange = table('writingChange')
  .from('writing_changes')
  .columns({
    id: string(),
    changeSetId: string().from('change_set_id'),
    path: string(),
    fromPath: string().from('from_path').optional(),
    operation: enumeration<'create' | 'update' | 'delete' | 'move'>(),
    baseBlobId: string().from('base_blob_id').optional(),
    proposedBlobId: string().from('proposed_blob_id').optional(),
    status: enumeration<
      'pending' | 'rejected' | 'applied' | 'conflicted'
    >(),
    createdAt: number().from('created_at'),
  })
  .primaryKey('id')

const writingChangeHunk = table('writingChangeHunk')
  .from('writing_change_hunks')
  .columns({
    id: string(),
    changeId: string().from('change_id'),
    hunkIndex: number().from('hunk_index'),
    status: enumeration<
      'pending' | 'rejected' | 'applied' | 'conflicted'
    >(),
    oldStart: number().from('old_start'),
    oldLines: number().from('old_lines'),
    newStart: number().from('new_start'),
    newLines: number().from('new_lines'),
    patchText: string().from('patch_text'),
    createdAt: number().from('created_at'),
  })
  .primaryKey('id')

const userSkill = table('userSkill')
  .from('user_skills')
  .columns({
    id: string(),
    ownerUserId: string().from('owner_user_id'),
    slug: string(),
    title: string(),
    instructions: string(),
    archivedAt: number().from('archived_at').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const writingProjectSkillLink = table('writingProjectSkillLink')
  .from('writing_project_skill_links')
  .columns({
    id: string(),
    projectId: string().from('project_id'),
    userSkillId: string().from('user_skill_id'),
    createdAt: number().from('created_at'),
  })
  .primaryKey('id')

// ---------------------------------------------------------------------------
// Relationships (optional; use for .related() in ZQL)
// ---------------------------------------------------------------------------

const organizationRelationships = relationships(organization, ({ many }) => ({
  members: many({
    sourceField: ['id'],
    destSchema: member,
    destField: ['organizationId'],
  }),
  invitations: many({
    sourceField: ['id'],
    destSchema: invitation,
    destField: ['organizationId'],
  }),
  billingAccounts: many({
    sourceField: ['id'],
    destSchema: orgBillingAccount,
    destField: ['organizationId'],
  }),
  subscriptions: many({
    sourceField: ['id'],
    destSchema: orgSubscription,
    destField: ['organizationId'],
  }),
  entitlementSnapshots: many({
    sourceField: ['id'],
    destSchema: orgEntitlementSnapshot,
    destField: ['organizationId'],
  }),
  orgPolicies: many({
    sourceField: ['id'],
    destSchema: orgPolicy,
    destField: ['organizationId'],
  }),
  productConfigs: many({
    sourceField: ['id'],
    destSchema: orgProductConfig,
    destField: ['organizationId'],
  }),
  productPolicies: many({
    sourceField: ['id'],
    destSchema: orgProductPolicy,
    destField: ['organizationId'],
  }),
  memberAccess: many({
    sourceField: ['id'],
    destSchema: orgMemberAccess,
    destField: ['organizationId'],
  }),
  usageSummaries: many({
    sourceField: ['id'],
    destSchema: orgUserUsageSummary,
    destField: ['organizationId'],
  }),
}))

const memberRelationships = relationships(member, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
  user: one({
    sourceField: ['userId'],
    destField: ['id'],
    destSchema: user,
  }),
  access: one({
    sourceField: ['organizationId', 'userId'],
    destField: ['organizationId', 'userId'],
    destSchema: orgMemberAccess,
  }),
}))

const orgPolicyRelationships = relationships(orgPolicy, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const orgProductConfigRelationships = relationships(orgProductConfig, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const orgProductPolicyRelationships = relationships(orgProductPolicy, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const attachmentRelationships = relationships(attachment, ({ one }) => ({
  organization: one({
    sourceField: ['ownerOrgId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const orgSubscriptionRelationships = relationships(orgSubscription, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
  billingAccount: one({
    sourceField: ['billingAccountId'],
    destField: ['id'],
    destSchema: orgBillingAccount,
  }),
}))

const orgUserUsageSummaryRelationships = relationships(orgUserUsageSummary, ({ one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const messageRelationships = relationships(message, ({ one }) => ({
  thread: one({
    sourceField: ['threadId'],
    destField: ['threadId'],
    destSchema: thread,
  }),
}))

const writingProjectRelationships = relationships(writingProject, ({ many }) => ({
  entries: many({
    sourceField: ['id'],
    destSchema: writingEntry,
    destField: ['projectId'],
  }),
  snapshots: many({
    sourceField: ['id'],
    destSchema: writingSnapshot,
    destField: ['projectId'],
  }),
  chats: many({
    sourceField: ['id'],
    destSchema: writingProjectChat,
    destField: ['projectId'],
  }),
  changeSets: many({
    sourceField: ['id'],
    destSchema: writingChangeSet,
    destField: ['projectId'],
  }),
  skillLinks: many({
    sourceField: ['id'],
    destSchema: writingProjectSkillLink,
    destField: ['projectId'],
  }),
}))

const writingEntryRelationships = relationships(writingEntry, ({ one }) => ({
  project: one({
    sourceField: ['projectId'],
    destField: ['id'],
    destSchema: writingProject,
  }),
  blob: one({
    sourceField: ['blobId'],
    destField: ['id'],
    destSchema: writingBlob,
  }),
}))

const writingSnapshotRelationships = relationships(writingSnapshot, ({ many, one }) => ({
  project: one({
    sourceField: ['projectId'],
    destField: ['id'],
    destSchema: writingProject,
  }),
  entries: many({
    sourceField: ['id'],
    destSchema: writingSnapshotEntry,
    destField: ['snapshotId'],
  }),
}))

const writingSnapshotEntryRelationships = relationships(
  writingSnapshotEntry,
  ({ one }) => ({
    snapshot: one({
      sourceField: ['snapshotId'],
      destField: ['id'],
      destSchema: writingSnapshot,
    }),
    blob: one({
      sourceField: ['blobId'],
      destField: ['id'],
      destSchema: writingBlob,
    }),
  }),
)

const writingProjectChatRelationships = relationships(
  writingProjectChat,
  ({ many, one }) => ({
    project: one({
      sourceField: ['projectId'],
      destField: ['id'],
      destSchema: writingProject,
    }),
    messages: many({
      sourceField: ['id'],
      destSchema: writingChatMessage,
      destField: ['chatId'],
    }),
    changeSets: many({
      sourceField: ['id'],
      destSchema: writingChangeSet,
      destField: ['chatId'],
    }),
    session: one({
      sourceField: ['id'],
      destField: ['chatId'],
      destSchema: writingChatSession,
    }),
  }),
)

const writingChatMessageRelationships = relationships(
  writingChatMessage,
  ({ one }) => ({
    chat: one({
      sourceField: ['chatId'],
      destField: ['id'],
      destSchema: writingProjectChat,
    }),
    project: one({
      sourceField: ['projectId'],
      destField: ['id'],
      destSchema: writingProject,
    }),
    changeSet: one({
      sourceField: ['changeSetId'],
      destField: ['id'],
      destSchema: writingChangeSet,
    }),
  }),
)

const writingChatSessionRelationships = relationships(
  writingChatSession,
  ({ one }) => ({
    chat: one({
      sourceField: ['chatId'],
      destField: ['id'],
      destSchema: writingProjectChat,
    }),
    project: one({
      sourceField: ['projectId'],
      destField: ['id'],
      destSchema: writingProject,
    }),
  }),
)

const writingChangeSetRelationships = relationships(
  writingChangeSet,
  ({ many, one }) => ({
    project: one({
      sourceField: ['projectId'],
      destField: ['id'],
      destSchema: writingProject,
    }),
    chat: one({
      sourceField: ['chatId'],
      destField: ['id'],
      destSchema: writingProjectChat,
    }),
    changes: many({
      sourceField: ['id'],
      destSchema: writingChange,
      destField: ['changeSetId'],
    }),
  }),
)

const writingChangeRelationships = relationships(writingChange, ({ many, one }) => ({
  changeSet: one({
    sourceField: ['changeSetId'],
    destField: ['id'],
    destSchema: writingChangeSet,
  }),
  hunks: many({
    sourceField: ['id'],
    destSchema: writingChangeHunk,
    destField: ['changeId'],
  }),
}))

const writingChangeHunkRelationships = relationships(writingChangeHunk, ({ one }) => ({
  change: one({
    sourceField: ['changeId'],
    destField: ['id'],
    destSchema: writingChange,
  }),
}))

const userSkillRelationships = relationships(userSkill, ({ many }) => ({
  projectLinks: many({
    sourceField: ['id'],
    destSchema: writingProjectSkillLink,
    destField: ['userSkillId'],
  }),
}))

const writingProjectSkillLinkRelationships = relationships(
  writingProjectSkillLink,
  ({ one }) => ({
    project: one({
      sourceField: ['projectId'],
      destField: ['id'],
      destSchema: writingProject,
    }),
    userSkill: one({
      sourceField: ['userSkillId'],
      destField: ['id'],
      destSchema: userSkill,
    }),
  }),
)

// ---------------------------------------------------------------------------
// Schema export and default types
// ---------------------------------------------------------------------------

export const schema = createSchema({
  tables: [
    user,
    organization,
    member,
    invitation,
    orgPolicy,
    orgProductConfig,
    orgProductPolicy,
    orgBillingAccount,
    orgSubscription,
    orgEntitlementSnapshot,
    orgMemberAccess,
    orgUserUsageSummary,
    thread,
    message,
    attachment,
    writingProject,
    writingBlob,
    writingEntry,
    writingSnapshot,
    writingSnapshotEntry,
    writingProjectChat,
    writingChatMessage,
    writingChatSession,
    writingChangeSet,
    writingChange,
    writingChangeHunk,
    userSkill,
    writingProjectSkillLink,
  ],
  relationships: [
    organizationRelationships,
    memberRelationships,
    orgPolicyRelationships,
    orgProductConfigRelationships,
    orgProductPolicyRelationships,
    attachmentRelationships,
    orgSubscriptionRelationships,
    orgUserUsageSummaryRelationships,
    messageRelationships,
    writingProjectRelationships,
    writingEntryRelationships,
    writingSnapshotRelationships,
    writingSnapshotEntryRelationships,
    writingProjectChatRelationships,
    writingChatMessageRelationships,
    writingChatSessionRelationships,
    writingChangeSetRelationships,
    writingChangeRelationships,
    writingChangeHunkRelationships,
    userSkillRelationships,
    writingProjectSkillLinkRelationships,
  ],
})

export type Schema = typeof schema

/**
 * Auth context passed through Zero query/mutate endpoints.
 * `organizationId` is optional because users can browse without an active org,
 * but org-scoped queries/mutators must explicitly guard against that case.
 */
export type ZeroContext = {
  userID: string
  organizationId?: string
  isAnonymous: boolean
}

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema
    context: ZeroContext
  }
}
