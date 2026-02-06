import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

// Dynamic redirect URI for Vercel preview deployments
const REDIRECT_PATHNAME = '/callback';

const REDIRECT_ORIGIN =
  process.env.VERCEL_ENV === 'production'
    ? 'https://rift.mx'
    : process.env.VERCEL_ENV === 'preview'
    ? 'https://dev.rift.mx'
    : 'http://localhost:3000';

const REDIRECT_URI = new URL(REDIRECT_PATHNAME, REDIRECT_ORIGIN);

const locales = ['en', 'es'] as const;
const defaultLocale = 'en';

function getLocale(request: NextRequest): (typeof locales)[number] {
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  // Parse Accept-Language (e.g. "es-MX,es;q=0.9,en;q=0.8") and pick first match
  const parts = acceptLanguage.split(',').map((p) => p.split(';')[0].trim().toLowerCase());
  for (const part of parts) {
    const lang = part.slice(0, 2);
    if (lang === 'es') return 'es';
    if (lang === 'en') return 'en';
  }
  return defaultLocale;
}

const authkit = authkitMiddleware({
  redirectUri: REDIRECT_URI.href,
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/en",
      "/es",
      "/share/:path*",
      "/sign-in",
      "/sign-up",
      "/callback",
      "/api/sign-in",
      "/api/sign-up",
      "/terms-of-service",
      "/privacy-policy",
      "/en/models",
      "/es/models",
      "/relay-7ls5/:path*",
      "/relay-7ls5/static/:path*",
    ],
  },
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale && pathname === '/') {
    const locale = getLocale(request);
    request.nextUrl.pathname = `/${locale}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Redirect /chat and /chat/* to /[locale]/chat so chat is under locale
  if (!pathnameHasLocale && (pathname === '/chat' || pathname.startsWith('/chat/'))) {
    const locale = getLocale(request);
    request.nextUrl.pathname = pathname === '/chat' ? `/${locale}/chat` : `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Redirect /models to /[locale]/models for i18n
  if (!pathnameHasLocale && pathname === '/models') {
    const locale = getLocale(request);
    request.nextUrl.pathname = `/${locale}/models`;
    return NextResponse.redirect(request.nextUrl);
  }

  return authkit(request, event);
}

export const config = {
  matcher: [
    // All routes except Next.js internals and static files
    // Note: settings routes are included because server actions called from settings pages require withAuth()
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes (no prefetch for API routes)
    '/api/chat',
    '/api/generate-title',
    '/api/upload',
    // Catch-all for any other API routes
    '/api/:path*',
  ],
};