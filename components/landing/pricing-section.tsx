"use client";

import { Button } from "@/components/ai/ui/button";
import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
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

const plans = [
  {
    name: "Plus",
    price: "$10",
    period: "USD/mes",
    description: "Para usuarios que quieren probar el poder de la IA.",
    features: [
      "1,000 mensajes estándar",
      "100 mensajes premium",
      "Acceso a todos los modelos",
      "Historial de chat limitado",
    ],
    buttonText: "Comenzar con Plus",
    href: "/sign-up?plan=plus",
    popular: false,
  },
  {
    name: "Pro",
    price: "$27",
    period: "USD/mes",
    description: "Para profesionales que necesitan más capacidad.",
    features: [
      "2,700 mensajes estándar",
      "270 mensajes premium",
      "Acceso a todos los modelos",
      "Soporte prioritario",
      "Historial de chat ilimitado",
    ],
    buttonText: "Obtener Pro",
    href: "/sign-up?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para equipos grandes con necesidades específicas.",
    features: [
      "Límites personalizados",
      "SSO (Single Sign-On)",
      "Logs de auditoría",
      "Integración SEICM",
      "SLA garantizado",
      "Soporte dedicado 24/7",
    ],
    buttonText: "Contactar Ventas",
    href: "mailto:sales@example.com",
    popular: false,
  },
];

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

export default function PricingSection() {
  return (
    <section className="py-24 relative" id="pricing">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Planes Simples y Transparentes
          </h2>
          <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Elige el plan que mejor se adapte a tus necesidades. Sin costos ocultos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative flex flex-col p-8 bg-background rounded-2xl border ${
                plan.popular
                  ? "border-accent shadow-lg shadow-accent/10 ring-1 ring-accent"
                  : "border-border shadow-sm"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-white text-xs font-bold rounded-full uppercase tracking-wide">
                  Más Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline text-muted-foreground">
                  <span className="text-4xl font-bold text-foreground tracking-tight">
                    {plan.price}
                  </span>
                  <span className="ml-1 text-sm font-medium">{plan.period}</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature) => {
                  const Icon = getFeatureIcon(feature);
                  return (
                    <li key={feature} className="flex items-center">
                      <div className="mr-3 shrink-0">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Button
                asChild
                variant={plan.popular ? "default" : "outline"}
                className={`w-full ${
                  plan.popular
                    ? "bg-accent hover:bg-accent/80 text-white"
                    : "hover:bg-accent/10 dark:hover:bg-accent/20"
                }`}
              >
                <Link href={plan.href}>{plan.buttonText}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
