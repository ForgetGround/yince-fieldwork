import { pool, transaction, scope } from "./db.ts";
import { ensureProductCatalog } from "./product-catalog.ts";
try {
  const workspaces = await pool.query(
    "SELECT id FROM workspaces WHERE NOT demo",
  );
  let updated = 0;
  for (const { id } of workspaces.rows)
    await transaction(async (tx) => {
      await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [id]);
      await scope(tx, id);
      if (await ensureProductCatalog(tx, id)) {
        await tx.query(
          "UPDATE workspaces SET revision=revision+1 WHERE id=$1",
          [id],
        );
        updated++;
      }
    });
  console.log(JSON.stringify({ workspaces: workspaces.rowCount, updated }));
} finally {
  await pool.end();
}
