# 北京 VPS 部署步骤

1. 本机登录：`ssh -o IdentitiesOnly=yes -i ~/pem/beijingvps_education.pem root@8.152.193.250`（私钥权限 `400`）。
2. 检查已有部署、端口占用及 Git、Node.js ≥24、npm；缺少依赖时先安装。
3. 优先沿用已有项目目录；首次部署到 `/opt/x-education`，克隆 `git@github.com:logan-xuan/x-education.git` 的 `main`；更新用 `git pull --ff-only`，仓库认证使用服务器凭证，不复制本机私钥。
4. 更新前备份现有 `.env` 和 SQLite 数据（停服备份整个 `data/`）；不要覆盖或删除它们。
5. 在项目目录执行 `npm ci --include=dev && npm run setup && npm run build`，配置项参考 README。
6. 使用 systemd 管理服务并设置开机启动；工作目录为项目目录，启动命令为 Node 绝对路径加 `dist/server/index.js`，更新后重启服务。
7. 默认应用端口 `3000`；检查防火墙、安全组及现有反向代理，确保实际访问入口可达。
8. 验证服务状态、日志、`curl -fsS http://127.0.0.1:3000/api/health` 和外部页面，完成后报告访问地址。
