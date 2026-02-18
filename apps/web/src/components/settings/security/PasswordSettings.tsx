"use client";

import { PasswordChangeModal } from "./PasswordChangeModal";

export function PasswordSettings() {
  return <PasswordChangeModal hasPassword={true} isPending={false} />;
}
