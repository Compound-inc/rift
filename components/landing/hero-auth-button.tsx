"use client";

import Link from "next/link";
import { Button } from "@/components/ai/ui/button";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

type HeroAuthButtonProps = {
  ctaChat?: string;
  ctaSubscribe?: string;
  ctaLoading?: string;
  lang?: string;
};

export default function HeroAuthButton({
  ctaChat = "Ir al chat",
  ctaSubscribe = "Suscribirse",
  ctaLoading = "Suscribirse",
  lang = "es",
}: HeroAuthButtonProps) {
  return (
    <>
      <AuthLoading>
        <Button variant="accent" size="lg" className="font-semibold text-white pointer-events-none" disabled>
          <span className="invisible">{ctaLoading}</span>
        </Button>
      </AuthLoading>

      <Authenticated>
        <Button asChild variant="accent" size="lg" className="font-semibold text-white">
          <Link href={`/${lang}/chat`}>{ctaChat}</Link>
        </Button>
      </Authenticated>

      <Unauthenticated>
        <Button asChild variant="accent" size="lg" className="font-semibold text-white">
          <Link href={`/${lang}#pricing`}>{ctaSubscribe}</Link>
        </Button>
      </Unauthenticated>
    </>
  );
}

