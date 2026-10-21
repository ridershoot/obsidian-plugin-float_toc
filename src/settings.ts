import { App, PluginSettingTab, Setting } from 'obsidian';
import FloatTocPlugin from './main';

export type FloatTocRailVerticalAlign = 'center' | 'top';

export interface FloatTocSettings {
	enabled: boolean;
	/** Manual tweak when Pixel Banner layout differs from measured inset. */
	bannerOffsetExtra: number;
	/** Pixels from top of scroll viewport used for scroll-spy active heading. */
	scrollSpyOffset: number;
	/** Fixed distance from top when vertical align is「顶部」. */
	railTopFixed: number;
	/** Distance from the right edge of the editor pane to the rail. */
	railInsetEnd: number;
	/** Vertical placement of the rail within the visible editor pane. */
	railVerticalAlign: FloatTocRailVerticalAlign;
	minHeadingLevel: number;
	maxHeadingLevel: number;
}

export const DEFAULT_SETTINGS: FloatTocSettings = {
	enabled: true,
	bannerOffsetExtra: 0,
	scrollSpyOffset: 96,
	railTopFixed: 72,
	railInsetEnd: 12,
	railVerticalAlign: 'top',
	minHeadingLevel: 1,
	maxHeadingLevel: 6,
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
			.setName('Banner 额外下移')
			.setDesc(
				'在 Pixel Banner 自动检测之外，额外增加的顶部留白（像素）。',
			)
			.addSlider((slider) =>
				slider
					.setLimits(-80, 200, 4)
					.setValue(this.plugin.settings.bannerOffsetExtra)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.bannerOffsetExtra = value;
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
			.setName('靠顶时的距顶高度')
			.setDesc('垂直位置为「靠顶部」时，目录距顶部的距离（像素）；有 Banner 时会自动下移。')
			.addSlider((slider) =>
				slider
					.setLimits(24, 240, 4)
					.setValue(this.plugin.settings.railTopFixed)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.railTopFixed = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('当前标题判定线')
			.setDesc('距滚动区域顶部的偏移（像素），用于高亮当前章节。')
			.addSlider((slider) =>
				slider
					.setLimits(40, 200, 4)
					.setValue(this.plugin.settings.scrollSpyOffset)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.scrollSpyOffset = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('最低标题级别')
			.setDesc('目录中包含的最深标题级别（1 = H1）。')
			.addSlider((slider) =>
				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.minHeadingLevel)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.minHeadingLevel = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFloatToc();
					}),
			);

		new Setting(containerEl)
			.setName('最高标题级别')
			.setDesc('目录中包含的最浅标题级别（6 = H6）。')
			.addSlider((slider) =>
				slider
					.setLimits(1, 6, 1)
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
