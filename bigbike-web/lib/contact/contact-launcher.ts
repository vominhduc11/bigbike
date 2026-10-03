import { translatePath } from "@/lib/utils/routes";

export const CONTACT_OPEN_EVENT = "bigbike:contact:open";

/** CHAT_RULE_070: focused forms keep their existing inline contact action. */
export function hideFloatingContactLauncher(pathname: string): boolean {
  const path = translatePath(pathname, "vi").split(/[?#]/)[0];
  return (
    path === "/dat-hang/" ||
    path === "/tai-khoan/edit-account/" ||
    path.startsWith("/tai-khoan/edit-address/")
  );
}

export function requestContactOpen(trigger: HTMLElement): void {
  window.dispatchEvent(new CustomEvent(CONTACT_OPEN_EVENT, { detail: trigger }));
}
