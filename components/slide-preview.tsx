"use client";

import { Loader2, Maximize2 } from "lucide-react";
import { type Ref, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

interface SlidePreviewProps {
	iframeRef?: Ref<HTMLIFrameElement>;
	html: string;
	title?: string;
	className?: string;
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
	className?: string; // Add className prop
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

	return (
		<div
			ref={containerRef}
			className={`relative w-full overflow-hidden bg-white aspect-video ${className}`}
			style={{ maxWidth }}
		>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
					<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
				</div>
			)}
			<iframe
				ref={iframeRef}
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
	iframeRef,
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
				<ScaledFrame iframeRef={iframeRef} html={html} />

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

			<DialogContent className="sm:max-w-7xl w-[90vw]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<ScaledFrame html={html} />
			</DialogContent>
		</Dialog>
	);
}
