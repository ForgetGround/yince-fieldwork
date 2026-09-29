import type { Customer, Rule } from "./workbench.ts";
import { evaluateRule, opportunity } from "./workbench.ts";
import { productIdOf, ruleFact } from "./product-matching.ts";
import type { Role } from "./platform.ts";
export const canManageProductRules = (role: Role) => role === "admin";
export const canReviewProductRules = (role: Role) =>
  role === "admin" || role === "reviewer";
export type CustomerLocation = {
  region: string;
  address: string;
  longitude: number;
  latitude: number;
  coordinateSystem: "GCJ02";
  consent: boolean;
  updatedAt?: string;
};
export function validLocation(
  p: CustomerLocation | undefined,
): p is CustomerLocation {
  return (
    !!p &&
    p.coordinateSystem === "GCJ02" &&
    Number.isFinite(p.longitude) &&
    Number.isFinite(p.latitude) &&
    p.longitude >= -180 &&
    p.longitude <= 180 &&
    p.latitude >= -90 &&
    p.latitude <= 90
  );
}
export function distanceKm(a: CustomerLocation, b: CustomerLocation) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const x = rad(b.latitude - a.latitude);
  const y = rad(b.longitude - a.longitude);
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(y / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function nearbyCustomers(
  customers: Customer[],
  region: string,
  anchor: CustomerLocation | undefined,
  radius: number | null,
) {
  return customers.filter(
    (c) =>
      (!region || c.location?.region === region) &&
      (radius === null ||
        (validLocation(anchor) &&
          validLocation(c.location) &&
          distanceKm(anchor, c.location) <= radius)),
  );
}
export function navigationUrl(
  p: CustomerLocation,
  mode: "car" | "walk" | "bus" = "car",
) {
  if (!validLocation(p) || !p.consent)
    throw Error("请先登记并授权使用经营位置");
  const u = new URL("https://uri.amap.com/navigation");
  u.search = new URLSearchParams({
    to: `${p.longitude},${p.latitude},拜访目的地`,
    mode,
    src: "YINGCE",
    callnative: "1",
  }).toString();
  return u.toString();
}
export function visitPrompts(c: Customer, productId: string, rules: Rule[]) {
  const scoped = rules.filter(
    (r) => productIdOf(r) === productId && r.status === "active",
  );
  const missing = scoped.filter((r) => evaluateRule(c, r) !== "pass");
  return {
    reason: opportunity(c).reason,
    questions: [
      ...missing.map((r) => ({
        id: r.id,
        text: `请核实：${r.title}`,
        basis: `${ruleFact(c, r)} · ${r.version}`,
        rule: r,
      })),
      {
        id: "demand",
        text: "资金用途、预计金额、使用时间与还款安排是什么？",
        basis: c.demand || "尚未记录明确需求",
        rule: null,
      },
    ],
    materials: [
      ...new Set([...c.missing, "有效营业执照", "经营情况及资金用途说明"]),
    ],
  };
}
