import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

// Dynamic redirect URI for Vercel preview deployments
const REDIRECT_PATHNAME = '/callback';

const REDIRECT_ORIGIN =
  process.env.VERCEL_ENV === 'production'
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_ENV === 'preview'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

const REDIRECT_URI = new URL(REDIRECT_PATHNAME, REDIRECT_ORIGIN);

// Log the redirect URI for debugging
console.log('🔗 Redirect URI:', REDIRECT_URI.href);
console.log('🌍 Environment:', process.env.VERCEL_ENV || 'development');
console.log('📍 Origin:', REDIRECT_ORIGIN);

export default authkitMiddleware({
  redirectUri: REDIRECT_URI.href,
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/sign-in",
      "/sign-up",
    ],
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
