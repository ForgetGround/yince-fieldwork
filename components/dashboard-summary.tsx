"use client";
/** Adapted from shadcn/ui Dashboard-01 SectionCards (MIT).
 * Source and license: docs/设计模板选型.md, vendor/shadcn-ui-LICENSE.md.
 */
import { ArrowUpRight, ClipboardList, Clock3, FileCheck } from "lucide-react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import type { PlatformState } from "@/lib/platform";
export function DashboardSummary({
  state,
  onNavigate,
}: {
  state: PlatformState;
  onNavigate: (view: "followups" | "reviews") => void;
}) {
  const items = [
    {
      label: "待办任务",
      value: state.tasks.filter((t) => !t.done).length,
      detail: "查看待跟进任务",
      view: "followups" as const,
      icon: ClipboardList,
      tone: "blue",
    },
    {
      label: "逾期待办",
      value: state.tasks.filter((t) => !t.done && t.due < state.referenceDate)
        .length,
      detail: "优先处理超期事项",
      view: "followups" as const,
      icon: Clock3,
      tone: "amber",
    },
    {
      label: "待审查事项",
      value: state.reviews.filter((r) => r.status === "pending").length,
      detail: "查看审查与转派",
      view: "reviews" as const,
      icon: FileCheck,
      tone: "violet",
    },
  ];
  return (
    <div className="dashboard-summary" aria-label="待办概览">
      {items.map((item) => (
        <Card key={item.label} className={`dashboard-stat ${item.tone}`}>
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle>
              <span className="stat-number">{item.value}</span>
              <span className="stat-unit">项</span>
            </CardTitle>
            <CardAction>
              <span className="stat-icon">
                <item.icon size={20} />
              </span>
            </CardAction>
          </CardHeader>
          <CardFooter>
            <button
              onClick={() => onNavigate(item.view)}
              aria-label={`${item.label} ${item.value} 项，${item.detail}`}
            >
              {item.detail}
              <ArrowUpRight size={16} />
            </button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
