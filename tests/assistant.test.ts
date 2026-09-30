import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContext,
  chatSchema,
  redact,
  validateAnswer,
} from "../server/assistant-context.ts";
import { sampleCustomers } from "../lib/workbench.ts";
import type { PlatformState } from "../lib/platform.ts";
const base = {
  customers: sampleCustomers(),
  products: [],
  rules: [],
  productMatches: {},
  tasks: [],
  reviews: [],
  referenceDate: "2026-09-30",
} as unknown as PlatformState;
test("AI 摘要不包含联系方式、位置、负责人、自由文本需求或原始记录", () => {
  const customers = [
    {
      ...base.customers[0],
      phone: "13800138000",
      wechat: "private-wechat",
      ownerName: "PRIVATE-NAME",
      demand: "RAW-PRIVATE-NOTE",
      location: { address: "PRIVATE-ADDRESS", latitude: 29, longitude: 116 },
    },
  ];
  const context = buildContext({ ...base, customers } as PlatformState, "你好");
  const s = JSON.stringify(context);
  for (const secret of [
    "13800138000",
    "private-wechat",
    "PRIVATE-NAME",
    "RAW-PRIVATE-NOTE",
    "PRIVATE-ADDRESS",
  ])
    assert.ok(!s.includes(secret));
});
test("只从已授权客户生成动作，明确编号优先且限制摘要规模", () => {
  const context = buildContext(base, "请分析 KH-020 和 KH-999");
  assert.equal(context.data.customers[0].id, "KH-020");
  assert.equal(context.data.customers.length, 15);
  assert.ok(!context.actions.some((a) => a.target === "KH-999"));
});
test("模型不能伪造业务跳转或来源，空回答及超长结构拒绝", () => {
  const c = buildContext(base, "");
  const r = validateAnswer(
    {
      answer: "建议核实需求。",
      plans: [
        {
          title: "准备",
          summary: "核实",
          steps: ["确认用途"],
          actionIds: [
            "page:products",
            "https://evil.invalid",
            "customer:KH-999",
          ],
          sourceIds: ["workspace:summary", "invented"],
        },
      ],
    },
    c,
    "simple",
    "deepseek-flash",
  );
  assert.deepEqual(r.plans[0].actionIds, ["page:products"]);
  assert.deepEqual(r.plans[0].sourceIds, ["workspace:summary"]);
  assert.throws(() =>
    validateAnswer({ answer: "", plans: [] }, c, "simple", "x"),
  );
});
test("输入长度、模式、角色注入及常见敏感字段有边界", () => {
  assert.ok(!chatSchema.safeParse({ message: "x", model: "evil" }).success);
  assert.ok(!chatSchema.safeParse({ message: "x", mode: "spark" }).success);
  assert.ok(!chatSchema.safeParse({ message: "a".repeat(2001) }).success);
  const safe = redact(
    "13800138000 110105199001010010 sk-test-secret-key-123456",
  );
  assert.ok(!safe.includes("13800138000"));
  assert.ok(!safe.includes("110105199001010010"));
  assert.ok(!safe.includes("sk-test"));
});

test("连续追问优先保留近期客户，显式切换优先，历史不恢复越权数据", () => {
  const history = [
    { role: "user" as const, content: "为 KH-020 和 KH-999 准备方案" },
  ];
  const followup = buildContext(base, "帮我改成微信话术", history);
  assert.equal(followup.data.customers[0].id, "KH-020");
  assert.ok(!followup.data.customers.some((c) => c.id === "KH-999"));
  const switched = buildContext(base, "再给 KH-019 做一份", history);
  assert.equal(switched.data.customers[0].id, "KH-019");
  const restricted = buildContext(
    { ...base, customers: base.customers.filter((c) => c.id !== "KH-020") },
    "这个客户再简短点",
    history,
  );
  assert.ok(!restricted.sources.some((s) => s.id === "customer:KH-020"));
});
