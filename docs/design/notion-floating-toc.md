# Notion 浮动目录 — 实现参考（开发用）

基于浏览器对目标 Notion 页面的 DOM 检查与用户截图，供实现阶段对照。

## 布局

| 属性 | 观察值 |
| --- | --- |
| 容器 | `.notion-floating-table-of-contents`，宽约 96px，贴内容区右缘 |
| 指示器列 | 宽约 56px，`padding-inline-end: 8px`，线条区 `padding-inline-start: 20px` |
| 定位 | 内层 `position: absolute; inset-inline-end: 0`，`top` 为像素值（随滚动变化） |
| 与 Banner | Banner 占满顶栏；TOC 从正文列右侧出现，不覆盖 Banner 图，随正文滚动 |

## 收起态（默认）

- 每条目：2px 高横线，`border-radius: 2px`
- 一级：宽 16px；更深子级：宽 12px，`margin-inline-start: 4px`
- 当前节：更高对比度背景色 + `box-shadow: 0 0 3px` 同色
- 非当前：`box-shadow: none`
- 动画：`transition: background 0.2s, box-shadow 0.2s`；容器 `opacity` 过渡 200ms ease

## 展开态（悬停）

- 深色圆角卡片，半透明背景（毛玻璃感）
- 左：保留竖向线条指示器；右：标题列表
- 当前标题：主题色文字（截图中为蓝色）
- 悬停项：浅灰底
- 层级：子标题缩进（与 Obsidian 大纲一致）

## Obsidian 映射（计划）

| Notion | Obsidian |
| --- | --- |
| 页面块标题 | `MetadataCache.getFileCache` → `headings` |
| 滚动容器 | `.markdown-preview-view` / `.cm-scroller` |
| 当前节 | `scroll` + heading 元素 `getBoundingClientRect` |
| Banner 偏移 | `.pixel-banner-image` 高度或 CSS 变量 `--pixel-banner-height` |

## Pixel Banner（本库）

插件目录：`Blog/.obsidian/plugins/pexels-banner`。Banner 高度默认约 350px，可通过 `--pixel-banner-height` 等变量读取；浮动目录的 `top` 计算需扣除「标题区 + Banner」或仅约束在正文滚动区域内。
