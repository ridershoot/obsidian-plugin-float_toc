import { Plugin } from 'obsidian';
import { registerFloatTocWorkspace } from './toc/register-workspace';
import {
	DEFAULT_SETTINGS,
	FloatTocSettings,
	FloatTocSettingTab,
	MAX_HEADING_LEVEL_LIMIT,
} from './settings';

export default class FloatTocPlugin extends Plugin {
	settings!: FloatTocSettings;
	private refreshHandlers: Array<() => void> = [];

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FloatTocSettingTab(this.app, this));
		registerFloatTocWorkspace(this);
	}

	onunload() {}

	onRefreshFloatToc(handler: () => void): void {
		this.refreshHandlers.push(handler);
	}

	refreshFloatToc(): void {
		for (const handler of this.refreshHandlers) {
			handler();
		}
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<FloatTocSettings> & {
			minHeadingLevel?: number;
		};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
		this.settings.maxHeadingLevel = Math.min(
			MAX_HEADING_LEVEL_LIMIT,
			Math.max(1, this.settings.maxHeadingLevel),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
