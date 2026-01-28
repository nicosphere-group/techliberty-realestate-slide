import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function settingsPage() {
	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">システム設定</h2>
				<p className="text-muted-foreground">システム全体の設定を行います。</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>一般設定</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						現在設定可能な項目はありません。
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
