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
 * Forward only the one canonical ingress address. The public nginx removes client-provided
 * chains first; forwarding an arbitrary comma-separated XFF value would reintroduce spoofing
 * between the BFF and backend.
 */
export function backendRequestHeaders(request?: Request): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (!request) return headers;

  const forwardedFor = request.headers.get("x-forwarded-for")?.trim();
  if (forwardedFor && !forwardedFor.includes(",") && isIpLiteral(forwardedFor)) {
    headers.set("X-Forwarded-For", forwardedFor);
  }
  const requestId = request.headers.get("x-request-id")?.trim();
  if (requestId && /^[A-Za-z0-9._-]{1,128}$/.test(requestId)) {
    headers.set("X-Request-Id", requestId);
  }
  return headers;
}

/** Preserve a backend error envelope and the headers a client needs to recover safely. */
export async function passthroughBackendError(res: Response): Promise<NextResponse> {
  const headers = new Headers();
  const contentType = res.headers?.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  for (const header of ["retry-after", "x-request-id", "cache-control"]) {
    const value = res.headers?.get(header);
    if (value) headers.set(header, value);
  }
  const responseLike = res as Response & {
    text?: () => Promise<string>;
  };
  const body = typeof responseLike.text === "function"
    ? await responseLike.text()
    : JSON.stringify(await res.json().catch(() => null) ?? {});
  return new NextResponse(body || JSON.stringify({ error: { code: "UPSTREAM_ERROR" } }), {
    status: res.status,
    headers,
  });
}

/**
 * GET-proxy a backend JSON endpoint using the shared conventions of the product
 * BFF routes: a no-store fetch with `Accept: application/json`, status pass-through
 * on a non-ok response (`{ error: "Backend returned <status>" }`), `Cache-Control:
 * no-store` on success, and a 502 with `errorMessage` on a thrown/parse failure.
 */
export async function proxyBackendJson(
  request: Request,
  path: string,
  { transform, errorMessage }: ProxyOptions,
): Promise<NextResponse> {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      cache: "no-store",
      headers: backendRequestHeaders(request),
    });

    if (!res.ok) {
      return passthroughBackendError(res);
    }

    const json = (await res.json()) as unknown;
    return NextResponse.json(transform(json), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}

function isIpLiteral(value: string): boolean {
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);
  const ipv6 = value.includes(":") && /^[0-9A-Fa-f:.]+$/.test(value);
  return ipv4 || ipv6;
}
