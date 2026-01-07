"use client";

import { readStreamableValue } from "@ai-sdk/rsc";
import {
	AlertCircle,
	FileText,
	ImageIcon,
	LayoutTemplate,
	Loader2,
	Sparkles,
	Upload,
	X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SlidePreview } from "@/components/slide-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Event, SlideEvent } from "@/lib/slide-generator";
import { run } from "./actions";

type SlideState = SlideEvent;

export default function ClientPage() {
	const [isPending, startTransition] = useTransition();
	const [events, setEvents] = useState<Event[]>([]);
	const [slidesByPage, setSlidesByPage] = useState<Record<number, SlideState>>(
		{},
	);

	const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	const isDevelopment = process.env.NODE_ENV === "development";

	const orderedSlides = useMemo(() => {
		return Object.values(slidesByPage).sort((a, b) => a.index - b.index);
	}, [slidesByPage]);

	async function onSubmit(formData: FormData) {
		setEvents([]);
		setSlidesByPage({});

		try {
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
						// Use toast for error notification
						toast.error(event.message, {
							icon: <AlertCircle className="h-4 w-4" />,
						});
						break;
					default:
						break;
				}
			}
		} catch (e) {
			console.error(e);
			toast.error("予期せぬエラーが発生しました。", {
				description: "もう一度お試しください。",
			});
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			{/* Header */}
			<header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
						<LayoutTemplate className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-lg font-bold leading-tight tracking-tight">
							SlideGen Real Estate
						</h1>
						<p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
							Automated Presentation Builder
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{/* Future actions: User profile, settings, etc */}
				</div>
			</header>

			<div className="flex flex-1 flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
				{/* Left Sidebar: Input Configuration */}
				<aside className="w-full shrink-0 border-r bg-muted/10 lg:w-105 xl:w-120 overflow-y-auto">
					<div className="flex flex-col h-full bg-white dark:bg-zinc-950">
						<div className="p-6 space-y-8 flex-1">
							<div>
								<h2 className="text-lg font-semibold tracking-tight">
									生成設定
								</h2>
								<p className="text-sm text-muted-foreground mt-1">
									物件情報を入力して、AIプレゼンテーションを生成します。
								</p>
							</div>

							<form
								action={(fd) => startTransition(() => onSubmit(fd))}
								className="space-y-8"
							>
								{/* Image Input */}
								<div className="space-y-4">
									<Label className="text-base font-medium flex items-center gap-2">
										<ImageIcon className="h-4 w-4 text-primary" />
										物件資料・間取り図
										<Badge variant="secondary" className="text-xs font-normal">
											推奨
										</Badge>
									</Label>

									{!imagePreview ? (
										<div className="relative group">
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
											<label
												htmlFor="image"
												className="flex flex-col items-center justify-center w-full h-40 border border-dashed rounded-xl border-muted-foreground/25 bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-all duration-200 cursor-pointer"
											>
												<div className="flex flex-col items-center justify-center py-4 text-muted-foreground group-hover:text-primary transition-colors">
													<div className="p-3 bg-background rounded-full shadow-sm mb-3 group-hover:scale-105 transition-transform">
														<Upload className="w-5 h-5" />
													</div>
													<p className="text-sm font-medium">
														画像をアップロード
													</p>
													<p className="text-xs opacity-60 mt-1">
														クリックまたはドラッグ＆ドロップ
													</p>
												</div>
											</label>
										</div>
									) : (
										<div className="relative rounded-xl overflow-hidden border bg-background shadow-sm group">
											<div className="relative aspect-video w-full bg-muted/20">
												<img
													src={imagePreview}
													alt="Selected preview"
													className="h-full w-full object-contain"
												/>
											</div>
											<div className="absolute top-2 right-2">
												<Button
													type="button"
													variant="destructive"
													size="icon"
													className="h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
													onClick={() => {
														setSelectedFileName(null);
														setImagePreview(null);
														const input = document.getElementById(
															"image",
														) as HTMLInputElement;
														if (input) input.value = "";
													}}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
											<div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t px-3 py-2">
												<p className="text-xs font-medium truncate flex items-center gap-2">
													<ImageIcon className="w-3 h-3 text-muted-foreground" />
													{selectedFileName}
												</p>
											</div>
											<input
												id="image"
												name="image"
												type="file"
												accept="image/*"
												className="hidden"
											/>
										</div>
									)}
								</div>

								{/* Text Input */}
								<div className="space-y-4">
									<Label
										htmlFor="text"
										className="text-base font-medium flex items-center gap-2"
									>
										<FileText className="h-4 w-4 text-primary" />
										補足テキスト情報
									</Label>
									<Textarea
										id="text"
										name="text"
										rows={8}
										className="resize-none min-h-40 font-mono text-sm leading-relaxed"
										placeholder="物件の詳細情報、アピールポイント、価格、所在地などを入力してください..."
									/>
								</div>

								<Separator />

								{/* Submit Button */}
								<Button
									type="submit"
									disabled={isPending}
									size="lg"
									className="w-full text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow h-12"
								>
									{isPending ? (
										<>
											<Loader2 className="mr-2 h-5 w-5 animate-spin" />
											生成中...
										</>
									) : (
										<>
											<Sparkles className="mr-2 h-5 w-5" />
											スライドを生成
										</>
									)}
								</Button>
							</form>
						</div>

						{/* Dev Logs - Only in Development */}
						{isDevelopment && (
							<div className="border-t bg-muted/20">
								<div className="px-6 py-3 border-b flex items-center justify-between">
									<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										開発ログ
									</h3>
									<Badge variant="outline" className="text-[10px] font-mono">
										DEV MODE
									</Badge>
								</div>
								<ScrollArea className="h-50">
									<div className="p-4 space-y-3 font-mono text-xs">
										{events.map((e, i) => (
											<div key={i} className="flex gap-2 text-muted-foreground">
												<span className="opacity-50 min-w-5">{i + 1}.</span>
												<div className="break-all">{JSON.stringify(e)}</div>
											</div>
										))}
										{events.length === 0 && (
											<div className="text-center py-8 text-muted-foreground/50">
												No events yet
											</div>
										)}
									</div>
								</ScrollArea>
							</div>
						)}
					</div>
				</aside>

				{/* Main Content: Generated Slides */}
				<main className="flex-1 overflow-y-auto bg-muted/5 dark:bg-background">
					<div className="p-6 lg:p-10 min-h-full">
						<div className="max-w-400 mx-auto space-y-8">
							<div className="flex items-end justify-between border-b pb-6">
								<div>
									<h2 className="text-2xl font-bold tracking-tight">
										プレビュー
									</h2>
									<p className="text-muted-foreground mt-1">
										AIが生成したスライドの構成を確認できます。
									</p>
								</div>
								{orderedSlides.length > 0 && (
									<div className="flex items-center gap-4">
										<div className="text-sm text-muted-foreground">
											<span className="font-semibold text-foreground">
												{orderedSlides.length}
											</span>{" "}
											枚のスライド
										</div>
										{/* Future: Download PPTX button here */}
									</div>
								)}
							</div>

							{orderedSlides.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-20 lg:py-32 text-center rounded-xl border-2 border-dashed border-muted-foreground/10 bg-muted/5">
									<div className="p-6 bg-background rounded-full shadow-sm mb-6">
										<PresentationPlaceholder className="w-12 h-12 text-muted-foreground/40" />
									</div>
									<h3 className="text-xl font-semibold text-foreground">
										スライドはまだありません
									</h3>
									<p className="text-muted-foreground max-w-sm mt-2 mb-8">
										左側のフォームから情報を入力して、最初のプレゼンテーションを生成しましょう。
									</p>
									<Button variant="outline" disabled className="opacity-50">
										<Sparkles className="mr-2 h-4 w-4" />
										生成待ち...
									</Button>
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
									{orderedSlides.map((slide) => {
										const isCompleted = slide.type === "slide:end";
										const isGenerating = slide.type === "slide:generating";
										const isResearching = slide.type === "slide:researching";

										return (
											<div
												key={slide.index}
												className="flex flex-col gap-3 group"
											>
												<div className="flex items-center justify-between px-1">
													<div className="flex items-center gap-2">
														<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
															{slide.index}
														</span>
														<span className="text-sm font-semibold text-foreground/80 truncate max-w-50">
															{slide.title || `スライド ${slide.index}`}
														</span>
													</div>
													<div className="flex items-center gap-2">
														{isResearching && (
															<Badge
																variant="secondary"
																className="text-[10px] animate-pulse"
															>
																分析中
															</Badge>
														)}
														{isGenerating && (
															<Badge className="text-[10px] bg-blue-500 animate-pulse">
																生成中
															</Badge>
														)}
														{isCompleted && (
															<Badge
																variant="outline"
																className="text-[10px] text-green-600 border-green-200 bg-green-50"
															>
																完了
															</Badge>
														)}
													</div>
												</div>

												{isCompleted ? (
													<SlidePreview
														html={slide.data.slide.html}
														title={slide.title}
														className="shadow-sm ring-1 ring-border group-hover:ring-primary/50 transition-all duration-300"
													/>
												) : (
													<div className="aspect-video w-full rounded-lg border bg-background/50 flex flex-col items-center justify-center text-muted-foreground gap-3 relative overflow-hidden">
														<div className="absolute inset-0 bg-muted/10" />
														{isResearching ? (
															<>
																<Loader2 className="h-8 w-8 animate-spin text-primary/40" />
																<p className="text-xs font-medium relative z-10">
																	情報を分析しています...
																</p>
															</>
														) : isGenerating ? (
															<>
																<Loader2 className="h-8 w-8 animate-spin text-blue-500/40" />
																<p className="text-xs font-medium relative z-10">
																	デザインを作成中...
																</p>
															</>
														) : (
															<p className="text-xs relative z-10">待機中...</p>
														)}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}

function PresentationPlaceholder({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Presentation Placeholder</title>
			<path d="M2 3h20" />
			<path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
			<path d="m7 21 5-5 5 5" />
		</svg>
	);
}
