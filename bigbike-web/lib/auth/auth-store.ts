"use client";

import { useSyncExternalStore } from "react";
import { fetchMe, logoutCustomer } from "@/lib/api/client-api";
import { clearChatSnapshot } from "@/lib/chat/chat-persistence";
import type { CustomerProfile } from "@/lib/contracts/commerce";

 type AuthState =
  | { status: "loading" }
  | { status: "anonymous"; reason?: "logout" }
  | { status: "authenticated"; profile: CustomerProfile };

type Listener = (state: AuthState) => void;

const listeners = new Set<Listener>();
let state: AuthState = { status: "loading" };
let inflight: Promise<void> | null = null;
const CUSTOMER_AUTH_HINT_KEY = "bb_customer_authenticated";

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

 function getAuthState(): AuthState {
  return state;
}

 function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function hasClientAuthMarker(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CUSTOMER_AUTH_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCustomerAuthenticated(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_AUTH_HINT_KEY, "1");
  } catch {
    /* storage may be unavailable in private contexts */
  }
}

function clearCustomerAuthMarker(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CUSTOMER_AUTH_HINT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * `bb_csrf` is also issued for guest carts, so it is not sufficient by itself.
 * Use the client auth marker after login/register/OAuth start; otherwise only
 * treat csrf as a session hint when the public guest-cart cookie is absent.
 */
export function hasCustomerSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  if (hasClientAuthMarker()) return true;
  return Boolean(readCookie("bb_csrf") && !readCookie("bb_guest_id"));
}

export function refreshAuth(): Promise<void> {
  if (inflight) return inflight;
  if (!hasCustomerSessionHint()) {
    if (state.status === "authenticated") clearChatSnapshot();
    setState({ status: "anonymous" });
    return Promise.resolve();
  }
  inflight = fetchMe()
    .then((profile) => {
      markCustomerAuthenticated();
      setState({ status: "authenticated", profile });
    })
    .catch(() => {
      clearCustomerAuthMarker();
      clearChatSnapshot();
      setState({ status: "anonymous" });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

 function setAnonymous(reason?: "logout"): void {
  setState(reason ? { status: "anonymous", reason } : { status: "anonymous" });
}

export async function performLogout(): Promise<void> {
  try {
    await logoutCustomer();
  } catch {
    /* ignore */
  }
  clearCustomerAuthMarker();
  clearChatSnapshot();
  setAnonymous("logout");
}

const ANONYMOUS_SERVER_SNAPSHOT: AuthState = { status: "loading" };

function subscribeWithRefresh(listener: () => void): () => void {
  const unsubscribe = subscribeAuth(listener);
  if (state.status === "loading") {
    void refreshAuth();
  }
  return unsubscribe;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribeWithRefresh,
    getAuthState,
    () => ANONYMOUS_SERVER_SNAPSHOT,
  );
}
