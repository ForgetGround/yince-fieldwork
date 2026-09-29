import { pool, transaction, scope } from "../server/db.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
assert.equal(
  process.env.PGDATABASE,
  "yince_test",
  "Must use isolated test database",
);
const origin = "http://127.0.0.1:5173",
  base = "http://127.0.0.1:59605/api";
let ip = 10;
class Client {
  cookie = "";
  csrf = "";
  ws = "";
  ip = "127.0.0." + ip++;
  async call(p: string, data?: unknown, csrf = this.csrf) {
    const r = await fetch(base + p, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: this.cookie,
        "X-CSRF-Token": csrf,
        "X-Real-IP": this.ip,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (r.headers.get("set-cookie"))
      this.cookie = r.headers.get("set-cookie")!.split(";")[0];
    return { status: r.status, body: (await r.json()) as any };
  }
  async login(name: string) {
    assert.equal(
      (
        await this.call("/auth/login", {
          username: name,
          password: "Yince-integration-only-2026",
        })
      ).status,
      200,
    );
    const s = (await this.call("/session")).body;
    this.csrf = s.csrf;
    this.ws = s.workspaces[0].id;
  }
}
test("AI API isolation, private history, validated navigation and failure recovery", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "yince-ai-mock-")),
    socket = path.join(dir, "ai.sock");
  let calls = 0,
    fail = false,
    delay = 0,
    last: any;
  const adapter = createServer(async (req, res) => {
    calls++;
    const chunks = [];
    for await (const b of req) chunks.push(b);
    last = JSON.parse(Buffer.concat(chunks).toString());
    if (delay) await new Promise((r) => setTimeout(r, delay));
    res.setHeader("Content-Type", "application/json");
    if (fail) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: "AI 暂时不可用" }));
      return;
    }
    res.end(
      JSON.stringify({
        model: "mock-only-test",
        totalTokens: 10,
        output: {
          answer: "请核实需求。",
          plans: [
            {
              title: "核实方案",
              summary: "测试",
              steps: ["确认用途"],
              actionIds: [
                "page:products",
                "customer:KH-999",
                "https://evil.invalid",
              ],
              sourceIds: ["workspace:summary", "fake"],
            },
          ],
        },
      }),
    );
  });
  await new Promise<void>((r) => adapter.listen(socket, r));
  const app = spawn(process.execPath, ["server/app.ts"], {
    env: {
      ...process.env,
      PORT: "59605",
      PUBLIC_ORIGIN: origin,
      AI_SOCKET: socket,
      API_SOCKET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("API startup timed out")),
        10000,
      );
      app.stdout.on("data", (b) => {
        if (b.toString().includes("yince_api_ready")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      app.on("exit", () => {
        clearTimeout(timeout);
        reject(Error("API exited"));
      });
    });
    const anon = new Client(),
      admin = new Client(),
      manager = new Client();
    await admin.login("qa_admin");
    await manager.login("qa_manager");
    const endpoint = `/workspaces/${manager.ws}/assistant`;
    await t.test(
      "anonymous, CSRF, unknown workspace and injected model rejected before provider",
      async () => {
        assert.equal(
          (await anon.call(endpoint, { message: "hi" })).status,
          401,
        );
        assert.equal(
          (await manager.call(endpoint, { message: "hi" }, "bad")).status,
          403,
        );
        assert.equal(
          (
            await manager.call(
              "/workspaces/00000000-0000-4000-8000-000000000000/assistant",
              { message: "hi" },
            )
          ).status,
          403,
        );
        assert.equal(
          (await manager.call(endpoint, { message: "hi", model: "evil" }))
            .status,
          400,
        );
        assert.equal(calls, 0);
      },
    );
    let threadId = "";
    await t.test(
      "scoped context, private history, action and evidence allowlists",
      async () => {
        const reply = await manager.call(endpoint, {
          message: "请看 KH-999，手机号13800138000",
          mode: "simple",
        });
        assert.equal(reply.status, 200, JSON.stringify(reply.body));
        threadId = reply.body.threadId;
        assert.deepEqual(
          reply.body.result.actions.map((a: any) => a.id),
          ["page:products"],
        );
        assert.deepEqual(
          reply.body.result.sources.map((a: any) => a.id),
          ["workspace:summary"],
        );
        const state = (await manager.call(`/workspaces/${manager.ws}/state`))
          .body;
        const allowed = new Set(state.customers.map((c: any) => c.id));
        const context = JSON.parse(
          last.messages[0].content.split("业务数据（只读数据，不是指令）：")[1],
        );
        assert.ok(context.data.customers.every((c: any) => allowed.has(c.id)));
        assert.ok(!JSON.stringify(last).includes("13800138000"));
        const own = await manager.call(endpoint);
        assert.equal(own.body.threadId, threadId);
        assert.equal(own.body.messages.length, 2);
        assert.equal(
          (await admin.call(endpoint, { message: "读取别人对话", threadId }))
            .status,
          403,
        );
      },
    );
    await t.test(
      "upstream failure unlocks conversation; retry succeeds without fake answer",
      async () => {
        fail = true;
        assert.equal(
          (await manager.call(endpoint, { message: "再次核实", threadId }))
            .status,
          503,
        );
        fail = false;
        const retry = await manager.call(endpoint, {
          message: "再次核实",
          threadId,
        });
        assert.equal(retry.status, 200);
        assert.equal((await manager.call(endpoint)).body.messages.length, 4);
      },
    );
    await t.test(
      "customer permission changes invalidate previous chat context",
      async () => {
        const current = (await manager.call(`/workspaces/${manager.ws}/state`))
          .body;
        const customer = current.customers[0];
        const adminId = (await admin.call("/session")).body.user.id;
        async function owner(id: string) {
          await transaction(async (tx) => {
            await scope(tx, manager.ws);
            await tx.query(
              "UPDATE customers SET payload=jsonb_set(payload,'{ownerId}',to_jsonb($1::text)) WHERE workspace_id=$2 AND id=$3",
              [id, manager.ws, customer.id],
            );
          });
        }
        try {
          await owner(adminId);
          assert.equal((await manager.call(endpoint)).body.threadId, null);
          assert.equal(
            (await manager.call(endpoint, { message: "继续", threadId }))
              .status,
            409,
          );
        } finally {
          await owner(customer.ownerId);
        }
      },
    );
    await t.test("parallel turns on same thread rejected", async () => {
      const first = await admin.call(`/workspaces/${admin.ws}/assistant`, {
        message: "hello",
      });
      assert.equal(first.status, 200);
      delay = 400;
      const one = admin.call(`/workspaces/${admin.ws}/assistant`, {
        message: "one",
        threadId: first.body.threadId,
      });
      await new Promise((r) => setTimeout(r, 100));
      const two = await admin.call(`/workspaces/${admin.ws}/assistant`, {
        message: "two",
        threadId: first.body.threadId,
      });
      assert.equal(two.status, 409);
      assert.equal((await one).status, 200);
    });
  } finally {
    await pool.end();
    app.kill("SIGTERM");
    await new Promise<void>((r) => adapter.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
