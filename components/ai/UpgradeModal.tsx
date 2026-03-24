"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  StandarIcon,
  PremiumIcon,
  AIModelsIcon,
} from "@/components/ui/icons/landing-icons";
import { RedoIcon } from "@/components/ui/icons/svg-icons";

function GradientBackground() {
  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 inline-block h-full w-full will-change-transform z-0">
      <rect width="300" height="300" fill="url(#paint0_radial_262_665)" />
      <rect width="300" height="300" fill="url(#paint1_radial_262_665)" />
      <rect width="300" height="300" fill="url(#paint2_radial_262_665)" />
      <rect width="300" height="300" fill="url(#paint3_radial_262_665)" />
      <defs>
        <radialGradient id="paint0_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
          <stop stopColor="#5767C2" stopOpacity="0.1" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint1_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
          <stop stopColor="#FF6D2E" stopOpacity="0.07" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint2_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
          <stop stopColor="#2CC256" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="paint3_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
          <stop stopColor="#2CC256" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

type UpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  const handleUpgrade = () => {
    router.push("/subscribe?plan=plus");
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden relative">
        <GradientBackground />
        
        {/* Close button */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 z-30"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Content */}
        <div className="p-10 space-y-8 relative z-20">
          {/* Main Title */}
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              RIFT Plus
            </h2>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-zinc-900 dark:text-white">
                $190
              </span>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                MXN /mes
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-5 flex flex-col items-center">
            <ul className="space-y-4">
              <li className="flex items-center text-sm text-zinc-700 dark:text-zinc-300">
                <div className="mr-3 shrink-0">
                  <StandarIcon className="h-5 w-5 text-zinc-900 dark:text-white opacity-80" />
                </div>
                <span>1,000 mensajes estándar</span>
              </li>
              <li className="flex items-center text-sm text-zinc-700 dark:text-zinc-300">
                <div className="mr-3 shrink-0">
                  <PremiumIcon className="h-5 w-5 text-zinc-900 dark:text-white opacity-80" />
                </div>
                <span>100 mensajes premium</span>
              </li>
              <li className="flex items-center text-sm text-zinc-700 dark:text-zinc-300">
                <div className="mr-3 shrink-0">
                  <AIModelsIcon className="h-5 w-5 text-zinc-900 dark:text-white opacity-80" />
                </div>
                <span>Acceso a todos los modelos</span>
              </li>
              <li className="flex items-center text-sm text-zinc-700 dark:text-zinc-300">
                <div className="mr-3 shrink-0">
                  <RedoIcon className="h-5 w-5 text-zinc-900 dark:text-white opacity-80" />
                </div>
                <span>Historial de chat limitado</span>
              </li>
            </ul>
          </div>

          {/* Upgrade Button */}
          <Button
            onClick={handleUpgrade}
            variant="accent"
            className="w-full h-9 rounded-full text-sm font-medium px-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            Comenzar con Plus
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
