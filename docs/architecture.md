# 架构设计

## 核心原则

`dotai` 的架构围绕一个核心约束展开：

**层级隔离 + 单一真相源 + 原生格式输出。**

`dotai` 不在运行时合并多层级规则。各层级的规则继承与优先级由 AI IDE 原生机制处理。`dotai` 只负责在其所属层级内维护唯一的规则底稿，并将其渲染为对应的原生格式。

## 推荐构建顺序

1. 核心引擎（不依赖 VS Code，可独立运行）
2. CLI 封装层
3. VS Code 插件（调用核心引擎）
4. 内置 Skill 模块

## 为什么按照这个顺序

核心引擎先行，才能保证业务逻辑不被困在某一个交互层内。CLI 和 VS Code 插件共享同一套引擎，内置 Skill 也通过相同接口驱动所有操作。

## 系统结构图

```text
.dotai/（项目级镜像） + ~/.dotai/（用户级镜像）
            |
            v
      核心引擎（Core Engine）
        - 规则解析器（Parser）
        - 目标解析器（Target Resolver）        ← 自动选择渲染目标
        - 指纹快照管理（Fingerprint Manager）
        - 漂移检测器（Drift Detector）
        - 导入处理器（Import Processor）
        - 冲突仲裁器（Conflict Resolver）
        - 渲染器（Renderers: Codex / Claude / Skills）
            |
            +---- CLI（dotai <command>）
            |       └── 环境变量嗅探
            |
            +---- VS Code 插件（可视化面板与差异审阅）
            |       └── 已安装扩展检测
            |
            +---- 内置 Skill（AI 驱动的管理操作接口）
                    └── AI IDE 注入上下文
            |
            v
      原生分发产物（Managed Targets）
        AGENTS.md / CLAUDE.md / .claude/skills/ 等
```

## 层级模型

`dotai` 严格遵循与 AI IDE 一致的层级设计，各层**物理隔离，互不干预**：

| 层级 | 镜像路径 | 负责生成的原生目标 |
|------|----------|---------------------|
| 用户级 | `~/.dotai/` | `~/.claude/CLAUDE.md` 等全局配置 |
| 项目级 | `./.dotai/` | `./CLAUDE.md`、`./AGENTS.md`、`./.claude/skills/` 等 |
| 子路径级 | `./<dir>/.dotai/`（可选） | 子目录覆盖文件 |

层级合并由 AI IDE 原生机制处理，`dotai` 不介入。

## 单一真相源模型

```text
.dotai/rules/*.md         ← 唯一的规则底稿（Single Source of Truth）
       |
       | dotai render
       v
CLAUDE.md                 ← Claude 分发产物（派生，非源头）
AGENTS.md                 ← Codex 分发产物（派生，非源头）
.claude/skills/**         ← Claude Skills 分发产物（派生，非源头）
```

原生文件一旦被直接修改，必须通过 `dotai import` 流程将改动安全收归至 `.dotai/rules/`，而非让其成为新的真相源。

## Target Resolver（目标解析器）

Target Resolver 是核心引擎中负责决定"本次渲染面向哪些工具目标"的独立组件。它在用户未显式指定 `--target` 时自动推断，确保工具在任何调用上下文下都能给出最合理的默认行为。

### 优先级顺序

```text
显式 --target 参数
    ↓（未指定时继续）
Skill 调用注入的 target 字段（AI IDE 自动传入）
    ↓（未注入时继续）
运行环境变量嗅探
    ↓（未匹配时继续）
dotai.yaml 中 enabled: true 的目标集合
    ↓（未配置时）
默认值：all
```

### 三条注入路径

#### 路径 1：CLI 环境变量嗅探

在 CLI 调用时，Target Resolver 检测如下标准环境变量：

| 环境变量 | 推断目标 |
|----------|----------|
| `CLAUDE_API_KEY` 或 `ANTHROPIC_API_KEY` | `claude` |
| `CODEX_SANDBOX` | `codex` |
| 当前目录已存在某种格式的原生文件 | 优先匹配该格式 |

#### 路径 2：VS Code 插件上下文检测

插件启动时扫描当前 VS Code 环境中已安装的 AI 扩展列表：

| 已安装扩展 | 推断目标 |
|-----------|----------|
| Claude for VS Code | `claude` |
| GitHub Copilot | `copilot`（后续支持） |
| Trae | `trae`（后续支持） |

