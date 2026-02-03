import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { logUserLoggedIn } from "@/actions/audit";

export const GET = async (request: NextRequest) => {
  try {
    let session = await withAuth();

    if (!session || !session.user) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const plan = searchParams.get("plan");

    if (plan) {
      const subscribeUrl = new URL("/subscribe", request.url);
      subscribeUrl.searchParams.set("plan", plan);
      return NextResponse.redirect(subscribeUrl);
    }

    if (session.organizationId) {
      try {
        await logUserLoggedIn();
      } catch {}
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Authentication error in router:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
};

