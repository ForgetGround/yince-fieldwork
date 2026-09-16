import { test } from "node:test";
import assert from "node:assert/strict";
import { pool, transaction, scope } from "../server/db.ts";
import { chinaDate, addDays } from "../lib/platform.ts";
assert.equal(
  process.env.PGDATABASE,
  "yince_test",
  "集成测试必须使用独立 yince_test 数据库",
);
const base = "http://127.0.0.1:59604";
const origin = process.env.PUBLIC_ORIGIN!;
const password = "Yince-integration-only-2026";
let sequence = 1;
class Client {
  cookie = "";
  csrf = "";
  ws = "";
  ip = "127.0.0." + sequence++;
  async call(path: string, data?: unknown, extra: Record<string, string> = {}) {
    const r = await fetch(base + "/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "X-Real-IP": this.ip,
        "X-CSRF-Token": this.csrf,
        Cookie: this.cookie,
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const cookie = r.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const body: any = await r.json();
    return { status: r.status, body, headers: r.headers };
  }
  async session() {
    const r = await this.call("/session");
    assert.equal(r.status, 200);
    this.csrf = r.body.csrf;
    this.ws = r.body.workspaces[0].id;
    return r.body;
  }
  async login(username: string) {
    const r = await this.call("/auth/login", { username, password });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return this.session();
  }
  async command(data: unknown, status = 200) {
    const r = await this.call(`/workspaces/${this.ws}/commands`, data);
    assert.equal(r.status, status, JSON.stringify(r.body));
    return r.body;
  }
  async state() {
    const r = await this.call(`/workspaces/${this.ws}/state`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  }
}
test("真实 PostgreSQL：登录、跨空间权限、双人审查、沟通闭环与审计", async (t) => {
  const admin = new Client();
  let manager: Client, reviewer: Client, supervisor: Client, viewer: Client;
  let state: any;
  let managerId = "",
    briefId = "",
    visitId = "";
  await t.test("管理员初始化、密码登录与安全会话", async () => {
    const cfg = await admin.call("/public/config");
    if (cfg.body.setupAvailable) {
      const r = await admin.call("/auth/setup", {
        username: "qa_admin",
        name: "测试管理员",
        password,
        code: process.env.SETUP_TOKEN,
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.match(r.headers.get("set-cookie") || "", /HttpOnly/);
      assert.match(r.headers.get("set-cookie") || "", /SameSite=Strict/);
    } else await admin.login("qa_admin");
    await admin.session();
    const again = await admin.call("/auth/setup", {
      username: "qa_duplicate",
      name: "重复管理员",
      password,
      code: process.env.SETUP_TOKEN,
    });
    assert.equal(again.status, 409);
    state = await admin.state();
    assert.equal(state.customers.length, 20);
    assert.equal(state.products.length, 5);
    assert.equal(state.strategies.length, 6);
    assert.equal(
      state.customers
        .find((c: any) => c.id === "KH-001")
        .ruleHits.reduce((n: number, h: any) => n + h.points, 0),
      92,
    );
  });
  await t.test("来源、CSRF、输入白名单与未登录请求被校验", async () => {
    const payload = {
      type: "brief.confirm",
      customerId: "KH-001",
      checklist: ["核对"],
      ack: true,
    };
    assert.equal(
      (
        await admin.call(`/workspaces/${admin.ws}/commands`, payload, {
          "X-CSRF-Token": "",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await admin.call(`/workspaces/${admin.ws}/commands`, payload, {
          Origin: "https://untrusted.invalid",
        })
      ).status,
      403,
    );
    await admin.command({ ...payload, role: "admin" }, 400);
    const anonymous = new Client();
    assert.equal(
      (await anonymous.call(`/workspaces/${admin.ws}/state`)).status,
      401,
    );
    assert.equal(
      (
        await anonymous.call("/auth/login", {
          username: "qa_admin",
          password: "incorrect",
        })
      ).status,
      401,
    );
  });
  await t.test("成员真实登录，禁止自提权、禁用唯一管理员", async () => {
    for (const [name, role] of [
      ["manager", "manager"],
      ["reviewer", "reviewer"],
      ["supervisor", "supervisor"],
      ["viewer", "viewer"],
    ] as const) {
      if (!state.members.some((m: any) => m.username === "qa_" + name))
        await admin.command({
          type: "member.add",
          username: "qa_" + name,
          name: "测试" + name,
          password,
          role,
        });
    }
    state = await admin.state();
    managerId = state.members.find((m: any) => m.username === "qa_manager").id;
    manager = new Client();
    await manager.login("qa_manager");
    reviewer = new Client();
    await reviewer.login("qa_reviewer");
    supervisor = new Client();
    await supervisor.login("qa_supervisor");
    viewer = new Client();
    await viewer.login("qa_viewer");
    await manager.command(
      { type: "member.update", userId: managerId, role: "admin", active: true },
      403,
    );
    const me = (await admin.session()).user.id;
    await admin.command(
      { type: "member.update", userId: me, role: "viewer", active: true },
      409,
    );
    assert.equal(
      (await admin.call("/demo/identity", { userId: managerId })).status,
      403,
    );
  });
  await t.test("转派审查转移客户与未完成任务，提交人不能自审", async () => {
    if (
      (await admin.state()).customers.find((c: any) => c.id === "KH-001")
        .ownerId !== managerId
    ) {
      let a = await admin.command({
        type: "transfer.request",
        customerId: "KH-001",
        assigneeId: managerId,
        reason: "集成测试任务移交",
      });
      const r = a.state.reviews.find(
        (r: any) => r.kind === "transfer" && r.status === "pending",
      );
      await admin.command(
        {
          type: "review.decide",
          reviewId: r.id,
          decision: "approved",
          comment: "本人不能审查",
        },
        403,
      );
      await reviewer.command(
        {
          type: "review.decide",
          reviewId: r.id,
          decision: "approved",
          comment: "审查员无转派权限",
        },
        403,
      );
      await supervisor.command({
        type: "review.decide",
        reviewId: r.id,
        decision: "approved",
        comment: "核对后同意转派",
      });
    }
    state = await manager.state();
    assert.equal(state.customers.length, 1);
    assert(state.tasks.every((x: any) => x.assigneeId === managerId));
    await manager.command(
      {
        type: "brief.confirm",
        customerId: "KH-002",
        checklist: ["越权核对"],
        ack: true,
      },
      403,
    );
  });
  await t.test("不同工作空间隔离，数据库 RLS 与审计写权限有效", async () => {
    let other = (await admin.session()).workspaces.find(
      (w: any) => w.id !== admin.ws,
    );
    if (!other) {
      const r = await admin.call("/workspaces", { name: "集成测试第二空间" });
      assert.equal(r.status, 201);
      other = { id: r.body.id };
    }
    assert.equal(
      (await manager.call(`/workspaces/${other.id}/state`)).status,
      403,
    );
    await transaction(async (tx) => {
      assert.equal((await tx.query("SELECT * FROM customers")).rowCount, 0);
      await scope(tx, admin.ws);
      assert.equal(
        (
          await tx.query("SELECT * FROM customers WHERE workspace_id=$1", [
            other.id,
          ])
        ).rowCount,
        0,
      );
    });
    await assert.rejects(
      transaction(async (tx) => {
        await scope(tx, admin.ws);
        await tx.query(
          "UPDATE audit SET payload=payload || '{\"forged\":true}'::jsonb",
        );
      }),
      (e: any) => e.code === "42501",
    );
  });
  await t.test("准备快照、规则独立审查后，旧快照保持原版本", async () => {
    await manager.command(
      {
        type: "brief.confirm",
        customerId: "KH-001",
        checklist: ["核对依据"],
        ack: false,
      },
      400,
    );
    const b = await manager.command({
      type: "brief.confirm",
      customerId: "KH-001",
      checklist: ["已核对规则与资料", "已准备沟通问题"],
      ack: true,
    });
    briefId = b.result.id;
    const before = b.result.rules.find(
      (r: any) => r.field === "operatingYears",
    ).value;
    const st = await reviewer.state();
    const r = st.reviews.find(
      (r: any) => r.kind === "rule" && r.status === "pending",
    );
    if (r)
      await reviewer.command({
        type: "review.decide",
        reviewId: r.id,
        decision: "approved",
        comment: "核对模拟通知，确认新版本",
      });
    state = await manager.state();
    assert.equal(
      state.briefs
        .find((b: any) => b.id === briefId)
        .rules.find((r: any) => r.field === "operatingYears").value,
      before,
    );
    assert.equal(
      state.rules.find(
        (r: any) => r.field === "operatingYears" && r.status === "active",
      ).value,
      2,
    );
  });
  await t.test("沟通、纪要和任务闭环，重复确认不会重复建任务", async () => {
    const raw = `客户计划扩大采购，需要核实流动资金需求。尚缺采购合同。下次于${addDays(chinaDate(), 2)}联系，跟进材料。`;
    await manager.command({
      type: "communication.add",
      customerId: "KH-001",
      briefId,
      channel: "phone",
      outcome: "connected",
      content: raw,
    });
    const v = await manager.command({
      type: "visit.draft",
      customerId: "KH-001",
      briefId,
      channel: "phone",
      raw,
    });
    visitId = v.result.id;
    const payload = {
      type: "visit.confirm",
      visitId,
      summary: v.result.summary,
      demand: v.result.demand,
      questions: "",
      materials: "采购合同",
      nextAction: "跟进采购合同与真实用款计划",
      nextDate: addDays(chinaDate(), 2),
      ack: true,
    };
    const confirmed = await manager.command(payload);
    const count = confirmed.state.tasks.length;
    await manager.command(payload, 409);
    assert.equal((await manager.state()).tasks.length, count);
    assert.equal(confirmed.state.customers[0].stage, 3);
    const submitted = await manager.command({ type: "visit.submit", visitId });
    const r = submitted.state.reviews.find(
      (r: any) => r.targetId === visitId && r.status === "pending",
    );
    await manager.command(
      {
        type: "review.decide",
        reviewId: r.id,
        decision: "approved",
        comment: "本人提交不允许",
      },
      403,
    );
    await reviewer.command({
      type: "review.decide",
      reviewId: r.id,
      decision: "approved",
      comment: "核对材料与原文，展业纪要通过",
    });
    state = await manager.state();
    for (const task of state.tasks.filter(
      (t: any) => t.customerId === "KH-001" && !t.done,
    ))
      await manager.command({
        type: "task.toggle",
        taskId: task.id,
        done: true,
      });
    state = await manager.state();
    assert.equal(state.customers[0].stage, 5);
    assert(state.notifications.some((n: any) => n.kind === "review"));
    assert(state.audit.some((a: any) => a.action === "确认访后纪要"));
  });
  await t.test("访后归纳需要沟通记录，材料补齐必须显式确认", async () => {
    const b = await manager.command({
      type: "brief.confirm",
      customerId: "KH-001",
      checklist: ["核实补齐情况"],
      ack: true,
    });
    const data = {
      type: "visit.draft",
      customerId: "KH-001",
      briefId: b.result.id,
      channel: "phone",
      raw: "客户确认本次资料已经补齐。",
    };
    await manager.command(data, 409);
    await manager.command({
      type: "communication.add",
      customerId: "KH-001",
      briefId: b.result.id,
      channel: "phone",
      outcome: "connected",
      content: data.raw,
    });
    const v = await manager.command(data);
    const confirm = {
      type: "visit.confirm",
      visitId: v.result.id,
      summary: data.raw,
      demand: "",
      questions: "",
      materials: "采购合同",
      materialsComplete: true,
      nextAction: "",
      nextDate: "",
      ack: true,
    };
    await manager.command(confirm, 400);
    const completed = await manager.command({ ...confirm, materials: "" });
    assert.deepEqual(completed.state.customers[0].missing, []);
    assert(
      !completed.state.customers[0].ruleHits.some((h: any) => h.id === "S-03"),
    );
  });
  await t.test("撤销成员资格即时生效，旧会话无法继续读取", async () => {
    const member = (await admin.state()).members.find(
      (m: any) => m.username === "qa_viewer",
    );
    await admin.command({
      type: "member.update",
      userId: member.id,
      role: "viewer",
      active: false,
    });
    assert.equal(
      (await viewer.call(`/workspaces/${admin.ws}/state`)).status,
      403,
    );
    await admin.command({
      type: "member.update",
      userId: member.id,
      role: "viewer",
      active: true,
    });
  });
  await t.test("公开演示与身份切换入口已关闭", async () => {
    const a = new Client();
    assert.equal((await a.call("/public/config")).body.demoAvailable, false);
    assert.equal((await a.call("/auth/demo", {})).status, 403);
    assert.equal((await a.call("/demo/identity", {})).status, 403);
    assert.equal(
      (await admin.call("/demo/identity", { userId: managerId })).status,
      403,
    );
  });
  await pool.end();
});
