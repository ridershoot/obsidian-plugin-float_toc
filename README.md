# Float TOC（个人 Obsidian 插件）

在长笔记里快速看到当前所在章节对应的标题，并提供可定制的浮动目录 UI（功能待实现）。本仓库仅自用，不计划上架社区插件市场。

## 环境要求

- [Obsidian](https://obsidian.md/) 1.5+
- Node.js 18+（当前开发机使用 Node 22）
- npm
- 可选：[Obsidian CLI](https://help.obsidian.md/cli)，用于 `plugin:reload`、`dev:errors` 等调试命令

## 安装依赖

```bash
npm install
```

## 开发

监听编译（生成 `main.js`）：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

Lint：

```bash
npm run lint
```

## 在库（Vault）里加载插件

插件 ID 为 **`float-toc`**，库内目录须为：

```text
<Vault>/.obsidian/plugins/float-toc/
```

本机默认库：`/Users/lixiaofeng/Blog`。一键符号链接：

```bash
chmod +x scripts/link-vault.sh
./scripts/link-vault.sh
# 或指定其他库：./scripts/link-vault.sh /path/to/vault
```

也可手动链接：

```bash
ln -sfn "/Users/lixiaofeng/Playground/obsidian-plugin-float_toc" \
  "/Users/lixiaofeng/Blog/.obsidian/plugins/float-toc"
```

设计参考见 [docs/design/notion-floating-toc.md](./docs/design/notion-floating-toc.md)；决策记录见 [docs/adr/0001-notion-style-floating-toc.md](./docs/adr/0001-notion-style-floating-toc.md)。

然后在 Obsidian 中：**设置 → 社区插件 → 启用 Float TOC**。

若已安装 Obsidian CLI 且 Obsidian 正在运行：

```bash
obsidian plugin:reload id=float-toc
obsidian dev:errors
```

## 仓库结构

- `src/main.ts` — 插件入口与生命周期
- `src/settings.ts` — 设置与设置页（占位）
- `manifest.json` — 插件元数据（`id` 与库内文件夹名一致）
- `esbuild.config.mjs` — 打包配置

更完整的 Obsidian 插件约定见 [AGENTS.md](./AGENTS.md)。

## 许可

MIT（见 [LICENSE](./LICENSE)）
