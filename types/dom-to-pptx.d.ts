declare module "dom-to-pptx" {
	type ExportTarget = HTMLElement | string | Array<HTMLElement | string>;

	interface FontConfig {
		name: string;
		url: string;
	}

	interface ExportToPptxOptions {
		fileName?: string;
		fonts?: FontConfig[];
		autoEmbedFonts?: boolean;
	}

	function exportToPptx(
		target: ExportTarget,
		options?: ExportToPptxOptions,
	): Promise<void>;

	const domToPptx: {
		exportToPptx: typeof exportToPptx;
	};

	export { exportToPptx };
	export default domToPptx;
}
