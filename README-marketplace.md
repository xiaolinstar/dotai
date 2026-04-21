# dotai

`dotai` 是一个面向 AI 编码工具的指令资产管理系统，CLI 和 VS Code 插件都是它的使用入口。

当前这个扩展提供的是 `dotai` 在 VS Code 内的操作界面，用来管理本地 `.dotai` 镜像，并生成原生 AI 代理指令文件，例如 `AGENTS.md` 和 `CLAUDE.md`。

## MVP 功能

- 初始化项目级 `.dotai` 镜像
- 将已有的 `AGENTS.md` 或 `CLAUDE.md` 导入 `.dotai/rules`
- 将 `.dotai/rules` 生成到原生目标文件
- 跟踪受管目标并检测漂移
- 将目标文件中的直接修改重新导回 `.dotai`

## 当前版本范围

当前 `0.0.1` 聚焦项目级本地工作流，这个扩展负责 VS Code 内的命令入口。

已支持：

- 项目级 `.dotai` 初始化
- `AGENTS.md` / `CLAUDE.md` 渲染
- 状态查看与漂移提示
- 手动导回受管目标改动
- 与 CLI 共享同一产品语义

暂未支持：

- 用户级镜像
- Claude Skills 分发
- 冲突审阅
- 云端同步

## 命令

- `dotai: 初始化项目镜像`
- `dotai: 查看状态`
- `dotai: 生成 CLAUDE.md`
- `dotai: 生成 AGENTS.md`
- `dotai: 导入受管目标文件`

## 工作方式

1. 初始化 `.dotai`
2. 在 `.dotai/rules` 中新增或修改 Markdown 规则
3. 生成原生目标文件
4. 如果你后来直接修改了 `CLAUDE.md` 或 `AGENTS.md`，再把这些修改导回 `.dotai`

当前第一版是本地优先的精简 MVP，先用来验证核心双向工作流，云端同步会在后续版本中补上。
