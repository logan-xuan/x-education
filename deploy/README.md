# 北京 VPS 部署

- 正式入口：<https://e.aimon.top/login>
- 服务器：`8.152.193.250`
- 项目目录：`/opt/x-education`
- 服务用户和 systemd 服务名：`x-education`
- Node.js：`/opt/nodejs/node-v24.22.3-linux-x64/bin/node`
- Nginx 配置：`/etc/nginx/conf.d/x-education.conf`
- 本地应用监听：`127.0.0.1:3000`，由 Nginx 提供 HTTPS。
- SQLite 数据和固定密码分别保存在项目 `data/` 和 `.env` 中。

生产配置至少包括：

```dotenv
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=https://e.aimon.top
TRUST_PROXY=1
```

`TEACHER_PASSWORD` 由首次 `npm run setup` 生成，不放入版本库。更新部署时保留它及 `DATABASE_PATH`。

## 查看老师链接

在 VPS 执行，输出仅交给老师：

```sh
cd /opt/x-education
runuser -u x-education -- env PATH=/opt/nodejs/node-v24.22.3-linux-x64/bin:/usr/local/bin:/usr/bin:/bin npm run teacher-link -- --origin https://e.aimon.top
```

## 更新

1. 停止 `x-education.service`，备份 `.env` 和整个 `data/`，记录当前 Git 提交。
2. 以 `x-education` 用户在项目目录执行 `git pull --ff-only`。
3. 使用上述 Node.js 的 PATH，执行 `npm ci --include=dev && npm run setup && npm test && npm run build`。
4. 启动服务，检查 `systemctl status x-education`、`journalctl -u x-education` 和 `https://e.aimon.top/api/health`。
5. 验证学生登录、查看状态、老师审核及刷新后的会话恢复。

仓库在服务器通过公开 HTTPS 拉取，不需要上传本机 SSH 私钥。部署配置模板保存在本目录。安装或修改模板后先执行 `nginx -t` / `systemctl daemon-reload`，再 reload/restart 相应服务。

## HTTPS 续期

证书使用 Certbot 的 webroot 方式签发，验证目录为 `/var/lib/letsencrypt`。沿用服务器已有的 `certbot-renew.timer`，本证书的 deploy hook 负责重新加载 Nginx。

```sh
certbot renew --cert-name e.aimon.top --dry-run
```

回滚时，停服恢复已记录的版本及匹配的数据备份，再重启服务。不要覆盖其他站点的 Nginx 配置。
