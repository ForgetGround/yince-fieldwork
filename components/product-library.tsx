"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Search } from "lucide-react";
import { PageTitle, ProductRules } from "./workbench-views";
import type { PlatformState, Product } from "@/lib/platform";
import type { Customer, Rule } from "@/lib/workbench";
import {
  productIdOf,
  matchLabels,
  type ProductMatch,
} from "@/lib/product-matching";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
const colors = { candidate: "teal", needsInfo: "amber", mismatch: "gray" };
export function ProductLibrary({
  state,
  onOpenCustomer,
  onSource,
  onActivate,
  onCompile,
  canWrite,
}: {
  state: PlatformState;
  onOpenCustomer: (c: Customer, productId: string) => void;
  onSource: (r: Rule) => void;
  onActivate: (id: string) => void;
  onCompile: (rules: Rule[], productId: string) => Promise<boolean>;
  canWrite: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("customers");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const product = state.products.find((p) => p.id === selected);
  const matches = product ? state.productMatches?.[product.id] || [] : [];
  const rules = state.rules.filter(
    (r) => product && productIdOf(r) === product.id,
  );
  const count = (list: ProductMatch[], status: string) =>
    list.filter((m) => m.status === status).length;
  function choose(p: Product) {
    setSelected(p.id);
    setTab("customers");
    setFilter("all");
    setQuery("");
  }
  if (!product)
    return (
      <>
        <PageTitle
          eyebrow="PRODUCT LIBRARY"
          title="从产品出发，找到适合的客户"
          description="选择产品，查看匹配客户、核查依据与政策版本。"
        />
        <div className="notice info">
          <FileText size={18} />
          <p>
            5 款附件产品与 1
            项待核实来源产品。资料现行有效性需核实；匹配仅辅助展业，不代表授信资格。
          </p>
        </div>
        <div className="product-search">
          <Search size={17} />
          <Input
            aria-label="搜索产品"
            placeholder="搜索产品名称"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="product-grid">
          {state.products
            .filter((p) => p.name.includes(query.trim()))
            .map((p) => {
              const list = state.productMatches?.[p.id] || [];
              return (
                <button
                  className="panel product-card"
                  key={p.id}
                  onClick={() => choose(p)}
                >
                  <div className="product-card-top">
                    <span className="file-icon">
                      <FileText size={24} />
                    </span>
                    <span className="tag gray">
                      {p.row ? "附件产品" : "产品名称待核实"}
                    </span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="product-counts">
                    <span>
                      <b>{count(list, "candidate")}</b> 基础条件匹配
                    </span>
                    <span>
                      <b>{count(list, "needsInfo")}</b> 待补信息
                    </span>
                  </div>
                  <div className="product-card-footer">
                    匹配客户 · 政策规则 · 产品资料
                    <ArrowRight size={17} />
                  </div>
                </button>
              );
            })}
        </div>
        {!state.products.some((p) => p.name.includes(query.trim())) && (
          <div className="panel product-empty">
            没有找到产品，请调整关键词。
          </div>
        )}
      </>
    );
  const visible = matches.filter(
    (m) =>
      (filter === "all" || m.status === filter) &&
      (() => {
        const c = state.customers.find((c) => c.id === m.customerId);
        return `${m.customerId} ${c?.industry || ""}`.includes(query.trim());
      })(),
  );
  return (
    <>
      <button
        className="text-btn product-back"
        onClick={() => {
          setSelected(null);
          setQuery("");
        }}
      >
        <ArrowLeft size={16} />
        全部产品
      </button>
      <PageTitle
        eyebrow="PRODUCT DETAIL"
        title={product.name}
        description={product.description}
      />
      <div className="notice info">
        <FileText size={18} />
        <p>
          {product.row
            ? `来源：P020250723600413272167.et · Sheet1!C${product.row}:L${product.row}`
            : "来源：历史产品申请条件截图，产品名称待核实"}
          。基础核查保留原文与人工核实项，未知信息不视为符合条件。
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="section-tabs" variant="line">
          <TabsTrigger value="customers">
            匹配客户 <span>{matches.length}</span>
          </TabsTrigger>
          <TabsTrigger value="rules">
            政策规则 <span>{rules.length}</span>
          </TabsTrigger>
          <TabsTrigger value="detail">产品资料</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "customers" && (
        <>
          <div className="product-match-summary">
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              全部客户 <b>{matches.length}</b>
            </button>
            {Object.entries(matchLabels).map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "selected" : ""}
                onClick={() => setFilter(key)}
              >
                {label} <b>{count(matches, key)}</b>
              </button>
            ))}
          </div>
          <div className="product-search">
            <Search size={17} />
            <Input
              aria-label="搜索匹配客户"
              placeholder="搜索客户编号 / 行业"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="micro-copy">
            优先展示基础条件匹配客户，再按已符合条件数量和联系优先级排序。仅包含当前账号有权查看的客户；还需核实完整准入、例外及材料。
          </p>
          <div className="product-match-list">
            {visible.map((m) => {
              const c = state.customers.find((c) => c.id === m.customerId);
              if (!c) return null;
              return (
                <article className="panel product-match" key={m.customerId}>
                  <div className="product-match-head">
                    <div>
                      <h3>
                        {c.id}
                        <span>{c.industry}</span>
                      </h3>
                      <p>{c.origin}</p>
                    </div>
                    <span className={"tag " + colors[m.status]}>
                      {matchLabels[m.status]}
                    </span>
                  </div>
                  <div className="product-match-facts">
                    <span>
                      已符合{" "}
                      <b>
                        {m.passed}/{m.total}
                      </b>
                    </span>
                    <span>
                      缺失信息 <b>{m.unknown}</b>
                    </span>
                    <span>
                      已知不符 <b>{m.failed}</b>
                    </span>
                    <span>
                      人工核实 <b>{m.manual}</b>
                    </span>
                  </div>
                  <details>
                    <summary>
                      查看匹配依据 · {m.checks.length} 条产品规则
                    </summary>
                    <div className="product-checks">
                      {m.checks.length === 0 && (
                        <p>尚未关联可用规则，需先核实产品政策。</p>
                      )}
                      {m.checks.map((check) => (
                        <div key={check.ruleId}>
                          <span
                            className={
                              "tag " +
                              (check.status === "pass"
                                ? "teal"
                                : check.status === "fail"
                                  ? "gray"
                                  : "amber")
                            }
                          >
                            {check.status === "pass"
                              ? "符合"
                              : check.status === "fail"
                                ? "不符"
                                : "待核实"}
                          </span>
                          <div>
                            <strong>{check.title}</strong>
                            <p>
                              客户信息：{check.fact} · {check.version}
                            </p>
                          </div>
                          <button
                            className="text-btn"
                            onClick={() => {
                              const r = rules.find(
                                (r) => r.id === check.ruleId,
                              );
                              if (r) onSource(r);
                            }}
                          >
                            原文依据
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                  <button
                    className="btn primary"
                    onClick={() => onOpenCustomer(c, product.id)}
                  >
                    生成本产品访前作战单
                    <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
          {!visible.length && (
            <div className="panel product-empty">当前条件下暂无匹配客户。</div>
          )}
        </>
      )}
      {tab === "rules" && (
        <ProductRules
          key={product.id}
          product={product}
          state={{ ...state, rules }}
          canWrite={canWrite}
          onSource={onSource}
          onActivate={onActivate}
          onCompile={(r) => onCompile(r, product.id)}
        />
      )}
      {tab === "detail" && (
        <div className="panel product-detail product-original">
          {[
            ["客户对象", "audience", "E"],
            ["产品特点", "feature", "F"],
            ["金额范围", "amount", "G"],
            ["申请条件", "conditions", "H"],
            ["办理流程", "process", "I"],
            ["期限", "term", "J"],
            ["利率（历史原文）", "rate", "K"],
            ["增信方式", "guarantee", "L"],
          ].map(([label, key, col]) => (
            <section className="product-section" key={key}>
              <h3>
                {label}
                <small>
                  {product.row
                    ? `Sheet1!${col}${product.row}`
                    : "历史截图 / 待核实"}
                </small>
              </h3>
              <p>{product[key as keyof Product]}</p>
            </section>
          ))}
          <p className="micro-copy">
            历史资料尚未核实现行有效性，不作为对客报价或承诺。
          </p>
        </div>
      )}
    </>
  );
}
