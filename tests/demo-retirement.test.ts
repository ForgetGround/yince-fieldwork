import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.ts";
import { token, digest } from "../server/security.ts";
assert.equal(process.env.PGDATABASE, "yince_test", "只允许使用独立测试库");
const base = "http://127.0.0.1:59604/api";
const origin = process.env.PUBLIC_ORIGIN!;
async function call<T = Record<string, unknown>>(
  path: string,
  data?: unknown,
  cookie = "",
) {
  const response = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: response.status,
    data: (await response.json()) as T,
    cookie: response.headers.get("set-cookie"),
  };
}
test("关闭演示入口和遗留会话，保留管理员登录", async () => {
  const user = randomUUID(),
    workspace = randomUUID(),
    raw = token();
  try {
    // 模拟升级前仍有效的演示身份，验证不能只依赖停用数据库记录。
    await pool.query(
      "INSERT INTO users(id,username,name,demo) VALUES($1,$2,$3,true)",
      [user, "retired-" + user, "已移除演示身份"],
    );
    await pool.query(
      "INSERT INTO workspaces(id,name,demo,expires_at) VALUES($1,'升级前演示空间',true,now()+interval '1 day')",
      [workspace],
    );
    await pool.query(
      "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'admin')",
      [workspace, user],
    );
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,csrf,demo_workspace_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')",
      [digest(raw), user, token(), workspace],
    );
    const cookie = "yince_session=" + raw;
    assert.equal((await call("/public/config")).data.demoAvailable, false);
    assert.equal((await call("/auth/demo", {})).status, 403);
    assert.equal(
      (await call("/demo/identity", { userId: user }, cookie)).status,
      403,
    );
    assert.equal((await call("/session", undefined, cookie)).data, null);
    assert.equal(
      (await call("/workspaces/" + workspace + "/state", undefined, cookie))
        .status,
      401,
    );
    const login = await call("/auth/login", {
      username: "qa_admin",
      password: "Yince-integration-only-2026",
    });
    assert.equal(login.status, 200);
    const session = await call<{
      workspaces: { role: string }[];
      demoWorkspaceId: string | null;
    }>("/session", undefined, login.cookie!.split(";")[0]);
    assert(
      session.data.workspaces.some((w: { role: string }) => w.role === "admin"),
    );
    assert.equal(session.data.demoWorkspaceId, null);
  } finally {
    await pool.query("DELETE FROM sessions WHERE user_id=$1", [user]);
    await pool.query("DELETE FROM workspaces WHERE id=$1", [workspace]);
    await pool.query("DELETE FROM users WHERE id=$1", [user]);
    await pool.end();
  }
});
