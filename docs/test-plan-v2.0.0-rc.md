# TAPD 2.0.0-rc 全面测试计划（正式版 2.0.0 发布门槛）

- 需求：TAPD 1139814312001001454
- 编写：白泽（AI 智能体）· 2026-09-04
- 被测版本：npm `@xihe-lab/tapd-mcp-server` / `@xihe-lab/tapd-cli` / `@xihe-lab/tapd-core` **2.0.0-rc.1**（tag rc；latest 保持 1.4.3）
- 代码基线：`feature/2.0-monorepo` @ `403a40a`（与 rc.1 一致），计划所在分支 `feature/2.0-test-plan`
- 对照基线：v1.4.3（tools 快照 `/tmp/claude/baseline-tools-143.json`，210 工具；实构建 `/tmp/claude/tapd-v142`）
- 状态：**计划待用户评审，评审通过后执行**。执行期间只改测试脚本与报告，不改产品代码

---

## 1. 目标与出口标准

### 1.1 目标

此前验收（需求 1287，15 脚本 155 断言 + 16 富文本脚本）以**抽样**为主：只读抽样 18 路由、核心五模块写操作、11 组数据比对。本阶段对 rc 发布产物做**全量覆盖**，补齐发布产物链路与环境矩阵，形成 2.0.0 正式版发布门槛。

四条主线：

1. **发布产物链路**：全部用例以 npm 安装的 rc 包为被测对象（`npx` / 全局安装 / 裸环境），本地源码构建仅用于缺陷复现定位与新旧对照
2. **212 工具全量**：146 只读逐一 + 66 写逐一（真凭证、`zzz-delete-me-` 前缀）
3. **新能力全字段**：富文本三层路由 30 写工具 + 长 ID 防御 26 处字段边界
4. **环境矩阵 + 真实客户端**：Node 20/22/24 × 认证 × 输出 × 配置；Claude Code 实接 rc 包

### 1.2 出口标准（2.0.0 发布门槛，全部满足才发布）

| # | 标准 | 量化口径 |
|---|------|---------|
| E1 | 回归全绿 | 既有 16 脚本对 rc 产物 16/16 PASS |
| E2 | 新增全量用例通过率 | ≥ 99%，且失败项逐条归类为缺陷或豁免（不允许静默跳过） |
| E3 | 阻塞/严重缺陷 | **零容忍**：阻断安装/启动/握手、数据错写（写 A 读到 B）、凭证泄露、崩溃，任一存在即不发布 |
| E4 | 一般缺陷 | 全部修复，或书面豁免（记录现象/影响/理由，用户签字确认）；豁免总数 ≤ 5 |
| E5 | 轻微缺陷 | 记录入缺陷清单，不阻塞发布，可带入 2.0.x |
| E6 | 性能不退化 | CLI 冷启动（`tapd --help`）P50 ≤ 300ms 且 Max ≤ 500ms；MCP `tapd_get_stories {limit:3}` 中位 ≤ 1.4.3 对照中位 × 1.5（基线 159ms → 上限 ~239ms；1287 实测 191ms） |
| E7 | 兼容零漂移 | 存量 210 工具 schema 零意外漂移（1410 长 ID 白名单 20 工具豁免外），双入口与新旧 MCP 数据一致抽查通过 |
| E8 | 数据面干净 | 测试数据全部 `zzz-delete-me-` 前缀，清理清单交付并经用户确认处置 |

缺陷分级口径：**阻塞**（无法安装/启动/核心流程不可用）> **严重**（功能错误、数据错误、安全问题）> **一般**（非核心功能缺陷、体验问题）> **轻微**（文案、格式、边缘提示）。

---

## 2. 测试分层：既有回归复用 vs 新增量

### 2.1 既有 16 脚本（R0，直接复用）

