"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type HeaderPanel = "none" | "search" | "mobile-menu" | "cart";
type ToggleableHeaderPanel = Exclude<HeaderPanel, "none">;
type ClosePanelOptions = { restoreFocus?: boolean };
type ClosePanelArgument = ClosePanelOptions | SyntheticEvent;

type HeaderUiContextValue = {
  activePanel: HeaderPanel;
  isPanelOpen: (panel: ToggleableHeaderPanel) => boolean;
  openPanel: (panel: ToggleableHeaderPanel, trigger?: HTMLElement | null) => void;
  closePanel: (options?: ClosePanelArgument) => void;
  togglePanel: (panel: ToggleableHeaderPanel, trigger?: HTMLElement | null) => void;
};

const HeaderUiContext = createContext<HeaderUiContextValue | null>(null);

export function HeaderUiProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<HeaderPanel>("none");
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const panelTriggerRef = useRef<HTMLElement | null>(null);

  const closePanel = useCallback((options?: ClosePanelArgument) => {
    setActivePanel("none");
    const trigger = panelTriggerRef.current;
    panelTriggerRef.current = null;
    const restoreFocus = !(options && "restoreFocus" in options && options.restoreFocus === false);
    if (!restoreFocus || !trigger) return;
    window.requestAnimationFrame(() => {
      if (trigger.isConnected) trigger.focus();
    });
  }, []);

  const openPanel = useCallback((panel: ToggleableHeaderPanel, trigger?: HTMLElement | null) => {
    panelTriggerRef.current = trigger ?? null;
    setActivePanel(panel);
  }, []);

  const togglePanel = useCallback((panel: ToggleableHeaderPanel, trigger?: HTMLElement | null) => {
    if (activePanel === panel) {
      closePanel();
      return;
    }
    openPanel(panel, trigger);
  }, [activePanel, closePanel, openPanel]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;

    // Điều hướng có thể bắt đầu từ bất kỳ link hoặc thao tác router nào trong header.
    // Không để drawer mobile tồn tại sau khi đổi trang, kể cả khi mục mới thêm
    // chưa biết đến HeaderUiContext.
    const closeTimer = window.setTimeout(() => {
      setActivePanel((current) => (current === "mobile-menu" ? "none" : current));
    }, 0);

    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

  useEffect(() => {
    const shouldLockScroll =
      activePanel === "search" || activePanel === "mobile-menu" || activePanel === "cart";

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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && activePanel !== "none") {
        closePanel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, closePanel]);

  const value = useMemo<HeaderUiContextValue>(
    () => ({
      activePanel,
      isPanelOpen: (panel) => activePanel === panel,
      openPanel,
      closePanel,
      togglePanel,
    }),
    [activePanel, closePanel, openPanel, togglePanel],
  );

  return <HeaderUiContext.Provider value={value}>{children}</HeaderUiContext.Provider>;
}

export function useHeaderUi() {
  const context = useContext(HeaderUiContext);

  if (!context) {
    throw new Error("useHeaderUi must be used inside HeaderUiProvider.");
  }

  return context;
}
