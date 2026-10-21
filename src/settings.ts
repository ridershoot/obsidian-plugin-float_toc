import { App, PluginSettingTab, Setting } from 'obsidian';
import FloatTocPlugin from './main';

export type FloatTocRailVerticalAlign = 'center' | 'top';

export interface FloatTocSettings {
	enabled: boolean;
	/** Distance from the right edge of the editor pane to the rail. */
	railInsetEnd: number;
	/** Vertical placement of the rail within the visible editor pane. */
	railVerticalAlign: FloatTocRailVerticalAlign;
	maxHeadingLevel: number;
}

/** Deepest heading level always included in the TOC (H1). */
export const FIXED_MIN_HEADING_LEVEL = 1;

export const MAX_HEADING_LEVEL_LIMIT = 3;

/** Scroll-spy line offset from the top of the scroll viewport (px). */
export const FIXED_SCROLL_SPY_OFFSET = 96;

/** Top inset for the rail when vertically aligned to「顶部」(px). */
export const FIXED_RAIL_TOP = 72;

export const DEFAULT_SETTINGS: FloatTocSettings = {
	enabled: true,
	railInsetEnd: 16,
	railVerticalAlign: 'top',
	maxHeadingLevel: 3,
};

export class FloatTocSettingTab extends PluginSettingTab {
	plugin: FloatTocPlugin;

	constructor(app: App, plugin: FloatTocPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('启用浮动目录')
			.setDesc('在阅读视图与实时预览中显示右侧浮动目录。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('目录垂直位置')
			.setDesc('默认为靠顶部；有 Banner 时与笔记标题对齐。可选垂直居中。')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('center', '垂直居中')
					.addOption('top', '靠顶部')
					.setValue(this.plugin.settings.railVerticalAlign)
					.onChange(async (value) => {
						this.plugin.settings.railVerticalAlign =
							value === 'top' ? 'top' : 'center';
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('右侧留白')
			.setDesc('浮动目录与编辑区右边缘的距离（像素）。')
			.addSlider((slider) =>
				slider
					.setLimits(0, 80, 4)
					.setValue(this.plugin.settings.railInsetEnd)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.railInsetEnd = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('最高标题级别')
			.setDesc(
				`目录中包含的最浅标题级别（最大 ${MAX_HEADING_LEVEL_LIMIT}，对应 H${MAX_HEADING_LEVEL_LIMIT}）。`,
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, MAX_HEADING_LEVEL_LIMIT, 1)
					.setValue(this.plugin.settings.maxHeadingLevel)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxHeadingLevel = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);
	}
}
