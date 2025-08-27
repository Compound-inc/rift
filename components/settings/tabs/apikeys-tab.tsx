"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { Key, CheckCircle, XCircle, Trash, Globe } from "lucide-react";
import {
  getStoredApiKeys,
  saveApiKey,
  removeApiKey,
  validateApiKey,
  type ApiKeyProvider,
} from "@/lib/api-keys";
import { toast } from "sonner";
import CustomButton from "@/components/custom-button";

// API Key provider configuration
const API_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI API Key",
    icon: <TablerBrandOpenai className="h-5 w-5" />,
    models: ["GPT-4o", "GPT-4o Mini", "GPT-4 Turbo"],
    consoleUrl: "OpenAI's Dashboard",
    consoleLink: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "openrouter",
    name: "OpenRouter API Key",
    icon: <Globe className="h-5 w-5" />,
    models: [
      "Claude 3.5 Sonnet",
      "GPT-4o via OpenRouter",
      "Llama 3.1 405B",
      "Gemini Pro 1.5",
      "100+ More Models",
    ],
    consoleUrl: "OpenRouter's Dashboard",
    consoleLink: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
  },
] as const;

export default function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: "",
    openrouter: "",
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    openai: false,
    openrouter: false,
  });
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  // Load saved API keys on component mount
  useEffect(() => {
    const storedKeys = getStoredApiKeys();
    const loadedKeys: Record<string, string> = {};
    const savedStates: Record<string, boolean> = {};

    Object.entries(storedKeys).forEach(([provider, key]) => {
      if (key) {
        // Show masked version of the key
        loadedKeys[provider] = key;
        savedStates[provider] = true;
      }
    });

    setApiKeys((prev) => ({ ...prev, ...loadedKeys }));
    setSavedKeys(savedStates);
  }, []);

  const handleApiKeyChange = (providerId: string, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [providerId]: value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[providerId]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
    }
  };

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const handleSaveApiKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    try {
      const isValid = await validateApiKey(providerId as ApiKeyProvider, apiKey);
      if (!isValid) {
        setValidationErrors((prev) => ({
          ...prev,
          [providerId]: "Invalid API key format",
        }));
        return;
      }

      await saveApiKey(providerId as ApiKeyProvider, apiKey);
      setSavedKeys((prev) => ({ ...prev, [providerId]: true }));
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
      toast.success("API key saved successfully!");
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    }
  };

  const handleRemoveApiKey = async (providerId: string) => {
    try {
      await removeApiKey(providerId as ApiKeyProvider);
      setApiKeys((prev) => ({ ...prev, [providerId]: "" }));
      setSavedKeys((prev) => ({ ...prev, [providerId]: false }));
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
      toast.success("API key removed successfully!");
    } catch (error) {
      console.error("Error removing API key:", error);
      toast.error("Failed to remove API key");
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">API Keys</h2>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Free AI access is enabled by default!</strong> Your app uses OpenRouter API keys from environment variables for free AI access. 
          Add your own API keys below to use premium models, avoid rate limits, or use different providers.
          Your keys are stored locally in your browser.
        </p>
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Default Free Access Active</span>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            Using OpenRouter API key from environment variables
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {API_PROVIDERS.map((provider) => (
          <div key={provider.id} className="space-y-3">
            <div className="flex items-center gap-2">
              {provider.icon}
              <h3 className="font-medium">{provider.name}</h3>
              {savedKeys[provider.id] && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Saved
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Available models:</p>
              <div className="flex flex-wrap gap-1">
                {provider.models.slice(0, 3).map((model) => (
                  <Badge key={model} variant="outline" className="text-xs py-0">
                    {model}
                  </Badge>
                ))}
                {provider.models.length > 3 && (
                  <Badge variant="outline" className="text-xs py-0">
                    +{provider.models.length - 3} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKeys[provider.id] ? "text" : "password"}
                    placeholder={provider.placeholder}
                    value={apiKeys[provider.id]}
                    onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                    className={`pr-10 ${validationErrors[provider.id] ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 px-0"
                    onClick={() => toggleKeyVisibility(provider.id)}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
                <CustomButton
                  onClick={() => handleSaveApiKey(provider.id)}
                  disabled={!apiKeys[provider.id].trim()}
                  className="shrink-0"
                >
                  Save
                </CustomButton>
              </div>

              {validationErrors[provider.id] && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {validationErrors[provider.id]}
                </div>
              )}

              {savedKeys[provider.id] && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveApiKey(provider.id)}
                  className="w-fit"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href={provider.consoleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                {provider.consoleUrl}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
