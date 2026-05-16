import { createFileRoute } from '@tanstack/react-router'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'

/**
 * QR landing page route. Displays the rift-web.pdf brochure inline.
 */
export const Route = createFileRoute('/qr')({
  head: () => ({
    meta: buildPageMetadata({
      title: 'Rift - Web',
      description: 'Rift web brochure and product overview.',
    }),
  }),
  component: QrPage,
})

function QrPage() {
  return (
    <div className="h-screen w-screen bg-surface-base">
      <iframe
        src="/rift-web.pdf"
        title="Rift Web Brochure"
        className="h-full w-full border-0"
      />
    </div>
  )
}
