export type LandingPlan = {
  name: string;
  priceAmount: number | null;
  currency: "MXN" | "USD";
  /** USD amount for English locale; when set, /en uses this with currency USD */
  usdPriceAmount?: number | null;
  billingPeriodLabel?: string;
  /** English billing period label (e.g. "mo") when showing USD */
  billingPeriodLabelEn?: string;
  description: string;
  features: string[];
  buttonText: string;
  href: string;
  popular?: boolean;
  gradientId: "1" | "2" | "3";
};

export const landingPlans: LandingPlan[] = [
  {
    name: "Plus",
    priceAmount: 190,
    currency: "MXN",
    usdPriceAmount: 9,
    billingPeriodLabel: "mes",
    billingPeriodLabelEn: "mo",
    description: "Para usuarios que quieren probar el poder de la IA.",
    features: ["1,000 mensajes estándar", "100 mensajes premium", "Acceso a todos los modelos", "Historial de chat limitado"],
    buttonText: "Comenzar con Plus",
    href: "/sign-up?plan=plus",
    gradientId: "1",
  },
  {
    name: "Pro",
    priceAmount: 490,
    currency: "MXN",
    usdPriceAmount: 24,
    billingPeriodLabel: "mes",
    billingPeriodLabelEn: "mo",
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
    gradientId: "2",
  },
  {
    name: "Enterprise",
    priceAmount: null,
    currency: "MXN",
    description: "Para equipos grandes con necesidades específicas.",
    features: ["Límites personalizados", "SSO (Single Sign-On)", "Logs de auditoría", "Integración SEICM", "SLA garantizado", "Soporte dedicado 24/7"],
    buttonText: "Contactar Ventas",
    href: "mailto:sales@rift.mx",
    gradientId: "3",
  },
];

