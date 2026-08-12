import { QueryClient } from "@tanstack/react-query";

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : NaN;
  // 429 has an explicit server recovery time; all other client errors also need user action.
  if (status === 429 || (status >= 400 && status < 500)) return false;
  return failureCount < 2;
}

export function retryDelay(attemptIndex: number): number {
  const exponential = Math.min(1_000 * 2 ** attemptIndex, 8_000);
  return exponential + Math.floor(Math.random() * 250);
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: tạo mới mỗi request để tránh shared state
    return makeQueryClient();
  }
  // Browser: tái sử dụng instance để giữ cache
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
