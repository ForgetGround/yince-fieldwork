# v3 验收记录 · 2026-09-16

发布：`20260916-v3`；域名：[https://yince.xcoria.cn/](https://yince.xcoria.cn/)。

## 构建与流程

- 11 项单元测试通过，覆盖命中依据、日期和优先级边界、文本提取、导入白名单、密码与限流。
- 独立 `yince_test` PostgreSQL 上的集成测试 11/11 通过（1 个父测试和 10 个子测试）。覆盖初始化／登录、CSRF、权限、转派、跨空间隔离、RLS、审计只增不改、规则历史快照、访前到访后任务闭环、材料补齐和资格撤销。
- TypeScript 检查、Next 静态构建成功；发布的首页 SHA-256 与本地 `out/index.html` 完全一致，8 个脚本／样式资源均可访问。
- 桌面操作与 390×844 手机作战单检查通过；水印覆盖页面和弹窗，按钮与内容可操作，浏览器未见脚本错误。
- 生产演示空间实际完成访前保存、电话模拟记录入库、生成归纳、确认任务和提交独立审查。
- 正式管理员未由测试流程创建；初始化码通过本地权限 0600 文件私下交付，不在仓库中。

## 服务与隔离

- `yince`、`yince-api`、`yince-db` 均 active，独立 Unix 用户、目录、运行时与资源上限。
- PostgreSQL 只监听自己的 Unix socket；API 通过自己的 systemd socket activation 接收请求。两项服务均 RestrictAddressFamilies=AF_UNIX / IPAddressDeny=any。
- 11 张业务表均启用并强制 RLS；`yince_app` 的 superuser、BYPASSRLS、CREATEDB、CREATEROLE、public CREATE 均为 false。
- 从 API 的挂载命名空间和运行身份检查，无法读取原订单系统环境文件或 PostgreSQL 数据目录文件。
- 原有 5 份入口／订单配置 SHA-256 校验一致；原订单、sing-box、订阅服务与入口 Nginx 主进程保持不变，服务 active，原站首页正常响应。
- 银策静态服务主进程保持不变；仅平滑重载共享入口 Nginx，不重启原业务服务。

## 线上网络

- HTTPS、HTTP 301 跳转、静态 `/healthz` 与 `/api/healthz` 正常。
- 未登录读取业务空间返回 401；生产环境独立演示空间跨读返回 403，缺失 CSRF 的写操作返回 403，登出成功。
- 生产会话 Cookie 验证 `__Host-` 前缀、Secure、HttpOnly、SameSite=Strict。
- 从服务器发起 35 个并发健康请求进行有限的网关验证：22 个 200、13 个 429；限流响应均带 `Retry-After: 60`。
- 首份同机 PostgreSQL custom-format 备份已生成并通过 `pg_restore --list` 目录检查。尚未配置异地备份或自动定时备份。

## 发布包校验

| 包 | SHA-256 |
| --- | --- |
| API | `b98a43439f45f5d238bbdd468ea82cf59572e26ce9d09f43700ff2ebc476d8a3` |
| 静态前端 | `72c27d3ad27a7473dbe5fa6627094a37ff6e021baf60dbce989eb74163c5851c` |

## 已知边界

确定性文本提取尚未接入大模型；电话／微信为人工沟通与数据库记录；通知是站内通知；未写入银行 CRM。公开演示空间 24 小时过期。首次管理员设置、真实成员创建和外部平台接入由项目持有人按需完成。