复用方式：scripts/acceptance/helpers.mjs 提供 `runCmd` / `McpClient`（stdio JSON-RPC 客户端）/ `Reporter`，新增脚本直接 import；`run-all.mjs` 追加新脚本编号统一编排。**关键改动一处**：helpers 的 `MCP_BIN`/`CLI_BIN` 当前指向本地 `dist/`，新增 `--artifact` 开关（或 `TAPD_TEST_BIN` 环境变量）切换为 npm 产物安装路径，使全部脚本可在「源码产物」与「npm 产物」两种被测对象下重跑。

| 脚本 | 复用方式 | 对 rc 产物执行 |
|------|---------|---------------|
| 01-mcp-bin-stdio | 直接跑，bin 切 npm 产物 | R0 必跑 |
| 02-tools-parity | 直接跑（含 210+2=212 断言、长 ID 白名单） | R0 必跑 |
| 03-error-behavior | 直接跑 | R0 必跑 |
| 04-env-isolation | 直接跑 | R0 必跑 |
| 05-cli-quality | 直接跑，bin 切 npm 产物 | R0 必跑 |
| 06-dual-entry-error | 直接跑 | R0 必跑 |
| 07-unit-tests | 保持跑源码（单测对象是源码本身） | R0 必跑 |
| 08-package-size | 直接跑（对 npm tgz 复核体积） | R0 必跑 |
| 09-extensibility | 保持源码对象（验证的是可扩展机制） | R0 必跑 |
| 10-dual-entry-data | 直接跑，双 bin 均切 npm 产物 | R0 必跑 |
| 11-oauth-write | 直接跑 | R0 必跑 |
| 12-sdk-fetch | 直接跑 | R0 必跑 |
| 13-old-mcp-data | 直接跑（新版侧切 npm 产物，旧版侧仍 1.4.3 实构建） | R0 必跑 |
| 14-credential-masking | 直接跑 | R0 必跑 |
| 15-performance | 直接跑 + 阈值按 E6 口径复核 | R0 必跑 |
| 16-richtext-auto | 直接跑，作为 M4 的基线，17+ 扩容 | R0 必跑 |

### 2.2 新增脚本（编号 17+）

| 脚本 | 模块 | 说明 |
|------|------|------|
| 17-npm-artifact.mjs | M1 | npm 产物链路：npx / 全局安装 / 裸环境冷启动 |
| 18-read-full-sweep.mjs | M2 | 146 只读工具全量逐一调用 |
| 19-write-full-sweep.mjs | M3 | 66 写工具全量逐一 create/update + 读回 |
| 20-richtext-matrix.mjs | M4 | 富文本三层路由扩容（16 号脚本的全量版） |
| 21-longid-bounds.mjs | M5 | 长 ID 防御边界真调用（单测之外的真数据面验证） |
| 22-env-matrix.mjs | M6 | 环境矩阵编排（按代表性组合，不全交叉） |
| 23-mcp-real-client.md | M7 | Claude Code 真实客户端验证清单（手工步骤 + 记录表，非可执行脚本） |
| 24-stability-perf.mjs | M8 | 并发、限流退避、SDK fallback 对照（15 号脚本扩容） |

---

## 3. 分模块用例设计

### 3.1 M1 发布产物链路（脚本 17，估 16 断言，0.5 天）

被测对象只有 npm rc 包，验证「用户拿到手即可用」：

| 用例 | 验证点 |
|------|--------|
| npx 即用 | `npx -y @xihe-lab/tapd-mcp-server@rc` stdio 握手 + `tools/list` 返回 212；首次下载与缓存后二次启动均成功 |
| CLI npx | `npx -y @xihe-lab/tapd-cli@rc --help` / `tapd story list --help` 三级 help 正常 |
| 全局安装 MCP | `npm i -g @xihe-lab/tapd-mcp-server@rc` → 全局 bin `tapd-mcp-server` 握手 + 212 |
| 全局安装 CLI | `npm i -g @xihe-lab/tapd-cli@rc` → `tapd --version` = 2.0.0-rc.1、`tapd config show` 掩码正常 |
| 版本一致性 | 三包 `--version`/serverInfo 交叉一致（cli、mcp 包内 core 版本对齐） |
| 裸环境冷启动 | `HOME` 指向空目录（无 `~/.tapd`）→ CLI 写/读命令返回 AUTH_MISSING 且**含配置引导文案**（如何 `tapd config set` 或设 env），非裸 stack；MCP 无凭证时 tools/call 返回 isError 人类可读文案 |
| 裸环境 + env 凭证 | 无 config 但 `TAPD_ACCESS_TOKEN` 注入 → 正常出数（env 优先级链路） |

