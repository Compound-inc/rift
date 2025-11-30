"use client";

import React, { useState, useEffect } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsDivider } from "@/components/settings/SettingsDivider";
import { FieldSet, Field, FieldLabel, FieldDescription, FieldContent, FieldError, FieldGroup } from "@/components/ai/ui/field";
import { Input } from "@/components/ai/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ai/ui/textarea";
import { Button } from "@/components/ai/ui/button";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ReportarErroresPage() {
  const router = useRouter();
  const reportBug = useMutation(api.bugs.report);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pasos, setPasos] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [errors, setErrors] = useState<{ [k: string]: string | undefined }>({});

  const validate = () => {
    const newErrors: { [k: string]: string | undefined } = {};
    if (!titulo.trim()) newErrors.titulo = "El título es obligatorio";
    if (!descripcion.trim()) newErrors.descripcion = "La descripción es obligatoria";
    if (priority === "") newErrors.priority = "La prioridad es obligatoria";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitStatus('submitting');
    try {
      await reportBug({
        title: titulo,
        description: descripcion,
        stepsToReproduce: pasos || undefined,
        priority: priority as "low" | "medium" | "high" | "critical",
        browserDetails: typeof navigator !== "undefined"
          ? `${navigator.userAgent}; lang=${(navigator as any).language || ""}; platform=${(navigator as any).platform || ""}; vendor=${(navigator as any).vendor || ""}`
          : "",
      });
      setTitulo("");
      setDescripcion("");
      setPasos("");
      setPriority("");
      setSubmitStatus('success');
      router.refresh();
      if (typeof window !== "undefined") {
        // Lazy import toast only on client if library exists
        import("sonner").then((m) => m.toast?.success?.("Reporte enviado. ¡Gracias!"))
          .catch(() => {});
      }
    } catch (err) {
      if (typeof window !== "undefined") {
        import("sonner").then((m) => m.toast?.error?.("Error al enviar el reporte"))
          .catch(() => {});
      }
      console.error(err);
      setSubmitStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (submitStatus === 'success') {
      const timer = setTimeout(() => {
        setSubmitStatus('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
      <SettingsSection
        title="Reportar Errores"
        description="Cuéntanos sobre bugs, errores o problemas que encuentres."
      >
        <form onSubmit={handleSubmit} className="w-full">
          <FieldSet>
            <div className="flex gap-4">
              <Field className="flex-1">
                <FieldLabel>Título</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="Resumen breve del problema"
                    value={titulo}
                    className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg"
                    onChange={(e) => setTitulo(e.target.value)}
                    maxLength={72}
                  />
                  {errors.titulo && <FieldError>{errors.titulo}</FieldError>}
                </FieldContent>
              </Field>
              <FieldGroup className="w-48 flex-shrink-0">
                <Field>
                  <FieldLabel>Nivel de prioridad</FieldLabel>
                  <FieldContent>
                    <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high" | "critical")} >
                      <SelectTrigger className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg dark:hover:bg-popover-secondary">
                        <SelectValue placeholder="Selecciona prioridad" />
                      </SelectTrigger>
                      <SelectContent className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg">
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.priority && <FieldError>{errors.priority}</FieldError>}
                  </FieldContent>
                </Field>
              </FieldGroup>
            </div>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <FieldContent>
                <Textarea
                  placeholder="Describe el error, qué esperabas que pasara y qué ocurrió."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="min-h-28 border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg"
                  maxLength={1000}
                />
                {errors.descripcion && <FieldError>{errors.descripcion}</FieldError>}
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {descripcion.length} / 1000
                </div>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Pasos para reproducir (opcional)</FieldLabel>
              <FieldContent>
                <Textarea
                  placeholder={"1) Ir a...\n2) Hacer clic en...\n3) Observa el error..."}
                  value={pasos}
                  onChange={(e) => setPasos(e.target.value)}
                  className="min-h-24 border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg"
                  maxLength={1000}
                />
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {pasos.length} / 1000
                </div>
              </FieldContent>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="submit" 
                disabled={submitStatus === 'submitting'} 
                className={
                  submitStatus === 'submitting' 
                    ? "border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg dark:hover:bg-popover-secondary" 
                    : submitStatus === 'success'
                    ? "border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40" 
                    : "border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg dark:hover:bg-popover-secondary"
                }
              >
                {submitStatus === 'submitting' ? "Enviando..." : submitStatus === 'success' ? "¡Enviado!" : "Enviar reporte"}
              </Button>
            </div>
          </FieldSet>
        </form>
      </SettingsSection>
    </div>
  );
}


