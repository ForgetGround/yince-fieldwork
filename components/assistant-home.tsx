"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Plus,
  LoaderCircle,
  MessageSquare,
  ChevronRight,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import type { PlatformState } from "@/lib/platform";
import { opportunity, ranked } from "@/lib/workbench";
import { priorityLevel } from "@/lib/platform";
import type {
  AssistantAction,
  AssistantAnswer,
  AssistantMessage,
  AssistantPlan,
  AssistantReply,
} from "@/lib/assistant";
type Request = <T>(path: string, data?: unknown) => Promise<T>;
export function AssistantHome({
  state,
  request,
  onNavigate,
  onAction,
  preparation,
}: {
  preparation?: ReactNode;
  state: PlatformState;
  request: Request;
  onNavigate: (view: string) => void;
  onAction: (action: AssistantAction) => void;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]),
    [threadId, setThreadId] = useState<string | undefined>(),
    [draft, setDraft] = useState(""),
    [mode, setMode] = useState<"simple" | "plan">("simple"),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<{
      plan: AssistantPlan;
      answer: AssistantAnswer;
    } | null>(null);
  const alive = useRef(true),
    log = useRef<HTMLDivElement>(null),
    sendingRef = useRef(false);
  const path = `/workspaces/${state.workspace.id}/assistant`;
  useEffect(() => {
    alive.current = true;
    request<{ threadId: string | null; messages: AssistantMessage[] }>(path)
      .then((r) => {
        if (alive.current) {
          setThreadId(r.threadId || undefined);
          setMessages(r.messages);
        }
      })
      .catch(() => {
        if (alive.current) setError("暂时无法读取历史对话，可新建对话后重试。");
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [path, request]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, sending]);
  const pending = state.tasks
      .filter((t) => !t.done)
      .sort((a, b) => a.due.localeCompare(b.due)),
    done = state.tasks.filter((t) => t.done).length,
    total = state.tasks.length,
    percent = total ? Math.round((done / total) * 100) : 0;
  const priority = ranked(state.customers).slice(0, 3);
  async function send(text = draft) {
    if (!text.trim() || sendingRef.current || loading) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setDraft("");
    const user: AssistantMessage = { role: "user", content: text.trim() };
    setMessages((m) => [...m, user]);
    try {
      const r = await request<AssistantReply>(path, {
        message: user.content,
        mode,
        ...(threadId ? { threadId } : {}),
      });
      if (alive.current) {
        setThreadId(r.threadId);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: r.result.answer, result: r.result },
        ]);
      }
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setDraft(text);
        setMessages((m) => m.slice(0, -1));
      }
    } finally {
      sendingRef.current = false;
      if (alive.current) setSending(false);
    }
  }
  function openAction(a: AssistantAction) {
    setPlan(null);
    onAction(a);
  }
  return (
    <div className="assistant-home">
      <div className="assistant-heading">
        <div>
          <span className="eyebrow">今日工作</span>
          <h1>先看重点，再开始对话。</h1>
        </div>
        <span className="assistant-engine">
          <span />
          DeepSeek Flash · 快速回答
        </span>
      </div>
      <div className="assistant-overview">
        <button
          className="assistant-progress panel"
          onClick={() => onNavigate("team")}
        >
          <span>
            跟进进度 <ArrowUpRight size={16} />
          </span>
          <strong>
            {percent}
            <small>%</small>
          </strong>
          <div className="assistant-progress-track">
            <i style={{ width: percent + "%" }} />
          </div>
          <small>
            已完成 {done} / {total} 项任务
          </small>
        </button>
        <button
          className="assistant-metric panel"
          onClick={() => onNavigate("followups")}
        >
          <span>
            待办项目 <ArrowUpRight size={16} />
          </span>
          <strong>
            {pending.length}
            <small>项</small>
          </strong>
          <small>
            {pending.filter((t) => t.due < state.referenceDate).length}{" "}
            项逾期，优先跟进
          </small>
        </button>
        <button
          className="assistant-metric panel"
          onClick={() => onNavigate("reviews")}
        >
          <span>
            等待审查 <ArrowUpRight size={16} />
          </span>
          <strong>
            {state.reviews.filter((r) => r.status === "pending").length}
            <small>项</small>
          </strong>
          <small>纪要、规则与转派</small>
        </button>
      </div>
      <div className="assistant-priorities" aria-label="优先跟进项目">
        {(pending.length
          ? pending.slice(0, 3).map((t) => ({
              id: t.id,
              title: t.title,
              customer: state.customers.find((c) => c.id === t.customerId),
              note: t.due + " 截止",
              task: true,
            }))
          : priority.map((c) => ({
              id: c.id,
              title: "核实经营与业务需求",
              customer: c,
              note: "待确认本次沟通安排",
              task: false,
            }))
        ).map((item) => (
          <div className="assistant-priority" key={item.id}>
            <div>
              <button
                onClick={() =>
                  item.task
                    ? onNavigate("followups")
                    : item.customer &&
                      onAction({
                        id: "customer:" + item.customer.id,
                        kind: "customer",
                        target: item.customer.id,
                        label: "查看作战单",
                      })
                }
              >
                {item.title}
                <ChevronRight size={14} />
              </button>
              <small>
                {item.customer?.id || "待分配客户"} · {item.note}
              </small>
            </div>
            {item.customer && (
              <button
                aria-label={`查看 ${item.customer.id}，联系优先级 ${opportunity(item.customer).score}`}
                className={
                  "assistant-score " +
                  priorityLevel(opportunity(item.customer).score).className
                }
                onClick={() =>
                  onAction({
                    id: "customer:" + item.customer!.id,
                    kind: "customer",
                    target: item.customer!.id,
                    label: "查看作战单",
                  })
                }
              >
                {opportunity(item.customer).score}
                <span>/100</span>
              </button>
            )}
          </div>
        ))}
      </div>
      {preparation && (
        <details className="assistant-preparation">
          <summary>
            <span>
              <FileText size={17} />
              访前准备
            </span>
            <small>选择客户与产品，准备本次沟通</small>
            <ChevronRight size={16} />
          </summary>
          <div className="assistant-preparation-body">{preparation}</div>
        </details>
      )}
      <section className="assistant-chat panel">
        <header>
          <div>
            <BrandLogo size={30} />
            <strong>星图助手</strong>
            <span>把需求变成下一步</span>
          </div>
          <button
            className="text-btn"
            disabled={sending || loading}
            onClick={() => {
              setMessages([]);
              setThreadId(undefined);
              setError("");
              setDraft("");
            }}
          >
            <Plus size={15} />
            新对话
          </button>
        </header>
        <div
          className="assistant-log"
          ref={log}
          aria-live="polite"
          aria-busy={sending || loading}
        >
          {loading ? (
            <div className="assistant-loading">
              <LoaderCircle className="spin" size={20} />
              正在读取你的对话…
            </div>
          ) : messages.length === 0 ? (
            <div className="assistant-welcome">
              <BrandLogo size={44} />
              <h2>今天想先推进什么？</h2>
              <p>问一个问题，或让我结合当前工作空间整理一份展业方案。</p>
              <div className="assistant-prompts">
                {[
                  "今天先联系哪些客户？",
                  "帮我准备一次续贷沟通",
                  "哪些客户适合税易贷？",
                  "梳理逾期待办的跟进顺序",
                ].map((q) => (
                  <button disabled={sending} key={q} onClick={() => send(q)}>
                    <MessageSquare size={15} />
                    {q}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div className={"assistant-message " + m.role} key={i}>
                {m.role === "assistant" && <BrandLogo size={25} />}
                <div className="assistant-message-body">
                  <p>{m.content}</p>
                  {m.result?.notice && (
                    <small className="assistant-response-label">
                      {m.result.notice}
                    </small>
                  )}
                  {m.result?.plans.map((p, k) => (
                    <button
                      className="assistant-plan-card"
                      key={k}
                      onClick={() => setPlan({ plan: p, answer: m.result! })}
                    >
                      <span>
                        <FileText size={18} />
                        <strong>{p.title}</strong>
                        <span className="tag gray">方案草稿</span>
                      </span>
                      <p>{p.summary}</p>
                      <small>
                        {p.steps.length} 个步骤 · {p.sourceIds.length} 条依据{" "}
                        <ArrowUpRight size={15} />
                      </small>
                    </button>
                  ))}
                  {m.result?.actions.length ? (
                    <div className="assistant-actions">
                      {m.result.actions.map((a) => (
                        <button
                          className="text-btn"
                          key={a.id}
                          onClick={() => openAction(a)}
                        >
                          {a.label}
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {m.role === "assistant" && (
                    <small className="assistant-response-label">
                      {m.result?.model || "DeepSeek"} ·{" "}
                      {m.result?.mode === "plan" ? "方案回答" : "简洁回答"} ·
                      建议待核实
                    </small>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="assistant-loading">
              <LoaderCircle className="spin" size={18} />
              正在结合客户与产品依据整理回答…
            </div>
          )}
        </div>
        {error && (
          <div className="assistant-error" role="alert">
            {error}
          </div>
        )}
        <form
          className="assistant-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="向星图助手提问"
            placeholder="例如：帮我为 KH-001 准备续贷沟通方案，列出需要核实的问题…"
            value={draft}
            maxLength={2000}
            disabled={loading}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div>
            <label>
              回答模式
              <select
                aria-label="回答模式"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                disabled={sending}
              >
                <option value="simple">简洁回答</option>
                <option value="plan">生成方案</option>
              </select>
            </label>
            <small>{draft.length}/2000</small>
            <button
              type="submit"
              className="btn"
              disabled={sending || loading || !draft.trim()}
              aria-label="发送问题"
            >
              {sending ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <ArrowUp size={18} />
              )}
              发送
            </button>
          </div>
        </form>
        <footer>
          <CheckCircle2 size={12} />
          使用当前账号可见的脱敏业务摘要；方案需人工核实。请勿输入姓名、证件号或密钥。
        </footer>
      </section>
      <Dialog open={!!plan} onOpenChange={(open) => !open && setPlan(null)}>
        <DialogContent className="wide-dialog assistant-plan-dialog">
          <DialogHeader>
            <DialogTitle>{plan?.plan.title}</DialogTitle>
            <DialogDescription>{plan?.plan.summary}</DialogDescription>
          </DialogHeader>
          <span className="tag amber">AI 方案草稿 · 待人工确认</span>
          <ol>
            {plan?.plan.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <h3>建议依据</h3>
          {plan?.plan.sourceIds.length ? (
            plan.answer.sources
              .filter((s) => plan.plan.sourceIds.includes(s.id))
              .map((s) => (
                <div className="assistant-source" key={s.id}>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </div>
              ))
          ) : (
            <p>此方案未引用业务依据，执行前请补充核实。</p>
          )}
          <div className="assistant-actions">
            {plan?.answer.actions
              .filter((a) => plan.plan.actionIds.includes(a.id))
              .map((a) => (
                <button
                  className="btn"
                  key={a.id}
                  onClick={() => openAction(a)}
                >
                  {a.label}
                  <ArrowUpRight size={15} />
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
