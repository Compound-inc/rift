import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rift',
    short_name: 'Rift',
    description: 'Plataforma que unifica todos los modelos de IA en una sola app empresarial.',
    start_url: '/chat',
    scope: '/',
    display: 'standalone',
    background_color: '#FBFBFB',
    theme_color: '#FBFBFB',
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

