import type { Metadata } from "next";
import { ModelsGrid } from "@/components/landing/models-grid";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";
import CTASection from "@/components/landing/cta-section";

const defaultSiteUrl = "https://rift.mx";
const deploymentDomain =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL;
const siteUrl = deploymentDomain
  ? deploymentDomain.startsWith("http")
    ? deploymentDomain
    : `https://${deploymentDomain}`
  : defaultSiteUrl;
const pageUrl = new URL("/models", siteUrl).toString();

export const metadata: Metadata = {
  title: "Catálogo de Modelos",
  description: "Explora todos los modelos de inteligencia artificial disponibles en RIFT, desde GPT-5.1 Thinking hasta Gemini 3 Pro y Mistral, en una sola plataforma.",
  alternates: {
    canonical: "/models",
  },
  keywords: [
    "modelos de ia",
    "catalogo ia",
    "chatgpt",
    "anthropic claude",
    "google gemini",
    "xai grok",
    "deepseek",
    "mistral",
  ],
  openGraph: {
    title: "Catálogo de Modelos de IA | RIFT",
    description: "Explora la biblioteca completa de modelos disponibles en RIFT",
    url: pageUrl,
    type: "website",
    images: [
      {
        url: new URL("/opengraph-image.png", siteUrl).toString(),
        width: 1200,
        height: 630,
        alt: "Catálogo de modelos de IA en RIFT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catálogo de Modelos de IA | RIFT",
    description: "Explora la biblioteca completa de modelos disponibles en RIFT.",
    images: [new URL("/twitter-image.png", siteUrl).toString()],
  },
};

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-24 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Modelos Disponibles</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explora nuestra extensa biblioteca de modelos de inteligencia artificial.
            Desde modelos de razonamiento avanzado hasta modelos especializados en código y creatividad.
          </p>
        </div>
        <ModelsGrid />
      </main>
      <div className="container mx-auto px-4 max-w-5xl mb-12">
        <CTASection />
      </div>
      <Footer />
    </div>
  );
}
