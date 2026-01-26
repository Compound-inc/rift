"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ai/ui/button";

export default function CTASection() {
  const router = useRouter();

  const handleSignUpHover = () => {
    router.prefetch("/sign-up");
  };

  return (
    <div className="pt-24 md:pt-0">
    <section
      id="cta"
      aria-labelledby="cta-heading"
      aria-describedby="cta-summary"
      className="relative overflow-hidden py-12 sm:py-16 md:py-20 rounded-2xl sm:rounded-3xl mx-4 sm:mx-0 border border-black/5 dark:border-white/10 bg-white dark:bg-background"
    >
      <GradientBackground className="absolute top-0 left-0 w-full h-full z-0" />
      
      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 id="cta-heading" className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white mb-4 sm:mb-6 tracking-tight">
          ¿Listo para comenzar?
        </h2>
        
        <p
          id="cta-summary"
          className="text-lg sm:text-xl md:text-2xl leading-6 sm:leading-7 md:leading-8 text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.6)] dark:text-zinc-400 max-w-3xl mx-auto mb-8 sm:mb-10 md:mb-12"
        >
          Empieza a usar RIFT gratis y descubre el poder de la IA
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md mx-auto">
          <Button
            asChild
            className="hover:bg-white hover:text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] hover:shadow-[rgba(0,0,0,0.1)_0px_0px_0px_1px] relative flex w-full sm:w-auto cursor-pointer select-none items-center justify-center whitespace-nowrap bg-white text-base leading-6 tracking-normal duration-[0.17s] text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 shadow-[rgba(0,0,0,0.05)_0px_0px_0px_1px] rounded-[50px] h-14 px-8 border-none"
          >
            <Link href="/sign-up" onMouseEnter={handleSignUpHover} aria-label="Conocer los precios">
              Registrarse
            </Link>
          </Button>
        </div>
      </div>
    </section>
    </div>
  );
}

function GradientBackground({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className={className}>
      <rect width="300" height="300" fill="url(#cta_paint0_radial)" />
      <rect width="300" height="300" fill="url(#cta_paint1_radial)" />
      <rect width="300" height="300" fill="url(#cta_paint2_radial)" />
      <rect width="300" height="300" fill="url(#cta_paint3_radial)" />
      <defs>
        <radialGradient id="cta_paint0_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
          <stop stopColor="#5767C2" stopOpacity="0.1" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cta_paint1_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
          <stop stopColor="#FF6D2E" stopOpacity="0.07" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cta_paint2_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
          <stop stopColor="#2CC256" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cta_paint3_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
          <stop stopColor="#2CC256" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
