"use client";

import { Loader2, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

interface SlidePreviewProps {
	html: string;
	title?: string;
	className?: string;
}

function ScaledFrame({
	html,
	maxWidth = "100%",
}: {
	html: string;
	maxWidth?: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0.2);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const width = entry.contentRect.width;
			// 画面幅が小さいときは親に合わせて縮小、最大でも等倍まで
			const nextScale = width > 0 ? Math.min(1, width / SLIDE_WIDTH) : 0.2;
			setScale(nextScale);
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// コンテナの高さをスケールに合わせて確保
	const containerHeight = Math.max(1, Math.round(SLIDE_HEIGHT * scale));

	return (
		<div
			ref={containerRef}
			className="relative w-full overflow-hidden bg-white"
			style={{ height: containerHeight, maxWidth }}
		>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
					<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
				</div>
			)}
			<iframe
				srcDoc={html}
				title="Slide Content"
				onLoad={() => setLoading(false)}
				tabIndex={-1}
				className="absolute left-0 top-0 border-0 origin-top-left bg-white"
				style={{
					width: SLIDE_WIDTH,
					height: SLIDE_HEIGHT,
					transform: `scale(${scale})`,
				}}
			/>
		</div>
	);
}

export function SlidePreview({
	html,
	title = "Slide",
	className,
}: SlidePreviewProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<div
				className={`group relative w-full overflow-hidden rounded-lg border bg-background shadow-sm transition-all hover:shadow-md ${className}`}
			>
				{/* Main Preview */}
				<ScaledFrame html={html} />

				{/* Overlay & Action Button */}
				<div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5 pointer-events-none" />
				<DialogTrigger asChild>
					<Button
						variant="secondary"
						size="sm"
						className="absolute bottom-3 right-3 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-events-auto"
						onClick={() => setIsOpen(true)}
					>
						<Maximize2 className="mr-2 h-3.5 w-3.5" />
						拡大
					</Button>
				</DialogTrigger>
			</div>

			<DialogContent className="max-w-7xl w-[90vw] p-0 gap-0 overflow-hidden bg-transparent border-0 shadow-none sm:rounded-xl">
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="relative flex flex-col w-full bg-background shadow-2xl rounded-xl overflow-hidden">
					<div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
						<h3 className="font-medium text-sm text-foreground/80">{title}</h3>
						<DialogClose asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-full"
							>
								<X className="h-4 w-4" />
								<span className="sr-only">閉じる</span>
							</Button>
						</DialogClose>
					</div>
					<div className="p-4 sm:p-8 bg-muted/10 overflow-auto flex justify-center min-h-[50vh] max-h-[85vh]">
						<div className="w-full max-w-7xl shadow-lg rounded-md overflow-hidden bg-white">
							<ScaledFrame html={html} />
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
