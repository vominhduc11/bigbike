"use client";

import { useSyncExternalStore } from "react";
import { fetchMe, logoutCustomer } from "@/lib/api/client-api";
import type { CustomerProfile } from "@/lib/contracts/commerce";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; profile: CustomerProfile };

type Listener = (state: AuthState) => void;

const listeners = new Set<Listener>();
let state: AuthState = { status: "loading" };
let inflight: Promise<void> | null = null;

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function refreshAuth(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchMe()
    .then((profile) => {
      setState({ status: "authenticated", profile });
    })
    .catch(() => {
      setState({ status: "anonymous" });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function setAuthenticated(profile: CustomerProfile): void {
  setState({ status: "authenticated", profile });
}

export function setAnonymous(): void {
  setState({ status: "anonymous" });
}

export async function performLogout(): Promise<void> {
  try {
    await logoutCustomer();
  } catch {
    /* ignore */
  }
  setAnonymous();
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
