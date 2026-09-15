# VPS 部署与隔离 · v3

站点：[yince.xcoria.cn](https://yince.xcoria.cn/)。在原有独立静态服务上新增自己的 API 与 PostgreSQL 集群；共享主机入口 Nginx，仅在银策域名应用新网关规则。

## 资源清单

| 层 | 专用资源 | 上限 |
| --- | --- | --- |
| 静态前端 | `yince-web` / `yince.service` / `127.0.0.1:59603` / `/srv/yince/releases` | 96 MB、CPU 15%、16 tasks |
| API | `yince-api` / `yince-api.service` + `.socket` / `/run/yince-api.sock` / `/srv/yince-api/releases` | 256 MB、CPU 30%、32 tasks |
| 数据库 | `yince-db` / `yince-db.service` / `/run/yince-db/.s.PGSQL.55433` / `/var/lib/yince-db/data` | 192 MB、CPU 30%、32 tasks |
| 网关 | `yince.xcoria.cn` 虚拟主机，独立限流 zone | 通用 API 10r/s，burst 20；登录／初始化／演示 6r/m，burst 3；每 IP 20 个并发连接 |

API 与数据库只允许 AF_UNIX，不能访问本机其他项目的 TCP 端口或公网。数据库不监听 TCP；API 通过 systemd socket activation 接收请求。服务以三个不同的不可登录系统账号运行，发布目录只读；systemd 隐藏其他项目的应用、数据、密钥目录。数据库运行角色无超级权限、无 BYPASSRLS、无建库建角色权限，并撤销 public schema 的公共 CREATE 权限。

PostgreSQL 14 使用 Ubuntu 官方包解压到 `/srv/yince-db/runtime` 的私有程序副本；不安装／启动系统默认集群。API 使用 `/srv/yince-api/runtime/node-v24.21.0-linux-x64` 的独立 Node 副本，生产依赖独立安装。内核、入口 Nginx 与硬件仍共享，主机管理员可访问所有项目；不是虚拟机级隔离。

## 配置映射

| 仓库文件 | 安装位置 |
| --- | --- |
| `nginx-app.conf` | `/etc/yince/nginx.conf` |
| `nginx-site.conf` | `/etc/nginx/sites-available/yince.xcoria.cn` |
| `nginx-gateway.conf` | `/etc/nginx/conf.d/yince-gateway.conf` |
| `nginx-api-proxy.conf` | `/etc/yince/api-proxy.conf`（入口 Nginx 读取） |
| `yince*.service`、`yince-api.socket` | `/etc/systemd/system/` |
| `postgresql.conf`、`pg_hba.conf` | `/etc/yince-db/` |
| `renew-yince.sh` | `/etc/letsencrypt/renewal-hooks/deploy/50-yince-nginx` |

`.env.example` 是占位模板；实际 API 环境文件 `/etc/yince-api.env` 为 root 0600，不放进 Git 或发布包。

```ini
PUBLIC_ORIGIN=https://yince.xcoria.cn
PGHOST=/run/yince-db
PGPORT=55433
PGDATABASE=yince
PGUSER=yince_app
PGPASSWORD=<独立随机数据库密码>
SETUP_TOKEN=<随机一次性初始化码>
ALLOW_DEMO=true
```

首次管理员初始化后，数据库记录初始化状态，该接口不能再创建第二个初始管理员。管理员自行输入账号和密码；初始化码私下交付。保留演示入口可用于公开展示；设置 `ALLOW_DEMO=false` 并重启自己的 API 可关闭新增体验空间。

## 数据库初始化

先检查用户名、目录、端口没有与已有项目冲突。创建 `yince-db`、`yince-api` 系统账号；仅 API 服务补充 `yince-db` 组以访问数据库 socket。集群数据目录归 `yince-db`，权限 0700；配置 root:yince-db 0640。`initdb` 使用 UTF-8，之后安装仓库中的 PostgreSQL 配置并启动独立服务。

数据库管理员通过本项目 Unix socket 操作：

```sh
runuser -u yince-db -- env LD_LIBRARY_PATH=/srv/yince-db/runtime/usr/lib/x86_64-linux-gnu /srv/yince-db/runtime/usr/lib/postgresql/14/bin/psql -h /run/yince-db -p 55433 -d postgres
```

在私下设置密码后创建 `yince_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 10`、数据库 `yince`；撤销 PUBLIC 对数据库的连接权限，再授权 `yince_app` CONNECT。不要将密码写入共享 shell 历史。由集群管理员在 `yince` 上执行 `server/migrations/001_platform.sql`；运行账号不能执行迁移。

需要集成测试时，另外创建 `yince_test` 数据库并执行同一迁移，测试 API 配置必须明确使用该库。可以复用本项目 runtime role；测试库不开放给生产 API 路由。初始 mock 数据由创建工作空间事务导入，每个空间独立一份。

## 发布顺序

1. 执行单元测试、类型检查和 `npm run build:vps`；对需要数据库的改动运行独立库集成测试。
2. 为本项目配置、当前发布链接、数据库做备份；记录其他站点配置摘要和服务主进程。
3. 打包静态 `out/`。API 包仅包含 `server/`、`lib/`、`data/`，将 `server/package.json` 与 lockfile 复制为 API 发布根目录的 `package.json`、`package-lock.json`。
4. 上传至两个新的、版本化的 release 目录，核验 SHA-256。在 API 发布目录用自己的 Node/npm 执行 `npm ci --omit=dev --ignore-scripts`；只安装 pg/zod 等精简依赖。完成后目录为 root:yince-api 0750，文件只读。
5. 管理员备份后执行必要迁移；原子切换 `/srv/yince-api/current` 链接，安装／校验 API 单元，启动自己的 socket 与服务。检查 Unix socket 的 `/api/healthz`。
6. 安装仅银策使用的 gateway、proxy 和 vhost 文件；`nginx -t` 成功后平滑重载入口。其他业务服务无需重启。
7. 原子切换 `/srv/yince/current` 静态发布链接，检查 HTTPS、静态资源、登录、公共演示、权限和限流。
8. 对照其他站点配置与服务基线，确认隔离和原项目健康。

API 需要 Node 24 原生 TypeScript 类型剥离，不在服务端进行 Next 构建。服务通过自己的 Unix socket 获取流量，端口 59604 仅用于本地开发和测试。

## 更新与回滚

保留旧静态和 API release。失败时分别原子切回已验证的链接，再只重启 `yince-api`；若 gateway 配置改变，恢复本项目已备份的文件，经 `nginx -t` 后重载。首次 v3 回退到旧纯静态版本时，同时恢复原银策 vhost。不要删除 PostgreSQL 数据目录。

数据库迁移应保持向后兼容；应用链接回滚不能撤销数据库变更。破坏性迁移必须事先验证恢复方案。本次 001 为新增结构，未改动其他项目数据库。

## 数据备份

首次上线会保存一份本项目自包含 custom-format dump，目录 `/var/backups/yince/database`、root 0700，备份文件 0600。后续发布前由管理员继续备份：

```sh
# 文件名应使用新的唯一时间戳；不要覆盖已验证备份。
umask 077
runuser -u yince-db -- env LD_LIBRARY_PATH=/srv/yince-db/runtime/usr/lib/x86_64-linux-gnu /srv/yince-db/runtime/usr/lib/postgresql/14/bin/pg_dump -h /run/yince-db -p 55433 -d yince -Fc > /var/backups/yince/database/yince-UNIQUE_TIMESTAMP.dump
```

用同一私有 runtime 的 `pg_restore --list` 校验目录；恢复演练应指向新建的隔离数据库。备份含业务记录，需要与生产数据相同的保护。当前是同机备份，未配置异地备份或定时任务。

## 运维检查

```sh
systemctl status yince yince-api yince-db --no-pager
journalctl -u yince-api -n 30 --no-pager
curl --unix-socket /run/yince-api.sock http://localhost/api/healthz
curl -fsS https://yince.xcoria.cn/api/healthz
systemctl show yince-api yince-db -p MemoryCurrent -p MemoryMax -p TasksCurrent -p CPUQuotaPerSecUSec
ss -lxnp
nginx -t
```

网关限制按真实入口 IP，覆盖客户端传入的 X-Real-IP。API 限流还按用户、空间、登录名检查；当前计数在单进程内存中，重启会清空，多副本部署应使用共享计数存储。通知在可见页面每 30 秒同步，待办到期提醒在空间读取时生成；没有后台短信／微信发送。

参考：[PostgreSQL 行级安全](https://www.postgresql.org/docs/14/ddl-rowsecurity.html)、[node-postgres 事务](https://node-postgres.com/features/transactions)、[Nginx 请求限流](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)。
