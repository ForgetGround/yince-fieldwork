import { test } from "node:test";
import assert from "node:assert/strict";
import products from "../data/products.json" with { type: "json" };
import {
  matchProduct,
  productRules,
  LEGACY_PRODUCT_ID,
  productIdOf,
  mockProductFeatures,
} from "../lib/product-matching.ts";
import {
  sampleCustomers,
  evaluateRule,
  activateRule,
  initialRules,
  validateCustomers,
  type Rule,
} from "../lib/workbench.ts";
const catalog = products.map((p) => ({ ...p, id: `PRODUCT-${p.row}` }));
const rules = productRules(catalog);
const base = {
  ...sampleCustomers()[0],
  ...mockProductFeatures(0),
  operatingYears: 2,
  fixedPlace: true,
  stable: true,
};
test("匹配按产品独立计算；税易贷符合不代表智享贷符合", () => {
  assert.equal(matchProduct("PRODUCT-3", [base], rules)[0].status, "candidate");
  assert.equal(matchProduct("PRODUCT-5", [base], rules)[0].status, "mismatch");
  assert.ok(
    matchProduct("PRODUCT-3", [base], rules)[0].checks.every((c) =>
      c.ruleId.startsWith("PRODUCT-3-"),
    ),
  );
});
test("未知信息不作通过，税务 M 级与 false 是不符合", () => {
  assert.equal(
    matchProduct("PRODUCT-3", [{ ...base, taxGrade: null }], rules)[0].status,
    "needsInfo",
  );
  assert.equal(
    matchProduct("PRODUCT-3", [{ ...base, taxGrade: "M" }], rules)[0].status,
    "mismatch",
  );
  assert.equal(
    matchProduct("PRODUCT-3", [{ ...base, taxCompliant: false }], rules)[0]
      .status,
    "mismatch",
  );
});
test("政采贷经营或人员经验满足其一可通过，两个未知不通过", () => {
  const r = rules.find((r) => r.id === "PRODUCT-4-YEARS")!;
  assert.equal(
    evaluateRule({ ...base, operatingYears: null, experienceYears: 2 }, r),
    "pass",
  );
  assert.equal(
    evaluateRule({ ...base, operatingYears: 0, experienceYears: null }, r),
    "unknown",
  );
  assert.equal(
    evaluateRule({ ...base, operatingYears: 0, experienceYears: 0 }, r),
    "fail",
  );
});
test("含复杂分支的九融贷只提示人工核查，无规则不会假匹配", () => {
  const m = matchProduct("PRODUCT-7", [base], rules)[0];
  assert.equal(m.status, "needsInfo");
  assert.equal(m.total, 0);
  assert.equal(m.manual, 2);
  assert.equal(matchProduct("missing", [base], rules)[0].status, "needsInfo");
});
test("候选及历史规则不进入匹配；更改某产品版本不归档其他产品", () => {
  const chosen = {
    ...rules[0],
    id: "new",
    value: 4,
    status: "pending",
  } as Rule;
  const activated = activateRule([...rules, chosen], "new");
  assert.equal(
    activated.find((r) => r.id === "PRODUCT-3-YEARS")!.status,
    "archived",
  );
  assert.equal(
    activated.find((r) => r.id === "PRODUCT-5-YEARS")!.status,
    "active",
  );
  assert.equal(
    matchProduct("PRODUCT-3", [base], [...rules, chosen])[0].status,
    "candidate",
  );
});
test("来源坐标和旧规则归属可追溯；科企融不误将团队知识产权判为企业不符", () => {
  assert.equal(productIdOf(initialRules[0]), LEGACY_PRODUCT_ID);
  assert.ok(rules.every((r) => /^Sheet1![A-L]\d(:[A-L]\d)?$/.test(r.location)));
  assert.equal(
    matchProduct(
      "PRODUCT-6",
      [{ ...base, hasIP: false, techCommercialized: true }],
      rules,
    )[0].status,
    "candidate",
  );
});
test("导入校验保留匹配字段并拒绝无效枚举", () => {
  const { origin, ...input } = base;
  const result = validateCustomers([input]);
  assert.equal(result[0].taxGrade, "A");
  assert.throws(() => validateCustomers([{ ...input, taxGrade: "Z" }]));
  assert.throws(() => validateCustomers([{ ...input, taxCompliant: "yes" }]));
});
