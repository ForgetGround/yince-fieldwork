import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, scope, put, rows } from "../server/db.ts";
import { backfillMockCompanyNames } from "../server/customer-names.ts";
import { execute, type Context } from "../server/platform.ts";
import { sampleCustomers, type Customer } from "../lib/workbench.ts";

assert.equal(
  process.env.PGDATABASE,
  "yince_test",
  "企业名称测试必须使用独立测试库",
);
test("PostgreSQL 企业名称补齐不覆盖已有资料，导入可保存名称且旧模板不清空名称", async () => {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const id = randomUUID(),
      userId = randomUUID();
    await tx.query("INSERT INTO workspaces(id,name) VALUES($1,$2)", [
      id,
      "企业名称验收",
    ]);
    await tx.query("INSERT INTO users(id,username,name) VALUES($1,$2,$3)", [
      userId,
      `name-test-${userId}`,
      "验收管理员",
    ]);
    await tx.query(
      "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'admin')",
      [id, userId],
    );
    await scope(tx, id);
    const samples = sampleCustomers().slice(0, 4);
    for (const [i, sample] of samples.entries()) {
      const c = { ...sample };
      delete c.companyName;
      await put(tx, "customers", id, {
        ...c,
        ownerId: userId,
        origin: i === 2 ? "导入资料" : "PostgreSQL 模拟数据 · 2026-09-30",
        ...(i === 1 ? { companyName: "已有企业名称" } : {}),
        ...(i === 3 ? { industry: "已更新的行业" } : {}),
      });
    }
    const before = await rows<Customer>(tx, "customers", id);
    assert.equal(await backfillMockCompanyNames(tx, id), 1);
    const after = await rows<Customer>(tx, "customers", id);
    const first = after.find((c) => c.id === samples[0].id)!;
    assert.equal(first.companyName, samples[0].companyName);
    const unchanged = { ...first };
    delete unchanged.companyName;
    assert.deepEqual(
      unchanged,
      before.find((c) => c.id === first.id),
    );
    for (const c of before.filter((c) => c.id !== first.id))
      assert.deepEqual(
        after.find((a) => a.id === c.id),
        c,
      );
    assert.equal(await backfillMockCompanyNames(tx, id), 0);

    const ctx: Context = {
      tx,
      ws: {
        id,
        name: "企业名称验收",
        role: "admin",
        demo: false,
        expiresAt: null,
        revision: 0,
      },
      role: "admin",
      user: {
        id: userId,
        name: "验收管理员",
        username: `name-test-${userId}`,
        demoWorkspaceId: null,
      },
    };
    const row = { id: "KH-021", industry: "制造业", lastContactDays: 0 };
    const saved = await execute(ctx, {
      type: "customer.import",
      customers: [{ ...row, companyName: "导入企业（模拟）" }],
    });
    assert.equal(
      saved.state.customers.find((c) => c.id === row.id)?.companyName,
      "导入企业（模拟）",
    );
    const legacy = await execute(ctx, {
      type: "customer.import",
      customers: [row],
    });
    assert.equal(
      legacy.state.customers.find((c) => c.id === row.id)?.companyName,
      "导入企业（模拟）",
    );
    await assert.rejects(
      execute(
        { ...ctx, role: "viewer" },
        { type: "customer.import", customers: [row] },
      ),
    );
  } finally {
    await tx.query("ROLLBACK");
    tx.release();
    await pool.end();
  }
});
