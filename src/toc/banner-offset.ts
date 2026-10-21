import type { HeadingCache, MarkdownView } from 'obsidian';
import { getMarkdownContentRoot, resolveHeadingElement } from './utils';

function getLeafContentEl(leafContentEl: HTMLElement): HTMLElement | null {
	const leaf = leafContentEl.closest('.workspace-leaf-content');
	return leaf instanceof HTMLElement ? leaf : null;
}

/** True while the Pixel Banner still intersects the editor content area. */
export function isBannerVisibleInHost(hostRect: DOMRect, leafContentEl: HTMLElement): boolean {
	const leaf = getLeafContentEl(leafContentEl);
	if (!leaf) return false;

	const banner = leaf.querySelector('.pixel-banner-image, .pixel-banner-video');
	if (!(banner instanceof HTMLElement)) return false;

	const bannerRect = banner.getBoundingClientRect();
	return bannerRect.bottom > hostRect.top + 4 && bannerRect.top < hostRect.bottom;
}

/** Banner bottom relative to host top; 0 when no banner element. */
export function measureBannerBottomInsetPx(
	leafContentEl: HTMLElement,
	hostRect: DOMRect,
): number {
	const leaf = getLeafContentEl(leafContentEl);
	if (!leaf) return 0;

	const banner = leaf.querySelector('.pixel-banner-image, .pixel-banner-video');
	if (!(banner instanceof HTMLElement)) return 0;

	const bannerRect = banner.getBoundingClientRect();
	if (bannerRect.height < 1) return 0;

	return Math.max(0, Math.round(bannerRect.bottom - hostRect.top));
}

/** @deprecated Use measureBannerBottomInsetPx when banner visibility is not required. */
export function measureBannerInsetPx(
	leafContentEl: HTMLElement,
	hostRect: DOMRect,
): number {
	if (!isBannerVisibleInHost(hostRect, leafContentEl)) return 0;
	return measureBannerBottomInsetPx(leafContentEl, hostRect);
}

function elementTopInsetPx(el: HTMLElement, hostRect: DOMRect): number {
	return Math.round(el.getBoundingClientRect().top - hostRect.top);
}

/** Obsidian note title (tab / inline title), aligned with the displayed note name. */
export function measureInlineTitleInsetPx(
	view: MarkdownView,
	hostRect: DOMRect,
): number | null {
	const el = view.containerEl.querySelector('.inline-title');
	if (!(el instanceof HTMLElement)) return null;
	const rect = el.getBoundingClientRect();
	if (rect.height < 1) return null;
	return elementTopInsetPx(el, hostRect);
}

function pickHeadingForTitleAlign(headings: HeadingCache[]): HeadingCache | undefined {
	return headings.find((h) => h.level === 1) ?? headings[0];
}

/** Distance from host top to a visible heading element. */
export function measureTitleTopInsetPx(
	view: MarkdownView,
	hostRect: DOMRect,
	options?: {
		bannerFloorPx?: number;
		firstHeading?: HeadingCache;
	},
): number | null {
	const bannerFloor = Math.max(0, options?.bannerFloorPx ?? 0);
	const titleTolerance = 16;

	if (options?.firstHeading) {
		const el = resolveHeadingElement(view, options.firstHeading);
		if (el?.isConnected && el.getBoundingClientRect().height >= 1) {
			const top = elementTopInsetPx(el, hostRect);
			if (bannerFloor <= 0 || top >= bannerFloor - titleTolerance) {
				return top;
			}
		}
	}

	const roots: HTMLElement[] = [];
	const contentRoot = getMarkdownContentRoot(view);
	if (contentRoot) roots.push(contentRoot);
	roots.push(view.contentEl);

	const selectors = [
		'.markdown-reading-view h1',
		'.markdown-preview-view h1',
		'.markdown-preview-section h1',
		'.markdown-rendered h1',
	];

	let bestBelowBanner: number | null = null;
	let bestAny: number | null = null;

	for (const root of roots) {
		for (const selector of selectors) {
			const nodes = root.querySelectorAll(selector);
			for (const node of Array.from(nodes)) {
				if (!(node instanceof HTMLElement)) continue;
				const rect = node.getBoundingClientRect();
				if (rect.height < 1) continue;
				const top = elementTopInsetPx(node, hostRect);
				if (bestAny === null) bestAny = top;
				if (bannerFloor > 0 && top < bannerFloor - titleTolerance) continue;
				if (bestBelowBanner === null || top < bestBelowBanner) {
					bestBelowBanner = top;
				}
			}
		}
	}

	if (bestBelowBanner !== null) return bestBelowBanner;
	return bestAny;
}

export function computeTopAlignedRailInsetPx(
	view: MarkdownView,
	hostRect: DOMRect,
	headings: HeadingCache[],
	railTopFixed: number,
): number {
	const inlineInset = measureInlineTitleInsetPx(view, hostRect);
	if (inlineInset !== null) {
		return inlineInset;
	}

	const titleHeading = pickHeadingForTitleAlign(headings);
	const bannerFloor = measureBannerBottomInsetPx(view.contentEl, hostRect);
	const hasBannerLayout =
		bannerFloor > 0 || view.contentEl.classList.contains('pixel-banner');

	if (hasBannerLayout || isBannerVisibleInHost(hostRect, view.contentEl)) {
		const titleInset = measureTitleTopInsetPx(view, hostRect, {
			bannerFloorPx: bannerFloor,
			firstHeading: titleHeading,
		});
		if (titleInset !== null) {
			return titleInset;
		}
		if (bannerFloor > 0) {
			return bannerFloor;
		}
	}

	return railTopFixed;
}
