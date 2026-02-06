import {
  AIModelsIcon,
  ExpandIcon,
  FastMessagesIcon,
} from "@/components/ui/icons/landing-icons";
import { GlobeIcon } from "@/components/ui/icons/svg-icons";
import { MockChatDemo } from "./mock-chat-demo";
import { ModelsMarquee } from "./models-marquee";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ai/ui/button";
import Link from "next/link";
import type { Dictionary } from "@/types/dictionary";

type PerformanceSectionProps = {
  dict: Dictionary["performance"];
  lang: string;
};

function GradientBackground() {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="absolute inset-0 inline-block h-full w-full max-w-full will-change-transform opacity-60 dark:opacity-40 pointer-events-none"
      style={{
        maskImage: "linear-gradient(180deg, transparent 0%, black 18%, black 70%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 18%, black 70%, transparent 100%)",
      }}
    >
      <rect width="300" height="300" fill="url(#paint0_radial_models)" />
      <rect width="300" height="300" fill="url(#paint1_radial_models)" />
      <rect width="300" height="300" fill="url(#paint2_radial_models)" />
      <rect width="300" height="300" fill="url(#paint3_radial_models)" />
      <defs>
        <radialGradient id="paint0_radial_models" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
          <stop stopColor="#5767C2" stopOpacity="0.2" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint1_radial_models" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
          <stop stopColor="#FF6D2E" stopOpacity="0.15" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint2_radial_models" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
          <stop stopColor="#2CC256" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint3_radial_models" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
          <stop stopColor="#2CC256" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export default function PerformanceSection({ dict, lang }: PerformanceSectionProps) {
  return (
    <>
      <section id="performance" aria-labelledby="performance-heading">
        <div className="gap-8 flex flex-col pt-24 md:pt-0">
          <div className="gap-2 w-full flex flex-col -mb-4">
            <span className="transition-opacity duration-150 ease-out text-blue-500 font-semibold gap-1.5 items-center flex">
              {dict.label}
            </span>
            <h2 id="performance-heading" className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0">
              {dict.heading}
            </h2>
          </div>
          <div className="flex flex-col">
            <p className="text-landing-text-secondary mb-5">
              {dict.intro}
            </p>

            <div className="flex flex-col items-center justify-center gap-7 w-full mb-8">
              <MockChatDemo examples={dict.mockChatExamples} />
            </div>

            <div className="flex flex-col gap-2 w-full mt-4">
              <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                {dict.oneSubscriptionHeading}
              </h3>
            </div>

            <p className="text-landing-text-secondary m-0 mb-8">
              {dict.catalogSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="list">
              <article className="flex items-start gap-4" aria-labelledby="performance-una-suscripcion" role="listitem">
                <div className="flex-shrink-0">
                  <AIModelsIcon className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h3 id="performance-una-suscripcion" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    {dict.oneSubscription}
                  </h3>
                  <p className="text-landing-text-secondary m-0">
                    {dict.oneSubscriptionDesc}
                  </p>
                </div>
              </article>

              <article className="flex items-start gap-4" aria-labelledby="performance-elige-modelos" role="listitem">
                <div className="flex-shrink-0">
                  <GlobeIcon className="w-12 h-12 text-blue-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h3 id="performance-elige-modelos" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    {dict.chooseModels}
                  </h3>
                  <p className="text-landing-text-secondary m-0">
                    {dict.chooseModelsDesc}
                  </p>
                </div>
              </article>

              <article className="flex items-start gap-4" aria-labelledby="performance-sin-limitaciones" role="listitem">
                <div className="flex-shrink-0">
                  <ExpandIcon className="w-12 h-12 text-purple-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h3 id="performance-sin-limitaciones" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    {dict.noLimits}
                  </h3>
                  <p className="text-landing-text-secondary m-0">
                    {dict.noLimitsDesc}
                  </p>
                </div>
              </article>

              <article className="flex items-start gap-4" aria-labelledby="performance-mejores-resultados" role="listitem">
                <div className="flex-shrink-0">
                  <FastMessagesIcon className="w-12 h-12 text-amber-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h3 id="performance-mejores-resultados" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    {dict.bestResults}
                  </h3>
                  <p className="text-landing-text-secondary m-0">
                    {dict.bestResultsDesc}
                  </p>
                </div>
              </article>
            </div>

            <section id="models" aria-labelledby="models-heading" className="w-full pt-24">
              <div className="text-center">
                <h3 id="models-heading" className="text-2xl font-bold mb-4">
                  {dict.catalogHeading}
                </h3>
                <p className="text-landing-text-secondary max-w-2xl mx-auto">
                  {dict.catalogSummary}
                </p>
              </div>

              <div className="relative w-screen left-1/2 -translate-x-1/2 bg-gradient-to-b from-transparent via-gray-50/70 to-gray-50/20 dark:from-transparent dark:via-[oklch(0.15_0.02_280)]/30 dark:to-[oklch(0.15_0.02_160)]/30 pt-16 sm:pt-20 overflow-visible">
                <GradientBackground />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background via-background/70 to-transparent dark:from-background dark:via-background/80 dark:to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/70 to-transparent dark:from-background dark:via-background/80 dark:to-transparent" />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-10">
                  <div className="w-full overflow-hidden">
                    <ModelsMarquee modelDescriptions={dict.modelDescriptions} />
                  </div>
                  <Button asChild variant="accent" size="lg" className="font-semibold text-white">
                    <Link href="/models" className="inline-flex items-center gap-2" aria-label={dict.viewAllModelsAria}>
                      {dict.viewAllModels}
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent dark:from-background dark:to-transparent z-20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent dark:from-background dark:to-transparent z-20" />
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
