import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { CreateOrgDialog } from "./_components/create-org-dialog";

export const metadata: Metadata = {
	title: "組織一覧",
};

interface Props {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function OrganizationsPage({ searchParams }: Props) {
	const params = await searchParams;
	const page = Number(params.page) || 1;
	const take = 20;
	const skip = (page - 1) * take;

	const [orgs, total] = await Promise.all([
		prisma.organization.findMany({
			orderBy: { createdAt: "desc" },
			include: { _count: { select: { members: true, teams: true } } },
			skip,
			take,
		}),
		prisma.organization.count(),
	]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">組織一覧</h2>
					<p className="text-muted-foreground">
						登録されている組織（企業）を管理します。
					</p>
				</div>
				<CreateOrgDialog />
			</div>

			<div className="rounded-md border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>名前</TableHead>
							<TableHead>スラッグ</TableHead>
							<TableHead>メンバー数</TableHead>
							<TableHead>チーム数</TableHead>
							<TableHead>作成日</TableHead>
							<TableHead className="text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{orgs.map((org) => (
							<TableRow key={org.id}>
								<TableCell className="font-medium">{org.name}</TableCell>
								<TableCell>{org.slug}</TableCell>
								<TableCell>{org._count.members}</TableCell>
								<TableCell>{org._count.teams}</TableCell>
								<TableCell>
									{org.createdAt.toLocaleDateString("ja-JP")}
								</TableCell>
								<TableCell className="text-right">
									<Button variant="ghost" size="sm" asChild>
										<Link href={`/admin/organizations/${org.slug}`}>
											詳細 <ArrowRight className="ml-2 h-4 w-4" />
										</Link>
									</Button>
								</TableCell>
							</TableRow>
						))}
						{orgs.length === 0 && (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									組織がありません。新規作成してください。
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="mt-4">
				<CustomPagination total={total} page={page} perPage={take} />
			</div>
		</div>
	);
}
