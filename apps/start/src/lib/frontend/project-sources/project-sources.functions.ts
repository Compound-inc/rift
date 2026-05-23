import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  PROJECT_SOURCES_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'

const projectIdInput = z.object({
  projectId: z.string().trim().min(1),
})

const projectSourceAttachmentInput = projectIdInput.extend({
  attachmentId: z.string().trim().min(1),
})

function validateProjectSourceUpload(input: unknown): FormData {
  if (!(input instanceof FormData)) {
    throw new Error('Expected multipart form data')
  }
  const projectId = input.get('projectId')
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error('A project is required')
  }
  const files = input.getAll('files')
  if (files.length === 0 || !files.every((file) => file instanceof File)) {
    throw new Error('At least one file is required')
  }
  for (const file of files) {
    const validationError = getUploadValidationError(
      file,
      PROJECT_SOURCES_UPLOAD_POLICY,
    )
    if (validationError) throw new Error(validationError)
  }
  return input
}

export const uploadProjectSources = createServerFn({ method: 'POST' })
  .inputValidator(validateProjectSourceUpload)
  .handler(async ({ data }) => {
    const { uploadProjectSourcesAction } = await import('./project-sources.server')
    const projectId = data.get('projectId')
    const files = data.getAll('files')
    if (typeof projectId !== 'string') throw new Error('A project is required')
    return uploadProjectSourcesAction({
      projectId,
      files: files.filter((file): file is File => file instanceof File),
    })
  })

export const deleteProjectSource = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => projectSourceAttachmentInput.parse(input))
  .handler(async ({ data }) => {
    const { deleteProjectSourceAction } = await import('./project-sources.server')
    return deleteProjectSourceAction(data)
  })

export const retryProjectSourceIndex = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => projectSourceAttachmentInput.parse(input))
  .handler(async ({ data }) => {
    const { retryProjectSourceIndexAction } = await import(
      './project-sources.server'
    )
    return retryProjectSourceIndexAction(data)
  })
