# 设计模板与 Logo 发布验证

- 模板：shadcn/ui 官方 Dashboard-01，MIT 许可；采用 inset 侧栏框架及 SectionCards，详见 `docs/设计模板选型.md`。
- 原创 SVG Logo 同步登录、侧栏、加载页及 favicon；蓝灰主题和业务状态色。
- 保留大数字待办、产品匹配、客户信息内地图、权限及水印。
- TypeScript 检查与静态构建通过；浏览器验收桌面首页、产品库、登录、客户详情及 390px 手机布局／侧栏。
- 发布静态 release：`20260929-design`。线上首页、新 Logo、favicon 的 SHA-256 与本地产物一致。
- API 健康检查正常；API 与其他项目 PID、已核对配置哈希均未变。
- 本轮不修改账号、数据库、API 或 npm 依赖。
