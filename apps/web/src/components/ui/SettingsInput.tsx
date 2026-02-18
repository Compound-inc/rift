import React from 'react';

interface SettingsInputProps {
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxLength?: number;
  autoComplete?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  width?: string;
  error?: boolean;
}

export function SettingsInput({ 
  type = 'text',
  placeholder,
  defaultValue,
  value,
  onChange,
  maxLength,
  autoComplete,
  readOnly = false,
  disabled = false,
  className = "",
  width = "w-[350px]",
  error = false
}: SettingsInputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      autoComplete={autoComplete}
      readOnly={readOnly}
      disabled={disabled}
      className={`rounded-lg px-2 py-2 text-sm leading-5 ${width} font-normal text-gray-900 dark:text-white outline-none focus:outline-none ${error ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : 'bg-background-settings hover:bg-hover'} disabled:cursor-not-allowed ${className}`}
    />
  );
}