抽样策略：npx 与全局安装各验 MCP+CLI 四形态；裸环境验 CLI 读/写 + MCP 各 1 次。npm 网络安装全程免沙箱执行（已知 pnpm/tsx/网络安装被沙箱拦截）。

### 3.2 M2 只读全量 146 工具（脚本 18，估 146+ 断言，1 天）

- 数据源：`docs/derived-commands.txt` 读写标记（write 为空 = 只读 146）
- 每工具一次真实调用（token 认证、workspace 39814312），断言：HTTP 成功语义（`isError=false`）或**已知权限受限白名单**（v1.5.0 确认的 403 四项：workitem_types / workspace_users / projects / attachment_download_url——Basic 凭证下受限，token 凭证下应成功，两种凭证分别跑，差异即记录）
- 每工具断言：响应可 JSON 解析、无 stack trace、无明文 token
- 结果分级：成功 / 空数据合法 / 权限受限（记录） / 失败（缺陷）
- 频控：串行 + 200ms 间隔（只读压力小），预估总时长 ~8-15 分钟；429 时指数退避重试
- 参数策略：每工具用最小合法参数（limit:1 或必填 ID 取自脚本内预先查得的真实实体 ID 池）；需要特定参数的工具（如 `tapd_get_comments` 需 entry）按模块配一组参数模板

### 3.3 M3 写全量 66 工具（脚本 19，估 132+ 断言，1.5 天）

- 范围：derived-commands.txt 标 WRITE 的 66 工具，此前 1287 仅覆盖核心五模块（story/bug/task/iteration/wiki），本轮全量
- 每工具模式：
  - create 类：创建 `zzz-delete-me-` 前缀实体 → 读回断言字段落库 → （可选）update 修改 → 读回
  - update 类：复用 M3 内 create 的产物 ID 或前置实体池 → 修改单字段 → 读回断言
  - 关系/批量/特殊类（relation、batch、copy、lock、set-parent、change_workitem_type 等）：逐一定制前置数据与断言（如 batch_update_stories 建 2 只改 2 只）
  - 不可逆/危险动作约束：lock_iteration 仅对自建 iteration 执行；delete 类仅对自建测试实体执行；**执行前断言目标实体名带 zzz-delete-me- 前缀，否则中止**
- 凭证与频控：OAuth token（写需 OAuth 权限）；**串行 + 1s 间隔**；429/5xx 退避重试 2 次；预估 66 工具 × (2-3 次 API × ~0.6s + 间隔) ≈ **8-12 分钟**纯执行，单轮总配额 < 400 请求，远低于 TAPD 常规限流；断点续跑：脚本落地已完成工具清单，中断后跳过已完成项
- 产物：写全量执行后的 zzz-delete-me- 清理清单并入 E8 交付

### 3.4 M4 富文本三层路由（脚本 20，估 ~80 断言，1 天）

清单来源：`richtext-manifests.generated.ts`（30 写工具自动生成）。三层路由实现：`richtext.ts`。

| 层 | 工具 | 验证 |
|----|------|------|
| 层 1 服务端透传 | `tapd_create_wiki` / `tapd_update_wiki`（SERVER_MD_TOOLS） | md 入参 → `description` 透传给 wiki 服务端（`markdown_description` 自动携带），读回 wiki 网页端渲染正确（人工项 U2 联动） |
| 层 2 客户端双模 | 其余 28 工具（含启发式判定 `looksLikeHtml`） | md 短句（无标签）→ 自动 `markdownIt.render` 转 HTML 落库；已含 HTML 标签的入参 → 原样透传不二次包裹；空串/纯文本无标签语义 → 原样 |
| 层 3 开关关闭 | `TAPD_RICHTEXT_AUTO=0` | 任选 3 个代表工具（story/bug/task）→ md 入参原样落库，不转 HTML |

