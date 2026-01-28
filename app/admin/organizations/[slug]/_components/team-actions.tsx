"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { removeTeam, updateTeam } from "@/app/admin/actions";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Team } from "@/lib/generated/prisma/client";

const teamSchema = z.object({
	name: z.string().min(1, "チーム名は必須です"),
});

interface Props {
	team: Team;
}

export function TeamActions({ team }: Props) {
	const [openEdit, setOpenEdit] = useState(false);
	const [openDelete, setOpenDelete] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const form = useForm({
		defaultValues: {
			name: team.name,
		} as z.input<typeof teamSchema>,
		validators: {
			onSubmit: teamSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const res = await updateTeam(team.id, value.name);
				if (res.success) {
					toast.success("チーム名を更新しました");
					setOpenEdit(false);
				}
			} catch (error) {
				console.error(error);
				if (error instanceof Error) {
					toast.error(error.message);
				} else {
					toast.error("エラーが発生しました");
				}
			}
		},
	});

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const res = await removeTeam(team.id);
			if (res.success) {
				toast.success("チームを削除しました");
				setOpenDelete(false);
			}
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error("エラーが発生しました");
			}
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<MoreHorizontal className="h-4 w-4" />
						<span className="sr-only">メニューを開く</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setOpenEdit(true)}>
						<Pencil className="mr-2 h-4 w-4" />
						編集
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setOpenDelete(true)}
						className="text-destructive focus:text-destructive"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						削除
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Edit Dialog */}
			<Dialog open={openEdit} onOpenChange={setOpenEdit}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>チーム名を編集</DialogTitle>
					</DialogHeader>
					<form
						id={`edit-team-form-${team.id}`}
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
									<Field>
										<FieldLabel htmlFor={field.name}>チーム名</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							/>
						</FieldGroup>
					</form>
					<DialogFooter>
						<Button
							type="submit"
							form={`edit-team-form-${team.id}`}
							disabled={form.state.isSubmitting}
						>
							{form.state.isSubmitting && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							保存
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Alert Dialog */}
			<AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
						<AlertDialogDescription>
							この操作は取り消せません。チームに所属するメンバーへの影響を確認してください。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>キャンセル</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								handleDelete();
							}}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							削除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
