import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get('return_to');

  // Validate returnTo is a safe relative URL
  if (returnTo && (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes(':'))) {
    throw new Error('Invalid return_to parameter');
  }

  const stateObj: Record<string, string> = {};
  if (returnTo) stateObj.returnTo = returnTo;

  const authorizationUrl = await getSignInUrl({
    state: Object.keys(stateObj).length > 0 ? JSON.stringify(stateObj) : undefined,
  });

  return redirect(authorizationUrl);
}
