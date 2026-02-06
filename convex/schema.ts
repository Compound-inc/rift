import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const providerMetadataValidor = v.optional(
  v.record(v.string(), v.any()),
);

export const MessagesStatusValidor = v.union(
  v.literal("waiting"),
  v.literal("thinking"),
  v.literal("streaming"),
  v.literal("done"),
  v.literal("error"),
  v.literal("error.rejected"),
  v.literal("deleted"),
  v.literal("cancelled"),
);

export const productStatusValidator = v.union(
  v.literal("active"),
  v.literal("expired"),
  v.literal("scheduled"),
  v.literal("trialing"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("none"),
  v.literal("incomplete"),
  v.literal("incomplete_expired"),
  v.literal("unpaid"),
);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    workos_id: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    //Legacy fields (allow existing docs to validate; remove after migration)
    standardQuotaUsage: v.optional(v.number()),
    premiumQuotaUsage: v.optional(v.number()),
    lastQuotaResetAt: v.optional(v.number()),
  }).index("by_workos_id", ["workos_id"]),
  organizations: defineTable({
    workos_id: v.string(),
    name: v.string(),
    plan: v.optional(v.union(v.literal("free"), v.literal("plus"), v.literal("pro"), v.literal("enterprise"), v.null())),
    productStatus: v.optional(productStatusValidator),
    // Legacy fields (allow existing docs to validate; remove after migration)
    seatQuantity: v.optional(v.number()),
    productId: v.optional(v.string()),
    billingCycleStart: v.optional(v.number()),
    billingCycleEnd: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    priceId: v.optional(v.string()),
    paymentMethodBrand: v.optional(v.string()),
    paymentMethodLast4: v.optional(v.string()),
    standardQuotaLimit: v.optional(v.number()),
    premiumQuotaLimit: v.optional(v.number()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    subscriptionIds: v.optional(v.array(v.string())),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  }).index("by_workos_id", ["workos_id"]),
  threads: defineTable({
    threadId: v.string(), // User client Defined
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
    generationStatus: v.union(
      v.literal("pending"),
      v.literal("generation"),
      v.literal("completed"),
      v.literal("failed"),
    ),

    visibility: v.union(v.literal("visible"), v.literal("archived")),

    userSetTitle: v.optional(v.boolean()),

    userId: v.string(),

    model: v.string(),
    responseStyle: v.optional(
      v.union(
        v.literal("regular"),
        v.literal("learning"),
        v.literal("technical"),
        v.literal("concise"),
      ),
    ),
    pinned: v.boolean(),
    branchParentThreadId: v.optional(v.id("threads")),
    branchParentPublicMessageId: v.optional(v.string()),

    // Sharing status (lightweight flags for quick UI reads)
    shareId: v.optional(v.string()),
    shareStatus: v.optional(
      v.union(v.literal("active"), v.literal("revoked")),
    ),
    sharedAt: v.optional(v.number()),
    allowAttachments: v.optional(v.boolean()),
    orgOnly: v.optional(v.boolean()),
    shareName: v.optional(v.boolean()),
    ownerOrgId: v.optional(v.string()),
    customInstructionId: v.optional(v.id("customInstructions")),
  })
    .index("by_user", ["userId"])
    .index("by_threadId", ["threadId"])
    .index("by_user_and_threadId", ["userId", "threadId"])
    .index("by_user_and_updatedAt", ["userId", "updatedAt"])
    .index("by_user_and_pinned", ["userId", "pinned"])
    .index("by_shareId", ["shareId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId"],
    }),

  messages: defineTable({
    messageId: v.string(),
    threadId: v.string(), // User Defined Thread Id
    userId: v.string(),

    reasoning: v.optional(v.string()),
    content: v.string(),
    status: MessagesStatusValidor,
    updated_at: v.optional(v.number()),
    branches: v.optional(v.array(v.id("threads"))),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    created_at: v.number(),
    serverError: v.optional(
      v.object({
        type: v.string(),
        message: v.string(),
      }),
    ),
    model: v.string(),
    attachmentsIds: v.array(v.id("attachments")),
    sources: v.optional(v.array(
      v.object({
        sourceId: v.string(),
        url: v.string(),
        title: v.optional(v.string()),
      })
    )),
    modelParams: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        topP: v.optional(v.number()),
        topK: v.optional(v.number()),
        reasoningEffort: v.optional(
          v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        ),
        includeSearch: v.optional(v.boolean()),
      }),
    ),
    providerMetadata: providerMetadataValidor,
  })
    .index("by_treadId", ["threadId"])
    .index("by_thread_and_userId", ["threadId", "userId"])
    .index("by_messageId_and_userId", ["messageId", "userId"])
    .index("by_user", ["userId"]) 
    .index("by_thread_and_user_and_created_at", ["threadId", "userId", "created_at"]),

  attachments: defineTable({
    publicMessageIds: v.array(v.id("messages")),
    userId: v.string(),
    attachmentType: v.union(v.literal("image"), v.literal("pdf"), v.literal("file")),
    attachmentUrl: v.string(),

    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.string(),
    fileKey: v.string(),
    status: v.optional(v.union(v.literal("delated"), v.literal("uploaded"))),
  })
    .index("by_fileKey", ["fileKey"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_fileKey", ["userId", "fileKey"]),

  sharedThreads: defineTable({
    shareId: v.string(),
    threadId: v.string(),
    userId: v.string(),
    ownerOrgId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),
    messageCount: v.optional(v.number()),
    allowAttachments: v.optional(v.boolean()),
    orgOnly: v.optional(v.boolean()),
    shareName: v.optional(v.boolean()),
  })
    .index("by_shareId", ["shareId"])
    .index("by_user_and_threadId", ["userId", "threadId"]),

  userConfiguration: defineTable({
    userId: v.string(),
    supermemoryEnabled: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  bugs: defineTable({
    userId: v.string(),
    orgId: v.optional(v.string()),
    userEmail: v.string(),
    title: v.string(),
    description: v.string(),
    stepsToReproduce: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    browserDetails: v.string(),
    reportedAt: v.number(),
  })
    .index("by_user", ["userId"]) 
    .index("by_org_and_reportedAt", ["orgId", "reportedAt"]),

  customInstructions: defineTable({
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    iconColor: v.optional(v.string()),
    instructions: v.string(),
    ownerId: v.string(),
    orgId: v.optional(v.string()),
    isSharedWithOrg: v.boolean(),
    usageCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_org", ["orgId"])
    .index("by_usage", ["usageCount"]),
  customInstructionShares: defineTable({
    instructionId: v.id("customInstructions"),
    userId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_instruction", ["instructionId"]),
});
