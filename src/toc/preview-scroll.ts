import { Editor, HeadingCache, MarkdownView } from 'obsidian';

const DEFAULT_LINE_HEIGHT_PX = 28;

/** CodeMirror 6 view behind Obsidian's `Editor` (`editor.cm`). */
type CmEditorView = {
	coordsAtPos(pos: number, side?: -1 | 1): { top: number; bottom?: number } | null;
	posAtCoords(coords: { x: number; y: number }, precise?: false): number;
	lineBlockAt(pos: number): { top: number };
};

function getCmEditorView(editor: Editor): CmEditorView | null {
	const cm = (editor as Editor & { cm?: CmEditorView }).cm;
	if (!cm || typeof cm.coordsAtPos !== 'function' || typeof cm.posAtCoords !== 'function') {
		return null;
	}
	return cm;
}

function spyCoordsInScroller(
	scroller: HTMLElement,
	offsetPx: number,
): { x: number; y: number } {
	const rect = scroller.getBoundingClientRect();
	return {
		x: rect.left + Math.min(48, rect.width * 0.15),
		y: rect.top + offsetPx,
	};
}

function lineAtScrollerOffset(view: MarkdownView, offsetPx: number): number | null {
	const scroller = view.containerEl.querySelector('.cm-scroller');
	const cm = getCmEditorView(view.editor);
	if (!(scroller instanceof HTMLElement) || !cm) return null;

	const { x, y } = spyCoordsInScroller(scroller, offsetPx);
	const docOffset = cm.posAtCoords({ x, y }, false);
	if (!Number.isFinite(docOffset)) return null;

	return view.editor.offsetToPos(docOffset).line;
}

/** Reading view scroll position (line-based, may be fractional). */
export function getPreviewScrollLine(view: MarkdownView): number {
	return view.previewMode.getScroll();
}

export function lineOffsetFromPixels(view: MarkdownView, pixels: number): number {
	const root = view.containerEl.querySelector('.markdown-reading-view');
	if (root instanceof HTMLElement) {
		const sample = root.querySelector('p, li, h1, h2, h3, h4, h5, h6');
		if (sample instanceof HTMLElement) {
			const lineHeight = Number.parseFloat(getComputedStyle(sample).lineHeight);
			if (Number.isFinite(lineHeight) && lineHeight > 0) {
				return pixels / lineHeight;
			}
		}
	}
	return pixels / DEFAULT_LINE_HEIGHT_PX;
}

export function getActiveHeadingIndexByLine(
	headings: HeadingCache[],
	spyLine: number,
): number {
	if (!headings.length) return 0;
	let active = 0;
	for (let i = 0; i < headings.length; i++) {
		const line = headings[i]?.position.start.line;
		if (line === undefined) continue;
		if (line <= spyLine) active = i;
		else break;
	}
	return active;
}

export function getActiveHeadingIndexInPreview(
	headings: HeadingCache[],
	scrollLine: number,
	offsetPx: number,
	view: MarkdownView,
): number {
	const spyLine = scrollLine + lineOffsetFromPixels(view, offsetPx);
	return getActiveHeadingIndexByLine(headings, spyLine);
}

/** Line at the editor spy offset (0-based). Uses CM coords; `.cm-line` has no `data-line` in plain source. */
export function getSourceScrollSpyLine(
	view: MarkdownView,
	offsetPx: number,
): number {
	const fromCm = lineAtScrollerOffset(view, offsetPx);
	if (fromCm !== null) return fromCm;

	const scroller = view.containerEl.querySelector('.cm-scroller');
	if (scroller instanceof HTMLElement) {
		const spyY = scroller.getBoundingClientRect().top + offsetPx;
		for (const node of Array.from(scroller.querySelectorAll('.cm-line'))) {
			if (!(node instanceof HTMLElement)) continue;
			if (node.getBoundingClientRect().bottom <= spyY) continue;
			const line = Number.parseInt(node.dataset.line ?? '', 10);
			if (Number.isFinite(line)) return line;
		}
	}

	return view.editor.getCursor().line;
}

const SCROLL_ANIMATION_MS = 380;

