# 兼容性矩阵

## 优先支持顺序

1. Codex `AGENTS.md`
2. Claude `CLAUDE.md`
3. Claude Skills（`.claude/skills/`）
4. 其他 IDE 特有格式（后续版本）

## 层级对应关系

`dotai` 严格按照与 AI IDE 一致的层级设计进行物化，各层面管理的原生目标文件如下：

| 层级 | dotai 镜像路径 | Codex 目标 | Claude 目标 |
|------|---------------|------------|-------------|
| 用户级 | `~/.dotai/` | `~/AGENTS.md`（若工具支持） | `~/.claude/CLAUDE.md` |
| 项目级 | `./.dotai/` | `./AGENTS.md` | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` |
| 子路径级 | `./<dir>/.dotai/` | `./<dir>/AGENTS.md` | `./<dir>/CLAUDE.md` |

层级间的规则继承（如用户级覆盖项目级）**由 AI IDE 原生机制处理**，`dotai` 不在生成阶段介入。

## 原生概念映射关系

| dotai 概念 | Codex 输出 | Claude 输出 |
|------------|-----------|-------------|
| 用户级个人默认规则 | `~/AGENTS.md`（作用域继承） | `~/.claude/CLAUDE.md` |
| 项目共享规则 | `./AGENTS.md` | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` |
| 子路径覆盖 | `./subdir/AGENTS.md` | `./subdir/CLAUDE.md` |
| 可复用工作流包（Skill） | 保持为规则形式（Codex 无 Skill 格式） | `.claude/skills/<name>/SKILL.md` |
| 引用导入（@import） | 不支持，仅保留为内联文本 | 支持原生 `@path` 语法 |
| 显式工具约束 | 纯文本内嵌 | Skills frontmatter 中原生支持 |

## 各工具兼容性说明

### Codex

- `AGENTS.md` 已原生支持基于目录的作用域继承，与 `dotai` 层级模型天然对齐。
- 不具备与 Claude Skills 相当的独立包格式，Skill 类资产在 Codex 目标中以普通规则内容呈现。
- 渲染输出时无损降级：保留指令文本，忽略 Skill 包元数据。

### Claude

- `CLAUDE.md` 提供用户级和项目级的原生内存位置，与 `dotai` 层级模型完全对应。
- 渲染器应优先使用 `@path` 引用减少内容重复。
- `.claude/skills/` 提供真正的包级工作流模型，可作为 `dotai` Skill 资产的天然目标。

## 渲染策略约束

由于 Codex 和 Claude 在功能集上存在差异，渲染器设计应将以下内容分层管理：

- **指令内容**：与格式无关，存储于资产 Markdown 中
- **作用域元数据**：在渲染时注入对应格式的注释或 frontmatter
- **渲染策略标记**（`render_policy`）：控制是否在目标中展开、折叠或跳过某段内容
- **目标能力标记**（`target_capabilities`）：声明某资产是否适用于 `codex`、`claude` 或两者

对于 Claude 独有的能力（如 Skills frontmatter），渲染器在输出 Codex 目标时应安全降级并附加转换损失注释。

## MVP 目标策略

第一版应支持：

- 将 `AGENTS.md` 导入为规则资产
- 将 `CLAUDE.md` 导入为规则资产
- 将规则资产渲染回 `AGENTS.md` 和 `CLAUDE.md`
- 将可复用工作流导出为 Claude Skills

第一版**不保证**跨格式的无损往返转换（lossless round-tripping）。转换损失须明确标注，不静默处理。
