# 知课 · 课堂任务系统

一个可直接运行的课堂答题应用，前后端均使用 TypeScript，数据库为 SQLite。界面沿用确认的浅米色与朱红色任务卡设计，适配电脑和手机。

## 已实现

- 学生无须注册或登录，填写组名、编号后提交方案。
- 服务端自动判断方案与计算结果，支持多种正确答案。
- 正确、未达标、计算错误、题目关闭、题目更新、空记录及网络错误提示。
- 老师通过含固定管理密码的独立链接进入后台；学生页面不提供后台入口。
- 老师可创建、编辑、保存草稿、发布、关闭和重新开放题目。
- 按题目、组名、编号、判定结果筛选，支持每人最新一次和全部提交，带分页。
- 查看每次答案、自动判定明细、提交历史，保存老师评语。
- 学生刷新自己的提交结果链接，可以查看老师后续填写的评语。
- 历史提交保留当时的题目参数和判定结果。

按需求不提供导出功能。首次运行只内置图片对应的题目，不生成虚拟学生或答题数据。

## 启动开发环境

需要 Node.js 24 或更新版本。

```sh
npm install
npm run setup
npm run dev
```

- 学生页面：http://localhost:5173/
- 后端接口：http://localhost:3000/api/health
- 首次配置会生成 `.env`，其中的 `TEACHER_PASSWORD` 是固定管理密码，之后重启服务不会改变。
- SQLite 文件默认位于 `data/classroom.sqlite`，启动时自动建表。

在另一个终端运行以下命令，获得老师专属管理链接：

```sh
npm run teacher-link
```

链接形式为 `http://localhost:5173/teacher#key=固定管理密码`。将命令输出的完整链接交给老师；学生只接收具体题目的答题链接。老师可在题目列表中点击“答题链接”复制学生入口。

如需使用自己设置的固定密码，修改 `.env` 中的 `TEACHER_PASSWORD` 后重启服务。密码至少 12 个字符，不要使用 `VITE_` 前缀。更换密码后旧管理会话自动失效。

## 构建与部署

```sh
npm run build
npm start
npm run teacher-link -- --origin http://localhost:3000
```

构建后由一个 Node.js 服务同时提供前端和 API，学生通过 http://localhost:3000/ 访问。最后一个命令生成对应地址的老师链接。

课堂局域网使用时，将上述链接里的 `localhost` 换成服务器的局域网 IP。例如：

```sh
npm run teacher-link -- --origin http://192.168.1.20:3000
```

`.env` 可配置：

| 配置               | 默认值                    | 说明                                                               |
| ------------------ | ------------------------- | ------------------------------------------------------------------ |
| `TEACHER_PASSWORD` | 首次自动生成              | 老师固定管理密码，仅服务端读取                                     |
| `DATABASE_PATH`    | `./data/classroom.sqlite` | SQLite 文件位置                                                    |
| `HOST`             | `0.0.0.0`                 | 服务监听地址                                                       |
| `PORT`             | `3000`                    | 后端及构建后页面的端口                                             |
| `APP_ORIGIN`       | 根据请求推断              | 使用域名或反向代理时设置完整访问源，如 `https://class.example.com` |
| `TRUST_PROXY`      | 不开启                    | 可信反向代理后设置 `1`，识别 HTTPS 并使用 Secure Cookie            |

开发环境 Vite 的代理目标固定为后端 `3000` 端口。修改开发环境的后端端口时，需要同步修改 `vite.config.ts`。

如需备份，先正常停止服务，再备份整个 `data/` 目录。恢复时同样在停服状态下替换数据目录。`.env` 需要单独保留。

## 老师后台访问

老师管理密码位于链接的 URL fragment（`#key=...`）中。页面向后端验证成功后才将密码从地址栏移除；如果验证请求失败，完整链接会保留，可以点击“重新验证”或刷新页面重试。后端验证成功后下发 HttpOnly、SameSite=Strict 的 Cookie，管理有效期为 8 小时；过期后重新打开原来的老师链接即可。没有管理密码且没有有效 Cookie 时，单独打开 `/teacher` 不会获得后台权限。

所有管理 API 均在服务端验证 Cookie。学生直接访问 `/teacher` 或调用管理接口，都不会获得管理权限。密码不会写入前端构建文件、学生接口或数据库中。生产部署时建议使用 HTTPS。

管理链接本身代表管理权限，应仅交给老师。组名和编号是学生自行填写的信息，不进行实名身份认证。

## 判定规则

图片对应的默认题目，二等奖数量为 `x`，三等奖数量为 `y`：

- `x`、`y` 为非负整数。
- 总中奖券数 `N = 5 + x + y`，`N <= 1000`。
- 实际中奖率 `N / 1000 >= 50%`。
- 总奖金 `500 + 20x + 5y <= 3200`。
- 学生填写的总中奖券数、中奖率、总奖金应与系统核算一致。
- 学生填写中奖率时保留至多两位小数；是否达到最低中奖率使用未四舍五入的真实比例判断。
- 设计理由必填，由老师阅读点评，不作为自动对错判定条件。

例如，二等奖 10 张、三等奖 500 张，以及二等奖 0 张、三等奖 495 张，都是正确方案。预算无需全部用完。

老师编辑题目时，系统会检查条件是否存在可行方案。如果学生填写期间老师修改了题目参数，服务端会要求学生重新载入最新题目并检查答案，避免按过期参数提交。

## 验证

```sh
npm test
npm run build
npm run test:e2e
```

- `npm test`：自动判分边界、管理权限、接口校验、统计与历史、评语、SQLite 重开后的持久化，以及真实开发代理下的同源提交与跨站拦截。
- `npm run build`：前后端 TypeScript 类型检查与生产构建。
- `npm run test:e2e`：使用构建后的前端，验证完整学生与老师操作流程及手机布局。测试启动独立服务并使用内存 SQLite，不影响本地课堂数据。先运行 `npm run build`。

浏览器测试在 macOS 上优先使用已安装的 Google Chrome；也可以通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器。其他环境先运行：

```sh
npx playwright install chromium
```

## 代码结构

```text
shared/model.ts       共享类型与输入校验
server/app.ts         HTTP API、访问控制与静态页面
server/auth.ts        固定密码验证与老师 Cookie
server/grading.ts     自动判分
server/store.ts       SQLite、历史快照、筛选与统计
server/env.ts         本地配置与固定密码初始化
src/pages/            学生、结果、老师后台页面
src/components/       通用组件
src/styles.css        响应式界面样式
scripts/teacher-link.ts  生成老师链接
tests/                自动化测试
```

技术参考：[Node.js SQLite](https://nodejs.org/api/sqlite.html)、[Express](https://expressjs.com/en/5x/api/)、[React](https://react.dev/reference/react)、[Vite](https://vite.dev/guide/)。
