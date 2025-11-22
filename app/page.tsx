import {
  HeroSection,
  IntegrationsSection,
  KnowledgeCenterSection,
  ArchitectureSection,
  ModelsShowcase,
  Navbar,
  WhatIsRIFTSection,
  PerformanceSection,
  Footer,
  CTASection,
  PricingSection,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-amber-100 selection:text-amber-900 dark:selection:bg-amber-900 dark:selection:text-amber-50 overflow-x-hidden">
      {/* Header */}
      <Navbar />

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto px-4 mt-20 sm:px-6 lg:px-8 space-y-32">
        <HeroSection />
        <WhatIsRIFTSection />
        <PricingSection />
        <ArchitectureSection />
        <PerformanceSection />
        <IntegrationsSection />
        <CTASection />
      </div>
      {/* Footer */}
      <Footer />
    </div>
  );
}
