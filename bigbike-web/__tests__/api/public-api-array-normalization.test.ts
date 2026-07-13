import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicProductList, fetchPublicSettings } from "@/lib/api/client-api";
import { listCategories, listPublicSettings } from "@/lib/api/public-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
}

describe("public API array normalization", () => {
  beforeEach(() => {
    mockFetch({ data: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when a server list endpoint returns non-array data", async () => {
    mockFetch({
      data: { unexpected: true },
      pagination: { page: 1, totalPages: 1, totalItems: 0 },
    });

    const result = await listCategories({ page: 1, size: 100 });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
    expect(result.data.find(() => true)).toBeUndefined();
  });

  it("reads nested array payloads from server data endpoints", async () => {
    mockFetch({
      data: {
        content: [{ settingKey: "site_name", settingValue: "BigBike", settingGroup: "general" }],
      },
    });

    const result = await listPublicSettings("vi");

    expect(result.error).toBeNull();
    expect(result.data?.find((setting) => setting.settingKey === "site_name")?.settingValue).toBe("BigBike");
  });

  it("returns an empty list when client settings receives non-array data", async () => {
    mockFetch({ data: { unexpected: true } });

    const settings = await fetchPublicSettings("vi");

    expect(settings).toEqual([]);
    expect(settings.find(() => true)).toBeUndefined();
  });

  it("reads nested client list payloads and keeps pagination", async () => {
    mockFetch({
      data: {
        content: [{ id: "p1", slug: "helmet", name: "Helmet" }],
        pagination: { page: 1, totalPages: 2, totalItems: 3 },
      },
    });

    const result = await fetchPublicProductList({ page: 1, size: 12 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.slug).toBe("helmet");
    expect(result.pagination?.totalPages).toBe(2);
  });
});
