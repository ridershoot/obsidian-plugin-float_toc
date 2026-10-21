import { HeadingCache, MarkdownView } from 'obsidian';
import type FloatTocPlugin from '../main';
import { computeTopAlignedRailInsetPx } from './banner-offset';
import {
	getActiveHeadingIndexInPreview,
	getPreviewScrollLine,
	scrollPreviewToHeading,
} from './preview-scroll';
import {
	getActiveHeadingIndex,
	getHeadingsForFile,
	getFloatTocOverlayHost,
	getMarkdownMountRoot,
	getScrollElement,
	getScrollElements,
	isLivePreview,
	resolveHeadingElement,
	resolveHeadingElements,
	scrollToHeadingElement,
	shouldShowFloatToc,
} from './utils';

export class FloatTocController {
	private overlayEl: HTMLElement | null = null;
	private widgetEl: HTMLElement | null = null;
	private railEl: HTMLElement | null = null;
	private panelEl: HTMLElement | null = null;
	private overlayHost: HTMLElement | null = null;
	private headings: HeadingCache[] = [];
	private headingEls: (HTMLElement | null)[] = [];
	private scrollTargetIndex: number | null = null;
	private scrollTargetTimer = 0;
	private scrollEls: HTMLElement[] = [];
	private previewScrollRaf = 0;
	private lastPreviewScroll = -1;
	private resizeObserver: ResizeObserver | null = null;
	private bannerMutationObserver: MutationObserver | null = null;
	private observedBannerEl: HTMLElement | null = null;
	private layoutWarmupTimers: number[] = [];
	/** Cached top offset for「靠顶部」; scroll must not re-measure title DOM. */
	private stableRailTopPx: number | null = null;
	private stableRailTopFilePath: string | null = null;
	private railTopDirty = true;
	private scrollRaf = 0;
	private readonly onScroll = (): void => {
		if (this.scrollRaf) window.cancelAnimationFrame(this.scrollRaf);
		this.scrollRaf = window.requestAnimationFrame(() => this.updateLayout());
	};

	constructor(
		private readonly view: MarkdownView,
		private readonly plugin: FloatTocPlugin,
	) {}

	attach(): void {
		if (this.overlayEl) return;

		this.overlayHost = getFloatTocOverlayHost(this.view);
		for (const orphan of Array.from(
			this.overlayHost.querySelectorAll(':scope > .float-toc-overlay'),
		)) {
			orphan.remove();
		}
		this.overlayHost.classList.add('float-toc-overlay-host');
		this.overlayEl = this.overlayHost.createDiv({
			cls: 'float-toc-overlay',
		});

		this.widgetEl = this.overlayEl.createDiv({ cls: 'float-toc-widget' });
		const card = this.widgetEl.createDiv({ cls: 'float-toc-card' });
		this.railEl = card.createDiv({ cls: 'float-toc-rail' });
		this.panelEl = card.createDiv({ cls: 'float-toc-panel' });

		this.plugin.registerDomEvent(this.widgetEl, 'mouseleave', () => {
			this.collapseWidget();
		});

		this.bindScroll();
		this.startPreviewScrollLoop();
		this.setupResizeObserver();
		this.setupBannerObserver();
		this.refresh();
	}

	detach(): void {
		window.cancelAnimationFrame(this.scrollRaf);
		window.cancelAnimationFrame(this.previewScrollRaf);
		window.clearTimeout(this.scrollTargetTimer);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.bannerMutationObserver?.disconnect();
		this.bannerMutationObserver = null;
		this.observedBannerEl = null;
		for (const id of this.layoutWarmupTimers) window.clearTimeout(id);
		this.layoutWarmupTimers = [];
		this.unbindScroll();
		this.overlayEl?.remove();
		this.overlayEl = null;
		this.widgetEl = null;
		this.railEl = null;
		this.panelEl = null;
		this.overlayHost?.classList.remove('float-toc-overlay-host');
		this.overlayHost = null;
		this.stableRailTopPx = null;
		this.stableRailTopFilePath = null;
		this.railTopDirty = true;
	}

