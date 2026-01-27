import type { Metadata } from "next";
import Client from "./client";

export const metadata: Metadata = {
	title: "管理",
	description:
		"管理者用ダッシュボードページ。ユーザー管理やシステム設定を行います。",
};

export default function AdminPage() {
	return <Client />;
}
