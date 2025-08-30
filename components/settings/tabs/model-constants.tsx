import React from "react";
import { Eye, FileText, Search, ExternalLink, Zap, Key, FlaskConical } from "lucide-react";
import { GoogleIcon } from "@/components/ui/icons/google-icon";

export interface ModelFeature {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  description?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: "google";
  description: string;
  features: string[];
  enabled: boolean;
  showMore?: boolean;
  modelTags?: { icon: keyof typeof tagIcons; description: string }[];
}

export const modelFeatures: Record<string, ModelFeature> = {
  vision: {
    id: "vision",
    label: "Vision",
    icon: <Eye className="h-3 w-3" />,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    description: "Supports image and video analysis",
  },
  pdfs: {
    id: "pdfs",
    label: "PDFs",
    icon: <FileText className="h-3 w-3" />,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    description: "Supports PDF uploads and analysis",
  },
  search: {
    id: "search",
    label: "Search",
    icon: <Search className="h-3 w-3" />,
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    description: "Uses search to answer questions",
  },
  reasoning: {
    id: "reasoning",
    label: "Reasoning",
    icon: <ExternalLink className="h-3 w-3" />,
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    description: "Has reasoning capabilities",
  },
  fast: {
    id: "fast",
    label: "Fast",
    icon: <Zap className="h-3 w-3" />,
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    description: "Optimized for speed and quick responses",
  },
};

export const tagIcons: Record<string, React.ReactNode> = {
  experimental: (
    <span title="Experimental">
      <FlaskConical className="h-3 w-3 text-orange-500" />
    </span>
  ),
  requiresApiKey: (
    <span title="Requires API Key">
      <Key className="h-3 w-3 text-blue-500" />
    </span>
  ),
};

export const initialModels: AIModel[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description:
      "Google's fast multi‑modal model with large context.",
    features: ["vision", "pdfs", "search"],
    enabled: false,
    showMore: false,
    modelTags: [
      {
        icon: "experimental",
        description: "Experimental model",
      },
    ],
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description:
      "Google's latest fast model with strong capabilities and web search.",
    features: ["vision", "pdfs", "search"],
    enabled: true,
    showMore: false,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description:
      "Higher‑quality Gemini with advanced reasoning and tools.",
    features: ["reasoning", "pdfs", "search"],
    enabled: false,
    showMore: false,
    modelTags: [
      {
        icon: "requiresApiKey",
        description: "Requires API Key",
      },
    ],
  },
];

export const providerIcons = {
  google: <GoogleIcon className="h-6 w-6" />,
}; 