# release checklist

## 仓库检查

- 确认 `main` 已推送到 GitHub 远程仓库。
- 确认 `git status --short` 为空。
- 确认版本号、`CHANGELOG.md` 与发布说明一致。

## 插件内容检查

- 确认 `.vscodeignore` 已排除 `docs/`、`examples/`、`.dotai/`、`.idea/` 与 `*.vsix`。
- 确认实际发布内容仅包含运行所需文件，例如 `package.json`、`extension.js`、`README.md`、`CHANGELOG.md`、`LICENSE`。
- 确认 `README-marketplace.md` 与 `README.md` 对当前支持范围的描述一致。

## 发布前验证

- 运行 `node --check extension.js`。
- 在 VS Code 中手动验证初始化、渲染、状态查看、导回 4 条主链路。
- 确认对外文案准确区分“dotai 的产品定位”和“当前仓库 / 当前扩展的实际交付范围”。
- 确认不会把用户级镜像、Claude Skills、冲突审阅、云端同步等未交付能力写成当前版本已可用。