- **30 工具逐一**（默认开启形态）：每工具 md 短句写入 → 读回断言为 HTML（`<p>` 存在）；不可写 description 侧产物的只断言写入成功 + 读回含内容
- **读侧全实体**：story/bug/task/iteration/wiki/comment/module/version 共 8 类实体各建 1 只含 HTML description → 读回断言 turndown 转 md（`READ_RICHTEXT_FIELDS` 递归扫描 + `looksLikeHtml` 无标签原样两分支）；嵌套结构（list 返回内的 description）1 例
- 新增 2 个显式工具：`tapd_md_to_html` / `tapd_html_to_md` 各 2 断言（往返一致性）
- 与既有 16 号脚本关系：16 号是抽样版保留，20 号为全量扩容，两者并存

### 3.5 M5 长 ID 防御（脚本 21，估 ~30 断言，0.5 天）

- 字段口径：1410 修复的 **26 处字段 / 20 工具**（02-tools-parity EXPECTED_DRIFT 白名单），正则口径 `id|ids|*_id|*_ids`
- 边界用例（真调用 + schema 双面）：
  - 安全整数数字传参：自动转字符串成功（如 `id: 1139814312001001454` 在 Number.isSafeInteger 内）
  - 超 2^53 数字：防御层报错文案「超出 JS 安全整数范围」+ isError（单测已覆盖，真调用抽 2 工具验证）
  - 字符串传参（推荐形态）：原样成功
  - optional 字段缺省：不触发防御、正常成功
  - nullable 显式 null：正常成功
  - `*_ids` 数组形态：确认现状行为（guard 当前不 wrap ZodArray——**此处为已知边界，执行时验证数组传参实际表现并记录，如与预期不符开缺陷**）
  - schema 面：20 工具 inputSchema 中对应字段类型为 string（02 号脚本已覆盖，21 号补真数据面）
- 抽样策略：26 处字段中 safe-integer 转换抽 5 个代表工具真调用，其余以 schema 断言 + 单测覆盖

### 3.6 M6 环境矩阵（脚本 22，估 ~72 断言，1 天）

矩阵轴：Node **20/22/24**（nvm 三版本）× 认证（**token 有效** / **basic 过期凭证**）× 输出（**TTY**（`script -q` 模拟）/ **管道**）× 配置（**有 config** / **无 config**（TAPD_CONFIG_PATH 指空）/ **read_only=true**）。

不做 24 组合全交叉，选 **10 个代表组合**：

| # | Node | 认证 | 输出 | 配置 | 重点 |
|---|------|------|------|------|------|
| 1 | 20 | token | 管道 | 有 config | 基准形态（=R0 默认） |
| 2 | 22 | token | 管道 | 有 config | LTS 主流 |
| 3 | 24 | token | 管道 | 有 config | 最新 |
| 4 | 20 | token | TTY | 有 config | CLI 交互面（颜色/进度） |
| 5 | 20 | basic 过期 | 管道 | 有 config | 认证失败路径：401 语义 + 引导文案 |
| 6 | 22 | basic 过期 | TTY | 有 config | 同上 TTY 面 |
| 7 | 24 | token | 管道 | 无 config + env token | env 优先级 |
| 8 | 22 | 无凭证 | 管道 | 无 config | AUTH_MISSING 引导 |
| 9 | 20 | token | 管道 | read_only=true | MCP 不拦截 / CLI 拦截双形态（04 号已有，跨版本复核） |
| 10 | 24 | token | TTY | 无 config | TTY + 冷启动引导 |

每组合 3 断言：`tools/list` 212 / 1 次读调用成功（或预期错误语义）/ CLI 退出码符合契约。脚本化一键跑完，预估 30-40 分钟。

### 3.7 M7 MCP 真实客户端（文档 23，估 ~14 断言，0.5 天，需用户配合）

