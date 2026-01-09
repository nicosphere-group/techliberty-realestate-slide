declare module "dom-to-pptx" {
	type ExportTarget = HTMLElement | string | Array<HTMLElement | string>;

	interface FontConfig {
		name: string;
		url: string;
	}

	interface ListConfig {
		color?: string;
		spacing?: {
			before?: number;
			after?: number;
		};
	}

	interface ExportToPptxOptions {
		fileName?: string;
		fonts?: FontConfig[];
		autoEmbedFonts?: boolean;
		skipDownload?: boolean;
		listConfig?: ListConfig;
	}

	function exportToPptx(
		target: ExportTarget,
		options?: ExportToPptxOptions,
	): Promise<Blob>;

	const domToPptx: {
		exportToPptx: typeof exportToPptx;
	};

	export { exportToPptx };
	export default domToPptx;
}
