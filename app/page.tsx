"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import { exportToPptx } from "dom-to-pptx";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Event, SlideEvent } from "@/lib/slide-generator";
import { run } from "./actions";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

function SlidePreview({ html }: { html: string }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [scale, setScale] = useState<number>(0.25);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const width = entry.contentRect.width;
			const nextScale = width > 0 ? Math.min(1, width / SLIDE_WIDTH) : 0.25;
			setScale(nextScale);
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const previewHeight = Math.max(1, Math.round(SLIDE_HEIGHT * scale));

	return (
		<div ref={containerRef} className="w-full">
			<div
				className="relative overflow-hidden rounded-md border bg-background"
				style={{ height: previewHeight }}
			>
				<iframe
					title="Slide Preview"
					srcDoc={html}
					className="absolute left-0 top-0 border-0 bg-white"
					style={{
						width: SLIDE_WIDTH,
						height: SLIDE_HEIGHT,
						transform: `scale(${scale})`,
						transformOrigin: "top left",
					}}
				/>
			</div>
		</div>
	);
}

type SlideState = SlideEvent;

export default function Page() {
	const [isPending, startTransition] = useTransition();
	const [events, setEvents] = useState<Event[]>([]);
	const [slidesByPage, setSlidesByPage] = useState<Record<number, SlideState>>(
		{},
	);
	const [error, setError] = useState<string | null>(null);
	const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	const orderedSlides = useMemo(() => {
		return Object.values(slidesByPage).sort((a, b) => a.index - b.index);
	}, [slidesByPage]);

	async function onSubmit(formData: FormData) {
		setEvents([]);
		setSlidesByPage({});
		setError(null);

		const stream = await run(formData);
		for await (const event of readStreamableValue(stream)) {
			if (!event) continue;

			setEvents((prev) => [...prev, event]);

			switch (event.type) {
				case "slide:start":
				case "slide:researching":
				case "slide:generating":
				case "slide:end":
					setSlidesByPage((prev) => ({
						...prev,
						[event.index]: event,
					}));
					break;

				case "error":
					setError(event.message);
					break;

				default:
					break;
			}
		}
	}

	return (
		<main className="mx-auto max-w-5xl p-6 space-y-6">
			<section className="space-y-3">
				<h1 className="text-2xl font-semibold">スライド生成</h1>
				<p className="text-sm text-muted-foreground">
					テキストまたは物件フライヤー画像を入力して、スライド生成を開始します。
				</p>
				<form
					action={(fd) => startTransition(() => onSubmit(fd))}
					className="space-y-4"
				>
					<div className="space-y-2">
						<label className="block text-sm font-medium" htmlFor="text">
							テキスト入力（任意）
						</label>
						<textarea
							id="text"
							name="text"
							rows={6}
							className="w-full rounded-md border bg-background p-3 text-sm"
							placeholder="物件名、価格、所在地、面積、特徴などを貼り付け…"
						/>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-medium">
							画像入力（任意）
						</label>
						<input
							id="image"
							name="image"
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								setSelectedFileName(file ? file.name : null);
								if (file) {
									const reader = new FileReader();
									reader.onloadend = () => {
										setImagePreview(reader.result as string);
									};
									reader.readAsDataURL(file);
								} else {
									setImagePreview(null);
								}
							}}
						/>
						{imagePreview ? (
							<div className="relative">
								<div className="relative rounded-lg border-2 border-primary overflow-hidden">
									<img
										src={imagePreview}
										alt="選択された画像"
										className="w-full max-h-64 object-contain bg-muted/30"
									/>
									<div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group">
										<label
											htmlFor="image"
											className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
										>
											<span className="bg-background/90 text-foreground px-3 py-1.5 rounded-md text-sm font-medium">
												画像を変更
											</span>
										</label>
									</div>
								</div>
								<div className="mt-2 flex items-center justify-between">
									<p className="text-sm text-muted-foreground truncate flex-1">
										{selectedFileName}
									</p>
									<button
										type="button"
										onClick={() => {
											setSelectedFileName(null);
											setImagePreview(null);
											const input = document.getElementById(
												"image",
											) as HTMLInputElement;
											if (input) input.value = "";
										}}
										className="ml-2 text-xs text-destructive hover:underline"
									>
										削除
									</button>
								</div>
							</div>
						) : (
							<label
								htmlFor="image"
								className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
							>
								<div className="flex flex-col items-center justify-center pt-5 pb-6">
									<svg
										className="w-8 h-8 mb-2 text-muted-foreground"
										aria-hidden="true"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 20 16"
									>
										<path
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
										/>
									</svg>
									<p className="mb-1 text-sm text-muted-foreground">
										<span className="font-semibold">
											クリックして画像を選択
										</span>
									</p>
									<p className="text-xs text-muted-foreground">
										PNG, JPG, WEBP など
									</p>
								</div>
							</label>
						)}
						<p className="text-xs text-muted-foreground">
							画像が選択されている場合は画像を優先します。
						</p>
					</div>

					<button
						type="submit"
						disabled={isPending}
						className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
					>
						{isPending ? "生成中…" : "生成を開始"}
					</button>
				</form>

				{error ? (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
						{error}
					</div>
				) : null}
			</section>

			<section className="space-y-4">
				<h2 className="text-lg font-semibold">スライド</h2>
				{orderedSlides.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						まだスライドはありません。
					</p>
				) : (
					<div className="space-y-6">
						{orderedSlides.map((slide) => {
							switch (slide.type) {
								case "slide:start":
									return (
										<div key={slide.index} className="rounded-lg border p-4">
											<div className="font-medium">
												{slide.index}ページ: {slide.title}
											</div>
											<div className="text-sm text-muted-foreground">
												スライドの生成を開始しました。
											</div>
										</div>
									);
								case "slide:researching":
									return (
										<div key={slide.index} className="rounded-lg border p-4">
											<div className="font-medium">
												{slide.index}ページ: {slide.title}
											</div>
											<div className="text-sm text-muted-foreground">
												リサーチ中…
											</div>
										</div>
									);
								case "slide:generating":
									return (
										<div key={slide.index} className="rounded-lg border p-4">
											<div className="font-medium">
												{slide.index}ページ: {slide.title}
											</div>
											<div className="text-sm text-muted-foreground">
												スライドを生成中…
											</div>
										</div>
									);
								case "slide:end":
									return (
										<div
											key={slide.index}
											className="rounded-lg border p-4 space-y-3"
										>
											<div className="font-medium">
												{slide.index}ページ: {slide.title}
											</div>
											<div className="space-y-2">
												<div className="text-sm font-medium">プレビュー</div>
												<SlidePreview html={slide.data.slide.html} />
											</div>
										</div>
									);
								default:
									return null;
							}
						})}
					</div>
				)}
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">イベントログ</h2>
				<div className="rounded-md border bg-background p-3 text-xs overflow-auto max-h-80">
					<pre className="whitespace-pre-wrap wrap-break-word">
						{events.map((e, i) => `${i + 1}. ${JSON.stringify(e)}\n`).join("")}
					</pre>
				</div>
			</section>
		</main>
	);
}
