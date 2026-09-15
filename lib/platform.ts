import type { Customer, Rule, State, Visit } from "./workbench.ts";

export type Role = "admin" | "supervisor" | "manager" | "reviewer" | "viewer";
export const roleNames: Record<Role, string> = {
  admin: "管理员",
  supervisor: "团队主管",
  manager: "客户经理",
  reviewer: "审查员",
  viewer: "只读成员",
};
export const stages = [
  "已建档",
  "访前已准备",
  "已沟通",
  "纪要已确认",
  "审查已通过",
  "跟进已完成",
];
export type Member = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
};
export type Workspace = {
  id: string;
  name: string;
  role: Role;
  demo: boolean;
  expiresAt: string | null;
  revision: number;
};
export type Session = {
  user: { id: string; name: string; username: string };
  csrf: string;
  workspaces: Workspace[];
  demoWorkspaceId: string | null;
};
export type Strategy = {
  id: string;
  title: string;
  field: string;
  operator: "always" | "between" | "nonempty" | "eq" | "gte";
  value: number | boolean | number[] | null;
  points: number;
  condition: string;
  version: string;
};
export type RuleHit = {
  id: string;
  version: string;
  label: string;
  condition: string;
  field: string;
  actual: string;
  points: number;
  evidence: string;
};
export type Brief = {
  id: string;
  customerId: string;
  created: string;
  actorId: string;
  actor: string;
  checklist: string[];
  rules: Rule[];
  hits: RuleHit[];
  customerSnapshot: Customer;
  score: number;
};
export type Communication = {
  id: string;
  customerId: string;
  briefId: string;
  channel: "phone" | "wechat" | "visit" | "other";
  outcome: "connected" | "unanswered" | "scheduled";
  content: string;
  created: string;
  actor: string;
  actorId: string;
};
export type Review = {
  id: string;
  kind: "rule" | "visit" | "transfer";
  targetId: string;
  customerId: string | null;
  title: string;
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  submittedName: string;
  created: string;
  comment: string;
  decidedBy?: string;
  decidedAt?: string;
  payload: Record<string, unknown>;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  target: string;
  created: string;
  read: boolean;
  kind: "review" | "task" | "assignment" | "reminder";
};
export type Product = {
  id: string;
  name: string;
  description: string;
  audience: string;
  feature: string;
  amount: string;
  conditions: string;
  process: string;
  term: string;
  rate: string;
  guarantee: string;
  row: number;
};
export type PlatformState = State & {
  products: Product[];
  referenceDate: string;
  workspace: Workspace;
  members: Member[];
  briefs: Brief[];
  communications: Communication[];
  reviews: Review[];
  notifications: Notification[];
  strategies: Strategy[];
};
export type PlatformVisit = Visit & {
  briefId?: string;
  channel?: Communication["channel"];
  actorId?: string;
  status?: "draft" | "confirmed" | "pending" | "approved" | "rejected";
};
export const initialStrategies: Strategy[] = [
  {
    id: "S-00",
    title: "基础联系权重",
    field: "id",
    operator: "always",
    value: null,
    points: 20,
    condition: "客户已建档",
    version: "strategy-v1.0",
  },
  {
    id: "S-01",
    title: "45 天内到期",
    field: "daysToMaturity",
    operator: "between",
    value: [0, 45],
    points: 35,
    condition: "0 ≤ 距到期天数 ≤ 45",
    version: "strategy-v1.0",
  },
  {
    id: "S-02",
    title: "已记录潜在需求",
    field: "demand",
    operator: "nonempty",
    value: null,
    points: 25,
    condition: "需求记录非空，需核实真实意愿",
    version: "strategy-v1.0",
  },
  {
    id: "S-03",
    title: "材料待补充",
    field: "missing",
    operator: "nonempty",
    value: null,
    points: 18,
    condition: "待补材料数量 > 0",
    version: "strategy-v1.0",
  },
  {
    id: "S-04",
    title: "经营持续稳定",
    field: "stable",
    operator: "eq",
    value: true,
    points: 12,
    condition: "稳定经营字段 = 是",
    version: "strategy-v1.0",
  },
  {
    id: "S-05",
    title: "长时间未联系",
    field: "lastContactDays",
    operator: "gte",
    value: 90,
    points: 20,
    condition: "距最近联系 ≥ 90 天",
    version: "strategy-v1.0",
  },
];
export function strategyHits(c: Customer, strategies: Strategy[]): RuleHit[] {
  return strategies.flatMap((s) => {
    const actual = (c as unknown as Record<string, unknown>)[s.field];
    if (actual === null || actual === undefined) return [];
    const hit =
      s.operator === "always" ||
      (s.operator === "between" &&
        typeof actual === "number" &&
        Array.isArray(s.value) &&
        actual >= s.value[0] &&
        actual <= s.value[1]) ||
      (s.operator === "nonempty" &&
        (typeof actual === "string"
          ? !!actual.trim()
          : Array.isArray(actual) && actual.length > 0)) ||
      (s.operator === "eq" && actual === s.value) ||
      (s.operator === "gte" &&
        typeof actual === "number" &&
        typeof s.value === "number" &&
        actual >= s.value);
    if (!hit) return [];
    const value =
      typeof actual === "boolean"
        ? actual
          ? "是"
          : "否"
        : Array.isArray(actual)
          ? actual.join("、")
          : String(actual);
    return [
      {
        id: s.id,
        version: s.version,
        label: s.title,
        condition: s.condition,
        field: s.field,
        actual: value,
        points: s.points,
        evidence: `${({ daysToMaturity: "距到期天数", demand: "需求记录", missing: "待补材料", stable: "经营稳定", settlementChange: "结算变化百分比", lastContactDays: "距最近联系天数", id: "客户编号" } as Record<string, string>)[s.field] || s.field} = ${value} · ${s.id} · ${s.version}`,
      },
    ];
  });
}
export function priorityLevel(score: number) {
  return score >= 85
    ? { className: "priority-high", label: "高优先级" }
    : score >= 60
      ? { className: "priority-medium", label: "优先联系" }
      : { className: "priority-normal", label: "常规维护" };
}
export function sceneTags(c: Customer) {
  return [
    c.daysToMaturity !== null && c.daysToMaturity < 0
      ? "已过到期日"
      : c.daysToMaturity !== null && c.daysToMaturity <= 15
        ? "15 天内到期"
        : c.daysToMaturity !== null && c.daysToMaturity <= 45
          ? "续贷窗口"
          : "",
    c.missing.length ? "待补材料" : "",
    c.demand ? "需求待核实" : "",
    c.lastContactDays >= 90 ? "长期未联系" : "",
    c.settlementChange !== null && c.settlementChange >= 30 ? "结算增长" : "",
  ].filter(Boolean);
}
export function chinaDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400_000)
    .toISOString()
    .slice(0, 10);
}
export function dateDiff(date: string, base: string) {
  return Math.round(
    (Date.parse(date + "T00:00:00Z") - Date.parse(base + "T00:00:00Z")) /
      86400_000,
  );
}
