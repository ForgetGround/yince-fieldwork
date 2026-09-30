"use client";
import { ArrowUpRight, ClipboardList, Clock3, FileCheck } from "lucide-react";
import type { PlatformState } from "@/lib/platform";

export function DashboardSummary({
  state,
  onOpen,
}: {
  state: PlatformState;
  onOpen: (target: "pending" | "overdue" | "reviews") => void;
}) {
  const items = [
    {
      target: "pending" as const,
      label: "待办任务",
      value: state.tasks.filter((t) => !t.done).length,
      detail: "查看访后待办",
      icon: ClipboardList,
    },
    {
      target: "overdue" as const,
      label: "逾期待办",
      value: state.tasks.filter((t) => !t.done && t.due < state.referenceDate)
        .length,
      detail: "优先处理逾期",
      icon: Clock3,
    },
    {
      target: "reviews" as const,
      label: "待审查事项",
      value: state.reviews.filter((r) => r.status === "pending").length,
      detail: "查看审查事项",
      icon: FileCheck,
    },
  ];
  return (
    <section className="conversation-summary" aria-label="今日待办概览">
      {items.map((item) => (
        <button
          key={item.target}
          type="button"
          className={`conversation-stat ${item.target}`}
          onClick={() => onOpen(item.target)}
          aria-label={`${item.label} ${item.value} 项，${item.detail}`}
        >
          <span className="conversation-stat-label">
            {item.label}
            <item.icon size={17} aria-hidden="true" />
          </span>
          <span className="conversation-stat-value">
            <strong>{item.value}</strong>
            <span>项</span>
          </span>
          <span className="conversation-stat-link">
            {item.detail}
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </button>
      ))}
    </section>
  );
}
