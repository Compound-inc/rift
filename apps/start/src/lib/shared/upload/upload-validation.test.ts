import { describe, expect, it } from 'vitest'
import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  ORG_KNOWLEDGE_UPLOAD_POLICY,
  PROJECT_SOURCES_UPLOAD_POLICY,
  getUploadValidationError,
  isAcceptedUploadFile,
} from './upload-validation'

describe('upload validation policies', () => {
  it('accepts plain text files for general chat attachments', () => {
    const file = {
      name: 'pasted-notes.txt',
      type: 'text/plain',
      size: 2048,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBe(true)
    expect(getUploadValidationError(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBeNull()
  })

  it('accepts plain text mime types with charset parameters', () => {
    const file = {
      name: 'pasted-notes.txt',
      type: 'text/plain;charset=utf-8',
      size: 2048,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBe(true)
    expect(getUploadValidationError(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBeNull()
  })

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

  it('accepts Word .docx files for project sources via mime type', () => {
    const file = {
      name: 'spec.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 32_768,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, PROJECT_SOURCES_UPLOAD_POLICY)).toBe(true)
    expect(
      getUploadValidationError(file, PROJECT_SOURCES_UPLOAD_POLICY),
    ).toBeNull()
  })

  it('accepts Word .docx files for project sources via extension when mime is generic', () => {
    // Some browsers/OSes report `application/octet-stream` for office files;
    // the validator should fall back to the extension check in that case.
    const file = {
      name: 'spec.docx',
      type: 'application/octet-stream',
      size: 32_768,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, PROJECT_SOURCES_UPLOAD_POLICY)).toBe(true)
  })

  it('accepts OpenDocument .odt files for project sources', () => {
    const file = {
      name: 'handbook.odt',
      type: 'application/vnd.oasis.opendocument.text',
      size: 16_384,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, PROJECT_SOURCES_UPLOAD_POLICY)).toBe(true)
  })

  it('keeps org knowledge narrow by rejecting docx uploads there', () => {
    const file = {
      name: 'spec.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 32_768,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, ORG_KNOWLEDGE_UPLOAD_POLICY)).toBe(false)
  })

  it('rejects legacy .doc binaries for project sources (Cloudflare toMarkdown only handles docx)', () => {
    const file = {
      name: 'old.doc',
      type: 'application/msword',
      size: 32_768,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, PROJECT_SOURCES_UPLOAD_POLICY)).toBe(
      false,
    )
  })
})
