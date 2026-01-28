import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./_components/admin-sidebar";

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

	if (!(session.user.role?.split(",") ?? []).includes("admin")) {
		forbidden();
	}

	return (
		<SessionProvider initialSession={session}>
			<SidebarProvider>
				<AdminSidebar />
				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<h1 className="text-xl font-semibold">管理コンソール</h1>
					</header>
					<div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
				</SidebarInset>
			</SidebarProvider>
		</SessionProvider>
	);
}
