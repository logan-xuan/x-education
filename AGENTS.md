# Agent 登录与部署指引

- 北京 VPS：`root@8.152.193.250`，SSH 端口 `22`，已验证可登录。
- 本机私钥：`/Users/xuan.lx/pem/beijingvps_education.pem`，权限 `400`。
- 登录：`ssh -o IdentitiesOnly=yes -i ~/pem/beijingvps_education.pem root@8.152.193.250`。
- 收到部署任务时，登录此 VPS，按 [bj-pem.md](bj-pem.md) 完成部署和验证。
- 仓库：`git@github.com:logan-xuan/x-education.git`，默认分支 `main`。
- 部署前检查现有服务与目录；保留服务器 `.env` 和 `data/`，私钥不得上传服务器或 Git。
