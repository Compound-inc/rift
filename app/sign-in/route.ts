import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get('return_to');

  const stateObj: Record<string, string> = {};
  if (returnTo) stateObj.returnTo = returnTo;

  const authorizationUrl = await getSignInUrl({
    state: Object.keys(stateObj).length > 0 ? JSON.stringify(stateObj) : undefined,
  });

  return redirect(authorizationUrl);
}