import { sampleCustomers, type Customer } from "../lib/workbench.ts";
import { type Tx, rows, put } from "./db.ts";

/** Only enrich unchanged seed identities; imported customers keep their own names. */
export async function backfillMockCompanyNames(tx: Tx, workspaceId: string) {
  const samples = new Map(sampleCustomers().map((c) => [c.id, c]));
  let updated = 0;
  for (const c of await rows<Customer>(tx, "customers", workspaceId)) {
    const sample = samples.get(c.id);
    if (
      c.companyName?.trim() ||
      !c.origin?.startsWith("PostgreSQL 模拟数据") ||
      !sample ||
      sample.industry !== c.industry
    )
      continue;
    await put(tx, "customers", workspaceId, {
      ...c,
      companyName: sample.companyName,
    });
    updated++;
  }
  return updated;
}
