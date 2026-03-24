import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stateParam = searchParams.get('state');

  let returnPathname = '/router';

  if (stateParam) {
    try {
      const state = JSON.parse(stateParam);
      if (state.returnTo) {
        // Validate returnTo is a safe relative URL
        const returnTo = state.returnTo;
        if (returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes(':')) {
          returnPathname = returnTo;
        }
      }
      // Preserve plan parameter if present, so it can be handled by the router or subsequent page
      if (state.plan) {
          const separator = returnPathname.includes('?') ? '&' : '?';
          returnPathname = `${returnPathname}${separator}plan=${encodeURIComponent(state.plan)}`;
      }
    } catch (e) {
    }
  }

  return handleAuth({
    returnPathname,
  })(request);
}
