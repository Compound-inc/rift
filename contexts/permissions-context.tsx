"use client";

import { createContext, useContext, ReactNode } from "react";

interface PermissionsContextType {
  permissions: Set<string>;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

interface PermissionsProviderProps {
  children: ReactNode;
  initialPermissions: Set<string>;
}

export function PermissionsProvider({
  children,
  initialPermissions,
}: PermissionsProviderProps) {
  return (
    <PermissionsContext.Provider
      value={{
        permissions: initialPermissions,
        isLoading: false,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error(
      "usePermissionsContext must be used within a PermissionsProvider"
    );
  }
  return context;
}
