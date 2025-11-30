'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  SettingsSection,
  SettingsDivider,
} from "@/components/settings";

type Theme = 'light' | 'dark' | 'system';

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const handleKeyDown = (event: React.KeyboardEvent, theme: Theme) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleThemeChange(theme);
    }
  };

  const themeOptions = [
    {
      id: 'light' as Theme,
      name: 'Claro',
      description: 'Tema claro por defecto',
      preview: 'bg-white',
      icon: 'bg-gray-100',
      borderColor: mounted && theme === 'light' ? 'border-blue-500' : 'border-gray-200 dark:border-border',
    },
    {
      id: 'dark' as Theme,
      name: 'Oscuro',
      description: 'Tema oscuro para poca luz',
      preview: 'bg-gray-900',
      icon: 'bg-gray-700',
      borderColor: mounted && theme === 'dark' ? 'border-blue-500' : 'border-gray-200 dark:border-border',
    },
    {
      id: 'system' as Theme,
      name: 'Sistema',
      description: 'Seguir preferencia del sistema',
      preview: 'bg-gradient-to-br from-white to-gray-900',
      icon: 'bg-gray-400',
      borderColor: mounted && theme === 'system' ? 'border-blue-500' : 'border-gray-200 dark:border-border',
    },
  ];


  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
      {/* Theme Selection */}
      <SettingsSection
        title="Tema"
        description="Elige tu tema preferido para la interfaz del workspace."
      >
        <div className="grid grid-cols-3 gap-4">
          {themeOptions.map((themeOption) => (
            <div
              key={themeOption.id}
              className={`border-2 ${themeOption.borderColor} rounded-lg p-4 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-popover-main`}
              onClick={() => handleThemeChange(themeOption.id)}
              onKeyDown={(e) => handleKeyDown(e, themeOption.id)}
              tabIndex={0}
              role="button"
              aria-label={`Seleccionar tema ${themeOption.name.toLowerCase()}`}
            >
              <div className={`${themeOption.preview} rounded border h-20 mb-3 flex items-center justify-center`}>
                <div className={`w-8 h-8 ${themeOption.icon} rounded`}></div>
              </div>
              <div className="text-center">
                <h3 className="font-medium text-gray-900 dark:text-white">{themeOption.name}</h3>
                <p className="text-sm text-gray-500 dark:text-text-muted">{themeOption.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsDivider />
    </div>
  );
}
