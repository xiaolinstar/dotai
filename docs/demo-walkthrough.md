# 本地演示流程

这份文档演示 `dotai` 在真实工作区中的核心使用场景，覆盖双向闭环的完整链路。

## 安装

### VS Code 插件

1. 打开 VS Code
2. 打开扩展面板
3. 点击右上角 `...`，选择 `Install from VSIX...`
4. 选择对应的 `.vsix` 文件

### CLI

```bash
npm install -g dotai   # 后续版本发布后可用
```

## 演示流程

### 1. 初始化项目级镜像

```bash
dotai init --project
```

预期结果：

```text
.dotai/
  dotai.yaml
  rules/
    project-defaults.md     # 若工作区无已有规则文件，自动生成示例
  state/
    assets.json
    managed-targets.json
    sync-log.jsonl
```

若工作区中已存在 `AGENTS.md` 或 `CLAUDE.md`，`init` 会将其导入为初始资产，存入 `.dotai/rules/`，**原文件保持不变**。

### 2. 查看当前状态

```bash
dotai status
```

预期输出：

```text
镜像：.dotai/（项目级）
规则数：2
受管目标数：0（尚未执行渲染）
```

### 3. 渲染至原生格式

```bash
dotai render --target all
```

预期结果：

- 工作区根目录下生成 `CLAUDE.md` 和 `AGENTS.md`
- 两个文件均带有 dotai 管理标注（注释头部）
- `.dotai/state/managed-targets.json` 记录两个文件的渲染指纹

**注意**：`CLAUDE.md` 和 `AGENTS.md` 是**分发产物**，不是真相源。避免将其作为主要编辑入口。

### 4. 直接修改原生文件（模拟漂移场景）

打开 `CLAUDE.md`，在末尾追加一条规则：

```md
- 提交信息尽量简洁，并带上清晰的 scope 前缀。
```

### 5. 检查漂移状态

```bash
dotai status
```

预期输出：

```text
CLAUDE.md  →  [已漂移]
AGENTS.md  →  [已生成且未改动]
```

```bash
dotai diff --target ./CLAUDE.md     # 查看与渲染快照的具体差异
```

### 6. 将修改安全导入回真相源

```bash
dotai import --from ./CLAUDE.md
```

系统执行步骤：

1. 计算 `CLAUDE.md` 当前内容指纹
2. 检查 `.dotai/rules/` 自上次渲染后是否也被修改
3. **若无双边冲突**：生成候选新版本，提示确认
4. **若发现双边冲突**：阻断写入，进入审阅界面

确认后，修改被写入对应的 `.dotai/rules/` 文件。

### 7. 重新渲染分发

```bash
dotai render --target all
```

预期结果：

- 刚才导入的规则正式成为唯一真相源的一部分
- 重新生成 `CLAUDE.md` 和 `AGENTS.md`，两处均包含新规则

### 8. 提升为用户级规则（可选）

若希望将本项目验证过的规则沉淀进个人扩展库：

```bash
dotai promote --file .dotai/rules/project-defaults.md --to user
```

规则被复制至 `~/.dotai/rules/`，附带出处元数据，全局生效。

## 这个流程验证了什么

本演示证明了单一真相源双向闭环的核心机制可以成立：

1. `.dotai/rules/` 是唯一的规则底稿
2. 原生文件（`CLAUDE.md`、`AGENTS.md`）是渲染分发产物
3. 对原生文件的直接修改可以被安全收归，不丢失数据
4. 指纹快照机制可以检测双边冲突并阻断写入
5. 跨层级的规则提升路径可以正常执行

这是后续云端同步与 AI Skill 集成的功能基础。
