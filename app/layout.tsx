import type { Metadata } from "next";
import { Figtree, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		template: "%s | RealEstate Slide Generator",
		default: "RealEstate Slide Generator",
	},
	description: "不動産プレゼンテーションスライド生成ツール",
	authors: [{ name: "RealEstate Slide Generator" }],
	// このプロジェクトでLPなどを公開したり、SEO対策を行う場合は、以下の設定を削除してください
	robots: {
		index: false,
		follow: false,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<html lang="ja" className={figtree.variable} suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<QueryClientProvider client={queryClient}>
						{children}
						<ReactQueryDevtools initialIsOpen={false} />
					</QueryClientProvider>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
