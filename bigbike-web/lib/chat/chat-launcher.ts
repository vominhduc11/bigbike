import { translatePath } from "@/lib/utils/routes";

export const CHAT_OPEN_EVENT = "bigbike:chat:open";

/** CHAT_RULE_001: focused forms use an inline support action instead of a floating launcher. */
export function hideFloatingChatLauncher(pathname: string): boolean {
  const path = translatePath(pathname, "vi").split(/[?#]/)[0];
  return (
    path === "/dat-hang/" ||
    path === "/tai-khoan/edit-account/" ||
    path.startsWith("/tai-khoan/edit-address/")
  );
}

export function requestChatOpen(trigger: HTMLElement): void {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: trigger }));
}
