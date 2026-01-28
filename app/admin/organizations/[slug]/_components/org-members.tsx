"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	cancelInvitation,
	inviteMember,
	removeMember,
} from "@/app/admin/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Invitation, Member, User } from "@/lib/generated/prisma/client";

const inviteSchema = z.object({
	email: z.string().email("メールアドレスの形式が正しくありません"),
	role: z.enum(["admin", "member", "owner"]),
});

interface Props {
	orgId: string;
	members: (Member & { user: User })[];
	invitations: Invitation[];
}

export function OrgMembers({ orgId, members, invitations }: Props) {
	const [open, setOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			role: "member",
		} as z.input<typeof inviteSchema>,
		validators: {
			onSubmit: inviteSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const res = await inviteMember(orgId, value.email, value.role);
				if (res.success) {
					toast.success("招待メールを送信しました(模擬)");
					// In real app, action sends email.
					setOpen(false);
					form.reset();
				}
			} catch (error) {
				console.error(error);
				toast.error("エラーが発生しました");
			}
		},
	});

	const handleRemoveMember = async (id: string) => {
		if (!confirm("本当に削除しますか？")) return;
		try {
			await removeMember(orgId, id);
			toast.success("メンバーを削除しました");
		} catch (_) {
			toast.error("削除に失敗しました");
		}
	};

	const handleCancelInvitation = async (id: string) => {
		if (!confirm("招待を取り消しますか？")) return;
		try {
			await cancelInvitation(id);
			toast.success("招待を取り消しました");
		} catch (_) {
			toast.error("取り消しに失敗しました");
		}
	};

	return (
		<div className="space-y-8">
			{/* Members Section */}
			<div className="space-y-4">
				<div className="flex justify-between items-center">
					<h3 className="text-lg font-medium">メンバー</h3>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<UserPlus className="mr-2 h-4 w-4" />
								招待
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>メンバーを招待</DialogTitle>
							</DialogHeader>
							<form
								id="invite-member-form"
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
							>
								<FieldGroup>
									<form.Field
										name="email"
										children={(field) => (
											<Field
												data-invalid={
													field.state.meta.isTouched &&
													!field.state.meta.isValid
												}
											>
												<FieldLabel htmlFor={field.name}>
													メールアドレス
												</FieldLabel>
												<Input
													id={field.name}
													name={field.name}
													type="email"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
												/>
												{field.state.meta.isTouched &&
													!field.state.meta.isValid && (
														<FieldError errors={field.state.meta.errors} />
													)}
											</Field>
										)}
									/>
									<form.Field
										name="role"
										children={(field) => (
											<Field>
												<FieldLabel>権限</FieldLabel>
												<Select
													value={field.state.value}
													onValueChange={(v) =>
														field.handleChange(
															v as "admin" | "member" | "owner",
														)
													}
												>
													<SelectTrigger>
														<SelectValue placeholder="権限を選択" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="admin">Admin</SelectItem>
														<SelectItem value="member">Member</SelectItem>
														<SelectItem value="owner">Owner</SelectItem>
													</SelectContent>
												</Select>
											</Field>
										)}
									/>
								</FieldGroup>
							</form>
							<DialogFooter>
								<Button
									type="submit"
									form="invite-member-form"
									disabled={form.state.isSubmitting}
								>
									{form.state.isSubmitting && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									招待を送信
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				<div className="rounded-md border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12"></TableHead>
								<TableHead>名前</TableHead>
								<TableHead>メールアドレス</TableHead>
								<TableHead>権限</TableHead>
								<TableHead className="text-right">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((m) => (
								<TableRow key={m.id}>
									<TableCell>
										<Avatar className="h-8 w-8">
											<AvatarImage src={m.user.image || ""} />
											<AvatarFallback>{m.user.name.slice(0, 2)}</AvatarFallback>
										</Avatar>
									</TableCell>
									<TableCell className="font-medium">{m.user.name}</TableCell>
									<TableCell>{m.user.email}</TableCell>
									<TableCell>
										<Badge variant="outline">{m.role}</Badge>
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleRemoveMember(m.id)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</TableCell>
								</TableRow>
							))}
							{members.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 text-center text-muted-foreground"
									>
										メンバーがいません
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Invitations Section */}
			{invitations.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-lg font-medium">招待中</h3>
					<div className="rounded-md border bg-card">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>メールアドレス</TableHead>
									<TableHead>権限</TableHead>
									<TableHead>ステータス</TableHead>
									<TableHead className="text-right">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invitations.map((inv) => (
									<TableRow key={inv.id}>
										<TableCell className="font-medium flex items-center gap-2">
											<Mail className="h-4 w-4 text-muted-foreground" />
											{inv.email}
										</TableCell>
										<TableCell>
											<Badge variant="outline">{inv.role}</Badge>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{inv.status}</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleCancelInvitation(inv.id)}
											>
												<X className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}
		</div>
	);
}
