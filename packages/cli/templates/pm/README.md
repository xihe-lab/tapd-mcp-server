# templates/pm/ — pm 管理语义层场景模板目录

本目录随包发布，存放 `tapd pm <domain> <scenario>` 场景的 pipeline 模板。
S2 只交付框架（命令组 / 发现 / 别名 / 写闸门），**域场景模板由 S3-S6 各波次落盘到本目录**，
框架侧零注册代码：yaml 文件放进来即被 `tapd pm --help` 分组、`tapd pm list` 与别名执行收录。

## 文件命名约定（硬约束）

```
<domain>-<scenario>.yaml      例：risk-scan.yaml、scope-drift-check.yaml
```

- `<domain>` 必须是域表八键之一（小写）：
  `integration | scope | schedule | cost | quality | communication | risk | stakeholder`
  （对应软考高项第4版 第8/9/10/11/12/14/15/17 章；采购第16章、绩效第18章不设域，见设计文档 §2）
- `<scenario>` 为场景 slug，允许连字符（如 `drift-check`）；别名解析按**首个 `-`** 拆分，因此域键不能含 `-`
- 扩展名支持 `.yaml` / `.yml` / `.json`

## frontmatter 字段

```yaml
name: risk-scan                  # 模板名，约定与文件名 stem 一致
domain: risk                     # pm 层扩展字段：域键（执行前由 pm 层剥离，S1 严格 schema 不认识它）
title: 风险扫描（软考第15章）       # help/list 展示
write: false                     # 写闸门依据：含写步骤必须 true（S1 validate 强制）
vars:                            # 变量缺省值，可被 pm flags 覆盖
  iteration_id: ""
steps: []                        # 与 S1 pipeline 模板完全同构（uses/expr/args/where/filter/depends_on）
report: {}                       # format: markdown|text|json + template 插值
```

除 `domain` 外的全部字段与 `tapd pipeline` 模板 schema 一致（见 `src/pipeline/template.ts`）。

## 可用 vars 与注入

| 变量 | 来源 | 说明 |
|------|------|------|
| `${vars.iteration_id}` | `--iteration <id>`；缺省时 pm 自动探测：`tapd_get_iterations status=open`，过滤 `zzz-delete-me*`，按 startdate 取最新 | 迭代作用域，缺省注入到 vars |
| workspace_id | 经 `defaultArgs` 兜底注入每个工具步骤（全局 `--workspace-id`），步骤 args 显式声明优先 | 无需在模板里写 |

## 数据口径（模板内置，代码化的 skill 前置检查）

- 迭代/需求/缺陷类步骤加 `filter: "!item.name.startsWith('zzz-delete-me')"`（缺陷用 title）
- 比率类输出保留分母，不因过滤误导

## 用户覆盖

同名文件放 `~/.tapd/templates/pm/`（或 `TAPD_USER_TEMPLATES_DIR` 指定的根目录下的 `pm/`）即覆盖内置同名场景；
`tapd pm list` 的 `source` 列标记来源。

## 落盘自检

```bash
tapd pm list                       # 新场景应出现在清单
tapd pm <domain> <scenario> --dry-run   # 计划预览 + 写闸门
tapd pipeline validate <file>      # S1 静态校验（注意：含 domain 字段时请用 tapd pm 执行）
```
