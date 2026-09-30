"use client";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "./ui/checkbox";
import { PageTitle, Empty } from "./workbench-views";
import { type Customer, type Visit, downloadJson } from "@/lib/workbench";
import type { Brief, Communication, PlatformState } from "@/lib/platform";
import {
  briefProductId,
  linkedBrief,
  latestBrief,
  taskVisit,
  communicationVisit,
  inFollowupScope,
  type FollowupScope,
} from "@/lib/visit-context";
type Command = <T = unknown>(data: unknown) => Promise<T>;
export type RecordTarget = {
  customerId: string;
  briefId?: string;
  visit?: Visit;
  communication?: Communication;
};
const statusLabels = {
  draft: "待确认草稿",
  confirmed: "已确认 · 待提交",
  pending: "待独立审查",
  approved: "审查通过",
  rejected: "退回补充",
};
const channelLabels = {
  phone: "电话",
  wechat: "微信",
  visit: "拜访",
  other: "其他",
};
const outcomeLabels = {
  connected: "已沟通",
  unanswered: "未接通",
  scheduled: "已约下次联系",
};
export function FollowupBoard({
  state,
  command,
  busy,
  scope,
  onScopeChange,
  onPrepare,
  onRecord,
}: {
  state: PlatformState;
  command: Command;
  busy: boolean;
  scope: FollowupScope;
  onScopeChange: (scope: FollowupScope) => void;
  onPrepare: (c: Customer, productId?: string) => void;
  onRecord: (target: RecordTarget) => void;
}) {
  const canWrite = ["admin", "supervisor", "manager"].includes(
    state.workspace.role,
  );
  const customer = state.customers.find((c) => c.id === scope.customerId);
  const selectedBrief =
    customer && scope.productId
      ? latestBrief(state.briefs, customer.id, scope.productId)
      : undefined;
  const briefForVisit = (v: Visit) =>
    linkedBrief(state.briefs, v.customerId, v.briefId);
  const visits = state.visits.filter((v) =>
    inFollowupScope(v.customerId, briefForVisit(v), scope),
  );
  const communications = state.communications.filter((c) =>
    inFollowupScope(
      c.customerId,
      linkedBrief(state.briefs, c.customerId, c.briefId),
      scope,
    ),
  );
  const matchingTasks = state.tasks.filter((t) => {
    const v = taskVisit(t, state.visits);
    return inFollowupScope(
      t.customerId,
      v ? briefForVisit(v) : undefined,
      scope,
    );
  });
  const tasks = matchingTasks.filter(
    (t) =>
      scope.status === "all" ||
      (scope.status === "done"
        ? t.done
        : !t.done &&
          (scope.status !== "overdue" || t.due < state.referenceDate)),
  );
  const productName = (brief?: Brief) =>
    brief?.productName ||
    (brief &&
      state.products.find((p) => p.id === briefProductId(brief))?.name) ||
    "产品未关联";
  function openCommunication(record: Communication) {
    const visit = communicationVisit(record, state.visits);
    onRecord({
      customerId: record.customerId,
      briefId: record.briefId,
      ...(visit ? { visit } : { communication: record }),
    });
  }
  return (
    <>
      <PageTitle
        eyebrow="FOLLOW-UP LOOP"
        title="访后跟进"
        description="记录实际沟通，核对纪要，推进下一步任务。每条记录保留原客户、产品与访前快照。"
      >
        <button
          className="btn"
          disabled={!visits.some((v) => v.confirmed) || busy}
          onClick={async () => {
            try {
              await command({
                type: "audit.record",
                action: "导出 CRM",
                target: "当前筛选下已确认纪要与跟进任务",
              });
              downloadJson("银策星图-CRM待对接数据.json", {
                workspace: state.workspace.name,
                referenceDate: state.referenceDate,
                writeStatus: "pending_external_integration",
                visits: visits.filter((v) => v.confirmed),
                tasks: matchingTasks,
              });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          导出当前筛选 CRM
        </button>
      </PageTitle>
      <section className="field-preparation-context" aria-label="访后跟进范围">
        <div>
          <h2>本次跟进对象</h2>
          <p>从访前进入时，自动带入同一客户与产品。</p>
        </div>
        <div className="field-context">
          <label>
            跟进客户
            <select
              aria-label="跟进客户"
              value={scope.customerId}
              onChange={(e) =>
                onScopeChange({ ...scope, customerId: e.target.value })
              }
            >
              <option value="">全部客户</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.companyName || c.industry}
                </option>
              ))}
            </select>
          </label>
          <label>
            跟进产品
            <select
              aria-label="跟进产品"
              value={scope.productId}
              onChange={(e) =>
                onScopeChange({ ...scope, productId: e.target.value })
              }
            >
              <option value="">全部产品（含未关联）</option>
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="panel followup-start" aria-label="记录本次沟通">
        <div>
          <h2>记录本次沟通</h2>
          <p>
            {!customer || !scope.productId
              ? "先选择客户和产品，再记录本次电话、微信或拜访。"
              : selectedBrief
                ? `${customer.id} · ${productName(selectedBrief)} · 使用 ${new Date(selectedBrief.created).toLocaleString("zh-CN")} 保存的访前快照`
                : "本客户尚未保存该产品的访前准备，请先核对并保存。"}
          </p>
        </div>
        {customer && scope.productId && (
          <div className="inline-actions">
            <button
              className="btn"
              onClick={() => onPrepare(customer, scope.productId)}
            >
              返回该客户的访前准备
            </button>
            <button
              className="btn primary"
              disabled={!selectedBrief || !canWrite || busy}
              onClick={() =>
                selectedBrief &&
                onRecord({ customerId: customer.id, briefId: selectedBrief.id })
              }
            >
              新增沟通记录
            </button>
          </div>
        )}
      </section>
      <div className="followup-summary" aria-label="当前筛选跟进概览">
        <span>
          <b>{matchingTasks.filter((t) => !t.done).length}</b>未完成任务
        </span>
        <span>
          <b>
            {
              matchingTasks.filter(
                (t) => !t.done && t.due < state.referenceDate,
              ).length
            }
          </b>
          逾期待办
        </span>
        <span>
          <b>{visits.filter((v) => v.status === "draft").length}</b>待确认草稿
        </span>
        <span>
          <b>{visits.filter((v) => v.status === "pending").length}</b>待审纪要
        </span>
      </div>
      <div className="review-tabs">
        {(
          [
            ["pending", "待跟进"],
            ["overdue", "仅逾期"],
            ["done", "已完成"],
            ["all", "全部任务"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={"btn " + (scope.status === id ? "primary" : "")}
            onClick={() => onScopeChange({ ...scope, status: id })}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel followup-list" aria-label="跟进任务">
        {tasks.length ? (
          tasks.map((t) => {
            const visit = taskVisit(t, state.visits),
              brief = visit && briefForVisit(visit);
            return (
              <div
                className={"followup-item " + (t.done ? "done" : "")}
                key={t.id}
              >
                <Checkbox
                  checked={t.done}
                  disabled={busy || !canWrite}
                  aria-label={`完成任务 ${t.customerId} ${t.title}`}
                  onCheckedChange={async (value) => {
                    try {
                      await command({
                        type: "task.toggle",
                        taskId: t.id,
                        done: value === true,
                      });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
                <div>
                  <strong>{t.title}</strong>
                  <p>
                    {t.customerId} · {t.assigneeName} · {productName(brief)} ·{" "}
                    {visit
                      ? "来自访后纪要"
                      : t.source.startsWith("纪要 ")
                        ? "来源纪要不可用"
                        : "客户级任务"}
                  </p>
                </div>
                <span
                  className={
                    "deadline-tag " +
                    (!t.done && t.due < state.referenceDate ? "overdue" : "")
                  }
                >
                  {!t.done && t.due < state.referenceDate ? "已逾期 " : ""}
                  {t.due}
                </span>
                <button
                  className="text-btn"
                  onClick={() =>
                    visit
                      ? onRecord({
                          customerId: t.customerId,
                          briefId: visit.briefId,
                          visit,
                        })
                      : onScopeChange({
                          ...scope,
                          customerId: t.customerId,
                          productId: "",
                        })
                  }
                >
                  {visit ? "查看关联纪要" : "查看该客户跟进"}
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })
        ) : (
          <Empty
            title="当前筛选下没有任务"
            description="产品未关联的历史任务只在“全部产品”中显示。确认访后纪要时可建立跟进任务。"
          />
        )}
      </section>
      <div className="section-heading records-heading">
        <h2>沟通记录</h2>
        <span className="micro-copy">
          已保存的电话、微信和拜访记录；可继续归纳，无需重复录入
        </span>
      </div>
      <div className="records-grid">
        {communications.length ? (
          communications
            .slice()
            .reverse()
            .map((c) => {
              const v = communicationVisit(c, state.visits),
                b = linkedBrief(state.briefs, c.customerId, c.briefId);
              return (
                <button
                  className="panel record-card"
                  key={c.id}
                  onClick={() => openCommunication(c)}
                >
                  <div>
                    <strong>
                      {c.customerId} · {channelLabels[c.channel]}
                    </strong>
                    <span className="tag gray">{outcomeLabels[c.outcome]}</span>
                  </div>
                  <small>
                    {productName(b)} ·{" "}
                    {new Date(c.created).toLocaleString("zh-CN")}
                  </small>
                  <p>{c.content}</p>
                  <footer>
                    {v
                      ? "查看关联纪要"
                      : c.outcome === "connected"
                        ? "继续归纳纪要"
                        : "查看联系尝试"}
                    <ArrowRight size={15} />
                  </footer>
                </button>
              );
            })
        ) : (
          <section className="panel empty-record">
            <ClipboardCheck />
            <p>当前客户与产品还没有沟通记录。</p>
          </section>
        )}
      </div>
      <div className="section-heading records-heading">
        <h2>纪要与闭环记录</h2>
        <span className="micro-copy">
          草稿可继续填写；历史纪要始终关联原访前快照
        </span>
      </div>
      <div className="records-grid">
        {visits.length ? (
          visits
            .slice()
            .reverse()
            .map((v) => (
              <button
                className="panel record-card"
                key={v.id}
                onClick={() =>
                  onRecord({
                    customerId: v.customerId,
                    briefId: v.briefId,
                    visit: v,
                  })
                }
              >
                <div>
                  <strong>{v.customerId}</strong>
                  <span className="tag gray">
                    {statusLabels[v.status || "draft"]}
                  </span>
                </div>
                <small>{productName(briefForVisit(v))}</small>
                <p>{v.summary || "纪要草稿，等待归纳确认"}</p>
                <footer>
                  {v.nextDate ? "下次跟进 " + v.nextDate : "尚未约定下次日期"}
                  <ArrowRight size={15} />
                </footer>
                <small>
                  原访前快照 {v.briefId?.slice(0, 8) || "未关联"} ·{" "}
                  {v.ruleSnapshot.length} 条历史规则
                </small>
              </button>
            ))
        ) : (
          <section className="panel empty-record">
            <ClipboardCheck />
            <p>当前客户与产品还没有纪要。</p>
          </section>
        )}
      </div>
    </>
  );
}
