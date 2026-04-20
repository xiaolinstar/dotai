'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOTAI_DIR = '.dotai';
const RULES_DIR = 'rules';
const STATE_DIR = 'state';
const ASSETS_FILE = 'assets.json';
const TARGETS_FILE = 'managed-targets.json';
const LOG_FILE = 'sync-log.jsonl';
const OUTPUT_NAME = 'dotai';

function activate(context) {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME);

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('dotai.initProject', async () => {
      await withWorkspace(output, async (workspaceRoot) => {
        await initProjectMirror(workspaceRoot, output);
      });
    }),
    vscode.commands.registerCommand('dotai.status', async () => {
      await withWorkspace(output, async (workspaceRoot) => {
        const status = await collectStatus(workspaceRoot);
        showStatus(status, output);
      });
    }),
    vscode.commands.registerCommand('dotai.renderClaude', async () => {
      await withWorkspace(output, async (workspaceRoot) => {
        await ensureMirrorExists(workspaceRoot);
        await renderTarget(workspaceRoot, 'claude', output);
      });
    }),
    vscode.commands.registerCommand('dotai.renderCodex', async () => {
      await withWorkspace(output, async (workspaceRoot) => {
        await ensureMirrorExists(workspaceRoot);
        await renderTarget(workspaceRoot, 'codex', output);
      });
    }),
    vscode.commands.registerCommand('dotai.importManagedTarget', async () => {
      await withWorkspace(output, async (workspaceRoot) => {
        await ensureMirrorExists(workspaceRoot);
        await importManagedTarget(workspaceRoot, output);
      });
    })
  );
}

function deactivate() {}

async function withWorkspace(output, callback) {
  const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('dotai 需要在已打开的工作区中运行。');
    return;
  }

  try {
    await callback(workspaceFolder.uri.fsPath);
  } catch (error) {
    output.appendLine(`[error] ${error.stack || error.message}`);
    output.show(true);
    vscode.window.showErrorMessage(`dotai 执行失败：${error.message}`);
  }
}

async function initProjectMirror(workspaceRoot, output) {
  const dotaiRoot = path.join(workspaceRoot, DOTAI_DIR);
  const rulesRoot = path.join(dotaiRoot, RULES_DIR);
  const stateRoot = path.join(dotaiRoot, STATE_DIR);
  ensureDir(dotaiRoot);
  ensureDir(rulesRoot);
  ensureDir(stateRoot);

  const dotaiYamlPath = path.join(dotaiRoot, 'dotai.yaml');
  if (!fs.existsSync(dotaiYamlPath)) {
    fs.writeFileSync(dotaiYamlPath, defaultDotaiYaml(), 'utf8');
  }

  const assetsPath = path.join(stateRoot, ASSETS_FILE);
  const targetsPath = path.join(stateRoot, TARGETS_FILE);
  if (!fs.existsSync(assetsPath)) {
    writeJson(assetsPath, { assets: [] });
  }
  if (!fs.existsSync(targetsPath)) {
    writeJson(targetsPath, { targets: [] });
  }

  const imported = [];
  imported.push(...bootstrapExistingTarget(workspaceRoot, 'AGENTS.md', '导入的 AGENTS 初始规则'));
  imported.push(...bootstrapExistingTarget(workspaceRoot, 'CLAUDE.md', '导入的 CLAUDE 初始规则'));

  if (listRuleFiles(workspaceRoot).length === 0) {
    const sampleRulePath = path.join(rulesRoot, 'project-defaults.md');
    fs.writeFileSync(sampleRulePath, defaultProjectRule(), 'utf8');
    imported.push(sampleRulePath);
  }

  await rebuildAssetIndex(workspaceRoot);
  logSync(workspaceRoot, {
    operation: 'init',
    result: 'ok',
    details: imported.map((filePath) => path.relative(workspaceRoot, filePath))
  });

  output.appendLine(`[init] 项目镜像已初始化：${dotaiRoot}`);
  vscode.window.showInformationMessage('dotai 项目镜像初始化完成。');
}

