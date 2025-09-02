import { withAuth } from "@workos-inc/authkit-nextjs";

export async function getAccessToken(): Promise<string | undefined> {
  try {
    const { accessToken } = await withAuth();
    return accessToken;
  } catch (error) {
    console.error("Failed to get access token:", error);
    return undefined;
  }
}
