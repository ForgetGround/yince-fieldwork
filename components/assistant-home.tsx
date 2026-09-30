"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  LoaderCircle,
  MessageSquare,
  ChevronRight,
  Sparkles,
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
  onAction,
  newConversation,
  onBusyChange,
}: {
  newConversation: number;
  onBusyChange: (busy: boolean) => void;
  state: PlatformState;
  request: Request;
  onAction: (action: AssistantAction, productId?: string) => void;
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
  const conversationVersion = useRef(newConversation);
  useEffect(() => {
    onBusyChange(loading || sending);
  }, [loading, sending, onBusyChange]);
  useEffect(() => {
    if (conversationVersion.current === newConversation) return;
    conversationVersion.current = newConversation;
    setMessages([]);
    setThreadId(undefined);
    setDraft("");
    setError("");
    setPlan(null);
  }, [newConversation]);
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
  function openAction(
    a: AssistantAction,
    context?: { plan: AssistantPlan; answer: AssistantAnswer },
  ) {
    const products =
      context?.answer.actions.filter(
        (item) =>
          item.kind === "product" && context.plan.actionIds.includes(item.id),
      ) || [];
    setPlan(null);
    onAction(a, products.length === 1 ? products[0].target : undefined);
  }
  return (
    <div className="assistant-home conversation-home">
      <section className="assistant-chat" aria-label="展业助手对话">
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
                  state.customers[0]
                    ? `为 ${state.customers[0].id} 准备一份简短营销方案`
                    : "如何准备一次客户拜访？",
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
                {m.role === "assistant" && (
                  <span className="conversation-avatar">
                    <Sparkles size={20} />
                  </span>
                )}
                <div className="assistant-message-body">
                  {m.role === "assistant" && (
                    <div className="conversation-byline">
                      银策星图 · 展业助手
                    </div>
                  )}
                  <p>{m.content}</p>
                  {m.result?.notice && (
                    <small className="assistant-response-label">
                      {m.result.notice}
                    </small>
                  )}
                  {m.result?.plans.map((p, k) => (
                    <article
                      className="conversation-plan"
                      key={k}
                      aria-label={p.title}
                    >
                      <h2>{p.title}</h2>
                      {p.summary && (
                        <p className="conversation-plan-summary">{p.summary}</p>
                      )}
                      <dl>
                        {p.steps.map((step, j) => {
                          const match = step.match(
                            /^([^：:]{1,12})[：:]\s*([\s\S]+)$/,
                          );
                          return (
                            <div key={j}>
                              <dt>
                                {match
                                  ? match[1]
                                  : `行动 ${String(j + 1).padStart(2, "0")}`}
                              </dt>
                              <dd>{match ? match[2] : step}</dd>
                            </div>
                          );
                        })}
                      </dl>
                      <div className="conversation-sources">
                        {m
                          .result!.sources.filter((s) =>
                            p.sourceIds.includes(s.id),
                          )
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() =>
                                setPlan({ plan: p, answer: m.result! })
                              }
                            >
                              {s.title}
                            </button>
                          ))}
                      </div>
                      <div className="conversation-plan-actions">
                        {m
                          .result!.actions.filter((a) =>
                            p.actionIds.includes(a.id),
                          )
                          .map((a, j) => (
                            <button
                              className={j === 0 ? "btn" : "btn secondary"}
                              key={a.id}
                              onClick={() =>
                                openAction(a, { plan: p, answer: m.result! })
                              }
                            >
                              {a.kind === "customer"
                                ? "打开访前作战单"
                                : a.label}
                            </button>
                          ))}
                        <button
                          className="btn secondary"
                          onClick={() =>
                            setPlan({ plan: p, answer: m.result! })
                          }
                        >
                          核对方案依据
                        </button>
                      </div>
                      <small className="conversation-plan-note">
                        方案草稿供客户经理确认，不自动发送给客户。
                      </small>
                    </article>
                  ))}
                  {m.result?.actions.length && !m.result.plans.length ? (
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
            placeholder="描述你的需求，或继续追问这个客户…"
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
            <small className="composer-hint">
              依据产品规则与客户信息回答 · 关键操作由客户经理确认
            </small>
            <small className="composer-count">{draft.length}/2000</small>
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
            </button>
          </div>
        </form>
        <footer>
          <CheckCircle2 size={12} />
          AI
          辅助整理与建议，业务结论请结合原文及实际情况核实。请勿输入敏感资料。
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
                  onClick={() => openAction(a, plan || undefined)}
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
