# ADR 0001: Notion 风格浮动目录

## Status

Accepted (2026-10-21)

## Context

- 长笔记编辑时需要知道当前所在章节，又不想频繁开关右侧大纲侧栏。
- 曾使用社区 `obsidian-floating-toc-plugin`，与 Pixel Banner（库内插件 ID：`pexels-banner`）样式冲突，且视觉不满意。
- 参考 Notion 页面 [tailwindcss v4 变化速记](https://app.notion.com/p/tailwindcss-v4-2005fabb62c1802c9664ef766cfc23a9) 的浮动目录交互与样式。

## Decision

1. **展示形态**：编辑区内容列右侧的浮动控件（非 Obsidian 右侧边栏大纲）。
2. **双态 UI**（对齐 Notion DOM 行为）：
   - **收起态**：一列短横线（约 2px 高、16px 宽；子级略短并右缩进），当前章节对应线条高亮并带轻微发光；线条间距约 12px。
   - **展开态**：悬停时显示圆角半透明面板，列出标题全文；当前项用主题色强调；支持点击跳转。
3. **纵向位置**：控件 `position: absolute`，相对编辑区滚动容器；`top` 随滚动更新，使指示器贴近当前阅读位置（Notion 使用 inline `top` + `inset-inline-end: 0`）。
4. **Banner 兼容**：检测 Pixel Banner 渲染后的有效顶部高度（如 `--pixel-banner-height` 及相关布局），为浮动目录预留 `top` / `margin` 偏移；设置页提供手动微调。
5. **平台**：首版仅桌面（`isDesktopOnly: true`），macOS 自用。
6. **开发库**：本地 Vault（路径因设备而异），通过符号链接加载本仓库。

## Consequences

- 需要监听 Markdown 视图滚动、标题结构变化，以及 Banner 高度变化（ResizeObserver / CSS 变量）。
- 样式应使用 Obsidian CSS 变量，避免与 `pexels-banner` 硬编码冲突。
- 移动端与社区发布不在首版范围。

## Reference notes (Notion)

- 根节点 class：`notion-floating-table-of-contents`
- 收起指示器：多个 `height: 2px` 的 div，嵌套层级通过 `width`（16 vs 12）与 `margin-inline-start` 表达
- 过渡：`opacity` / `background` / `box-shadow` 约 200ms ease
