"use client";

import { useForm } from "@tanstack/react-form";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

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
import { authClient } from "@/lib/auth-client";

const loginSchema = z.object({
	email: z.email("有効なメールアドレスを入力してください"),
	password: z.string().min(1, "パスワードを入力してください"),
});

export default function LoginPage() {
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		} as z.input<typeof loginSchema>,
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.signIn.email(value, {
					onSuccess: () => {
						toast.success("ログインしました");
						router.push("/");
					},
					onError: (ctx) => {
						toast.error(ctx.error.message || "ログインに失敗しました");
					},
				});
			} catch (error) {
				console.error(error);
				toast.error("予期せぬエラーが発生しました");
			}
		},
	});

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-8 flex flex-col items-center gap-2 text-center">
				<div className="flex items-center gap-2 rounded-lg bg-primary p-2 text-primary-foreground">
					<LayoutTemplate className="size-6" />
				</div>
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					TechLiberty Slides
				</h1>
				<p className="text-muted-foreground">
					不動産スライド生成ツールへようこそ
				</p>
			</div>

			<Card className="w-full max-w-sm shadow-lg border-opacity-60">
				<CardHeader>
					<CardTitle className="text-xl">ログイン</CardTitle>
					<CardDescription>
						アカウント情報を入力してログインしてください
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						id="login-form"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<form.Field
								name="email"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												メールアドレス
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="email"
												placeholder="name@example.com"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="username"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							<form.Field
								name="password"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<div className="flex items-center justify-between">
												<FieldLabel htmlFor={field.name}>パスワード</FieldLabel>
											</div>
											<Input
												id={field.name}
												name={field.name}
												type="password"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="current-password"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
						</FieldGroup>
					</form>
				</CardContent>
				<CardFooter>
					<Button
						className="w-full"
						type="submit"
						form="login-form"
						disabled={form.state.isSubmitting}
					>
						{form.state.isSubmitting && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						ログイン
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
