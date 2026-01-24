import {
  webSearch,
  financeSearch,
  paperSearch,
  bioSearch,
  patentSearch,
  secSearch,
  economicsSearch,
  companyResearch,
} from "@valyu/ai-sdk";

const defaultConfig = {
  maxNumResults: 5,
  relevanceThreshold: 0.7,
  searchType: "web" as const,
};

// Company research has a different config structure
const companyResearchConfig = {
  dataMaxPrice: 100, // $1.00 default
};

/**
 * Exports all Valyu search tools.
 */
export const valyuSearchTools = {
  webSearch: webSearch({
    ...defaultConfig,
  }),

  financeSearch: financeSearch({
    ...defaultConfig,
  }),

  paperSearch: paperSearch({
    ...defaultConfig,
  }),

  bioSearch: bioSearch({
    ...defaultConfig,
  }),

  patentSearch: patentSearch({
    ...defaultConfig,
  }),

  secSearch: secSearch({
    ...defaultConfig,
  }),

  economicsSearch: economicsSearch({
    ...defaultConfig,
  }),

  companyResearch: companyResearch({
    ...companyResearchConfig,
  }),
};
