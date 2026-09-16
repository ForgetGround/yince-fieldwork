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
import { ensureProductCatalog } from "../server/product-catalog.ts";
test("产品库 PostgreSQL：迁移幂等、权限、独立规则与产品闭环", async (t) => {
  const admin = new Client();
  await admin.login("qa_admin");
  const manager = new Client();
  await manager.login("qa_manager");
  const reviewer = new Client();
  await reviewer.login("qa_reviewer");
  let state = await admin.state();
  let briefId = "";
  let candidateId = "";
  await t.test("产品迁移可重复运行，不覆盖已有客户特征和历史快照", async () => {
    assert.equal(state.products.length, 6);
    assert.equal(Object.keys(state.productMatches).length, 6);
    await transaction(async (tx) => {
      await scope(tx, admin.ws);
      assert.equal(await ensureProductCatalog(tx, admin.ws), false);
    });
    const after = await admin.state();
    assert.deepEqual(after.briefs, state.briefs);
    assert.deepEqual(after.customers, state.customers);
  });
  await t.test(
    "匹配只返回当前经理可见客户，关联依据只属于所选产品",
    async () => {
      const st = await manager.state();
      const ids = new Set(st.customers.map((c: any) => c.id));
      assert.ok(ids.size > 0 && ids.size < state.customers.length);
      for (const [id, matches] of Object.entries(st.productMatches) as [
        string,
        any[],
      ][]) {
        assert.equal(matches.length, ids.size);
        for (const match of matches) {
          assert.ok(ids.has(match.customerId));
          for (const check of match.checks)
            assert.equal(
              st.rules.find((r: any) => r.id === check.ruleId).productId,
              id,
            );
        }
      }
      const other = (await admin.session()).workspaces.find(
        (w: any) => w.id !== admin.ws,
      );
      if (other)
        assert.equal(
          (await manager.call(`/workspaces/${other.id}/state`)).status,
          403,
        );
    },
  );
  await t.test("产品不存在时拒绝保存，产品快照保存正确规则", async () => {
    await admin.command(
      {
        type: "brief.confirm",
        customerId: "KH-001",
        productId: "not-in-workspace",
        checklist: ["核对"],
        ack: true,
      },
      404,
    );
    await admin.command(
      {
        type: "rule.compile",
        productId: "not-in-workspace",
        text: "企业经营年限不少于2年。",
        name: "测试",
      },
      404,
    );
    const r = await admin.command({
      type: "brief.confirm",
      customerId: "KH-001",
      productId: "PRODUCT-5",
      checklist: ["已核对智享贷条件"],
      ack: true,
    });
    assert.equal(r.result.productName, "智享贷");
    assert.equal(r.result.productId, "PRODUCT-5");
    assert.ok(r.result.rules.length > 0);
    assert.ok(r.result.rules.every((r: any) => r.productId === "PRODUCT-5"));
    briefId = r.result.id;
  });
  await t.test("产品候选编译和独立审查不会归档其他产品条件", async () => {
    const result = await admin.command({
      type: "rule.compile",
      productId: "PRODUCT-3",
      text: "企业持续经营年限不少于2年。",
      name: "产品关联集成核查",
    });
    const candidate = result.state.rules
      .filter(
        (r: any) => r.source === "产品关联集成核查" && r.status === "pending",
      )
      .slice(-1)[0];
    assert.ok(candidate);
    candidateId = candidate.id;
    assert.equal(candidate.productId, "PRODUCT-3");
    const submitted = await admin.command({
      type: "rule.submit",
      ruleId: candidateId,
    });
    const review = submitted.state.reviews.find(
      (r: any) => r.targetId === candidateId && r.status === "pending",
    );
    await admin.command(
      {
        type: "review.decide",
        reviewId: review.id,
        decision: "approved",
        comment: "不能自审",
      },
      403,
    );
    const decided = await reviewer.command({
      type: "review.decide",
      reviewId: review.id,
      decision: "approved",
      comment: "核实产品及来源",
    });
    assert.equal(
      decided.state.rules.find((r: any) => r.id === "PRODUCT-5-YEARS").status,
      "active",
    );
    assert.equal(
      decided.state.rules.find((r: any) => r.id === "PRODUCT-4-YEARS").status,
      "active",
    );
    assert.equal(
      decided.state.rules.find((r: any) => r.id === candidateId).status,
      "active",
    );
    assert.equal(
      decided.state.briefs
        .find((b: any) => b.id === briefId)
        .rules.find((r: any) => r.id === "PRODUCT-5-YEARS").value,
      3,
    );
  });
  await t.test("沟通记录和访后草稿持续关联所选产品快照", async () => {
    const communication = await admin.command({
      type: "communication.add",
      customerId: "KH-001",
      briefId,
      channel: "wechat",
      outcome: "connected",
      content: "核实智享贷知识产权和采购资金安排，等待提供材料。",
    });
    assert.equal(communication.result.briefId, briefId);
    const visit = await admin.command({
      type: "visit.draft",
      customerId: "KH-001",
      briefId,
      channel: "wechat",
      raw: "客户有采购融资需求，尚缺知识产权证明，下次联系核实。",
    });
    assert.equal(visit.result.briefId, briefId);
  });
}).finally(() => pool.end());
