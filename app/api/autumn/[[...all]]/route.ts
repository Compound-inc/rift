import { autumnHandler } from "autumn-js/next";
import { withAuth } from "@workos-inc/authkit-nextjs";

const { GET, POST } = autumnHandler({
  identify: async () => {
    const session = await withAuth({ ensureSignedIn: false });
    if (!session?.user?.id) {
      return null;
    }
    // Billing and quota are keyed by WorkOS org everywhere (chat, checkout, billing portal).
    // Require org here so we don't create a separate customer identity by user id.
    if (!session.organizationId) {
      return null;
    }
    return {
      customerId: session.organizationId,
      customerData: {
        email: session.user.email ?? undefined,
        name: session.user.firstName
          ? [session.user.firstName, session.user.lastName].filter(Boolean).join(" ")
          : undefined,
      },
    };
  },
});

export { GET, POST };
