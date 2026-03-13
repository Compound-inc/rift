import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  ORG_KNOWLEDGE_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'

function validateOrgKnowledgeUpload(input: unknown): FormData {
  if (!(input instanceof FormData)) {
    throw new Error('Expected multipart form data')
  }
  const file = input.get('file')
  if (!(file instanceof File)) {
    throw new Error('A file is required')
  }
  const validationError = getUploadValidationError(file, ORG_KNOWLEDGE_UPLOAD_POLICY)
  if (validationError) {
    throw new Error(validationError)
  }
  return input
}

const orgKnowledgeAttachmentIdInput = z.object({
  attachmentId: z.string().trim().min(1),
})

const orgKnowledgeActiveInput = orgKnowledgeAttachmentIdInput.extend({
  active: z.boolean(),
})

export const uploadOrgKnowledge = createServerFn({ method: 'POST' })
  .inputValidator(validateOrgKnowledgeUpload)
  .handler(async ({ data }) => {
    const { uploadOrgKnowledgeAction } = await import('./org-knowledge.server')
    const file = data.get('file')
    if (!(file instanceof File)) {
      throw new Error('A file is required')
    }
    return uploadOrgKnowledgeAction(file)
  })

export const setOrgKnowledgeActive = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => orgKnowledgeActiveInput.parse(input))
  .handler(async ({ data }) => {
    const { setOrgKnowledgeActiveAction } = await import('./org-knowledge.server')
    return setOrgKnowledgeActiveAction(data)
  })

export const deleteOrgKnowledge = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => orgKnowledgeAttachmentIdInput.parse(input))
  .handler(async ({ data }) => {
    const { deleteOrgKnowledgeAction } = await import('./org-knowledge.server')
    return deleteOrgKnowledgeAction(data)
  })

export const retryOrgKnowledgeIndex = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => orgKnowledgeAttachmentIdInput.parse(input))
  .handler(async ({ data }) => {
    const { retryOrgKnowledgeIndexAction } = await import('./org-knowledge.server')
    return retryOrgKnowledgeIndexAction(data)
  })
