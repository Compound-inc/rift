import { motion } from "motion/react";
import React from "react";
import {
  IdeaIcon,
  BrainPersonIcon,
  GrowthIcon,
  LampIcon,
  DeskIcon,
  StudentIcon,
  DoddleLine,
} from "@/components/ui/icons/svg-icons";

interface WelcomeScreenProps {
  user: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  onSuggestionClick?: (prompt: string) => void;
}

export function WelcomeScreen({ user, onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-2xl">
        <div className="relative">
          <motion.h1
            className="text-4xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center"
            layout
          >
            Hola,
            {user && (user.firstName || user.lastName) && (
              <div className="relative inline-block ml-2">
                <motion.span
                  className="font-semibold animate-subtle-shine relative inline-block"
                  initial={{
                    opacity: 0,
                    x: -15,
                    scale: 0.95,
                    width: 0,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    width: "auto",
                  }}
                  transition={{
                    duration: 1.2,
                    ease: [0.16, 1, 0.3, 1],
                    opacity: {
                      duration: 1.2,
                      ease: [0.16, 1, 0.3, 1],
                    },
                    x: {
                      duration: 1.2,
                      ease: [0.16, 1, 0.3, 1],
                    },
                    scale: {
                      duration: 1.2,
                      ease: [0.16, 1, 0.3, 1],
                    },
                    width: {
                      duration: 1.2,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                  style={{
                    overflow: "visible",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.firstName || user.lastName}
                </motion.span>
                <motion.div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2"
                  initial={{
                    opacity: 0,
                    scale: 0.8,
                    y: -5,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 1.5,
                    delay: 1.0,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <DoddleLine className="w-38 h-20 text-blue-600 dark:text-blue-400" />
                </motion.div>
              </div>
            )}
          </motion.h1>
        </div>
        <h2 className="text-3xl text-gray-600 dark:text-gray-400 font-normal mb-8">
          ¿Qué quieres hacer hoy?
        </h2>

        {/* Prompt suggestions */}
        <div className="hidden md:grid md:grid-cols-2 gap-3 text-left">
          {[
            {
              icon: (
                <StudentIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              ),
              title: "Técnicas de estudio",
              prompt:
                "¿Cómo puedo mejorar mi memoria para recordar mejor?",
            },
            {
              icon: (
                <IdeaIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              ),
              title: "Mejora tus prompts",
              prompt:
                "Enséñame a estructurar mejor mis prompts para conseguir mejores resultados",
            },
            {
              icon: (
                <BrainPersonIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ),
              title: "Pensamiento crítico",
              prompt:
                "¿Cómo puedo analizar mejor la información que leo?",
            },
            {
              icon: (
                <DeskIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ),
              title: "Organización personal",
              prompt: "Ayúdame a crear un plan de estudio efectivo",
            },
            {
              icon: (
                <LampIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              ),
              title: "Resolución creativa",
              prompt:
                "¿Cómo puedo desarrollar mi creatividad para proyectos?",
            },
            {
              icon: (
                <GrowthIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ),
              title: "Crecimiento personal",
              prompt:
                "¿Qué hábitos me ayudan a ser un mejor estudiante?",
            },
          ].map((item, index) => (
            <div
              key={index}
              onClick={() => onSuggestionClick?.(item.prompt)}
              className="bg-background-secondary rounded-3xl p-4 border border-border shadow-sm hover:bg-hover cursor-pointer"
            >
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                {item.icon} {item.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.prompt}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}