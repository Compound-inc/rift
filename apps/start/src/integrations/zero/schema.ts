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
    disabledProviderIds: json<readonly string[]>().from(
      'disabled_provider_ids',
    ),
    disabledModelIds: json<readonly string[]>().from('disabled_model_ids'),
    complianceFlags: json<Record<string, boolean>>().from('compliance_flags'),
    providerNativeToolsEnabled: boolean()
      .from('provider_native_tools_enabled')
      .optional(),
    externalToolsEnabled: boolean().from('external_tools_enabled').optional(),
    disabledToolKeys: json<readonly string[]>().from('disabled_tool_keys'),
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

const orgProductPolicy = table('orgProductPolicy')
  .from('org_product_policy')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    productKey: string().from('product_key'),
    capabilities: json<Record<string, boolean>>(),
    settings: json<Record<string, boolean | string | number | null>>(),
    disabledProviderIds: json<readonly string[]>().from(
      'disabled_provider_ids',
    ),
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
    providerSubscriptionId: string()
      .from('provider_subscription_id')
      .optional(),
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
    effectiveFeatures:
      json<Record<string, boolean | string | number>>().from(
        'effective_features',
      ),
    productAddonEntitlements: json<Record<string, boolean>>().from(
      'product_addon_entitlements',
    ),
    usagePolicy:
      json<Record<string, boolean | string | number>>().from('usage_policy'),
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
    >().from('generation_status'),
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
    activeChildByParent: json<Record<string, string>>().from(
      'active_child_by_parent',
    ),
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
    branchAnchorMessageId: string().from('branch_anchor_message_id').optional(),
    regenSourceMessageId: string().from('regen_source_message_id').optional(),
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
    sources:
      json<
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
    accessGroupIds: json<readonly string[]>()
      .from('access_group_ids')
      .optional(),
    vectorIndexedAt: number().from('vector_indexed_at').optional(),
    vectorError: string().from('vector_error').optional(),
    status: enumeration<'deleted' | 'uploaded'>().optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

// ---------------------------------------------------------------------------
// HR Recruitment tables
// ---------------------------------------------------------------------------

const hrPosition = table('hrPosition')
  .from('hr_position')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    title: string(),
    department: string(),
    location: string(),
    arrangement: enumeration<'remote' | 'hybrid' | 'onsite'>(),
    employmentType: enumeration<
      'full_time' | 'part_time' | 'contract' | 'internship'
    >().from('employment_type'),
    status: enumeration<'draft' | 'open' | 'paused' | 'filled' | 'archived'>(),
    description: string(),
    hiringManager: string().from('hiring_manager'),
    compensation: string(),
    tags: json<readonly string[]>(),
    recommendedEvaluationKinds: json<readonly string[]>().from(
      'recommended_evaluation_kinds',
    ),
    descriptionEmbedding: json<readonly number[]>()
      .from('description_embedding')
      .optional(),
    descriptionEmbeddingModel: string()
      .from('description_embedding_model')
      .optional(),
    descriptionEmbeddingDimensions: number()
      .from('description_embedding_dimensions')
      .optional(),
    descriptionEmbeddingUpdatedAt: number()
      .from('description_embedding_updated_at')
      .optional(),
    archivedAt: number().from('archived_at').optional(),
    archivedBy: string().from('archived_by').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
    createdBy: string().from('created_by'),
  })
  .primaryKey('id')

