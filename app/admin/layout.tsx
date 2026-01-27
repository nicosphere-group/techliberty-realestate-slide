import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";
import { auth } from "@/lib/auth";

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

	return <SessionProvider initialSession={session}>{children}</SessionProvider>;
}
