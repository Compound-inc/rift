"use client";

import { createContext, useContext, ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type OrgPlan = "free" | "plus" | "pro" | "enterprise";

export interface OrgInfo {
  name: string;
  plan: OrgPlan | null;
  productStatus: string;
}

interface OrgContextType {
  orgInfo: OrgInfo | null;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

interface OrgProviderProps {
  children: ReactNode;
}

export function OrgProvider({ children }: OrgProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const orgInfo = useQuery(
    api.organizations.getCurrentOrganizationInfo,
    isAuthenticated ? {} : "skip"
  );

  const isLoading = authLoading || (isAuthenticated && orgInfo === undefined);
  const value: OrgContextType = {
    orgInfo: orgInfo ?? null,
    isLoading,
  };

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgContext(): OrgContextType {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrgContext must be used within an OrgProvider");
  }
  return context;
}
