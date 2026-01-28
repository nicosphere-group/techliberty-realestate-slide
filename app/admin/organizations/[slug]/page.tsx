import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { OrgMembers } from "./_components/org-members";
import { OrgTeams } from "./_components/org-teams";

export const metadata: Metadata = {
	title: "組織詳細",
};

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgDetailsPage({ params }: Props) {
	const { slug } = await params;

	const org = await prisma.organization.findUnique({
		where: { slug },
		include: {
			teams: { orderBy: { createdAt: "desc" } },
			members: {
				include: { user: true },
				orderBy: { createdAt: "desc" },
			},
			invitations: {
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!org) notFound();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">{org.name}</h2>
				<div className="flex items-center gap-2 text-muted-foreground">
					<span>Slug: {org.slug}</span>
					<span>•</span>
					<span>ID: {org.id}</span>
				</div>
			</div>

			<Tabs defaultValue="members" className="space-y-4">
				<TabsList>
					<TabsTrigger value="members">メンバー & 招待</TabsTrigger>
					<TabsTrigger value="teams">チーム</TabsTrigger>
				</TabsList>
				<TabsContent value="members" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>メンバー管理</CardTitle>
							<CardDescription>
								組織に所属するメンバーと、現在招待中のユーザーを管理します。
							</CardDescription>
						</CardHeader>
						<CardContent>
							<OrgMembers
								orgId={org.id}
								members={org.members}
								invitations={org.invitations}
							/>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="teams" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>チーム管理</CardTitle>
							<CardDescription>
								組織内の部署や支店ごとのチームを作成・管理します。
							</CardDescription>
						</CardHeader>
						<CardContent>
							<OrgTeams orgId={org.id} teams={org.teams} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
