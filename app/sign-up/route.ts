import { redirect } from 'next/navigation';
import { getSignUpUrl } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get('return_to');
  const plan = searchParams.get('plan');
  const seats = searchParams.get('seats');
  
  let stateObj: Record<string, string> = {};
  if (returnTo) stateObj.returnTo = returnTo;
  if (plan) stateObj.plan = plan;
  if (seats && /^\d+$/.test(seats)) stateObj.seats = seats;

  const authorizationUrl = await getSignUpUrl({
    state: Object.keys(stateObj).length > 0 ? JSON.stringify(stateObj) : undefined,
  });
  
  return redirect(authorizationUrl);
}
