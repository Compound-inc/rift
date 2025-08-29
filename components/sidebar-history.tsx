"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

export default function SidebarHistory() {
  const { user, signOut } = useAuth();
  const userIdentity = useMutation(api.test.myMutation);
  console.log(userIdentity);

  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        <Authenticated>
          <button
            onClick={() => userIdentity()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Auth Button
          </button>
        </Authenticated>
        <Unauthenticated>
          <button
            onClick={() => userIdentity()}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            Anon Button
          </button>
        </Unauthenticated>
      </div>
      
      <Authenticated>
        <div>Loading chat history...</div>
      </Authenticated>
      <Unauthenticated>
        <p className="text-gray-500 text-center">Please sign in to view chat history</p>
      </Unauthenticated>
    </div>
  );
}
