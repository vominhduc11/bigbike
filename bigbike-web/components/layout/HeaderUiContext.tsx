"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type HeaderPanel = "none" | "search" | "desktop-info" | "mobile-menu" | "cart";
type ToggleableHeaderPanel = Exclude<HeaderPanel, "none">;

type HeaderUiContextValue = {
  activePanel: HeaderPanel;
  isPanelOpen: (panel: ToggleableHeaderPanel) => boolean;
  openPanel: (panel: ToggleableHeaderPanel) => void;
  closePanel: () => void;
  togglePanel: (panel: ToggleableHeaderPanel) => void;
};

const HeaderUiContext = createContext<HeaderUiContextValue | null>(null);

export function HeaderUiProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<HeaderPanel>("none");
  const pathname = usePathname();

  useEffect(() => {
    const shouldLockScroll =
      activePanel === "search" ||
      activePanel === "desktop-info" ||
      activePanel === "mobile-menu" ||
      activePanel === "cart";

    document.body.style.overflow = shouldLockScroll ? "hidden" : "";
    document.documentElement.style.overflow = shouldLockScroll ? "hidden" : "";

    if (activePanel === "none") {
      document.documentElement.removeAttribute("data-bb-header-panel");
    } else {
      document.documentElement.setAttribute("data-bb-header-panel", activePanel);
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.documentElement.removeAttribute("data-bb-header-panel");
    };
  }, [activePanel]);

  useEffect(() => {
    let clearTimer = 0;

    function isTextEntryTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLSelectElement) return true;
      if (target.isContentEditable) return true;
      if (!(target instanceof HTMLInputElement)) return false;

      return ![
        "button",
        "checkbox",
        "color",
        "file",
        "hidden",
        "image",
        "radio",
        "range",
        "reset",
        "submit",
      ].includes(target.type);
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isTextEntryTarget(event.target)) return;
      window.clearTimeout(clearTimer);
      document.documentElement.setAttribute("data-bb-keyboard-focus", "");
    }

    function handleFocusOut() {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        const activeElement = document.activeElement;
        if (!isTextEntryTarget(activeElement)) {
          document.documentElement.removeAttribute("data-bb-keyboard-focus");
        }
      }, 80);
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      window.clearTimeout(clearTimer);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.documentElement.removeAttribute("data-bb-keyboard-focus");
    };
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const sensitiveSelectors = [
      "footer",
      ".bb-page--auth",
      ".bb-account-layout",
      ".bb-home-mobile-categories",
      ".bb-home-products-parity",
      ".bb-home .bb-experience",
      ".bb-home .bb-home-news-parity",
      ".bb-home .videos-slide",
      ".bb-home .partner-slide",
    ];
    const visibleByElement = new Map<Element, boolean>();
    let observer: IntersectionObserver | null = null;

    function updateSensitiveAttr() {
      const hasSensitiveVisible = Array.from(visibleByElement.values()).some(Boolean);
      if (hasSensitiveVisible) {
        document.documentElement.setAttribute("data-bb-chat-sensitive", "");
      } else {
        document.documentElement.removeAttribute("data-bb-chat-sensitive");
      }
    }

    const timer = window.setTimeout(() => {
      const elements = sensitiveSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector)),
      );

      if (elements.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visibleByElement.set(entry.target, entry.isIntersecting);
          }
          updateSensitiveAttr();
        },
        {
          root: null,
          rootMargin: "0px 0px -18% 0px",
          threshold: 0.01,
        },
      );

      for (const element of elements) {
        visibleByElement.set(element, false);
        observer.observe(element);
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      document.documentElement.removeAttribute("data-bb-chat-sensitive");
    };
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePanel("none");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo<HeaderUiContextValue>(
    () => ({
      activePanel,
      isPanelOpen: (panel) => activePanel === panel,
      openPanel: (panel) => setActivePanel(panel),
      closePanel: () => setActivePanel("none"),
      togglePanel: (panel) =>
        setActivePanel((current) => (current === panel ? "none" : panel)),
    }),
    [activePanel],
  );

  return (
    <HeaderUiContext.Provider value={value}>{children}</HeaderUiContext.Provider>
  );
}

export function useHeaderUi() {
  const context = useContext(HeaderUiContext);

  if (!context) {
    throw new Error("useHeaderUi must be used inside HeaderUiProvider.");
  }

  return context;
}