- 方式：新建独立目录 `/tmp/claude/mcp-rc-client/.mcp.json` 配 `npx -y @xihe-lab/tapd-mcp-server@rc`，**不动用户日常 .mcp.json**；用户在该目录启动 `claude`（或授权主会话代改并测后恢复）
- 验证清单（人工 + 会话内执行）：
  1. `/mcp` 面板连接成功、显示 212 工具
  2. 会话内实际调用 10 个代表工具：读 7（story/bug/task/iteration/wiki list、count、workflow status-map）+ 写 2（story create→zzz 前缀→update）+ 错误 1（非法参数 → isError 人类可读）
  3. 富文本自动转换在真实客户端生效（story create md → 读回 HTML）1 例
  4. 长 ID 防御真实传参 1 例
  5. 连接稳定性：会话内连续 20 次调用无断连
- 产出：23 号文档记录表逐项打勾 + 截图/输出摘录

### 3.8 M8 性能与稳定（脚本 24，估 ~10 断言，0.5 天）

| 用例 | 口径 |
|------|------|
| CLI 冷启动 | `tapd --help` / `story list --help` 各 5 次采样：P50 ≤ 300ms、Max ≤ 500ms（npm 产物对象） |
| MCP 读延迟 | `tapd_get_stories {limit:3}` 5 次取中位 vs 1.4.3 实构建同参对照，阈值 E6；TAPD_SDK_DISABLED=1 对照组同测 |
| 并发正确性 | 5 并发 × 10 轮混合调用（list + get 交错），响应 id 匹配、无交错污染、零错误 |
| 限流退避 | 短窗高频（20 请求/5s）触发 429 → 观察退避重试后恢复成功，全程无未处理异常 |
| SDK fallback | `TAPD_SDK_DISABLED=1`：CLI+MCP 各 1 读 1 写正常出数（12 号已有抽样，24 号补对 npm 产物的对照） |

### 3.9 M9 遗留项验证（人工/用户，0.5 天）

| 项 | 负责人 | 内容 |
|----|--------|------|
| wiki 43-46 渲染 | 用户 + 白泽出清单 | 1410 期建的自建 wiki（markdown_description 透传）在 TAPD 网页端渲染确认；M4 层 1 联动 |
| Basic 新凭证 | 用户 | 若提供：v1.5.0 的 4 个 403 受限 API 用 Basic 复测；若不提供：书面豁免 |
| dependabot 评估 | 鲁班出结论 + 用户拍板 | 仓库 dependabot PR 清单逐条评估：安全补丁合入、大版本延后；结论记入发布报告 |

---

## 4. 执行排期与分工

依赖顺序：M1（产物可用）→ R0（回归打底）→ M2/M3（数据面全量）→ M4/M5（新能力）→ M6/M7（环境与真实客户端）→ M8 → 汇总。M4/M5 可与 M2/M3 并行编排。

| 阶段 | 内容 | 执行 | 修复 | 工时 |
|------|------|------|------|------|
| P0 准备 | 脚本 17-24 编写、helpers artifact 开关、npm 产物安装 | 白泽 | - | 2 天 |
| P1 | R0：16 脚本对 rc 产物全绿 | 白泽 | 鲁班（如有） | 0.5 天 |
| P2 | M1 + M2 + M3 全量 | 白泽 | 鲁班 | 2 天 |
| P3 | M4 + M5 全量 | 白泽 | 鲁班 | 1.5 天 |
| P4 | M6 + M7 + M8 | 白泽 + 用户（M7） | 鲁班 | 1.5 天 |
| P5 | M9 遗留项 + 缺陷清零复核 + 测试报告 | 白泽 / 用户 / 鲁班 | - | 1 天 |
| **合计** | | | | **~8.5 人日**（AI 执行墙钟预计 3-4 个工作日，含用户确认等待节点） |

角色：**白泽**编写脚本与执行、结果分析与根因定位、缺陷清单维护；**鲁班**缺陷修复（修复后白泽回归复验）；**主会话**编排进度、用户确认节点（计划评审、.mcp.json 授权、豁免签字、发布决策）。

