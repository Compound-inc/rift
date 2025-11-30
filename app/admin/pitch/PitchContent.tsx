"use client";

import { Building2, GraduationCap, Rocket, Check } from "lucide-react";
import Image from "next/image";
import {
  StandarIcon,
  PremiumIcon,
  AIModelsIcon,
  SoporteIcon,
  ExpandIcon,
  SSOIcon,
  LogsIcon,
} from "@/components/ui/icons/landing-icons";
import { Scim, RedoIcon } from "@/components/ui/icons/svg-icons";
import { ShieldCheck } from "lucide-react";

function getFeatureIcon(feature: string) {
  const lowerFeature = feature.toLowerCase();

  if (lowerFeature.includes("mensajes estándar")) return StandarIcon;
  if (lowerFeature.includes("mensajes premium")) return PremiumIcon;
  if (lowerFeature.includes("modelos")) return AIModelsIcon;
  if (lowerFeature.includes("historial")) return RedoIcon;
  if (lowerFeature.includes("soporte")) return SoporteIcon;
  if (lowerFeature.includes("límites")) return ExpandIcon;
  if (lowerFeature.includes("sso")) return SSOIcon;
  if (lowerFeature.includes("logs")) return LogsIcon;
  if (lowerFeature.includes("seicm")) return Scim;
  if (lowerFeature.includes("sla")) return ShieldCheck;

  return Check;
}

