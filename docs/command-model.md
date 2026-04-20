# 命令模型

## 设计原则

- 所有命令操作的对象是**逻辑资产**，而非原始文件
- 命令区分 `--user` 和 `--project` 作用域，**不跨层级混合执行**
- `render`（分发）和 `import`（反向收归）是严格分离的两个操作
- 写操作在存在冲突时默认阻断，而非静默覆盖

## 核心命令

### 初始化

```bash
dotai init --project    # 在当前仓库下初始化 .dotai/ 项目级镜像
dotai init --user       # 在 ~/.dotai/ 初始化用户级镜像
```

### 状态检查

```bash
dotai status                  # 展示当前层级镜像中的资产列表与漂移状态
dotai status --user           # 仅查看用户级镜像状态
dotai diff --target ./CLAUDE.md   # 展示原生文件与最后一次渲染快照的差异
```

### 渲染分发（真相源 → 原生文件）

```bash
dotai render                      # 自动选择目标（见下方说明）
dotai render --target claude      # 渲染生成 CLAUDE.md（与 Claude 兼容）
dotai render --target codex       # 渲染生成 AGENTS.md（与 Codex 兼容）
dotai render --target all         # 渲染所有已配置目标
```

可选标记：

```bash
dotai render --target claude --scope user     # 仅渲染用户级
dotai render --target codex --scope project   # 仅渲染项目级
dotai render --target claude --mode symlink   # 使用软链接模式
```

#### 目标自动选择机制

当未显式指定 `--target` 时，`dotai` 按以下优先级依次解析渲染目标：

| 优先级 | 方式 | 说明 |
|--------|------|------|
| 1 | 显式 `--target` 参数 | 用户手动指定，始终优先 |
| 2 | Skill 调用时注入的上下文 | AI IDE 通过 Skill 调用时自动传入当前工具类型 |
| 3 | 运行环境变量嗅探 | 检测 `CLAUDE_*`、`CODEX_SANDBOX` 等标准环境变量 |
| 4 | `dotai.yaml` 中声明的 `enabled` 目标 | 仅渲染配置中 `enabled: true` 的目标 |
| 5 | 默认值 `all` | 以上均不匹配时，渲染所有支持的目标 |

环境变量嗅探规则：

| 检测信号 | 推断目标 |
|----------|---------|
| `CLAUDE_API_KEY` 或 `CLAUDE_*` 存在 | `claude` |
| `CODEX_SANDBOX` 存在 | `codex` |
| VS Code 插件上下文（已安装 Claude/Copilot/Trae 扩展） | 对应工具 |
| 当前目录已存在某种原生文件 | 优先匹配已存在的格式 |

`dotai.yaml` 静态声明示例：

```yaml
targets:
  claude:
    enabled: true
    output: CLAUDE.md
  codex:
    enabled: true
    output: AGENTS.md
```

执行 `dotai render`（无 `--target`）时，仅渲染 `enabled: true` 的目标，等价于 `--target all` 中的已启用子集。

### 反向导入（原生文件 → 真相源）

```bash
dotai import --from ./CLAUDE.md
dotai import --from ~/.claude/CLAUDE.md
dotai import --from ./.claude/skills/release-helper/SKILL.md
dotai import --from ./AGENTS.md
```

行为说明：

1. 计算原生文件当前内容的指纹
2. 与 `.dotai/state/` 中记录的最后渲染指纹对比
3. 检查真相源（`.dotai/rules/`）自上次渲染后是否也发生了变化
4. **若仅原生文件变化**：生成候选新版本，提示用户确认
5. **若真相源也已变化（双边冲突）**：阻断写入，进入审阅界面，可选调用 AI 辅助融合
6. 用户确认后，更新 `.dotai/rules/`，触发重新渲染分发

### 规则提升（项目 → 用户）

```bash
dotai promote --file .dotai/rules/my-style.md --to user
dotai promote --asset ast_01 --to user
```

行为说明：

- 将规则复制至 `~/.dotai/rules/`，附带出处元数据（来源仓库、时间戳）
- 不删除原始项目级文件
- 执行后提示用户是否立即对用户级镜像执行渲染

### 历史与差异

```bash
dotai history --asset ast_01
dotai diff --asset ast_01 --from ver_01 --to ver_02
dotai diff --target ./AGENTS.md
```

## UX 规则

### 安全默认值

- `render`：仅更新原生分发文件，不修改真相源
- `import`：绝不静默覆盖真相源；存在冲突时必须经过人工确认
- 所有写操作在存在双边冲突时默认阻断

### 粒度控制

写操作均支持以下范围标记：

```bash
--all              # 全量操作
--folder <路径>    # 限定目录范围
--file <路径>      # 限定单文件
--asset <id>       # 按资产 ID 操作
```

### 版本注释

带版本语义的命令支持附加说明：

```bash
dotai import --from ./CLAUDE.md --message "补充日志规范"
dotai promote --file .dotai/rules/style.md --to user --message "提炼为个人默认风格"
```

## 与产品形态的关系

以下命令在三种产品形态中均可触发，共享同一套核心引擎：

| 命令 | CLI | VS Code 插件 | 内置 Skill |
|------|-----|--------------|------------|
| `init` | ✓ | ✓（命令面板） | — |
| `status` / `diff` | ✓ | ✓（侧边栏面板） | ✓ |
| `render` | ✓ | ✓（命令面板） | ✓ |
| `import` | ✓ | ✓（漂移警告操作按钮） | ✓ |
| `promote` | ✓ | ✓（命令面板） | ✓ |

## MVP 最小可用命令集

用于验证核心双向闭环，在引入云同步之前即可完整运行：

```bash
dotai init --project
dotai status
dotai render --target all
dotai import --from <原生目标文件>
dotai diff --target <原生目标文件>
dotai promote --file <规则文件> --to user
```
