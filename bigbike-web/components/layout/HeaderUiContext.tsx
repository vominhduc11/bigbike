"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

  useEffect(() => {
    const shouldLockScroll =
      activePanel === "search" ||
      activePanel === "desktop-info" ||
      activePanel === "mobile-menu" ||
      activePanel === "cart";

    document.body.style.overflow = shouldLockScroll ? "hidden" : "";
    document.documentElement.style.overflow = shouldLockScroll ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [activePanel]);

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
