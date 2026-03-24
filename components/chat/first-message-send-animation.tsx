"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };

type Phase = "idle" | "userAnimating" | "userDone";

type FirstMessageSendAnimationContextValue = {
  phase: Phase;
  sourcePoint: Point | null;
  begin: (sourcePoint: Point) => void;
  markUserDone: () => void;
  reset: () => void;
  consumeBeginToken: () => string | null;
};

const Ctx = createContext<FirstMessageSendAnimationContextValue | null>(null);

export function FirstMessageSendAnimationProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sourcePoint, setSourcePoint] = useState<Point | null>(null);

  // Token lets the destination detect "new begin" even if phase already set.
  const beginTokenRef = useRef<string | null>(null);

  const begin = useCallback((nextSourcePoint: Point) => {
    setSourcePoint(nextSourcePoint);
    beginTokenRef.current = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setPhase("userAnimating");
  }, []);

  const consumeBeginToken = useCallback(() => {
    const token = beginTokenRef.current;
    beginTokenRef.current = null;
    return token;
  }, []);

  const markUserDone = useCallback(() => {
    setPhase("userDone");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setSourcePoint(null);
    beginTokenRef.current = null;
  }, []);

  const value = useMemo<FirstMessageSendAnimationContextValue>(() => {
    return { phase, sourcePoint, begin, markUserDone, reset, consumeBeginToken };
  }, [phase, sourcePoint, begin, markUserDone, reset, consumeBeginToken]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFirstMessageSendAnimation() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useFirstMessageSendAnimation must be used within FirstMessageSendAnimationProvider");
  }
  return ctx;
}
