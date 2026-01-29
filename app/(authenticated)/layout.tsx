import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { auth } from "@/lib/auth";
import { AppHeader } from "./_components/app-header";

export default async function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	return (
		<SessionProvider initialSession={session}>
			<div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
				<AppHeader />
				{children}
			</div>
		</SessionProvider>
	);
}
