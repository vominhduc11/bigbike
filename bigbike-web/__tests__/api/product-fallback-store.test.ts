// @vitest-environment node
import { mkdtemp, rm, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductFallbackStore, PRODUCT_FALLBACK_MAX_AGE } from "@/lib/api/product-fallback-store";
import { merchantProduct } from "../merchant/fixtures";

const unavailable =
  (status = 503) =>
  async () => ({
    data: null,
    error: { status, code: "ERROR", message: "Unavailable", details: [] },
  });
const success = async () => ({ data: merchantProduct(), error: null });
let directory: string;
let store: ProductFallbackStore;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "product-fallback-"));
  store = new ProductFallbackStore(directory);
  vi.spyOn(Date, "now").mockReturnValue(100000000);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe("bounded public product fallback", () => {
  it("survives a new store instance and never refreshes the age on fallback", async () => {
    await store.load("slug", "vi", success);
    store = new ProductFallbackStore(directory);
    vi.mocked(Date.now).mockReturnValue(100000000 + PRODUCT_FALLBACK_MAX_AGE);
    expect(await store.load("slug", "vi", unavailable())).toMatchObject({
      fallback: true,
      data: { id: "product-1" },
    });
    vi.mocked(Date.now).mockReturnValue(100000001 + PRODUCT_FALLBACK_MAX_AGE);
    expect(await store.load("slug", "vi", unavailable())).toMatchObject({
      fallback: false,
      data: null,
    });
  });
  it("never serves a different locale, slug, unknown product or 4xx response", async () => {
    await store.load("slug", "vi", success);
    for (const [slug, locale] of [
      ["slug", "en"],
      ["other", "vi"],
    ]) {
      expect((await store.load(slug, locale, unavailable())).data).toBeNull();
    }
    expect((await store.load("slug", "vi", unavailable(403))).data).toBeNull();
    expect((await store.load("slug", "vi", unavailable(404))).data).toBeNull();
    expect((await store.load("slug", "vi", unavailable())).data).toBeNull();
  });
  it("invalidates product snapshots and does not resurrect a deleted or discontinued product", async () => {
    await store.load("slug", "vi", success);
    await store.invalidate();
    expect((await store.load("slug", "vi", unavailable())).data).toBeNull();
    await store.load("slug", "vi", success);
    await store.load("slug", "vi", async () => ({
      data: merchantProduct({ discontinued: true }),
      error: null,
    }));
    expect((await store.load("slug", "vi", unavailable())).data).toBeNull();
  });
  it("rejects corrupt or future-dated snapshots", async () => {
    await store.load("slug", "vi", success);
    vi.mocked(Date.now).mockReturnValue(99999999);
    expect((await store.load("slug", "vi", unavailable())).data).toBeNull();
    const [file] = await readdir(directory);
    await writeFile(path.join(directory, file), "broken");
    expect((await store.load("slug", "vi", unavailable())).data).toBeNull();
  });
});
