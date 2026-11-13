import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DataResult, Product } from "@/lib/contracts/public";

export const PRODUCT_FALLBACK_MAX_AGE = 3_600_000;

/** Only public product data, scoped to this container; no customer/session information. */
export class ProductFallbackStore {
  private generation = 0;

  constructor(private directory = path.join(process.cwd(), ".next/cache/product-fallback")) {}

  async invalidate() {
    this.generation++;
    await rm(this.directory, { recursive: true, force: true });
  }

  async load(slug: string, locale: string, fresh: () => Promise<DataResult<Product>>) {
    const generation = this.generation;
    const key = createHash("sha256").update(`${locale}\0${slug}`).digest("hex");
    const file = path.join(this.directory, `${key}.json`);
    const result = await fresh();
    if (result.data) {
      if (result.data.publishStatus === "PUBLISHED" && !result.data.discontinued) {
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await mkdir(this.directory, { recursive: true });
          await writeFile(temporary, JSON.stringify({ savedAt: Date.now(), product: result.data }));
          if (generation === this.generation) await rename(temporary, file);
        } catch {
          // Cache failure must not turn a successful catalog read into an outage.
        } finally {
          await rm(temporary, { force: true }).catch(() => undefined);
        }
      } else {
        await rm(file, { force: true }).catch(() => undefined);
      }
      return { ...result, fallback: false };
    }
    if (!result.error || result.error.status < 500) {
      if ([404, 410].includes(result.error?.status ?? 0)) {
        await rm(file, { force: true }).catch(() => undefined);
      }
      return { ...result, fallback: false };
    }
    try {
      const snapshot = JSON.parse(await readFile(file, "utf8"));
      const age = Date.now() - snapshot.savedAt;
      if (
        generation === this.generation &&
        Number.isFinite(snapshot.savedAt) &&
        age >= 0 &&
        age <= PRODUCT_FALLBACK_MAX_AGE &&
        snapshot.product?.id &&
        snapshot.product.publishStatus === "PUBLISHED" &&
        !snapshot.product.discontinued
      ) {
        return { data: snapshot.product as Product, error: null, fallback: true };
      }
    } catch {
      // Missing, corrupt or inaccessible snapshots are never evidence of valid content.
    }
    return { ...result, fallback: false };
  }
}

export const productFallbackStore = new ProductFallbackStore();
