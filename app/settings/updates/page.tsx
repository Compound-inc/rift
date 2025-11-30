import React from 'react';
import {
  SettingsSection,
  SettingsDivider,
} from "@/components/settings";
import {
  ArrowRightIcon,
} from "lucide-react";
import { EarlyAccessIcon } from "@/components/ui/icons/landing-icons";

interface UpdateItem {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  features: string[];
  isInstalled?: boolean;
}

export default function UpdatesPage() {
  // Static data - in a real app, this could come from a CMS or API
  const updates: UpdateItem[] = [
    {
      id: '1.1.1',
      version: '1.1.1',
      date: '2025-11-27',
      title: 'Nuevos Modelos y Capacidades',
      description: 'Nuevos modelos de IA, expansión de capacidades PDF y mejoras de rendimiento en la selección de modelos.',
      features: [
        'Nuevo modelo Intellect 3 de Prime Intellect disponible',
        'Claude Opus 4.5 agregado como versión beta',
        'Soporte para PDF expandido a más modelos',
        'Optimizaciones en la lógica de selección de modelos para mejorar el rendimiento',
        'Mejoras generales de estabilidad y rendimiento',
      ],
      isInstalled: true
    },
    {
      id: '1.1.0',
      version: '1.1.0',
      date: '2024-11-24',
      title: 'Actualización de Noviembre',
      description: 'Nueva actualización con mejoras al sistema de cuotas, nuevos modelos de IA y múltiples correcciones.',
      features: [
        'Mejoras significativas al sistema de gestión de cuotas',
        'Nuevo modelo Grok 4.1 de xAI',
        'Nuevo modelo Gemini 3 Pro de Google',
        'Soporte para modelos GLM',
        'Integración de Moonshot Kimi K2',
        'Nuevos modelos GPT 5.1 Instant y GPT 5.1 Thinking',
        'Múltiples correcciones y hotfixes de estabilidad',
        'Optimizaciones de rendimiento en el procesamiento de solicitudes',
      ],
      isInstalled: true
    },
    {
      id: '1.0.0',
      version: '1.0.0',
      date: '2025-10-13',
      title: 'Lanzamiento de Rift',
      description: 'La primera versión de Rift, una plataforma de IA avanzada con múltiples proveedores y capacidades de razonamiento.',
      features: [
        'Soporte para múltiples proveedores de IA (OpenAI, xAI, Anthropic, Google, DeepSeek, Mistral)',
        'Modelos de razonamiento avanzado',
        'Procesamiento de imágenes y PDFs',
        'Herramientas de búsqueda web',
        'Sistema de autenticación seguro',
        'Personalización de temas (claro, oscuro, automático)',
        'Gestión de modelos y configuraciones',
      ],
      isInstalled: true
    }
  ];

  const getStatusIcon = (update: UpdateItem) => {
    return <EarlyAccessIcon className="size-8 text-gray-500 dark:text-popover-text" />;
  };

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
      {/* Updates Management */}
      <SettingsSection
        title="Actualizaciones"
        description="Mantén tu aplicación actualizada con las últimas mejoras y características."
      >
        <div className="space-y-4">
          {updates.map((update) => (
            <div
              key={update.id}
              className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(update)}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {update.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-text-muted">
                      Versión {update.version} • {new Date(update.date).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Status icon only, no text */}
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-text-muted mb-3">
                {update.description}
              </p>

              {/* Features List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Características:
                </h4>
                <ul className="space-y-1">
                  {update.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-text-muted">
                      <div className="w-1.5 h-1.5 mt-2 bg-gray-400 rounded-full flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
