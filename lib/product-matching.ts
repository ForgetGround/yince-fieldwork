import {
  evaluateRule,
  opportunity,
  type Customer,
  type Rule,
  PRODUCT,
} from "./workbench.ts";
import type { Product } from "./platform.ts";
export const LEGACY_PRODUCT_ID = "PRODUCT-CASHFLOW";
export const productIdOf = (rule: Rule) => rule.productId || LEGACY_PRODUCT_ID;
export const matchLabels = {
  candidate: "基础条件匹配",
  needsInfo: "信息待补充",
  mismatch: "已知条件不符",
};
export type ProductMatch = {
  customerId: string;
  productId: string;
  status: keyof typeof matchLabels;
  passed: number;
  total: number;
  unknown: number;
  failed: number;
  manual: number;
  checks: {
    ruleId: string;
    title: string;
    status: "pass" | "fail" | "unknown";
    fact: string;
    version: string;
  }[];
};
export function ruleFact(c: Customer, r: Rule): string {
  if (r.field === "manual") return "需人工核实原文中的适用范围、例外与材料";
  if (r.field === "operatingOrExperienceYears")
    return `企业经营 ${c.operatingYears ?? "未知"} 年；主要经营人员经验 ${c.experienceYears ?? "未知"} 年`;
  const v = c[r.field];
  return v === null || v === undefined
    ? "尚未提供"
    : typeof v === "boolean"
      ? v
        ? "是"
        : "否"
      : String(v);
}
export function matchProduct(
  productId: string,
  customers: Customer[],
  rules: Rule[],
): ProductMatch[] {
  const scoped = rules.filter(
    (r) => productIdOf(r) === productId && r.status === "active",
  );
  return customers
    .map((c) => {
      const checks = scoped.map((r) => ({
        ruleId: r.id,
        title: r.title,
        status: evaluateRule(c, r),
        fact: ruleFact(c, r),
        version: r.version,
      }));
      const auto = scoped.filter((r) => r.field !== "manual");
      const passed = auto.filter((r) => evaluateRule(c, r) === "pass").length;
      const failed = auto.filter((r) => evaluateRule(c, r) === "fail").length;
      const unknown = auto.length - passed - failed;
      return {
        customerId: c.id,
        productId,
        status: failed
          ? "mismatch"
          : unknown || !auto.length
            ? "needsInfo"
            : "candidate",
        passed,
        total: auto.length,
        unknown,
        failed,
        manual: scoped.length - auto.length,
        checks,
      } as ProductMatch;
    })
    .sort((a, b) => {
      const ranks = { candidate: 0, needsInfo: 1, mismatch: 2 };
      return (
        ranks[a.status] - ranks[b.status] ||
        b.passed - a.passed ||
        opportunity(customers.find((c) => c.id === b.customerId)!).score -
          opportunity(customers.find((c) => c.id === a.customerId)!).score ||
        a.customerId.localeCompare(b.customerId)
      );
    });
}
export const legacyProduct: Product = {
  id: LEGACY_PRODUCT_ID,
  name: PRODUCT,
  description:
    "原有申请条件截图对应的经营流水类贷款，保留为待核实产品，不套用于其他产品。",
  audience: "依法成立的小微企业；适用地区与具体产品名称待核实。",
  feature: "经营流水分析",
  amount: "未提供",
  conditions: "沿用原截图的申请条件及后续候选规则，需核实完整制度。",
  process: "待核实",
  term: "未提供",
  rate: "历史截图未核实现行有效性",
  guarantee: "待核实",
  row: 0,
};
export function productRules(products: Product[]): Rule[] {
  const out: Rule[] = [];
  for (const p of products) {
    const add = (
      suffix: string,
      title: string,
      field: Rule["field"],
      operator: Rule["operator"],
      value: Rule["value"],
      excerpt: string,
      col = "H",
    ) =>
      out.push({
        id: `${p.id}-${suffix}`,
        productId: p.id,
        title,
        field,
        operator,
        value,
        excerpt,
        source: "P020250723600413272167.et",
        location: `Sheet1!${col
          .split(":")
          .map((c) => c + p.row)
          .join(":")}`,
        status: "active",
        version: "product-v1.0",
        effective: null,
        synthetic: false,
        note: "历史产品资料的基础核查规则；现行有效性、适用分支及例外需人工确认，非授信结论。",
      });
    if (p.id === "PRODUCT-3") {
      add(
        "YEARS",
        "企业经营满 1 年",
        "operatingYears",
        "gte",
        1,
        "经营时间在一年（含）以上",
        "E",
      );
      add(
        "PLACE",
        "具备固定经营场所",
        "fixedPlace",
        "eq",
        true,
        "有固定经营场所",
        "E",
      );
      add("STABLE", "生产经营正常", "stable", "eq", true, "生产经营正常", "E");
      add(
        "TAX",
        "近一年足额缴税且无不良纳税记录",
        "taxCompliant",
        "eq",
        true,
        "近1年按时足额缴税，无不良纳税记录",
      );
      add(
        "GRADE",
        "纳税信用 A / B / C，M 级不准入",
        "taxGrade",
        "in",
        ["A", "B", "C"],
        "纳税信用级别不低于C级（含C级，M级暂不准入）",
      );
      add(
        "MANUAL",
        "核实法人及实控人年龄和完整准入条件",
        "manual",
        "review",
        null,
        p.audience + "\n" + p.conditions,
        "E:H",
      );
    } else if (p.id === "PRODUCT-4") {
      add(
        "AWARD",
        "具备采购推荐或政府采购中标线索",
        "procurementAward",
        "eq",
        true,
        p.audience,
        "E",
      );
      add(
        "YEARS",
        "企业经营或主要经营人员经验满 1 年",
        "operatingOrExperienceYears",
        "gte",
        1,
        "企业有1年（含）以上持续经营历史，或主要股东、实际控制人具备1年（含）以上本办法经营经验",
      );
      add(
        "MANUAL",
        "核实供应商身份、合同真实性与回款安排",
        "manual",
        "review",
        null,
        p.conditions + "\n" + p.process,
        "H:I",
      );
    } else if (p.id === "PRODUCT-5") {
      add(
        "YEARS",
        "企业持续经营满 3 年",
        "operatingYears",
        "gte",
        3,
        "企业成立且持续经营三年以上",
      );
      add(
        "ENTITY",
        "具有独立法人资格",
        "legalEntity",
        "eq",
        true,
        "具有独立法人资格",
        "E",
      );
      add(
        "IP",
        "企业拥有自主知识产权",
        "hasIP",
        "eq",
        true,
        "拥有自主知识产权的企业",
        "E",
      );
      add(
        "MANUAL",
        "核实纳税收入、财务及知识产权质押条件",
        "manual",
        "review",
        null,
        p.conditions,
      );
    } else if (p.id === "PRODUCT-6") {
      add(
        "YEARS",
        "企业成立满 1 年，核实持续经营情况",
        "operatingYears",
        "gte",
        1,
        "企业成立1年以上",
      );
      add(
        "COMMERCIAL",
        "科技成果已实现转化并具有盈利能力",
        "techCommercialized",
        "eq",
        true,
        "企业所具有的科学技术原则上在市场上实现了成果转化，具有盈利能力",
      );
      add(
        "MANUAL",
        "核实核心技术权属、团队及行业领先性",
        "manual",
        "review",
        null,
        p.conditions,
      );
    } else if (p.id === "PRODUCT-7") {
      // 不把九融贷不同客群、信用评分和存量业务例外压成统一拒绝规则。
      add(
        "MANUAL",
        "按企业／个体经营者／农户分支核实准入",
        "manual",
        "review",
        null,
        p.conditions,
      );
      add(
        "TRADE",
        "核实真实贸易背景、担保额度及机构",
        "manual",
        "review",
        null,
        p.amount + "\n" + p.description,
        "D:G",
      );
    }
  }
  return out;
}
export function mockProductFeatures(index: number): Partial<Customer> {
  return {
    taxGrade:
      index % 5 === 0
        ? "A"
        : index % 5 === 1
          ? "B"
          : index % 5 === 2
            ? "M"
            : null,
    taxCompliant: index % 4 === 0 ? true : index % 4 === 1 ? false : null,
    procurementAward: index % 4 === 2 ? true : index % 4 === 0 ? false : null,
    legalEntity: true,
    hasIP: index % 3 === 0 ? true : index % 3 === 1 ? false : null,
    techCommercialized: index % 4 === 0 ? true : index % 4 === 1 ? false : null,
  };
}
