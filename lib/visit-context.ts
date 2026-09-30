import type { Brief, Communication } from "./platform.ts";
import type { Task, Visit } from "./workbench.ts";
import { LEGACY_PRODUCT_ID } from "./product-matching.ts";
export type FollowupScope = {
  customerId: string;
  productId: string;
  status: "pending" | "overdue" | "done" | "all";
};
export const emptyFollowupScope: FollowupScope = {
  customerId: "",
  productId: "",
  status: "pending",
};
export const briefProductId = (brief: Brief) =>
  brief.productId || LEGACY_PRODUCT_ID;
export function linkedBrief(briefs: Brief[], customerId: string, id?: string) {
  return id
    ? briefs.find((b) => b.id === id && b.customerId === customerId)
    : undefined;
}
export function latestBrief(
  briefs: Brief[],
  customerId: string,
  productId: string,
) {
  return briefs
    .filter(
      (b) => b.customerId === customerId && briefProductId(b) === productId,
    )
    .sort((a, b) => b.created.localeCompare(a.created))[0];
}
export function taskVisit(task: Task, visits: Visit[]) {
  const id = task.source.startsWith("纪要 ")
    ? task.source.slice(3)
    : task.id.startsWith("visit:")
      ? task.id.slice(6)
      : "";
  return visits.find((v) => v.id === id && v.customerId === task.customerId);
}
export function communicationVisit(record: Communication, visits: Visit[]) {
  return visits.find(
    (v) =>
      v.customerId === record.customerId &&
      v.briefId === record.briefId &&
      (v.communicationId
        ? v.communicationId === record.id
        : v.raw === record.content && v.channel === record.channel),
  );
}
export function inFollowupScope(
  customerId: string,
  brief: Brief | undefined,
  scope: FollowupScope,
) {
  return (
    (!scope.customerId || scope.customerId === customerId) &&
    (!scope.productId || (!!brief && briefProductId(brief) === scope.productId))
  );
}
