/**
 * Shared dictionary shape for i18n. Used by server (dictionaries.ts) and client (locale-context).
 * Add new keys here and in app/[lang]/dictionaries/*.json when expanding translations.
 */
export type Locale = "en" | "es";

export type PlanSlug = "plus" | "pro" | "enterprise";

export type Dictionary = {
  hero: {
    headline1: string;
    headline2: string;
    description: string;
    poweredBy: string;
    imageAlt: string;
    imageCaption: string;
    ctaChat: string;
    ctaSubscribe: string;
    ctaLoading: string;
  };
  skipToContent: string;
  chat: {
    title: string;
    newChat: string;
    placeholder: string;
    send: string;
    inputPlaceholder: string;
  };
  navbar: {
    goHome: string;
    about: string;
    pricing: string;
    models: string;
    mainNavLabel: string;
    signIn: string;
    signUp: string;
    goToChat: string;
  };
  footer: {
    tagline: string;
    address: string[];
    product: string;
    company: string;
    support: string;
    features: string;
    availableModels: string;
    pricing: string;
    integrations: string;
    updates: string;
    about: string;
    blog: string;
    careers: string;
    contact: string;
    helpCenter: string;
    documentation: string;
    status: string;
    privacyPolicy: string;
    termsOfService: string;
    copyright: string;
  };
  whatIsRift: {
    label: string;
    heading: string;
    body: string;
  };
  cta: {
    heading: string;
    summary: string;
    signUp: string;
    signUpAria: string;
  };
  pricing: {
    heading: string;
    summary: string;
    mostPopular: string;
    /** Promo badge: first month free */
    promoFirstMonthFree: string;
    /** Promo badge: first month X% off, use {percent} placeholder */
    promoFirstMonthPercentOff: string;
    /** Promo disclaimer before regular price, e.g. "then, $9/mo" */
    promoThen: string;
    featuresLabel: string; // use {planName} as placeholder
    customPrice: string;
    plans: Record<PlanSlug, { description: string; buttonText: string; features: string[] }>;
    /** Button states for pricing table (loading, subscribe, manage, etc.) */
    button: {
      loading: string;
      subscribe: string;
      activeSubscription: string;
      manage: string;
      active: string;
      changeToPro: string;
      changeToPlan: string; // use {planName} as placeholder
    };
  };
  architecture: {
    label: string;
    heading: string;
    fastResponses: string;
    fastResponsesDesc: string;
    allModels: string;
    allModelsDesc: string;
    dataPrivacy: string;
    dataPrivacyDesc: string;
    orgReady: string;
    orgReadyDesc: string;
    advancedIntegrations: string;
    advancedIntegrationsDesc: string;
  };
  performance: {
    label: string;
    heading: string;
    intro: string;
    oneSubscriptionHeading: string;
    oneSubscription: string;
    oneSubscriptionDesc: string;
    chooseModels: string;
    chooseModelsDesc: string;
    noLimits: string;
    noLimitsDesc: string;
    bestResults: string;
    bestResultsDesc: string;
    catalogHeading: string;
    catalogSummary: string;
    viewAllModels: string;
    viewAllModelsAria: string;
    /** Demo messages for the mock chat (user prompt + AI response). */
    mockChatExamples: Array<{ user: string; ai: string }>;
    /** Optional: model id -> description for catalog/marquee (e.g. English when MODELS have Spanish). */
    modelDescriptions?: Record<string, string>;
  };
  integrations: {
    label: string;
    heading: string;
    intro: string;
    supportNote: string;
  };
  faq: {
    label: string;
    heading: string;
    summary: string;
    items: Array<{ question: string; answer: string }>;
  };
  modelsPage: {
    title: string;
    description: string;
    intro: string;
    searchPlaceholder: string;
    noResults: string;
    capabilities: {
      supportsTools: string;
      supportsReasoning: string;
      supportsImageInput: string;
      supportsPDFInput: string;
    };
  };
  onboarding: {
    modelSelectorTitle: string;
    modelSelectorBody: string;
    modelSelectorDialogTitle: string;
    modelSelectorDialogBody: string;
    modelSelectorProvidersTitle: string;
    modelSelectorProvidersBody: string;
    searchToggleTitle: string;
    searchToggleBody: string;
    attachFilesTitle: string;
    attachFilesBody: string;
    customInstructionsTitle: string;
    customInstructionsBody: string;
    doneTitle: string;
    doneBody: string;
    next: string;
    previous: string;
    skip: string;
    done: string;
  };
};
