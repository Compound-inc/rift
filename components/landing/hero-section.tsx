import Image from "next/image";
import HeroAuthButton from "./hero-auth-button";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";

export type HeroDictionary = {
  headline1: string;
  headline2: string;
  description: string;
  poweredBy: string;
  imageAlt: string;
  imageCaption: string;
  ctaChat?: string;
  ctaSubscribe?: string;
  ctaLoading?: string;
};

const defaultHeroDict: HeroDictionary = {
  headline1: "Todos los modelos,",
  headline2: "una sola plataforma",
  description:
    "Olvídate de pagar múltiples suscripciones. RIFT unifica OpenAI, Anthropic, Google y más en una interfaz simple y potente.",
  poweredBy: "Potenciado por los líderes",
  imageAlt: "Interfaz de Chat RIFT con múltiples modelos",
  imageCaption: "Vista de la consola de chat de RIFT combinando modelos líderes.",
  ctaChat: "Ir al chat",
  ctaSubscribe: "Suscribirse",
  ctaLoading: "Suscribirse",
};

type HeroSectionProps = {
  dict?: HeroDictionary;
  lang?: string;
};

export default function HeroSection({ dict: dictProp, lang = "es" }: HeroSectionProps = {}) {
  const dict = dictProp ?? defaultHeroDict;

  return (
    <section id="hero" aria-labelledby="hero-heading" aria-describedby="hero-description" className="relative pt-32 md:pt-20">
      <div className="container mx-auto md:px-4 sm:px-0 lg:px-4 relative z-10">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Main Headline */}
          <h1 id="hero-heading" className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter font-bold mb-6 text-balance text-foreground">
            {dict.headline1}
            <br />
            <span className="px-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl inline-block">
              {dict.headline2}
            </span>
          </h1>

          {/* Subheadline */}
          <p id="hero-description" className="text-xl md:text-2xl text-muted-foreground max-w-3xl mb-8 leading-relaxed text-balance">
            {dict.description}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mb-10">
            <HeroAuthButton
              ctaChat={dict.ctaChat}
              ctaSubscribe={dict.ctaSubscribe}
              ctaLoading={dict.ctaLoading}
              lang={lang}
            />
          </div>

          {/* Social Proof / Logos */}
          <div className="flex flex-col items-center gap-6 mb-12 opacity-80">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{dict.poweredBy}</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 grayscale hover:grayscale-0 transition-all duration-300">
              <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <TablerBrandOpenai className="h-6 w-auto" />
                <span className="font-semibold">OpenAI</span>
              </div>
              <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <AnthropicIcon className="h-6 w-auto" />
                <span className="font-semibold">Anthropic</span>
              </div>
              <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <GoogleIcon className="h-6 w-auto" />
                <span className="font-semibold">Google</span>
              </div>
              <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <XAiIcon className="h-5 w-auto" />
                <span className="font-semibold">xAI</span>
              </div>
              <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <DeepSeekIcon className="h-6 w-auto" />
                <span className="font-semibold">DeepSeek</span>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <figure className="relative w-full max-w-6xl mx-auto rounded-xl shadow-2xl border border-border bg-background/50 p-2">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-purple-600/20 dark:from-amber-500/35 dark:to-purple-600/35 rounded-2xl blur opacity-100" aria-hidden="true"></div>
            <Image
              src="/chat_light.webp"
              alt={dict.imageAlt}
              width={1200}
              height={800}
              className="relative rounded-lg w-full h-auto border border-border shadow-sm block dark:hidden"
              priority
            />
            <Image
              src="/chat_dark.webp"
              alt={dict.imageAlt}
              width={1200}
              height={800}
              className="relative rounded-lg w-full h-auto border border-border shadow-sm hidden dark:block"
              priority
            />
            <figcaption className="sr-only">{dict.imageCaption}</figcaption>
          </figure>
        </div>
      </div>

      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/5 blur-3xl"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-3xl"></div>
      </div>
    </section>
  );
}
