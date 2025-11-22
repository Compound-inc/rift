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

export default function PerformanceSection() {
  return (
    <>
      {/* Summaries & Action Items Section */}
      <section>
        <div className="gap-8 flex flex-col">
          <div className="gap-2 w-full flex flex-col -mb-4">
            <span className="transition-opacity duration-150 ease-out text-blue-500 font-semibold gap-1.5 items-center flex">
              Rendimiento
            </span>
            <h4 className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0">
              Velocidad Inigualable
            </h4>
          </div>
          <div className="flex flex-col">
            <p className="text-landing-text-secondary mb-5">
              Desde la creacion de RIFT, sabiamos que la velocidad era un factor
              clave para la eficiencia de los equipos. Por eso, RIFT
              es una plataforma que te permite trabajar más
              rápido y eficientemente.
            </p>

            <div className="flex flex-col items-center justify-center gap-7 w-full mb-8">
              <MockChatDemo />
            </div>

            <div className="flex flex-col gap-2 w-full mt-4">
              <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                Todos los modelos, una suscripción
              </h4>
            </div>

            <p className="text-landing-text-secondary m-0 mb-8">
              Acceso a todos los modelos de IA disponibles en el mercado, desde
              ChatGPT, Gemini, Grok, Anthropic, DeepSeek, Mistral, y muchos
              otros modelos especiales.
            </p>

            {/* 2x2 Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AIModelsIcon className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    Una Sola Suscripción
                  </h4>
                  <p className="text-landing-text-secondary m-0">
                    Accede a todos los modelos de IA con una sola suscripción.
                    No necesitas múltiples cuentas ni pagos separados.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <GlobeIcon className="w-12 h-12 text-blue-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    Elige entre decenas de modelos
                  </h4>
                  <p className="text-landing-text-secondary m-0">
                    Selecciona el modelo más adecuado para cada tarea desde
                    nuestra amplia gama de opciones disponibles.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <ExpandIcon className="w-12 h-12 text-purple-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    Sin limitaciones de empresa
                  </h4>
                  <p className="text-landing-text-secondary m-0">
                    No te limitamos a usar únicamente una empresa de IA. Combina
                    lo mejor de cada proveedor en una sola plataforma.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <FastMessagesIcon className="w-12 h-12 text-amber-500" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <h4 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                    Mejores resultados, más rapidez y más seguridad
                  </h4>
                  <p className="text-landing-text-secondary m-0">
                    Obtén respuestas más precisas, rápidas y seguras combinando
                    la potencia de múltiples modelos de IA.
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full mt-16 border-t border-gray-100 dark:border-white/5 pt-16">
               <div className="text-center mb-12">
                  <h3 className="text-2xl font-bold mb-4">Explora nuestro catálogo</h3>
                  <p className="text-landing-text-secondary max-w-2xl mx-auto">
                    Contamos con una de las bibliotecas más completas de modelos de Inteligencia Artificial, actualizada constantemente.
                  </p>
               </div>
               
               <div className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden bg-gradient-to-b from-transparent to-gray-50/50 dark:to-white/5">
                  <ModelsMarquee />
               </div>
               <div className="flex justify-center mt-8">
                <Button asChild variant="accent" size="lg" className="font-semibold">
                  <Link href="/models" className="inline-flex items-center gap-2">
                    Conocer todos los modelos
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