const hrCandidate = table('hrCandidate')
  .from('hr_candidate')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    normalizedEmail: string().from('normalized_email').optional(),
    email: string().optional(),
    displayName: string().from('display_name'),
    phone: string().optional(),
    latestCvAttachmentId: string().from('latest_cv_attachment_id').optional(),
    latestCvText: string().from('latest_cv_text').optional(),
    latestCvEmbedding: json<readonly number[]>()
      .from('latest_cv_embedding')
      .optional(),
    latestCvEmbeddingModel: string()
      .from('latest_cv_embedding_model')
      .optional(),
    latestCvEmbeddingDimensions: number()
      .from('latest_cv_embedding_dimensions')
      .optional(),
    latestCvIndexedAt: number().from('latest_cv_indexed_at').optional(),
    aliases: json<readonly { name?: string; email?: string }[]>(),
    tags: json<readonly string[]>(),
    mergedIntoCandidateId: string().from('merged_into_candidate_id').optional(),
    needsContactReview: boolean().from('needs_contact_review'),
    archivedAt: number().from('archived_at').optional(),
    archivedBy: string().from('archived_by').optional(),
    notes: string().optional(),
    location: string().optional(),
    headline: string().optional(),
    summary: string().optional(),
    yearsOfExperience: number().from('years_of_experience').optional(),
    skills: json<readonly string[]>(),
    languages: json<readonly string[]>(),
    highestDegree: string().from('highest_degree').optional(),
    profileSource: string().from('profile_source').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const hrApplication = table('hrApplication')
  .from('hr_application')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    candidateId: string().from('candidate_id'),
    positionId: string().from('position_id'),
    stage: enumeration<
      | 'uploaded'
      | 'scoring'
      | 'awaiting_test'
      | 'evaluating'
      | 'awaiting_verification'
      | 'advanced'
      | 'rejected'
      | 'hired'
    >(),
    affinityScore: number().from('affinity_score').optional(),
    affinityRationale: string().from('affinity_rationale').optional(),
    affinitySignals: json<Record<string, string | number | boolean | null>>()
      .from('affinity_signals')
      .optional(),
    affinityModel: string().from('affinity_model').optional(),
    cvAttachmentId: string().from('cv_attachment_id').optional(),
    cvText: string().from('cv_text').optional(),
    cvEmbedding: json<readonly number[]>().from('cv_embedding').optional(),
    cvEmbeddingModel: string().from('cv_embedding_model').optional(),
    aiProfileSnapshot: json<Record<string, string | number | boolean | null>>()
      .from('ai_profile_snapshot')
      .optional(),
    aiSignals: json<Record<string, string | number | boolean | null>>()
      .from('ai_signals')
      .optional(),
    workflowRunId: string().from('workflow_run_id').optional(),
    lastTransitionAt: number().from('last_transition_at').optional(),
    lastError: string().from('last_error').optional(),
    rejectionReason: string().from('rejection_reason').optional(),
    hiredAt: number().from('hired_at').optional(),
    archivedAt: number().from('archived_at').optional(),
    archivedBy: string().from('archived_by').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const hrEvaluationDispatch = table('hrEvaluationDispatch')
  .from('hr_evaluation_dispatch')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    applicationId: string().from('application_id'),
    evaluationCatalogId: string().from('evaluation_catalog_id'),
    dispatchedVia: string().from('dispatched_via'),
    status: enumeration<'sent' | 'completed' | 'expired' | 'cancelled'>(),
    resumeHookToken: string().from('resume_hook_token').optional(),
    idempotencyKey: string().from('idempotency_key'),
    completionUrl: string().from('completion_url').optional(),
    expiresAt: number().from('expires_at').optional(),
    dispatchedAt: number().from('dispatched_at'),
    completedAt: number().from('completed_at').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const hrEvaluationResponse = table('hrEvaluationResponse')
  .from('hr_evaluation_response')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    dispatchId: string().from('dispatch_id'),
    applicationId: string().from('application_id'),
    answers:
      json<readonly Record<string, string | number | boolean | null>[]>(),
    score: number().optional(),
    scoredBy: enumeration<'auto' | 'manual' | 'pending'>().from('scored_by'),
    passed: boolean().optional(),
    submittedAt: number().from('submitted_at'),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
  })
  .primaryKey('id')