function bootstrapExistingTarget(workspaceRoot, filename, title) {
  const existingPath = path.join(workspaceRoot, filename);
  if (!fs.existsSync(existingPath)) {
    return [];
  }

  const targetRulesRoot = path.join(workspaceRoot, DOTAI_DIR, RULES_DIR);
  const importedPath = path.join(targetRulesRoot, toSlug(filename) + '-import.md');
  if (fs.existsSync(importedPath)) {
    return [];
  }

  const content = fs.readFileSync(existingPath, 'utf8').trim();
  const body = `# ${title}\n\n在 dotai 初始化期间从 \`${filename}\` 导入。\n\n${content}\n`;
  fs.writeFileSync(importedPath, body, 'utf8');
  return [importedPath];
}

async function ensureMirrorExists(workspaceRoot) {
  const dotaiRoot = path.join(workspaceRoot, DOTAI_DIR);
  if (!fs.existsSync(dotaiRoot)) {
    const choice = await vscode.window.showInformationMessage(
      '当前工作区还没有 .dotai 镜像，是否现在初始化？',
      '初始化',
      '取消'
    );
    if (choice !== '初始化') {
      throw new Error('项目镜像尚未初始化。');
    }
    await initProjectMirror(workspaceRoot, vscode.window.createOutputChannel(OUTPUT_NAME));
  }
}

async function collectStatus(workspaceRoot) {
  const dotaiRoot = path.join(workspaceRoot, DOTAI_DIR);
  const ruleFiles = fs.existsSync(dotaiRoot) ? listRuleFiles(workspaceRoot) : [];
  const assets = readJson(path.join(dotaiRoot, STATE_DIR, ASSETS_FILE), { assets: [] }).assets;
  const managedTargets = readJson(path.join(dotaiRoot, STATE_DIR, TARGETS_FILE), { targets: [] }).targets;

  const targetStatuses = managedTargets.map((target) => {
    const currentFingerprint = fs.existsSync(target.path)
      ? hashText(fs.readFileSync(target.path, 'utf8'))
      : null;
    let status = 'missing';
    if (currentFingerprint && target.lastRenderFingerprint === currentFingerprint) {
      status = 'rendered_clean';
    } else if (currentFingerprint) {
      status = 'drifted';
    }
    return {
      ...target,
      status
    };
  });

  return {
    workspaceRoot,
    mirrorExists: fs.existsSync(dotaiRoot),
    ruleCount: ruleFiles.length,
    assetCount: assets.length,
    managedTargets: targetStatuses
  };
}

function showStatus(status, output) {
  output.clear();
  output.appendLine(`工作区：${status.workspaceRoot}`);
  output.appendLine(`镜像：${status.mirrorExists ? '已存在' : '不存在'}`);
  output.appendLine(`规则数：${status.ruleCount}`);
  output.appendLine(`资产数：${status.assetCount}`);
  output.appendLine(`受管目标数：${status.managedTargets.length}`);

  if (status.managedTargets.length > 0) {
    output.appendLine('');
    for (const target of status.managedTargets) {
      output.appendLine(`- ${target.targetKind} -> ${target.path} [${translateTargetStatus(target.status)}]`);
    }
  }

  output.show(true);

  const summary = status.managedTargets.length === 0
    ? `dotai 状态：共有 ${status.ruleCount} 条规则，当前还没有受管目标文件。`
    : `dotai 状态：共有 ${status.ruleCount} 条规则，其中 ${status.managedTargets.filter((item) => item.status === 'drifted').length} 个目标文件已漂移。`;
  vscode.window.showInformationMessage(summary);
}

