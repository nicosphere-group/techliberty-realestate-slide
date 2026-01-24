"use client";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Italic,
	Loader2,
	type LucideIcon,
	Maximize2,
	Pencil,
	Redo2,
	RotateCcw,
	Save,
	Underline,
	Undo2,
	X,
} from "lucide-react";
import {
	type Ref,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

interface SlidePreviewProps {
	iframeRef?: Ref<HTMLIFrameElement>;
	html: string;
	originalHtml?: string;
	title?: string;
	className?: string;
	enableEditor?: boolean;
	onHtmlChange?: (nextHtml: string) => void;
	onHtmlReset?: () => void;
}

export function ScaledFrame({
	iframeRef,
	html,
	maxWidth = "100%",
	className,
}: {
	iframeRef?: Ref<HTMLIFrameElement>;
	html: string;
	maxWidth?: string;
	className?: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0.2);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void html;
		setLoading(true);
	}, [html]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const width = entry.contentRect.width;
			// 画面幅が小さいときは親に合わせて縮小、最大でも等倍まで
			const nextScale = width > 0 ? Math.min(1, width / SLIDE_WIDTH) : 0.2;
			setScale(nextScale);
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className={`relative w-full overflow-hidden bg-background aspect-video ${className}`}
			style={{ maxWidth }}
		>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			)}
			<div
				className="origin-top-left absolute top-0 left-0"
				style={{
					width: SLIDE_WIDTH,
					height: SLIDE_HEIGHT,
					transform: `scale(${scale})`,
				}}
			>
				<iframe
					ref={iframeRef}
					srcDoc={html}
					title="Slide Content"
					onLoad={() => setLoading(false)}
					tabIndex={-1}
					className="w-full h-full border-0 bg-white pointer-events-none select-none"
				/>
			</div>
		</div>
	);
}

function EditableFrame({
	html,
	onHtmlChange,
	iframeRef,
}: {
	html: string;
	onHtmlChange: (nextHtml: string) => void;
	iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0.5);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void html;
		setLoading(true);
	}, [html]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const { width, height } = entry.contentRect;
			const padding = 40;
			const availableWidth = width - padding * 2;
			const availableHeight = height - padding * 2;

			if (availableWidth <= 0 || availableHeight <= 0) return;

			const widthScale = availableWidth / SLIDE_WIDTH;
			const heightScale = availableHeight / SLIDE_HEIGHT;

			const nextScale = Math.min(1, widthScale, heightScale);
			setScale(nextScale);
		});

		observer.observe(el);

		return () => observer.disconnect();
	}, []);

	const handleInput = useCallback(() => {
		const doc = iframeRef.current?.contentDocument;
		if (!doc) return;

		// designMode="on" の場合、doc.body.innerHTML などを取得する
		// ここでは documentElement.outerHTML を取得して完全なHTMLを保存
		const htmlElement = doc.documentElement?.outerHTML ?? "";
		const nextHtml = `<!DOCTYPE html>\n${htmlElement}`;
		onHtmlChange(nextHtml);
	}, [iframeRef, onHtmlChange]);

	const attachEditor = useCallback(() => {
		const doc = iframeRef.current?.contentDocument;
		if (!doc) return undefined;

		doc.designMode = "on";
		if (doc.body) {
			doc.body.contentEditable = "true";
			// 編集時のフォーカスアウトラインを消す（スライドのデザインを邪魔しないため）
			const style = doc.createElement("style");
			style.textContent = `
				*:focus { outline: none !important; }
				body { cursor: text; }
			`;
			doc.head.appendChild(style);
		}

		const handle = () => handleInput();
		doc.addEventListener("input", handle);
		// 変更検知を強化（designModeの変更はinputイベントだけで拾えない場合があるため）
		doc.addEventListener("keyup", handle);

		return () => {
			doc.removeEventListener("input", handle);
			doc.removeEventListener("keyup", handle);
		};
	}, [iframeRef, handleInput]);

	const handleLoad = useCallback(() => {
		setLoading(false);
		attachEditor();
	}, [attachEditor]);

	return (
		<div
			ref={containerRef}
			className="relative w-full h-full flex items-center justify-center bg-muted/30 overflow-hidden"
		>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}

			<div
				style={{
					width: SLIDE_WIDTH * scale,
					height: SLIDE_HEIGHT * scale,
					boxShadow: "0 0 40px rgba(0,0,0,0.1)",
				}}
				className="relative bg-white shadow-2xl"
			>
				<iframe
					ref={iframeRef}
					srcDoc={html}
					title="Slide Editor"
					onLoad={handleLoad}
					className="absolute left-0 top-0 border-0 bg-white origin-top-left"
					style={{
						width: SLIDE_WIDTH,
						height: SLIDE_HEIGHT,
						transform: `scale(${scale})`,
					}}
				/>
			</div>
		</div>
	);
}