const hrBackgroundCheck = table('hrBackgroundCheck')
  .from('hr_background_check')
  .columns({
    id: string(),
    organizationId: string().from('organization_id'),
    applicationId: string().from('application_id'),
    candidateId: string().from('candidate_id'),
    provider: string(),
    status: enumeration<
      'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
    >(),
    passed: boolean().optional(),
    creditScore: number().from('credit_score').optional(),
    legalFlags:
      json<
        readonly { code: string; severity: string; message: string }[]
      >().from('legal_flags'),
    rawPayload: json<Record<string, string | number | boolean | null>>()
      .from('raw_payload')
      .optional(),
    resumeWebhookUrl: string().from('resume_webhook_url').optional(),
    idempotencyKey: string().from('idempotency_key'),
    requestedAt: number().from('requested_at'),
    completedAt: number().from('completed_at').optional(),
    createdAt: number().from('created_at'),
    updatedAt: number().from('updated_at'),
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

const orgProductPolicyRelationships = relationships(
  orgProductPolicy,
  ({ one }) => ({
    organization: one({
      sourceField: ['organizationId'],
      destField: ['id'],
      destSchema: organization,
    }),
  }),
)

const attachmentRelationships = relationships(attachment, ({ one }) => ({
  organization: one({
    sourceField: ['ownerOrgId'],
    destField: ['id'],
    destSchema: organization,
  }),
}))

const orgSubscriptionRelationships = relationships(
  orgSubscription,
  ({ one }) => ({
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
  }),
)

const orgUserUsageSummaryRelationships = relationships(
  orgUserUsageSummary,
  ({ one }) => ({
    organization: one({
      sourceField: ['organizationId'],
      destField: ['id'],
      destSchema: organization,
    }),
  }),
)

const messageRelationships = relationships(message, ({ one }) => ({
  thread: one({
    sourceField: ['threadId'],
    destField: ['threadId'],
    destSchema: thread,
  }),
}))

// ---------------------------------------------------------------------------
// HR Recruitment relationships
// ---------------------------------------------------------------------------

const hrPositionRelationships = relationships(hrPosition, ({ many, one }) => ({
  organization: one({
    sourceField: ['organizationId'],
    destField: ['id'],
    destSchema: organization,
  }),
  applications: many({
    sourceField: ['id'],
    destSchema: hrApplication,
    destField: ['positionId'],
  }),
}))

const hrCandidateRelationships = relationships(
  hrCandidate,
  ({ many, one }) => ({
    organization: one({
      sourceField: ['organizationId'],
      destField: ['id'],
      destSchema: organization,
    }),
    applications: many({
      sourceField: ['id'],
      destSchema: hrApplication,
      destField: ['candidateId'],
    }),
  }),
)

const hrApplicationRelationships = relationships(
  hrApplication,
  ({ many, one }) => ({
    organization: one({
      sourceField: ['organizationId'],
      destField: ['id'],
      destSchema: organization,
    }),
    position: one({
      sourceField: ['positionId'],
      destField: ['id'],
      destSchema: hrPosition,
    }),
    candidate: one({
      sourceField: ['candidateId'],
      destField: ['id'],
      destSchema: hrCandidate,
    }),
    evaluationDispatches: many({
      sourceField: ['id'],
      destSchema: hrEvaluationDispatch,
      destField: ['applicationId'],
    }),
    evaluationResponses: many({
      sourceField: ['id'],
      destSchema: hrEvaluationResponse,
      destField: ['applicationId'],
    }),
    backgroundCheck: one({
      sourceField: ['id'],
      destField: ['applicationId'],
      destSchema: hrBackgroundCheck,
    }),
  }),
)

const hrEvaluationDispatchRelationships = relationships(
  hrEvaluationDispatch,
  ({ many, one }) => ({
    application: one({
      sourceField: ['applicationId'],
      destField: ['id'],
      destSchema: hrApplication,
    }),
    responses: many({
      sourceField: ['id'],
      destSchema: hrEvaluationResponse,
      destField: ['dispatchId'],
    }),
  }),
)

const hrEvaluationResponseRelationships = relationships(
  hrEvaluationResponse,
  ({ one }) => ({
    application: one({
      sourceField: ['applicationId'],
      destField: ['id'],
      destSchema: hrApplication,
    }),
    dispatch: one({
      sourceField: ['dispatchId'],
      destField: ['id'],
      destSchema: hrEvaluationDispatch,
    }),
  }),
)

const hrBackgroundCheckRelationships = relationships(
  hrBackgroundCheck,
  ({ one }) => ({
    application: one({
      sourceField: ['applicationId'],
      destField: ['id'],
      destSchema: hrApplication,
    }),
    candidate: one({
      sourceField: ['candidateId'],
      destField: ['id'],
      destSchema: hrCandidate,
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
    orgProductPolicy,
    orgBillingAccount,
    orgSubscription,
    orgEntitlementSnapshot,
    orgMemberAccess,
    orgUserUsageSummary,
    thread,
    message,
    attachment,
    hrPosition,
    hrCandidate,
    hrApplication,
    hrEvaluationDispatch,
    hrEvaluationResponse,
    hrBackgroundCheck,
  ],
  relationships: [
    organizationRelationships,
    memberRelationships,
    orgPolicyRelationships,
    orgProductPolicyRelationships,
    attachmentRelationships,
    orgSubscriptionRelationships,
    orgUserUsageSummaryRelationships,
    messageRelationships,
    hrPositionRelationships,
    hrCandidateRelationships,
    hrApplicationRelationships,
    hrEvaluationDispatchRelationships,
    hrEvaluationResponseRelationships,
    hrBackgroundCheckRelationships,
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
