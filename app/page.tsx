"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
	GeneratedSlide,
	SlideGeneratorEvent,
	SlideResearchResult,
} from "../lib/slide-generator";
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

type SlideState = {
	slide?: GeneratedSlide;
	research?: SlideResearchResult;
	partialHtml?: string;
	status?: "researching" | "generating" | "done" | "error";
};

export default function Page() {
	const [isPending, startTransition] = useTransition();
	const [events, setEvents] = useState<SlideGeneratorEvent[]>([]);
	const [slidesByPage, setSlidesByPage] = useState<Record<number, SlideState>>(
		{},
	);
	const [error, setError] = useState<string | null>(null);

	const orderedSlides = useMemo(() => {
		return Object.entries(slidesByPage)
			.map(([k, v]) => ({ pageNumber: Number(k), ...v }))
			.sort((a, b) => a.pageNumber - b.pageNumber);
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
				case "research:start": {
					setSlidesByPage((prev) => ({
						...prev,
						[event.pageNumber]: {
							...(prev[event.pageNumber] ?? {}),
							status: "researching",
						},
					}));
					break;
				}
				case "research:end": {
					setSlidesByPage((prev) => ({
						...prev,
						[event.pageNumber]: {
							...(prev[event.pageNumber] ?? {}),
							research: event.research,
						},
					}));
					break;
				}
				case "slide:generating": {
					setSlidesByPage((prev) => ({
						...prev,
						[event.pageNumber]: {
							...(prev[event.pageNumber] ?? {}),
							status: "generating",
							partialHtml: event.html ?? prev[event.pageNumber]?.partialHtml,
						},
					}));
					break;
				}
				case "slide:end": {
					setSlidesByPage((prev) => ({
						...prev,
						[event.slide.pageNumber]: {
							...(prev[event.slide.pageNumber] ?? {}),
							status: "done",
							slide: event.slide,
							research: event.research,
							partialHtml: undefined,
						},
					}));
					break;
				}
				case "error": {
					setError(event.message);
					break;
				}
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
						<label className="block text-sm font-medium" htmlFor="image">
							画像入力（任意）
						</label>
						<input
							id="image"
							name="image"
							type="file"
							accept="image/*"
							className="block w-full text-sm"
						/>
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
						{orderedSlides.map(
							({ pageNumber, slide, research, partialHtml, status }) => {
								const html = slide?.html ?? partialHtml;
								return (
									<div
										key={pageNumber}
										className="rounded-lg border p-4 space-y-3"
									>
										<div className="flex items-baseline justify-between gap-4">
											<div className="font-medium">{pageNumber}ページ</div>
											<div className="text-xs text-muted-foreground">
												{status === "researching"
													? "リサーチ中"
													: status === "generating"
														? "生成中"
														: status === "done"
															? "完了"
															: ""}
											</div>
										</div>

										{html ? (
											<div className="space-y-2">
												<div className="text-sm font-medium">プレビュー</div>
												<SlidePreview html={html} />
											</div>
										) : null}

										{research?.images?.length ? (
											<div className="space-y-2">
												<div className="text-sm font-medium">
													画像候補（出典付き）
												</div>
												<div className="space-y-2">
													{research.images.map((img, idx) => (
														<div
															key={img.imageUrl}
															className="rounded-md border p-3 text-sm space-y-1"
														>
															<div className="font-medium">
																{img.title ?? img.alt ?? `画像 ${idx + 1}`}
															</div>
															<div className="text-xs break-all">
																<div>
																	画像URL:{" "}
																	<a
																		className="underline"
																		href={img.imageUrl}
																		target="_blank"
																		rel="noreferrer"
																	>
																		{img.imageUrl}
																	</a>
																</div>
																<div>
																	出典:{" "}
																	<a
																		className="underline"
																		href={img.pageUrl}
																		target="_blank"
																		rel="noreferrer"
																	>
																		{img.pageUrl}
																	</a>
																</div>
															</div>
															{img.license ? (
																<div className="text-xs text-muted-foreground">
																	license: {img.license}
																</div>
															) : null}
															{img.attribution ? (
																<div className="text-xs text-muted-foreground">
																	credit: {img.attribution}
																</div>
															) : null}
														</div>
													))}
												</div>
											</div>
										) : null}
									</div>
								);
							},
						)}
					</div>
				)}
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">イベントログ</h2>
				<div className="rounded-md border bg-background p-3 text-xs overflow-auto max-h-[320px]">
					<pre className="whitespace-pre-wrap break-words">
						{events.map((e, i) => `${i + 1}. ${JSON.stringify(e)}\n`).join("")}
					</pre>
				</div>
			</section>
		</main>
	);
}
