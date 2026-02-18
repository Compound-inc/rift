"use client";

import React, { useState } from "react";
import { Dialog } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { SettingsInput } from "@/components/ui/SettingsInput";
import { ensureWorkosOrganization } from "@/actions/ensureWorkosOrganization";

export function ModalDialog({
  subscriptionLevel,
  userId,
  organizationId,
  buttonText = "Suscribir",
  trigger,
}: {
  subscriptionLevel: string;
  userId: string;
  organizationId?: string | null;
  buttonText?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const { switchToOrganization } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubscribe = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!organizationId && orgName === "") {
      setError(
        "Por favor, completa el nombre de la organización antes de continuar.",
      );
      setLoading(false);
      return;
    }

    try {
      if (organizationId) {
        router.push(`/subscribe?plan=${subscriptionLevel.toLowerCase()}`);
        return;
      }

      const { organizationId: newOrgId } = await ensureWorkosOrganization({ orgName });
      await switchToOrganization(newOrgId);
      router.push(`/subscribe?plan=${subscriptionLevel.toLowerCase()}`);
      return;
    } catch (err) {
      setLoading(false);
      setError(
        `Error al suscribirse al plan: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`,
      );
      return;
    }

    setLoading(false);
    setError("Error desconocido al suscribirse.");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        {trigger ? (
          trigger
        ) : (
        <button
          onClick={() => setError("")}
          className="w-full mt-6 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors duration-200"
        >
          {buttonText}
        </button>
        )}
      </Dialog.Trigger>
      <Dialog.Content className="max-w-sm p-6">
        <Dialog.Title className="font-semibold text-base leading-6 mb-1">
          Suscribirse a {subscriptionLevel}
        </Dialog.Title>

        <div className="space-y-6">
          {!organizationId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la organización
            </label>
            <SettingsInput
              placeholder="Ingresa el nombre de tu organización"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              width="w-full"
            />
          </div>
          )}
          
          {organizationId && (
            <p className="text-sm text-gray-500">
              Se suscribirá a la organización actual.
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center">
                <InfoCircledIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Dialog.Close>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200">
                Cancelar
              </button>
            </Dialog.Close>
            <Dialog.Close>
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? "Procesando..." : "Suscribir"}
              </button>
            </Dialog.Close>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
