import pg from "pg";
import type { PoolClient } from "pg";
export const pool = new pg.Pool({
  max: 6,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10_000,
  application_name: "yince-api",
});
pool.on("error", () => console.error("database_pool_error"));
export type Tx = PoolClient;
export const tables = [
  "products",
  "customers",
  "rules",
  "strategies",
  "briefs",
  "communications",
  "visits",
  "tasks",
  "reviews",
  "notifications",
  "audit",
] as const;
export type Table = (typeof tables)[number];
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const value = await fn(tx);
    await tx.query("COMMIT");
    return value;
  } catch (e) {
    await tx.query("ROLLBACK");
    throw e;
  } finally {
    tx.release();
  }
}
export async function scope(tx: Tx, workspace: string) {
  await tx.query("SELECT set_config('app.workspace_id',$1,true)", [workspace]);
}
export async function rows<T>(tx: Tx, table: Table, ws: string): Promise<T[]> {
  if (!tables.includes(table)) throw Error("invalid_table");
  const r = await tx.query(
    `SELECT payload FROM ${table} WHERE workspace_id=$1 ORDER BY created_at,id`,
    [ws],
  );
  return r.rows.map((r) => r.payload as T);
}
export async function get<T>(
  tx: Tx,
  table: Table,
  ws: string,
  id: string,
): Promise<T | null> {
  const r = await tx.query(
    `SELECT payload FROM ${table} WHERE workspace_id=$1 AND id=$2`,
    [ws, id],
  );
  return (r.rows[0]?.payload as T) || null;
}
export async function put<T extends { id: string }>(
  tx: Tx,
  table: Table,
  ws: string,
  value: T,
) {
  if (table === "audit") {
    await tx.query(
      "INSERT INTO audit(workspace_id,id,payload) VALUES($1,$2,$3)",
      [ws, value.id, JSON.stringify(value)],
    );
    return;
  }
  await tx.query(
    `INSERT INTO ${table}(workspace_id,id,payload) VALUES($1,$2,$3) ON CONFLICT(workspace_id,id) DO UPDATE SET payload=EXCLUDED.payload`,
    [ws, value.id, JSON.stringify(value)],
  );
}
