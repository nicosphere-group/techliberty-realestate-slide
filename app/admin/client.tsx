"use client";

import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
	return (
		<div className="p-4 space-y-6">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Link href="/admin/organizations">
					<Card className="hover:bg-muted/50 transition-colors cursor-pointer">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								組織 (Organizations)
							</CardTitle>
							<Building2 className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">管理</div>
							<p className="text-xs text-muted-foreground">
								企業の作成・編集・設定
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link href="/admin/users">
					<Card className="hover:bg-muted/50 transition-colors cursor-pointer">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								ユーザー (Users)
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">一覧</div>
							<p className="text-xs text-muted-foreground">
								全ユーザーの確認・管理
							</p>
						</CardContent>
					</Card>
				</Link>
			</div>
		</div>
	);
}
