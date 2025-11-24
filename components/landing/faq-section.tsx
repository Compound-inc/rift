"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqSection() {
  const faqs = [
    {
      question: "¿Qué es RIFT?",
      answer:
        "RIFT es una plataforma unificada que te da acceso a los modelos de inteligencia artificial más avanzados del mundo (como GPT-4, Claude 3.5, Gemini 1.5, etc.) bajo una sola suscripción, eliminando la necesidad de pagar múltiples servicios por separado.",
    },
    {
      question: "¿Qué modelos de IA están disponibles?",
      answer:
        "Ofrecemos acceso a una amplia gama de modelos líderes en la industria, incluyendo la familia GPT de OpenAI, Claude de Anthropic, Gemini de Google, y modelos de código abierto como Llama y Mistral. Siempre agregamos los modelos más recientes tan pronto como están disponibles.",
    },
    {
      question: "¿Cómo funciona la suscripción?",
      answer:
        "En lugar de pagar suscripciones separadas para cada servicio (que pueden sumar más de $60 USD/mes), con RIFT pagas una sola cuota mensual accesible y tienes acceso a todos ellos en una sola interfaz optimizada.",
    },
    {
      question: "¿Hay un límite de mensajes?",
      answer:
        "Sí, nuestros planes tienen límites generosos de mensajes 'estándar' y 'premium'. Los modelos más costosos consumen cuota 'premium'. El plan Plus incluye 1,000 mensajes estándar y 100 premium, diseñado para cubrir las necesidades de la mayoría de los usuarios.",
    },
    {
      question: "¿Puedo cancelar en cualquier momento?",
      answer:
        "Sí, puedes cancelar tu suscripción en cualquier momento desde tu panel de control. No hay contratos a largo plazo ni compromisos forzosos.",
    },
    {
      question: "¿Cómo manejan mi privacidad?",
      answer:
        "Tu privacidad es nuestra prioridad. Tus datos están encriptados y, a diferencia de otros servicios gratuitos, no utilizamos tus conversaciones para entrenar a nuestros modelos.",
    },
  ];

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 pt-24 md:pt-0"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 w-full text-center md:text-left">
          <span className="text-blue-500 font-semibold">FAQ</span>
          <h2
            id="faq-heading"
            className="text-3xl md:text-4xl font-bold tracking-tight text-[rgba(44,45,48,1)] dark:text-white"
          >
            Preguntas Frecuentes
          </h2>
          <p className="text-lg text-[rgba(55,55,55,0.4)] dark:text-muted-foreground max-w-2xl">
            Resolvemos tus dudas sobre RIFT y cómo podemos ayudarte a aprovechar al máximo la IA.
          </p>
        </div>

        <div className="w-full">
          <Accordion type="single" collapsible className="w-full flex flex-col gap-2">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="group mb-2 flex flex-col items-start justify-start rounded-2xl border-b-[rgba(55,55,55,0.4)] bg-[rgba(44,45,48,0.02)] dark:bg-white/5 dark:border-white/10 border-none data-[state=open]:bg-[rgba(44,45,48,0.04)] transition-colors duration-200"
              >
                <div className="w-full">
                  <AccordionTrigger
                    showIcon={false}
                    className="group flex w-full items-center justify-between gap-12 px-8 py-6 max-[512px]:gap-4 max-[512px]:px-4 max-[512px]:py-3 hover:no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 rounded-2xl"
                  >
                    <div>
                      <h5
                        className="select-text text-left text-lg font-medium leading-6 tracking-tight text-[rgba(44,45,48,1)] dark:text-white font-sans"
                        style={{ WebkitTextStroke: "0.001px transparent" }}
                      >
                        {faq.question}
                      </h5>
                    </div>
                    <div className="relative flex h-6 w-6 flex-shrink-0 select-none items-center justify-center py-1 bg-[rgba(44,45,48,0.03)] dark:bg-white/10 rounded-[50%]">
                      <div
                        className="absolute top-1/2 left-1/2 h-0.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[linear-gradient(90deg,rgb(148,114,80),rgb(108,128,113))] dark:bg-[linear-gradient(90deg,rgb(200,180,150),rgb(150,170,160))] transition-opacity duration-200 group-data-[state=open]:opacity-0"
                      ></div>
                      <div
                        className="absolute top-1/2 left-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[linear-gradient(rgb(148,114,80),rgb(108,128,113))] dark:bg-[linear-gradient(rgb(200,180,150),rgb(150,170,160))] transition-transform duration-200 group-data-[state=open]:rotate-90"
                      ></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                     <div className="pr-20 pb-6 pl-8 max-[512px]:px-4 max-[512px]:pt-2 max-[512px]:pb-3 text-[rgba(55,55,55,0.4)] dark:text-zinc-400">
                      <div className="leading-6 tracking-tight text-[rgba(44,45,48,0.8)] dark:text-zinc-300 font-sans">
                        {faq.answer}
                      </div>
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
