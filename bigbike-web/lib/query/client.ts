import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
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
