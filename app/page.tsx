"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Landmark,
  LayoutDashboard,
  ScanLine,
  Users,
  ClipboardList,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Upload,
  Bell,
  Search,
  TrendingUp,
  Layers,
  FileCheck,
  LogOut,
  RefreshCw,
  LoaderCircle,
  Database,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import {
  PageTitle,
  CustomerTable,
  Empty,
  CustomerDetail,
  ImportDialog,
  AuditView,
  Guide,
  SourceDialog,
} from "@/components/workbench-views";
import {
  AuthScreen,
  TeamView,
  WorkspaceView,
  ReviewView,
  NotificationCenter,
  CustomerExtras,
  CommunicationDialog,
  FollowupBoard,
} from "@/components/platform-views";
import { usePlatform } from "@/hooks/use-platform";
import {
  type Customer,
  type Rule,
  type Visit,
  ranked,
  opportunity,
  downloadJson,
} from "@/lib/workbench";
import { CustomerMap } from "@/components/customer-map";
import { FieldworkHome } from "@/components/fieldwork-home";
import { ProductLibrary } from "@/components/product-library";
import { LEGACY_PRODUCT_ID, productIdOf } from "@/lib/product-matching";
import { roleNames, type Brief } from "@/lib/platform";
const nav = [
  { id: "overview", name: "展业工作台", icon: LayoutDashboard },
  { id: "customers", name: "客户机会", icon: Users },
  { id: "products", name: "产品库", icon: ScanLine },
  { id: "followups", name: "访后跟进", icon: ClipboardList },
  { id: "reviews", name: "审查与转派", icon: FileCheck },
  { id: "team", name: "团队进度", icon: TrendingUp },
  { id: "audit", name: "合规与审计", icon: ShieldCheck },
  { id: "workspace", name: "工作空间", icon: Layers },
];
function NavButton({
  item,
  active,
  count,
  onNavigate,
}: {
  item: (typeof nav)[number];
  active: boolean;
  count: number;
  onNavigate: (id: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      className="nav-item"
      isActive={active}
      onClick={() => {
        onNavigate(item.id);
        setOpenMobile(false);
      }}
    >
      <item.icon size={18} />
      <span>{item.name}</span>
      {count > 0 && <b className="nav-count">{count}</b>}
    </SidebarMenuButton>
  );
}
export default function Home() {
  const platform = usePlatform();
  const { state, session, busy, loading, error, command } = platform;
  const [view, setView] = useState("overview"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [briefProductId, setBriefProductId] = useState(LEGACY_PRODUCT_ID),
    [customerId, setCustomerId] = useState<string | null>(null),
    [source, setSource] = useState<Rule | null>(null),
    [record, setRecord] = useState<{
      customerId: string;
      productId?: string;
      visit?: Visit;
    } | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [guide, setGuide] = useState(false),
    [notifications, setNotifications] = useState(false);
  const snapshot = useRef({ state, command });
  snapshot.current = { state, command };
  const scopeKey = (state?.workspace.id || "") + ":" + (session?.user.id || "");
  useEffect(() => {
    setCustomerId(null);
    setSource(null);
    setRecord(null);
    setImportOpen(false);
    setNotifications(false);
    setPage(1);
    setQuery("");
    setFilter("all");
  }, [scopeKey]);
  function navigate(id: string) {
    setView(id);
    setPage(1);
    setQuery("");
    setFilter("all");
  }
  async function openCustomer(c: Customer, productId = LEGACY_PRODUCT_ID) {
    setBriefProductId(productId);
    setCustomerId(c.id);
    try {
      await command({
        type: "audit.record",
        action: "查看作战单",
        target: c.id,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function showSource(r: Rule) {
    setSource(r);
    try {
      await command({
        type: "audit.record",
        action: "查看规则来源",
        target: r.id,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    if (!state) return;
    type MCP = {
      registerTool: (
        t: unknown,
        o: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const mcp = (document as Document & { modelContext?: MCP }).modelContext;
    if (!mcp) return;
    const controller = new AbortController();
    const tools = [
      {
        name: "list_customer_opportunities",
        title: "查看当前工作空间客户机会",
        description:
          "只读取当前登录身份有权查看的客户和命中规则；不会跨工作空间查询。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input: unknown) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw Error("需要空对象");
          return ranked(snapshot.current.state?.customers || []).map((c) => ({
            id: c.id,
            ...opportunity(c),
            hits: c.ruleHits,
          }));
        },
      },
      {
        name: "open_customer_brief",
        title: "打开访前作战单",
        description:
          "打开当前可见客户的作战单并在后端记审计；不确认准备、不发消息、不审批。",
        inputSchema: {
          type: "object",
          properties: {
            customerId: { type: "string", pattern: "^KH-[0-9]{3,6}$" },
          },
          required: ["customerId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input: unknown) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).some((k) => k !== "customerId")
          )
            throw Error("参数无效");
          const id = (input as { customerId: unknown }).customerId;
          const c = snapshot.current.state?.customers.find((c) => c.id === id);
          if (!c) throw Error("客户不存在或无权查看");
          await snapshot.current.command({
            type: "audit.record",
            action: "查看作战单",
            target: c.id,
          });
          setBriefProductId(LEGACY_PRODUCT_ID);
          setCustomerId(c.id);
          return {
            customerId: c.id,
            status: "opened",
            humanConfirmationRequired: true,
          };
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          mcp.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    return () => controller.abort();
  }, [scopeKey]);
  const sorted = useMemo(
    () => ranked(state?.customers || []),
    [state?.customers],
  );
  if (!session)
    return (
      <>
        <Toaster position="top-center" richColors />
        {loading ? (
          <div className="boot-screen">
            <Landmark />
            <h2>银策 YINGCE</h2>
            <p>正在连接你的工作空间…</p>
          </div>
        ) : (
          <AuthScreen
            authenticate={platform.authenticate}
            request={platform.request}
            error={error}
          />
        )}
      </>
    );
  if (!state)
    return (
      <>
        <Toaster position="top-center" richColors />
        <div className="boot-screen">
          <LoaderCircle className="spin" />
          <h2>{loading ? "正在同步工作空间" : "工作空间暂时不可用"}</h2>
          <p>{error || "读取成员权限、客户、规则与跟进记录"}</p>
          {!loading && (
            <div className="inline-actions">
              <button className="btn" onClick={() => platform.refreshSession()}>
                重新连接
              </button>
              <button className="text-btn" onClick={() => platform.logout()}>
                退出登录
              </button>
            </div>
          )}
        </div>
      </>
    );
  const role = state.workspace.role,
    canWrite = ["admin", "supervisor", "manager"].includes(role);
  const unread = state.notifications.filter((n) => !n.read).length;
  const customer = state.customers.find((c) => c.id === customerId) || null;
  const recordCustomer = state.customers.find(
    (c) => c.id === record?.customerId,
  );
  const filtered = sorted.filter(
    (c) =>
      (filter === "all" || opportunity(c).type === filter) &&
      (!query ||
        `${c.id} ${c.industry} ${c.demand}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const prepared =
    !!customer &&
    state.briefs.some(
      (b) =>
        b.customerId === customer.id &&
        (b.productId || LEGACY_PRODUCT_ID) === briefProductId,
    );
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "230px" } as React.CSSProperties}
    >
      <Toaster position="top-center" richColors />
      <Sidebar className="brand-sidebar">
        <SidebarHeader>
          <button
            className="brand"
            onClick={() => navigate("overview")}
            aria-label="银策编译器首页"
          >
            <div className="brand-mark">
              <Landmark size={23} />
            </div>
            <div>
              <strong>银策编译器</strong>
              <span>
                展业版 <i>3.0</i>
              </span>
            </div>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="workspace-picker">
            <label htmlFor="workspace-select">当前工作空间</label>
            <select
              id="workspace-select"
              value={state.workspace.id}
              disabled={busy}
              onChange={(e) => platform.choose(e.target.value)}
            >
              {session.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <SidebarMenu>
            {nav.map((n) => (
              <SidebarMenuItem key={n.id}>
                <NavButton
                  item={n}
                  active={view === n.id}
                  count={
                    n.id === "reviews"
                      ? state.reviews.filter((r) => r.status === "pending")
                          .length
                      : 0
                  }
                  onNavigate={navigate}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <ShieldCheck size={21} />
            <strong>每一条建议，都有依据</strong>
            <p>
              数据按空间保存，
              <br />
              行动由团队确认。
            </p>
            <div className="privacy-line">
              <span />
              PostgreSQL 已连接
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button className="sidebar-help" onClick={() => setGuide(true)}>
            五分钟演示指南
            <ArrowUpRight size={14} />
          </button>
          <div className="user">
            <span className="avatar">{session.user.name[0]}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>{roleNames[role]}</small>
            </div>
            <button
              className="icon-btn"
              aria-label="退出登录"
              onClick={async () => {
                try {
                  await platform.logout();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-toggle" />
            <span>团队工作空间</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.name}</strong>
          </div>
          <div className="top-actions">
            <span className="date-label">{state.referenceDate}</span>
            <button
              className="icon-btn"
              aria-label="刷新数据库记录"
              disabled={busy}
              onClick={() => platform.refresh()}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
            </button>
            <button
              className="notification-btn"
              onClick={() => setNotifications(true)}
              aria-label={`查看通知 ${unread} 条未读`}
            >
              <Bell size={19} />
              {unread > 0 && (
                <b className="notification-count">
                  {unread > 9 ? "9+" : unread}
                </b>
              )}
            </button>
          </div>
        </header>
        <main className="workspace">
          {error && (
            <div className="notice warning" role="status">
              {error}
            </div>
          )}
          {view === "overview" && (
            <FieldworkHome
              onNavigate={navigate}
              key={scopeKey}
              state={state}
              command={command}
              busy={busy}
              onOpen={openCustomer}
              onSource={showSource}
            />
          )}
          {view === "customers" && (
            <>
              <PageTitle
                eyebrow="CUSTOMER OPPORTUNITIES"
                title="找对客户，带着依据出发"
                description="到期窗口、场景标签和联系优先级，让展业重点一眼可见。"
              >
                {canWrite && (
                  <button className="btn" onClick={() => setImportOpen(true)}>
                    <Upload size={16} />
                    导入客户
                  </button>
                )}
                <button
                  className="btn primary"
                  onClick={() => navigate("products")}
                >
                  <ScanLine size={16} />
                  从产品匹配客户
                </button>
              </PageTitle>
              <section className="panel opportunity-panel">
                <div className="panel-title">
                  <div>
                    <h2>
                      客户机会列表{" "}
                      <span className="soft-tag">{filtered.length}</span>
                    </h2>
                    <p>
                      {role === "manager"
                        ? "本人负责的客户"
                        : "当前工作空间的客户"}{" "}
                      · 联系颜色不代表授信风险
                    </p>
                  </div>
                  <div className="customer-search">
                    <Search size={16} />
                    <Input
                      aria-label="搜索客户编号或行业"
                      placeholder="搜索编号、行业、需求"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
                <div className="list-toolbar">
                  <Tabs
                    value={filter}
                    onValueChange={(v) => {
                      setFilter(v);
                      setPage(1);
                    }}
                  >
                    <TabsList variant="line">
                      {[
                        "all",
                        "续贷服务",
                        "材料补充",
                        "需求核实",
                        "客户维护",
                      ].map((t) => (
                        <TabsTrigger key={t} value={t}>
                          {t === "all" ? "全部机会" : t}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <span className="priority-legend">
                    <i />
                    高优先级
                  </span>
                </div>
                {filtered.length ? (
                  <CustomerTable
                    customers={filtered.slice((page - 1) * 10, page * 10)}
                    onOpen={openCustomer}
                  />
                ) : (
                  <Empty
                    title="没有匹配的客户"
                    description="尝试调整关键词、场景筛选或工作空间。"
                  />
                )}
                <div className="pagination">
                  <span>
                    共 {filtered.length} 位 · {page}/{totalPages}
                  </span>
                  <button
                    className="btn"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </button>
                  <button
                    className="btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </button>
                </div>
              </section>
            </>
          )}
          {view === "products" && (
            <ProductLibrary
              key={scopeKey}
              state={state}
              canWrite={canWrite}
              onOpenCustomer={openCustomer}
              onSource={showSource}
              onActivate={async (id) => {
                const review = state.reviews.find(
                  (r) =>
                    r.kind === "rule" &&
                    r.targetId === id &&
                    r.status === "pending",
                );
                if (review) {
                  navigate("reviews");
                  toast.info("该规则已提交，可在审查队列查看");
                  return;
                }
                try {
                  await command({ type: "rule.submit", ruleId: id });
                  toast.success("规则已提交独立审查");
                  navigate("reviews");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onCompile={async (rules, productId) => {
                try {
                  await command({
                    type: "rule.compile",
                    productId,
                    text: rules[0]?.documentText || "",
                    name: rules[0]?.source || "导入制度",
                  });
                  toast.success("后端已编译并保存候选规则");
                  return true;
                } catch (e) {
                  toast.error((e as Error).message);
                  return false;
                }
              }}
            />
          )}
          {view === "followups" && (
            <FollowupBoard
              state={state}
              command={command}
              busy={busy}
              onOpen={openCustomer}
              onRecord={(c, v) => setRecord({ customerId: c.id, visit: v })}
            />
          )}
          {view === "reviews" && (
            <ReviewView
              state={state}
              session={session}
              command={command}
              busy={busy}
            />
          )}
          {view === "team" && (
            <TeamView state={state} userId={session.user.id} />
          )}
          {view === "workspace" && (
            <WorkspaceView
              state={state}
              command={command}
              busy={busy}
              createWorkspace={async (name) => {
                const w = await platform.request<{ id: string }>(
                  "/workspaces",
                  { name },
                );
                await platform.refreshSession(w.id);
              }}
            />
          )}
          {view === "audit" && (
            <AuditView
              state={state}
              onSource={showSource}
              onExport={async () => {
                try {
                  await command({
                    type: "audit.record",
                    action: "导出审计",
                    target: "当前空间可见审计记录",
                  });
                  downloadJson("银策-工作空间审计.json", {
                    workspace: state.workspace.name,
                    audit: state.audit,
                    rules: state.rules,
                  });
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          )}
          <footer className="workspace-footer">
            <span>银策 YINGCE · 让每一步展业可解释、可追踪</span>
            <span>
              <Database size={13} />{" "}
              {busy ? "正在保存…" : "已连接工作空间数据库"}
            </span>
          </footer>
        </main>
      </div>
      {customer && (
        <CustomerDetail
          key={scopeKey + customer.id + briefProductId}
          customer={customer}
          rules={state.rules.filter((r) => productIdOf(r) === briefProductId)}
          productName={
            state.products.find((p) => p.id === briefProductId)?.name
          }
          enterprise={
            <details className="enterprise-info">
              <summary>
                企业信息与位置 <span>查看经营信息、地图与导航</span>
              </summary>
              <dl className="enterprise-facts">
                <div>
                  <dt>客户编号</dt>
                  <dd>{customer.id}</dd>
                </div>
                <div>
                  <dt>所属行业</dt>
                  <dd>{customer.industry}</dd>
                </div>
                <div>
                  <dt>经营年限</dt>
                  <dd>
                    {customer.operatingYears === null
                      ? "待核实"
                      : `${customer.operatingYears} 年`}
                  </dd>
                </div>
                <div>
                  <dt>负责人</dt>
                  <dd>{customer.ownerName || "未分配"}</dd>
                </div>
              </dl>
              <CustomerMap
                key={scopeKey + customer.id}
                state={state}
                selected={customer}
                onSelect={setCustomerId}
                command={command}
                busy={busy}
              />
            </details>
          }
          referenceDate={state.referenceDate}
          prepared={prepared}
          busy={busy}
          canWrite={canWrite}
          onClose={() => setCustomerId(null)}
          onSource={showSource}
          onVisit={(c) => {
            setCustomerId(null);
            setRecord({ customerId: c.id, productId: briefProductId });
          }}
          onConfirm={async (c) => {
            await command<Brief>({
              type: "brief.confirm",
              productId: briefProductId,
              customerId: c.id,
              checklist: [
                "已核对命中规则与客户信息",
                "已准备需求核实问题与材料清单",
                "已核对沟通边界",
              ],
              ack: true,
            });
            toast.success("访前准备与规则快照已保存");
          }}
        >
          <CustomerExtras
            customer={customer}
            state={state}
            command={command}
            busy={busy}
          />
        </CustomerDetail>
      )}
      {recordCustomer && record && (
        <CommunicationDialog
          key={scopeKey + recordCustomer.id + (record.visit?.id || "new")}
          customer={recordCustomer}
          state={state}
          command={command}
          busy={busy}
          onClose={() => setRecord(null)}
          existingVisit={record.visit}
          productId={record.productId}
        />
      )}
      <SourceDialog
        rule={source}
        productName={
          state.products.find((p) => p.id === (source && productIdOf(source)))
            ?.name
        }
        onClose={() => setSource(null)}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (customers) => {
          try {
            const clean = customers.map(({ origin, ...c }) => c);
            await command({ type: "customer.import", customers: clean });
            toast.success("客户已保存到当前工作空间");
            navigate("customers");
            return true;
          } catch (e) {
            toast.error((e as Error).message);
            return false;
          }
        }}
      />
      <NotificationCenter
        state={state}
        open={notifications}
        onClose={() => setNotifications(false)}
        command={command}
        onNavigate={navigate}
      />
      <Guide
        open={guide}
        onClose={() => setGuide(false)}
        onStep={(step) => {
          if (step < 2) navigate("products");
          else if (step === 2) navigate("products");
          else if (step === 3 && sorted[0]) void openCustomer(sorted[0]);
          else navigate("followups");
        }}
      />
    </SidebarProvider>
  );
}
