# 领域模型

## 设计目标

该模型必须支持：

- 物理隔离的用户级与项目级镜像
- 单一真相源资产管理与版本追踪
- 指纹快照驱动的漂移检测与双边冲突识别
- Codex 与 Claude 原生格式输出
- 可选的云端版本同步（后续版本）

## 核心实体

### Library（库）

一个逻辑集合，包含属于同一层级的所有资产。

类型：

- `personal`：用户级，根路径 `~/.dotai/`
- `project`：项目级，根路径 `./.dotai/`

标识符建议：

- `lib_personal_<account_id>`
- `lib_project_<workspace_id>`

### Asset（资产）

独立于任何渲染输出文件的逻辑指令单元，是系统版本追踪的最小粒度。

类型（`kind`）：

- `rule`：Markdown 格式的指令规则文件
- `skill`：可复用的工作流包
- `bundle`：一组规则或 Skill 的命名集合

示例字段：

```yaml
asset:
  id: ast_01
  library_id: lib_project_ws123
  kind: rule
  title: 代码提交规范
  scope: project
  canonical_path: rules/commit-style.md
  target_capabilities: [codex, claude]
  tags: [style, git]
  created_at: 2026-04-19T12:00:00Z
  updated_at: 2026-04-19T14:00:00Z
```

### Asset Version（资产版本）

资产内容的不可变快照，每次接受导入或手动编辑后创建新版本。

```yaml
asset_version:
  id: ver_02
  asset_id: ast_01
  parent_version_id: ver_01
  content_hash: sha256:abc123
  author: user_u123
  message: 补充 scope 格式要求
  created_from: import_from_claude_md
  created_at: 2026-04-19T14:00:00Z
```

### Mirror（镜像）

某个 Library 在本地磁盘的工作副本。

类型：

- 用户镜像：`~/.dotai/`
- 项目镜像：`./.dotai/`

```yaml
mirror:
  id: mir_project_ws123
  library_id: lib_project_ws123
  root_path: ./.dotai
  role: project
  last_render_at: 2026-04-19T14:00:00Z
```

### Managed Target（受管目标）

由 `dotai render` 输出并被系统追踪的原生格式文件。

```yaml
managed_target:
  id: tgt_01
  target_kind: claude
  materialization_mode: managed_copy
  path: ./CLAUDE.md
  source_asset_ids: [ast_01, ast_02]
  last_render_fingerprint: sha256:def456
  last_rendered_at: 2026-04-19T14:00:00Z
  last_imported_at: null
```

**`last_render_fingerprint`** 是双向冲突检测机制的核心字段：

- `render` 时写入
- `import` 时读取并与真相源的当前指纹比对
- 若两侧均发生变动，判定为双边冲突

### Sync Record（同步记录）

任意 `render`、`import`、`promote` 操作的日志记录。

```yaml
sync_record:
  id: sync_01
  operation: import
  source: ./CLAUDE.md
  destination: .dotai/rules/commit-style.md
  asset_ids: [ast_01]
  result: conflict_review     # rendered_clean | imported | conflict_review | rejected
  conflict_detected: true
  created_at: 2026-04-19T14:10:00Z
```

## 作用域模型

| 作用域 | 层级 | 镜像路径 |
|--------|------|----------|
| `user` | 用户级 | `~/.dotai/` |
| `project` | 项目级 | `./.dotai/` |
| `path` | 子路径级（可选） | `./<dir>/.dotai/` |

作用域之间**不由 `dotai` 合并**，运行时优先级交由 AI IDE 原生机制处理。

## 每个资产应携带的元数据

```yaml
metadata:
  id: ast_01
  scope: project
  target_capabilities: [codex, claude]
  sync_policy: bidirectional
  source_origin: import_from_agents_md   # 或 manual | promoted_from_project
  last_render_fingerprint: sha256:ghi789
  provenance:
    promoted_from: lib_project_ws456     # 若为提升而来
    promoted_at: 2026-04-19T10:00:00Z
```

## 文件结构

### 项目镜像

```text
./.dotai/
  dotai.yaml
  rules/
    commit-style.md
    test-policy.md
  skills/
    release-helper/
      SKILL.md
  bundles/
  state/
    assets.json
    managed-targets.json
    sync-log.jsonl
    drift-index.json
```

### 用户镜像

```text
~/.dotai/
  dotai.yaml
  rules/
  skills/
  bundles/
  state/
    assets.json
    managed-targets.json
    sync-log.jsonl
    drift-index.json
```

## 为什么逻辑资产优先于文件

若系统仅对渲染输出文件（如 `CLAUDE.md`）进行版本管理，则：

- 一次对 `CLAUDE.md` 的修改无法安全地同步至 `AGENTS.md`
- 项目规则提升至个人库时，仅能进行字符串粗暴复制，失去语义关联
- 文件夹或文件粒度的选择性同步失去实际意义

逻辑资产层使跨目标格式的安全传播和跨层级的规则提升成为可能。
