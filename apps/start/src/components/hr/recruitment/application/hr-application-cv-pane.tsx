'use client'

import { useEffect, useState } from 'react'
import { Button } from '@rift/ui/button'
import Download from 'lucide-react/dist/esm/icons/download'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import { cn } from '@rift/utils'
import { resolveApplicationCvUrl } from '@/lib/frontend/hr/recruitment'

export function HrApplicationCvPane({
  applicationId,
  className,
}: {
  readonly applicationId: string
  readonly className?: string
}) {
  const [state, setState] = useState<CvResolveState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    resolveApplicationCvUrl({ data: { applicationId } })
      .then((result) => {
        if (cancelled) return
        if (result.url === null) {
          setState({ status: 'missing' })
          return
        }
        if (result.contentType === 'application/pdf') {
          setState({ status: 'pdf', url: result.url })
        } else {
          setState({ status: 'unsupported', url: result.url })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [applicationId])

  return (
    <section
      aria-label="CV"
      className={cn(
        'flex h-full min-h-[480px] flex-col overflow-hidden rounded-xl border border-border-base bg-surface-raised',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden className="size-4 text-foreground-secondary" />
          <h2 className="text-sm font-medium text-foreground-strong">CV</h2>
        </div>
        {state.status === 'pdf' || state.status === 'unsupported' ? (
          <Button
            asChild
            variant="ghost"
            size="default"
            className="h-7 gap-1 px-2 text-xs text-foreground-tertiary hover:text-foreground-strong"
          >
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              download
              aria-label="Download CV"
            >
              <Download aria-hidden className="size-3.5" />
              Download
            </a>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col">
        {state.status === 'loading' ? <CvLoadingState /> : null}
        {state.status === 'missing' ? <CvMissingState /> : null}
        {state.status === 'error' ? <CvErrorState /> : null}
        {state.status === 'pdf' ? <CvPdfFrame url={state.url} /> : null}
        {state.status === 'unsupported' ? <CvUnsupportedState /> : null}
      </div>
    </section>
  )
}

type CvResolveState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error' }
  | { readonly status: 'pdf'; readonly url: string }
  | { readonly status: 'unsupported'; readonly url: string }

function CvPdfFrame({ url }: { readonly url: string }) {
  const sandbox = getPdfFrameSandbox(url)

  return (
    <iframe
      title="CV preview"
      src={url}
      className="h-full min-h-[480px] w-full flex-1 border-0"
      sandbox={sandbox}
      referrerPolicy="no-referrer"
    />
  )
}

function getPdfFrameSandbox(url: string) {
  if (typeof window === 'undefined') return 'allow-scripts'

  try {
    const frameUrl = new URL(url, window.location.href)
    if (frameUrl.origin === window.location.origin) return 'allow-scripts'
  } catch {
    return 'allow-scripts'
  }

  /**
   * Browser PDF viewers are script-driven in Chromium/WebKit. External storage
   * origins are isolated from Rift, so same-origin is acceptable there.
   */
  return 'allow-same-origin allow-scripts'
}

function CvLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
      <p className="text-sm text-foreground-tertiary">Loading CV…</p>
    </div>
  )
}

function CvMissingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground-strong">
        No CV on file.
      </p>
      <p className="text-xs text-foreground-tertiary">
        Upload a CV from the position page to start the pipeline.
      </p>
    </div>
  )
}

function CvErrorState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground-strong">
        Could not load the CV.
      </p>
      <p className="text-xs text-foreground-tertiary">
        Try refreshing the page.
      </p>
    </div>
  )
}

function CvUnsupportedState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground-strong">
        Inline preview is unavailable.
      </p>
      <p className="text-xs text-foreground-tertiary">
        This CV isn't a PDF. Use the Download button to view the original.
      </p>
    </div>
  )
}