function easeOutQuad(t: number): number {
	return t * (2 - t);
}

function animateScrollTop(
	scroller: HTMLElement,
	targetScrollTop: number,
	durationMs = SCROLL_ANIMATION_MS,
	onComplete?: () => void,
): void {
	const from = scroller.scrollTop;
	const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
	const target = Math.min(Math.max(0, targetScrollTop), maxTop);
	const start = performance.now();

	const step = (now: number): void => {
		const elapsed = now - start;
		const t = Math.min(1, elapsed / durationMs);
		scroller.scrollTop = from + (target - from) * easeOutQuad(t);
		if (t < 1) {
			window.requestAnimationFrame(step);
		} else {
			onComplete?.();
		}
	};

	window.requestAnimationFrame(step);
}

export function animatePreviewScrollToLine(
	view: MarkdownView,
	targetLine: number,
	durationMs = SCROLL_ANIMATION_MS,
): void {
	const from = view.previewMode.getScroll();
	const start = performance.now();

	const step = (now: number): void => {
		const elapsed = now - start;
		const t = Math.min(1, elapsed / durationMs);
		view.previewMode.applyScroll(from + (targetLine - from) * easeOutQuad(t));
		if (t < 1) {
			window.requestAnimationFrame(step);
		}
	};

	window.requestAnimationFrame(step);
}

export function scrollPreviewToHeading(
	view: MarkdownView,
	heading: HeadingCache,
	offsetPx: number,
	animate = true,
): void {
	const lineOffset = lineOffsetFromPixels(view, offsetPx);
	const targetLine = Math.max(0, heading.position.start.line - lineOffset);
	if (animate) {
		animatePreviewScrollToLine(view, targetLine);
	} else {
		view.previewMode.applyScroll(targetLine);
	}
}

/** Scroll offset from document top (works when the line is outside the viewport). */
function sourceTargetScrollTopPx(
	cm: CmEditorView,
	scroller: HTMLElement,
	docOffset: number,
	offsetPx: number,
): number | null {
	const block = cm.lineBlockAt(docOffset);
	if (Number.isFinite(block.top)) {
		return block.top - offsetPx;
	}

	const coords = cm.coordsAtPos(docOffset);
	if (!coords) return null;

	const scrollerRect = scroller.getBoundingClientRect();
	return scroller.scrollTop + (coords.top - scrollerRect.top) - offsetPx;
}

function scrollSourceToHeadingInstant(
	view: MarkdownView,
	heading: HeadingCache,
): void {
	const line = heading.position.start.line;
	const ch = heading.position.start.col;
	view.editor.setCursor({ line, ch });
	view.editor.scrollIntoView(
		{ from: { line, ch }, to: { line, ch } },
		true,
	);
}

/** Plain source mode: smooth `.cm-scroller` scroll (same easing/duration as reading view). */
export function scrollSourceToHeading(
	view: MarkdownView,
	heading: HeadingCache,
	offsetPx: number,
	animate = true,
): void {
	const line = heading.position.start.line;
	const ch = heading.position.start.col;
	const scroller = view.containerEl.querySelector('.cm-scroller');
	const cm = getCmEditorView(view.editor);

	if (!(scroller instanceof HTMLElement) || !cm) {
		scrollSourceToHeadingInstant(view, heading);
		return;
	}

	let docOffset: number;
	try {
		docOffset = view.editor.posToOffset({ line, ch: 0 });
	} catch {
		scrollSourceToHeadingInstant(view, heading);
		return;
	}

	const targetScrollTop = sourceTargetScrollTopPx(
		cm,
		scroller,
		docOffset,
		offsetPx,
	);
	if (targetScrollTop === null) {
		scrollSourceToHeadingInstant(view, heading);
		return;
	}

	if (!animate) {
		const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
		scroller.scrollTop = Math.min(Math.max(0, targetScrollTop), maxTop);
		view.editor.setCursor({ line, ch });
		return;
	}

	animateScrollTop(scroller, targetScrollTop, SCROLL_ANIMATION_MS, () => {
		view.editor.setCursor({ line, ch });
	});
}
