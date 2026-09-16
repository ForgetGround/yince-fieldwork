"use client";
import { useEffect, useState } from "react";
import {
  Landmark,
  ArrowRight,
  ShieldCheck,
  Database,
  Users,
  Bell,
  Phone,
  MessageCircle,
  ClipboardCheck,
  GitBranch,
  Check,
  Clock3,
  RefreshCw,
  UserPlus,
  Send,
  FileCheck,
  Layers,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { PageTitle, Empty } from "./workbench-views";
import { type Customer, type Visit, downloadJson } from "../lib/workbench";
import {
  type PlatformState,
  type Session,
  type Role,
  type Member,
  type Brief,
  type Communication,
  roleNames,
  stages,
  addDays,
} from "../lib/platform";
export type RunCommand = <T = unknown>(command: unknown) => Promise<T>;
export function AuthScreen({
  authenticate,
  request,
  error,
}: {
  authenticate: (path: string, data: unknown) => Promise<void>;
  request: <T>(path: string, data?: unknown) => Promise<T>;
  error: string;
}) {
  const [mode, setMode] = useState<"login" | "setup">("login"),
    [setup, setSetup] = useState(false),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    request<{ setupAvailable: boolean }>("/public/config")
      .then((v) => {
        setSetup(v.setupAvailable);
      })
      .catch((e) => setMessage(e.message));
  }, [request]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setWorking(true);
    setMessage("");
    try {
      await authenticate(
        mode === "setup" ? "/auth/setup" : "/auth/login",
        data,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand">
          <Landmark size={27} />
          <strong>银策 YINGCE</strong>
          <span>展业版 3.0</span>
        </div>
        <span className="eyebrow">FROM POLICY TO ACTION</span>
        <h1>
          有依据的建议，
          <br />
          有进展的每一天。
        </h1>
        <p>
          让制度、客户与团队协作连接起来。
          <br />
          把一次访前准备，推进为可追踪的展业闭环。
        </p>
        <div className="auth-proof">
          <span>
            <ShieldCheck />
            身份与工作空间权限
          </span>
          <span>
            <Database />
            PostgreSQL 数据持久化
          </span>
          <span>
            <GitBranch />
            规则命中与历史快照
          </span>
        </div>
        <div className="auth-mini-flow">
          访前准备 <ArrowRight /> 沟通记录 <ArrowRight /> 归纳审查{" "}
          <ArrowRight /> 跟进闭环
        </div>
      </section>
      <section className="auth-card">
        <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
        <h2>{mode === "setup" ? "初始化管理员" : "管理员登录"}</h2>
        <p>
          {mode === "setup"
            ? "使用专属设置码建立第一个管理员账号。"
            : "使用管理员账号登录你的工作空间。"}
        </p>
        <form onSubmit={submit}>
          {mode === "setup" && (
            <>
              <label className="field">
                管理员设置码
                <Input
                  name="code"
                  type="password"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="field">
                显示名称
                <Input name="name" maxLength={60} required />
              </label>
            </>
          )}
          <label className="field">
            用户名
            <Input
              name="username"
              autoComplete="username"
              placeholder="管理员账号"
              minLength={3}
              maxLength={50}
              required
            />
          </label>
          <label className="field">
            密码
            <Input
              name="password"
              type="password"
              autoComplete={
                mode === "setup" ? "new-password" : "current-password"
              }
              minLength={mode === "setup" ? 12 : 1}
              maxLength={128}
              required
            />
          </label>
          {mode === "setup" && (
            <small>密码至少 12 位；设置码仅能成功使用一次。</small>
          )}
          {(message || error) && (
            <p role="alert" className="error-text">
              {message || error}
            </p>
          )}
          <button className="btn primary auth-submit" disabled={working}>
            {working ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowRight size={17} />
            )}{" "}
            {mode === "setup" ? "创建管理员并进入" : "登录工作空间"}
          </button>
        </form>
        {setup && (
          <button
            className="text-btn setup-link"
            onClick={() => setMode(mode === "setup" ? "login" : "setup")}
          >
            {mode === "setup" ? "返回账号登录" : "首次部署？初始化管理员"}
          </button>
        )}
      </section>
    </div>
  );
}
export function Funnel({
  state,
  compact = false,
}: {
  state: PlatformState;
  compact?: boolean;
}) {
  const total = state.customers.length;
  const reached = stages.map(
    (_, i) => state.customers.filter((c) => (c.maxStage || 0) >= i).length,
  );
  return (
    <section className={"panel funnel-panel " + (compact ? "compact" : "")}>
      <div className="panel-title">
        <div>
          <h2>展业转化进度</h2>
          <p>累计到达各环节的客户数 · 当前可见范围 {total} 位</p>
        </div>
        <span className="tag teal">
          跟进闭环 {total ? Math.round((reached[5] / total) * 100) : 0}%
        </span>
      </div>
      <div className="funnel-grid">
        {stages.map((name, i) => (
          <div className="funnel-step" key={name}>
            <div>
              <span>
                0{i + 1} {name}
              </span>
              <strong>
                {reached[i]}
                <small>位</small>
              </strong>
            </div>
            <div className="funnel-track">
              <i
                style={{
                  width: (total ? (reached[i] / total) * 100 : 0) + "%",
                  opacity: 1 - i * 0.09,
                }}
              />
            </div>
            <small>
              {i === 0
                ? "数据已建档"
                : `上一步转化 ${reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) : 0}%`}
            </small>
          </div>
        ))}
      </div>
      <p className="funnel-note">
        此处展示展业流程进度；审查通过与跟进完成均不表示贷款获批或放款。
      </p>
    </section>
  );
}
export function TeamView({
  state,
  userId,
}: {
  state: PlatformState;
  userId: string;
}) {
  return (
    <>
      <PageTitle
        eyebrow="TEAM MOMENTUM"
        title="看见团队，正在向前的每一步"
        description="按真实保存的准备、沟通、纪要、审查和任务汇总；客户经理仅查看本人负责的范围。"
      />
      <Funnel state={state} />
      <section className="panel team-panel">
        <div className="panel-title">
          <h2>团队现状</h2>
          <span className="tag gray">{state.workspace.name}</span>
        </div>
        <div className="team-table">
          <div className="team-row team-head">
            <span>团队成员</span>
            <span>负责客户</span>
            <span>已沟通</span>
            <span>待办 / 逾期</span>
            <span>跟进完成</span>
          </div>
          {state.members
            .filter(
              (m) =>
                m.active &&
                ["admin", "supervisor", "manager"].includes(m.role) &&
                (state.workspace.role !== "manager" || m.id === userId),
            )
            .map((m) => {
              const clients = state.customers.filter((c) => c.ownerId === m.id);
              const tasks = state.tasks.filter(
                (t) => t.assigneeId === m.id && !t.done,
              );
              const completed = clients.filter((c) => c.stage === 5).length;
              return (
                <div className="team-row" key={m.id}>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{roleNames[m.role]}</small>
                  </div>
                  <b>{clients.length}</b>
                  <span>
                    {clients.filter((c) => (c.maxStage || 0) >= 2).length}
                  </span>
                  <span>
                    {tasks.length} /{" "}
                    <b className="amber-text">
                      {tasks.filter((t) => t.due < state.referenceDate).length}
                    </b>
                  </span>
                  <div>
                    <strong>
                      {clients.length
                        ? Math.round((completed / clients.length) * 100)
                        : 0}
                      %
                    </strong>
                    <div className="mini-progress">
                      <i
                        style={{
                          width:
                            (clients.length
                              ? (completed / clients.length) * 100
                              : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </>
  );
}
export function WorkspaceView({
  state,
  command,
  createWorkspace,
  busy,
}: {
  state: PlatformState;
  command: RunCommand;
  createWorkspace: (name: string) => Promise<void>;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Member | null>(null),
    [workspaceName, setWorkspaceName] = useState("");
  const admin = state.workspace.role === "admin";
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await command({ type: "member.add", ...form });
      setAdding(false);
      toast.success("成员已创建");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE & ACCESS"
        title="一个空间，一支协作的团队"
        description="客户、规则、任务与审查按空间分别保存；成员权限由后端逐次校验。"
      >
        {admin && !state.workspace.demo && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <UserPlus size={16} />
            添加成员
          </button>
        )}
      </PageTitle>
      <div className="workspace-summary">
        <div className="panel">
          <Layers size={22} />
          <h3>{state.workspace.name}</h3>
          <p>
            {state.workspace.demo
              ? "独立演示空间，数据与其他访客分开"
              : "正式工作空间，数据持久保存"}
          </p>
          <span className="tag teal">
            你的权限：{roleNames[state.workspace.role]}
          </span>
        </div>
        <div className="panel">
          <ShieldCheck size={22} />
          <h3>权限与审查</h3>
          <p>
            客户经理处理本人客户；主管协作转派；审查员独立审查；管理员维护成员。
          </p>
          <small>提交人不能审查自己的申请。</small>
        </div>
        <div className="panel">
          <Database size={22} />
          <h3>连接状态</h3>
          <p>PostgreSQL 已连接 · 当前修订 {state.workspace.revision}</p>
          <small>
            API 网关已启用基础限流，超限返回 429。规则与记录保存到后端。
          </small>
        </div>
      </div>
      <section className="panel member-panel">
        <div className="panel-title">
          <h2>空间成员与权限</h2>
          <span>{state.members.length} 位</span>
        </div>
        {state.members.map((m) => (
          <div className="member-row" key={m.id}>
            <span className="avatar">{m.name[0]}</span>
            <div>
              <strong>{m.name}</strong>
              <small>
                {state.workspace.demo ? "预置演示身份" : m.username}
              </small>
            </div>
            <span className="tag gray">{roleNames[m.role]}</span>
            <span className={"tag " + (m.active ? "teal" : "amber")}>
              {m.active ? "有效" : "已停用"}
            </span>
            {admin && !state.workspace.demo && (
              <button className="text-btn" onClick={() => setEditing(m)}>
                管理权限
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="panel permission-matrix">
        <h3>权限范围</h3>
        <p>
          <b>客户经理：</b>本人客户、访前准备、沟通与纪要、跟进任务、提交审查。
        </p>
        <p>
          <b>团队主管：</b>全空间展业、团队进度、转派审查、规则与纪要审查。
        </p>
        <p>
          <b>审查员：</b>查看规则与业务依据、独立审查规则及纪要。
        </p>
        <p>
          <b>管理员：</b>维护空间与成员，并具有主管权限。<b>只读成员：</b>
          查看可见业务，不可修改。
        </p>
      </section>
      {admin && !state.workspace.demo && (
        <section className="panel new-workspace">
          <h3>建立新的工作空间</h3>
          <p>
            新空间具有独立成员、规则和客户数据，自动导入一份模拟资料供初始化体验。
          </p>
          <div>
            <Input
              aria-label="新工作空间名称"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="例如：九江支行 · 小微一组"
            />
            <button
              className="btn"
              disabled={busy || workspaceName.trim().length < 2}
              onClick={async () => {
                try {
                  await createWorkspace(workspaceName);
                  setWorkspaceName("");
                  toast.success("工作空间已建立");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              创建工作空间
            </button>
          </div>
        </section>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>添加空间成员</DialogTitle>
            <DialogDescription>
              成员使用独立用户名和密码登录；不会自动发送任何通知消息。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={add} className="member-form">
            <label className="field">
              用户名
              <Input name="username" pattern="[a-zA-Z0-9_.-]{3,50}" required />
            </label>
            <label className="field">
              显示名称
              <Input name="name" maxLength={60} required />
            </label>
            <label className="field">
              初始密码
              <Input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              成员角色
              <select name="role" defaultValue="manager">
                {Object.entries(roleNames).map(([r, n]) => (
                  <option value={r} key={r}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" disabled={busy}>
              创建成员
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>管理 {editing?.name} 的权限</DialogTitle>
            <DialogDescription>
              调整即时生效。停用前需先转派客户，且必须保留至少一位管理员。
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <label className="field">
                角色
                <select
                  value={editing.role}
                  onChange={(e) =>
                    setEditing({ ...editing, role: e.target.value as Role })
                  }
                >
                  {Object.entries(roleNames).map(([r, n]) => (
                    <option value={r} key={r}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-label">
                <Checkbox
                  checked={editing.active}
                  onCheckedChange={(v) =>
                    setEditing({ ...editing, active: v === true })
                  }
                />
                启用此空间的成员资格
              </label>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await command({
                      type: "member.update",
                      userId: editing.id,
                      role: editing.role,
                      active: editing.active,
                    });
                    setEditing(null);
                    toast.success("权限已更新");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                保存权限
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function ReviewView({
  state,
  session,
  command,
  busy,
}: {
  state: PlatformState;
  session: Session;
  command: RunCommand;
  busy: boolean;
}) {
  const [tab, setTab] = useState("pending"),
    [selected, setSelected] = useState<string | null>(null),
    [comment, setComment] = useState("");
  const current = state.reviews.find((r) => r.id === selected);
  const items = state.reviews
    .filter((r) => tab === "all" || r.status === "pending")
    .slice()
    .reverse();
  const canReview = ["admin", "supervisor", "reviewer"].includes(
    state.workspace.role,
  );
  return (
    <>
      <PageTitle
        eyebrow="REVIEW & HANDOVER"
        title="有人提交，也有人认真复核"
        description="统一处理规则变更、访后纪要与客户转派，保留审查意见和处理身份。"
      />
      <div className="review-tabs">
        <button
          className={"btn " + (tab === "pending" ? "primary" : "")}
          onClick={() => setTab("pending")}
        >
          待审申请 {state.reviews.filter((r) => r.status === "pending").length}
        </button>
        <button
          className={"btn " + (tab === "all" ? "primary" : "")}
          onClick={() => setTab("all")}
        >
          全部记录
        </button>
      </div>
      <div className="review-list">
        {items.length ? (
          items.map((r) => (
            <article className="panel review-card" key={r.id}>
              <div className="review-icon">
                {r.kind === "transfer" ? (
                  <Users />
                ) : r.kind === "rule" ? (
                  <GitBranch />
                ) : (
                  <FileCheck />
                )}
              </div>
              <div>
                <div className="chips">
                  <span className="tag gray">
                    {r.kind === "rule"
                      ? "规则变更"
                      : r.kind === "visit"
                        ? "访后纪要"
                        : "客户转派"}
                  </span>
                  <span
                    className={
                      "tag " +
                      (r.status === "approved"
                        ? "teal"
                        : r.status === "rejected"
                          ? "gray"
                          : "amber")
                    }
                  >
                    {r.status === "pending"
                      ? "待独立审查"
                      : r.status === "approved"
                        ? "已通过"
                        : "已退回"}
                  </span>
                </div>
                <h3>{r.title}</h3>
                <p>
                  {r.submittedName} 提交 ·{" "}
                  {new Date(r.created).toLocaleString("zh-CN")}
                </p>
                {r.comment && <p>审查意见：{r.comment}</p>}
                {r.kind === "transfer" && (
                  <p>转派原因：{String(r.payload.reason || "")}</p>
                )}
              </div>
              <button
                className="btn"
                onClick={() => {
                  setSelected(r.id);
                  setComment("");
                }}
              >
                查看申请
                <ChevronRight size={14} />
              </button>
            </article>
          ))
        ) : (
          <Empty
            title="没有待处理申请"
            description="规则版本、纪要及客户转派申请会汇总在这里。"
          />
        )}
      </div>
      <Dialog open={!!current} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{current?.title}</DialogTitle>
            <DialogDescription>
              此审查只针对展业规则与材料，不替代信贷审批。
            </DialogDescription>
          </DialogHeader>
          {current && (
            <>
              <div className="review-details">
                {current.kind === "rule" &&
                  (() => {
                    const r = state.rules.find(
                      (r) => r.id === current.targetId,
                    );
                    return r ? (
                      <>
                        <h3>{r.title}</h3>
                        <blockquote>{r.excerpt}</blockquote>
                        <p>
                          {r.source} · {r.location} · {r.version}
                        </p>
                      </>
                    ) : (
                      <p>规则已不可见</p>
                    );
                  })()}
                {current.kind === "visit" &&
                  (() => {
                    const v = state.visits.find(
                      (v) => v.id === current.targetId,
                    );
                    return v ? (
                      <>
                        <h3>确认纪要</h3>
                        <p>{v.summary}</p>
                        <h4>原始记录</h4>
                        <blockquote>{v.raw}</blockquote>
                        <h4>待补材料 / 下步跟进</h4>
                        <p>
                          {v.materials || "未填写"}；{v.nextAction} {v.nextDate}
                        </p>
                        <small>
                          关联访前快照 {v.briefId?.slice(0, 8)} ·{" "}
                          {v.ruleSnapshot.length} 条规则
                        </small>
                      </>
                    ) : (
                      <p>纪要已不可见</p>
                    );
                  })()}
                {current.kind === "transfer" && (
                  <p>
                    {String(current.payload.reason || "")}
                    <br />
                    通过后将同时转移该客户未完成的任务。
                  </p>
                )}
              </div>
              {current.status === "pending" &&
              canReview &&
              current.submittedBy !== session.user.id &&
              (current.kind !== "transfer" ||
                state.workspace.role !== "reviewer") ? (
                <>
                  <label className="field">
                    审查意见
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={1000}
                      placeholder="请说明通过依据或需要补充的内容"
                    />
                  </label>
                  <div className="dialog-actions">
                    {(["rejected", "approved"] as const).map((d) => (
                      <button
                        className={"btn " + (d === "approved" ? "primary" : "")}
                        key={d}
                        disabled={busy || comment.trim().length < 2}
                        onClick={async () => {
                          try {
                            await command({
                              type: "review.decide",
                              reviewId: current.id,
                              decision: d,
                              comment,
                            });
                            setSelected(null);
                            toast.success(
                              d === "approved"
                                ? "已审查通过"
                                : "已退回并通知提交人",
                            );
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        {d === "approved" ? "审查通过" : "退回补充"}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="notice info">
                  {current.status !== "pending"
                    ? `处理结果：${current.comment}`
                    : current.submittedBy === session.user.id
                      ? "这是你提交的申请，须由其他审查人员处理。"
                      : "当前身份可查看申请，无权处理此项审查。"}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function NotificationCenter({
  state,
  open,
  onClose,
  command,
  onNavigate,
}: {
  state: PlatformState;
  open: boolean;
  onClose: () => void;
  command: RunCommand;
  onNavigate: (view: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>提醒与通知</DialogTitle>
          <DialogDescription>
            来自当前工作空间的任务到期、转派与审查进展。页面每 30 秒自动同步。
          </DialogDescription>
        </DialogHeader>
        <div className="notification-list">
          {state.notifications.length ? (
            state.notifications
              .slice()
              .reverse()
              .map((n) => (
                <button
                  className={"notification-item " + (!n.read ? "unread" : "")}
                  key={n.id}
                  onClick={async () => {
                    try {
                      if (!n.read)
                        await command({
                          type: "notification.read",
                          notificationId: n.id,
                        });
                      onNavigate(n.kind === "review" ? "reviews" : "followups");
                      onClose();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Bell size={18} />
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <small>
                      {new Date(n.created).toLocaleString("zh-CN")}
                      {n.read ? " · 已读" : ""}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))
          ) : (
            <Empty
              title="暂时没有新通知"
              description="到期任务和申请处理结果会出现在这里。"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerExtras({
  customer: c,
  state,
  command,
  busy,
}: {
  customer: Customer;
  state: PlatformState;
  command: RunCommand;
  busy: boolean;
}) {
  const [contacts, setContacts] = useState(false),
    [transfer, setTransfer] = useState(false);
  const canWrite = ["admin", "supervisor", "manager"].includes(
    state.workspace.role,
  );
  const history = state.briefs
    .filter((b) => b.customerId === c.id)
    .slice(-3)
    .reverse();
  const allCommunication = state.communications
    .filter((x) => x.customerId === c.id)
    .slice(-3)
    .reverse();
  return (
    <>
      <section className="brief-section journey-section">
        <h3>
          <Layers size={17} />
          这位客户的展业进度
        </h3>
        <div className="customer-stages">
          {stages.map((s, i) => (
            <span key={s} className={(c.stage || 0) >= i ? "reached" : ""}>
              <i>{(c.stage || 0) >= i ? <Check size={11} /> : i + 1}</i>
              {s}
            </span>
          ))}
        </div>
        <p className="micro-copy">
          当前负责人：{c.ownerName || "未分配"}{" "}
          {canWrite && (
            <button className="text-btn" onClick={() => setTransfer(true)}>
              申请转派
            </button>
          )}
        </p>
      </section>
      <section className="brief-section">
        <div className="section-heading">
          <h3>沟通渠道</h3>
          {canWrite && (
            <button className="text-btn" onClick={() => setContacts(true)}>
              登记授权渠道
            </button>
          )}
        </div>
        <div className="channel-cards">
          <div>
            <Phone size={19} />
            <strong>电话联系</strong>
            {c.contactConsent && c.phone ? (
              <a className="text-btn" href={`tel:${c.phone.replace(/ /g, "")}`}>
                拨打 {c.phone}
              </a>
            ) : (
              <small>暂无已授权电话号码</small>
            )}
          </div>
          <div>
            <MessageCircle size={19} />
            <strong>微信沟通</strong>
            {c.contactConsent && c.wechat ? (
              <button
                className="text-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.wechat!);
                    toast.success("微信号已复制，请手动联系");
                  } catch {
                    toast.error("复制失败，请手动选择微信号");
                  }
                }}
              >
                {c.wechat} · 复制
              </button>
            ) : (
              <small>暂无已授权微信号</small>
            )}
          </div>
        </div>
        <p className="micro-copy">
          渠道与沟通记录保存到后端；拨号由设备完成，微信由客户经理手动联系。
        </p>
      </section>
      {history.length > 0 && (
        <section className="brief-section">
          <h3>最近的访前准备</h3>
          {history.map((b) => (
            <div className="history-line" key={b.id}>
              <ClipboardCheck size={16} />
              <div>
                <strong>
                  {b.actor} · 优先级 {b.score}
                </strong>
                <small>
                  {new Date(b.created).toLocaleString("zh-CN")} ·{" "}
                  {b.rules.length} 条规则快照
                </small>
                <p>{b.checklist.join("；")}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      {allCommunication.length > 0 && (
        <section className="brief-section">
          <h3>最近沟通记录</h3>
          {allCommunication.map((x) => (
            <div className="history-line" key={x.id}>
              <MessageCircle size={16} />
              <div>
                <strong>
                  {x.actor} · {channelLabel[x.channel]} ·{" "}
                  {outcomeLabel[x.outcome]}
                </strong>
                <small>{new Date(x.created).toLocaleString("zh-CN")}</small>
                <p>{x.content}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      <Dialog open={contacts} onOpenChange={setContacts}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>登记 {c.id} 的沟通渠道</DialogTitle>
            <DialogDescription>
              仅登记已经授权的联系方式；只读成员及审查员不显示完整渠道。
            </DialogDescription>
          </DialogHeader>
          <form
            className="member-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await command({
                  type: "customer.contact",
                  customerId: c.id,
                  phone: String(f.get("phone") || ""),
                  wechat: String(f.get("wechat") || ""),
                  consent: f.get("consent") === "on",
                });
                setContacts(false);
                toast.success("沟通渠道已保存");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <label className="field">
              电话号码
              <Input
                name="phone"
                type="tel"
                defaultValue={c.phone}
                maxLength={24}
              />
            </label>
            <label className="field">
              微信号
              <Input
                name="wechat"
                defaultValue={c.contactConsent ? c.wechat : ""}
                maxLength={80}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="consent"
                defaultChecked={c.contactConsent}
              />
              已取得登记和使用上述联系方式的授权
            </label>
            <button className="btn primary" disabled={busy}>
              保存授权渠道
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={transfer} onOpenChange={setTransfer}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>申请转派 {c.id}</DialogTitle>
            <DialogDescription>
              主管或其他管理员通过后，客户和未完成任务一并转移。
            </DialogDescription>
          </DialogHeader>
          <form
            className="member-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await command({
                  type: "transfer.request",
                  customerId: c.id,
                  ...f,
                });
                setTransfer(false);
                toast.success("转派申请已提交审查");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <label className="field">
              接收成员
              <select name="assigneeId" required defaultValue="">
                <option value="" disabled>
                  选择空间内的业务成员
                </option>
                {state.members
                  .filter(
                    (m) =>
                      m.active &&
                      m.id !== c.ownerId &&
                      ["admin", "supervisor", "manager"].includes(m.role),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {roleNames[m.role]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              转派原因
              <Textarea name="reason" minLength={2} maxLength={500} required />
            </label>
            <button className="btn primary" disabled={busy}>
              提交转派审查
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
const channelLabel = {
  phone: "电话",
  wechat: "微信",
  visit: "当面拜访",
  other: "其他",
};
const outcomeLabel = {
  connected: "已沟通",
  unanswered: "未接通",
  scheduled: "已预约",
};
export function CommunicationDialog({
  productId,
  customer: c,
  state,
  command,
  busy,
  onClose,
  existingVisit,
}: {
  customer: Customer;
  state: PlatformState;
  command: RunCommand;
  busy: boolean;
  onClose: () => void;
  existingVisit?: Visit;
  productId?: string;
}) {
  const latest = state.briefs
    .filter(
      (b) =>
        b.customerId === c.id &&
        (!productId || (b.productId || "PRODUCT-CASHFLOW") === productId),
    )
    .slice(-1)[0];
  const brief =
    state.briefs.find((b) => b.id === existingVisit?.briefId) || latest;
  const [channel, setChannel] = useState<Communication["channel"]>(
      existingVisit?.channel || "phone",
    ),
    [outcome, setOutcome] = useState<Communication["outcome"]>("connected"),
    [raw, setRaw] = useState(existingVisit?.raw || ""),
    [saved, setSaved] = useState(!!existingVisit),
    [draft, setDraft] = useState<Visit | null>(existingVisit || null),
    [ack, setAck] = useState(false);
  const canWrite = ["admin", "supervisor", "manager"].includes(
    state.workspace.role,
  );
  const confirmed =
    draft &&
    ["confirmed", "pending", "approved", "rejected"].includes(
      draft.status || "",
    );
  function edit(key: keyof Visit, value: string) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setAck(false);
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="wide-dialog visit-dialog">
        <DialogHeader>
          <DialogTitle>{c.id} · 沟通与访后归纳</DialogTitle>
          <DialogDescription>
            {brief?.productName || "经营流水类贷款"} · 关联访前快照{" "}
            {brief?.id.slice(0, 8) || "未准备"}
            ，保留原始记录并推进后续任务。
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-stepper">
          <span className="done">1 访前准备</span>
          <ChevronRight size={13} />
          <span className={saved ? "done" : ""}>2 沟通记录</span>
          <ChevronRight size={13} />
          <span className={confirmed ? "done" : ""}>3 归纳与任务</span>
        </div>
        {!brief ? (
          <p className="notice warning">
            请先在作战单中核对并保存访前准备，再记录沟通。
          </p>
        ) : (
          <>
            <div className="two-fields">
              <label className="field">
                沟通渠道
                <select
                  value={channel}
                  disabled={!!draft || !canWrite}
                  onChange={(e) => {
                    setChannel(e.target.value as Communication["channel"]);
                    setSaved(false);
                  }}
                >
                  {Object.entries(channelLabel).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                沟通结果
                <select
                  value={outcome}
                  disabled={!!draft || !canWrite}
                  onChange={(e) => {
                    setOutcome(e.target.value as Communication["outcome"]);
                    setSaved(false);
                  }}
                >
                  {Object.entries(outcomeLabel).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              原始沟通记录
              <Textarea
                value={raw}
                rows={4}
                disabled={!!draft || !canWrite}
                maxLength={30000}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setSaved(false);
                }}
                placeholder="客户明确说了什么？还有什么疑问？约定了哪些下一步？"
              />
            </label>
            {!draft && canWrite && (
              <div className="inline-actions">
                <button
                  className="text-btn"
                  onClick={() => {
                    setRaw(
                      `客户希望扩大采购，计划核实经营周转融资需求。客户询问材料要求。尚缺近6个月经营流水及采购合同。下次于${addDays(state.referenceDate, 2)}联系，跟进材料并核实实际用款时间。`,
                    );
                    setSaved(false);
                  }}
                >
                  填入模拟沟通记录
                </button>
                <button
                  className="btn"
                  disabled={busy || !raw.trim() || saved}
                  onClick={async () => {
                    try {
                      await command({
                        type: "communication.add",
                        customerId: c.id,
                        briefId: brief.id,
                        channel,
                        outcome,
                        content: raw,
                      });
                      setSaved(true);
                      toast.success("沟通记录已保存");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {saved ? <Check size={15} /> : <MessageCircle size={15} />}{" "}
                  {saved ? "沟通已入库" : "保存沟通记录"}
                </button>
              </div>
            )}
            {saved && !draft && outcome !== "connected" && (
              <p className="notice info">
                已保存联系尝试；完成实际沟通后，再归纳客户需求。
              </p>
            )}
            {saved && !draft && outcome === "connected" && canWrite && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  try {
                    const v = await command<Visit>({
                      type: "visit.draft",
                      customerId: c.id,
                      briefId: brief.id,
                      raw,
                      channel,
                    });
                    setDraft(v);
                    setAck(false);
                    toast.success("纪要草稿已在后端生成");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <FileCheck size={16} />
                生成访后纪要草稿
              </button>
            )}
            {draft && (
              <div className="visit-form">
                <div className="notice info">
                  <ClipboardCheck size={18} />
                  <p>
                    {confirmed
                      ? "该纪要已确认，原始记录与规则快照已保存。"
                      : "已按原文提取草稿，请核对后确认；确认时同步更新客户需求、缺失材料和下一步任务。"}
                  </p>
                </div>
                {(
                  [
                    { key: "summary", label: "标准化纪要" },
                    { key: "demand", label: "客户明确需求" },
                    { key: "questions", label: "仍有疑问" },
                    { key: "materials", label: "完整待补材料清单" },
                    { key: "nextAction", label: "下一步跟进任务" },
                  ] as const
                ).map((f) => (
                  <label className="field" key={f.key}>
                    {f.label}
                    <Textarea
                      rows={2}
                      value={draft[f.key]}
                      disabled={!!confirmed || !canWrite}
                      onChange={(e) => {
                        edit(f.key, e.target.value);
                        if (f.key === "materials")
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  materials: e.target.value,
                                  materialsComplete: false,
                                }
                              : d,
                          );
                      }}
                      placeholder="原文未提及的信息保持留空"
                    />
                  </label>
                ))}
                <label className="check-label">
                  <Checkbox
                    checked={draft.materialsComplete || false}
                    disabled={!!confirmed || !canWrite}
                    onCheckedChange={(v) =>
                      setDraft({
                        ...draft,
                        materialsComplete: v === true,
                        materials: v === true ? "" : draft.materials,
                      })
                    }
                  />
                  已核实本次所需材料全部补齐（确认后清空待补清单）
                </label>
                <label className="field">
                  跟进日期
                  <Input
                    type="date"
                    min={state.referenceDate}
                    value={draft.nextDate}
                    disabled={!!confirmed || !canWrite}
                    onChange={(e) => edit("nextDate", e.target.value)}
                  />
                </label>
                {!confirmed && canWrite && (
                  <>
                    <label className="check-label">
                      <Checkbox
                        checked={ack}
                        onCheckedChange={(v) => setAck(v === true)}
                      />
                      我已核对原文与归纳结果，确认更新客户信息并建立跟进任务。
                    </label>
                    <button
                      className="btn primary"
                      disabled={busy || !ack || !draft.summary.trim()}
                      onClick={async () => {
                        try {
                          await command({
                            type: "visit.confirm",
                            visitId: draft.id,
                            summary: draft.summary,
                            demand: draft.demand,
                            questions: draft.questions,
                            materials: draft.materials,
                            materialsComplete: draft.materialsComplete || false,
                            nextAction: draft.nextAction,
                            nextDate: draft.nextDate,
                            ack: true,
                          });
                          setDraft({
                            ...draft,
                            confirmed: true,
                            status: "confirmed",
                          });
                          toast.success("纪要、客户信息和跟进任务已同步保存");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      确认归纳并建立跟进
                    </button>
                  </>
                )}
                {confirmed &&
                  canWrite &&
                  ["confirmed", "rejected"].includes(draft.status || "") && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          await command({
                            type: "visit.submit",
                            visitId: draft.id,
                          });
                          setDraft({ ...draft, status: "pending" });
                          toast.success("已提交审查并提醒审查人员");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Send size={16} />
                      提交独立审查
                    </button>
                  )}
                {draft.status === "pending" && (
                  <p className="notice info">
                    已进入审查队列，等待其他审查人员处理。
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function FollowupBoard({
  state,
  command,
  busy,
  onOpen,
  onRecord,
}: {
  state: PlatformState;
  command: RunCommand;
  busy: boolean;
  onOpen: (c: Customer) => void;
  onRecord: (c: Customer, v?: Visit) => void;
}) {
  const [filter, setFilter] = useState("pending");
  const canWrite = ["admin", "supervisor", "manager"].includes(
    state.workspace.role,
  );
  const tasks = state.tasks.filter(
    (t) => filter === "all" || (filter === "done" ? t.done : !t.done),
  );
  const labels = {
    draft: "待确认草稿",
    confirmed: "已确认 · 待提交",
    pending: "待独立审查",
    approved: "审查通过",
    rejected: "退回补充",
  };
  return (
    <>
      <PageTitle
        eyebrow="FOLLOW-UP LOOP"
        title="把沟通的结果，落实为下一步"
        description="访前快照、渠道记录、纪要和任务彼此关联；每一次推进都更新客户进度。"
      >
        <button
          className="btn"
          disabled={!state.visits.some((v) => v.confirmed) || busy}
          onClick={async () => {
            try {
              await command({
                type: "audit.record",
                action: "导出 CRM",
                target: "已确认纪要与跟进任务",
              });
              downloadJson("银策-CRM待对接数据.json", {
                workspace: state.workspace.name,
                referenceDate: state.referenceDate,
                writeStatus: "pending_external_integration",
                visits: state.visits.filter((v) => v.confirmed),
                tasks: state.tasks,
              });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          导出 CRM 数据
        </button>
      </PageTitle>
      <div className="followup-summary">
        <span>
          <b>{state.tasks.filter((t) => !t.done).length}</b>未完成任务
        </span>
        <span>
          <b>
            {
              state.tasks.filter((t) => !t.done && t.due < state.referenceDate)
                .length
            }
          </b>
          逾期待办
        </span>
        <span>
          <b>{state.visits.filter((v) => v.status === "draft").length}</b>
          待确认草稿
        </span>
        <span>
          <b>{state.visits.filter((v) => v.status === "pending").length}</b>
          待审纪要
        </span>
      </div>
      <div className="review-tabs">
        {[
          ["pending", "待跟进"],
          ["done", "已完成"],
          ["all", "全部任务"],
        ].map(([k, l]) => (
          <button
            className={"btn " + (filter === k ? "primary" : "")}
            onClick={() => setFilter(k)}
            key={k}
          >
            {l}
          </button>
        ))}
      </div>
      <section className="panel followup-list">
        {tasks.length ? (
          tasks.map((t) => (
            <div
              className={"followup-item " + (t.done ? "done" : "")}
              key={t.id}
            >
              <Checkbox
                checked={t.done}
                disabled={busy || !canWrite}
                aria-label={`完成任务 ${t.customerId} ${t.title}`}
                onCheckedChange={async (v) => {
                  try {
                    await command({
                      type: "task.toggle",
                      taskId: t.id,
                      done: v === true,
                    });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
              <div>
                <strong>{t.title}</strong>
                <p>
                  {t.customerId} · {t.assigneeName} ·{" "}
                  {t.source.startsWith("纪要")
                    ? "来自访后纪要"
                    : "模拟初始化任务"}
                </p>
              </div>
              <span
                className={
                  "deadline-tag " +
                  (!t.done && t.due < state.referenceDate ? "overdue" : "")
                }
              >
                {t.due < state.referenceDate && !t.done
                  ? "已逾期 "
                  : t.due === state.referenceDate
                    ? "今天 "
                    : ""}
                {t.due}
              </span>
              <button
                className="text-btn"
                onClick={() => {
                  const c = state.customers.find((c) => c.id === t.customerId);
                  if (c) onOpen(c);
                }}
              >
                查看作战单
                <ChevronRight size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="当前没有此类任务"
            description="确认访后纪要时，可自动建立下一步跟进任务。"
          />
        )}
      </section>
      <div className="section-heading records-heading">
        <h2>纪要与闭环记录</h2>
        <span className="micro-copy">草稿可继续填写，确认后可提交独立审查</span>
      </div>
      <div className="records-grid">
        {state.visits.length ? (
          state.visits
            .slice()
            .reverse()
            .map((v) => (
              <button
                className="panel record-card"
                key={v.id}
                onClick={() => {
                  const c = state.customers.find((c) => c.id === v.customerId);
                  if (c) onRecord(c, v);
                }}
              >
                <div>
                  <strong>{v.customerId}</strong>
                  <span
                    className={
                      "tag " +
                      (v.status === "approved"
                        ? "teal"
                        : v.status === "pending"
                          ? "amber"
                          : "gray")
                    }
                  >
                    {labels[v.status || "draft"]}
                  </span>
                </div>
                <p>{v.summary || "纪要草稿，等待归纳确认"}</p>
                <footer>
                  {v.nextDate ? "下次跟进 " + v.nextDate : "尚未约定下次日期"}
                  <ArrowRight size={15} />
                </footer>
                <small>
                  关联访前快照 {v.briefId?.slice(0, 8)} ·{" "}
                  {v.ruleSnapshot.length} 条历史规则
                </small>
              </button>
            ))
        ) : (
          <section className="panel empty-record">
            <ClipboardCheck />
            <p>完成访前准备后，记录一次沟通，开始这条闭环。</p>
          </section>
        )}
      </div>
    </>
  );
}