export default function PitchContent() {
  return (
    <div className="min-h-screen bg-background selection:bg-amber-100 selection:text-amber-900 dark:selection:bg-amber-900 dark:selection:text-amber-50">

      <main className="max-w-4xl mx-auto px-4 pt-32 pb-20 sm:px-6 lg:px-8 space-y-12">

        {/* Introduction */}
        <section className="space-y-6 relative">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            RIFT AI
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Rift es una plataforma de Inteligencia Artificial que <strong>centraliza todos los modelos de IA más relevantes y inteligentes del mercado</strong> bajo una misma app y suscripción, permitiendo a los usuarios utilizar el modelo de IA más conveniente para cada situación logrando <strong>mayor calidad y eficiencia en las respuestas</strong> sin ser limitados por la plataforma que usan.
          </p>

          {/* Hero Image */}
          <div className="relative w-full my-12">
            <figure className="relative w-full max-w-6xl mx-auto rounded-xl shadow-2xl border border-border bg-background/50 p-2 z-10">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-purple-600/20 dark:from-amber-500/35 dark:to-purple-600/35 rounded-2xl blur opacity-100" aria-hidden="true"></div>
              <Image
                src="/chat_light.webp"
                alt="Interfaz de Chat RIFT con múltiples modelos"
                width={1200}
                height={800}
                className="relative rounded-lg w-full h-auto border border-border shadow-sm block dark:hidden"
                priority
              />
              <Image
                src="/chat_dark.webp"
                alt="Interfaz de Chat RIFT con múltiples modelos"
                width={1200}
                height={800}
                className="relative rounded-lg w-full h-auto border border-border shadow-sm hidden dark:block"
                priority
              />
              <figcaption className="sr-only">Vista de la consola de chat de RIFT combinando modelos líderes.</figcaption>
            </figure>
          </div>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            RIFT fue diseñado para tener una <strong>velocidad superior a todas las otras apps de IA</strong>, eliminando todos los cuellos de botella y brindando una experiencia de usuario impecable y con <strong>privacidad de primer nivel</strong> ya que los datos de los usuarios no son utilizados para entrenar ninguna IA ni son vendidos a terceros. Además de brindar un <strong>dashboard para el análisis</strong> del uso de IA dentro de la organización del cliente, permitiendo conocer detalles sobre cómo sus usuarios interactúan directamente con la IA, horas de mayor uso, temas de consulta, y filtros por departamentos, grupos, oficinas y otros.
          </p>

          {/* Analysis Dashboard Image */}
          <div className="relative w-full my-12">
            <figure className="relative w-full max-w-6xl mx-auto rounded-xl shadow-2xl border border-border bg-background/50 p-2 z-10">
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/20 via-amber-500/15 to-cyan-500/20 dark:from-blue-500/35 dark:via-amber-500/25 dark:to-cyan-500/35 rounded-2xl blur opacity-100" aria-hidden="true"></div>
              <Image
                src="/analisis.png"
                alt="Dashboard de análisis de uso de IA en RIFT"
                width={1200}
                height={800}
                className="relative rounded-lg w-full h-auto border border-border shadow-sm"
                priority
              />
              <figcaption className="sr-only">Dashboard de análisis de uso de IA dentro de la organización.</figcaption>
            </figure>
          </div>

          {/* Background Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/5 blur-3xl"></div>
            <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-3xl"></div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4">
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Así mismo, contamos con <strong>protección contra fraudes, detección de bots, registros de auditoría</strong>, decenas de conexiones y opciones para enterprises <strong>SAML, OIDC, SCIM, SIEM, Directory Sync, RBAC</strong>.
          </p>
        </section>

        {/* Competitive Difference Section */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Diferencia Competitiva</h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              El precio de RIFT es súper competitivo y llamativo, al compararlo con el costo de los servicios individuales de IA de los líderes del mercado, el ahorro es significativo, permitiéndonos tomar market share directamente de OpenAI y las otras grandes empresas de IA.
            </p>
          </div>

          <div className="relative w-full max-w-[1082px] mx-auto">
             {/* Decorative borders to match pricing section style */}
            <div className="absolute inset-x-0 top-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>

            <div className="max-lg:h-auto max-lg:flex-col relative flex w-full items-stretch justify-center gap-8 lg:gap-0 overflow-hidden">
              <article className="relative z-[2] flex w-full flex-col items-center gap-6 px-6 py-12">
                <GradientBackground id="2" />
                
                <h3 className="text-xl font-medium mb-2 text-foreground">Suscripciones Individuales</h3>
                
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                    <span className="text-muted-foreground">ChatGPT Plus</span>
                    <span className="font-mono font-medium">$400 MXN</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                    <span className="text-muted-foreground">Grok (X Premium+)</span>
                    <span className="font-mono font-medium">$320 MXN</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                    <span className="text-muted-foreground">Gemini Advanced</span>
                    <span className="font-mono font-medium">$400 MXN</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                    <span className="text-muted-foreground">Claude Pro</span>
                    <span className="font-mono font-medium">$400 MXN</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 mt-4 bg-muted/30 rounded-lg print:bg-gray-100 gap-8">
                    <span className="font-medium">Total Mensual</span>
                    <span className="font-mono font-bold">$1,520 MXN</span>
                  </div>

                  <p className="mt-4 text-sm text-center text-muted-foreground italic">
                    Costo mensual aproximado para obtener acceso individual a todos los modelos incluidos en RIFT por separado.
                  </p>
                </div>
              </article>

              <VerticalDivider />

              <article className="relative z-[2] flex w-full flex-col items-center gap-6 px-6 py-12">
                <GradientBackground id="1" />
                
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <h3 className="text-2xl font-medium leading-6 tracking-tight text-foreground">
                    RIFT Plus
                  </h3>
                  <div className="flex items-baseline justify-center text-foreground">
                    <span className="text-4xl font-bold tracking-tight">
                      $190 MXN
                    </span>
                    <span className="ml-1 text-sm font-medium opacity-60">
                      /mes
                    </span>
                  </div>
                  <p className="text-sm leading-6 tracking-tight text-muted-foreground max-w-[280px]">
                    Plan recomendado para la mayoría de clientes.
                  </p>
                </div>

                <ul className="flex-1 space-y-4 w-full max-w-[280px]">
                  {[
                    "1,000 mensajes estándar", 
                    "100 mensajes premium", 
                    "Acceso a todos los modelos", 
                    "Historial de chat limitado"
                  ].map((feature) => {
                    const Icon = getFeatureIcon(feature);
                    return (
                      <li
                        key={feature}
                        className="flex items-center text-muted-foreground"
                      >
                        <div className="mr-3 shrink-0">
                          <Icon className="h-5 w-5 text-foreground opacity-80" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    );
                  })}
                </ul>

                <footer className="w-full max-w-[280px] mt-auto">
                  <div className="flex justify-center w-full py-3 px-3 rounded-lg border border-primary/20 print:bg-gray-200 print:border-gray-300">
                    <span className="font-bold text-primary print:text-black">Ahorro Mensual: $1,330 MXN</span>
                  </div>
                </footer>
              </article>
            </div>
          </div>
          
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mt-8">
            Además de la ventaja competitiva en precio, <strong>RIFT se mueve rápido</strong>, implementando nuevas características y mejoras de forma constante para mantenernos a la vanguardia del mercado, además de proporcionar un <strong>sistema directo para la personalización de la IA para cada organización</strong> y <strong>mejorar la plataforma con base en feedback directo de las organizaciones</strong> para que tengan la mejor experiencia posible.
          </p>
          
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mt-6">
            OpenAI, Google, Grok, Anthropic son empresas cuyo único enfoque es crear la mejor inteligencia artificial. No se especializan en crear aplicaciones ni en optimizar la experiencia de usuario; <strong>su objetivo es desarrollar la mejor IA, no la mejor experiencia</strong>. RIFT, por el contrario, se enfoca en <strong>brindar la mejor experiencia posible</strong> utilizando los mejores modelos de IA del mercado.
          </p>
        </section>

        {/* Market */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">¿Cuál es nuestro mercado?</h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Cualquier empresa, corporación, grupo, PYME o institución educativa que utilice ChatGPT, Grok, Gemini, Copilot, Claude, entre otros, y que quiera <strong>aumentar la eficiencia de sus empleados de forma segura, gobernada y privada</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <article className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Building2 className="w-12 h-12 text-blue-500" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                  Corporativos
                </h3>
                <p className="text-muted-foreground m-0">
                  Empresas y corporaciones que utilizan múltiples herramientas de IA (ChatGPT, Copilot, Gemini) y requieren un <strong>entorno unificado con SSO, gobernanza de datos y privacidad empresarial</strong>.
                </p>
              </div>
            </article>

            <article className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <GraduationCap className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                  Instituciones Educativas
                </h3>
                <p className="text-muted-foreground m-0">
                  Universidades y escuelas que buscan integrar la IA en sus procesos de aprendizaje e investigación, <strong>manteniendo el control sobre el uso y garantizando la seguridad de los datos</strong> de estudiantes y docentes.
                </p>
              </div>
            </article>

            <article className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Rocket className="w-12 h-12 text-amber-500" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                  PYMEs y Startups
                </h3>
                <p className="text-muted-foreground m-0">
                  Pequeñas y medianas empresas que necesitan <strong>acceso a los modelos más potentes del mercado</strong> sin la complejidad de gestionar múltiples suscripciones individuales y costosas.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* Revenue Model */}
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-4">Ingresos</h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
              Ofrecemos un plan inicial de <strong>190 MXN + IVA mensuales</strong> por cada usuario, que incluye <strong>1000 mensajes estándar y 100 mensajes premium</strong>.
            </p>
          </div>

          <div className="relative w-full max-w-sm mx-auto">
             {/* Decorative borders to match pricing section style */}
            <div className="absolute inset-x-0 top-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>

            <article className="relative z-[2] flex w-full flex-col items-center gap-6 p-8">
              <GradientBackground id="2" />
              
              <h3 className="text-xl font-medium mb-2 text-foreground">Costos Por Usuario</h3>
              
              <div className="w-full space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                  <span className="text-muted-foreground">Pago AI</span>
                  <span className="font-mono font-medium">$59.25</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                  <span className="text-muted-foreground">Servidores</span>
                  <span className="font-mono font-medium">$5.00</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 gap-8">
                  <span className="text-muted-foreground">Base de Datos</span>
                  <span className="font-mono font-medium">$6.00</span>
                </div>
                
                <div className="flex justify-between items-center py-3 mt-4 bg-muted/30 rounded-lg print:bg-gray-100 gap-8">
                  <span className="font-medium">Gastos Totales</span>
                  <span className="font-mono font-bold text-red-500">$70.25</span>
                </div>

                <div className="flex justify-between items-center py-2 gap-8">
                  <span className="text-muted-foreground">Ingreso por Suscripción</span>
                  <span className="font-mono font-medium">$190.00</span>
                </div>

                <div className="flex justify-between items-center py-3 px-3 rounded-lg border border-primary/20 print:bg-gray-200 print:border-gray-300 gap-8">
                  <span className="font-bold text-primary print:text-black">Net Revenue</span>
                  <span className="font-mono font-bold text-primary print:text-black">$119.75</span>
                </div>
              </div>

              <p className="mt-2 text-sm text-center text-muted-foreground italic">
                De los cuales obtenemos un <strong>Gross Margin del 63% o de hasta el 90%</strong> dependiendo de qué tan frecuentemente los usuarios usen la plataforma.
              </p>
            </article>
          </div>

          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Detalles de Pago de IA</h3>
            <p className="text-sm text-muted-foreground italic">
              En estos casos, estamos considerando el uso del <strong>100% de la cuota de mensajes</strong>, lo que significa que los precios pueden ser incluso más bajos para la mayoría de los usuarios reales.
            </p>
          </div>

          <div className="relative w-full overflow-hidden">
             {/* Decorative borders */}
            <div className="absolute inset-x-0 top-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>

            <article className="relative z-[2] flex w-full flex-col gap-6">
               <div className="absolute inset-0 z-[-1] opacity-50">
                 <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                 <GradientBackground id="1" />
               </div>
               <table className="w-full text-sm text-left relative z-10">
                 <thead className="bg-muted/50 text-muted-foreground font-medium border-b print:bg-gray-100">
                   <tr>
                     <th className="px-6 py-4">User Type</th>
                     <th className="px-6 py-4 text-right">Standard Message</th>
                     <th className="px-6 py-4 text-right">Premium Messages</th>
                     <th className="px-6 py-4 text-right">Costo Usuario</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/50">
                   <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                     <td className="px-6 py-4 font-medium">Light User</td>
                     <td className="px-6 py-4 text-right font-mono">$11.30</td>
                     <td className="px-6 py-4 text-right font-mono">$5.61</td>
                     <td className="px-6 py-4 text-right font-mono font-bold">$16.91</td>
                   </tr>
                   <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                     <td className="px-6 py-4 font-medium">Standard User</td>
                     <td className="px-6 py-4 text-right font-mono">$16.40</td>
                     <td className="px-6 py-4 text-right font-mono">$11.87</td>
                     <td className="px-6 py-4 text-right font-mono font-bold">$28.27</td>
                   </tr>
                   <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                     <td className="px-6 py-4 font-medium">Power User</td>
                     <td className="px-6 py-4 text-right font-mono">$72.80</td>
                     <td className="px-6 py-4 text-right font-mono">$61.76</td>
                     <td className="px-6 py-4 text-right font-mono font-bold">$134.56</td>
                   </tr>
                   <tr className="bg-muted/30 font-bold border-t-2 border-border print:bg-gray-100 print:border-gray-400">
                     <td className="px-6 py-4">Average</td>
                     <td className="px-6 py-4 text-right font-mono">$33.50</td>
                     <td className="px-6 py-4 text-right font-mono">$25.75</td>
                     <td className="px-6 py-4 text-right font-mono text-primary print:text-black">$59.25</td>
                   </tr>
                 </tbody>
               </table>
            </article>
          </div>
        </section>

        {/* Projections Section */}
        <section className="space-y-6 break-inside-avoid">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Proyecciones</h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              En la siguiente tabla tenemos <strong>3 clientes</strong> con los que ya se iniciaron pláticas o pruebas de uso de RIFT para implementar a nivel global dentro de la institución.
            </p>
            <p className="text-sm text-muted-foreground italic">
              En este escenario estamos considerando un <strong>Gross Margin del 63%</strong> como worst case scenario y un costo de suscripción de <strong>190 MXN</strong> sin contar IVA.
            </p>
          </div>

          <div className="relative w-full overflow-hidden">
            {/* Decorative borders */}
            <div className="absolute inset-x-0 top-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex w-full items-center justify-center">
              <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>
            <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
              <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
              </svg>
            </div>

            <article className="relative z-[2] flex w-full flex-col gap-6">
               <div className="absolute inset-0 z-[-1] opacity-50">
                 <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                 <GradientBackground id="1" />
               </div>
               <table className="w-full text-sm text-left relative z-10">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b print:bg-gray-100">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4 text-right">Usuarios</th>
                  <th className="px-6 py-4 text-right">Suscripción</th>
                  <th className="px-6 py-4 text-right">Ingreso</th>
                  <th className="px-6 py-4 text-right">Gastos</th>
                  <th className="px-6 py-4 text-right">Net Revenue</th>
                  <th className="px-6 py-4 text-right">Yearly Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                  <td className="px-6 py-4 font-medium">UAD</td>
                  <td className="px-6 py-4 text-right font-mono">50,000</td>
                  <td className="px-6 py-4 text-right font-mono">$190</td>
                  <td className="px-6 py-4 text-right font-mono">$9,500,000</td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">$3,512,500</td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-green-600 dark:text-green-400 print:text-black">$5,987,500</td>
                  <td className="px-6 py-4 text-right font-mono font-bold">$71,850,000</td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                  <td className="px-6 py-4 font-medium">UDLAP</td>
                  <td className="px-6 py-4 text-right font-mono">9,000</td>
                  <td className="px-6 py-4 text-right font-mono">$190</td>
                  <td className="px-6 py-4 text-right font-mono">$1,710,000</td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">$632,250</td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-green-600 dark:text-green-400 print:text-black">$1,077,750</td>
                  <td className="px-6 py-4 text-right font-mono font-bold">$12,933,000</td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                  <td className="px-6 py-4 font-medium">Anahuac Puebla</td>
                  <td className="px-6 py-4 text-right font-mono">500</td>
                  <td className="px-6 py-4 text-right font-mono">$190</td>
                  <td className="px-6 py-4 text-right font-mono">$95,000</td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">$35,125</td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-green-600 dark:text-green-400 print:text-black">$59,875</td>
                  <td className="px-6 py-4 text-right font-mono font-bold">$718,500</td>
                </tr>
                <tr className="bg-muted/30 font-bold border-t-2 border-border print:bg-gray-100 print:border-gray-400">
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right font-mono">59,500</td>
                  <td className="px-6 py-4 text-right font-mono"></td>
                  <td className="px-6 py-4 text-right font-mono">$11,305,000</td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">$4,179,875</td>
                  <td className="px-6 py-4 text-right font-mono text-green-600 dark:text-green-400 print:text-black">$7,125,125</td>
                  <td className="px-6 py-4 text-right font-mono">$85,501,500</td>
                </tr>
              </tbody>
            </table>
            </article>
          </div>
          <p className="text-lg text-muted-foreground mt-6">
            Estas proyecciones solo consideran que los últimos <strong>3 clientes</strong> con los que hemos hablado en el mes realicen contrato con RIFT; Con el equipo y la estrategia correctos, podríamos crecer <strong>10 veces más</strong> de lo proyectado en esta tabla.
          </p>
        </section>

        {/* Expenses Section */}
        <section className="space-y-12 break-inside-avoid">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Gastos Iniciales</h2>
            
            {/* Team Expenses Table */}
            <div className="space-y-4">
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Con un equipo inicial diseñado para <strong>maximizar la eficiencia operativa</strong>, enfocando nuestros recursos principales en el área de ventas. Consideramos que, en esta etapa, <strong>priorizar el cierre de tratos y la captura de mercado</strong> generará resultados superiores a los de mantener un equipo de desarrollo extenso.
              </p>
              
              <div className="relative w-full overflow-hidden">
                {/* Decorative borders */}
                <div className="absolute inset-x-0 top-0 flex w-full items-center justify-center">
                  <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                    <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
                  </svg>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex w-full items-center justify-center">
                  <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform">
                    <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
                  </svg>
                </div>
                <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
                  <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                    <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
                  </svg>
                </div>
                <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
                  <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
                    <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
                  </svg>
                </div>

            <article className="relative z-[2] flex w-full flex-col gap-6">
               <div className="absolute inset-0 z-[-1] opacity-50">
                 <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                 <GradientBackground id="1" />
               </div>
               <table className="w-full text-sm text-left relative z-10">
                  <thead className="bg-muted/50 text-muted-foreground font-medium border-b print:bg-gray-100">
                    <tr>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Function</th>
                      <th className="px-6 py-3 text-right">Base Salary (MXN)</th>
                      <th className="px-6 py-3 text-right">TOTAL Base Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">CEO</td>
                      <td className="px-6 py-3 text-muted-foreground">Lead, Development & Sales</td>
                      <td className="px-6 py-3 text-right font-mono">$100,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$100,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">Senior Full Stack Dev</td>
                      <td className="px-6 py-3 text-muted-foreground">Product Architecture</td>
                      <td className="px-6 py-3 text-right font-mono">$65,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$65,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">Mid-Level React Dev</td>
                      <td className="px-6 py-3 text-muted-foreground">Feature Building</td>
                      <td className="px-6 py-3 text-right font-mono">$45,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$45,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">Head of Sales</td>
                      <td className="px-6 py-3 text-muted-foreground">Closer + Strategy</td>
                      <td className="px-6 py-3 text-right font-mono">$60,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$60,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">Account Exec (AE)</td>
                      <td className="px-6 py-3 text-muted-foreground">Closer</td>
                      <td className="px-6 py-3 text-right font-mono">$40,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$40,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">SDR (Sales Dev Rep)</td>
                      <td className="px-6 py-3 text-muted-foreground">Hunter (Cold calls/Booking meetings)</td>
                      <td className="px-6 py-3 text-right font-mono">$25,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$25,000.00</td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-3 font-medium">Growth Marketer</td>
                      <td className="px-6 py-3 text-muted-foreground">Inbound (Ads, Content, Decks)</td>
                      <td className="px-6 py-3 text-right font-mono">$30,000.00</td>
                      <td className="px-6 py-3 text-right font-mono">$30,000.00</td>
                    </tr>
                    <tr className="bg-muted/30 font-bold border-t-2 border-border print:bg-gray-100 print:border-gray-400">
                      <td className="px-6 py-3">TOTAL</td>
                      <td className="px-6 py-3"></td>
                      <td className="px-6 py-3 text-right font-mono"></td>
                      <td className="px-6 py-3 text-right font-mono text-red-500">$365,000.00</td>
                    </tr>
                  </tbody>
                </table>
                </article>
              </div>
              <p className="text-lg text-muted-foreground mt-6">
                Además de los costos de personal, se contemplan otros gastos relacionados con viáticos, suscripciones a productos, servicios necesarios para la operación, equipamiento, oficinas, luz, internet, entre otros.
              </p>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}

function VerticalDivider() {
  return (
    <div className="relative z-[2] hidden h-auto min-w-[24px] w-6 bg-white dark:bg-background lg:flex">
      <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
        </svg>
      </div>
      <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-foreground dark:stroke-white" />
        </svg>
      </div>
    </div>
  );
}

function GradientBackground({ id }: { id: string }) {
  const gradients = {
    "1": (
      <>
        <rect width="100%" height="100%" fill="url(#paint0_radial_262_665)" />
        <rect width="100%" height="100%" fill="url(#paint1_radial_262_665)" />
        <rect width="100%" height="100%" fill="url(#paint2_radial_262_665)" />
        <rect width="100%" height="100%" fill="url(#paint3_radial_262_665)" />
        <defs>
          <radialGradient id="paint0_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
            <stop stopColor="#5767C2" stopOpacity="0.3" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
            <stop stopColor="#FF6D2E" stopOpacity="0.2" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
            <stop stopColor="#2CC256" stopOpacity="0.3" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
            <stop stopColor="#2CC256" stopOpacity="0.3" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    "2": (
      <>
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint0_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint1_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint2_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint3_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint4_radial_262_666)" />
        <defs>
          <radialGradient id="paint0_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(38.6107) scale(273.226)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)">
            <stop stopColor="#FAC507" stopOpacity="0.1" />
            <stop offset="1" stopColor="#FAC507" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-50 242.5) scale(147.5)">
            <stop stopColor="#CD81F3" stopOpacity="0.07" />
            <stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint4_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)">
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
  };

  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 inline-block h-full w-full will-change-transform z-[-1]">
      {gradients[id as keyof typeof gradients]}
    </svg>
  );
}

