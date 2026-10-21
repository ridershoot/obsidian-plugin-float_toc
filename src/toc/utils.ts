import { HeadingCache, MarkdownView, stripHeading, TFile } from "obsidian";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function isLivePreview(view: MarkdownView): boolean {
	return view.getMode() === "source" && view.containerEl.classList.contains("is-live-preview");
}

/** Reading view or live preview — not plain source mode. */
export function shouldShowFloatToc(view: MarkdownView): boolean {
	if (view.getMode() === "preview") return true;
	return isLivePreview(view);
}

function isScrollableY(el: HTMLElement): boolean {
	if (el.scrollHeight <= el.clientHeight + 1) return false;
	const { overflowY } = getComputedStyle(el);
	return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

export function getMarkdownContentRoot(view: MarkdownView): HTMLElement | null {
	const el = view.containerEl.querySelector(".markdown-reading-view, .markdown-preview-view");
	return el instanceof HTMLElement ? el : null;
}

/** Markdown surface used for heading resolution and resize observation. */
export function getMarkdownMountRoot(view: MarkdownView): HTMLElement {
	return getMarkdownContentRoot(view) ?? view.contentEl;
}

/** Pane content area; overlay is absolutely positioned inside it. */
export function getFloatTocOverlayHost(view: MarkdownView): HTMLElement {
	const viewContent = view.containerEl.querySelector(".view-content");
	if (viewContent instanceof HTMLElement) return viewContent;
	return view.contentEl;
}

function collectAncestorChain(start: HTMLElement | null): HTMLElement[] {
	const chain: HTMLElement[] = [];
	let node: HTMLElement | null = start;
	while (node) {
		chain.push(node);
		node = node.parentElement;
	}
	return chain;
}

/** Outermost element in the chain that actually scrolls along Y. */
export function getScrollElement(view: MarkdownView): HTMLElement | null {
	const starts: HTMLElement[] = [];
	const contentRoot = getMarkdownContentRoot(view);
	if (contentRoot) starts.push(contentRoot);

	if (view.getMode() !== "preview") {
		const scroller = view.containerEl.querySelector(".cm-scroller");
		if (scroller instanceof HTMLElement) starts.push(scroller);
	}

	const viewContent = view.containerEl.closest(".view-content");
	if (viewContent instanceof HTMLElement) starts.push(viewContent);

	if (!starts.length) starts.push(view.contentEl);

	const scrollables: HTMLElement[] = [];
	for (const start of starts) {
		for (const node of collectAncestorChain(start)) {
			if (isScrollableY(node) && !scrollables.includes(node)) {
				scrollables.push(node);
			}
		}
	}

	if (!scrollables.length) return starts[0] ?? null;
	return scrollables[scrollables.length - 1] ?? null;
}

/** All scrollable ancestors worth listening to (outer + inner). */
export function getScrollElements(view: MarkdownView): HTMLElement[] {
	const primary = getScrollElement(view);
	if (!primary) return [];

	const set = new Set<HTMLElement>();
	for (const start of [primary, getMarkdownContentRoot(view), view.contentEl]) {
		if (!(start instanceof HTMLElement)) continue;
		for (const node of collectAncestorChain(start)) {
			if (isScrollableY(node)) set.add(node);
		}
	}
	return [...set];
}

export function getHeadingsForFile(
	app: import("obsidian").App,
	file: TFile | null,
	minLevel: number,
	maxLevel: number
): HeadingCache[] {
	if (!file) return [];
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.headings?.length) return [];
	return cache.headings.filter(h => h.level >= minLevel && h.level <= maxLevel);
}

const PREVIEW_HEADING_SELECTOR =
	".markdown-reading-view h1, .markdown-reading-view h2, .markdown-reading-view h3, .markdown-reading-view h4, .markdown-reading-view h5, .markdown-reading-view h6, " +
	".markdown-preview-view h1, .markdown-preview-view h2, .markdown-preview-view h3, .markdown-preview-view h4, .markdown-preview-view h5, .markdown-preview-view h6";

function listPreviewHeadingCandidates(view: MarkdownView): HTMLElement[] {
	return Array.from(view.containerEl.querySelectorAll(PREVIEW_HEADING_SELECTOR)).filter(
		(el): el is HTMLElement => el instanceof HTMLElement
	);
}

function listLivePreviewHeadingCandidates(view: MarkdownView): HTMLElement[] {
	return Array.from(view.containerEl.querySelectorAll(".cm-line")).filter(
		(line): line is HTMLElement =>
			line instanceof HTMLElement && Boolean(line.querySelector('[class*="cm-header-"]'))
	);
}

function previewHeadingLevel(el: HTMLElement): number {
	const n = Number.parseInt(el.tagName.slice(1), 10);
	return Number.isFinite(n) ? n : 0;
}

function livePreviewHeadingLevel(line: HTMLElement): number {
	const header = line.querySelector('[class*="cm-header-"]');
	if (!header?.className) return 0;
	const match = header.className.match(/cm-header-(\d)/);
	const level = match?.[1];
	return level ? Number.parseInt(level, 10) : 0;
}

