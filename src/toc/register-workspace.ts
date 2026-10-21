import { MarkdownView } from 'obsidian';
import type FloatTocPlugin from '../main';
import { FloatTocController } from './float-toc-controller';

export function registerFloatTocWorkspace(plugin: FloatTocPlugin): void {
	const controllers = new Map<MarkdownView, FloatTocController>();

	const pruneDetached = (): void => {
		for (const [view, controller] of controllers) {
			if (!view.containerEl.isConnected) {
				controller.detach();
				controllers.delete(view);
			}
		}
	};

	const attachToView = (view: MarkdownView): void => {
		let controller = controllers.get(view);
		if (!controller) {
			controller = new FloatTocController(view, plugin);
			controllers.set(view, controller);
		}
		controller.attach();
	};

	const refreshAll = (): void => {
		pruneDetached();
		for (const controller of controllers.values()) {
			controller.refresh();
		}
	};

	const syncLeaves = (): void => {
		pruneDetached();

		const liveViews = new Set<MarkdownView>();
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				liveViews.add(leaf.view);
				attachToView(leaf.view);
			}
		});

		for (const [view, controller] of controllers) {
			if (!liveViews.has(view)) {
				controller.detach();
				controllers.delete(view);
			}
		}
	};

	plugin.registerEvent(
		plugin.app.workspace.on('layout-change', () => {
			syncLeaves();
			refreshAll();
		}),
	);

	plugin.registerEvent(
		plugin.app.workspace.on('active-leaf-change', () => {
			refreshAll();
		}),
	);

	plugin.registerEvent(
		plugin.app.metadataCache.on('changed', () => {
			refreshAll();
		}),
	);

	plugin.registerEvent(
		plugin.app.workspace.on('css-change', () => {
			refreshAll();
		}),
	);

	plugin.app.workspace.onLayoutReady(() => {
		syncLeaves();
	});

	plugin.onRefreshFloatToc(() => {
		refreshAll();
	});

	plugin.registerEvent(
		plugin.app.workspace.on('editor-change', () => {
			refreshAll();
		}),
	);
}
