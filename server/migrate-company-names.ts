import { randomUUID } from "node:crypto";
import { pool, transaction, scope, put } from "./db.ts";
import { backfillMockCompanyNames } from "./customer-names.ts";

try {
  const workspaces = await pool.query(
    "SELECT id FROM workspaces WHERE NOT demo",
  );
  let updated = 0;
  for (const { id } of workspaces.rows) {
    await transaction(async (tx) => {
      await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [id]);
      await scope(tx, id);
      const count = await backfillMockCompanyNames(tx, id);
      if (!count) return;
      await tx.query("UPDATE workspaces SET revision=revision+1 WHERE id=$1", [
        id,
      ]);
      await put(tx, "audit", id, {
        id: randomUUID(),
        time: new Date().toISOString(),
        actor: "系统",
        action: "补充模拟企业名称",
        target: `${count} 位模拟客户`,
        detail:
          "仅补齐原始模拟客户的缺失企业名称；未覆盖已有名称、导入客户或历史快照。",
      });
      updated += count;
    });
  }
  console.log(JSON.stringify({ workspaces: workspaces.rowCount, updated }));
} finally {
  await pool.end();
}