	refresh(): void {
		if (!this.overlayEl) return;

		if (!this.plugin.settings.enabled || !shouldShowFloatToc(this.view)) {
			this.overlayEl.classList.add('is-hidden');
			return;
		}

		this.overlayEl.classList.remove('is-hidden');

		const filePath = this.view.file?.path ?? null;
		if (filePath !== this.stableRailTopFilePath) {
			this.stableRailTopPx = null;
			this.stableRailTopFilePath = filePath;
			this.railTopDirty = true;
		}

		this.headings = getHeadingsForFile(
			this.plugin.app,
			this.view.file,
			this.plugin.settings.minHeadingLevel,
			this.plugin.settings.maxHeadingLevel,
		);

		if (this.headings.length === 0) {
			this.overlayEl.classList.add('is-hidden');
			return;
		}

		this.headingEls = resolveHeadingElements(this.view, this.headings);
		this.bindScroll();
		this.render();
		this.railTopDirty = true;
		this.updateLayout();
		this.scheduleLayoutWarmup();
	}

	private render(): void {
		if (!this.railEl || !this.panelEl) return;

		this.railEl.empty();
		this.panelEl.empty();

		const minLevel = Math.min(...this.headings.map((h) => h.level));

		this.headings.forEach((heading, index) => {
			const depth = heading.level - minLevel;
			const line = this.railEl!.createDiv({
				cls: 'float-toc-line',
				attr: {
					'data-level': String(heading.level),
					'data-depth': String(depth),
					'data-index': String(index),
				},
			});
			line.createDiv({ cls: 'float-toc-line-bar' });
			this.plugin.registerDomEvent(line, 'click', (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				void this.jumpToHeading(index);
			});

			const item = this.panelEl!.createEl('button', {
				cls: 'float-toc-item',
				text: heading.heading,
				attr: { type: 'button', 'data-index': String(index) },
			});
			item.style.setProperty('--float-toc-depth', String(depth));
			this.plugin.registerDomEvent(item, 'click', (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				void this.jumpToHeading(index);
			});
		});
	}