function EditorToolbar({
	onCommand,
}: {
	onCommand: (command: string, value?: string) => void;
}) {
	const run = (command: string, value?: string) => {
		onCommand(command, value);
	};

	const ToolButton = ({
		icon: Icon,
		cmd,
		val,
		label,
	}: {
		icon: LucideIcon;
		cmd: string;
		val?: string;
		label: string;
	}) => (
		<Button
			variant="ghost"
			size="sm"
			className="h-8 w-8 p-0"
			onClick={() => run(cmd, val)}
			title={label}
		>
			<Icon className="h-4 w-4" />
			<span className="sr-only">{label}</span>
		</Button>
	);

	return (
		<div className="flex flex-wrap items-center gap-1 p-1 bg-background border rounded-md shadow-sm">
			<div className="flex items-center gap-0.5">
				<ToolButton icon={Undo2} cmd="undo" label="元に戻す" />
				<ToolButton icon={Redo2} cmd="redo" label="やり直す" />
			</div>
			<div className="mx-1 h-4 w-px bg-border" />
			<div className="flex items-center gap-0.5">
				<ToolButton icon={Bold} cmd="bold" label="太字" />
				<ToolButton icon={Italic} cmd="italic" label="斜体" />
				<ToolButton icon={Underline} cmd="underline" label="下線" />
			</div>
			<div className="mx-1 h-4 w-px bg-border" />
			<div className="flex items-center gap-0.5">
				<ToolButton icon={AlignLeft} cmd="justifyLeft" label="左揃え" />
				<ToolButton icon={AlignCenter} cmd="justifyCenter" label="中央揃え" />
				<ToolButton icon={AlignRight} cmd="justifyRight" label="右揃え" />
			</div>
		</div>
	);
}

export function SlidePreview({
	iframeRef,
	html,
	originalHtml,
	title = "Slide",
	className,
	enableEditor = true,
	onHtmlChange,
	onHtmlReset,
}: SlidePreviewProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [draftHtml, setDraftHtml] = useState(html);
	const draftHtmlRef = useRef(html);
	const editorIframeRef = useRef<HTMLIFrameElement>(null);

	// Original HTMLが変更されたらdraftも更新する
	useEffect(() => {
		if (!isEditOpen) {
			setDraftHtml(html);
			draftHtmlRef.current = html;
		}
	}, [html, isEditOpen]);

	const handleCommand = useCallback((command: string, value?: string) => {
		const doc = editorIframeRef.current?.contentDocument;
		if (!doc) return;
		doc.execCommand(command, false, value);
		// コマンド実行後にiframeの内容を同期
		const nextHtml = `<!DOCTYPE html>\n${doc.documentElement?.outerHTML ?? ""}`;
		draftHtmlRef.current = nextHtml;
	}, []);

	const handleDraftChange = useCallback((nextHtml: string) => {
		draftHtmlRef.current = nextHtml;
	}, []);

	const isEdited = originalHtml && originalHtml !== html;

	return (
		<>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<div
					className={`group relative w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg ${className}`}
				>
					{/* Main Preview */}
					<ScaledFrame iframeRef={iframeRef} html={html} />

					{/* Overlay Actions */}
					{/* ホバー時のみ表示されるオーバーレイ。タッチデバイスも考慮してfocus-within等も入れたいが、基本はPC操作想定 */}
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
						<DialogTrigger asChild>
							<Button
								variant="secondary"
								size="sm"
								className="translate-y-4 group-hover:translate-y-0 transition-transform duration-200 font-medium"
								onClick={() => setIsOpen(true)}
							>
								<Maximize2 className="mr-2 h-4 w-4" />
								拡大表示
							</Button>
						</DialogTrigger>

						{enableEditor && onHtmlChange && (
							<Button
								variant="default" // Primary color for main action
								size="sm"
								className="translate-y-4 group-hover:translate-y-0 transition-transform duration-200 delay-75 font-medium"
								onClick={() => setIsEditOpen(true)}
							>
								<Pencil className="mr-2 h-4 w-4" />
								編集する
							</Button>
						)}
					</div>
				</div>

				{/* プレビュー拡大モーダル */}
				<DialogContent className="w-full max-w-[90vw] sm:max-w-5xl h-auto p-0 border-none bg-transparent shadow-none overflow-hidden outline-none">
					<DialogTitle className="sr-only">拡大プレビュー</DialogTitle>
					<div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white shadow-2xl">
						<div className="absolute top-4 right-4 z-50">
							<Button
								variant="secondary"
								size="icon"
								className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
								onClick={() => setIsOpen(false)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<ScaledFrame html={html} className="h-full" />
					</div>
				</DialogContent>
			</Dialog>

			{/* 編集モーダル */}
			<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
				<DialogContent className="max-w-[100vw] w-full h-screen sm:max-w-[95vw] sm:h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-background rounded-none sm:rounded-lg">
					{/* Header */}
					<div className="shrink-0 flex items-center justify-between px-6 py-3 border-b bg-background z-10">
						<div className="flex items-center gap-4">
							<DialogTitle className="text-lg font-semibold flex items-center gap-2">
								<Pencil className="h-4 w-4 text-primary" />
								編集: {title}
							</DialogTitle>
							<div className="h-4 w-px bg-border" />
							<EditorToolbar onCommand={handleCommand} />
						</div>

						<div className="flex items-center gap-2">
							{onHtmlReset && isEdited && (
								<>
									<Button
										variant="outline"
										size="sm"
										className="text-muted-foreground hover:text-foreground"
										onClick={() => {
											onHtmlReset();
											const resetHtml = originalHtml ?? html;
											setDraftHtml(resetHtml);
											draftHtmlRef.current = resetHtml;
										}}
									>
										<RotateCcw className="mr-2 h-3.5 w-3.5" />
										リセット
									</Button>
									<div className="h-6 w-px bg-border mx-2" />
								</>
							)}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditOpen(false)}
							>
								キャンセル
							</Button>
							<Button
								size="sm"
								onClick={() => {
									onHtmlChange?.(draftHtmlRef.current);
									setIsEditOpen(false);
								}}
							>
								<Save className="mr-2 h-4 w-4" />
								保存して反映
							</Button>
						</div>
					</div>

					{/* Editor Area */}
					<div className="flex-1 min-h-0 relative bg-muted/30">
						<EditableFrame
							html={draftHtml}
							onHtmlChange={handleDraftChange}
							iframeRef={editorIframeRef}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
