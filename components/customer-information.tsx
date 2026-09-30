import { Building2 } from "lucide-react";
import type { Customer } from "@/lib/workbench";

/** Always visible; contact fields retain the existing authorization boundary. */
export function CustomerInformation({ customer }: { customer: Customer }) {
  const facts = [
    ["企业名称", customer.companyName || "待补充"],
    ["客户编号", customer.id],
    ["所属行业", customer.industry],
    [
      "经营年限",
      customer.operatingYears == null
        ? "待核实"
        : `${customer.operatingYears} 年`,
    ],
    ["客户经理", customer.ownerName || "未分配"],
    ["已持有产品", customer.products.join("、") || "暂无记录"],
    [
      "最近联系",
      customer.lastContactDate ||
        (Number.isFinite(customer.lastContactDays)
          ? `${customer.lastContactDays} 天前`
          : "暂无记录"),
    ],
    [
      "联系电话",
      customer.contactConsent && customer.phone
        ? customer.phone
        : "暂无已授权电话号码",
    ],
    [
      "微信",
      customer.contactConsent && customer.wechat
        ? customer.wechat
        : "暂无已授权微信号",
    ],
  ];
  return (
    <section className="panel customer-information" aria-label="企业与客户信息">
      <div className="field-card-title">
        <h2>
          <Building2 size={18} />
          企业与客户信息
        </h2>
        <span className="tag teal">{customer.id}</span>
      </div>
      <dl className="customer-information-facts">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className={
              label === "企业名称" ? "customer-information-company" : undefined
            }
          >
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
