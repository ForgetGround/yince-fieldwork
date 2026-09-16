import products from "../data/products.json" with { type: "json" };
import {
  legacyProduct,
  LEGACY_PRODUCT_ID,
  productRules,
  mockProductFeatures,
} from "../lib/product-matching.ts";
import type { Product } from "../lib/platform.ts";
import type { Rule, Customer } from "../lib/workbench.ts";
import { type Tx, rows, put } from "./db.ts";
export async function ensureProductCatalog(tx: Tx, ws: string) {
  let changed = false;
  const catalog: Product[] = [
    ...products.map((p) => ({ ...p, id: `PRODUCT-${p.row}` })),
    legacyProduct,
  ];
  const existingProducts = new Set(
    (await rows<Product>(tx, "products", ws)).map((p) => p.id),
  );
  for (const p of catalog)
    if (!existingProducts.has(p.id)) {
      await put(tx, "products", ws, p);
      changed = true;
    }
  const existingRules = await rows<Rule>(tx, "rules", ws);
  for (const r of existingRules)
    if (!r.productId) {
      await put(tx, "rules", ws, { ...r, productId: LEGACY_PRODUCT_ID });
      changed = true;
    }
  const ids = new Set(existingRules.map((r) => r.id));
  for (const r of productRules(catalog))
    if (!ids.has(r.id)) {
      await put(tx, "rules", ws, r);
      changed = true;
    }
  for (const c of await rows<Customer>(tx, "customers", ws)) {
    if (
      !c.origin?.startsWith("PostgreSQL 模拟数据") ||
      !/^KH-\d{3}$/.test(c.id)
    )
      continue;
    const defaults = mockProductFeatures(Number(c.id.slice(3)) - 1);
    const missing = Object.fromEntries(
      Object.entries(defaults).filter(([k]) => !(k in c)),
    );
    if (Object.keys(missing).length) {
      await put(tx, "customers", ws, { ...c, ...missing });
      changed = true;
    }
  }
  return changed;
}
