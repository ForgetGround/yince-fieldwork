export const DEMO_DATE = "2026-09-15";
export const PRODUCT = "经营流水类贷款（产品名称待核实）";
export type Customer = {
  ownerId?: string;
  ownerName?: string;
  stage?: number;
  maxStage?: number;
  maturityDate?: string | null;
  lastContactDate?: string;
  ruleHits?: import("./platform.ts").RuleHit[];
  phone?: string;
  wechat?: string;
  contactConsent?: boolean;
  id: string;
  industry: string;
  products: string[];
  operatingYears: number | null;
  experienceYears: number | null;
  fixedPlace: boolean | null;
  permits: boolean | null;
  stable: boolean | null;
  creditClear: boolean | null;
  amlClear: boolean | null;
  daysToMaturity: number | null;
  lastContactDays: number;
  settlementChange: number | null;
  demand: string;
  missing: string[];
  origin: string;
};
export type Rule = {
  id: string;
  title: string;
  field:
    | "operatingYears"
    | "experienceYears"
    | "fixedPlace"
    | "permits"
    | "stable"
    | "creditClear"
    | "amlClear"
    | "manual";
  operator: "gte" | "eq" | "review";
  value: number | boolean | null;
  excerpt: string;
  source: string;
  location: string;
  status: "active" | "pending" | "archived";
  version: string;
  effective: string | null;
  synthetic: boolean;
  note?: string;
  documentText?: string;
};
export type Task = {
  assigneeId?: string;
  assigneeName?: string;
  id: string;
  customerId: string;
  title: string;
  due: string;
  done: boolean;
  source: string;
};
export type Visit = {
  materialsComplete?: boolean;
  briefId?: string;
  actorId?: string;
  channel?: "phone" | "wechat" | "visit" | "other";
  status?: "draft" | "confirmed" | "pending" | "approved" | "rejected";
  id: string;
  customerId: string;
  raw: string;
  summary: string;
  demand: string;
  questions: string;
  materials: string;
  nextDate: string;
  nextAction: string;
  confirmed: boolean;
  ruleSnapshot: Rule[];
  created: string;
};
export type Audit = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};
export type State = {
  schema: 1;
  customers: Customer[];
  rules: Rule[];
  tasks: Task[];
  visits: Visit[];
  audit: Audit[];
};
const industries = [
  "批发和零售业",
  "制造业",
  "商贸服务业",
  "农副食品加工业",
  "商务服务业",
];
export function sampleCustomers(): Customer[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `KH-${String(i + 1).padStart(3, "0")}`,
    industry: industries[i % 5],
    products: i % 3 === 0 ? ["基本结算账户", "经营贷款"] : ["基本结算账户"],
    operatingYears: i === 11 ? null : i % 6 === 3 ? 1.5 : 3 + (i % 5),
    experienceYears: i % 4 === 0 ? 5 : null,
    fixedPlace: true,
    permits: i % 4 === 2 ? null : true,
    stable: i % 7 === 5 ? null : true,
    creditClear: null,
    amlClear: null,
    daysToMaturity:
      i === 0
        ? 45
        : i === 2
          ? 32
          : i === 6
            ? 18
            : i % 4 === 0
              ? 90 + i * 3
              : null,
    lastContactDays: i === 0 ? 12 : i === 7 ? 5 : i === 15 ? 96 : 8 + i * 5,
    settlementChange: i % 3 === 0 ? 8 : i % 3 === 1 ? 35 : -5,
    demand:
      i === 0
        ? "客户提到扩大采购计划，需核实续贷及流动资金需求。"
        : i === 7
          ? "客户表示希望补充流动资金，仍需提供经营流水。"
          : i === 11
            ? "客户提及旺季备货，需要核实具体金额和用款时间。"
            : i < 12 && i % 2 === 0
              ? "客户上次提及资金周转需求。"
              : "",
    missing:
      i === 7
        ? ["近 6 个月经营流水", "采购合同"]
        : i === 11
          ? ["营业执照及经营年限证明"]
          : [],
    origin: "模拟客户集 · 2026-09-15",
  }));
}
export const initialRules: Rule[] = [
  {
    id: "R-001",
    title: "企业持续经营满 1 年",
    field: "operatingYears",
    operator: "gte",
    value: 1,
    excerpt: "成立持续稳定经营1年以上；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（1）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
    note: "演示比较符为 ≥；“1年以上”的正式口径、生效日期及产品名称待业务确认。",
  },
  {
    id: "R-008",
    title: "企业持续稳定经营",
    field: "stable",
    operator: "eq",
    value: true,
    excerpt: "成立持续稳定经营1年以上；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（1）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
    note: "稳定经营为独立条件，不以企业成立年限代替。",
  },
  {
    id: "R-002",
    title: "具备固定生产经营场所",
    field: "fixedPlace",
    operator: "eq",
    value: true,
    excerpt: "有固定的生产经营场所，有真实、有效、齐全的生产、经营证照；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（2）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
  },
  {
    id: "R-003",
    title: "生产经营证照真实、有效、齐全",
    field: "permits",
    operator: "eq",
    value: true,
    excerpt: "有固定的生产经营场所，有真实、有效、齐全的生产、经营证照；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（2）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
  },
  {
    id: "R-004",
    title: "核心经营人员原则上具备 2 年从业经验",
    field: "experienceYears",
    operator: "gte",
    value: 2,
    excerpt:
      "企业实际控制人、核心经营管理人员或控股股东原则上具备2年（含）以上从业经验；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（4）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
    note: "原则性条件；例外需人工复核，不直接判定禁入。",
  },
  {
    id: "R-005",
    title: "企业及实际控制人信用记录良好",
    field: "creditClear",
    operator: "eq",
    value: true,
    excerpt: "企业及其实际控制人信用记录良好，企业实际控制人无不良嗜好；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（5）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
    note: "“不良嗜好”不作机器推断；仅核查已授权的信用结论汇总字段。",
  },
  {
    id: "R-006",
    title: "反洗钱与反恐怖融资核查",
    field: "amlClear",
    operator: "eq",
    value: true,
    excerpt: "借款人不涉及洗钱及恐怖融资行为，不涉及洗钱案件；",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（6）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
  },
  {
    id: "R-007",
    title: "其他条件及合法合规经营需人工复核",
    field: "manual",
    operator: "review",
    value: null,
    excerpt:
      "信用良好，生产经营合法合规，无违反法律、法规及不良信用记录；九江银行规定的其他条件。",
    source: "用户提供的产品申请条件截图",
    location: "截图 3 · 申请条件（3）、（8）",
    status: "active",
    version: "v1.0",
    effective: null,
    synthetic: false,
    note: "截图未列出第（7）项；额度、期限、禁入行业、完整材料清单未提供，均不可补造。",
  },
  {
    id: "R-DEMO-002",
    title: "企业持续经营年限调整为满 2 年",
    field: "operatingYears",
    operator: "gte",
    value: 2,
    excerpt:
      "【模拟通知】本演示将企业持续经营年限调整为不少于2年，自2026年9月15日起生效。其他条件不变。",
    source: "模拟业务通知 · 仅用于版本冲突演示",
    location: "第 1 段",
    status: "pending",
    version: "v2.0-demo",
    effective: DEMO_DATE,
    synthetic: true,
  },
];
export function initialState(): State {
  return {
    schema: 1,
    customers: sampleCustomers(),
    rules: initialRules.map((r) => ({ ...r })),
    tasks: [
      {
        id: "T-1",
        customerId: "KH-001",
        title: "核实采购融资需求",
        due: DEMO_DATE,
        done: false,
        source: "模拟任务",
      },
      {
        id: "T-2",
        customerId: "KH-008",
        title: "跟进经营流水补充",
        due: DEMO_DATE,
        done: false,
        source: "模拟任务",
      },
      ...["KH-003", "KH-007", "KH-012", "KH-016"].map((id, i) => ({
        id: `T-${i + 3}`,
        customerId: id,
        title: i < 2 ? "核实贷款到期安排" : "确认客户经营近况",
        due: `2026-09-${16 + i}`,
        done: false,
        source: "模拟任务",
      })),
    ],
    visits: [],
    audit: [
      {
        id: "A-SEED",
        time: "2026-09-15T01:00:00.000Z",
        actor: "演示系统",
        action: "初始化演示",
        target: "20 位模拟客户",
        detail: "载入来源标注与 v1.0 演示规则；并非已确认的银行正式制度。",
      },
    ],
  };
}
export function signals(c: Customer) {
  if (c.ruleHits) return c.ruleHits;
  const s = [
    {
      label: "基础联系权重",
      points: 20,
      evidence: "所有客户统一基线；演示策略 S-00",
    },
  ];
  if (
    c.daysToMaturity !== null &&
    c.daysToMaturity >= 0 &&
    c.daysToMaturity <= 45
  )
    s.push({
      label: "45 天内到期",
      points: 35,
      evidence: `距贷款到期 ${c.daysToMaturity} 天 · 贷款汇总字段 · S-01`,
    });
  if (c.demand.trim())
    s.push({
      label: "已记录潜在需求",
      points: 25,
      evidence: `${c.demand} · 客户经理记录 · S-02`,
    });
  if (c.missing.length)
    s.push({
      label: "材料待补充",
      points: 18,
      evidence: `${c.missing.join("、")} · 待办信息 · S-03`,
    });
  if (c.stable === true)
    s.push({
      label: "经营持续稳定",
      points: 12,
      evidence: "稳定经营标识为是 · 客户汇总字段 · S-04",
    });
  if (c.lastContactDays >= 90)
    s.push({
      label: "长时间未联系",
      points: 20,
      evidence: `距上次联系 ${c.lastContactDays} 天 · 联系记录 · S-05`,
    });
  return s;
}
export function opportunity(c: Customer) {
  const score = Math.min(
    100,
    signals(c).reduce((a, b) => a + b.points, 0),
  );
  const type =
    c.daysToMaturity !== null && c.daysToMaturity >= 0 && c.daysToMaturity <= 45
      ? "续贷服务"
      : c.missing.length
        ? "材料补充"
        : c.demand
          ? "需求核实"
          : "客户维护";
  const reason =
    type === "续贷服务"
      ? `经营贷 ${c.daysToMaturity} 天后到期${c.demand ? " · 有经营资金安排待核实" : ""}`
      : type === "材料补充"
        ? `融资需求待核实 · 待补${c.missing[0]}`
        : type === "需求核实"
          ? c.demand
          : `距上次联系 ${c.lastContactDays} 天 · 核实近期经营情况`;
  return {
    score,
    type,
    reason,
    color:
      type === "续贷服务"
        ? "teal"
        : type === "材料补充"
          ? "amber"
          : type === "需求核实"
            ? "blue"
            : "gray",
  };
}
export function ranked(customers: Customer[]) {
  return [...customers].sort(
    (a, b) =>
      opportunity(b).score - opportunity(a).score || a.id.localeCompare(b.id),
  );
}
export function evaluateRule(
  c: Customer,
  r: Rule,
): "pass" | "fail" | "unknown" {
  if (r.status !== "active" || r.field === "manual") return "unknown";
  const v = c[r.field];
  if (v === null || v === undefined) return "unknown";
  if (r.operator === "gte")
    return typeof v === "number" && typeof r.value === "number"
      ? v >= r.value
        ? "pass"
        : "fail"
      : "unknown";
  return v === r.value ? "pass" : "fail";
}
export function activateRule(rules: Rule[], id: string): Rule[] {
  const selected = rules.find((r) => r.id === id);
  if (!selected || selected.status !== "pending")
    throw Error("该规则不处于待确认状态");
  if (selected.effective && selected.effective > DEMO_DATE)
    throw Error("该规则尚未到演示基准日，不能生效");
  return rules.map((r) =>
    r.id === id
      ? { ...r, status: "active" }
      : r.field === selected.field && r.status === "active"
        ? { ...r, status: "archived" }
        : r,
  );
}
export function compilePolicy(text: string, name: string): Rule[] {
  if (!text.trim() || text.length > 30000)
    throw Error("请输入 1–30,000 字的制度文本");
  const sentences = text
    .split(/\n|[。；;]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: Rule[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const line = sentences[i];
    const normalized = line.replace(/[一二三四五六七八九十]/g, (x) =>
      String("零一二三四五六七八九十".indexOf(x)),
    );
    const match = normalized.match(
      /(?:企业)?(?:成立|持续经营|稳定经营|经营年限|经营时间)[^\d]{0,16}(\d+(?:\.\d+)?)\s*年/,
    );
    if (
      match &&
      /不少于|至少|满|≥|>=/.test(line) &&
      !/实际控制人|股东|核心团队|从业|或者|或|除外|不适用|无需|不要求|不超过|至多|不足|未满|超过|大于|小于|以上|以下/.test(
        line,
      )
    ) {
      out.push({
        id: `R-UP-${Date.now()}-${i}`,
        title: `企业经营年限 ≥ ${match[1]} 年（候选）`,
        field: "operatingYears",
        operator: "gte",
        value: Number(match[1]),
        excerpt: line,
        documentText: text,
        source: name || "导入制度",
        location: `文本分段 ${i + 1}`,
        status: "pending",
        version: `v-import-${Date.now()}`,
        effective: null,
        synthetic: true,
        note: "模板解析候选；比较符、适用范围、生效日期需人工核对。复杂例外及其他段落不自动编译。",
      });
    }
  }
  return out;
}
export function extractVisit(raw: string) {
  const parts = raw
    .split(/[。\n；;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const match = (re: RegExp) => parts.filter((s) => re.test(s)).join("；");
  const dated = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] || "";
  return {
    summary: parts.slice(0, 3).join("；"),
    demand: match(/需求|需要|希望|计划/),
    questions: match(/疑问|担心|询问|咨询|利率|是否|费用/),
    materials: match(/待补|缺少|尚缺|提供|补充|还缺/),
    nextDate:
      dated &&
      Number.isFinite(Date.parse(dated)) &&
      new Date(dated).toISOString().slice(0, 10) === dated
        ? dated
        : "",
    nextAction: match(/下次|跟进|回访|再次|联系|约定/),
  };
}
const allowed = [
  "id",
  "industry",
  "products",
  "operatingYears",
  "experienceYears",
  "fixedPlace",
  "permits",
  "stable",
  "creditClear",
  "amlClear",
  "daysToMaturity",
  "lastContactDays",
  "settlementChange",
  "demand",
  "missing",
];
export function validateCustomers(value: unknown): Customer[] {
  if (!Array.isArray(value) || !value.length || value.length > 500)
    throw Error("请导入 1–500 位客户的 JSON 数组");
  const ids = new Set<string>();
  return value.map((v, i) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error(`第 ${i + 1} 行不是客户对象`);
    const o = v as Record<string, unknown>;
    const extra = Object.keys(o).filter((k) => !allowed.includes(k));
    if (extra.length)
      throw Error(
        `第 ${i + 1} 行含不支持字段：${extra.join("、")}。仅允许脱敏业务特征。`,
      );
    if (typeof o.id !== "string" || !/^KH-\d{3,6}$/.test(o.id) || ids.has(o.id))
      throw Error(`第 ${i + 1} 行客户编号需为唯一 KH-数字（3–6 位）`);
    ids.add(o.id);
    if (
      typeof o.industry !== "string" ||
      !o.industry.trim() ||
      o.industry.length > 80
    )
      throw Error(`第 ${i + 1} 行行业缺失或过长`);
    if (
      typeof o.lastContactDays !== "number" ||
      !Number.isInteger(o.lastContactDays) ||
      o.lastContactDays < 0 ||
      o.lastContactDays > 36500
    )
      throw Error(`第 ${i + 1} 行 lastContactDays 需为有效非负天数`);
    const c: Customer = {
      id: o.id,
      industry: o.industry,
      products: [],
      operatingYears: null,
      experienceYears: null,
      fixedPlace: null,
      permits: null,
      stable: null,
      creditClear: null,
      amlClear: null,
      daysToMaturity: null,
      lastContactDays: o.lastContactDays,
      settlementChange: null,
      demand: "",
      missing: [],
      origin: "本机导入 · 以演示基准日计",
    };
    for (const k of [
      "operatingYears",
      "experienceYears",
      "daysToMaturity",
      "settlementChange",
    ] as const) {
      const x = o[k];
      if (
        x !== undefined &&
        x !== null &&
        (typeof x !== "number" ||
          !Number.isFinite(x) ||
          Math.abs(x) > 36500 ||
          (k !== "daysToMaturity" && k !== "settlementChange" && x < 0))
      )
        throw Error(`第 ${i + 1} 行 ${k} 需为数字或 null`);
      c[k] = (x ?? null) as number | null;
    }
    for (const k of [
      "fixedPlace",
      "permits",
      "stable",
      "creditClear",
      "amlClear",
    ] as const) {
      if (o[k] !== undefined && o[k] !== null && typeof o[k] !== "boolean")
        throw Error(`第 ${i + 1} 行 ${k} 需为 true、false 或 null`);
      c[k] = (o[k] ?? null) as boolean | null;
    }
    for (const k of ["products", "missing"] as const) {
      if (
        o[k] !== undefined &&
        (!Array.isArray(o[k]) ||
          (o[k] as unknown[]).some(
            (x) => typeof x !== "string" || x.length > 150,
          ))
      )
        throw Error(`第 ${i + 1} 行 ${k} 需为文本数组`);
      c[k] = (o[k] || []) as string[];
    }
    if (
      o.demand !== undefined &&
      (typeof o.demand !== "string" || o.demand.length > 2000)
    )
      throw Error(`第 ${i + 1} 行 demand 需为 2,000 字以内文本`);
    c.demand = (o.demand || "") as string;
    if (
      /\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b/.test(
        [c.industry, c.demand, ...c.products, ...c.missing].join(" "),
      )
    )
      throw Error(`第 ${i + 1} 行疑似含手机号或身份证号，请先脱敏`);
    return c;
  });
}
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
