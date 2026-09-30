"use client";
import { useState } from "react";
import {
  MessageSquare,
  HelpCircle,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { CustomerInformation } from "./customer-information";
import { CustomerMap } from "./customer-map";
import { DashboardSummary } from "./dashboard-summary";
import { toast } from "sonner";
import type { PlatformState } from "@/lib/platform";
import { ranked, type Customer, type Rule } from "@/lib/workbench";
import { LEGACY_PRODUCT_ID } from "@/lib/product-matching";
import { visitPrompts } from "@/lib/fieldwork";
type Command = <T = unknown>(data: unknown) => Promise<T>;
export function FieldworkHome({
  state,
  command,
  busy,
  onOpen,
  onSource,
  onNavigate,
  embedded = false,
  selection,
  onSelect,
  onFollowup,
}: {
  embedded?: boolean;
  selection: { customerId: string; productId: string };
  onSelect: (customerId: string, productId: string) => void;
  onFollowup: (c: Customer, productId: string) => void;
  state: PlatformState;
  command: Command;
  busy: boolean;
  onOpen: (c: Customer, productId: string) => void;
  onSource: (r: Rule) => void;
  onNavigate: (view: "followups" | "reviews", overdue?: boolean) => void;
}) {
  const { customerId: selected, productId } = selection;
  const customers = ranked(state.customers);
  const customer = customers.find((c) => c.id === selected) || customers[0];
  const product =
    state.products.find((p) => p.id === productId) || state.products[0];
  if (!customer || !product)
    return (
      <section className="panel field-card">
        <h1>今日展业</h1>
        <p>
          当前没有可见客户，请先到客户机会中导入资料，或由网点负责人分配客户。
        </p>
      </section>
    );
  const p = visitPrompts(customer, product.id, state.rules);
  const prepared = state.briefs.some(
    (b) =>
      b.customerId === customer.id &&
      (b.productId || LEGACY_PRODUCT_ID) === product.id,
  );
  const match = state.productMatches[product.id]?.find(
    (m) => m.customerId === customer.id,
  );
  return (
    <>
      {!embedded && (
        <>
          <div className="field-home-header">
            <div>
              <span className="eyebrow">今日工作</span>
              <h1>访前作战单</h1>
              <p>查看待办，准备下一次有效沟通。</p>
            </div>
          </div>
          <DashboardSummary state={state} onNavigate={onNavigate} />
        </>
      )}
      <section className="field-preparation-context" aria-label="本次沟通对象">
        <div>
          <h2>本次沟通准备</h2>
          <p>客户与产品仅用于下方沟通重点、问询和资料准备。</p>
        </div>
        <div className="field-context">
          <label>
            本次客户
            <select
              aria-label="本次客户"
              value={customer.id}
              onChange={(e) => onSelect(e.target.value, product.id)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.industry}
                </option>
              ))}
            </select>
          </label>
          <label>
            沟通产品
            <select
              aria-label="沟通产品"
              value={product.id}
              onChange={(e) => onSelect(customer.id, e.target.value)}
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <CustomerInformation customer={customer} />
      <div className="field-home-grid">
        <section className="panel field-card">
          <div className="field-card-title">
            <h2>
              <MessageSquare size={18} />
              沟通重点
            </h2>
            <span className="tag teal">{customer.id}</span>
          </div>
          <h3>{product.name}</h3>
          <p className="field-lead">{p.reason}</p>
          {customer.maturityDate && (
            <div className="field-due">
              贷款到期 <strong>{customer.maturityDate}</strong>
              <span>
                {customer.daysToMaturity === null
                  ? "日期待核实"
                  : customer.daysToMaturity < 0
                    ? `已过 ${-customer.daysToMaturity} 天`
                    : `剩余 ${customer.daysToMaturity} 天`}
              </span>
            </div>
          )}
          <div className="field-note">
            <small>已记录需求</small>
            <p>
              {customer.demand || "尚未确认需求，本次先核实经营与资金安排。"}
            </p>
          </div>
          <p className="micro-copy">
            {match
              ? `本产品已符合 ${match.passed} 项，缺失 ${match.unknown} 项，已知不符 ${match.failed} 项，另有 ${match.manual} 项需人工核实。`
              : "产品条件待核查。"}
            匹配结果不代表授信通过。
          </p>
          <button
            className="text-btn"
            onClick={() => onOpen(customer, product.id)}
          >
            查看完整访前作战单
            <ArrowRight size={14} />
          </button>
        </section>
        <section className="panel field-card">
          <div className="field-card-title">
            <h2>
              <HelpCircle size={18} />
              问询提示
            </h2>
            <span className="muted-copy">先补齐未知信息</span>
          </div>
          <ol className="field-questions">
            {p.questions.map((q) => (
              <li key={q.id}>
                <strong>{q.text}</strong>
                <p>{q.basis}</p>
                {q.rule && (
                  <button
                    className="text-btn"
                    onClick={() => onSource(q.rule!)}
                  >
                    查看原文依据
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
        <Preparation
          key={customer.id + product.id}
          customer={customer}
          productId={product.id}
          materials={p.materials}
          prepared={prepared}
          canWrite={["admin", "supervisor", "manager"].includes(
            state.workspace.role,
          )}
          busy={busy}
          command={command}
          onOpen={() => onFollowup(customer, product.id)}
        />
      </div>
      <CustomerMap
        key={customer.id}
        state={state}
        selected={customer}
        onSelect={(id) => onSelect(id, product.id)}
        command={command}
        busy={busy}
      />
    </>
  );
}
function Preparation({
  customer,
  productId,
  materials,
  prepared,
  canWrite,
  busy,
  command,
  onOpen,
}: {
  customer: Customer;
  productId: string;
  materials: string[];
  prepared: boolean;
  canWrite: boolean;
  busy: boolean;
  command: Command;
  onOpen: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  return (
    <section className="panel field-card">
      <div className="field-card-title">
        <h2>
          <ClipboardList size={18} />
          拜访前资料准备
        </h2>
        <span className={"tag " + (prepared ? "teal" : "amber")}>
          {prepared ? "已保存访前准备" : "待准备"}
        </span>
      </div>
      <p className="micro-copy">
        勾选表示已准备沟通所需的资料或索取清单，不会直接标记客户材料已齐全。
      </p>
      <div className="field-materials">
        {materials.map((m) => (
          <label key={m}>
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={checked.includes(m)}
              onChange={(e) =>
                setChecked(
                  e.target.checked
                    ? [...checked, m]
                    : checked.filter((x) => x !== m),
                )
              }
            />
            <span>{m}</span>
          </label>
        ))}
      </div>
      <p className="micro-copy">
        产品专属材料以已核实制度为准，可在问询提示中核对对应原文。
      </p>
      {canWrite && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            已核对本产品规则、问询要点及沟通边界
          </label>
          <button
            className="btn primary"
            disabled={busy || !ack || checked.length !== materials.length}
            onClick={async () => {
              try {
                await command({
                  type: "brief.confirm",
                  customerId: customer.id,
                  productId,
                  checklist: [
                    ...checked,
                    "已核对本产品规则、问询要点及沟通边界",
                  ].slice(0, 20),
                  ack: true,
                });
                setAck(false);
                toast.success("访前准备及产品规则快照已保存");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {prepared ? "更新访前准备快照" : "保存访前准备"}
          </button>
        </>
      )}
      <button className="text-btn" onClick={onOpen}>
        进入该客户的访后跟进
        <ArrowRight size={14} />
      </button>
    </section>
  );
}