检测结果写入插件运行时上下文，在触发渲染操作时自动传递给 Target Resolver，无需用户手动指定。

#### 路径 3：Skill 调用注入

AI IDE 通过 Skill 调用 `dotai` 时，可在请求体中传入当前工具上下文：

```json
{
  "action": "render",
  "target": "claude",
  "scope": "project"
}
```

这使得用户在 AI 对话中触发渲染时，工具类型完全由 AI IDE 的 Skill 运行时自动感知并注入，**无需任何人工干预**。

### `dotai.yaml` 静态配置

Target Resolver 的 fallback 依据为 `dotai.yaml` 中的 `targets` 声明：

```yaml
targets:
  claude:
    enabled: true
    output: CLAUDE.md
  codex:
    enabled: true
    output: AGENTS.md
```

未显式指定 `--target` 时，仅渲染 `enabled: true` 的目标，等价于 `--target all` 的已启用子集。

## 核心概念

### Rule（规则）

`.dotai/rules/` 下的一个 Markdown 文件。包含人类可读的指令内容和可选的元数据 frontmatter。

### Asset（资产）

对一个规则文件的逻辑追踪单元，携带稳定 ID、版本指纹、作用域、出处元数据。

### Managed Target（受管目标）

由 `dotai render` 输出的原生格式文件。系统在 `.dotai/state/` 中记录其最后一次渲染的指纹快照，用于后续的漂移检测。

### Fingerprint（指纹快照）

每次 `render` 时计算的内容 SHA-256 哈希值。`import` 时用于判断真相源在分发后是否发生了变动，是冲突检测的基础。

### Drift（漂移）

受管目标文件的当前内容与其最后一次渲染指纹不一致时的状态标记。

### Conflict（冲突）

发起 `import` 时，若真相源（`.dotai/rules/`）本身也已在该分发产物生成之后发生了修改，则判定为双边冲突，强制进入人工审阅流程。

## 冲突处理架构

冲突处理分为两层，有序执行：

### 第一层：强指纹快照拦截

```text
render → 写入 last_render_fingerprint
import → 计算当前真相源指纹
       → 若指纹与分发时不一致 → 标记 conflict → 阻断写入 → 进入审阅
```

### 第二层：AI Skill 语义融合（可选）

在审阅界面提供"AI 辅助合并"入口，调用内置 Skill 对两个版本进行语义分析，输出融合草案。用户确认后方可写入。

## 受管目标的物化模式

`dotai` 支持三种写入文件的模式：

### 1. 拷贝（Copy）

直接将内容写入目标路径，目标文件是独立的物理文件。

适用场景：工具不兼容软链接、希望目标文件可移植。

### 2. 软链接（Symlink）

在目标路径创建指向 `.dotai` 管理文件的软链接。

适用场景：工具兼容软链接、用户希望只维护一份物理文件。

### 3. 受管拷贝（Managed Copy）

写入物理文件，同时在 `.dotai/state/` 中保存 sidecar 元数据（指纹、来源映射等）。

适用场景：需要双向编辑和漂移检测时。**推荐默认模式。**

## 渲染器策略

### Codex 渲染器

输出 `AGENTS.md`，保留：

- 作用域注释
- 测试与代码规范指令
- 操作约束

### Claude 渲染器

输出 `CLAUDE.md`，支持：

- 通用记忆内容
- `@path` 引用导入（减少重复）
- Skills 包输出至 `.claude/skills/<name>/SKILL.md`

若规则内容比目标格式所能承载的更丰富，渲染器应：

- 安全降级（flatten）
- 附加转换损失注释
- 保持输出人类可读

## VS Code 插件职责

插件只是引擎的视图层，不是真相源。它应提供：

- 规则树视图（用户级 + 项目级分组展示）
- 漂移与冲突警告提示
- 差异对比审阅面板
- 导入、渲染、提升等操作快捷入口

## Skill 模块职责

内置 Skill 作为 AI 代理的调用接口，允许在 AI IDE 内通过自然语言驱动 `dotai` 操作，例如：

- 沉淀对话中约定的编码规范为规则文件
- 检查当前工作区的漂移状态
- 提出规则提升建议并执行
- 辅助进行冲突语义融合

Skill 消费核心引擎提供的接口，不绕过任何管控流程。
