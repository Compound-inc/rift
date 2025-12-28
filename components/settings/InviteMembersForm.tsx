'use client';

import React, { useState } from 'react';
import { SettingsInput } from './SettingsInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ai/ui/select';

interface InviteMembersFormProps {
  onInvite: (email: string, role: string) => void;
  isLoading?: boolean;
}

export function InviteMembersForm({ onInvite, isLoading = false }: InviteMembersFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onInvite(email.trim(), role);
      setEmail('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-4">
      <SettingsInput
        type="email"
        placeholder="Ingresa direcciones de correo..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        width="flex-1"
        className=" focus:ring-2 focus:ring-blue-500 bg-background-settings"
      />
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Selecciona un rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Miembro</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
          <SelectItem value="owner">Propietario</SelectItem>
        </SelectContent>
      </Select>
      <button
        type="submit"
        disabled={isLoading || !email.trim()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Enviando...' : 'Enviar invitación'}
      </button>
    </form>
  );
}
