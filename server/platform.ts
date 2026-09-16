import { ensureProductCatalog } from "./product-catalog.ts";
import {
  LEGACY_PRODUCT_ID,
  productIdOf,
  matchProduct,
} from "../lib/product-matching.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  initialRules,
  sampleCustomers,
  compilePolicy,
  validateCustomers,
  extractVisit,
  opportunity,
  type Customer,
  type Rule,
  type Task,
  type Visit,
  type Audit,
} from "../lib/workbench.ts";
import {
  initialStrategies,
  strategyHits,
  chinaDate,
  addDays,
  dateDiff,
  type Role,
  type Member,
  type Workspace,
  type PlatformState,
  type Strategy,
  type Product,
  type Brief,
  type Communication,
  type Review,
  type Notification,
} from "../lib/platform.ts";
import { type Tx, rows, get, put, scope, transaction } from "./db.ts";
import { demand, hashPassword } from "./security.ts";
export type Identity = {
  id: string;
  name: string;
  username: string;
  demoWorkspaceId: string | null;
};
export type Context = { tx: Tx; ws: Workspace; user: Identity; role: Role };
const now = () => new Date().toISOString();
export const roleSchema = z.enum([
  "admin",
  "supervisor",
  "manager",
  "reviewer",
  "viewer",
]);
const text = (max = 3000) => z.string().trim().max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "日期无效",
  );
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("customer.import"), customers: z.unknown() })
    .strict(),
  z
    .object({
      type: z.literal("customer.contact"),
      customerId: text(30),
      phone: text(24),
      wechat: text(80),
      consent: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("rule.compile"),
      productId: text(100).default(LEGACY_PRODUCT_ID),
      text: text(30000).min(1),
      name: text(150),
    })
    .strict(),
  z.object({ type: z.literal("rule.submit"), ruleId: text(100) }).strict(),
  z
    .object({
      type: z.literal("brief.confirm"),
      productId: text(100).default(LEGACY_PRODUCT_ID),
      customerId: text(30),
      checklist: z.array(text(150)).min(1).max(20),
      ack: z.literal(true),
    })
    .strict(),
  z
    .object({
      type: z.literal("communication.add"),
      customerId: text(30),
      briefId: text(100),
      channel: z.enum(["phone", "wechat", "visit", "other"]),
      outcome: z.enum(["connected", "unanswered", "scheduled"]),
      content: text(5000).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("visit.draft"),
      customerId: text(30),
      briefId: text(100),
      raw: text(30000).min(1),
      channel: z.enum(["phone", "wechat", "visit", "other"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("visit.confirm"),
      visitId: text(100),
      summary: text(5000).min(1),
      demand: text(3000),
      questions: text(3000),
      materials: text(3000),
      materialsComplete: z.boolean().optional(),
      nextAction: text(3000),
      nextDate: z.union([date, z.literal("")]),
      ack: z.literal(true),
    })
    .strict(),
  z.object({ type: z.literal("visit.submit"), visitId: text(100) }).strict(),
  z
    .object({
      type: z.literal("task.toggle"),
      taskId: text(100),
      done: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("transfer.request"),
      customerId: text(30),
      assigneeId: z.string().uuid(),
      reason: text(500).min(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("review.decide"),
      reviewId: text(100),
      decision: z.enum(["approved", "rejected"]),
      comment: text(1000).min(2),
    })
    .strict(),
  z
    .object({ type: z.literal("notification.read"), notificationId: text(150) })
    .strict(),
  z
    .object({
      type: z.literal("member.add"),
      username: z.string().regex(/^[a-zA-Z0-9_.-]{3,50}$/),
      name: text(60).min(1),
      password: z.string().min(12).max(128),
      role: roleSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("member.update"),
      userId: z.string().uuid(),
      role: roleSchema,
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("audit.record"),
      action: z.enum(["查看作战单", "查看规则来源", "导出 CRM", "导出审计"]),
      target: text(120),
    })
    .strict(),
]);
function allowed(ctx: Context, roles: Role[]) {
  demand(roles.includes(ctx.role), 403, "当前身份没有执行此操作的权限");
}
export async function withWorkspace<T>(
  user: Identity,
  id: string,
  fn: (ctx: Context) => Promise<T>,
) {
  demand(z.string().uuid().safeParse(id).success, 404, "工作空间不存在");
  return transaction(async (tx) => {
    const r = await tx.query(
      "SELECT w.*,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2 AND m.active AND (w.expires_at IS NULL OR w.expires_at>now()) FOR UPDATE OF w",
      [id, user.id],
    );
    demand(r.rowCount, 403, "无权访问此工作空间，或演示已过期");
    if (user.demoWorkspaceId)
      demand(
        user.demoWorkspaceId === id,
        403,
        "演示身份仅能访问自己的体验空间",
      );
    const w = r.rows[0];
    await scope(tx, id);
    return fn({
      tx,
      user,
      role: w.role,
      ws: {
        id: w.id,
        name: w.name,
        role: w.role,
        demo: w.demo,
        expiresAt: w.expires_at?.toISOString() || null,
        revision: w.revision,
      },
    });
  });
}
export async function members(tx: Tx, ws: string): Promise<Member[]> {
  const r = await tx.query(
    "SELECT u.id,u.username,u.name,m.role,m.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.created_at,u.id",
    [ws],
  );
  return r.rows;
}
async function audit(
  ctx: Context,
  action: string,
  target: string,
  detail: string,
) {
  const a: Audit = {
    id: randomUUID(),
    time: now(),
    actor: ctx.user.name,
    action,
    target,
    detail,
  };
  await put(ctx.tx, "audit", ctx.ws.id, { ...a, actorId: ctx.user.id });
}
async function notice(
  ctx: Context,
  recipientId: string,
  title: string,
  body: string,
  kind: Notification["kind"],
  target: string,
  id: string = randomUUID(),
) {
  await put(ctx.tx, "notifications", ctx.ws.id, {
    id,
    title,
    body,
    kind,
    target,
    created: now(),
    read: false,
    recipientId,
  } as Notification & { recipientId: string });
}
async function reviewers(ctx: Context, title: string, target: string) {
  for (const m of await members(ctx.tx, ctx.ws.id))
    if (
      m.active &&
      ["admin", "supervisor", "reviewer"].includes(m.role) &&
      m.id !== ctx.user.id
    )
      await notice(
        ctx,
        m.id,
        title,
        "有新的申请等待独立审查。",
        "review",
        target,
      );
}
async function customer(ctx: Context, id: string, write = false) {
  const c = await get<Customer>(ctx.tx, "customers", ctx.ws.id, id);
  demand(c, 404, "客户不存在");
  if (ctx.role === "manager")
    demand(c.ownerId === ctx.user.id, 403, "只能操作本人负责的客户");
  if (write) allowed(ctx, ["admin", "supervisor", "manager"]);
  return c;
}
async function advance(ctx: Context, c: Customer, stage: number) {
  c.stage = stage;
  c.maxStage = Math.max(c.maxStage || 0, stage);
  await put(ctx.tx, "customers", ctx.ws.id, c);
}
export function currentCustomer(c: Customer, strategies: Strategy[]): Customer {
  const day = chinaDate();
  const current = {
    ...c,
    daysToMaturity: c.maturityDate ? dateDiff(c.maturityDate, day) : null,
    lastContactDays: c.lastContactDate
      ? Math.max(0, dateDiff(day, c.lastContactDate))
      : c.lastContactDays,
  };
  return { ...current, ruleHits: strategyHits(current, strategies) };
}
export async function readState(ctx: Context): Promise<PlatformState> {
  const ws = ctx.ws.id;
  const team = await members(ctx.tx, ws);
  const strategies = await rows<Strategy>(ctx.tx, "strategies", ws);
  const allCustomers = await rows<Customer>(ctx.tx, "customers", ws);
  const visible = allCustomers.filter(
    (c) => ctx.role !== "manager" || c.ownerId === ctx.user.id,
  );
  const visibleIds = new Set(visible.map((c) => c.id));
  const tasks = (await rows<Task>(ctx.tx, "tasks", ws)).filter((t) =>
    visibleIds.has(t.customerId),
  );
  for (const t of tasks)
    if (!t.done && t.due <= chinaDate() && t.assigneeId === ctx.user.id) {
      const id = `due:${chinaDate()}:${t.id}:${ctx.user.id}`;
      if (!(await get(ctx.tx, "notifications", ws, id)))
        await notice(
          ctx,
          ctx.user.id,
          `${t.due < chinaDate() ? "逾期" : "今日"}提醒：${t.title}`,
          `${t.customerId} · 截止 ${t.due}`,
          "reminder",
          t.customerId,
          id,
        );
    }
  const filter = <T extends { customerId: string }>(v: T[]) =>
    v.filter((x) => visibleIds.has(x.customerId));
  const notifications = (
    await rows<Notification & { recipientId: string }>(
      ctx.tx,
      "notifications",
      ws,
    )
  )
    .filter((n) => n.recipientId === ctx.user.id)
    .slice(-200);
  const reviews = (await rows<Review>(ctx.tx, "reviews", ws)).filter(
    (r) =>
      ctx.role !== "manager" ||
      r.submittedBy === ctx.user.id ||
      (!!r.customerId && visibleIds.has(r.customerId)),
  );
  const audits = await rows<Audit & { actorId?: string }>(ctx.tx, "audit", ws);
  const products = await rows<Product>(ctx.tx, "products", ws);
  const rules = await rows<Rule>(ctx.tx, "rules", ws);
  return {
    products,
    productMatches: Object.fromEntries(
      products.map((p) => [
        p.id,
        matchProduct(
          p.id,
          visible.map((c) => currentCustomer(c, strategies)),
          rules,
        ),
      ]),
    ),
    schema: 1,
    referenceDate: chinaDate(),
    workspace: ctx.ws,
    members: team,
    strategies,
    customers: visible.map((c) => {
      const out = currentCustomer(
        {
          ...c,
          ownerName: team.find((m) => m.id === c.ownerId)?.name || "未分配",
        },
        strategies,
      );
      if (ctx.role === "viewer" || ctx.role === "reviewer") {
        delete out.phone;
        delete out.wechat;
      }
      return out;
    }),
    rules,
    tasks: tasks.map((t) => ({
      ...t,
      assigneeName: team.find((m) => m.id === t.assigneeId)?.name || "未分配",
    })),
    visits: filter(await rows<Visit>(ctx.tx, "visits", ws)),
    briefs: filter(await rows<Brief>(ctx.tx, "briefs", ws)).map((b) => {
      if (ctx.role === "viewer" || ctx.role === "reviewer") {
        const snapshot = { ...b.customerSnapshot };
        delete snapshot.phone;
        delete snapshot.wechat;
        return { ...b, customerSnapshot: snapshot };
      }
      return b;
    }),
    communications: filter(
      await rows<Communication>(ctx.tx, "communications", ws),
    ),
    reviews,
    notifications,
    audit: audits
      .filter(
        (a) =>
          ctx.role !== "manager" ||
          a.actorId === ctx.user.id ||
          visibleIds.has(a.target),
      )
      .slice(-500),
  };
}
export async function seedWorkspace(
  tx: Tx,
  ws: string,
  ownerId: string,
  team: Member[],
) {
  await scope(tx, ws);
  const day = chinaDate();
  const manager =
    team.find((m) => m.role === "manager") ||
    team.find((m) => m.id === ownerId)!;
  const otherManager =
    team.find((m) => m.role === "manager" && m.id !== manager.id) || manager;
  for (const [i, c] of sampleCustomers().entries()) {
    const owner = i < 12 ? manager : otherManager;
    await put(tx, "customers", ws, {
      ...c,
      ownerId: owner.id,
      maturityDate:
        c.daysToMaturity === null ? null : addDays(day, c.daysToMaturity),
      lastContactDate: addDays(day, -c.lastContactDays),
      phone: "",
      wechat: `DEMO-${c.id}`,
      contactConsent: false,
      stage: 0,
      maxStage: 0,
      origin: `PostgreSQL 模拟数据 · ${day}`,
    } as Customer);
  }
  for (const r of initialRules)
    await put(tx, "rules", ws, {
      ...r,
      effective: r.synthetic ? day : r.effective,
    });
  await ensureProductCatalog(tx, ws);
  for (const s of initialStrategies) await put(tx, "strategies", ws, s);
  const taskIds = ["KH-001", "KH-008", "KH-003", "KH-007", "KH-012", "KH-016"];
  for (const [id, i] of taskIds.map((id, i) => [id, i] as const)) {
    const owner = Number(id.slice(3)) <= 12 ? manager : otherManager;
    await put(tx, "tasks", ws, {
      id: `T-SEED-${i}`,
      customerId: id,
      title:
        i === 0
          ? "核实采购融资需求"
          : i === 1
            ? "跟进经营流水补充"
            : "核实经营与资金安排",
      due: addDays(day, i === 1 ? -1 : i),
      done: false,
      source: "模拟任务",
      assigneeId: owner.id,
    } as Task);
  }
  const id = randomUUID();
  await put(tx, "reviews", ws, {
    id,
    kind: "rule",
    targetId: "R-DEMO-002",
    customerId: null,
    title: "模拟通知：经营年限调整为两年",
    status: "pending",
    submittedBy: manager.id,
    submittedName: manager.name,
    created: now(),
    comment: "",
    payload: {},
  } as Review);
  await put(tx, "audit", ws, {
    id: randomUUID(),
    time: now(),
    actor: "系统",
    action: "导入模拟资料",
    target: "20 位模拟客户",
    detail: "客户、规则、策略和任务已保存至独立工作空间；不代表银行正式制度。",
  } as Audit);
}
export async function execute(ctx: Context, input: unknown) {
  const command = commandSchema.parse(input);
  const ws = ctx.ws.id;
  const tx = ctx.tx;
  let result: unknown = null;
  switch (command.type) {
    case "customer.import": {
      allowed(ctx, ["admin", "supervisor", "manager"]);
      const imported = validateCustomers(command.customers);
      const existing = await rows<Customer>(tx, "customers", ws);
      demand(
        new Set([...existing, ...imported].map((c) => c.id)).size <= 500,
        400,
        "每个工作空间最多 500 位客户",
      );
      for (const c of imported) {
        const old = existing.find((x) => x.id === c.id);
        if (old) await customer(ctx, c.id, true);
        await put(tx, "customers", ws, {
          ...old,
          ...c,
          ownerId: old?.ownerId || ctx.user.id,
          stage: old?.stage || 0,
          maxStage: old?.maxStage || 0,
          maturityDate:
            c.daysToMaturity === null
              ? null
              : addDays(chinaDate(), c.daysToMaturity),
          lastContactDate: addDays(chinaDate(), -c.lastContactDays),
          origin: `导入资料 · ${chinaDate()}`,
        } as Customer);
      }
      await audit(
        ctx,
        "导入客户",
        String(imported.length),
        "白名单校验通过；未知值保留。",
      );
      break;
    }
    case "customer.contact": {
      const c = await customer(ctx, command.customerId, true);
      demand(
        !command.phone || /^\+?[0-9 -]{5,24}$/.test(command.phone),
        400,
        "电话号码格式无效",
      );
      demand(
        (!command.phone && !command.wechat) || command.consent,
        400,
        "登记联系方式前需确认已获得授权",
      );
      await put(tx, "customers", ws, {
        ...c,
        phone: command.phone,
        wechat: command.wechat,
        contactConsent: command.consent,
      });
      await audit(
        ctx,
        "更新授权沟通渠道",
        c.id,
        "联系方式已更新，审计记录不包含号码或微信号。",
      );
      break;
    }
    case "rule.compile": {
      allowed(ctx, ["admin", "supervisor", "manager"]);
      const product = await get<Product>(tx, "products", ws, command.productId);
      demand(product, 404, "产品不存在于当前工作空间");
      const rules = compilePolicy(command.text, command.name);
      demand(rules.length, 400, "没有可安全提取的简单年限规则");
      demand(
        (await rows(tx, "rules", ws)).length + rules.length <= 200,
        400,
        "规则数量已达上限",
      );
      for (const r of rules)
        await put(tx, "rules", ws, {
          ...r,
          id: randomUUID(),
          productId: command.productId,
          effective: chinaDate(),
        });
      await audit(
        ctx,
        "编译候选规则",
        `${rules.length} 条`,
        `产品 ${product.name}（${product.id}）；候选已入库，需提交审查后生效。`,
      );
      break;
    }
    case "rule.submit": {
      allowed(ctx, ["admin", "supervisor", "manager"]);
      const rule = await get<Rule>(tx, "rules", ws, command.ruleId);
      demand(rule?.status === "pending", 409, "规则不是待确认状态");
      demand(
        !(await rows<Review>(tx, "reviews", ws)).some(
          (r) =>
            r.kind === "rule" &&
            r.targetId === rule.id &&
            r.status === "pending",
        ),
        409,
        "该规则已有待审申请",
      );
      const id = randomUUID();
      await put(tx, "reviews", ws, {
        id,
        kind: "rule",
        targetId: rule.id,
        customerId: null,
        title: rule.title,
        status: "pending",
        submittedBy: ctx.user.id,
        submittedName: ctx.user.name,
        created: now(),
        comment: "",
        payload: {},
      } as Review);
      await reviewers(ctx, "规则变更等待审查", id);
      await audit(ctx, "提交规则审查", rule.id, "须由其他审查人员确认。");
      break;
    }
    case "brief.confirm": {
      const c = await customer(ctx, command.customerId, true);
      const current = currentCustomer(
        c,
        await rows<Strategy>(tx, "strategies", ws),
      );
      const product = await get<Product>(tx, "products", ws, command.productId);
      demand(product, 404, "产品不存在于当前工作空间");
      const rules = (await rows<Rule>(tx, "rules", ws)).filter(
        (r) => r.status === "active" && productIdOf(r) === command.productId,
      );
      const b: Brief = {
        productId: product.id,
        productName: product.name,
        id: randomUUID(),
        customerId: c.id,
        created: now(),
        actorId: ctx.user.id,
        actor: ctx.user.name,
        checklist: command.checklist,
        rules,
        hits: current.ruleHits!,
        customerSnapshot: current,
        score: opportunity(current).score,
      };
      await put(tx, "briefs", ws, b);
      await advance(ctx, c, Math.max(c.stage || 0, 1));
      await audit(
        ctx,
        "确认访前准备",
        c.id,
        `快照 ${b.id}；${b.hits.map((h) => h.id + " +" + h.points).join("，")}`,
      );
      result = b;
      break;
    }
    case "communication.add": {
      const c = await customer(ctx, command.customerId, true);
      const b = await get<Brief>(tx, "briefs", ws, command.briefId);
      demand(b && b.customerId === c.id, 409, "请先确认本客户的访前准备");
      const { type, ...data } = command;
      const record: Communication = {
        ...data,
        id: randomUUID(),
        created: now(),
        actor: ctx.user.name,
        actorId: ctx.user.id,
      };
      await put(tx, "communications", ws, record);
      if (command.outcome === "connected") {
        c.lastContactDate = chinaDate();
        c.lastContactDays = 0;
        await advance(ctx, c, Math.max(c.stage || 0, 2));
      }
      await audit(
        ctx,
        "登记沟通记录",
        c.id,
        `${command.channel} · ${command.outcome}；关联访前快照 ${b.id}`,
      );
      result = record;
      break;
    }
    case "visit.draft": {
      const c = await customer(ctx, command.customerId, true);
      const b = await get<Brief>(tx, "briefs", ws, command.briefId);
      demand(b && b.customerId === c.id, 409, "请先确认本客户的访前准备");
      demand(
        (await rows<Communication>(tx, "communications", ws)).some(
          (r) =>
            r.customerId === c.id &&
            r.briefId === b.id &&
            r.outcome === "connected",
        ),
        409,
        "请先保存已沟通记录，再生成访后归纳",
      );
      demand(
        !/\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b/.test(command.raw),
        400,
        "记录中疑似含敏感标识，请先脱敏",
      );
      const v: Visit = {
        id: randomUUID(),
        customerId: c.id,
        briefId: b.id,
        actorId: ctx.user.id,
        raw: command.raw,
        ...extractVisit(command.raw),
        channel: command.channel,
        confirmed: false,
        status: "draft",
        ruleSnapshot: b.rules,
        created: now(),
      };
      await put(tx, "visits", ws, v);
      await audit(
        ctx,
        "生成访后草稿",
        c.id,
        `关联访前快照 ${b.id}；原文提取，等待人工确认。`,
      );
      result = v;
      break;
    }
    case "visit.confirm": {
      const v = await get<Visit>(tx, "visits", ws, command.visitId);
      demand(v, 404, "纪要不存在");
      const c = await customer(ctx, v.customerId, true);
      demand(v.status === "draft", 409, "只有草稿可以确认，避免重复建立任务");
      demand(
        !command.nextAction || command.nextDate,
        400,
        "请填写下一步任务日期",
      );
      demand(
        !command.nextDate || command.nextDate >= chinaDate(),
        400,
        "跟进日期不能早于今天",
      );
      demand(
        !command.materialsComplete || !command.materials,
        400,
        "材料全部补齐时待补清单应为空",
      );
      const { type, ack, visitId, ...form } = command;
      await put(tx, "visits", ws, {
        ...v,
        ...form,
        confirmed: true,
        status: "confirmed",
      });
      if (form.demand) c.demand = form.demand;
      if (form.materialsComplete) c.missing = [];
      else if (form.materials)
        c.missing = form.materials
          .split(/[；;\n]/)
          .filter(Boolean)
          .slice(0, 20);
      await advance(ctx, c, Math.max(c.stage || 0, 3));
      if (form.nextAction && form.nextDate) {
        const t: Task = {
          id: `visit:${v.id}`,
          customerId: c.id,
          title: form.nextAction,
          due: form.nextDate,
          done: false,
          source: `纪要 ${v.id}`,
          assigneeId: c.ownerId || ctx.user.id,
        };
        await put(tx, "tasks", ws, t);
        await notice(
          ctx,
          t.assigneeId!,
          "新的访后跟进任务",
          `${c.id} · ${t.title}`,
          "task",
          c.id,
        );
      }
      await audit(
        ctx,
        "确认访后纪要",
        c.id,
        `纪要 ${v.id}；更新客户需求与待补材料；${form.nextAction ? "已生成关联任务" : "未约定后续任务"}。`,
      );
      break;
    }
    case "visit.submit": {
      const v = await get<Visit>(tx, "visits", ws, command.visitId);
      demand(v, 404, "纪要不存在");
      await customer(ctx, v.customerId, true);
      demand(
        ["confirmed", "rejected"].includes(v.status || ""),
        409,
        "请先确认纪要，待审或已通过记录不可重复提交",
      );
      const id = randomUUID();
      await put(tx, "reviews", ws, {
        id,
        kind: "visit",
        targetId: v.id,
        customerId: v.customerId,
        title: `${v.customerId} · 访后材料审查`,
        status: "pending",
        submittedBy: ctx.user.id,
        submittedName: ctx.user.name,
        created: now(),
        comment: "",
        payload: {},
      } as Review);
      await put(tx, "visits", ws, { ...v, status: "pending" });
      await reviewers(ctx, "访后纪要等待审查", id);
      await audit(ctx, "提交纪要审查", v.customerId, `纪要 ${v.id}`);
      break;
    }
    case "task.toggle": {
      const t = await get<Task>(tx, "tasks", ws, command.taskId);
      demand(t, 404, "任务不存在");
      const c = await customer(ctx, t.customerId, true);
      await put(tx, "tasks", ws, { ...t, done: command.done });
      const outstanding = (await rows<Task>(tx, "tasks", ws)).some(
        (x) => x.customerId === c.id && !x.done,
      );
      const approved = (await rows<Visit>(tx, "visits", ws)).some(
        (v) => v.customerId === c.id && v.status === "approved",
      );
      if (!outstanding && approved) await advance(ctx, c, 5);
      else if (c.stage === 5) await advance(ctx, c, 4);
      await audit(
        ctx,
        command.done ? "完成跟进任务" : "重新打开任务",
        t.customerId,
        t.title,
      );
      break;
    }
    case "transfer.request": {
      const c = await customer(ctx, command.customerId, true);
      const target = (await members(tx, ws)).find(
        (m) =>
          m.id === command.assigneeId &&
          m.active &&
          ["admin", "supervisor", "manager"].includes(m.role),
      );
      demand(target, 400, "接收人必须是本空间有效的业务成员");
      demand(c.ownerId !== target.id, 400, "该成员已是当前负责人");
      demand(
        !(await rows<Review>(tx, "reviews", ws)).some(
          (r) =>
            r.kind === "transfer" &&
            r.customerId === c.id &&
            r.status === "pending",
        ),
        409,
        "已有待审转派申请",
      );
      const id = randomUUID();
      await put(tx, "reviews", ws, {
        id,
        kind: "transfer",
        targetId: c.id,
        customerId: c.id,
        title: `${c.id} 转派给 ${target.name}`,
        status: "pending",
        submittedBy: ctx.user.id,
        submittedName: ctx.user.name,
        created: now(),
        comment: "",
        payload: {
          assigneeId: target.id,
          reason: command.reason,
          previousOwnerId: c.ownerId,
        },
      } as Review);
      await reviewers(ctx, "客户转派等待审查", id);
      await audit(
        ctx,
        "提交转派申请",
        c.id,
        `${target.name}；${command.reason}`,
      );
      break;
    }
    case "review.decide": {
      allowed(ctx, ["admin", "supervisor", "reviewer"]);
      const r = await get<Review>(tx, "reviews", ws, command.reviewId);
      demand(r?.status === "pending", 409, "申请已处理或不存在");
      demand(
        r.submittedBy !== ctx.user.id,
        403,
        "不能审查本人提交的申请，请交由其他审查人员",
      );
      if (r.kind === "transfer") allowed(ctx, ["admin", "supervisor"]);
      if (command.decision === "approved") {
        if (r.kind === "rule") {
          const all = await rows<Rule>(tx, "rules", ws);
          const chosen = all.find((x) => x.id === r.targetId);
          demand(chosen?.status === "pending", 409, "候选版本已变更");
          demand(
            !chosen.effective || chosen.effective <= chinaDate(),
            400,
            "尚未到生效日期",
          );
          for (const rule of all)
            if (
              rule.id === chosen.id ||
              (rule.status === "active" &&
                rule.field === chosen.field &&
                productIdOf(rule) === productIdOf(chosen))
            )
              await put(tx, "rules", ws, {
                ...rule,
                status: rule.id === chosen.id ? "active" : "archived",
              });
        }
        if (r.kind === "visit") {
          const v = await get<Visit>(tx, "visits", ws, r.targetId);
          demand(v?.status === "pending", 409, "纪要状态已变化");
          await put(tx, "visits", ws, { ...v, status: "approved" });
          const c = await customer(ctx, v.customerId);
          await advance(ctx, c, Math.max(c.stage || 0, 4));
        }
        if (r.kind === "transfer") {
          const c = await customer(ctx, r.targetId);
          demand(
            c.ownerId === r.payload.previousOwnerId,
            409,
            "客户负责人已变化，请重新申请",
          );
          const target = (await members(tx, ws)).find(
            (m) =>
              m.id === r.payload.assigneeId &&
              m.active &&
              ["admin", "supervisor", "manager"].includes(m.role),
          );
          demand(target, 409, "接收人已失效");
          await put(tx, "customers", ws, { ...c, ownerId: target.id });
          for (const t of await rows<Task>(tx, "tasks", ws))
            if (t.customerId === c.id && !t.done)
              await put(tx, "tasks", ws, { ...t, assigneeId: target.id });
          await notice(
            ctx,
            target.id,
            "收到转派客户",
            `${c.id} 及未完成任务已转入你的名下。`,
            "assignment",
            c.id,
          );
        }
      } else if (r.kind === "visit") {
        const v = await get<Visit>(tx, "visits", ws, r.targetId);
        if (v) await put(tx, "visits", ws, { ...v, status: "rejected" });
      }
      await put(tx, "reviews", ws, {
        ...r,
        status: command.decision,
        comment: command.comment,
        decidedBy: ctx.user.id,
        decidedAt: now(),
      });
      await notice(
        ctx,
        r.submittedBy,
        command.decision === "approved" ? "申请已通过" : "申请已退回",
        `${r.title}；${command.comment}`,
        "review",
        r.id,
      );
      await audit(
        ctx,
        command.decision === "approved" ? "审查通过" : "审查退回",
        r.customerId || r.targetId,
        `${r.kind}；${command.comment}`,
      );
      break;
    }
    case "notification.read": {
      const n = await get<Notification & { recipientId: string }>(
        tx,
        "notifications",
        ws,
        command.notificationId,
      );
      demand(n && n.recipientId === ctx.user.id, 404, "通知不存在");
      await put(tx, "notifications", ws, { ...n, read: true });
      break;
    }
    case "member.add": {
      allowed(ctx, ["admin"]);
      demand(!ctx.ws.demo, 403, "演示空间使用预置身份；正式空间可管理成员");
      demand((await members(tx, ws)).length < 50, 400, "成员数量已达上限");
      const id = randomUUID();
      const exists = await tx.query("SELECT id FROM users WHERE username=$1", [
        command.username.toLowerCase(),
      ]);
      demand(!exists.rowCount, 409, "用户名已存在，请使用唯一用户名");
      await tx.query(
        "INSERT INTO users(id,username,name,password_hash) VALUES($1,$2,$3,$4)",
        [
          id,
          command.username.toLowerCase(),
          command.name,
          await hashPassword(command.password),
        ],
      );
      await tx.query(
        "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3)",
        [ws, id, command.role],
      );
      await audit(ctx, "新增空间成员", command.name, command.role);
      break;
    }
    case "member.update": {
      allowed(ctx, ["admin"]);
      demand(!ctx.ws.demo, 403, "演示身份不可修改");
      const team = await members(tx, ws);
      const m = team.find((m) => m.id === command.userId);
      demand(m, 404, "成员不存在");
      if (
        m.role === "admin" &&
        m.active &&
        (command.role !== "admin" || !command.active)
      )
        demand(
          team.filter((x) => x.role === "admin" && x.active).length > 1,
          409,
          "至少保留一位有效管理员",
        );
      if (
        !command.active ||
        !["admin", "supervisor", "manager"].includes(command.role)
      )
        demand(
          !(await rows<Customer>(tx, "customers", ws)).some(
            (c) => c.ownerId === m.id,
          ),
          409,
          "请先转派该成员负责的客户",
        );
      await tx.query(
        "UPDATE memberships SET role=$3,active=$4 WHERE workspace_id=$1 AND user_id=$2",
        [ws, m.id, command.role, command.active],
      );
      await audit(
        ctx,
        "更新成员权限",
        m.name,
        `${command.role}；${command.active ? "启用" : "停用"}`,
      );
      if (m.id === ctx.user.id) {
        ctx.role = command.role;
        ctx.ws.role = command.role;
      }
      break;
    }
    case "audit.record": {
      if (command.action === "查看作战单") await customer(ctx, command.target);
      if (command.action === "导出审计")
        allowed(ctx, ["admin", "supervisor", "reviewer"]);
      await audit(
        ctx,
        command.action,
        command.target,
        "由后端记录当前身份与工作空间。",
      );
      break;
    }
  }
  await tx.query("UPDATE workspaces SET revision=revision+1 WHERE id=$1", [ws]);
  ctx.ws.revision++;
  return { result, state: await readState(ctx) };
}
