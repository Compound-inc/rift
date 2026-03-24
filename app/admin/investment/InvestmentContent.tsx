"use client";

import { User, TrendingUp } from "lucide-react";

function GradientBackground({ id }: { id: string }) {
  const gradients = {
    "1": (
      <>
        <rect width="100%" height="100%" fill="url(#paint0_radial_inv)" />
        <rect width="100%" height="100%" fill="url(#paint1_radial_inv)" />
        <rect width="100%" height="100%" fill="url(#paint2_radial_inv)" />
        <rect width="100%" height="100%" fill="url(#paint3_radial_inv)" />
        <defs>
          <radialGradient id="paint0_radial_inv" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
            <stop stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_inv" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
            <stop stopColor="var(--accent-strong)" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="var(--accent-strong)" stopOpacity="0.1" />
            <stop offset="1" stopColor="var(--accent-strong)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_inv" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
            <stop stopColor="var(--accent-green-2)" stopOpacity="0.32" />
            <stop offset="0.5" stopColor="var(--accent-green-2)" stopOpacity="0.1" />
            <stop offset="1" stopColor="var(--accent-green-2)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_inv" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
            <stop stopColor="var(--accent-green)" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="var(--accent-green)" stopOpacity="0.08" />
            <stop offset="1" stopColor="var(--accent-green)" stopOpacity="0" />
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

export default function InvestmentContent() {
  return (
    <div className="min-h-screen bg-background selection:bg-amber-100 selection:text-amber-900 dark:selection:bg-amber-900 dark:selection:text-amber-50">
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-20 sm:px-6 lg:px-8 space-y-12">
        <section className="space-y-8 break-inside-avoid">
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Inversión y uso de fondos</h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Buscamos <strong>$1,540,000 MXN</strong> para financiar <strong>The Unreal Compound SA de CV</strong> y impulsar el desarrollo y expansión de <strong>RIFT</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-12">
            <div className="flex flex-1 flex-col justify-center gap-4">
              <ul className="list-disc space-y-2 pl-5 text-lg text-muted-foreground leading-relaxed md:text-xl">
                <li>Se ofrecen el <strong>40% de las acciones</strong> a inversionistas.</li>
                <li>Reparto de <strong>utilidades</strong> cada 6 meses.</li>
              </ul>
              <div className="flex flex-row flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 rounded-sm bg-accent" />
                  <span className="text-muted-foreground">Inversionistas 40%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 rounded-sm bg-accent-green-2" />
                  <span className="text-muted-foreground">Arisay Alvarez 60%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center gap-3 lg:items-center">
              <h2 className="text-md font-semibold tracking-tight text-center opacity-85">The Unreal Compound SA de CV</h2>
              <div
                className="aspect-square w-full max-w-[200px] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, var(--accent) 0deg, var(--accent-strong) 72deg, var(--accent) 144deg, var(--accent-green-2) 144deg, var(--accent-green) 252deg, var(--accent-green-2) 360deg)",
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Uso de fondos</h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Desglose de cómo se destinaría la inversión a operaciones, gastos fijos y equipamiento.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Los montos son <strong>números aproximados</strong> que reflejan estimaciones de los recursos necesarios para impulsar el crecimiento significativo de RIFT.
            </p>
          </div>

          <div className="relative w-full overflow-hidden">
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
              <table className="w-full table-fixed text-sm text-left relative z-10">
                <colgroup>
                  <col className="w-[11rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[8rem]" />
                  <col />
                </colgroup>
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b print:bg-gray-100">
                  <tr>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3 text-right">Mensual</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-3 font-medium">Operaciones mensuales</td>
                    <td className="px-6 py-3 text-right font-mono">$100,000</td>
                    <td className="px-6 py-3 text-right font-mono">$1,200,000</td>
                    <td className="px-6 py-3 text-muted-foreground">Sueldo, Servicios, Servidores, Viáticos, Equipamiento, Anuncios</td>
                  </tr>
                  <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-3 font-medium">Gastos anuales</td>
                    <td className="px-6 py-3 text-right font-mono">$20,833</td>
                    <td className="px-6 py-3 text-right font-mono">$250,000</td>
                    <td className="px-6 py-3 text-muted-foreground">Costos misceláneos fijos anuales</td>
                  </tr>
                  <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-3 font-medium">Equipamiento adicional</td>
                    <td className="px-6 py-3 text-right font-mono">—</td>
                    <td className="px-6 py-3 text-right font-mono">$90,000</td>
                    <td className="px-6 py-3 text-muted-foreground">MacBook para iOS development y un flujo de desarrollo mas eficiente</td>
                  </tr>
                  <tr className="bg-muted/30 font-bold border-t-2 border-border print:bg-gray-100 print:border-gray-400">
                    <td className="px-6 py-3">Subtotal</td>
                    <td className="px-6 py-3 text-right font-mono">$120,833</td>
                    <td className="px-6 py-3 text-right font-mono">$1,540,000</td>
                    <td className="px-6 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>

          <p className="text-base text-muted-foreground mb-2">
            De ser posible, sumaríamos una persona de ventas para contactar más clientes y acelerar el proceso de ventas.
          </p>

          <div className="relative w-full overflow-hidden">
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
              <table className="w-full table-fixed text-sm text-left relative z-10">
                <colgroup>
                  <col className="w-[11rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[8rem]" />
                  <col />
                </colgroup>
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b print:bg-gray-100">
                  <tr>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3 text-right">Mensual</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="hover:bg-muted/50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-3 font-medium">Sales Hire</td>
                    <td className="px-6 py-3 text-right font-mono">$50,000</td>
                    <td className="px-6 py-3 text-right font-mono">$600,000</td>
                    <td className="px-6 py-3 text-muted-foreground"> + Comisión por cada contracto cerrado<br/>El salario de $50,000 es una estimacion, sera ajustado segun el mercado laboral</td>
                  </tr>
                  <tr className="bg-muted/30 font-bold border-t-2 border-border print:bg-gray-100 print:border-gray-400">
                    <td className="px-6 py-3">Total</td>
                    <td className="px-6 py-3 text-right font-mono">$170,833</td>
                    <td className="px-6 py-3 text-right font-mono">$2,140,000</td>
                    <td className="px-6 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>

          <div className="flex flex-col gap-8">
            <article className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <TrendingUp className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                  Prioridad en ventas
                </h3>
                <p className="text-muted-foreground m-0">
                  Impulsar la generación de revenue a través de una persona de ventas dedicada con una estructura de incentivos por commission para lograr el crecimiento más rápido posible.
                </p>
              </div>
            </article>

            <article className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <User className="w-12 h-12 text-blue-500" />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <h3 className="tracking-[-0.5px] font-semibold text-xl leading-7 m-0">
                  No se requiere desarrollador adicional (por ahora)
                </h3>
                <p className="text-muted-foreground m-0">
                  En la etapa actual, programadores adicionales no son indispensables. Contratar programadores de calidad es difícil y toma tiempo. Me mantengo como unico desarrollador por ahora hasta que el revenue crezca lo suficiente para considerar la contratación de programadores adicionales.
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
