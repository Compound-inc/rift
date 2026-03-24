"use client";

import * as React from "react";
import { driver, type Driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";
/* Overrides must load after driver.css so they win when driver.css overwrites global styles */
import "./driver-overrides.css";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useDictionary } from "@/contexts/locale-context";

const SELECTORS = [
  "[data-onboarding=\"model-selector\"]",
  "[data-onboarding=\"model-selector-dialog\"]",
  "[data-onboarding=\"model-selector-providers\"]",
  "[data-onboarding=\"search-toggle\"]",
  "[data-onboarding=\"attach-files\"]",
  "[data-onboarding=\"custom-instructions\"]",
] as const;

export function ChatOnboardingTour() {
  const dict = useDictionary();
  const { isAuthenticated } = useConvexAuth();
  const config = useQuery(
    api.userConfiguration.getUserConfiguration,
    isAuthenticated ? {} : "skip"
  );
  const updateOnboardingCompleted = useMutation(
    api.userConfiguration.updateOnboardingCompleted
  );
  const driverRef = React.useRef<Driver | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (
      config === undefined ||
      config === null ||
      config.onboardingCompleted ||
      !ready
    ) {
      return;
    }

    const o = dict.onboarding;
    const steps: DriveStep[] = [
      {
        element: SELECTORS[0],
        popover: { title: o.modelSelectorTitle, description: o.modelSelectorBody },
      },
      {
        element: SELECTORS[1],
        popover: {
          title: o.modelSelectorDialogTitle,
          description: o.modelSelectorDialogBody,
          side: "left",
          align: "center",
        },
      },
      {
        element: SELECTORS[2],
        popover: {
          title: o.modelSelectorProvidersTitle,
          description: o.modelSelectorProvidersBody,
          side: "left",
          align: "center",
        },
      },
      {
        element: SELECTORS[3],
        popover: { title: o.searchToggleTitle, description: o.searchToggleBody },
      },
      {
        element: SELECTORS[4],
        popover: { title: o.attachFilesTitle, description: o.attachFilesBody },
      },
      {
        element: SELECTORS[5],
        popover: {
          title: o.customInstructionsTitle,
          description: o.customInstructionsBody,
        },
      },
      {
        popover: {
          title: o.doneTitle,
          description: o.doneBody,
          popoverClass: "driverjs-rift-theme driver-popover-done",
        },
      },
    ];

    const persistCompleted = () => {
      updateOnboardingCompleted().catch(() => {});
    };

    const driverConfig: Config = {
      steps,
      showProgress: true,
      popoverClass: "driverjs-rift-theme",
      popoverOffset: 16,
      allowClose: true,
      overlayClickBehavior: () => {},
      nextBtnText: o.next,
      prevBtnText: o.previous,
      doneBtnText: o.done,
      onHighlightStarted(_element, _step, opts) {
        if (opts.state.activeIndex === 1 || opts.state.activeIndex === 2) {
          window.dispatchEvent(new CustomEvent("open-model-selector"));
          window.dispatchEvent(new CustomEvent("tour-on-model-selector-step"));
        } else if (opts.state.activeIndex === 3) {
          window.dispatchEvent(new CustomEvent("tour-left-model-selector-step"));
          window.dispatchEvent(new CustomEvent("close-model-selector"));
        }
      },
      onHighlighted(_element, _step, opts) {
        if (opts.state.activeIndex === 1 || opts.state.activeIndex === 2) {
          setTimeout(() => opts.driver.refresh(), 100);
        }
      },
      onPrevClick(_element, _step, opts) {
        if (opts.state.activeIndex === 3) {
          window.dispatchEvent(new CustomEvent("open-model-selector"));
          window.dispatchEvent(new CustomEvent("tour-on-model-selector-step"));
          setTimeout(() => opts.driver.movePrevious(), 80);
        } else {
          opts.driver.movePrevious();
        }
      },
      onCloseClick() {
        persistCompleted();
      },
      onNextClick(_, __, opts) {
        if (opts.state.activeIndex === steps.length - 1) {
          persistCompleted();
          opts.driver.destroy();
        } else if (opts.state.activeIndex === 0) {
          window.dispatchEvent(new CustomEvent("open-model-selector"));
          window.dispatchEvent(new CustomEvent("tour-on-model-selector-step"));
          setTimeout(() => opts.driver.moveNext(), 80);
        } else {
          opts.driver.moveNext();
        }
      },
      onDestroyed() {
        window.dispatchEvent(new CustomEvent("tour-left-model-selector-step"));
        window.dispatchEvent(new CustomEvent("close-model-selector"));
        driverRef.current = null;
      },
    };

    const driverObj = driver(driverConfig);
    driverRef.current = driverObj;
    driverObj.drive();

    return () => {
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
    };
  }, [
    config,
    ready,
    dict.onboarding,
    updateOnboardingCompleted,
    isAuthenticated,
  ]);

  return null;
}
