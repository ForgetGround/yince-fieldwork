"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  ScanLine,
  ShieldCheck,
  Clock3,
  Check,
  ChevronRight,
  AlertTriangle,
  Upload,
  Download,
  Sparkles,
  Search,
  GitBranch,
  Link2,
  CheckCircle2,
  ClipboardList,
  Info,
  RotateCcw,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { priorityLevel, sceneTags } from "../lib/platform";
import type { PlatformState } from "../lib/platform";
import {
  type State,
  type Rule,
  type Customer,
  type Task,
  type Visit,
  DEMO_DATE,
  PRODUCT,
  opportunity,
  signals,
  evaluateRule,
  compilePolicy,
  extractVisit,
  downloadJson,
  validateCustomers,
  sampleCustomers,
} from "@/lib/workbench";
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function CustomerTable({
  customers,
  onOpen,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>客户 / 行业</TableHead>
          <TableHead>联系理由</TableHead>
          <TableHead>优先级</TableHead>
          <TableHead className="last-contact">最近联系</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => {
          const o = opportunity(c);
          return (
            <TableRow key={c.id}>
              <TableCell>
                <button className="customer-cell" onClick={() => onOpen(c)}>
                  <span className={"customer-avatar " + o.color}>
                    {c.id.slice(-3)}
                  </span>
                  <div>
                    <strong>{c.id}</strong>
                    <small>{c.industry}</small>
                  </div>
                </button>
              </TableCell>
              <TableCell>
                <span className={"tag " + o.color}>{o.type}</span>
                <p className="reason-text">{o.reason}</p>
                {c.maturityDate && (
                  <span
                    className={
                      "table-deadline " +
                      (c.daysToMaturity !== null && c.daysToMaturity <= 15
                        ? "urgent"
                        : "")
                    }
                  >
                    到期 {c.maturityDate}
                  </span>
                )}
                <div className="scene-tags">
                  {sceneTags(c)
                    .slice(0, 2)
                    .map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                </div>
              </TableCell>
              <TableCell>
                <div
                  className={"score " + priorityLevel(o.score).className}
                  title={priorityLevel(o.score).label}
                >
                  {o.score}
                  <span>/ 100</span>
                </div>
                <div
                  className={"score-track " + priorityLevel(o.score).className}
                >
                  <i style={{ width: o.score + "%" }} />
                </div>
              </TableCell>
              <TableCell className="last-contact muted">
                {c.lastContactDays} 天前
              </TableCell>
              <TableCell>
                <button
                  className="row-action"
                  aria-label={"查看 " + c.id + " 作战单"}
                  onClick={() => onOpen(c)}
                >
                  <ChevronRight size={18} />
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Search size={29} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function SourceDialog({
  rule,
  onClose,
}: {
  rule: Rule | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!rule} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="source-dialog">
        <DialogHeader>
          <DialogTitle>规则来源追溯</DialogTitle>
          <DialogDescription>
            查看原文、适用范围与人工核查状态
          </DialogDescription>
        </DialogHeader>
        {rule && (
          <>
            <div className="source-breadcrumb">
              <FileText size={18} />
              {rule.source}
            </div>
            <div className="meta-row">
              <span>{rule.location}</span>
              <span className={"tag " + (rule.synthetic ? "amber" : "teal")}>
                {rule.synthetic ? "演示 / 本机导入资料" : "用户提供的原始资料"}
              </span>
            </div>
            <blockquote className="source-quote">{rule.excerpt}</blockquote>
            {rule.documentText && (
              <details className="source-fulltext">
                <summary>完整导入原文（含未编译段落）</summary>
                <pre>{rule.documentText}</pre>
              </details>
            )}
            <dl className="detail-grid">
              <div>
                <dt>规则编号</dt>
                <dd>{rule.id}</dd>
              </div>
              <div>
                <dt>规则版本</dt>
                <dd>{rule.version}</dd>
              </div>
              <div>
                <dt>文件生效日</dt>
                <dd>{rule.effective || "原文未提供，待核实"}</dd>
              </div>
              <div>
                <dt>产品范围</dt>
                <dd>{PRODUCT}</dd>
              </div>
            </dl>
            <div className="code-rule">
              {rule.field}{" "}
              {rule.operator === "gte"
                ? "≥"
                : rule.operator === "eq"
                  ? "="
                  : "→"}{" "}
              {String(rule.value ?? "人工复核")}
            </div>
            {rule.note && (
              <p className="info-note">
                <Info size={16} />
                {rule.note}
              </p>
            )}
            <p className="muted-copy">
              “演示生效”表示当前空间的模拟规则已启用，不代表该资料已被核实为银行现行制度。
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function RulesView({
  state,
  onSource,
  onActivate,
  onCompile,
}: {
  state: State;
  onSource: (r: Rule) => void;
  onActivate: (id: string) => void;
  onCompile: (rules: Rule[]) => Promise<boolean>;
}) {
  const products = (state as Partial<PlatformState>).products || [];
  const strategies = (state as Partial<PlatformState>).strategies || [];
  const [tab, setTab] = useState("rules");
  const [compiler, setCompiler] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<Rule[] | null>(null);
  const [selected, setSelected] = useState<(typeof products)[number] | null>(
    null,
  );
  const [ack, setAck] = useState(false);
  const [activate, setActivate] = useState<Rule | null>(null);
  const [error, setError] = useState("");
  const pending = state.rules.filter((r) => r.status === "pending");
  const conflicts = pending.filter((r) =>
    state.rules.some(
      (a) =>
        a.status === "active" &&
        a.field === r.field &&
        (a.operator !== r.operator || a.value !== r.value),
    ),
  );
  return (
    <>
      <PageTitle
        eyebrow="POLICY COMPILER"
        title="让制度，成为可执行的规则"
        description="保留原文、版本与例外条件，每次变更经过人工确认。"
      >
        <button
          className="btn primary"
          onClick={() => {
            setCompiler(true);
            setResult(null);
            setError("");
          }}
        >
          <ScanLine size={16} />
          编译新政策
        </button>
      </PageTitle>
      <div className="notice info">
        <ShieldCheck size={18} />
        <div>
          <strong>当前为演示规则集</strong>
          <p>
            产品截图未注明名称、生效日期与完整制度版本。8
            条初始规则仅供闭环演示；附件中的利率与额度均保留为待核实资料。
          </p>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="conflict-banner">
          <div className="conflict-icon">
            <GitBranch size={23} />
          </div>
          <div>
            <strong>{pending.length} 条规则等待确认</strong>
            <p>
              检测到 {conflicts.length}{" "}
              条与当前规则条件不同的候选。相同条件不视为冲突；确认适用版本后重新核查客户条件。
            </p>
          </div>
          <button
            className="btn warning"
            onClick={() => {
              setActivate(pending[0]);
              setAck(false);
            }}
          >
            处理规则变更
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="section-tabs" variant="line">
          <TabsTrigger value="rules">
            规则与版本 <span>{state.rules.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sources">
            附件产品库 <span>5</span>
          </TabsTrigger>
          <TabsTrigger value="strategy">展业排序策略</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "rules" && (
        <section className="rule-list">
          {state.rules.map((r) => (
            <article
              className={
                "panel rule-card " + (r.status === "archived" ? "archived" : "")
              }
              key={r.id}
            >
              <div className="rule-icon">
                <FileText size={22} />
              </div>
              <div className="rule-body">
                <div className="rule-heading">
                  <h3>{r.title}</h3>
                  <span
                    className={
                      "tag " +
                      (r.status === "active"
                        ? "teal"
                        : r.status === "pending"
                          ? "amber"
                          : "gray")
                    }
                  >
                    {r.status === "active"
                      ? "演示生效"
                      : r.status === "pending"
                        ? "待人工确认"
                        : "历史版本"}
                  </span>
                  {r.synthetic && (
                    <span className="tag amber">模拟 / 导入</span>
                  )}
                </div>
                <p>
                  {r.location} <span>·</span> {r.version} <span>·</span>{" "}
                  {r.effective
                    ? `演示生效日 ${r.effective}`
                    : "正式生效日待核实"}
                </p>
                <code>
                  {r.field}{" "}
                  {r.operator === "gte" ? "≥" : r.operator === "eq" ? "=" : "→"}{" "}
                  {String(r.value ?? "人工复核")}
                </code>
              </div>
              <div className="rule-actions">
                <button className="text-btn" onClick={() => onSource(r)}>
                  <Link2 size={14} />
                  原文依据
                </button>
                {r.status === "pending" && (
                  <button
                    className="btn"
                    onClick={() => {
                      setActivate(r);
                      setAck(false);
                    }}
                  >
                    提交审查
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
      {tab === "sources" && (
        <>
          <div className="notice plain">
            <FileText size={18} />
            <div>
              <strong>九江银行服务民营企业、小微企业信贷产品</strong>
              <p>
                来源：P020250723600413272167.et · Sheet1，第 3–7
                行。原文件未提供制度生效日；联系人信息未纳入产品库。
              </p>
            </div>
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <button
                className="panel product-card"
                onClick={() => setSelected(p)}
                key={p.name}
              >
                <div className="product-card-top">
                  <span className="file-icon">
                    <FileText size={24} />
                  </span>
                  <span className="tag gray">待业务核实</span>
                </div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div className="product-card-footer">
                  Sheet1 · C{p.row}:L{p.row}
                  <ArrowUpRight size={17} />
                </div>
              </button>
            ))}
          </div>
          <div className="notice plain">
            <Info size={18} />
            <div>
              <strong>参考材料各有用途</strong>
              <p>
                截图 1 用于了解行员展业场景；截图 2 是 2023 年“九派贷 /
                九派通”新闻，不能直接等同于表内“九融贷”的准入制度。截图 3
                是本演示的规则提取来源。
              </p>
            </div>
          </div>
        </>
      )}
      {tab === "strategy" && (
        <section className="panel strategy-panel">
          <h2>优先级怎么算</h2>
          <p>
            用于安排联系顺序，与授信、额度及审批概率无关。所有权重均为演示设置。
          </p>
          <div className="strategy-equation">
            优先级 = min（100，各项联系权重之和）
          </div>
          {strategies.map((s) => (
            <div className="strategy-row" key={s.id}>
              <code>{s.id}</code>
              <div>
                <strong>{s.title}</strong>
                <p>{s.condition}</p>
              </div>
              <b>+{s.points}</b>
            </div>
          ))}
          <div className="notice info">
            <Info size={17} />
            <p>
              未知字段不加分；负数到期天数不触发续贷窗口。经营年限等产品规则只用于访前条件核查，不把“不满足已知条件”当成拒贷结论。
            </p>
          </div>
        </section>
      )}
      <Dialog open={compiler} onOpenChange={setCompiler}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>编译一份新政策</DialogTitle>
            <DialogDescription>
              当前范围为截图 3 的经营流水类贷款。模板仅解析明确“满 /
              不少于”的年限条件；候选均待确认。
            </DialogDescription>
          </DialogHeader>
          <label className="field">
            文件名称
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setResult(null);
              }}
              placeholder="例如：经营贷补充通知（演示）"
            />
          </label>
          <label className="upload-zone">
            <Upload size={21} />
            <span>读取 TXT / Markdown 文本文件</span>
            <small>最大 100 KB；PDF、Word、ET 请先提取文本后粘贴</small>
            <input
              type="file"
              accept=".txt,.md,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 100000) {
                  setError("文件超过 100 KB，请精简后导入");
                  return;
                }
                try {
                  setText(await f.text());
                  setName(f.name);
                  setResult(null);
                  setError("");
                } catch {
                  setError("文件无法读取，请改为粘贴文本");
                }
              }}
            />
          </label>
          <label className="field">
            制度原文
            <Textarea
              rows={5}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              placeholder="企业持续经营年限不少于2年。"
            />
          </label>
          <button
            className="text-btn"
            onClick={() => {
              setText(
                "【模拟通知】企业持续经营年限不少于2年。\n需提供有效营业执照。\n特殊例外由业务人员审核。",
              );
              setName("经营年限调整通知（模拟）");
              setResult(null);
            }}
          >
            填入演示通知
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {result !== null && (
            <div className="compiler-result">
              <strong>
                {result.length
                  ? `识别到 ${result.length} 条经营年限候选`
                  : "未识别到可安全编译的经营年限条件"}
              </strong>
              {result.map((r) => (
                <p key={r.id}>
                  {r.title} <small>· {r.location}</small>
                </p>
              ))}
              <p>
                原文共 {text.split(/\n|[。；;]/).filter((x) => x.trim()).length}{" "}
                段。其余内容及所有例外需要人工整理；当前未调用大模型。
              </p>
            </div>
          )}
          <div className="dialog-actions">
            <button
              className="btn"
              onClick={() => {
                try {
                  setResult(compilePolicy(text, name));
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <ScanLine size={16} />
              提取候选规则
            </button>
            <button
              className="btn primary"
              disabled={!result?.length}
              onClick={async () => {
                if (result?.length) {
                  if (!(await onCompile(result))) return;
                  setCompiler(false);
                  setText("");
                  setResult(null);
                }
              }}
            >
              保存为待确认规则
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!activate} onOpenChange={(v) => !v && setActivate(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>确认适用规则版本</DialogTitle>
            <DialogDescription>
              仅影响当前工作空间的规则集。历史访前与访后快照保持原版本。
            </DialogDescription>
          </DialogHeader>
          {activate && (
            <>
              <div className="version-compare">
                <div>
                  <span className="eyebrow">当前版本</span>
                  {state.rules
                    .filter(
                      (r) =>
                        r.field === activate.field && r.status === "active",
                    )
                    .map((r) => (
                      <div key={r.id}>
                        <h3>{r.title}</h3>
                        <p>
                          {r.version} · {r.location}
                        </p>
                      </div>
                    ))}
                </div>
                <ArrowRight size={20} />
                <div>
                  <span className="eyebrow">候选版本</span>
                  <h3>{activate.title}</h3>
                  <p>
                    {activate.version} ·{" "}
                    {activate.effective || "生效日期未提供"}
                  </p>
                </div>
              </div>
              <p className="notice warning">
                <AlertTriangle size={18} />
                将影响{" "}
                {
                  state.customers.filter((c) => {
                    const prior = state.rules.find(
                      (r) =>
                        r.status === "active" && r.field === activate.field,
                    );
                    return (
                      (prior ? evaluateRule(c, prior) : "unknown") !==
                      evaluateRule(c, { ...activate, status: "active" })
                    );
                  }).length
                }{" "}
                位客户的经营年限核查；未知经营年限仍显示“待核实”。
              </p>
              <label className="check-label">
                <Checkbox
                  checked={ack}
                  onCheckedChange={(v) => setAck(v === true)}
                />
                我已核对来源及适用范围，确认提交此版本并等待其他人员审查。
              </label>
              <button
                className="btn primary"
                disabled={!ack}
                onClick={() => {
                  onActivate(activate.id);
                  setActivate(null);
                }}
              >
                <Check size={16} />
                提交独立审查
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="wide-dialog product-detail">
          <DialogHeader>
            <DialogTitle>{selected?.name} · 原始产品资料</DialogTitle>
            <DialogDescription>
              附件历史资料，未经现行有效性核实，不作为直接对客报价或承诺。
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              {[
                { key: "客户对象", value: selected.audience, col: "E" },
                { key: "金额范围", value: selected.amount, col: "G" },
                { key: "申请条件", value: selected.conditions, col: "H" },
                { key: "期限", value: selected.term, col: "J" },
                { key: "利率（原文）", value: selected.rate, col: "K" },
                { key: "办理流程", value: selected.process, col: "I" },
                { key: "增信方式", value: selected.guarantee, col: "L" },
              ].map((s) => (
                <section className="product-section" key={s.key}>
                  <h3>
                    {s.key}
                    <small>
                      Sheet1!{s.col}
                      {selected.row}
                    </small>
                  </h3>
                  <p>{s.value}</p>
                </section>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function CustomerDetail({
  customer,
  rules,
  onClose,
  onSource,
  onVisit,
  onConfirm,
  prepared = false,
  busy = false,
  canWrite = true,
  children,
  referenceDate = DEMO_DATE,
}: {
  customer: Customer | null;
  rules: Rule[];
  onClose: () => void;
  onSource: (r: Rule) => void;
  onVisit: (c: Customer) => void;
  onConfirm: (c: Customer) => Promise<void>;
  prepared?: boolean;
  busy?: boolean;
  canWrite?: boolean;
  children?: React.ReactNode;
  referenceDate?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  if (!customer) return null;
  const c = customer;
  const active = rules.filter((r) => r.status === "active");
  const o = opportunity(c);
  const passed = active.filter((r) => evaluateRule(c, r) === "pass").length;
  return (
    <Sheet open={true} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="battle-sheet">
        <SheetHeader className="battle-header">
          <div className="eyebrow">PRE-VISIT BRIEF</div>
          <SheetTitle>
            访前作战单 <span>{c.id}</span>
          </SheetTitle>
          <SheetDescription>
            {c.industry} · {c.origin} · 数据日 {referenceDate}
          </SheetDescription>
        </SheetHeader>
        <div className="battle-content">
          {c.daysToMaturity !== null && (
            <div
              className={
                "maturity-banner " + (c.daysToMaturity <= 15 ? "urgent" : "")
              }
            >
              <div>
                <small>
                  {c.daysToMaturity < 0 ? "已过到期日" : "距离贷款到期"}
                </small>
                <strong>
                  {Math.abs(c.daysToMaturity)}
                  <span>天</span>
                </strong>
                <p>到期日 {c.maturityDate || "待核实"}</p>
              </div>
              <div className="chips">
                {sceneTags(c).map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="battle-lead">
            <div>
              <span className={"tag " + o.color}>{o.type}</span>
              <h3>本次联系，先核实什么</h3>
              <p>
                {o.reason}
                。建议核实当前经营情况、资金用途与用款安排，再讨论适合的服务方案。
              </p>
            </div>
            <div className={"battle-score " + priorityLevel(o.score).className}>
              <strong>{o.score}</strong>
              <span>联系优先级</span>
            </div>
          </div>
          <section className="brief-section">
            <h3>
              <Link2 size={17} />
              建议从哪里来 · 命中规则
            </h3>
            <div className="evidence-list">
              {signals(c).map((s) => (
                <div className="evidence" key={s.label}>
                  <span>+{s.points}</span>
                  <div>
                    <strong>{s.label}</strong>
                    <p>{s.evidence}</p>
                    {"condition" in s && (
                      <small className="rule-hit-condition">
                        触发条件：{String(s.condition)}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="micro-copy">
              演示策略求和后封顶 100；此分数不表示贷款成功概率。
            </p>
          </section>
          <section className="brief-section">
            <h3>当前业务与可了解的服务</h3>
            <div className="chips">
              {c.products.length ? (
                c.products.map((p) => (
                  <span className="tag gray" key={p}>
                    {p}
                  </span>
                ))
              ) : (
                <span className="muted-copy">已持有产品信息缺失</span>
              )}
            </div>
            <p>
              {o.type === "续贷服务"
                ? "先讨论现有贷款到期安排与续贷服务；如客户存在新增经营资金需求，再核实经营流水类贷款适用情况。"
                : o.type === "材料补充"
                  ? "跟进已表达的经营融资需求，逐项核对待补信息；产品匹配需在资料补齐后重新确认。"
                  : "先核实真实经营需求；经营流水类贷款仅作为进一步了解的方向。"}
            </p>
          </section>
          <section className="brief-section">
            <div className="section-heading">
              <h3>基础条件核查</h3>
              <span className="tag teal">
                {passed} / {active.length} 已知条件符合
              </span>
            </div>
            <p className="micro-copy">
              产品名称与制度有效性待核实；以下是演示核查，不能据此作出授信决定。
            </p>
            {active.map((r) => {
              const status = evaluateRule(c, r);
              return (
                <div className="condition-row" key={r.id}>
                  <span className={"condition-state " + status}>
                    {status === "pass" ? (
                      <CheckCircle2 size={16} />
                    ) : status === "fail" ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <CircleHelpIcon />
                    )}
                  </span>
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {status === "pass"
                        ? "已知字段符合"
                        : status === "fail"
                          ? "暂未满足 · 需人工复核"
                          : "信息缺失 / 需人工核实"}{" "}
                      · {r.version} · 数据值：
                      {r.field === "manual"
                        ? "需人工核实"
                        : c[r.field] === null
                          ? "未提供"
                          : typeof c[r.field] === "boolean"
                            ? c[r.field]
                              ? "是"
                              : "否"
                            : String(c[r.field]) + " 年"}
                    </small>
                  </div>
                  <button className="text-btn" onClick={() => onSource(r)}>
                    依据
                  </button>
                </div>
              );
            })}
          </section>
          <section className="brief-section">
            <h3>沟通时重点询问</h3>
            <ol className="question-list">
              <li>
                {c.daysToMaturity !== null
                  ? `现有贷款${c.daysToMaturity >= 0 ? `将在 ${c.daysToMaturity} 天后到期` : "已过到期日"}，目前有哪些还款及资金安排？`
                  : "近期是否有采购、备货或日常经营周转需求？"}
              </li>
              <li>资金的具体用途、预计金额和使用时间是什么？</li>
              <li>近半年经营与结算情况是否变化，能否提供相应材料？</li>
              {c.operatingYears === null && (
                <li>企业实际持续经营了多久，有哪些可以核实的证明？</li>
              )}
              <li>是否愿意按流程授权核实必要的经营与信用信息？</li>
            </ol>
          </section>
          <section className="brief-section">
            <h3>提前准备与待补资料</h3>
            <div className="material-list">
              {[
                ...new Set([
                  ...c.missing,
                  "有效营业执照",
                  "经营情况及资金用途说明",
                  "经授权的经营流水摘要",
                ]),
              ].map((m) => (
                <span key={m}>
                  <ClipboardList size={14} />
                  {m}
                </span>
              ))}
            </div>
            <p className="micro-copy">
              以上为演示准备建议；正式材料目录需以核实后的银行制度为准。
            </p>
          </section>
          <section className="brief-warning">
            <ShieldCheck size={18} />
            <div>
              <strong>沟通边界</strong>
              <p>
                不承诺审批通过、授信额度、最低利率或放款时间。截图中的“3.85%
                起”“最快当日”等表述未核实有效性，不作为本次对客承诺。
              </p>
            </div>
          </section>
          {children}
          {canWrite && (
            <>
              <label className="check-label">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                我已核对命中规则、客户信息及本次沟通准备。
              </label>
              <button
                className="btn"
                disabled={!confirmed || busy}
                onClick={async () => {
                  try {
                    await onConfirm(c);
                    setConfirmed(false);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <ClipboardList size={16} />
                {prepared ? "保存一份新的访前快照" : "确认并保存访前准备"}
              </button>
            </>
          )}
        </div>
        <div className="battle-footer">
          <span>
            <ShieldCheck size={15} />
            所有建议需人工核实
          </span>
          <button
            className="btn primary"
            disabled={!prepared || busy || !canWrite}
            onClick={() => onVisit(c)}
          >
            沟通与访后归纳
            <ArrowRight size={16} />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function CircleHelpIcon() {
  return <Info size={16} />;
}
export function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (c: Customer[]) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Customer[] | null>(null);
  const [ack, setAck] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>导入脱敏客户</DialogTitle>
          <DialogDescription>
            导入当前工作空间的数据库；仅接受白名单业务特征，最多 500 位。
          </DialogDescription>
        </DialogHeader>
        <label className="upload-zone">
          <Upload size={24} />
          <span>选择 JSON 客户数据文件</span>
          <small>最大 1 MB · 编号格式 KH-001</small>
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1000000) {
                setError("文件超过 1 MB");
                return;
              }
              try {
                setText(await f.text());
                setPreview(null);
                setAck(false);
                setError("");
              } catch {
                setError("文件无法读取");
              }
            }}
          />
        </label>
        <div className="inline-actions">
          <button
            className="text-btn"
            onClick={() => {
              const samples = sampleCustomers().map(({ origin, ...c }) => c);
              setText(JSON.stringify(samples, null, 2));
              setPreview(null);
              setAck(false);
            }}
          >
            载入 20 位模拟客户
          </button>
          <button
            className="text-btn"
            onClick={() =>
              downloadJson(
                "脱敏客户导入模板.json",
                sampleCustomers()
                  .slice(0, 2)
                  .map(({ origin, ...c }) => c),
              )
            }
          >
            <Download size={14} />
            下载模板
          </button>
        </div>
        <label className="field">
          或粘贴 JSON
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
              setAck(false);
            }}
            rows={6}
            placeholder='[{"id":"KH-021","industry":"制造业","lastContactDays":12}]'
          />
        </label>
        <p className="micro-copy">
          姓名、身份证、手机号、完整流水不在导入字段中。空缺字段使用
          null，不能用 0 替代。天数以导入当日为基准，后端自动换算为到期日期。
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button
          className="btn"
          onClick={() => {
            try {
              setPreview(validateCustomers(JSON.parse(text)));
              setError("");
            } catch (e) {
              setError(
                e instanceof SyntaxError
                  ? "JSON 格式不正确，请检查引号与逗号"
                  : (e as Error).message,
              );
              setPreview(null);
            }
          }}
        >
          <ShieldCheck size={16} />
          校验数据
        </button>
        {preview && (
          <div className="compiler-result">
            <strong>校验通过：{preview.length} 位客户</strong>
            <p>
              将按编号合并。重复编号会更新客户特征，既有访后快照保持原记录。
            </p>
            <label className="check-label">
              <Checkbox
                checked={ack}
                onCheckedChange={(v) => setAck(v === true)}
              />
              已确认数据经过脱敏，可保存到当前工作空间。
            </label>
          </div>
        )}
        <div className="dialog-actions">
          <button
            className="btn primary"
            disabled={!preview || !ack}
            onClick={async () => {
              if (preview && ack) {
                if (!(await onImport(preview))) return;
                setText("");
                setPreview(null);
                setAck(false);
                onClose();
              }
            }}
          >
            确认导入并识别机会
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function AuditView({
  state,
  onExport,
  onSource,
}: {
  state: State;
  onExport: () => void;
  onSource: (r: Rule) => void;
}) {
  return (
    <>
      <PageTitle
        eyebrow="COMPLIANCE & TRACEABILITY"
        title="每一次判断，都可以回看"
        description="查看建议生成、人工确认和规则变更的演示操作记录。"
      >
        <button className="btn" onClick={onExport}>
          <Download size={16} />
          导出审计记录
        </button>
      </PageTitle>
      <div className="audit-principles">
        {[
          {
            title: "只用必要特征",
            text: "客户编号与业务汇总字段；不读取身份证或完整流水",
            icon: ShieldCheck,
          },
          {
            title: "建议需要确认",
            text: "规则变更、沟通准备及 CRM 纪要均由使用者确认",
            icon: CheckCircle2,
          },
          {
            title: "保留来源版本",
            text: "历史纪要保存当时的规则快照与原始沟通文本",
            icon: GitBranch,
          },
        ].map((p) => (
          <div className="panel principle" key={p.title}>
            <p.icon size={23} />
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
      <div className="notice info">
        <Info size={18} />
        <div>
          <strong>身份、操作与工作空间一起留痕</strong>
          <p>
            操作人来自后端会话，日志保存在
            PostgreSQL；应用数据库账号仅能新增和读取审计记录。数据库管理员仍可管理底层数据，此实现不等同于生产审计认证。
          </p>
        </div>
      </div>
      <section className="panel audit-table">
        <div className="panel-title">
          <h2>操作日志</h2>
          <span className="tag gray">{state.audit.length} 条</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间 / 操作人</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>对象与明细</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.audit
              .slice()
              .reverse()
              .map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <strong>
                      {new Date(a.time).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </strong>
                    <small>{a.actor}</small>
                  </TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>
                    <strong>{a.target}</strong>
                    <p>{a.detail}</p>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </section>
      <div className="section-heading records-heading">
        <h2>历史规则版本</h2>
      </div>
      <div className="rule-history">
        {state.rules.filter((r) => r.status === "archived").length ? (
          state.rules
            .filter((r) => r.status === "archived")
            .map((r) => (
              <button
                className="panel history-item"
                key={r.id}
                onClick={() => onSource(r)}
              >
                <GitBranch size={18} />
                <div>
                  <strong>{r.title}</strong>
                  <p>
                    {r.version} · {r.location}
                  </p>
                </div>
                <ArrowUpRight size={17} />
              </button>
            ))
        ) : (
          <p className="muted-copy">
            尚未替换过规则版本。确认一次规则变更后，将在这里保留旧版本。
          </p>
        )}
      </div>
    </>
  );
}
export function Guide({
  open,
  onClose,
  onStep,
}: {
  open: boolean;
  onClose: () => void;
  onStep: (step: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>五分钟，走完一次展业闭环</DialogTitle>
          <DialogDescription>
            模拟客户的到期日期按空间创建日生成，并随当前日期计算。
          </DialogDescription>
        </DialogHeader>
        <div className="guide-steps">
          {[
            {
              title: "查看制度与来源",
              text: "打开政策规则库，点击“原文依据”；附件产品库可查看 5 款产品的单元格出处。",
            },
            {
              title: "处理一个版本冲突",
              text: "将经营年限从 1 年调整到 2 年的模拟通知，提交后由其他审查人员确认启用。",
            },
            {
              title: "识别客户机会",
              text: "查看 20 位模拟客户的动态排序，也可导入 JSON 脱敏客户。",
            },
            {
              title: "生成访前作战单",
              text: "打开 KH-001，查看联系理由、权重、基础条件、缺失信息与沟通问题。",
            },
            {
              title: "记录拜访并跟进",
              text: "输入模拟拜访记录，保存沟通、生成并确认纪要，建立任务后提交独立审查。",
            },
          ].map((s, i) => (
            <button
              key={s.title}
              onClick={() => {
                onStep(i);
                onClose();
              }}
            >
              <span>0{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </div>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
        <div className="notice info">
          <Info size={18} />
          <div>
            <strong>能力范围</strong>
            <p>
              当前是可操作的本机规则与模板演示，未接入大模型、银行 CRM
              或审批系统。记录保存在当前浏览器；可在跟进页和审计页导出。正式上线需接入可信制度解析、授权数据、身份权限与服务端审计。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