	private collapseWidget(): void {
		this.widgetEl?.classList.remove('is-expanded');
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	private async jumpToHeading(index: number): Promise<void> {
		const heading = this.headings[index];
		const file = this.view.file;
		if (!heading || !file) return;

		this.collapseWidget();
		this.scrollTargetIndex = index;
		window.clearTimeout(this.scrollTargetTimer);
		this.scrollTargetTimer = window.setTimeout(() => {
			this.scrollTargetIndex = null;
		}, 1200);

		const el =
			resolveHeadingElement(this.view, heading) ?? this.headingEls[index];
		if (el?.isConnected) {
			this.headingEls[index] = el;
		}

		const offset = this.plugin.settings.scrollSpyOffset;

		if (this.view.getMode() === 'preview') {
			scrollPreviewToHeading(this.view, heading, offset, true);
			window.setTimeout(() => this.updateLayout(), 450);
			return;
		}

		if (isLivePreview(this.view)) {
			if (el?.isConnected) {
				scrollToHeadingElement(el, offset);
			} else {
				await this.plugin.app.workspace.openLinkText(
					`#${heading.heading}`,
					file.path,
					false,
				);
			}
			window.setTimeout(() => this.updateLayout(), 450);
			return;
		}

		const line = heading.position.start.line;
		const ch = heading.position.start.col;
		this.view.editor.setCursor({ line, ch });
		this.view.editor.scrollIntoView(
			{ from: { line, ch }, to: { line, ch } },
			true,
		);
		window.requestAnimationFrame(() => this.updateLayout());
	}

	private bindScroll(): void {
		if (this.view.getMode() === 'preview') {
			this.unbindScroll();
			return;
		}

		const next = getScrollElements(this.view);
		if (
			next.length === this.scrollEls.length &&
			next.every((el, i) => el === this.scrollEls[i])
		) {
			return;
		}
		this.unbindScroll();
		this.scrollEls = next;
		for (const el of this.scrollEls) {
			el.addEventListener('scroll', this.onScroll, { passive: true });
		}
	}

	private startPreviewScrollLoop(): void {
		const tick = (): void => {
			this.previewScrollRaf = window.requestAnimationFrame(tick);
			if (
				!this.overlayEl ||
				this.overlayEl.classList.contains('is-hidden') ||
				this.view.getMode() !== 'preview'
			) {
				return;
			}

			const scrollLine = getPreviewScrollLine(this.view);
			const scrollChanged =
				Math.abs(scrollLine - this.lastPreviewScroll) >= 0.05;
			if (!scrollChanged) return;

			this.lastPreviewScroll = scrollLine;
			this.updateLayout();
		};
		tick();
	}

	private unbindScroll(): void {
		for (const el of this.scrollEls) {
			el.removeEventListener('scroll', this.onScroll);
		}
		this.scrollEls = [];
	}

	private setupResizeObserver(): void {
		this.resizeObserver = new ResizeObserver(() => {
			this.railTopDirty = true;
			this.updateLayout();
		});
		this.resizeObserver.observe(this.view.contentEl);
		const leaf = this.view.contentEl.closest('.workspace-leaf-content');
		if (leaf instanceof HTMLElement) {
			this.resizeObserver.observe(leaf);
		}
		const root = getMarkdownMountRoot(this.view);
		if (root !== this.view.contentEl) this.resizeObserver.observe(root);
		const viewContent = this.view.containerEl.querySelector('.view-content');
		if (viewContent instanceof HTMLElement) {
			this.resizeObserver.observe(viewContent);
		}
	}

	private setupBannerObserver(): void {
		const leaf = this.view.contentEl.closest('.workspace-leaf-content');
		if (!(leaf instanceof HTMLElement)) return;

		this.bannerMutationObserver = new MutationObserver(() => {
			this.railTopDirty = true;
			this.ensureBannerObserved();
			this.updateLayout();
		});
		this.bannerMutationObserver.observe(leaf, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'src'],
		});
		this.ensureBannerObserved();
	}

	private ensureBannerObserved(): void {
		const leaf = this.view.contentEl.closest('.workspace-leaf-content');
		if (!(leaf instanceof HTMLElement) || !this.resizeObserver) return;

		const banner = leaf.querySelector(
			'.pixel-banner-image, .pixel-banner-video',
		);
		if (!(banner instanceof HTMLElement)) return;
		if (banner === this.observedBannerEl) return;

		this.resizeObserver.observe(banner);
		this.observedBannerEl = banner;

		if (banner instanceof HTMLImageElement && !banner.complete) {
			this.plugin.registerDomEvent(banner, 'load', () => {
				this.railTopDirty = true;
				this.updateLayout();
			});
		}
	}

	private scheduleLayoutWarmup(): void {
		for (const id of this.layoutWarmupTimers) window.clearTimeout(id);
		this.layoutWarmupTimers = [];

		const run = (): void => {
			this.railTopDirty = true;
			this.ensureBannerObserved();
			this.updateLayout();
		};

		run();
		window.requestAnimationFrame(() => {
			run();
			window.requestAnimationFrame(run);
		});

		for (const delayMs of [40, 100, 250, 500, 1000]) {
			this.layoutWarmupTimers.push(window.setTimeout(run, delayMs));
		}
	}

	private updateLayout(): void {
		if (
			!this.widgetEl ||
			!this.overlayEl ||
			this.overlayEl.classList.contains('is-hidden')
		) {
			return;
		}

		this.bindScroll();

		let activeIndex: number;
		if (this.view.getMode() === 'preview') {
			activeIndex = getActiveHeadingIndexInPreview(
				this.headings,
				getPreviewScrollLine(this.view),
				this.plugin.settings.scrollSpyOffset,
				this.view,
			);
		} else {
			const scrollEl = getScrollElement(this.view);
			if (!scrollEl) return;

			const missing = this.headingEls.some((el) => el === null);
			if (
				this.headingEls.length !== this.headings.length ||
				this.headingEls.some((el) => el && !el.isConnected) ||
				missing
			) {
				this.headingEls = resolveHeadingElements(this.view, this.headings);
			}

			activeIndex = getActiveHeadingIndex(
				this.headingEls,
				scrollEl,
				this.plugin.settings.scrollSpyOffset,
			);
		}
		if (this.scrollTargetIndex !== null) {
			activeIndex = this.scrollTargetIndex;
		}

		this.railEl?.querySelectorAll('.float-toc-line').forEach((line, index) => {
			line.classList.toggle('is-active', index === activeIndex);
		});
		this.panelEl?.querySelectorAll('.float-toc-item').forEach((item, index) => {
			item.classList.toggle('is-active', index === activeIndex);
		});

		const insetEnd = Math.max(0, this.plugin.settings.railInsetEnd);

		const hostEl = this.overlayEl;
		const hostHeight = hostEl.clientHeight;
		const widgetHeight = this.widgetEl.offsetHeight;
		const edgePadding = 12;

		if (this.plugin.settings.railVerticalAlign === 'top') {
			const railTop = this.getDisplayRailTopPx(hostEl, edgePadding);

			this.widgetEl.setCssProps({
				'--float-toc-inset-end': `${insetEnd}px`,
				'--float-toc-rail-top': `${railTop}px`,
			});
		} else {
			const centered =
				hostHeight > 0
					? (hostHeight - widgetHeight) / 2
					: hostHeight / 2;
			const maxTop = Math.max(
				edgePadding,
				hostHeight - widgetHeight - edgePadding,
			);
			const railTop = Math.min(
				Math.max(edgePadding, centered),
				maxTop,
			);

			this.widgetEl.setCssProps({
				'--float-toc-inset-end': `${insetEnd}px`,
				'--float-toc-rail-top': `${railTop}px`,
			});
		}

		if (!this.widgetEl.matches(':hover')) return;

		const panel = this.panelEl;
		const activeItem = panel?.querySelector(
			`.float-toc-item[data-index="${activeIndex}"]`,
		);
		if (panel && activeItem instanceof HTMLElement) {
			const panelRect = panel.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();
			const delta = itemRect.top - panelRect.top - panel.clientHeight / 2;
			panel.scrollTop += delta;
		}
	}

	private resolveStableRailTopPx(
		hostEl: HTMLElement,
		edgePadding: number,
	): number {
		if (this.railTopDirty || this.stableRailTopPx === null) {
			const viewContent = this.view.containerEl.querySelector('.view-content');
			const hostRect =
				viewContent instanceof HTMLElement
					? viewContent.getBoundingClientRect()
					: hostEl.getBoundingClientRect();

			const measured = Math.max(
				edgePadding,
				computeTopAlignedRailInsetPx(
					this.view,
					hostRect,
					this.headings,
					this.plugin.settings.bannerOffsetExtra,
					this.plugin.settings.railTopFixed,
				),
			);

			if (this.stableRailTopPx === null) {
				this.stableRailTopPx = measured;
			} else {
				// Banner / title layout may settle after first paint — only move down.
				this.stableRailTopPx = Math.max(this.stableRailTopPx, measured);
			}
			this.railTopDirty = false;
		}

		return this.stableRailTopPx ?? edgePadding;
	}

	private getDisplayRailTopPx(
		hostEl: HTMLElement,
		edgePadding: number,
	): number {
		const anchored = this.resolveStableRailTopPx(hostEl, edgePadding);

		if (!this.isScrolledPastDocumentStart()) {
			return anchored;
		}

		return Math.max(
			edgePadding,
			this.plugin.settings.railTopFixed +
				this.plugin.settings.bannerOffsetExtra,
		);
	}

	private isScrolledPastDocumentStart(): boolean {
		if (this.view.getMode() === 'preview') {
			return getPreviewScrollLine(this.view) > 2;
		}

		const scrollEl = getScrollElement(this.view);
		if (!scrollEl) return false;
		return scrollEl.scrollTop > 48;
	}
}
