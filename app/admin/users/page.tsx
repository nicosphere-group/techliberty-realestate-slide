import type { Metadata } from "next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

import { CustomPagination } from "../_components/pagination";

export const metadata: Metadata = {
	title: "ユーザー一覧",
};

interface Props {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UsersPage({ searchParams }: Props) {
	const params = await searchParams;
	const page = Number(params.page) || 1;
	const take = 20;
	const skip = (page - 1) * take;

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			orderBy: { createdAt: "desc" },
			skip,
			take,
		}),
		prisma.user.count(),
	]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">ユーザー一覧</h2>
					<p className="text-muted-foreground">
						システムに登録されている全ユーザーです。
					</p>
				</div>
			</div>

			<div className="rounded-md border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12"></TableHead>
							<TableHead>名前</TableHead>
							<TableHead>メールアドレス</TableHead>
							<TableHead>権限 (Role)</TableHead>
							<TableHead>作成日</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((user) => (
							<TableRow key={user.id}>
								<TableCell>
									<Avatar className="h-9 w-9">
										<AvatarImage src={user.image ?? ""} alt={user.name} />
										<AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
									</Avatar>
								</TableCell>
								<TableCell className="font-medium">{user.name}</TableCell>
								<TableCell>{user.email}</TableCell>
								<TableCell>
									<Badge
										variant={
											user.role?.includes("admin") ? "default" : "secondary"
										}
									>
										{user.role || "user"}
									</Badge>
								</TableCell>
								<TableCell>
									{user.createdAt.toLocaleDateString("ja-JP")}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="mt-4">
				<CustomPagination total={total} page={page} perPage={take} />
			</div>
		</div>
	);
}
