import { describe, expect, it } from 'vitest'
import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  ORG_KNOWLEDGE_UPLOAD_POLICY,
  getUploadValidationError,
  isAcceptedUploadFile,
} from './upload-validation'

describe('upload validation policies', () => {
  it('accepts markdown files for org knowledge uploads', () => {
    const file = {
      name: 'handbook.md',
      type: 'text/markdown',
      size: 128,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, ORG_KNOWLEDGE_UPLOAD_POLICY)).toBe(true)
    expect(getUploadValidationError(file, ORG_KNOWLEDGE_UPLOAD_POLICY)).toBeNull()
  })

  it('rejects markdown files for general chat attachments', () => {
    const file = {
      name: 'handbook.md',
      type: 'text/markdown',
      size: 128,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBe(false)
  })

  it('rejects empty org knowledge uploads', () => {
    const file = {
      name: 'guide.pdf',
      type: 'application/pdf',
      size: 0,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(getUploadValidationError(file, ORG_KNOWLEDGE_UPLOAD_POLICY)).toBe('File is empty')
  })
})
