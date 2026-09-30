import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validLocation,
  distanceKm,
  nearbyCustomers,
  navigationUrl,
  visitPrompts,
  canManageProductRules,
  canReviewProductRules,
  type CustomerLocation,
} from "../lib/fieldwork.ts";
import { sampleCustomers, initialRules } from "../lib/workbench.ts";
const a: CustomerLocation = {
  region: "测试区域",
  address: "测试位置",
  longitude: 116,
  latitude: 29,
  coordinateSystem: "GCJ02",
  consent: true,
};
test("坐标校验拒绝缺失、非数值、越界及其他坐标系", () => {
  assert.equal(validLocation(undefined), false);
  assert.equal(validLocation(a), true);
  assert.equal(validLocation({ ...a, longitude: NaN }), false);
  assert.equal(validLocation({ ...a, latitude: 91 }), false);
  assert.equal(
    validLocation({
      ...a,
      coordinateSystem: "WGS84",
    } as unknown as CustomerLocation),
    false,
  );
});
test("附近筛选保留权限范围输入、排除未知地点，距离对称且零点有效", () => {
  const base = sampleCustomers();
  const cs = [
    { ...base[0], location: a },
    { ...base[1], location: { ...a, longitude: 116.01 } },
    { ...base[2], location: { ...a, longitude: 117 } },
    base[3],
  ];
  assert.equal(distanceKm(a, a), 0);
  assert.ok(distanceKm(a, cs[1].location!) < 1.1);
  assert.equal(distanceKm(a, cs[1].location!), distanceKm(cs[1].location!, a));
  assert.deepEqual(
    nearbyCustomers(cs, "测试区域", a, 3).map((c) => c.id),
    [cs[0].id, cs[1].id],
  );
  assert.equal(nearbyCustomers(cs, "其他区域", a, null).length, 0);
  assert.equal(nearbyCustomers(cs, "", undefined, 3).length, 0);
  assert.equal(nearbyCustomers(cs, "", a, null).length, 4);
});
test("导航仅输出白名单坐标参数，不外发客户身份，撤销授权后拒绝", () => {
  const url = new URL(navigationUrl(a, "walk"));
  assert.equal(url.origin, "https://uri.amap.com");
  assert.equal(url.searchParams.get("to"), "116,29,拜访目的地");
  assert.equal(url.searchParams.get("mode"), "walk");
  assert.equal(url.searchParams.has("from"), false);
  assert.equal(url.href.includes("测试位置"), false);
  assert.throws(() => navigationUrl({ ...a, consent: false }));
});
test("产品规则维护与审核权限明确，网点负责人不能改准入条件", () => {
  for (const role of [
    "admin",
    "supervisor",
    "manager",
    "reviewer",
    "viewer",
  ] as const) {
    assert.equal(canManageProductRules(role), role === "admin");
    assert.equal(
      canReviewProductRules(role),
      role === "admin" || role === "reviewer",
    );
  }
});
test("首页问题按产品规则生成，未知信息进入问询，不串产品", () => {
  const c = { ...sampleCustomers()[0], operatingYears: null };
  const rules = [
    { ...initialRules[0], productId: "A" },
    { ...initialRules[0], id: "B-rule", productId: "B" },
  ];
  const p = visitPrompts(c, "A", rules);
  assert.ok(p.questions.some((q) => q.id === initialRules[0].id));
  assert.ok(!p.questions.some((q) => q.id === "B-rule"));
  assert.ok(p.materials.includes("有效营业执照"));
});

import {
  linkedBrief,
  latestBrief,
  taskVisit,
  communicationVisit,
  inFollowupScope,
} from "../lib/visit-context.ts";
import type { Brief, Communication } from "../lib/platform.ts";
import type { Visit, Task } from "../lib/workbench.ts";
test("访前与访后按客户、产品和原快照关联，不回退到其他产品或最新快照", () => {
  const briefs = [
    { id: "b1", customerId: "KH-001", productId: "tax", created: "2026-09-01" },
    {
      id: "b2",
      customerId: "KH-001",
      productId: "cash",
      created: "2026-09-03",
    },
    { id: "b3", customerId: "KH-001", productId: "tax", created: "2026-09-02" },
  ] as Brief[];
  assert.equal(latestBrief(briefs, "KH-001", "tax")?.id, "b3");
  assert.equal(linkedBrief(briefs, "KH-001", "b1")?.id, "b1");
  assert.equal(linkedBrief(briefs, "KH-002", "b1"), undefined);
  assert.equal(linkedBrief(briefs, "KH-001", "missing"), undefined);
  assert.equal(latestBrief(briefs, "KH-001", "other"), undefined);
  assert.ok(
    !inFollowupScope("KH-001", briefs[1], {
      customerId: "KH-001",
      productId: "tax",
      status: "all",
    }),
  );
  assert.ok(
    !inFollowupScope("KH-001", undefined, {
      customerId: "KH-001",
      productId: "tax",
      status: "all",
    }),
  );
});
test("任务与沟通打开原纪要，同客户不同快照不串用", () => {
  const visit = {
    id: "v1",
    customerId: "KH-001",
    briefId: "b1",
    communicationId: "c1",
    raw: "原始记录",
    channel: "phone",
  } as Visit;
  const task = {
    id: "visit:v1",
    customerId: "KH-001",
    source: "纪要 v1",
  } as Task;
  assert.equal(taskVisit(task, [visit])?.id, "v1");
  assert.equal(
    taskVisit({ ...task, customerId: "KH-002" }, [visit]),
    undefined,
  );
  const communication = {
    id: "c1",
    customerId: "KH-001",
    briefId: "b1",
    content: "原始记录",
    channel: "phone",
  } as Communication;
  assert.equal(communicationVisit(communication, [visit])?.id, "v1");
  assert.equal(
    communicationVisit({ ...communication, briefId: "b2" }, [visit]),
    undefined,
  );
  assert.equal(
    communicationVisit({ ...communication, id: "c2" }, [visit]),
    undefined,
  );
  assert.equal(
    communicationVisit(communication, [
      { ...visit, communicationId: undefined },
    ])?.id,
    "v1",
  );
});
