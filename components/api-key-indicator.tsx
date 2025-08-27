"use client";

import { Key, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { hasValidApiKey } from "@/lib/api-keys";
import { useEffect, useState } from "react";

interface ApiKeyIndicatorProps {
  modelId: string;
  className?: string;
}

export default function ApiKeyIndicator({
  modelId,
  className,
}: ApiKeyIndicatorProps) {
  const [keyStatus, setKeyStatus] = useState<'none' | 'custom' | 'env'>('none');

  useEffect(() => {
    // Check API key status for the current model's provider
    if (modelId.startsWith("openai:")) {
      setKeyStatus(hasValidApiKey("openai") ? 'custom' : 'none');
    } else if (modelId.startsWith("openrouter:")) {
      if (hasValidApiKey("openrouter")) {
        setKeyStatus('custom');
      } else {
        // For OpenRouter, we can use environment variables
        setKeyStatus('env');
      }
    } else if (modelId.startsWith("mistral:")) {
      // Mistral uses environment variables by default
      setKeyStatus('env');
    } else {
      setKeyStatus('none');
    }
  }, [modelId]);

  if (keyStatus === 'none') {
    return null;
  }

  const isCustom = keyStatus === 'custom';

  return (
    <Badge
      variant="secondary"
      className={`border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 ${className}`}
    >
      {isCustom ? (
        <>
          <Key className="mr-1 h-3 w-3" />
          Using your API key
        </>
      ) : (
        <>
          <Globe className="mr-1 h-3 w-3" />
          Free access
        </>
      )}
    </Badge>
  );
}
