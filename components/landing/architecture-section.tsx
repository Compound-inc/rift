import {
  FastMessagesIcon,
  AIModelsIcon,
  CentroConocimientoIcon,
  TeamsIcon,
  SSOIcon,
} from "@/components/ui/icons/landing-icons";
import type { Dictionary } from "@/types/dictionary";

type ArchitectureSectionProps = {
  dict: Dictionary["architecture"];
};

export default function ArchitectureSection({ dict }: ArchitectureSectionProps) {
  return (
    <section id="features" aria-labelledby="features-heading" className="pt-24 md:pt-0">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 w-full -mb-4">
          <span className="text-landing-accent font-semibold gap-1.5 flex items-center transition-opacity duration-150">
            {dict.label}
          </span>
          <h2 id="features-heading" className="text-[40px] leading-[54.4px] tracking-[-0.5px] font-bold m-0">
            {dict.heading}
          </h2>
        </div>

        <article className="flex items-start gap-4" aria-labelledby="arquitectura-respuestas-rapidas">
          <div className="flex-shrink-0">
            <FastMessagesIcon className="w-12 h-12 text-amber-500" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <h3 id="arquitectura-respuestas-rapidas" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
              {dict.fastResponses}
            </h3>
            <p className="text-landing-text-secondary m-0">
              {dict.fastResponsesDesc}
            </p>
          </div>
        </article>

        <article className="flex items-start gap-4" aria-labelledby="arquitectura-todos-modelos">
          <div className="flex-shrink-0">
            <AIModelsIcon className="w-12 h-12 text-blue-500" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <h3 id="arquitectura-todos-modelos" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
              {dict.allModels}
            </h3>
            <p className="text-landing-text-secondary m-0">
              {dict.allModelsDesc}
            </p>
          </div>
        </article>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CentroConocimientoIcon className="w-12 h-12 text-purple-500" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
              {dict.dataPrivacy}
            </h4>
            <p className="text-landing-text-secondary m-0">
              {dict.dataPrivacyDesc}
            </p>
          </div>
        </div>

        <article className="flex items-start gap-4" aria-labelledby="arquitectura-listo-organizaciones">
          <div className="flex-shrink-0">
            <TeamsIcon className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <h3 id="arquitectura-listo-organizaciones" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
              {dict.orgReady}
            </h3>
            <p className="text-landing-text-secondary m-0">
              {dict.orgReadyDesc}
            </p>
          </div>
        </article>

        <article className="flex items-start gap-4" aria-labelledby="arquitectura-integraciones-avanzadas">
          <div className="flex-shrink-0">
            <SSOIcon className="w-12 h-12 text-slate-600" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <h3 id="arquitectura-integraciones-avanzadas" className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
              {dict.advancedIntegrations}
            </h3>
            <p className="text-landing-text-secondary m-0">
              {dict.advancedIntegrationsDesc}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
