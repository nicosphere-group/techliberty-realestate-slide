"use client";

import { useForm } from "@tanstack/react-form";
import { exportToPptx } from "dom-to-pptx";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import {
	AlertCircle,
	Download,
	ImageIcon,
	LayoutTemplate,
	Loader2,
	Sparkles,
	Square,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/dropzone";
import { ModeToggle } from "@/components/mode-toggle";
import { ScaledFrame, SlidePreview } from "@/components/slide-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Event, PlanEvent, SlideEvent, UsageInfo } from "@/lib/slide-generator";
import { cn } from "@/lib/utils";
import { convertPdfToSingleJpg, isPdfFile } from "@/lib/utils/pdf-converter";
import { formSchema } from "./schemas";

type PlanState = PlanEvent;
type SlideState = SlideEvent;

// コスト計算用の料金レート（per 1M tokens）
const PRICING = {
	low: { input: 0.1, output: 0.4 },
	middle: { input: 0.5, output: 3.0 },
	high: { input: 2.0, output: 12.0 },
} as const;

export default function ClientPage() {
	const [plan, setPlan] = useState<PlanState>();
	const [slidesByPage, setSlidesByPage] = useState<Record<number, SlideState>>(
		{},
	);
	const [totalUsage, setTotalUsage] = useState<UsageInfo>({
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
	});
	const [generationDurationMs, setGenerationDurationMs] = useState<number>(0);
	const generationStartTimeRef = useRef<number>(0);
	const slideIframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
	const abortControllerRef = useRef<AbortController | null>(null);

	const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
	const [exportTarget, setExportTarget] = useState<"pptx" | "pdf">("pptx");
	const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>(
		[],
	);
	const [isConvertingPdf, setIsConvertingPdf] = useState(false);

	// const isDevelopment = process.env.NODE_ENV === "development";
	const isDevelopment = true;

	const orderedSlides = useMemo(() => {
		return Object.values(slidesByPage).sort((a, b) => a.index - b.index);
	}, [slidesByPage]);

	const form = useForm({
		defaultValues: {
			companyName: "",
			storeName: "",
			storeAddress: "",
			storePhoneNumber: "",
			storeEmailAddress: "",
			flyerFiles: [],
			// 資金計画シミュレーション用
			annualIncome: undefined,
			downPayment: undefined,
			interestRate: undefined,
			loanTermYears: undefined,
			// 開発用
			modelType: "middle",
			useStructuredOutput: true,
		} as z.infer<typeof formSchema>,
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			setPlan(undefined);
			setSlidesByPage({});
			setTotalUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
			setGenerationDurationMs(0);
			generationStartTimeRef.current = Date.now();
			slideIframeRefs.current.clear();

			// AbortControllerでキャンセル可能にする
			abortControllerRef.current = new AbortController();

			try {
				// FormDataを作成
				const formData = new FormData();

				// ファイル以外のデータをJSONとして追加
				const inputData = {
					companyName: value.companyName,
					storeName: value.storeName,
					storeAddress: value.storeAddress,
					storePhoneNumber: value.storePhoneNumber,
					storeEmailAddress: value.storeEmailAddress,
					annualIncome: value.annualIncome,
					downPayment: value.downPayment,
					interestRate: value.interestRate,
					loanTermYears: value.loanTermYears,
					modelType: value.modelType,
					useStructuredOutput: value.useStructuredOutput,
				};
				formData.append("input", JSON.stringify(inputData));

				// ファイルを追加
				if (value.flyerFiles && value.flyerFiles.length > 0) {
					formData.append("flyerFile", value.flyerFiles[0]);
				}

				// SSEストリームをフェッチ
				const response = await fetch("/api/generate", {
					method: "POST",
					body: formData,
					signal: abortControllerRef.current?.signal,
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Generation failed");
				}

				if (!response.body) {
					throw new Error("No response body");
				}

				// SSEストリームを読み取り
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value: chunk } = await reader.read();
					if (done) break;

					buffer += decoder.decode(chunk, { stream: true });

					// SSEイベントをパース（"data: " で始まり "\n\n" で終わる）
					const lines = buffer.split("\n\n");
					buffer = lines.pop() || ""; // 最後の不完全な行をバッファに残す

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							const jsonStr = line.slice(6); // "data: " を除去
							try {
								const event = JSON.parse(jsonStr) as Event;

								// デバッグ: 受信したイベントをログ出力
								const eventInfo = event.type === "slide:end" || event.type === "slide:generating" || event.type === "slide:start"
									? `index=${(event as { index: number }).index}`
									: "";
								console.log(`[client] Event received: ${event.type} ${eventInfo}`);

								switch (event.type) {
									case "plan:start":
									case "plan:end":
										setPlan(event);
										break;

									case "slide:start":
									case "slide:generating":
									case "slide:end":
										console.log(`[client] Updating slide ${event.index} with type ${event.type}`);
										setSlidesByPage((prev) => {
											const updated = {
												...prev,
												[event.index]: event,
											};
											console.log(`[client] slidesByPage keys after update:`, Object.keys(updated));
											return updated;
										});
										break;
									case "error":
										toast.error(event.message, {
											icon: <AlertCircle className="h-4 w-4" />,
										});
										break;
									case "usage":
										setTotalUsage((prev) => ({
											promptTokens: prev.promptTokens + event.usage.promptTokens,
											completionTokens:
												prev.completionTokens + event.usage.completionTokens,
											totalTokens: prev.totalTokens + event.usage.totalTokens,
										}));
										break;
									case "end":
										console.log("[client] Generation ended");
										setGenerationDurationMs(
											Date.now() - generationStartTimeRef.current,
										);
										break;
									case "heartbeat":
										console.log("[client] Heartbeat received");
										break;
									default:
										break;
								}
							} catch (parseError) {
								console.error("[client] Failed to parse SSE event:", parseError, jsonStr);
							}
						}
					}
				}
				console.log("[client] Stream iteration completed");
			} catch (e) {
				// AbortErrorは無視（ユーザーによるキャンセル）
				if (e instanceof Error && e.name === "AbortError") {
					console.log("[client] Request aborted by user");
					toast.info("生成をキャンセルしました。");
					return;
				}
				console.error("[client] Stream error:", e);
				toast.error("予期せぬエラーが発生しました。", {
					description: e instanceof Error ? e.message : "もう一度お試しください。",
				});
			} finally {
				abortControllerRef.current = null;
			}
		},
	});

	// キャンセルハンドラー
	const handleCancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
	};

	// Memoize cost calculation to avoid recalculation on every render
	const costInfo = useMemo(() => {
		const modelType =
			(form.state.values.modelType as keyof typeof PRICING) ?? "middle";
		const pricing = PRICING[modelType];
		const inputCost = (totalUsage.promptTokens / 1_000_000) * pricing.input;
		const outputCost =
			(totalUsage.completionTokens / 1_000_000) * pricing.output;
		const totalCost = inputCost + outputCost;
		return { inputCost, outputCost, totalCost, pricing };
	}, [
		totalUsage.promptTokens,
		totalUsage.completionTokens,
		form.state.values.modelType,
	]);

	// Extract slide containers helper to avoid duplication
	const getSlideContainers = (indices: number[]) => {
		const slideContainers: HTMLElement[] = [];
		for (const index of indices) {
			const iframe = slideIframeRefs.current.get(index);
			if (!iframe?.contentDocument) continue;
			const slideContainer =
				iframe.contentDocument.getElementById("slide-container");
			if (slideContainer) slideContainers.push(slideContainer);
		}
		return slideContainers;
	};

	const executeExportPptx = async (indices: number[]) => {
		const validIndices = indices
			.filter((index) => slideIframeRefs.current.has(index))
			.sort((a, b) => a - b);

		if (validIndices.length === 0) {
			toast.error("エクスポートするスライドがありません。");
			return;
		}

		const toastId = toast.loading("PPTXを生成中...");

		try {
			const slideContainers = getSlideContainers(validIndices);
			await exportToPptx(slideContainers);
			toast.success("PPTXのエクスポートが完了しました");
		} catch (e) {
			console.error(e);
			toast.error("PPTXのエクスポートに失敗しました。");
		} finally {
			toast.dismiss(toastId);
		}
	};

	const executeExportPdf = async (indices: number[]) => {
		const validIndices = indices
			.filter((index) => slideIframeRefs.current.has(index))
			.sort((a, b) => a - b);

		if (validIndices.length === 0) {
			toast.error("エクスポートするスライドがありません。");
			return;
		}

		const toastId = toast.loading("PDFを生成中...");

		try {
			const doc = new jsPDF({
				orientation: "landscape",
				unit: "px",
				format: [1920, 1080],
			});

			const slideContainers = getSlideContainers(validIndices);

			for (let i = 0; i < slideContainers.length; i++) {
				const slideContainer = slideContainers[i];

				const canvas = await html2canvas(slideContainer, {
					scale: 2,
					useCORS: true,
					logging: false,
					windowWidth: 1920,
					windowHeight: 1080,
					backgroundColor: "#ffffff",
				});

				const imgData = canvas.toDataURL("image/jpeg", 0.95);

				if (i > 0) {
					doc.addPage([1920, 1080], "landscape");
				}
				doc.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
			}

			doc.save(`presentation_${Date.now()}.pdf`);
			toast.success("PDFのエクスポートが完了しました");
		} catch (e) {
			console.error(e);
			toast.error("PDFのエクスポートに失敗しました。");
		} finally {
			toast.dismiss(toastId);
		}
	};

	const openExportDialog = (target: "pptx" | "pdf") => {
		setExportTarget(target);
		setSelectedSlideIndices(orderedSlides.map((s) => s.index));
		setIsExportDialogOpen(true);
	};

	const handleExport = async () => {
		setIsExportDialogOpen(false);
		switch (exportTarget) {
			case "pptx":
				await executeExportPptx(selectedSlideIndices);
				break;
			case "pdf":
				await executeExportPdf(selectedSlideIndices);
				break;
			default:
				break;
		}
	};

	return (
		<div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
			{/* Header */}
			<header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60 z-30">
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
					<ModeToggle />
					{/* Future actions: User profile, settings, etc */}
				</div>
			</header>

			<div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
				{/* Left Sidebar: Input Configuration */}
				<aside className="w-full shrink-0 border-r bg-muted/10 lg:w-105 xl:w-120 overflow-y-auto">
					<div className="flex flex-col h-full bg-background">
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
								id="generate-slides-form"
								className="space-y-8"
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
							>
								{/* Company Name */}
								<form.Field
									name="companyName"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel
													htmlFor={field.name}
													className="text-base font-medium"
												>
													会社名
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													placeholder="例: 株式会社○○不動産"
													autoComplete="organization"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>

								{/* Store Name */}
								<form.Field
									name="storeName"
									children={(field) => {
										return (
											<Field>
												<FieldLabel
													htmlFor={field.name}
													className="text-base font-medium"
												>
													店舗名
													<Badge
														variant="secondary"
														className="ml-2 text-xs font-normal"
													>
														任意
													</Badge>
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													value={field.state.value || ""}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="例: 渋谷支店"
													autoComplete="off"
												/>
											</Field>
										);
									}}
								/>

								{/* Store Address */}
								<form.Field
									name="storeAddress"
									children={(field) => {
										return (
											<Field>
												<FieldLabel
													htmlFor={field.name}
													className="text-base font-medium"
												>
													店舗住所
													<Badge
														variant="secondary"
														className="ml-2 text-xs font-normal"
													>
														任意
													</Badge>
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													value={field.state.value || ""}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="例: 〒150-0001 東京都渋谷区..."
													autoComplete="street-address"
												/>
											</Field>
										);
									}}
								/>

								{/* Store Phone Number */}
								<form.Field
									name="storePhoneNumber"
									children={(field) => {
										return (
											<Field>
												<FieldLabel
													htmlFor={field.name}
													className="text-base font-medium"
												>
													店舗電話番号
													<Badge
														variant="secondary"
														className="ml-2 text-xs font-normal"
													>
														任意
													</Badge>
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													type="tel"
													value={field.state.value || ""}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="例: 03-1234-5678"
													autoComplete="tel"
												/>
											</Field>
										);
									}}
								/>

								{/* Store Email */}
								<form.Field
									name="storeEmailAddress"
									children={(field) => {
										return (
											<Field>
												<FieldLabel
													htmlFor={field.name}
													className="text-base font-medium"
												>
													店舗メールアドレス
													<Badge
														variant="secondary"
														className="ml-2 text-xs font-normal"
													>
														任意
													</Badge>
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													type="email"
													value={field.state.value || ""}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="例: info@example.com"
													autoComplete="email"
												/>
											</Field>
										);
									}}
								/>

								<Separator />

								{/* 資金計画シミュレーション セクション */}
								<div>
									<h3 className="text-base font-medium mb-1">
										資金計画シミュレーション
										<Badge
											variant="secondary"
											className="ml-2 text-xs font-normal"
										>
											任意
										</Badge>
									</h3>
									<div className="grid grid-cols-2 gap-4">
										{/* Annual Income */}
										<form.Field
											name="annualIncome"
											children={(field) => (
												<Field>
													<FieldLabel
														htmlFor={field.name}
														className="text-sm font-medium"
													>
														年収（万円）
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														type="number"
														value={field.state.value ?? ""}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														placeholder="例: 600"
													/>
												</Field>
											)}
										/>

										{/* Down Payment */}
										<form.Field
											name="downPayment"
											children={(field) => (
												<Field>
													<FieldLabel
														htmlFor={field.name}
														className="text-sm font-medium"
													>
														自己資金（万円）
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														type="number"
														value={field.state.value ?? ""}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														placeholder="例: 500"
													/>
												</Field>
											)}
										/>

										{/* Interest Rate */}
										<form.Field
											name="interestRate"
											children={(field) => (
												<Field>
													<FieldLabel
														htmlFor={field.name}
														className="text-sm font-medium"
													>
														想定金利（%）
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														type="number"
														step="0.1"
														value={field.state.value ?? ""}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														placeholder="例: 1.5"
													/>
												</Field>
											)}
										/>

										{/* Loan Term */}
										<form.Field
											name="loanTermYears"
											children={(field) => (
												<Field>
													<FieldLabel
														htmlFor={field.name}
														className="text-sm font-medium"
													>
														返済期間（年）
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														type="number"
														value={field.state.value ?? ""}
														onBlur={field.handleBlur}
														onChange={(e) =>
															field.handleChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
														placeholder="例: 35"
													/>
												</Field>
											)}
										/>
									</div>
								</div>

								<Separator />

								{/* Image Input */}
								<form.Field
									name="flyerFiles"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel className="text-base font-medium flex items-center gap-2">
													<ImageIcon className="h-4 w-4 text-primary" />
													マイソク
												</FieldLabel>
												<Dropzone
													accept={{
														"image/*": [
															".png",
															".jpg",
															".jpeg",
															".gif",
															".webp",
														],
														"application/pdf": [".pdf"],
													}}
													maxFiles={1}
													maxSize={20 * 1024 * 1024}
													src={field.state.value || []}
													disabled={isConvertingPdf}
													onDrop={async (acceptedFiles) => {
														if (acceptedFiles.length === 0) return;

														const file = acceptedFiles[0];

														// PDFの場合はJPGに変換（全ページを縦に連結）
														if (isPdfFile(file)) {
															setIsConvertingPdf(true);
															try {
																const result = await convertPdfToSingleJpg(file, 1440, 0.85);
																field.handleChange([result.file]);
															} catch (error) {
																console.error("PDF変換エラー:", error);
																toast.error("PDFの変換に失敗しました", {
																	description: error instanceof Error ? error.message : "不明なエラー",
																});
															} finally {
																setIsConvertingPdf(false);
															}
														} else {
															field.handleChange(acceptedFiles);
														}
													}}
													onError={(error) => {
														toast.error(
															"ファイルのアップロードに失敗しました",
															{
																description: error.message,
															},
														);
													}}
													className="h-40"
												>
													{isConvertingPdf ? (
														<div className="flex flex-col items-center justify-center">
															<Loader2 className="h-8 w-8 animate-spin text-primary" />
															<p className="my-2 font-medium text-sm">PDFを変換中...</p>
														</div>
													) : (
														<>
															<DropzoneEmptyState />
															<DropzoneContent />
														</>
													)}
												</Dropzone>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>

								<Separator />

								{/* Submit / Stop Button */}
								{form.state.isSubmitting ? (
									<Button
										type="button"
										size="lg"
										onClick={handleCancel}
										className="w-full text-base font-medium h-12 bg-neutral-800 hover:bg-neutral-700 text-white opacity-90 hover:opacity-100 transition-all"
									>
										<Square className="h-3.5 w-3.5 fill-current" />
										停止
									</Button>
								) : (
									<Button
										type="submit"
										size="lg"
										className="w-full text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow h-12"
									>
										<Sparkles className="h-5 w-5" />
										スライドを生成
									</Button>
								)}
							</form>
						</div>

						{/* Dev Settings & Logs - Only in Development */}
						{isDevelopment && (
							<div className="border-t bg-muted/20">
								<div className="px-6 py-3 border-b flex items-center justify-between">
									<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										開発設定
									</h3>
									<Badge variant="outline" className="text-[10px] font-mono">
										DEV MODE
									</Badge>
								</div>
								<div className="px-6 py-3 border-b space-y-3">
									<form.Field
										name="modelType"
										children={(field) => (
											<>
												<div className="flex items-center justify-between">
													<span className="text-xs text-muted-foreground">
														モデル
													</span>
													<ToggleGroup
														type="single"
														value={field.state.value}
														onValueChange={(value) => {
															if (value)
																field.handleChange(
																	z
																		.enum(["low", "middle", "high"])
																		.parse(value),
																);
														}}
														variant="outline"
														size="sm"
													>
														<ToggleGroupItem
															value="low"
															className="text-xs px-3"
														>
															2.5 Flash-Lite
														</ToggleGroupItem>
														<ToggleGroupItem
															value="middle"
															className="text-xs px-3"
														>
															3.0 Flash
														</ToggleGroupItem>
														<ToggleGroupItem
															value="high"
															className="text-xs px-3"
														>
															3.0 Pro
														</ToggleGroupItem>
													</ToggleGroup>
												</div>
											</>
										)}
									/>
									<form.Field
										name="useStructuredOutput"
										children={(field) => (
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground">
													出力形式
												</span>
												<ToggleGroup
													type="single"
													value={field.state.value ? "structured" : "raw"}
													onValueChange={(value) => {
														if (value)
															field.handleChange(value === "structured");
													}}
													variant="outline"
													size="sm"
												>
													<ToggleGroupItem
														value="structured"
														className="text-xs px-3"
													>
														構造化出力
													</ToggleGroupItem>
													<ToggleGroupItem
														value="raw"
														className="text-xs px-3"
													>
														生HTML
													</ToggleGroupItem>
												</ToggleGroup>
											</div>
										)}
									/>
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											トークン
										</span>
										<span className="text-xs font-mono">
											入力 {totalUsage.promptTokens.toLocaleString()} /
											出力 {totalUsage.completionTokens.toLocaleString()}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											推定コスト
										</span>
										<span className="text-xs font-mono font-semibold text-primary">
											${costInfo.totalCost.toFixed(4)} (¥
											{Math.round(
												costInfo.totalCost * 150,
											).toLocaleString()}
											)
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											生成時間
										</span>
										<span className="text-xs font-mono">
											{generationDurationMs > 0
												? `${(generationDurationMs / 1000).toFixed(1)}秒`
												: "-"}
										</span>
									</div>
								</div>
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
										<div className="text-sm text-muted-foreground mr-auto">
											<span className="font-semibold text-foreground">
												{orderedSlides.length}
											</span>{" "}
											枚のスライド
										</div>
										<Button
											onClick={() => openExportDialog("pptx")}
											disabled={form.state.isSubmitting}
											size="default"
											className="shadow-md hover:shadow-lg transition-shadow hidden"
										>
											<Download className="h-4 w-4" />
											PPTXで出力
										</Button>
										<Button
											onClick={() => openExportDialog("pdf")}
											disabled={form.state.isSubmitting}
											size="default"
											className="shadow-md hover:shadow-lg transition-shadow"
										>
											<Download className="h-4 w-4" />
											PDFで出力
										</Button>
									</div>
								)}
							</div>

							<Dialog
								open={isExportDialogOpen}
								onOpenChange={setIsExportDialogOpen}
							>
								<DialogContent className="sm:max-w-5xl h-[80vh] flex flex-col">
									<DialogHeader>
										<DialogTitle>出力スライドの選択</DialogTitle>
										<DialogDescription>
											出力したいスライドを選択してください。
										</DialogDescription>
									</DialogHeader>
									<div className="flex-1 min-h-0 py-2">
										<ScrollArea className="h-full w-full rounded-md border bg-muted/20">
											<div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
												{orderedSlides.map((slide) => {
													const isSelected = selectedSlideIndices.includes(
														slide.index,
													);
													// Only show completed slides
													if (slide.type !== "slide:end") return null;

													return (
														<button
															key={slide.index}
															type="button"
															tabIndex={0}
															className={cn(
																"group relative w-full cursor-pointer rounded-lg border-2 overflow-hidden transition-all duration-200 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
																isSelected
																	? "border-primary ring-2 ring-primary/20"
																	: "border-transparent ring-1 ring-border hover:ring-primary/50",
															)}
															onClick={() => {
																const slideIndex = slide.index;
																setSelectedSlideIndices((prev) => {
																	const currentlySelected =
																		prev.includes(slideIndex);
																	return currentlySelected
																		? prev.filter((i) => i !== slideIndex)
																		: [...prev, slideIndex];
																});
															}}
														>
															<div className="pointer-events-none aspect-video w-full">
																<ScaledFrame html={slide.data.slide.html} />
															</div>

															{/* Index Badge */}
															<div className="absolute top-2 left-2 z-10">
																<div
																	className={cn(
																		"h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ring-1 ring-white/20",
																		isSelected
																			? "bg-primary text-primary-foreground"
																			: "bg-black/60 text-white backdrop-blur-sm",
																	)}
																>
																	{slide.index}
																</div>
															</div>

															{/* Checkbox */}
															<div className="absolute top-2 right-2 z-10">
																<div
																	className={cn(
																		"rounded-sm bg-background/90 shadow-sm transition-all",
																		isSelected
																			? "opacity-100"
																			: "opacity-70 group-hover:opacity-100",
																	)}
																>
																	<Checkbox
																		id={`slide-${slide.index}`}
																		checked={isSelected}
																		className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
																		// Let parent handle click
																		onCheckedChange={() => {}}
																	/>
																</div>
															</div>

															{/* Title Overlay */}
															<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col justify-end">
																<p className="text-[10px] font-medium text-white line-clamp-2 leading-tight">
																	{slide.title}
																</p>
															</div>

															{/* Selected Overlay */}
															{isSelected && (
																<div className="absolute inset-0 bg-primary/10 pointer-events-none" />
															)}
														</button>
													);
												})}
											</div>
										</ScrollArea>
									</div>
									<DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
										<div className="text-sm text-muted-foreground">
											<span className="font-semibold text-foreground">
												{selectedSlideIndices.length}
											</span>{" "}
											枚選択中
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												onClick={() => {
													setIsExportDialogOpen(false);
												}}
											>
												キャンセル
											</Button>
											<Button
												onClick={handleExport}
												disabled={selectedSlideIndices.length === 0}
											>
												{(() => {
													switch (exportTarget) {
														case "pptx":
															return "PPTX";
														case "pdf":
															return "PDF";
													}
												})()}
												を出力
											</Button>
										</div>
									</DialogFooter>
								</DialogContent>
							</Dialog>

							{orderedSlides.length === 0 ? (
								form.state.isSubmitting ? (
									<div className="flex flex-col items-center justify-center py-20 lg:py-32 text-center rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
										<div className="flex flex-col items-center gap-4 max-w-md w-full px-6">
											<Loader2 className="h-12 w-12 animate-spin text-primary" />
											<h3 className="text-xl font-semibold text-foreground">
												{plan?.type === "plan:end"
													? "構成案が完成しました"
													: "AIが物件情報を分析中..."}
											</h3>
											<p className="text-muted-foreground">
												{plan?.type === "plan:end"
													? "各スライドの生成を開始します。"
													: "最適なプレゼンテーション構成を考えています。"}
											</p>

											{plan?.type === "plan:end" && (
												<div className="mt-4 p-4 bg-background/80 backdrop-blur rounded-lg text-left text-sm w-full border shadow-sm max-h-60 overflow-y-auto">
													<p className="font-medium mb-3 text-foreground flex items-center gap-2">
														<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
															{plan.plan.length}
														</span>
														生成予定のスライド
													</p>
													<ul className="space-y-2">
														{plan.plan.map((slideDef, i) => (
															<li
																key={i}
																className="text-muted-foreground flex gap-2 text-xs"
															>
																<span className="opacity-50 min-w-4">
																	{i + 1}.
																</span>
																<span>{slideDef.title}</span>
															</li>
														))}
													</ul>
												</div>
											)}
										</div>
									</div>
								) : (
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
											<Sparkles className="h-4 w-4" />
											生成待ち...
										</Button>
									</div>
								)
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
									{orderedSlides.map((slide) => {
										const isCompleted = slide.type === "slide:end";
										const isGenerating = slide.type === "slide:generating";
										const isPending = slide.type === "slide:start";

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
															{slide.title}
														</span>
													</div>
													<div className="flex items-center gap-2">
														{isPending && (
															<Badge
																variant="secondary"
																className="text-[10px] animate-pulse"
															>
																分析中
															</Badge>
														)}
														{isGenerating && (
															<Badge className="text-[10px] bg-blue-500 text-white dark:bg-blue-600 dark:text-blue-50 animate-pulse">
																生成中
															</Badge>
														)}
														{isCompleted && (
															<Badge
																variant="outline"
																className="text-[10px] text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950/30"
															>
																完了
															</Badge>
														)}
													</div>
												</div>

												{isCompleted ? (
													<SlidePreview
														iframeRef={(el) => {
															if (el)
																slideIframeRefs.current.set(slide.index, el);
															else slideIframeRefs.current.delete(slide.index);
														}}
														html={slide.data.slide.html}
														title={slide.title}
														className="shadow-sm ring-1 ring-border group-hover:ring-primary/50 transition-all duration-300"
													/>
												) : (
													<div className="aspect-video w-full rounded-lg border bg-background/50 flex flex-col items-center justify-center text-muted-foreground gap-3 relative overflow-hidden">
														<div className="absolute inset-0 bg-muted/10" />
														{isPending ? (
															<>
																<Loader2 className="h-8 w-8 animate-spin text-primary/40" />
																<p className="text-xs font-medium relative z-10">
																	情報を分析しています...
																</p>
															</>
														) : isGenerating ? (
															<>
																<Loader2 className="h-8 w-8 animate-spin text-blue-500/40 dark:text-blue-400/60" />
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
