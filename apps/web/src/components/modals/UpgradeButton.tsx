"use client";

import { useState } from "react";
import { Button } from "@rift/ui/button";
import { UpgradeModal } from "./UpgradeModal";
import { usePricingContext } from "@/lib/use-pricing-context";

export function UpgradeButton() {
  const pricingContext = usePricingContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (
    pricingContext.isLoading ||
    !pricingContext.isAuthenticated ||
    pricingContext.currentPlan !== "free"
  ) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="accent"
        onClick={() => setIsModalOpen(true)}
        className="text-xs px-4"
      >
        Actualizar a Plus
      </Button>
      <UpgradeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
