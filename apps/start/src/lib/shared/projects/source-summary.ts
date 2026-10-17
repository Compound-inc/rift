export type ProjectSourceSummary = {
  readonly count: number
  readonly files: readonly {
    readonly id: string
    readonly fileName: string
    readonly embeddingStatus: string | null
  }[]
}

/** File-list metadata excludes download URLs, storage keys and document text. */
export type ProjectSourceMetadata = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly embeddingStatus: string | null
  readonly vectorIndexedAt: number | null
  readonly updatedAt: number
}
