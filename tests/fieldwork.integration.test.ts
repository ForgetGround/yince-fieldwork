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
test("首页地图与产品规则权限：真实 API 边界", async (t) => {
  const admin = new Client();
  await admin.login("qa_admin");
  const manager = new Client();
  await manager.login("qa_manager");
  const supervisor = new Client();
  await supervisor.login("qa_supervisor");
  const reviewer = new Client();
  await reviewer.login("qa_reviewer");
  const viewer = new Client();
  await viewer.login("qa_viewer");
  const state = await admin.state();
  const owned = (await manager.state()).customers[0];
  const foreign = state.customers.find((c: any) => c.ownerId !== owned.ownerId);
  const location = {
    region: "集成验证区域",
    address: "隔离测试位置，不是真实客户地址",
    longitude: 116,
    latitude: 29,
    coordinateSystem: "GCJ02",
    consent: true,
  };
  await t.test("仅管理员维护产品规则；主管不能借审查改变准入", async () => {
    for (const client of [manager, supervisor, reviewer, viewer]) {
      await client.command(
        {
          type: "rule.compile",
          productId: "PRODUCT-3",
          text: "企业持续经营不少于2年。",
          name: "拒绝测试",
        },
        403,
      );
      await client.command({ type: "rule.submit", ruleId: "R-DEMO-002" }, 403);
    }
    const compiled = await admin.command({
      type: "rule.compile",
      productId: "PRODUCT-3",
      text: "企业持续经营年限不少于2年。",
      name: "首页权限测试-" + Date.now(),
    });
    const rule = compiled.state.rules
      .filter((r: any) => r.source.startsWith("首页权限测试-"))
      .slice(-1)[0];
    const submitted = await admin.command({
      type: "rule.submit",
      ruleId: rule.id,
    });
    const r = submitted.state.reviews.find((r: any) => r.targetId === rule.id);
    await supervisor.command(
      {
        type: "review.decide",
        reviewId: r.id,
        decision: "approved",
        comment: "无权审查",
      },
      403,
    );
    await admin.command(
      {
        type: "review.decide",
        reviewId: r.id,
        decision: "approved",
        comment: "禁止自审",
      },
      403,
    );
    await reviewer.command({
      type: "review.decide",
      reviewId: r.id,
      decision: "rejected",
      comment: "测试候选退回，不变更规则",
    });
  });
  await t.test("位置写入校验数值、授权与客户归属", async () => {
    await manager.command(
      {
        type: "customer.location",
        customerId: owned.id,
        location: { ...location, latitude: 91 },
      },
      400,
    );
    await manager.command(
      {
        type: "customer.location",
        customerId: owned.id,
        location: { ...location, coordinateSystem: "WGS84" },
      },
      400,
    );
    if (foreign)
      await manager.command(
        { type: "customer.location", customerId: foreign.id, location },
        403,
      );
    await viewer.command(
      { type: "customer.location", customerId: owned.id, location },
      403,
    );
    await manager.command({
      type: "customer.location",
      customerId: owned.id,
      location: { ...location, consent: false },
    });
    await manager.command(
      { type: "customer.navigate", customerId: owned.id },
      409,
    );
    const saved = await manager.command({
      type: "customer.location",
      customerId: owned.id,
      location,
    });
    assert.equal(
      saved.state.customers.find((c: any) => c.id === owned.id).location.region,
      location.region,
    );
  });
  await t.test(
    "导航不传客户身份，审计不含精确坐标；无权限角色不可取位置",
    async () => {
      const r = await manager.command({
        type: "customer.navigate",
        customerId: owned.id,
        mode: "walk",
      });
      const url = new URL(r.result.url);
      assert.equal(url.hostname, "uri.amap.com");
      assert.equal(url.searchParams.get("to"), "116,29,拜访目的地");
      assert.equal(url.href.includes(owned.id), false);
      const audit = r.state.audit.findLast(
        (a: any) => a.action === "打开地图导航",
      );
      assert.ok(audit);
      assert.equal(audit.detail.includes("116,29"), false);
      const brief = await manager.command({
        type: "brief.confirm",
        productId: "PRODUCT-3",
        customerId: owned.id,
        checklist: ["地图隐私验证"],
        ack: true,
      });
      assert.ok(brief.result.customerSnapshot.location);
      for (const client of [reviewer, viewer]) {
        const s = await client.state();
        assert.equal(
          s.customers.find((c: any) => c.id === owned.id).location,
          undefined,
        );
        assert.equal(
          s.briefs.find((b: any) => b.id === brief.result.id).customerSnapshot
            .location,
          undefined,
        );
        await client.command(
          { type: "customer.navigate", customerId: owned.id },
          403,
        );
      }
      await manager.command({
        type: "customer.location",
        customerId: owned.id,
        location: { ...location, consent: false },
      });
      await manager.command(
        { type: "customer.navigate", customerId: owned.id },
        409,
      );
    },
  );
}).finally(() => pool.end());
