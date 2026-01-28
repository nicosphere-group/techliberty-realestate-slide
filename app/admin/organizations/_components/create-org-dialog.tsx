"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const createOrgSchema = z.object({
	name: z.string().min(1, "組織名は必須です"),
	slug: z
		.string()
		.min(1, "スラッグは必須です")
		.regex(/^[a-z0-9-]+$/, "半角英数字とハイフンのみ使用できます"),
});

export function CreateOrgDialog() {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			name: "",
			slug: "",
		} as z.input<typeof createOrgSchema>,
		validators: {
			onSubmit: createOrgSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.organization.create(
					{
						name: value.name,
						slug: value.slug,
					},
					{
						onSuccess: () => {
							toast.success("組織を作成しました");
							setOpen(false);
							router.refresh();
						},
						onError: (ctx) => {
							toast.error(ctx.error.message || "組織の作成に失敗しました");
						},
					},
				);
			} catch (error) {
				console.error(error);
				toast.error("予期せぬエラーが発生しました");
			}
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					新規作成
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-100">
				<DialogHeader>
					<DialogTitle>組織を作成</DialogTitle>
					<DialogDescription>
						新しい組織を作成します。スラッグはURLに使用されます。
					</DialogDescription>
				</DialogHeader>
				<form
					id="create-org-form"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="name"
							children={(field) => (
								<Field
									data-invalid={
										field.state.meta.isTouched && !field.state.meta.isValid
									}
								>
									<FieldLabel htmlFor={field.name}>組織名 (Name)</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => {
											field.handleChange(e.target.value);
											// Auto-generate slug if slug is empty or untouched
											/* Simple slug generation could go here if desired */
										}}
										placeholder="株式会社TechLiberty"
									/>
									{field.state.meta.isTouched && !field.state.meta.isValid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							)}
						/>
						<form.Field
							name="slug"
							children={(field) => (
								<Field
									data-invalid={
										field.state.meta.isTouched && !field.state.meta.isValid
									}
								>
									<FieldLabel htmlFor={field.name}>スラッグ (Slug)</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="tech-liberty"
									/>
									<p className="text-xs text-muted-foreground">
										URLに使用される識別子です(英数字・ハイフン)
									</p>
									{field.state.meta.isTouched && !field.state.meta.isValid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<Button
						type="submit"
						form="create-org-form"
						disabled={form.state.isSubmitting}
					>
						{form.state.isSubmitting && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						作成
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
