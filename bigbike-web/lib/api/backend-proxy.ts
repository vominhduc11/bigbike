import { NextResponse } from "next/server";
import { env } from "@/env";

/** Base URL of the Spring backend, shared by the product BFF route handlers. */
export const BACKEND =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

/** Route context shape for the `app/api/products/[id]/*` handlers. */
export type ProductRouteParams = { params: Promise<{ id: string }> };

type BackendErrorPayload =
  | {
      error?: {
        message?: string;
      };
      message?: string;
    }
  | null;

/** Extract a backend error message from a non-ok response, tolerating non-JSON bodies. */
export async function readBackendError(res: Response): Promise<string | null> {
  const payload = (await res.json().catch(() => null)) as BackendErrorPayload;
  return payload?.error?.message ?? payload?.message ?? null;
}

type ProxyOptions = {
  /** Maps the parsed backend JSON into the response body. */
  transform: (json: unknown) => unknown;
  /** Message returned with a 502 when the backend is unreachable or errors. */
  errorMessage: string;
};

/**
 * GET-proxy a backend JSON endpoint using the shared conventions of the product
 * BFF routes: a no-store fetch with `Accept: application/json`, status pass-through
 * on a non-ok response (`{ error: "Backend returned <status>" }`), `Cache-Control:
 * no-store` on success, and a 502 with `errorMessage` on a thrown/parse failure.
 */
export async function proxyBackendJson(
  path: string,
  { transform, errorMessage }: ProxyOptions,
): Promise<NextResponse> {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status },
      );
    }

    const json = (await res.json()) as unknown;
    return NextResponse.json(transform(json), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
