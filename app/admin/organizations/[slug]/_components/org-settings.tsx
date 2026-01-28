"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { updateOrganization } from "@/app/admin/actions"; // use server action instead
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// import { authClient } from "@/lib/auth-client"; // removed

const updateOrgSchema = z.object({
	name: z.string().min(1, "組織名は必須です"),
	slug: z
		.string()
		.min(1, "スラッグは必須です")
		.regex(/^[a-z0-9-]+$/, "半角英数字とハイフンのみ使用できます"),
});

interface OrgSettingsProps {
	orgId: string;
	initialName: string;
	initialSlug: string;
}

export function OrgSettings({
	orgId,
	initialName,
	initialSlug,
}: OrgSettingsProps) {
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			name: initialName,
			slug: initialSlug,
		} as z.input<typeof updateOrgSchema>,
		validators: {
			onSubmit: updateOrgSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const res = await updateOrganization(orgId, {
					name: value.name,
					slug: value.slug,
				});

				if (res.success) {
					toast.success("組織情報を更新しました");
					router.refresh();
					// Redirect if slug changes as it affects the URL
					if (value.slug !== initialSlug) {
						router.push(`/admin/organizations/${value.slug}`);
					}
				}
			} catch (error) {
				console.error(error);
				if (error instanceof Error) {
					toast.error(error.message || "更新に失敗しました");
				} else {
					toast.error("予期せぬエラーが発生しました");
				}
			}
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>基本設定</CardTitle>
				<CardDescription>組織の名前とスラッグを変更できます。</CardDescription>
			</CardHeader>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<CardContent className="space-y-4">
					<FieldGroup>
						<form.Field
							name="name"
							children={(field) => (
								<Field>
									<FieldLabel>組織名</FieldLabel>
									<Input
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="株式会社TechLiberty"
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						/>
						<form.Field
							name="slug"
							children={(field) => (
								<Field>
									<FieldLabel>スラッグ (URL ID)</FieldLabel>
									<Input
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="tech-liberty"
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						/>
					</FieldGroup>
				</CardContent>
				<CardFooter className="flex justify-end px-6 py-4">
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<Button type="submit" disabled={!canSubmit}>
								{isSubmitting && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								保存
							</Button>
						)}
					/>
				</CardFooter>
			</form>
		</Card>
	);
}