async function renderTarget(workspaceRoot, targetKind, output) {
  const rules = loadRules(workspaceRoot);
  if (rules.length === 0) {
    vscode.window.showWarningMessage('dotai 没有找到可生成的规则文件。');
    return;
  }

  const renderResult = targetKind === 'claude'
    ? renderClaude(rules)
    : renderCodex(rules);

  const targetFilename = targetKind === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  const targetPath = path.join(workspaceRoot, targetFilename);
  fs.writeFileSync(targetPath, renderResult.content, 'utf8');

  updateManagedTarget(workspaceRoot, {
    id: `${targetKind}:${targetPath}`,
    targetKind,
    path: targetPath,
    materializationMode: readRenderMode(),
    sourceAssetIds: rules.map((rule) => rule.id),
    lastRenderFingerprint: hashText(renderResult.content),
    lastRenderedAt: new Date().toISOString(),
    rendererVersion: '0.0.1'
  });

  logSync(workspaceRoot, {
    operation: 'render',
    target: targetKind,
    result: 'ok',
    destination: path.relative(workspaceRoot, targetPath)
  });

  output.appendLine(`[render] ${targetKind} -> ${targetPath}`);
  vscode.window.showInformationMessage(`dotai 已生成 ${targetFilename}。`);
}

async function importManagedTarget(workspaceRoot, output) {
  const targets = readJson(path.join(workspaceRoot, DOTAI_DIR, STATE_DIR, TARGETS_FILE), { targets: [] }).targets;

  let candidates = targets.filter((target) => fs.existsSync(target.path));
  if (candidates.length === 0) {
    candidates = ['CLAUDE.md', 'AGENTS.md']
      .map((filename) => path.join(workspaceRoot, filename))
      .filter((candidatePath) => fs.existsSync(candidatePath))
      .map((candidatePath) => ({
        id: candidatePath,
        path: candidatePath,
        targetKind: path.basename(candidatePath).startsWith('CLAUDE') ? 'claude' : 'codex',
        lastRenderFingerprint: null
      }));
  }

  if (candidates.length === 0) {
    vscode.window.showWarningMessage('dotai 没有找到可导入的受管目标文件。');
    return;
  }

  const picked = await vscode.window.showQuickPick(
    candidates.map((target) => ({
      label: path.relative(workspaceRoot, target.path),
      description: target.targetKind === 'claude' ? 'Claude 目标文件' : 'Codex 目标文件',
      target
    })),
    { placeHolder: '选择一个要导回 .dotai 的目标文件' }
  );

  if (!picked) {
    return;
  }

  const target = picked.target;
  const content = fs.readFileSync(target.path, 'utf8');
  const currentFingerprint = hashText(content);
  if (target.lastRenderFingerprint && target.lastRenderFingerprint === currentFingerprint) {
    vscode.window.showInformationMessage('目标文件与上次生成结果一致，无需导入。');
    return;
  }

  const importPath = createImportedRulePath(workspaceRoot, target);
  fs.writeFileSync(importPath, buildImportedRule(target, content), 'utf8');
  await rebuildAssetIndex(workspaceRoot);

  updateManagedTarget(workspaceRoot, {
    ...target,
    lastImportedAt: new Date().toISOString(),
    lastImportedFingerprint: currentFingerprint
  });

  logSync(workspaceRoot, {
    operation: 'import',
    source: path.relative(workspaceRoot, target.path),
    destination: path.relative(workspaceRoot, importPath),
    result: 'ok'
  });

  output.appendLine(`[import] ${target.path} -> ${importPath}`);
  vscode.window.showInformationMessage(`dotai 已将 ${path.basename(target.path)} 导入到 .dotai/rules。`);
}

async function rebuildAssetIndex(workspaceRoot) {
  const rules = listRuleFiles(workspaceRoot).map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      id: `asset:${path.basename(filePath)}`,
      kind: 'rule',
      title: firstHeading(content) || path.basename(filePath),
      file: path.relative(path.join(workspaceRoot, DOTAI_DIR), filePath),
      hash: hashText(content),
      updatedAt: new Date().toISOString()
    };
  });
  writeJson(path.join(workspaceRoot, DOTAI_DIR, STATE_DIR, ASSETS_FILE), { assets: rules });
}

function loadRules(workspaceRoot) {
  return listRuleFiles(workspaceRoot).map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return {
      id: `asset:${path.basename(filePath)}`,
      title: firstHeading(content) || path.basename(filePath),
      content,
      filePath
    };
  });
}

function listRuleFiles(workspaceRoot) {
  const rulesRoot = path.join(workspaceRoot, DOTAI_DIR, RULES_DIR);
  if (!fs.existsSync(rulesRoot)) {
    return [];
  }

  return fs.readdirSync(rulesRoot)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(rulesRoot, name));
}

