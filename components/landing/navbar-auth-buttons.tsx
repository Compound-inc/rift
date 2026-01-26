"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function NavbarAuthButtons() {
  const router = useRouter();

  const handleSignInHover = () => {
    router.prefetch("/sign-in");
  };

  const handleSignUpHover = () => {
    router.prefetch("/sign-up");
  };

  return (
    <div className="flex items-center space-x-4">
      <AuthLoading>
        <div className="hidden md:flex w-20 h-8 bg-gray-200 rounded-lg animate-pulse" />
      </AuthLoading>
      
      <Authenticated>
        <Link href="/chat">
          <Button
            variant="accent"
            size="sm"
            className="font-semibold text-white"
          >
            Ir al chat
          </Button>
        </Link>
      </Authenticated>
      
      <Unauthenticated>
        <div className="hidden md:flex items-center space-x-4">
          <Link
            href="/sign-in"
            onMouseEnter={handleSignInHover}
            className="text-gray-600 hover:text-accent font-medium text-sm transition-colors dark:text-white cursor-pointer"
          >
            Iniciar sesión
          </Link>
          <Link href="/sign-up" onMouseEnter={handleSignUpHover}>
            <Button
              variant="accent"
              size="sm"
              className="font-medium text-white"
            >
              Registrarse
            </Button>
          </Link>
        </div>
      </Unauthenticated>
    </div>
  );
}
