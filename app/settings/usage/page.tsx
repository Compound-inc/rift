"use client";

import { SettingsSection } from "@/components/settings";
import { UsageDataClient } from "./UsageDataClient";

export default function UsagePage() {
  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      <SettingsSection
        title="Uso y Límites"
        description="Monitorea el uso actual de tu cuota de mensajes Standard y Premium."
      >
        <div className="space-y-6">
          <UsageDataClient />

          {/* Info Card */}
          <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
            <div className="space-y-4">
              <div>
                <div className="flex items-start space-x-3">
                  <div className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-base leading-6 text-gray-900 dark:text-white">
                      Cómo funcionan las cuotas
                    </h4>
                    <ul className="text-sm text-gray-500 dark:text-text-muted space-y-2 list-disc pl-5">
                      <li>Cada mensaje enviado consume 1 crédito del tipo de mensaje correspondiente (Standard y Premium para modelos avanzados).</li>
                      <li>Las cuotas se reinician automáticamente al inicio del ciclo de tu organización.</li>
                      <li>Cada llamada a herramientas (como búsqueda web) realizada por la IA consume 1 crédito del plan Standard.</li>
                      <li>Los modelos de IA pueden realizar multiples llamadas a herramientas en un solo mensaje o ninguna dependiendo de la tarea que se le pida.</li>
                      <li>Si alcanzas el límite, no podrás enviar más mensajes para el tipo de mensaje correspondiente hasta el próximo ciclo.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
