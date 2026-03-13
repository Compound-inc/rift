'use client'

import { useRef, useState } from 'react'
import { ContentPage } from '@/components/layout'
import {
  ORG_KNOWLEDGE_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'
import { ORG_KNOWLEDGE_UPLOAD_ACCEPT } from '@/lib/shared/org-knowledge'
import { useOrgKnowledge } from '@/lib/frontend/org-knowledge/use-org-knowledge'

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return 'Not indexed yet'
  return new Date(timestamp).toLocaleString()
}

/**
 * Organization knowledge admin page. The list is driven by an admin-only Zero
 * metadata query while writes go through TanStack Start server functions.
 */
export function OrgKnowledgePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { items, loading, pending, uploading, error, upload, setActive, remove, retryIndex } =
    useOrgKnowledge()

  const handleFileSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = getUploadValidationError(file, ORG_KNOWLEDGE_UPLOAD_POLICY)
    if (validationError) {
      setUploadError(validationError)
      return
    }

    setUploadError(null)
    await upload(file)
  }

  return (
    <ContentPage
      title="Organization Knowledge"
      description="Upload Markdown or PDF knowledge files that every chat request in this organization can retrieve when the file is marked active."
    >
      <section className="space-y-4">
        <div className="rounded-xl border border-border-base bg-surface-panel p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground-primary">
                Upload knowledge file
              </h2>
              <p className="text-sm text-foreground-secondary">
                Supported formats follow the existing chat attachment conversion pipeline. Uploaded files stay inactive until you enable them.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-foreground-primary px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading...' : 'Upload file'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ORG_KNOWLEDGE_UPLOAD_ACCEPT}
            className="hidden"
            onChange={handleFileSelection}
          />

          {(uploadError || error) && (
            <div
              className="mt-4 rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
              role="alert"
            >
              {uploadError ?? error}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-base bg-surface-panel p-4">
          <div className="mb-4 space-y-1">
            <h2 className="text-base font-medium text-foreground-primary">
              Active organization knowledge
            </h2>
            <p className="text-sm text-foreground-secondary">
              Active files participate in org-wide retrieval. Inactive files remain stored and can be re-enabled later.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-foreground-secondary" role="status">
              Loading organization knowledge...
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-foreground-secondary">
              No organization knowledge files have been uploaded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-border-base bg-background/40 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div>
                        <h3 className="text-sm font-medium text-foreground-primary">
                          {item.fileName}
                        </h3>
                        <p className="text-xs text-foreground-secondary">
                          {item.mimeType} · {formatFileSize(item.fileSize)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary">
                        <span className="rounded-full border border-border-base px-2 py-1">
                          {item.orgKnowledgeActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="rounded-full border border-border-base px-2 py-1">
                          {item.vectorIndexedAt ? 'Indexed' : 'Pending index'}
                        </span>
                        {item.vectorError ? (
                          <span className="rounded-full border border-border-base px-2 py-1 text-foreground-error">
                            Index error
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-foreground-secondary">
                        Last indexed: {formatTimestamp(item.vectorIndexedAt)}
                      </p>

                      {item.vectorError ? (
                        <p className="text-xs text-foreground-error">
                          {item.vectorError}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border-base px-3 py-2 text-sm text-foreground-primary transition hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pending}
                        onClick={() => void setActive(item.id, !item.orgKnowledgeActive)}
                      >
                        {item.orgKnowledgeActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border-base px-3 py-2 text-sm text-foreground-primary transition hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pending}
                        onClick={() => void retryIndex(item.id)}
                      >
                        Retry index
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border-base px-3 py-2 text-sm text-foreground-error transition hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pending}
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </ContentPage>
  )
}
