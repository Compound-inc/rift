"use client";

import Link from "next/link";
import { Button } from "@/components/ai/ui/button";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function HeroAuthButton() {
  return (
    <>
      <AuthLoading>
        <Button variant="accent" size="lg" className="font-semibold rounded-lg pointer-events-none" disabled>
          <span className="invisible">Suscribirse</span>
        </Button>
      </AuthLoading>
      
      <Authenticated>
        <Button asChild variant="accent" size="lg" className="font-semibold rounded-lg cursor-pointer">
          <Link href="/chat" className="font-semibold">Ir al chat</Link>
        </Button>
      </Authenticated>
      
      <Unauthenticated>
        <Button asChild variant="accent" size="lg" className="font-semibold rounded-lg">
          <Link href="/#pricing" className="font-semibold">Suscribirse</Link>
        </Button>
      </Unauthenticated>
    </>
  );
}