执行规则：缺陷按 TAPD 流程建 bug（workspace 39814312）并同步状态；每阶段完成向主会话汇报摘要；任何输出不打印明文 token（凭证纪律，14 号脚本持续兜底）。

---

## 5. 风险与回退

| 风险 | 概率 | 缓解与回退 |
|------|------|-----------|
| 写全量误伤真实数据 | 低 | 全部写调用目标强制 `zzz-delete-me-` 前缀断言，缺失即中止；lock/delete 类仅对自建实体；清理清单交付用户处置 |
| TAPD 频控/限流 | 中 | 串行 + 间隔 + 429 指数退避；M3 断点续跑；单轮总请求 < 800（读+写），远低于常规配额 |
| npm rc 包自身缺陷阻塞全量 | 低 | 回退用 `pnpm pack` 产物（tgz 本地安装）继续测，缺陷转鲁班，修复发 rc.2 后重跑 R0 |
| Node 24 兼容问题 | 中 | 矩阵隔离发现，兼容缺陷按 E3/E4 分级；确属 Node 上游问题记录豁免 |
| MCP 真实客户端改 .mcp.json 影响用户 | - | 独立目录方案不动日常配置；若需改日常配置，主会话征得用户明确授权、测后恢复 |
| 限流中断导致排期滑动 | 低 | M2/M3 支持断点续跑；优先级 M3 > M2（写路径风险更高） |
| 测试数据残留 | 中 | 全前缀约定 + 清理清单 + 网页端一次性清理；不提供实体删除工具属产品契约，不改 |

---

## 6. 需用户配合项清单（集中列出）

| # | 事项 | 节点 | 说明 |
|---|------|------|------|
| U1 | **本计划评审** | 执行前 | 确认范围/出口标准/排期，特别是 M3 写全量对真实 workspace 的授权 |
| U2 | wiki 43-46 网页渲染确认 | P3 后 | 白泽提供 wiki 清单，用户在 TAPD 网页端目视确认 markdown 渲染 |
| U3 | Basic Auth 新凭证（可选） | P2 前 | 提供则补 4 个 403 受限 API 复测；不提供则书面豁免 |
| U4 | MCP 真实客户端配合 | P4 | 方案 A：用户在 `/tmp/claude/mcp-rc-client/` 目录启动 claude（.mcp.json 白泽备好）；方案 B：授权临时改当前会话 .mcp.json、测后恢复 |
| U5 | zzz-delete-me- 测试数据清理 | P5 | 1287 期遗留 36 只 + 本轮新增，清单交付后用户在 TAPD 网页端清理 |
| U6 | dependabot 评估结论拍板 | P5 | 鲁班出评估，用户决定合入范围 |
| U7 | 出口标准豁免清单签字 | 发布前 | E4 豁免逐条确认；2.0.0 发布 go/no-go 决策 |

---

## 附录 A：资产与复用索引

- 验收脚本：`scripts/acceptance/`（helpers.mjs + 01-16 + run-all.mjs），新增 17-24 同目录同规范
- 首任验收报告：`docs/mvp-acceptance-report.md`（1287 结论与观察项 D1-D5）
- 工具清单：`docs/derived-commands.txt`（212 = 146 读 + 66 写，读写标记即 M2/M3 数据源）
- 富文本清单：`packages/core/src/registry/richtext-manifests.generated.ts`（30 写工具，与工具 schema 同源自动生成）
- 长 ID 白名单：`scripts/acceptance/02-tools-parity.mjs` EXPECTED_DRIFT（20 工具 / 26 处）
- 1.4.3 基线：`/tmp/claude/baseline-tools-143.json`（210 工具）；1.4.3 实构建 `/tmp/claude/tapd-v142`
- 测试项目：workspace_id 39814312；真实凭证 `~/.tapd/config.json`（权限 600，仅进程内注入）

> 附 AI 注脚（文档载体）：本计划由 AI 智能体「白泽」编写 · 2026-09-04 · 供参考，以实际确认为准
