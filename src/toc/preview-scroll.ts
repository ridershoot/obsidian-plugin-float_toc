import { HeadingCache, MarkdownView } from 'obsidian';

const DEFAULT_LINE_HEIGHT_PX = 28;

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

export function getActiveHeadingIndexInPreview(
	headings: HeadingCache[],
	scrollLine: number,
	offsetPx: number,
	view: MarkdownView,
): number {
	if (!headings.length) return 0;
	const spyLine = scrollLine + lineOffsetFromPixels(view, offsetPx);
	let active = 0;
	for (let i = 0; i < headings.length; i++) {
		const line = headings[i]?.position.start.line;
		if (line === undefined) continue;
		if (line <= spyLine) active = i;
		else break;
	}
	return active;
}

export function animatePreviewScrollToLine(
	view: MarkdownView,
	targetLine: number,
	durationMs = 380,
): void {
	const from = view.previewMode.getScroll();
	const start = performance.now();

	const step = (now: number): void => {
		const elapsed = now - start;
		const t = Math.min(1, elapsed / durationMs);
		const eased = t * (2 - t);
		view.previewMode.applyScroll(from + (targetLine - from) * eased);
		if (t < 1) {
			requestAnimationFrame(step);
		}
	};

	requestAnimationFrame(step);
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
