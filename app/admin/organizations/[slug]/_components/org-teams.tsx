"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { createTeam } from "@/app/admin/actions";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Team } from "@/lib/generated/prisma/client";
import { TeamActions } from "./team-actions";

const teamSchema = z.object({
	name: z.string().min(1, "チーム名は必須です"),
});

interface Props {
	orgId: string;
	teams: Team[];
}

export function OrgTeams({ orgId, teams }: Props) {
	const [open, setOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			name: "",
		} as z.input<typeof teamSchema>,
		validators: {
			onSubmit: teamSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const res = await createTeam(orgId, value.name);
				if (res.success) {
					toast.success("チームを作成しました");
					setOpen(false);
					form.reset();
				}
			} catch (error) {
				console.error(error);
				toast.error("エラーが発生しました");
			}
		},
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-medium">チーム一覧</h3>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="mr-2 h-4 w-4" />
							チーム作成
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>チームを作成</DialogTitle>
						</DialogHeader>
						<form
							id="create-team-form"
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
								form="create-team-form"
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
			</div>

			<div className="rounded-md border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>名前</TableHead>
							<TableHead>作成日</TableHead>
							<TableHead className="w-12"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{teams.map((team) => (
							<TableRow key={team.id}>
								<TableCell className="font-medium flex items-center gap-2">
									<Users className="h-4 w-4 text-muted-foreground" />
									{team.name}
								</TableCell>
								<TableCell>
									{new Date(team.createdAt).toLocaleDateString("ja-JP")}
								</TableCell>
								<TableCell>
									<TeamActions team={team} />
								</TableCell>
							</TableRow>
						))}
						{teams.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={2}
									className="h-24 text-center text-muted-foreground"
								>
									チームがありません
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