function headingElementMatches(
	el: HTMLElement,
	heading: HeadingCache,
	view: MarkdownView
): boolean {
	const text = (el.textContent ?? "").trim();
	if (stripHeading(text) !== stripHeading(heading.heading)) return false;
	const level =
		view.getMode() === "preview" ? previewHeadingLevel(el) : livePreviewHeadingLevel(el);
	return level === heading.level;
}

function headingFromDataLineBlock(block: Element): HTMLElement | null {
	if (block instanceof HTMLElement && /^H[1-6]$/i.test(block.tagName)) {
		return block;
	}
	const inner = block.querySelector("h1, h2, h3, h4, h5, h6");
	return inner instanceof HTMLElement ? inner : null;
}

function resolvePreviewHeadingByLine(view: MarkdownView, line: number): HTMLElement | null {
	const root = getMarkdownContentRoot(view);
	if (!root) return null;

	const lineStr = String(line);
	const blocks = root.querySelectorAll(`[data-line="${lineStr}"]`);
	for (const block of Array.from(blocks)) {
		const heading = headingFromDataLineBlock(block);
		if (heading) return heading;
	}

	const headingWithAttr = root.querySelector(`h1[data-line="${lineStr}"], h2[data-line="${lineStr}"], h3[data-line="${lineStr}"], h4[data-line="${lineStr}"], h5[data-line="${lineStr}"], h6[data-line="${lineStr}"]`);
	return headingWithAttr instanceof HTMLElement ? headingWithAttr : null;
}

function resolveLivePreviewHeadingByLine(view: MarkdownView, line: number): HTMLElement | null {
	const lineStr = String(line);
	const byAttr = view.containerEl.querySelector(`.cm-line[data-line="${lineStr}"]`);
	if (byAttr instanceof HTMLElement && byAttr.querySelector('[class*="cm-header-"]')) {
		return byAttr;
	}

	const lines = view.containerEl.querySelectorAll(".cm-line");
	for (const node of Array.from(lines)) {
		if (!(node instanceof HTMLElement)) continue;
		if (node.dataset.line === lineStr && node.querySelector('[class*="cm-header-"]')) {
			return node;
		}
	}

	return null;
}

function resolveHeadingByTextFallback(
	view: MarkdownView,
	heading: HeadingCache,
	startIndex: number,
	candidates: HTMLElement[]
): HTMLElement | null {
	for (let i = startIndex; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (!candidate) continue;
		if (headingElementMatches(candidate, heading, view)) {
			return candidate;
		}
	}
	return null;
}

/** Resolve one metadata heading to a DOM node (or null). */
export function resolveHeadingElement(
	view: MarkdownView,
	heading: HeadingCache
): HTMLElement | null {
	const line = heading.position.start.line;
	if (view.getMode() === "preview") {
		const byLine = resolvePreviewHeadingByLine(view, line);
		if (byLine?.isConnected) return byLine;
	} else {
		const byLine = resolveLivePreviewHeadingByLine(view, line);
		if (byLine?.isConnected) return byLine;
	}

	return null;
}

/** Pair metadata headings with DOM nodes in document order (same length as headings). */
export function resolveHeadingElements(
	view: MarkdownView,
	headings: HeadingCache[]
): (HTMLElement | null)[] {
	const candidates =
		view.getMode() === "preview"
			? listPreviewHeadingCandidates(view)
			: listLivePreviewHeadingCandidates(view);

	const resolved: (HTMLElement | null)[] = [];
	let textCursor = 0;

	for (const heading of headings) {
		const byLine = resolveHeadingElement(view, heading);
		if (byLine) {
			resolved.push(byLine);
			while (textCursor < candidates.length && candidates[textCursor] !== byLine) {
				textCursor++;
			}
			if (textCursor < candidates.length) textCursor++;
			continue;
		}

		const fallback = resolveHeadingByTextFallback(view, heading, textCursor, candidates);
		if (fallback) {
			resolved.push(fallback);
			textCursor = candidates.indexOf(fallback) + 1;
		} else {
			resolved.push(null);
		}
	}

	return resolved;
}

export function headingOffsetInScroll(
	headingEl: HTMLElement,
	scrollEl: HTMLElement
): number {
	const headingRect = headingEl.getBoundingClientRect();
	const scrollRect = scrollEl.getBoundingClientRect();
	return scrollEl.scrollTop + (headingRect.top - scrollRect.top);
}

export function getActiveHeadingIndex(
	headingEls: (HTMLElement | null)[],
	scrollEl: HTMLElement,
	offsetTop = 96
): number {
	if (!headingEls.some(el => el?.isConnected)) return 0;

	const spy = scrollEl.scrollTop + offsetTop;
	let active = 0;

	for (let i = 0; i < headingEls.length; i++) {
		const el = headingEls[i];
		if (!el?.isConnected) continue;
		const top = headingOffsetInScroll(el, scrollEl);
		if (top <= spy) {
			active = i;
		} else {
			break;
		}
	}

	return active;
}

export function scrollToHeadingElement(headingEl: HTMLElement, offsetTop: number): void {
	const previous = headingEl.style.scrollMarginTop;
	headingEl.style.scrollMarginTop = `${offsetTop}px`;
	headingEl.scrollIntoView({ behavior: "smooth", block: "start" });
	window.setTimeout(() => {
		headingEl.style.scrollMarginTop = previous;
	}, 800);
}

