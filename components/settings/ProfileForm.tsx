"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";

import { updateCurrentUserProfile } from "@/actions/updateCurrentUserProfile";
import { SettingRow, SettingsInput } from "@/components/settings";
import { Button } from "@/components/ai/ui/button";

export type ProfileFormUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

export function ProfileForm({ initialUser }: { initialUser: ProfileFormUser }) {
  const [savedFirstName, setSavedFirstName] = useState(
    initialUser.firstName ?? "",
  );
  const [savedLastName, setSavedLastName] = useState(initialUser.lastName ?? "");
  const [firstName, setFirstName] = useState(initialUser.firstName ?? "");
  const [lastName, setLastName] = useState(initialUser.lastName ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const [isSubmitCoolingDown, setIsSubmitCoolingDown] = useState(false);
  const cooldownTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current !== null) {
        window.clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
    };
  }, []);

  const displayName = useMemo(() => {
    const name = `${firstName} ${lastName}`.trim();
    return name || initialUser.email;
  }, [firstName, lastName, initialUser.email]);

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const isDirty = (firstName ?? "") !== (savedFirstName ?? "") || (lastName ?? "") !== (savedLastName ?? "");

  const onSave = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTimeRef.current;
    const THROTTLE_MS = 2000;
    
    if (timeSinceLastSubmit < THROTTLE_MS && lastSubmitTimeRef.current > 0) {
      // Too soon, ignore this submission
      return;
    }
    
    lastSubmitTimeRef.current = now;
    setIsSubmitCoolingDown(true);
    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current);
    }
    cooldownTimeoutRef.current = window.setTimeout(() => {
      setIsSubmitCoolingDown(false);
      cooldownTimeoutRef.current = null;
    }, THROTTLE_MS);
    
    startTransition(async () => {
      setError(null);

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();

      const result = await updateCurrentUserProfile({
        firstName: trimmedFirstName || null,
        lastName: trimmedLastName || null,
      });

      if (!result.success) {
        setError(result.error ?? "No se pudo guardar el perfil.");
        return;
      }

      const newFirstName = result.user.firstName ?? trimmedFirstName ?? "";
      const newLastName = result.user.lastName ?? trimmedLastName ?? "";
      setFirstName(newFirstName);
      setLastName(newLastName);
      setSavedFirstName(newFirstName);
      setSavedLastName(newLastName);
      
      // Exit edit mode after successful save
      setIsEditing(false);
    });
  }, [firstName, lastName]);

  const handleCancel = () => {
    // Reset to saved values
    setFirstName(savedFirstName);
    setLastName(savedLastName);
    setError(null);
    setIsEditing(false);
  };

  return (
    <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
      <div className="space-y-6">
        {/* Profile Picture Section */}
        <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {initialUser.profilePictureUrl ? (
            <Image
              className="h-16 w-16 rounded-full object-cover"
              src={initialUser.profilePictureUrl}
              alt={displayName}
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-t from-blue-500 to-blue-400 flex items-center justify-center">
              <span className="text-xl font-semibold text-white">
                {getInitial(displayName)}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {displayName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-text-muted">
            {initialUser.email}
          </p>
        </div>
        {!isEditing && (
          <Button
            type="button"
            onClick={() => setIsEditing(true)}
            variant="accent"
          >
            Editar perfil
          </Button>
        )}
      </div>

      {/* Profile Form */}
      {isEditing && (
        <>
          <div className="border-b border-gray-200 dark:border-border pb-4"></div>
          <form onSubmit={onSave} className="space-y-4">
        <SettingRow label="Correo electrónico" labelClassName="mb-[5px]">
          <SettingsInput
            type="email"
            value={initialUser.email}
            readOnly
            disabled
            className="opacity-60 cursor-not-allowed"
            width="w-[350px]"
          />
        </SettingRow>

        <SettingRow label="Nombre">
          <SettingsInput
            type="text"
            placeholder="Ingresa tu nombre"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={100}
            autoComplete="given-name"
            width="w-[350px]"
          />
        </SettingRow>

        <SettingRow label="Apellido" labelClassName="mt-[5px]">
          <SettingsInput
            type="text"
            placeholder="Ingresa tu apellido"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={100}
            autoComplete="family-name"
            width="w-[350px]"
          />
        </SettingRow>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="flex justify-start items-start gap-2 pt-0">
          <Button 
            type="submit" 
            disabled={!isDirty || isPending || isSubmitCoolingDown} 
            variant="accent"
          >
            {isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>
        </>
      )}
      </div>
    </div>
  );
}

