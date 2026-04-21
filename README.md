# dotai

`dotai` 是一个面向 AI 编码工具的指令资产管理系统，用来管理本地 `.dotai` 镜像，并生成原生的 AI 指令文件，例如 `AGENTS.md` 和 `CLAUDE.md`。

它的核心是统一的规则管理与双向同步能力，CLI 和 VS Code 插件都是它的使用入口。

当前这个版本是本地优先的 MVP，主要验证下面这条核心链路：

- 在 `.dotai/rules` 中维护项目规则
- 将规则生成到原生目标文件
- 记录哪些目标文件由 dotai 管理
- 将目标文件中的直接修改重新导回 `.dotai`

## 为什么需要它

不同 AI 编码工具正在采用不同的规则格式：

- Codex 使用 `AGENTS.md`
- Claude 使用 `CLAUDE.md`
- 其他工具还有各自的规则目录和配置文件

`dotai` 在这些原生格式之上增加了一层统一管理能力，让你可以：

- 在 `./.dotai/` 中维护项目镜像
- 用 Git 管理规则文件版本
- 按需生成原生目标文件
- 检测目标文件被直接修改后的漂移
- 将这些修改回收进受管镜像

## MVP 功能

- 初始化项目级 `.dotai` 镜像
- 初始化时导入已有的 `AGENTS.md` 或 `CLAUDE.md`
- 将 `.dotai/rules/*.md` 生成到 `AGENTS.md` 和 `CLAUDE.md`
- 在 `.dotai/state/managed-targets.json` 中跟踪受管目标文件
- 将受管目标文件中的直接修改导回 `.dotai/rules`
- 在输出面板中显示本地状态和漂移信息

## 当前已支持

- 项目级 `.dotai` 镜像初始化
- `AGENTS.md` 与 `CLAUDE.md` 双目标渲染
- 受管目标文件状态跟踪
- 直接修改后的手动导回
- CLI 与 VS Code 两种操作入口

## 当前未支持

- 用户级镜像，例如 `~/.dotai/`
- Claude Skills 分发
- 冲突审阅与 AI 辅助合并
- 云端同步与规则市场

## 命令

- `dotai: 初始化项目镜像`
- `dotai: 查看状态`
- `dotai: 生成 CLAUDE.md`
- `dotai: 生成 AGENTS.md`
- `dotai: 导入受管目标文件`

## 快速开始

1. 运行 `dotai: 初始化项目镜像`
2. 编辑 `./.dotai/rules/` 中的 Markdown 规则文件
3. 运行 `dotai: 生成 CLAUDE.md` 或 `dotai: 生成 AGENTS.md`
4. 如果你后来直接修改了目标文件，再运行 `dotai: 导入受管目标文件`

## 会创建哪些文件

```text
.dotai/
  dotai.yaml
  rules/
    project-defaults.md
  state/
    assets.json
    managed-targets.json
    sync-log.jsonl
```

## 当前范围

`0.0.1` 是一个聚焦本地双向工作流的一天版 MVP，当前以项目级镜像、CLI / VS Code 双入口和基础渲染导回能力为核心，暂时不包含云端同步。

长期方向包括：

- 用户级镜像支持，例如 `~/.dotai/`
- 云端个人扩展库
- 按全量、文件夹、文件进行选择性同步
- 更丰富的目标支持，包括 Claude Skills

## 设计文档

- [docs/product-prd.md](docs/product-prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md)
- [docs/domain-model.md](docs/domain-model.md)
- [docs/command-model.md](docs/command-model.md)
- [docs/sync-lifecycle.md](docs/sync-lifecycle.md)
- [docs/user-stories.md](docs/user-stories.md)
- [docs/competitive-analysis.md](docs/competitive-analysis.md)
- [docs/demo-walkthrough.md](docs/demo-walkthrough.md)
- [docs/release-checklist.md](docs/release-checklist.md)
