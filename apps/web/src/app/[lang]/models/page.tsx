import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModelsGrid } from "@/components/landing/models-grid";
import { Navbar, Footer } from "@/components/layout";
import CTASection from "@/components/landing/cta-section";
import { getDictionary, hasLocale } from "../dictionaries";

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

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const m = dict.modelsPage;
  const pageUrl = new URL(`/${lang}/models`, siteUrl).toString();
  return {
    title: `${m.title} | RIFT`,
    description: m.description,
    alternates: { canonical: `/${lang}/models` },
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
      title: `${m.title} | RIFT`,
      description: m.description,
      url: pageUrl,
      type: "website",
      images: [
        {
          url: new URL("/opengraph-image.png", siteUrl).toString(),
          width: 1200,
          height: 630,
          alt: m.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} | RIFT`,
      description: m.description,
      images: [new URL("/twitter-image.png", siteUrl).toString()],
    },
  };
}

export default async function ModelsPage({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const m = dict.modelsPage;

  return (
    <div className="min-h-screen bg-background">
      <Navbar dict={dict.navbar} lang={lang} />
      <main className="container mx-auto px-4 max-w-5xl p-28">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            {m.title}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {m.intro}
          </p>
        </div>
        <ModelsGrid
          dict={dict}
          modelDescriptions={dict.performance.modelDescriptions}
        />
      </main>
      <div className="container mx-auto px-4 max-w-5xl">
        <CTASection dict={dict.cta} />
      </div>
      <Footer dict={dict.footer} lang={lang} />
    </div>
  );
}
