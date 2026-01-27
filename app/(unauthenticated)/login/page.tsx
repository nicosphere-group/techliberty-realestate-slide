import type { Metadata } from "next";
import Client from "./client";

export const metadata: Metadata = {
	title: "ログイン",
	description:
		"不動産プレゼンテーションスライド生成ツールへのログインページです。",
};

export default function LoginPage() {
	return <Client />;
}
