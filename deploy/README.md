# VPS 部署与隔离

在线站点：<https://yince.xcoria.cn/>。本方案适用于已有 Nginx 与 Certbot 的 Ubuntu 22.04 / systemd 249 主机。构建在开发机执行，VPS 仅接收 `out/` 静态产物，不安装项目 Node.js 依赖。

实际发布检查结果见 [2026-09-15 部署验证记录](VERIFICATION-20260915.md)。

## 资源边界

| 对象 | 银策专用资源 |
| --- | --- |
| 运行账号 | `yince-web`，系统账号、无登录 shell |
| 服务 | `yince.service`；单独运行 Nginx 静态进程 |
| 监听 | `127.0.0.1:59603`，不绑定公网接口 |
| 发布目录 | `/srv/yince/releases/<release-id>`，`/srv/yince/current` 指向当前版本 |
| 配置与运行目录 | `/etc/yince`、`/run/yince` |
| 域名入口 | `/etc/nginx/sites-available/yince.xcoria.cn` |
| TLS | `/etc/letsencrypt/live/yince.xcoria.cn`；独立证书 |
| ACME 验证目录 | `/var/www/yince-acme` |
| 资源限制 | 内存 96 MB、单核 CPU 15%、任务数 16、文件描述符 2048 |
| 数据 | 浏览器 localStorage；无服务端业务数据库 |

应用进程无提权权限，只接收回环接口上的入站请求。systemd 的系统调用过滤器禁止 `connect`，阻止主动新建外连，包括访问主机其他项目的回环端口；发布文件与配置对运行账号只读。systemd 隐藏其他项目常用的 `/var/lib`、`/var/www`、`/opt`、主 Nginx 配置和证书目录。日志使用独立标识，关闭访问日志以避免记录 URL 查询参数。

Ubuntu Nginx 1.18 会在解析配置前打开编译时的默认日志路径。因此服务的私有文件系统视图将 `/var/log/nginx` 映射到自己的 `/run/yince`；不会读取或写入入口 Nginx 的实际日志目录。正常错误日志仍进入 `journalctl -u yince`。

入口 Nginx、二进制、内核和主机资源仍然共享。部署只新增本项目配置，并在 `nginx -t` 通过后平滑重载入口；其他业务服务不需要重启。主机管理员依然可以访问所有项目，不能将此配置描述为虚拟机级隔离。

## 配置文件

- `nginx-app.conf`：独立静态服务，拒绝隐藏文件、提供 `/healthz`，静态资源缓存一年，HTML 重新验证缓存。
- `yince.service`：账号、文件系统隔离、回环通信及资源上限。
- `nginx-http-bootstrap.conf`：首次申请证书时使用的 HTTP 入口。
- `nginx-site.conf`：最终 HTTPS 入口，HTTP 自动跳转。
- `renew-yince.sh`：仅在本域名证书续期后校验并重载入口 Nginx。

## 首次部署

先确认域名 DNS 指向目标主机、端口 `59603` 未被占用，并保存其他站点配置摘要和服务状态。以下步骤由主机管理员执行；不要覆盖同名已有配置。

1. 本地执行 `npm ci && npm test && npm run typecheck && npm run build:vps`。只打包 `out/`，不要上传 `.env`、源码、原始客户文件或 `node_modules`。
2. 创建系统账号：`useradd --system --user-group --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin yince-web`。
3. 建立 `/srv/yince/releases` 和 `/etc/yince`；发布文件归属 `root:yince-web`，目录权限 `0750`、文件权限 `0640`。运行账号只能读取。
4. 解包到唯一的新发布目录，在 `/srv/yince` 内创建临时链接再用 `mv -Tf` 原子替换 `current`。不要覆盖旧版本目录。
5. 将 `nginx-app.conf` 安装为 `/etc/yince/nginx.conf`，将系统 `/etc/nginx/mime.types` 复制到 `/etc/yince/mime.types`，均为 `root:yince-web 0640`。
6. 将 `yince.service` 安装到 `/etc/systemd/system/`，执行 `systemd-analyze verify`、`systemctl daemon-reload`、`systemctl enable --now yince`。确认 `curl -fsS http://127.0.0.1:59603/healthz` 返回 `yince-ok`。
7. 建立 `0755` 的 `/var/www/yince-acme`，安装 HTTP 引导配置及对应 `sites-enabled` 链接，执行 `nginx -t`，通过后执行 `systemctl reload nginx`。
8. 用现有 Certbot ACME 账号申请独立证书：`certbot certonly --webroot -w /var/www/yince-acme -d yince.xcoria.cn --cert-name yince.xcoria.cn --non-interactive`。新主机须先完成自己的 Certbot 账号配置。
9. 用 `nginx-site.conf` 替换**本项目**引导配置，再次校验和平滑重载。将 `renew-yince.sh` 安装为 `/etc/letsencrypt/renewal-hooks/deploy/50-yince-nginx`，权限 `0755`；确认 `certbot.timer` 正常运行。
10. 检查 HTTPS、HTTP 跳转、首页引用的脚本 / 样式、未知路径 404、服务资源限制；核对其他项目配置摘要、主进程与健康接口。

证书私钥、SSH 凭据与 GitHub 凭据不应出现在仓库或发布包中。仓库不保存具体 SSH 连接参数。

## 更新与回滚

更新时重新构建并将 `out/` 打包传到新的发布目录，校验 SHA-256 后设置文件权限。先保存 `readlink /srv/yince/current` 的结果，再原子替换 `current` 链接。静态内容切换无需重启任何服务。

回滚时将链接原子切回已验证的旧发布目录，例如：

```sh
# 将下面的版本名替换为服务器上已存在的旧版本；仅操作银策目录。
ln -s /srv/yince/releases/KNOWN_GOOD_RELEASE /srv/yince/current.rollback
mv -Tf /srv/yince/current.rollback /srv/yince/current
curl -fsS http://127.0.0.1:59603/healthz
curl -fsS https://yince.xcoria.cn/ > /dev/null
```

如果修改了服务配置，先执行 `systemd-analyze verify /etc/systemd/system/yince.service`，再 `systemctl daemon-reload && systemctl restart yince`。入口配置变更需先备份本项目配置并执行 `nginx -t`，通过后才可重载。失败时恢复本项目文件，勿覆盖主机其他站点。

## 日常检查

```sh
systemctl status yince --no-pager
journalctl -u yince -n 50 --no-pager
systemctl show yince -p MemoryCurrent -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax
ss -lntp 'sport = :59603'
curl -fsS https://yince.xcoria.cn/healthz
systemctl status certbot.timer --no-pager
certbot certificates --cert-name yince.xcoria.cn
```

`/healthz` 仅表示静态服务存活；浏览器交互和业务规则仍需页面检查与本地测试。导入、纪要、任务和审计记录只保存在访问者浏览器，不会在不同设备同步。当前公开原型不提供身份认证或生产数据存储。
