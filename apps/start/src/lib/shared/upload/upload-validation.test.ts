import { describe, expect, it } from 'vitest'
import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  ORG_KNOWLEDGE_UPLOAD_POLICY,
  getUploadValidationError,
  hasPdfMagicBytes,
  isAcceptedUploadFile,
  isPdfUpload,
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

  it('accepts markdown files for general chat attachments', () => {
    const file = {
      name: 'handbook.md',
      type: 'text/markdown',
      size: 128,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(isAcceptedUploadFile(file, CHAT_ATTACHMENT_UPLOAD_POLICY)).toBe(true)
  })

  it('rejects empty org knowledge uploads', () => {
    const file = {
      name: 'guide.pdf',
      type: 'application/pdf',
      size: 0,
    } satisfies Pick<File, 'name' | 'type' | 'size'>

    expect(getUploadValidationError(file, ORG_KNOWLEDGE_UPLOAD_POLICY)).toBe('File is empty')
  })

  it('detects PDF-labeled uploads by type or extension', () => {
    expect(isPdfUpload({ name: 'cv.pdf', type: 'application/octet-stream' })).toBe(true)
    expect(isPdfUpload({ name: 'cv.bin', type: 'application/pdf' })).toBe(true)
    expect(isPdfUpload({ name: 'cv.txt', type: 'text/plain' })).toBe(false)
  })

  it('validates PDF magic bytes', async () => {
    await expect(hasPdfMagicBytes(new Blob(['%PDF-1.7']))).resolves.toBe(true)
    await expect(hasPdfMagicBytes(new Blob(['<html></html>']))).resolves.toBe(false)
  })
})
