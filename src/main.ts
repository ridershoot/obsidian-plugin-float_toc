import { Plugin } from 'obsidian';
import { registerFloatTocWorkspace } from './toc/register-workspace';
import {
	DEFAULT_SETTINGS,
	FloatTocSettings,
	FloatTocSettingTab,
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<FloatTocSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