function renderClaude(rules) {
  const sections = rules.map((rule) => `## ${rule.title}\n\n${stripTitle(rule.content)}`);
  return {
    content: [
      '# CLAUDE.md',
      '',
      '<!-- 此文件由 dotai 管理。若你直接修改了它，请使用“dotai: 导入受管目标文件”将改动导回 .dotai。 -->',
      '',
      '此文件由本地 `.dotai` 镜像生成。',
      '',
      ...sections
    ].join('\n')
  };
}

function renderCodex(rules) {
  const sections = rules.map((rule) => `## ${rule.title}\n\n${stripTitle(rule.content)}`);
  return {
    content: [
      '# AGENTS.md',
      '',
      '<!-- 此文件由 dotai 管理。若你直接修改了它，请使用“dotai: 导入受管目标文件”将改动导回 .dotai。 -->',
      '',
      '此文件由本地 `.dotai` 镜像生成。',
      '',
      ...sections
    ].join('\n')
  };
}

function updateManagedTarget(workspaceRoot, target) {
  const targetsPath = path.join(workspaceRoot, DOTAI_DIR, STATE_DIR, TARGETS_FILE);
  const existing = readJson(targetsPath, { targets: [] });
  const nextTargets = existing.targets.filter((item) => item.id !== target.id);
  nextTargets.push(target);
  writeJson(targetsPath, { targets: nextTargets.sort((a, b) => a.path.localeCompare(b.path)) });
}

function buildImportedRule(target, content) {
  const title = `从 ${path.basename(target.path)} 导入`;
  return [
    `# ${title}`,
    '',
    `于 ${new Date().toISOString()} 从 \`${target.path}\` 导入。`,
    '',
    stripManagedBanner(content).trim(),
    ''
  ].join('\n');
}

function createImportedRulePath(workspaceRoot, target) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const filename = `${toSlug(path.basename(target.path))}-${stamp}.md`;
  return path.join(workspaceRoot, DOTAI_DIR, RULES_DIR, filename);
}

function readRenderMode() {
  return vscode.workspace.getConfiguration('dotai').get('defaultRenderMode', 'managed-copy');
}

function logSync(workspaceRoot, payload) {
  const logPath = path.join(workspaceRoot, DOTAI_DIR, STATE_DIR, LOG_FILE);
  ensureDir(path.dirname(logPath));
  fs.appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`, 'utf8');
}

function defaultDotaiYaml() {
  return [
    'version: 0.1',
    '',
    'workspace:',
    '  name: 当前工作区',
    '',
    'targets:',
    '  codex:',
    '    enabled: true',
    '    output: AGENTS.md',
    '  claude:',
    '    enabled: true',
    '    output: CLAUDE.md',
    '',
    'sync:',
    '  mode: bidirectional',
    '  render_mode: managed-copy',
    ''
  ].join('\n');
}

function defaultProjectRule() {
  return [
    '# 项目默认规则',
    '',
    '- 保持改动范围清晰，便于审查。',
    '- 代码变更后优先运行相关检查。',
    '- 优先更新 `.dotai`，再重新生成受管目标文件。',
    ''
  ].join('\n');
}

function stripTitle(markdown) {
  return markdown.replace(/^# .+\n+/u, '').trim();
}

function stripManagedBanner(markdown) {
  return markdown
    .replace(/^# (CLAUDE|AGENTS)\.md\n+/u, '')
    .replace(/^<!-- 此文件由 dotai 管理。.*?-->\n+/u, '')
    .replace(/^此文件由本地 `.dotai` 镜像生成。\n+/u, '')
    .trim();
}

function translateTargetStatus(status) {
  const map = {
    rendered_clean: '已生成且未改动',
    drifted: '已漂移',
    missing: '文件缺失'
  };
  return map[status] || status;
}

function firstHeading(markdown) {
  const match = markdown.match(/^# (.+)$/mu);
  return match ? match[1].trim() : null;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = {
  activate,
  deactivate
};
