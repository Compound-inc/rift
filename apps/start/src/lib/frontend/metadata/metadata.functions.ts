import type * as React from 'react'
import { createServerFn } from '@tanstack/react-start'

export const DEFAULT_SITE_METADATA = {
  title: 'Rift',
  description: 'Chat with every AI model in one place.',
  siteName: 'Rift',
  socialImagePath: '/og.png',
  socialImageAlt: 'Rift preview image',
  socialImageWidth: 1200,
  socialImageHeight: 630,
} as const

/**
 * TanStack React Router stores route metadata using the React adapter's `meta`
 * element shape, plus a synthetic `title` field that `HeadContent` lifts into
 * a `<title>` tag during render.
 */
type RouteMetaEntry = React.JSX.IntrinsicElements['meta'] & {
  title?: string
  property?: string
}

export function requireAppOrigin() {
  const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim()

  if (!betterAuthUrl) {
    throw new Error('Missing BETTER_AUTH_URL. Social metadata requires an absolute app origin.')
  }

  return betterAuthUrl
}

export function buildAbsoluteMetadataUrl(pathname: string, origin = requireAppOrigin()) {
  return new URL(pathname, `${origin}/`).toString()
}

export function buildPageTitle(pageTitle: string) {
  return `${pageTitle} | ${DEFAULT_SITE_METADATA.siteName}`
}

export function buildPageMetadata(options: {
  readonly title: string
  readonly description: string
  readonly robots?: string
}): RouteMetaEntry[] {
  const robots = options.robots ?? 'index,follow'
  const pageTitle = buildPageTitle(options.title)

  return [
    {
      title: pageTitle,
    },
    {
      name: 'description',
      content: options.description,
    },
    {
      name: 'robots',
      content: robots,
    },
    {
      property: 'og:title',
      content: pageTitle,
    },
    {
      property: 'og:description',
      content: options.description,
    },
    {
      name: 'twitter:title',
      content: pageTitle,
    },
    {
      name: 'twitter:description',
      content: options.description,
    },
  ]
}

export function buildRootMetadata(options: {
  readonly canonicalUrl: string
  readonly socialImageUrl: string
}): RouteMetaEntry[] {
  return [
    {
      charSet: 'utf-8',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
    {
      title: DEFAULT_SITE_METADATA.title,
    },
    {
      name: 'description',
      content: DEFAULT_SITE_METADATA.description,
    },
    {
      name: 'robots',
      content: 'index,follow',
    },
    {
      property: 'og:title',
      content: DEFAULT_SITE_METADATA.title,
    },
    {
      property: 'og:description',
      content: DEFAULT_SITE_METADATA.description,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      property: 'og:site_name',
      content: DEFAULT_SITE_METADATA.siteName,
    },
    {
      property: 'og:url',
      content: options.canonicalUrl,
    },
    {
      property: 'og:image',
      content: options.socialImageUrl,
    },
    {
      property: 'og:image:secure_url',
      content: options.socialImageUrl,
    },
    {
      property: 'og:image:type',
      content: 'image/png',
    },
    {
      property: 'og:image:alt',
      content: DEFAULT_SITE_METADATA.socialImageAlt,
    },
    {
      property: 'og:image:width',
      content: String(DEFAULT_SITE_METADATA.socialImageWidth),
    },
    {
      property: 'og:image:height',
      content: String(DEFAULT_SITE_METADATA.socialImageHeight),
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:title',
      content: DEFAULT_SITE_METADATA.title,
    },
    {
      name: 'twitter:description',
      content: DEFAULT_SITE_METADATA.description,
    },
    {
      name: 'twitter:image',
      content: options.socialImageUrl,
    },
    {
      name: 'twitter:image:alt',
      content: DEFAULT_SITE_METADATA.socialImageAlt,
    },
    {
      name: 'twitter:url',
      content: options.canonicalUrl,
    },
  ]
}

export function buildRootLinks(options: {
  readonly appCssHref: string
  readonly canonicalUrl: string
}): Array<React.JSX.IntrinsicElements['link']> {
  return [
    {
      rel: 'stylesheet',
      href: options.appCssHref,
    },
    {
      rel: 'canonical',
      href: options.canonicalUrl,
    },
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: '/favicon.ico',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      href: '/favicon-16x16.png',
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/apple-touch-icon.png',
    },
    {
      rel: 'manifest',
      href: '/manifest.json',
    },
  ]
}

export const getAppOrigin = createServerFn({
  method: 'GET',
}).handler(async () => {
  return requireAppOrigin()
})
