# 沟通与外部系统接入边界

本次实现采用人工电话／微信沟通，服务端已提供统一渠道与记录结构，后续可以在此基础上增加企业微信、呼叫中心和 CRM 适配器。当前没有可用的外部提供方配置或自动发送接口。

## 已有接口

同源 `POST /api/workspaces/:workspaceId/commands`，需要有效会话、CSRF 和空间权限：

- `customer.contact`：保存本人负责客户经授权的联系方式及授权说明。
- `brief.confirm`：人工核对准备事项，保存当时的规则、命中证据和客户快照。
- `communication.add`：`customerId`、`briefId`、`channel`（phone / wechat / visit / other）、`outcome`（connected / unanswered / scheduled）、`content`。
- `visit.draft`：对已有“已沟通”记录和准备快照生成原文提取草稿。
- `visit.confirm`：人工确认纪要、需求、材料、任务及日期；事务内更新业务数据。
- `visit.submit`：提交独立审查。

站内通知与审计在同一流程中保存；浏览器手动拨号／复制不会被当成“已联系”，需要客户经理保存实际沟通结果。

## 后续适配器需要补齐

1. 服务端保管提供方凭据，按 workspace + 成员绑定授权；不能把凭据写入前端。
2. 用户明确确认后发送；提供方回调必须验签、校验空间映射、拒绝重放，使用外部事件编号保证幂等。
3. 将实际结果映射为统一 communication 记录，并引用对应访前快照，禁止直接跨过纪要人工确认。
4. CRM 采用“生成待写入内容 → 人工确认 → 提交 → 回执”的状态机，区分提交成功与业务办理成功。
5. 接入出站服务时，需要明确调整本项目 API 的网络隔离策略，或建立单独适配器进程；当前 API 仅允许 Unix socket，不能直接连外网。

当前导出的 CRM JSON 是交接文件，外部平台还没有收到这些数据。
