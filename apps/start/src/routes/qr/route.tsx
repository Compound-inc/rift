import { createFileRoute } from '@tanstack/react-router'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Serves the rift-web.pdf brochure directly at /qr.
 *
 * Returning raw PDF bytes with `Content-Type: application/pdf` lets the
 * browser open its native PDF viewer. This avoids every cross-browser
 * iframe/embed quirk (Chrome mobile "Open" button, Safari 1-page limit, etc.)
 * because the browser handles the file exactly like S3 or any static host.
 */
export const Route = createFileRoute('/qr')({
  server: {
    handlers: {
      GET: async () => {
        const candidates = [
          resolve(process.cwd(), 'public/rift-web.pdf'),
          resolve(process.cwd(), '.output/public/rift-web.pdf'),
        ]

        const pdfPath = candidates.find(p => existsSync(p))
        if (!pdfPath) {
          return new Response('PDF not found', { status: 404 })
        }

        const pdf = await readFile(pdfPath)
        return new Response(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="rift-web.pdf"',
          },
        })
      },
    },
  },
})
